"""Pulse Image MCP server.

This server exposes Pulse Image's local HTTP API as MCP tools for OpenCode and
other local MCP clients. It does not run generation itself; the Pulse FastAPI
backend must be running separately.
"""
from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import re
import sys
import uuid
from pathlib import Path
from typing import Any

import httpx
from mcp.server.mcpserver import MCPServer

PULSE_URL = os.environ.get("PULSE_IMAGE_URL", "http://127.0.0.1:8000").rstrip("/")
HTTP_TIMEOUT = float(os.environ.get("PULSE_MCP_HTTP_TIMEOUT", "43200"))

mcp = MCPServer(
    "pulse-image",
    title="Pulse Image",
    version="0.1.0",
    instructions=(
        "Pulse Image is a local-first media studio. Use library asset IDs rather "
        "than raw filesystem paths. Image and short jobs usually finish quickly; "
        "video and recast jobs can take minutes. All tools target the local "
        "Pulse Image server configured by PULSE_IMAGE_URL."
    ),
)


async def _request(
    method: str,
    path: str,
    body: dict | None = None,
    *,
    raw: bool = False,
    timeout: float | None = None,
) -> Any:
    if not path.startswith("/"):
        return {"success": False, "error": "path must start with /"}
    url = f"{PULSE_URL}{path}"
    try:
        async with httpx.AsyncClient(timeout=timeout or HTTP_TIMEOUT) as client:
            response = await client.request(method.upper(), url, json=body)
        if raw:
            if response.status_code >= 400:
                return {"success": False, "status": response.status_code, "error": response.text[-2000:]}
            return response.content
        if response.status_code >= 400:
            try:
                detail = response.json()
            except Exception:
                detail = {"error": response.text[-2000:]}
            detail.setdefault("success", False)
            detail.setdefault("status", response.status_code)
            return detail
        try:
            return response.json()
        except Exception:
            return {"success": True, "text": response.text}
    except Exception as exc:
        return {"success": False, "error": str(exc)}


async def _get(path: str) -> Any:
    return await _request("GET", path)


async def _post(path: str, body: dict | None = None) -> Any:
    return await _request("POST", path, body or {})


async def _delete(path: str) -> Any:
    return await _request("DELETE", path)


def _attachment(name: Any, ref_type: str) -> dict:
    return {"name": str(name), "type": ref_type}


def _payload_attachments(payload: dict) -> dict:
    attachments: dict[str, Any] = {}
    images: list[dict] = []
    audios: list[dict] = []
    videos: list[dict] = []

    def add(items: list[dict], name: Any, ref_type: str) -> None:
        if name in (None, ""):
            return
        value = str(name)
        if not any(item.get("name") == value for item in items):
            items.append(_attachment(value, ref_type))

    add(images, payload.get("source_image"), "image")
    add(images, payload.get("modifier_image"), "image")
    for name in payload.get("ref_images") or []:
        add(images, name, "image")
    add(audios, payload.get("modifier_audio"), "audio")
    for name in payload.get("ref_audios") or []:
        add(audios, name, "audio")
    add(videos, payload.get("ref_video"), "video")

    if images:
        attachments["images"] = images
    if audios:
        attachments["audios"] = audios
    if videos:
        attachments["videos"] = videos

    lora_name = payload.get("lora_name")
    if payload.get("mode") == "image" and lora_name and not images:
        attachments["lora"] = _attachment(lora_name, "lora")

    return attachments


