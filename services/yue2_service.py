"""Music generation backed by ComfyUI's native YuE2 nodes."""

import asyncio
import json
import os
import time
import uuid

import httpx

from config import get_comfyui_url
from services.audio_service import delete_audio, get_audio_duration
from services.comfy_progress import post_prompt, set_progress_job
from services.comfy_service import upload_audio_to_comfy
from services.database_service import get_db
from services.generation_service import get_asset_by_id, save_generation

AUDIO_FOLDER = "audio"
SAVE_NODE = "10"
TEXT_WORKFLOW = "audio_yue2_text2music.json"
COVER_WORKFLOW = "audio_yue2_music_cover.json"
CHECKPOINT = "yue2_3b_int8_convrot.safetensors"
TEXT_SCORE_NODE = "33:14"
COVER_SCORE_NODE = "33:44"
AUDIO_EXTENSIONS = (".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".webm", ".opus")
PLANNING_MODES = ("full", "melody", "off")
GENERATION_TIMEOUT_SECONDS = 3600
WORKFLOW_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "workflows")


def _workflow_path(filename: str) -> str:
    return os.path.join(WORKFLOW_DIR, filename)


def _clamp_int(value, low: int, high: int, default: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(low, min(high, parsed))


def _clamp_float(value, low: float, high: float, default: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    if parsed != parsed:
        return default
    return max(low, min(high, parsed))


def _friendly_name(style: str, lyrics: str, title: str = "") -> str:
    if title.strip():
        return title.strip()[:120]
    text = " ".join((style or "").split()).strip()
    if not text:
        for line in (lyrics or "").splitlines():
            line = line.strip()
            if line and not (line.startswith("[") and line.endswith("]")):
                text = line
                break
    return (text or "YuE2 Song")[:80]


def _unique_song_name(base: str) -> str:
    base = (base or "").strip()
    if not base:
        return base
    names = set()
    conn = get_db()
    try:
        rows = conn.execute("SELECT metadata FROM generations WHERE type = 'audio'").fetchall()
        for row in rows:
            try:
                meta = json.loads(row["metadata"] or "{}")
            except Exception:
                continue
            name = meta.get("name") if isinstance(meta, dict) else None
            if isinstance(name, str) and name.strip():
                names.add(name.strip().casefold())
    finally:
        conn.close()
    if base.casefold() not in names:
        return base
    index = 1
    while f"{base} ({index})".casefold() in names:
        index += 1
    return f"{base} ({index})"


def _first_lyric_line(lyrics: str) -> str:
    for line in (lyrics or "").splitlines():
        line = line.strip()
        if line and not (line.startswith("[") and line.endswith("]")):
            return line
    return ""


def _load_workflow(filename: str) -> dict:
    with open(_workflow_path(filename), "r", encoding="utf-8") as f:
        return json.load(f)


def build_text_workflow(
    style: str,
    lyrics: str,
    planning: str,
    max_duration: int,
    acoustic_steps: int,
    max_score_tokens: int,
    seed: int,
    temperature: float,
    top_p: float,
    top_k: int,
    repetition_penalty: float,
    cfg_scale: float,
    abc_temperature: float,
    abc_top_p: float,
    abc_top_k: int,
    abc_repetition_penalty: float,
    abc_penalty_window: int,
) -> dict:
    workflow = _load_workflow(TEXT_WORKFLOW)
    workflow["33:15"]["inputs"]["ckpt_name"] = CHECKPOINT
    workflow["33:34"]["inputs"]["seed"] = seed
    workflow["33:36"]["inputs"]["value"] = style
    workflow["33:37"]["inputs"]["value"] = lyrics
    workflow["10"]["inputs"]["filename_prefix"] = "audio/YuE2/song"

    if planning == "off":
        workflow["33:25"]["inputs"]["abc"] = ""
        for node in ("33:24", "33:14", "33:30", "33:31", "33:32"):
            workflow.pop(node, None)
    else:
        workflow["33:31"]["inputs"]["value"] = True
        workflow["33:24"]["inputs"].update(
            {
                "clip": ["33:15", 1],
                "style": ["33:36", 0],
                "lyrics": ["33:37", 0],
                "seed": ["33:34", 0],
                "mode": planning,
                "max_abc_tokens": max_score_tokens,
                "temperature": abc_temperature,
                "top_p": abc_top_p,
                "top_k": abc_top_k,
                "repetition_penalty": abc_repetition_penalty,
                "penalty_window": abc_penalty_window,
            }
        )

    workflow["33:25"]["inputs"].update(
        {
            "style": ["33:36", 0],
            "lyrics": ["33:37", 0],
            "seed": ["33:34", 0],
            "mode": planning if planning != "off" else "full",
            "max_duration": max_duration,
            "temperature": temperature,
            "top_p": top_p,
            "top_k": top_k,
            "repetition_penalty": repetition_penalty,
            "cfg_scale": cfg_scale,
        }
    )
    workflow["33:8"]["inputs"]["steps"] = acoustic_steps
    return workflow


def build_cover_workflow(
    comfy_audio: str,
    style: str,
    lyrics: str,
    max_duration: int,
    acoustic_steps: int,
    seed: int,
    temperature: float,
    top_p: float,
    top_k: int,
    repetition_penalty: float,
    cfg_scale: float,
) -> dict:
    workflow = _load_workflow(COVER_WORKFLOW)
    workflow["33:15"]["inputs"]["ckpt_name"] = CHECKPOINT
    workflow["45"]["inputs"]["audio"] = comfy_audio
    workflow["33:34"]["inputs"]["seed"] = seed
    workflow["10"]["inputs"]["filename_prefix"] = "audio/YuE2/cover"
    workflow["33:25"]["inputs"].update(
        {
            "style": style,
            "lyrics": lyrics,
            "seed": ["33:34", 0],
            "mode": "melody",
            "max_duration": max_duration,
            "temperature": temperature,
            "top_p": top_p,
            "top_k": top_k,
            "repetition_penalty": repetition_penalty,
            "cfg_scale": cfg_scale,
        }
    )
    workflow["33:8"]["inputs"]["steps"] = acoustic_steps
    return workflow


def _audio_output_info(item) -> dict | None:
    if isinstance(item, dict) and item.get("filename"):
        return item
    if isinstance(item, (list, tuple)) and item:
        filename = str(item[0])
        if filename.lower().endswith(AUDIO_EXTENSIONS):
            subfolder = str(item[1]) if len(item) > 1 else ""
            if subfolder.lower() == "output":
                subfolder = ""
            return {"filename": filename, "subfolder": subfolder, "type": "output"}
    return None


def _find_audio_output(outputs: dict) -> dict | None:
    save_out = outputs.get(SAVE_NODE)
    if isinstance(save_out, dict):
        for key in ("audio", "files", "images"):
            val = save_out.get(key)
            info = _audio_output_info(val)
            if info:
                return info
            if isinstance(val, (list, tuple)):
                for item in val:
                    info = _audio_output_info(item)
                    if info:
                        return info
    for out in outputs.values():
        if not isinstance(out, dict):
            continue
        for key in ("audio", "files", "images"):
            val = out.get(key)
            info = _audio_output_info(val)
            if info:
                return info
            if isinstance(val, (list, tuple)):
                for item in val:
                    info = _audio_output_info(item)
                    if info:
                        return info
    return None


def _extract_text(outputs: dict, node_id: str) -> str | None:
    out = outputs.get(node_id)
    if not isinstance(out, dict):
        return None
    for key in ("text", "string", "score_abc", "abc"):
        val = out.get(key)
        if isinstance(val, str) and val.strip():
            return val
        if isinstance(val, list):
            for item in val:
                if isinstance(item, str) and item.strip():
                    return item
    return None


def _history_error(item: dict) -> str | None:
    status = item.get("status") or {}
    if status.get("status_str") != "error":
        return None
    for msg in status.get("messages") or []:
        if msg and msg[0] == "execution_error":
            detail = msg[1] or {}
            return detail.get("exception_message") or "YuE2 execution failed"
    return "YuE2 execution failed"


async def _model_files(folder: str) -> list[str]:
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(f"{get_comfyui_url()}/models/{folder}")
            data = res.json() if res.status_code == 200 else []
            return [str(item) for item in data] if isinstance(data, list) else []
    except Exception:
        return []


async def get_yue2_capabilities() -> dict:
    comfy_url = get_comfyui_url()
    result = {
        "available": False,
        "cover_available": False,
        "comfy_connected": False,
        "comfy_url": comfy_url,
        "node_installed": False,
        "cover_nodes_installed": False,
        "checkpoint_installed": False,
        "missing": [],
    }
    required = ("YuE2GenerateABC", "YuE2GenerateMusic", "EmptyYuE2LatentAudio", "VAEDecodeAudio")
    cover_required = ("SheetSage2AudioToABC", "AudioEncoderLoader")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            status = await client.get(f"{comfy_url}/object_info/YuE2GenerateMusic")
            result["comfy_connected"] = True
            text_ok = status.status_code == 200 and bool(status.json())
            for node in required:
                if node == "YuE2GenerateMusic":
                    ok = text_ok
                else:
                    res = await client.get(f"{comfy_url}/object_info/{node}")
                    ok = res.status_code == 200 and bool(res.json())
                if not ok:
                    result["missing"].append(node)
            result["node_installed"] = not any(
                node in result["missing"] for node in required
            )
            for node in cover_required:
                res = await client.get(f"{comfy_url}/object_info/{node}")
                if res.status_code != 200 or not res.json():
                    result["cover_nodes_installed"] = False
                    result["missing"].append(node)
                    break
            else:
                result["cover_nodes_installed"] = True
    except Exception:
        pass

    checkpoints = await _model_files("checkpoints")
    result["checkpoint_installed"] = CHECKPOINT in checkpoints
    if not result["checkpoint_installed"]:
        result["missing"].append(CHECKPOINT)

    result["available"] = bool(
        result["comfy_connected"]
        and result["node_installed"]
        and result["checkpoint_installed"]
    )
    result["cover_available"] = bool(
        result["available"] and result["cover_nodes_installed"]
    )
    return result


async def _run_workflow(workflow: dict, job_id: str) -> tuple[dict | None, str | None]:
    set_progress_job(job_id, 0)
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await post_prompt(client, workflow)
            if response.status_code != 200:
                try:
                    detail = response.json()
                except Exception:
                    detail = {}
                return None, detail.get("error") or f"ComfyUI error {response.status_code}"
            prompt_id = response.json().get("prompt_id")
            if not prompt_id:
                return None, "No prompt_id returned by ComfyUI"

            deadline = time.monotonic() + GENERATION_TIMEOUT_SECONDS
            while time.monotonic() < deadline:
                await asyncio.sleep(1)
                try:
                    history = (await client.get(f"{get_comfyui_url()}/history/{prompt_id}")).json()
                except Exception:
                    continue
                if prompt_id not in history:
                    continue
                item = history[prompt_id] or {}
                error = _history_error(item)
                if error:
                    return None, error
                outputs = item.get("outputs") or {}
                if _find_audio_output(outputs):
                    return outputs, None
            return None, "YuE2 generation timed out or produced no audio output"
    except Exception as exc:
        return None, str(exc)


async def _save_audio_result(
    outputs: dict,
    style: str,
    lyrics: str,
    title: str,
    planning: str,
    seed: int,
    max_duration: int,
    acoustic_steps: int,
    max_score_tokens: int,
    extra_metadata: dict | None = None,
    sampling: dict | None = None,
) -> dict:
    audio_info = _find_audio_output(outputs)
    if not audio_info:
        return {"success": False, "error": "No YuE2 audio output found"}

    source_filename = str(audio_info.get("filename") or "")
    ext = os.path.splitext(source_filename)[1] or ".flac"
    local_filename = f"{uuid.uuid4().hex}{ext}"
    try:
        params = {
            "filename": source_filename,
            "subfolder": audio_info.get("subfolder", ""),
            "type": audio_info.get("type") or "output",
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(f"{get_comfyui_url()}/view", params=params)
        if response.status_code != 200:
            return {"success": False, "error": "Failed to download YuE2 audio"}

        os.makedirs(AUDIO_FOLDER, exist_ok=True)
        with open(os.path.join(AUDIO_FOLDER, local_filename), "wb") as f:
            f.write(response.content)

        duration = get_audio_duration(local_filename)
        name = _unique_song_name(_friendly_name(style, lyrics, title))
        prompt = title.strip() or style or _first_lyric_line(lyrics) or name
        metadata = {
            "name": name,
            "source": "yue2",
            "is_music": True,
            "kind": "music",
            "title": title.strip() or name,
            "style": style,
            "lyrics": lyrics,
            "planning": planning,
            "seed": seed,
            "max_duration": max_duration,
            "acoustic_steps": acoustic_steps,
            "max_score_tokens": max_score_tokens,
        }
        if extra_metadata:
            metadata.update(extra_metadata)
        if sampling is not None:
            metadata["sampling"] = sampling
        score_abc = _extract_text(outputs, COVER_SCORE_NODE if extra_metadata and extra_metadata.get("cover_of") else TEXT_SCORE_NODE)
        if score_abc:
            metadata["score_abc"] = score_abc
        metadata["plan"] = {
            "type": "cover" if extra_metadata and extra_metadata.get("cover_of") else "song",
            "planning": planning,
            "style": style,
            "lyrics": lyrics,
            "seed": seed,
            "max_duration": max_duration,
            "acoustic_steps": acoustic_steps,
            "max_score_tokens": max_score_tokens,
            "score_abc": score_abc or "",
        }
        if sampling is not None:
            metadata["plan"]["sampling"] = sampling

        asset_id = save_generation(
            prompt=prompt,
            filename=local_filename,
            file_type="audio",
            duration=duration,
            metadata=metadata,
        )
        result = {
            "success": True,
            "asset_id": asset_id,
            "filename": local_filename,
            "duration": duration,
            "name": name,
            "planning": planning,
        }
        if score_abc:
            result["score_abc"] = score_abc
        return result
    except Exception as exc:
        if local_filename:
            delete_audio(local_filename)
        return {"success": False, "error": str(exc)}


async def generate_song(
    style: str,
    lyrics: str,
    title: str = "",
    planning: str = "full",
    max_duration: int = 300,
    acoustic_steps: int = 32,
    max_score_tokens: int = 8192,
    seed: int = 0,
    job_id: str = "",
    temperature: float = 1.0,
    top_p: float = 0.95,
    top_k: int = 100,
    repetition_penalty: float = 1.2,
    guidance: float = 1.0,
    tile_frames: int = 1024,
    download_missing: bool = True,
    abc_temperature: float = 0.7,
    abc_top_p: float = 0.9,
    abc_top_k: int = 30,
    abc_repetition_penalty: float = 1.005,
    abc_penalty_window: int = 100,
) -> dict:
    capabilities = await get_yue2_capabilities()
    if not capabilities.get("available"):
        return {
            "success": False,
            "error": "YuE2 native nodes or the INT8 checkpoint are not installed in ComfyUI",
        }

    style_text = (style or "").strip()
    lyrics_text = lyrics or ""
    if not style_text and not _first_lyric_line(lyrics_text):
        return {"success": False, "error": "Style or lyrics are required"}
    planning_mode = str(planning or "full").strip().lower()
    if planning_mode == "none":
        planning_mode = "off"
    if planning_mode not in PLANNING_MODES:
        return {"success": False, "error": "Invalid planning mode"}

    max_duration_val = _clamp_int(max_duration, 8, 600, 300)
    acoustic_steps_val = _clamp_int(acoustic_steps, 1, 64, 32)
    max_score_tokens_val = _clamp_int(max_score_tokens, 1, 20000, 8192)
    seed_val = _clamp_int(seed, 0, 0xFFFFFFFFFFFFFFFF, 0)
    temperature_val = _clamp_float(temperature, 0.0, 5.0, 1.0)
    top_p_val = _clamp_float(top_p, 0.01, 1.0, 0.95)
    top_k_val = _clamp_int(top_k, 1, 32768, 100)
    repetition_penalty_val = _clamp_float(repetition_penalty, 0.01, 10.0, 1.2)
    cfg_scale_val = _clamp_float(guidance, 0.0, 20.0, 1.0)
    abc_temperature_val = _clamp_float(abc_temperature, 0.0, 5.0, 0.7)
    abc_top_p_val = _clamp_float(abc_top_p, 0.01, 1.0, 0.9)
    abc_top_k_val = _clamp_int(abc_top_k, 1, 32768, 30)
    abc_repetition_penalty_val = _clamp_float(
        abc_repetition_penalty, 0.01, 10.0, 1.005
    )
    abc_penalty_window_val = _clamp_int(abc_penalty_window, 1, 20000, 100)

    workflow = build_text_workflow(
        style_text,
        lyrics_text,
        planning_mode,
        max_duration_val,
        acoustic_steps_val,
        max_score_tokens_val,
        seed_val,
        temperature_val,
        top_p_val,
        top_k_val,
        repetition_penalty_val,
        cfg_scale_val,
        abc_temperature_val,
        abc_top_p_val,
        abc_top_k_val,
        abc_repetition_penalty_val,
        abc_penalty_window_val,
    )
    outputs, error = await _run_workflow(workflow, job_id)
    if error or not outputs:
        return {"success": False, "error": error or "YuE2 generation failed"}
    return await _save_audio_result(
        outputs,
        style_text,
        lyrics_text,
        title,
        planning_mode,
        seed_val,
        max_duration_val,
        acoustic_steps_val,
        max_score_tokens_val,
        sampling={
            "abc": {
                "temperature": abc_temperature_val,
                "top_p": abc_top_p_val,
                "top_k": abc_top_k_val,
                "repetition_penalty": abc_repetition_penalty_val,
                "penalty_window": abc_penalty_window_val,
            },
            "music": {
                "temperature": temperature_val,
                "top_p": top_p_val,
                "top_k": top_k_val,
                "repetition_penalty": repetition_penalty_val,
                "guidance": cfg_scale_val,
            },
        },
    )


async def generate_cover(
    asset_id: str,
    style: str,
    lyrics: str,
    title: str = "",
    max_duration: int = 300,
    acoustic_steps: int = 32,
    max_score_tokens: int = 8192,
    seed: int = 0,
    job_id: str = "",
    temperature: float = 1.0,
    top_p: float = 0.95,
    top_k: int = 100,
    repetition_penalty: float = 1.2,
    guidance: float = 1.0,
) -> dict:
    capabilities = await get_yue2_capabilities()
    if not capabilities.get("cover_available"):
        return {
            "success": False,
            "error": "YuE2 cover nodes or SheetSage2 are not installed in ComfyUI",
        }
    asset = get_asset_by_id(asset_id)
    if not asset or asset.get("type") != "audio":
        return {"success": False, "error": "Select an audio asset from the Library first"}
    if not style.strip() and not lyrics.strip():
        return {"success": False, "error": "Style or lyrics are required"}

    comfy_audio = await upload_audio_to_comfy(asset["filename"])
    if not comfy_audio:
        return {"success": False, "error": "Failed to upload source audio to ComfyUI"}

    max_duration_val = _clamp_int(max_duration, 8, 600, 300)
    acoustic_steps_val = _clamp_int(acoustic_steps, 1, 64, 32)
    max_score_tokens_val = _clamp_int(max_score_tokens, 1, 20000, 8192)
    seed_val = _clamp_int(seed, 0, 0xFFFFFFFFFFFFFFFF, 0)
    temperature_val = _clamp_float(temperature, 0.0, 5.0, 1.0)
    top_p_val = _clamp_float(top_p, 0.01, 1.0, 0.95)
    top_k_val = _clamp_int(top_k, 1, 32768, 100)
    repetition_penalty_val = _clamp_float(repetition_penalty, 0.01, 10.0, 1.2)
    cfg_scale_val = _clamp_float(guidance, 0.0, 20.0, 1.0)

    workflow = build_cover_workflow(
        comfy_audio,
        style.strip(),
        lyrics,
        max_duration_val,
        acoustic_steps_val,
        seed_val,
        temperature_val,
        top_p_val,
        top_k_val,
        repetition_penalty_val,
        cfg_scale_val,
    )
    outputs, error = await _run_workflow(workflow, job_id)
    if error or not outputs:
        return {"success": False, "error": error or "YuE2 cover generation failed"}
    return await _save_audio_result(
        outputs,
        style.strip(),
        lyrics,
        title,
        "cover",
        seed_val,
        max_duration_val,
        acoustic_steps_val,
        max_score_tokens_val,
        extra_metadata={"cover_of": asset_id, "cover_source": asset["filename"]},
        sampling={
            "music": {
                "temperature": temperature_val,
                "top_p": top_p_val,
                "top_k": top_k_val,
                "repetition_penalty": repetition_penalty_val,
                "guidance": cfg_scale_val,
            },
        },
    )