async def _save_result(
    prompt: str,
    result: dict,
    media_type: str,
    aspect_ratio: str,
    payload: dict | None = None,
) -> dict:
    if not isinstance(result, dict) or not result.get("success"):
        return result
    if result.get("asset_id"):
        return result
    filename = result.get("local_filename") or result.get("filename")
    if not filename:
        return result
    payload = payload or {}
    gen = dict(result.get("metadata") or {})
    attachments = dict(gen.get("attachments") or {})
    attachments.update(_payload_attachments(payload))
    gen.update({
        "mode": media_type,
        "resolution": result.get("resolution") or payload.get("resolution"),
        "aspect_ratio": aspect_ratio,
        "duration": result.get("duration"),
        "original_prompt": prompt,
        "image_model": payload.get("image_model"),
        "i2i_model": payload.get("i2i_model") if payload.get("source_image") else None,
        "video_model": result.get("video_model") or payload.get("video_model"),
        "ltx_version": result.get("ltx_version") or payload.get("ltx_version"),
        "fasth3_mode": payload.get("fasth3_mode"),
        "recast": bool(result.get("recast")),
        "recast_engine": result.get("recast_engine"),
        "upscale": result.get("upscale"),
        "attachments": attachments or None,
    })
    saved = await _post("/save-generation", {
        "prompt": prompt or "Untitled generation",
        "filename": filename,
        "type": media_type,
        "aspect_ratio": aspect_ratio,
        "width": result.get("width", 0),
        "height": result.get("height", 0),
        "duration": result.get("duration"),
        "metadata": {"gen": gen},
    })
    if saved.get("id"):
        result["asset_id"] = saved["id"]
    else:
        result["save_error"] = saved.get("error") or "save-generation failed"
    return result


async def _generate(payload: dict, prompt: str, media_type: str, aspect_ratio: str) -> dict:
    payload.setdefault("job_id", uuid.uuid4().hex)
    payload.setdefault("client", "mcp")
    data = await _post("/generate", payload)
    if not data.get("success"):
        return data
    results = []
    for result in data.get("results") or []:
        if result.get("success"):
            results.append(await _save_result(prompt, result, media_type, aspect_ratio, payload))
        else:
            results.append(result)
    return {"success": True, "results": results}


@mcp.tool(description="Run an arbitrary Pulse Image JSON API request. Use /openapi.json via pulse_openapi for the full endpoint list.")
async def pulse_api(method: str, path: str, body: dict | None = None) -> Any:
    return await _request(method, path, body)


@mcp.tool(description="Return the Pulse Image OpenAPI schema, including every REST endpoint.")
async def pulse_openapi() -> Any:
    return await _get("/openapi.json")


@mcp.tool(description="List or search library assets. Optionally filter by type, text, favorite, character, or voice.")
async def pulse_library(
    asset_type: str | None = None,
    search: str | None = None,
    favorite: bool | None = None,
    character: bool | None = None,
    voice: bool | None = None,
    limit: int = 100,
) -> Any:
    data = await _get("/history")
    if not isinstance(data, list):
        return data
    needle = (search or "").lower().strip()
    result = []
    for asset in data:
        if asset_type and asset.get("type") != asset_type:
            continue
        if favorite is not None and bool(asset.get("favorite")) != favorite:
            continue
        if character is not None and bool(asset.get("character")) != character:
            continue
        if voice is not None and bool(asset.get("voice")) != voice:
            continue
        if needle:
            haystack = " ".join(str(asset.get(k) or "") for k in ("prompt", "filename", "id")).lower()
            if needle not in haystack:
                continue
        result.append(asset)
        if len(result) >= max(1, int(limit)):
            break
    return {"assets": result, "count": len(result)}


@mcp.tool(description="Get one library asset by ID.")
async def pulse_get_asset(asset_id: str) -> Any:
    data = await _get("/history")
    if not isinstance(data, list):
        return data
    for asset in data:
        if str(asset.get("id")) == str(asset_id):
            return {"success": True, "asset": asset}
    return {"success": False, "error": "Asset not found"}


@mcp.tool(description="Upload a local file into the Pulse Image library input folders and return its filename.")
async def pulse_upload_asset(file_path: str) -> Any:
    path = Path(file_path).expanduser()
    if not path.is_file():
        return {"success": False, "error": f"File not found: {file_path}"}
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            with path.open("rb") as handle:
                response = await client.post(
                    f"{PULSE_URL}/upload",
                    files={"file": (path.name, handle, mime)},
                )
        return response.json()
    except Exception as exc:
        return {"success": False, "error": str(exc)}


@mcp.tool(description="Update editable library flags or prompt fields for an asset.")
async def pulse_update_asset(
    asset_id: str,
    prompt: str | None = None,
    filename: str | None = None,
    favorite: bool | None = None,
    character: bool | None = None,
    voice: bool | None = None,
    music: bool | None = None,
) -> Any:
    body: dict[str, Any] = {"id": asset_id}
    if prompt is not None:
        body["prompt"] = prompt
    if filename is not None:
        body["filename"] = filename
    if favorite is not None:
        body["favorite"] = favorite
    if character is not None:
        body["character"] = character
    if voice is not None:
        body["voice"] = voice
    if music is not None:
        body["music"] = music
    return await _post("/update-generation", body)


@mcp.tool(description="Delete a library asset and its local media. Set cascade to delete children.")
async def pulse_delete_asset(asset_id: str, cascade: bool = False) -> Any:
    return await _post("/delete-generation", {"id": asset_id, "cascade": cascade})


@mcp.tool(description="List model assets reported by ComfyUI, including workflow-required files and LoRAs.")
async def pulse_models() -> Any:
    models, loras = await _async_gather(_get("/comfy/models"), _get("/loras"))
    return {"models": models, "loras": loras}


async def _async_gather(*aws):
    import asyncio
    return await asyncio.gather(*aws)


@mcp.tool(description="Return ComfyUI, Ollama, stems, music, TTS, and upscaler capability status.")
async def pulse_capabilities() -> Any:
    return {
        "comfy": await _get("/comfy/status"),
        "capabilities": await _get("/comfy/capabilities"),
        "stems": await _get("/stems/capabilities"),
        "songs": await _get("/songs/capabilities"),
        "tts": await _get("/tts/engines"),
    }


@mcp.tool(description="Read Pulse Image app settings.")
async def pulse_settings() -> Any:
    return await _get("/settings")


@mcp.tool(description="Update Pulse Image app settings with a JSON object.")
async def pulse_update_settings(settings: dict) -> Any:
    return await _post("/settings", settings)


@mcp.tool(description="Read raw database settings, including advanced keys.")
async def pulse_admin_settings() -> Any:
    return await _get("/admin/settings")


@mcp.tool(description="Update one raw database setting key/value pair.")
async def pulse_admin_update_setting(key: str, value: str) -> Any:
    return await _post("/admin/update-setting", {"key": key, "value": value})


@mcp.tool(description="List raw generation rows with metadata.")
async def pulse_admin_generations() -> Any:
    return await _get("/admin/generations")


@mcp.tool(description="Generate one or more images and save them to the library.")
async def pulse_generate_image(
    prompt: str,
    image_model: str = "schnell",
    resolution: str = "720p",
    aspect_ratio: str = "16:9",
    count: int = 1,
    qwen_turbo: bool = True,
    lora_name: str | None = None,
    lora_strength: float = 0.6,
    source_image: str | None = None,
    modifier_image: str | None = None,
) -> Any:
    payload = {
        "mode": "image",
        "prompt": prompt,
        "image_model": image_model,
        "i2i_model": image_model,
        "resolution": resolution,
        "aspect_ratio": aspect_ratio,
        "count": count,
        "qwen_turbo": qwen_turbo,
        "lora_name": lora_name,
        "lora_strength": lora_strength,
        "source_image": source_image,
        "modifier_image": modifier_image,
    }
    return await _generate(payload, prompt, "image", aspect_ratio)


@mcp.tool(description="Generate a single image edit from a source image, optionally with a modifier image.")
async def pulse_edit_image(
    prompt: str,
    source_image: str,
    i2i_model: str = "klein",
    modifier_image: str | None = None,
    resolution: str = "720p",
    aspect_ratio: str = "16:9",
) -> Any:
    payload = {
        "mode": "image",
        "prompt": prompt,
        "source_image": source_image,
        "modifier_image": modifier_image,
        "i2i_model": i2i_model,
        "resolution": resolution,
        "aspect_ratio": aspect_ratio,
        "count": 1,
    }
    return await _generate(payload, prompt, "image", aspect_ratio)


@mcp.tool(description="Generate a video with LTX or FastH3 and save it to the library.")
async def pulse_generate_video(
    prompt: str,
    video_model: str = "ltx",
    ltx_version: str = "2.3",
    fasth3_mode: str = "reference",
    resolution: str = "720p",
    aspect_ratio: str = "16:9",
    duration: float = 6,
    source_image: str | None = None,
    ref_images: list[str] | None = None,
    ref_audios: list[str] | None = None,
    modifier_audio: str | None = None,
    video_upscale: str = "off",
    upscale_detail: float | None = None,
    disable_prompt_enhance: bool = False,
) -> Any:
    payload = {
        "mode": "video",
        "prompt": prompt,
        "video_model": video_model,
        "ltx_version": ltx_version,
        "fasth3_mode": fasth3_mode,
        "resolution": resolution,
        "aspect_ratio": aspect_ratio,
        "duration": duration,
        "source_image": source_image,
        "ref_images": ref_images or [],
        "ref_audios": ref_audios or [],
        "modifier_audio": modifier_audio,
        "video_upscale": video_upscale,
        "upscale_detail": upscale_detail,
        "disable_prompt_enhance": disable_prompt_enhance,
    }
    result = await _generate(payload, prompt, "video", aspect_ratio)
    for item in result.get("results", []):
        if isinstance(item, dict):
            item.setdefault("video_model", video_model)
            item.setdefault("ltx_version", ltx_version)
    return result


@mcp.tool(description="Recast a source video using a starting character image and save the result.")
async def pulse_recast_video(
    ref_video: str,
    source_image: str,
    prompt: str,
    recast_engine: str = "ltx25",
    resolution: str = "720p",
    aspect_ratio: str = "16:9",
    duration: float = 6,
    ref_images: list[str] | None = None,
    recast_settings: dict | None = None,
    video_upscale: str = "off",
    upscale_detail: float | None = None,
) -> Any:
    settings = dict(recast_settings or {})
    payload = {
        "mode": "video",
        "recast": True,
        "recast_engine": recast_engine,
        "prompt": prompt,
        "ref_video": ref_video,
        "source_image": source_image,
        "ref_images": ref_images or [],
        "recast_settings": settings,
        "resolution": resolution,
        "aspect_ratio": aspect_ratio,
        "duration": duration,
        "video_model": "fasth3" if recast_engine == "fasth3" else "ltx",
        "ltx_version": "2.5" if recast_engine == "ltx25" else ("2.3" if recast_engine == "ltx23" else "2.3"),
        "video_upscale": video_upscale,
        "upscale_detail": upscale_detail,
    }
    return await _generate(payload, prompt, "video", aspect_ratio)


@mcp.tool(description="Upscale an existing video asset with the configured RelayVSR or ReCaVSR engine.")
async def pulse_upscale_video(asset_id: str, video_upscale: str, detail: float | None = None) -> Any:
    return await _post("/upscale-video", {
        "asset_id": asset_id,
        "video_upscale": video_upscale,
        "detail": detail,
        "job_id": uuid.uuid4().hex,
    })


@mcp.tool(description="Generate speech from text using a voice asset or voice ID.")
async def pulse_generate_speech(
    text: str,
    voice_id: str = "",
    voice_filename: str = "",
    engine: str = "qwen3",
    language: str = "English",
    emotion: str = "neutral",
    instruction: str = "",
    ref_text: str = "",
    seed: int = 0,
) -> Any:
    return await _post("/tts/generate", {
        "text": text,
        "voice_id": voice_id,
        "voice_filename": voice_filename,
        "engine": engine,
        "language": language,
        "emotion": emotion,
        "instruction": instruction,
        "ref_text": ref_text,
        "seed": seed,
        "job_id": uuid.uuid4().hex,
    })


@mcp.tool(description="Generate a YuE2 song from style and lyrics, optionally instrumental.")
async def pulse_generate_song(
    style: str,
    lyrics: str = "",
    title: str = "",
    instrumental: bool = False,
    planning: str = "full",
    max_duration: int = 300,
    seed: int = 0,
) -> Any:
    return await _post("/songs/generate", {
        "style": style,
        "lyrics": lyrics,
        "title": title,
        "instrumental": instrumental,
        "planning": planning,
        "max_duration": max_duration,
        "seed": seed,
        "job_id": uuid.uuid4().hex,
    })


@mcp.tool(description="Create a YuE2 cover from a library audio asset.")
async def pulse_generate_song_cover(
    asset_id: str,
    style: str,
    lyrics: str = "",
    title: str = "",
    instrumental: bool = False,
    max_duration: int = 300,
    seed: int = 0,
) -> Any:
    return await _post("/songs/cover", {
        "asset_id": asset_id,
        "style": style,
        "lyrics": lyrics,
        "title": title,
        "instrumental": instrumental,
        "max_duration": max_duration,
        "seed": seed,
        "job_id": uuid.uuid4().hex,
    })


@mcp.tool(description="Separate an audio asset into stems with Demucs.")
async def pulse_separate_stems(asset_id: str) -> Any:
    return await _post(f"/stems/{asset_id}", {"job_id": uuid.uuid4().hex})


@mcp.tool(description="Mix selected stems from a stem asset into a new audio asset.")
async def pulse_mix_stems(asset_id: str, stem_ids: list[str], volumes: dict | None = None) -> Any:
    return await _post(f"/stems/{asset_id}/mix", {"stem_ids": stem_ids, "volumes": volumes or {}})


@mcp.tool(description="Get saved stems or separation status for an audio asset.")
async def pulse_stems_status(asset_id: str) -> Any:
    return await _get(f"/stems/{asset_id}")


@mcp.tool(description="Inspect the audio stream of a library video.")
async def pulse_video_audio_info(asset_id: str) -> Any:
    return await _post("/video-audio/info", {"asset_id": asset_id})


@mcp.tool(description="Extract a video's audio track and save it to the library.")
async def pulse_extract_video_audio(asset_id: str) -> Any:
    return await _post("/video-audio/extract", {"asset_id": asset_id})


@mcp.tool(description="Probe a library video for duration, FPS, dimensions and frame count.")
async def pulse_frames_info(asset_id: str) -> Any:
    return await _post("/frames/info", {"asset_id": asset_id})


@mcp.tool(description="List a window of cached frame thumbnails for a video.")
async def pulse_frames_window(asset_id: str, start_index: int = 0, count: int = 24) -> Any:
    return await _post("/frames/window", {"asset_id": asset_id, "start_index": start_index, "count": count})


@mcp.tool(description="Get one full-resolution preview frame from a video.")
async def pulse_frames_preview(asset_id: str, frame_index: int) -> Any:
    return await _post("/frames/preview", {"asset_id": asset_id, "frame_index": frame_index})


@mcp.tool(description="Save one video frame to the library as an image asset.")
async def pulse_save_frame(asset_id: str, frame_index: int) -> Any:
    return await _post("/frames/save", {"asset_id": asset_id, "frame_index": frame_index})


@mcp.tool(description="Get ComfyUI progress for a job ID.")
async def pulse_progress(job_id: str) -> Any:
    return await _get(f"/comfy/progress/{job_id}")


@mcp.tool(description="List all stories.")
async def pulse_stories() -> Any:
    return await _get("/stories")


@mcp.tool(description="Get a story with cast, scenes and shots.")
async def pulse_story(story_id: str) -> Any:
    return await _get(f"/stories/{story_id}")


@mcp.tool(description="Create a story project.")
async def pulse_create_story(title: str, premise: str = "", settings: dict | None = None) -> Any:
    return await _post("/stories", {"title": title, "premise": premise, "settings": settings or {}})


@mcp.tool(description="Update a story project.")
async def pulse_update_story(story_id: str, updates: dict) -> Any:
    return await _post(f"/stories/{story_id}", updates)


@mcp.tool(description="Delete a story and all its scenes, shots and cast.")
async def pulse_delete_story(story_id: str) -> Any:
    return await _delete(f"/stories/{story_id}")


@mcp.tool(description="Add or update a story cast member.")
async def pulse_story_add_cast(story_id: str, character_asset_id: str, role_name: str = "", notes: str = "") -> Any:
    return await _post(f"/stories/{story_id}/cast", {
        "character_asset_id": character_asset_id,
        "role_name": role_name,
        "notes": notes,
    })


@mcp.tool(description="Add a scene to a story.")
async def pulse_story_add_scene(story_id: str, scene: dict) -> Any:
    return await _post(f"/stories/{story_id}/scenes", scene)


@mcp.tool(description="Update a story scene.")
async def pulse_story_update_scene(story_id: str, scene_id: str, updates: dict) -> Any:
    return await _post(f"/stories/{story_id}/scenes/{scene_id}", updates)


@mcp.tool(description="Add a shot to a story scene.")
async def pulse_story_add_shot(story_id: str, scene_id: str, shot: dict) -> Any:
    return await _post(f"/stories/{story_id}/scenes/{scene_id}/shots", shot)


@mcp.tool(description="Run the AI story planner for a story.")
async def pulse_story_plan(story_id: str) -> Any:
    return await _post(f"/stories/{story_id}/plan", {})


@mcp.tool(description="Generate keyframes for a story shot.")
async def pulse_story_keyframes(story_id: str, shot_id: str) -> Any:
    return await _post(f"/stories/{story_id}/shots/{shot_id}/keyframes", {})


@mcp.tool(description="Generate the video clip for a story shot.")
async def pulse_story_generate_shot(story_id: str, shot_id: str) -> Any:
    return await _post(f"/stories/{story_id}/shots/{shot_id}/generate", {})


@mcp.tool(description="Download a story ZIP export to the local exports folder.")
async def pulse_story_export(story_id: str) -> Any:
    return await _download(f"/stories/{story_id}/export", f"story-{story_id}.zip")


@mcp.tool(description="List music-video projects.")
async def pulse_music_video_projects() -> Any:
    return await _get("/music/projects")


@mcp.tool(description="Create a music-video project.")
async def pulse_music_video_create(title: str) -> Any:
    return await _post("/music/projects", {"title": title})


@mcp.tool(description="Get a music-video project.")
async def pulse_music_video_project(project_id: str) -> Any:
    return await _get(f"/music/projects/{project_id}")


@mcp.tool(description="Generate a music-video segment from a project audio track.")
async def pulse_music_video_generate_segment(segment_id: str, video_upscale: str = "off", detail: float | None = None) -> Any:
    return await _post(f"/music/segments/{segment_id}/generate", {
        "job_id": uuid.uuid4().hex,
        "video_upscale": video_upscale,
        "upscale_detail": detail,
    })


@mcp.tool(description="Download a music-video segment ZIP export.")
async def pulse_music_video_export_segments(project_id: str) -> Any:
    return await _download(f"/music/projects/{project_id}/segments/zip", f"music-video-{project_id}.zip")


@mcp.tool(description="Download a Lightworks FCP7 XML package for a music-video project.")
async def pulse_music_video_export_lwks(project_id: str) -> Any:
    return await _download(f"/music/projects/{project_id}/lwks", f"music-video-{project_id}-lwks.zip")


async def _download(path: str, filename: str) -> Any:
    content = await _request("GET", path, raw=True)
    if isinstance(content, dict):
        return content
    exports = Path("exports")
    exports.mkdir(exist_ok=True)
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "-", filename).strip(".-") or "export.zip"
    output = exports / safe
    output.write_bytes(content)
    return {"success": True, "path": str(output.resolve()), "bytes": len(content)}


@mcp.tool(description="Upload a file and return its Pulse Image filename.")
async def pulse_upload_asset_b64(filename: str, data_base64: str) -> Any:
    try:
        raw = base64.b64decode(data_base64)
    except Exception as exc:
        return {"success": False, "error": f"Invalid base64: {exc}"}
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                f"{PULSE_URL}/upload",
                files={"file": (filename, raw)},
            )
        return response.json()
    except Exception as exc:
        return {"success": False, "error": str(exc)}


def main() -> None:
    global PULSE_URL
    parser = argparse.ArgumentParser(description="Pulse Image MCP server")
    parser.add_argument("--transport", choices=("stdio", "streamable-http", "sse"), default="stdio")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--pulse-url", default=PULSE_URL)
    args = parser.parse_args()
    PULSE_URL = args.pulse_url.rstrip("/")
    if args.transport == "stdio":
        mcp.run("stdio")
    elif args.transport == "sse":
        mcp.run("sse", host=args.host, port=args.port)
    else:
        mcp.run(
            "streamable-http",
            host=args.host,
            port=args.port,
            streamable_http_path="/mcp",
        )


if __name__ == "__main__":
    main()
