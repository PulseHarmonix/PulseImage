import os
import json
import uuid
from fastapi import FastAPI, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from datetime import datetime
import shutil
import uuid
import os

import zipfile
from io import BytesIO
import re
import subprocess
import tempfile

# Optional OpenCV for pure-Python video trimming fallback (no system ffmpeg required).
# Re-encodes, so slower and slightly lower quality than ffmpeg -c copy, but works everywhere.
try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False
    cv2 = None

def trim_video_opencv(input_path: str, output_path: str, start_sec: float, trim_dur: float | None = None):
    """Trim video starting at start_sec for trim_dur seconds (or to end if None).
    Pure Python using OpenCV (re-encodes the output).
    Uses time-based seeking (POS_MSEC) for better support of sub-second / millisecond offsets.
    """
    if not HAS_OPENCV or cv2 is None:
        raise RuntimeError("OpenCV (opencv-python-headless) is not installed")

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video file: {input_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Use millisecond-precise time-based seek (better for non-integer offsets)
    cap.set(cv2.CAP_PROP_POS_MSEC, start_sec * 1000.0)

    # Prefer H.264 (avc1) if available for better compatibility, fall back to mp4v
    fourcc = cv2.VideoWriter_fourcc(*"avc1")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    if not out.isOpened():
        # fallback codec
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        if not out.isOpened():
            raise RuntimeError("Could not open VideoWriter for output (codec issue?)")

    # Compute how many frames to write based on duration if provided
    max_frames = int(trim_dur * fps) if trim_dur else None
    written = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if max_frames is not None and written >= max_frames:
            break
        out.write(frame)
        written += 1

    cap.release()
    out.release()
import os
from utils.comfy_client import (
    check_comfyui_connection, 
    generate_multiple_images, 
    generate_images_with_progress,
    generate_single_video,
    generate_videos_with_progress,
    generate_image_to_videos_with_progress,
    generate_single_image_to_video,
    generate_image_to_images_with_progress,
    generate_single_image_to_image,
    generate_image_audio_to_videos_with_progress,
    generate_single_image_audio_to_video,
    generate_double_image_to_image_with_progress,
    generate_double_image_to_image,
    fetch_comfy_models
)

SETTINGS_FILE = "settings.json"

available_loras: list = []

def load_app_settings() -> dict:
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                s = json.load(f)
                if "image_model" not in s or s["image_model"] not in ("schnell", "klein", "qwen"):
                    s["image_model"] = "schnell"
                if "i2i_model" not in s or s["i2i_model"] not in ("klein", "flux2"):
                    s["i2i_model"] = "klein"
                if "library_video_playback" not in s or s["library_video_playback"] not in ("1st_frame", "play_loop"):
                    s["library_video_playback"] = "1st_frame"
                if "qwen_turbo" not in s or not isinstance(s.get("qwen_turbo"), bool):
                    s["qwen_turbo"] = True
                # Server connection settings (moved from config.py)
                if "comfyui_url" not in s or not isinstance(s.get("comfyui_url"), str) or not s.get("comfyui_url").strip():
                    s["comfyui_url"] = "http://127.0.0.1:8188"
                if "ollama_url" not in s or not isinstance(s.get("ollama_url"), str) or not s.get("ollama_url").strip():
                    s["ollama_url"] = "http://127.0.0.1:11434"
                if "ollama_model" not in s or not isinstance(s.get("ollama_model"), str) or not s.get("ollama_model").strip():
                    s["ollama_model"] = "qwen3:8b"
                if "ollama_timeout" not in s or not isinstance(s.get("ollama_timeout"), (int, float)) or s.get("ollama_timeout") <= 0:
                    s["ollama_timeout"] = 180
                if "failed_gen_clear_seconds" not in s or not isinstance(s.get("failed_gen_clear_seconds"), (int, float)) or s.get("failed_gen_clear_seconds") <= 0:
                    s["failed_gen_clear_seconds"] = 600
                if "prompt_enhancers" not in s or not isinstance(s.get("prompt_enhancers"), list) or len(s.get("prompt_enhancers", [])) == 0:
                    s["prompt_enhancers"] = [
                        {"id": "none", "name": "No enhancement", "prompt": ""},
                        {"id": "cinematic", "name": "Cinematic", "prompt": "cinematic lighting, dramatic composition, film grain, anamorphic lens, color graded, shot on 35mm, high production value, moody atmosphere"},
                        {"id": "anime", "name": "Anime", "prompt": "detailed anime style, clean linework, vibrant colors, expressive eyes, dynamic anime composition, studio quality, sharp cel shading"},
                        {"id": "photoreal", "name": "Photorealistic", "prompt": "photorealistic, ultra detailed, natural lighting and skin pores, shot on professional full-frame DSLR, 8k, realistic textures, subtle film grain"},
                        {"id": "fantasy", "name": "Fantasy Art", "prompt": "epic fantasy illustration, magical glows, intricate details, rich saturated palette, painterly, high fantasy concept art, volumetric god rays"},
                        {"id": "cyberpunk", "name": "Cyberpunk", "prompt": "cyberpunk neon city, rain reflections, holographic signs, high-tech low-life, dramatic rim lighting, blade runner aesthetic, moody blues and magentas"},
                        {"id": "horror", "name": "Horror", "prompt": "horror movie still, deep shadows, unsettling atmosphere, fog, high contrast chiaroscuro, eerie practical lighting, psychological dread"},
                        {"id": "watercolor", "name": "Watercolor", "prompt": "delicate watercolor illustration, soft bleeding edges, layered translucent washes, visible paper texture, artistic and light, beautiful color bleeding"},
                        {"id": "oil", "name": "Oil Painting", "prompt": "classical oil painting on canvas, rich impasto texture, dramatic renaissance lighting, visible brush strokes, museum quality fine art"},
                        {"id": "3d", "name": "3D Render", "prompt": "high-end 3D CGI render, octane/redshift quality, clean materials, studio product lighting, perfect reflections, ultra sharp, subsurface scattering"},
                        {"id": "pixel", "name": "Pixel Art", "prompt": "beautiful 16-bit / 32-bit pixel art, crisp pixels, limited but vibrant palette, retro game aesthetic, clean dithering, nostalgic charm"},
                        {"id": "surreal", "name": "Surreal", "prompt": "surreal dreamlike scene, impossible architecture, melting forms, symbolic, salvador dali influence, ethereal lighting, unexpected juxtapositions"},
                        {"id": "minimal", "name": "Minimalist", "prompt": "minimalist elegant composition, generous negative space, simple refined forms, muted harmonious palette, zen calm, graphic design precision"},
                        {"id": "vintage", "name": "Vintage Film", "prompt": "1970s vintage film photography, kodachrome colors, heavy film grain, slight fade, lens flare, warm nostalgic tones, analog photo look"},
                        {"id": "steampunk", "name": "Steampunk", "prompt": "intricate steampunk machinery, brass copper leather, victorian industrial, glowing gauges, dramatic side lighting, rich sepia and teal palette"},
                        {"id": "scifi", "name": "Sci-Fi", "prompt": "futuristic sci-fi concept art, sleek advanced tech, clean hard surface modeling, dramatic cinematic lighting, space opera scale, polished materials"},
                        {"id": "cartoon", "name": "Cartoon", "prompt": "modern vibrant cartoon style, bold clean outlines, saturated playful colors, expressive features, pixar/disney 3d cartoon influence, polished"},
                        {"id": "hyperreal", "name": "Hyperrealistic", "prompt": "hyperrealistic macro detail, insane texture fidelity, perfect anatomy and materials, razor sharp focus, controlled studio lighting"},
                        {"id": "darkmoody", "name": "Dark Moody", "prompt": "dark moody cinematic lighting, deep crushed blacks, low key, desaturated cool tones, heavy atmosphere, film noir tension"},
                        {"id": "epic", "name": "Epic", "prompt": "epic sweeping vista, heroic scale, majestic god rays, golden hour, national geographic level grandeur, awe-inspiring composition, ultra wide"}
                    ]
                return s
        except Exception:
            pass
    return {
        "image_model": "schnell",
        "i2i_model": "klein",
        "library_video_playback": "1st_frame",
        "qwen_turbo": True,
        "comfyui_url": "http://127.0.0.1:8188",
        "ollama_url": "http://127.0.0.1:11434",
        "ollama_model": "qwen3:8b",
        "ollama_timeout": 180,
        "failed_gen_clear_seconds": 600,
        "prompt_enhancers": [
            {"id": "none", "name": "No enhancement", "prompt": ""},
            {"id": "cinematic", "name": "Cinematic", "prompt": "cinematic lighting, dramatic composition, film grain, anamorphic lens, color graded, shot on 35mm, high production value, moody atmosphere"},
            {"id": "anime", "name": "Anime", "prompt": "detailed anime style, clean linework, vibrant colors, expressive eyes, dynamic anime composition, studio quality, sharp cel shading"},
            {"id": "photoreal", "name": "Photorealistic", "prompt": "photorealistic, ultra detailed, natural lighting and skin pores, shot on professional full-frame DSLR, 8k, realistic textures, subtle film grain"},
            {"id": "fantasy", "name": "Fantasy Art", "prompt": "epic fantasy illustration, magical glows, intricate details, rich saturated palette, painterly, high fantasy concept art, volumetric god rays"},
            {"id": "cyberpunk", "name": "Cyberpunk", "prompt": "cyberpunk neon city, rain reflections, holographic signs, high-tech low-life, dramatic rim lighting, blade runner aesthetic, moody blues and magentas"},
            {"id": "horror", "name": "Horror", "prompt": "horror movie still, deep shadows, unsettling atmosphere, fog, high contrast chiaroscuro, eerie practical lighting, psychological dread"},
            {"id": "watercolor", "name": "Watercolor", "prompt": "delicate watercolor illustration, soft bleeding edges, layered translucent washes, visible paper texture, artistic and light, beautiful color bleeding"},
            {"id": "oil", "name": "Oil Painting", "prompt": "classical oil painting on canvas, rich impasto texture, dramatic renaissance lighting, visible brush strokes, museum quality fine art"},
            {"id": "3d", "name": "3D Render", "prompt": "high-end 3D CGI render, octane/redshift quality, clean materials, studio product lighting, perfect reflections, ultra sharp, subsurface scattering"},
            {"id": "pixel", "name": "Pixel Art", "prompt": "beautiful 16-bit / 32-bit pixel art, crisp pixels, limited but vibrant palette, retro game aesthetic, clean dithering, nostalgic charm"},
            {"id": "surreal", "name": "Surreal", "prompt": "surreal dreamlike scene, impossible architecture, melting forms, symbolic, salvador dali influence, ethereal lighting, unexpected juxtapositions"},
            {"id": "minimal", "name": "Minimalist", "prompt": "minimalist elegant composition, generous negative space, simple refined forms, muted harmonious palette, zen calm, graphic design precision"},
            {"id": "vintage", "name": "Vintage Film", "prompt": "1970s vintage film photography, kodachrome colors, heavy film grain, slight fade, lens flare, warm nostalgic tones, analog photo look"},
            {"id": "steampunk", "name": "Steampunk", "prompt": "intricate steampunk machinery, brass copper leather, victorian industrial, glowing gauges, dramatic side lighting, rich sepia and teal palette"},
            {"id": "scifi", "name": "Sci-Fi", "prompt": "futuristic sci-fi concept art, sleek advanced tech, clean hard surface modeling, dramatic cinematic lighting, space opera scale, polished materials"},
            {"id": "cartoon", "name": "Cartoon", "prompt": "modern vibrant cartoon style, bold clean outlines, saturated playful colors, expressive features, pixar/disney 3d cartoon influence, polished"},
            {"id": "hyperreal", "name": "Hyperrealistic", "prompt": "hyperrealistic macro detail, insane texture fidelity, perfect anatomy and materials, razor sharp focus, controlled studio lighting"},
            {"id": "darkmoody", "name": "Dark Moody", "prompt": "dark moody cinematic lighting, deep crushed blacks, low key, desaturated cool tones, heavy atmosphere, film noir tension"},
            {"id": "epic", "name": "Epic", "prompt": "epic sweeping vista, heroic scale, majestic god rays, golden hour, national geographic level grandeur, awe-inspiring composition, ultra wide"}
        ]
    }

def save_app_settings(settings: dict):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)
    except Exception as e:
        print("Failed to save settings:", e)


def get_comfyui_url() -> str:
    """Return the current ComfyUI base URL from settings (or sensible default)."""
    s = load_app_settings()
    url = (s.get("comfyui_url") or "").strip()
    return url or "http://127.0.0.1:8188"


def get_ollama_settings() -> dict:
    """Return current Ollama connection settings."""
    s = load_app_settings()
    url = (s.get("ollama_url") or "").strip() or "http://127.0.0.1:11434"
    model = (s.get("ollama_model") or "").strip() or "qwen3:8b"
    try:
        timeout = int(s.get("ollama_timeout") or 180)
    except Exception:
        timeout = 180
    if timeout <= 0:
        timeout = 180
    return {"url": url.rstrip("/"), "model": model, "timeout": timeout}


def get_failed_gen_clear_seconds() -> int:
    """Return the configured timeout (in seconds) before a generation is considered failed.
    This value is used as the loop bound (with 1s sleep) for history polling in comfy_client.py
    for both image and video generation paths (T2I, I2I, T2V, I2V, IA2V, etc.).
    """
    s = load_app_settings()
    try:
        val = s.get("failed_gen_clear_seconds", 600)
        val = int(val)
        return val if val > 0 else 600
    except Exception:
        return 600


app = FastAPI(title="Pulse Image")
app.mount("/images", StaticFiles(directory="images"), name="images")
app.mount("/videos", StaticFiles(directory="videos"), name="videos")
app.mount("/audio", StaticFiles(directory="audio"), name="audio")

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/templates", StaticFiles(directory="templates"), name="templates")

# Ensure audio folder exists
os.makedirs("audio", exist_ok=True)
templates = Jinja2Templates(directory="templates")

GENERATIONS_FILE = "library.json"

import os
import json
from datetime import datetime

def load_generations():
    if not os.path.exists(GENERATIONS_FILE):
        old_path = "images/generations.json"
        if os.path.exists(old_path):
            try:
                import shutil
                shutil.move(old_path, GENERATIONS_FILE)
            except Exception:
                # fallback load from old if move fails
                with open(old_path, "r") as f:
                    generations = json.load(f)
                return generations
        else:
            return []

    with open(GENERATIONS_FILE, "r") as f:
        generations = json.load(f)

    # Migration from old grouped structure → clean per-asset structure
    migrated = []
    needs_save = False

    for item in generations:
        if "files" in item and isinstance(item.get("files"), list):
            # Convert old multi-file entries
            for f in item["files"]:
                new_item = {
                    "id": str(uuid.uuid4()),
                    "type": f.get("type", "image"),
                    "prompt": item.get("prompt", ""),
                    "filename": f.get("filename"),
                    "width": f.get("width", 0),
                    "height": f.get("height", 0),
                    "aspect_ratio": f.get("aspect_ratio", "3:2"),
                    "created": item.get("created", datetime.now().isoformat()),
                    "last_updated": item.get("last_updated", datetime.now().isoformat()),
                    "parent_id": item.get("parent_id"),
                    "derived_from": item.get("derived_from", []),
                    "metadata": item.get("metadata", {}),
                    "children": []
                }
                if f.get("duration"):
                    new_item["metadata"]["duration"] = f.get("duration")
                new_item["favorite"] = False
                migrated.append(new_item)
            needs_save = True
        else:
            # Already new format
            if "id" not in item:
                item["id"] = str(uuid.uuid4())
                needs_save = True
            if "parent_id" not in item:
                item["parent_id"] = None
                needs_save = True
            if "derived_from" not in item:
                item["derived_from"] = []
                needs_save = True
            if "children" not in item:
                item["children"] = []
                needs_save = True
            if "metadata" not in item:
                item["metadata"] = {}
                needs_save = True
            if "favorite" not in item:
                item["favorite"] = False
                needs_save = True
            migrated.append(item)

    if needs_save:
        with open(GENERATIONS_FILE, "w") as f:
            json.dump(migrated, f, indent=2)
        return migrated

    return generations

def get_asset_by_id(asset_id: str):
    """Helper to find an asset by its ID (useful for future referencing features)"""
    generations = load_generations()
    for item in generations:
        if item.get("id") == asset_id:
            return item
    return None

def save_generation(
    prompt: str,
    filename: str,
    file_type: str = "image",
    aspect_ratio: str = "3:2",
    width: int = 0,
    height: int = 0,
    duration: int = None,
    parent_id: str = None,
    derived_from: list = None,
    metadata: dict = None,
    favorite: bool = False
):
    if derived_from is None:
        derived_from = []
    if metadata is None:
        metadata = {}

    generations = load_generations()

    new_asset = {
        "id": str(uuid.uuid4()),
        "type": file_type,
        "prompt": prompt,
        "filename": filename,
        "width": width,
        "height": height,
        "aspect_ratio": aspect_ratio,
        "created": datetime.now().isoformat(),
        "last_updated": datetime.now().isoformat(),
        "parent_id": parent_id,
        "derived_from": derived_from,
        "metadata": metadata,
        "children": [],
        "favorite": favorite
    }

    if duration is not None:
        new_asset["metadata"]["duration"] = duration

    generations.append(new_asset)

    with open(GENERATIONS_FILE, "w") as f:
        json.dump(generations, f, indent=2)

    return new_asset["id"]


def update_generation(asset_id: str, updates: dict):
    generations = load_generations()
    for item in generations:
        if item.get("id") == asset_id:
            item.update(updates)
            item["last_updated"] = datetime.now().isoformat()
            with open(GENERATIONS_FILE, "w") as f:
                json.dump(generations, f, indent=2)
            return True
    return False


def delete_generation(asset_id: str, cascade: bool = False):
    """Delete asset by id, optionally cascading to related (children/derived). Also deletes the disk file."""
    generations = load_generations()
    ids_to_delete = {asset_id}
    if cascade:
        def collect_related(pid, collected):
            for g in generations:
                gid = g.get("id")
                if gid in collected:
                    continue
                if g.get("parent_id") == pid or (pid in (g.get("derived_from") or [])):
                    collected.add(gid)
                    collect_related(gid, collected)
        collect_related(asset_id, ids_to_delete)

    remaining = []
    files_deleted = 0
    for g in generations:
        if g.get("id") in ids_to_delete:
            fname = g.get("filename")
            if fname:
                gtype = g.get("type", "image")
                if gtype == "video" or (isinstance(fname, str) and fname.lower().endswith(".mp4")):
                    folder = "videos"
                elif gtype == "audio" or (isinstance(fname, str) and any(fname.lower().endswith(ext) for ext in [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".webm"])):
                    folder = "audio"
                else:
                    folder = "images"
                fpath = os.path.join(folder, fname)
                try:
                    if os.path.exists(fpath):
                        os.remove(fpath)
                        files_deleted += 1
                except Exception as ex:
                    print(f"Warning: could not remove file {fpath}: {ex}")
            continue
        remaining.append(g)

    with open(GENERATIONS_FILE, "w") as f:
        json.dump(remaining, f, indent=2)

    return {"success": True, "deleted_count": len(ids_to_delete), "files_deleted": files_deleted}


# ==================== PROJECTS PERSISTENCE (for waveform timeline + cue sequencing) ====================
PROJECTS_FILE = "projects.json"


def load_projects():
    if not os.path.exists(PROJECTS_FILE):
        return []

    with open(PROJECTS_FILE, "r") as f:
        projects = json.load(f)

    needs_save = False
    for p in projects:
        if "id" not in p:
            p["id"] = str(uuid.uuid4())
            needs_save = True
        if "cues" not in p or not isinstance(p.get("cues"), list):
            p["cues"] = []
            needs_save = True
        if "created" not in p:
            p["created"] = datetime.now().isoformat()
            needs_save = True
        if "last_updated" not in p:
            p["last_updated"] = datetime.now().isoformat()
            needs_save = True
        if "resolution" not in p:
            p["resolution"] = "720p"
            needs_save = True
        if "aspect_ratio" not in p:
            p["aspect_ratio"] = "3:2"
            needs_save = True
        for c in p.get("cues", []):
            if "id" not in c:
                c["id"] = str(uuid.uuid4())
                needs_save = True
            if "candidates" not in c or not isinstance(c.get("candidates"), list):
                c["candidates"] = []
                needs_save = True
            if "time" not in c:
                c["time"] = 0.0
                needs_save = True
            if "prompt" not in c:
                c["prompt"] = ""
                needs_save = True
            if "video_id" not in c:
                c["video_id"] = None
                needs_save = True
            if "selected_image_id" not in c:
                c["selected_image_id"] = None
                needs_save = True
            if "video_prompt" not in c:
                c["video_prompt"] = ""
                needs_save = True
            if "mute_audio" not in c:
                c["mute_audio"] = False
                needs_save = True
            if "video_start_offset" not in c or not isinstance(c.get("video_start_offset"), (int, float)):
                c["video_start_offset"] = 0
                needs_save = True
            if "lora_name" not in c:
                c["lora_name"] = None
                needs_save = True

        # Story Mode extension (optional sub-object). Keep it when present; normalize scenes/characters defensively.
        if "story" in p and p.get("story"):
            st = p["story"]
            if not isinstance(st, dict):
                p["story"] = None
                needs_save = True
            else:
                if "characters" not in st or not isinstance(st.get("characters"), list):
                    st["characters"] = []
                    needs_save = True
                if "scenes" not in st or not isinstance(st.get("scenes"), list):
                    st["scenes"] = []
                    needs_save = True
                for sc in st.get("scenes", []):
                    if isinstance(sc, dict):
                        if "id" not in sc:
                            sc["id"] = str(uuid.uuid4())
                            needs_save = True
                        if "candidates" not in sc or not isinstance(sc.get("candidates"), list):
                            sc["candidates"] = []
                            needs_save = True
                        if "selected_image_id" not in sc:
                            sc["selected_image_id"] = None
                            needs_save = True
                        if "video_id" not in sc:
                            sc["video_id"] = None
                            needs_save = True
                        if "status" not in sc:
                            sc["status"] = "draft"
                            needs_save = True
                        if "prompt" not in sc:
                            sc["prompt"] = ""
                            needs_save = True
                        if "high_level_description" not in sc:
                            sc["high_level_description"] = sc.get("title", "")
                            needs_save = True
    if needs_save:
        with open(PROJECTS_FILE, "w") as f:
            json.dump(projects, f, indent=2)
    return projects


def save_project(project: dict):
    projects = load_projects()
    found = False
    now = datetime.now().isoformat()
    for i, p in enumerate(projects):
        if p.get("id") == project.get("id"):
            project["last_updated"] = now
            if "created" not in project:
                project["created"] = p.get("created", now)
            projects[i] = project
            found = True
            break
    if not found:
        if "id" not in project or not project["id"]:
            project["id"] = str(uuid.uuid4())
        if "created" not in project:
            project["created"] = now
        project["last_updated"] = now
        if "cues" not in project or not isinstance(project.get("cues"), list):
            project["cues"] = []
        projects.append(project)
    with open(PROJECTS_FILE, "w") as f:
        json.dump(projects, f, indent=2)
    return project["id"]


def update_project(project_id: str, updates: dict):
    """Top-level updates only (for full cue edits prefer save_project with full object)."""
    projects = load_projects()
    for p in projects:
        if p.get("id") == project_id:
            p.update(updates)
            p["last_updated"] = datetime.now().isoformat()
            with open(PROJECTS_FILE, "w") as f:
                json.dump(projects, f, indent=2)
            return True
    return False


def delete_project(project_id: str):
    projects = load_projects()
    new_list = [p for p in projects if p.get("id") != project_id]
    with open(PROJECTS_FILE, "w") as f:
        json.dump(new_list, f, indent=2)
    return True


# ==================== OLLAMA (Story Mode - two-pass LLM) ====================

async def ollama_generate(
    prompt: str,
    system: str | None = None,
    expect_json: bool = False,
    force_json_format: bool = False,
    model: str | None = None,
    timeout: int | None = None,
) -> dict:
    """
    Call Ollama /api/generate. Returns {"text": str, "parsed": object|None, "error": str|None}
    - expect_json=True  → we will attempt to parse the response as JSON (with tolerant extraction)
    - force_json_format=True → send "format": "json" to Ollama (can hurt some models; often better to rely on prompt + parsing)
    """
    # Deferred import so we don't fight a running uvicorn lock on the module during edits
    import httpx

    oll = get_ollama_settings()
    url = oll["url"]
    mdl = model or oll["model"]
    tmo = timeout or oll["timeout"]

    payload = {
        "model": mdl,
        "prompt": prompt,
        "stream": False,
    }
    if system:
        payload["system"] = system
    if force_json_format:
        payload["format"] = "json"

    try:
        async with httpx.AsyncClient(timeout=float(tmo)) as client:
            resp = await client.post(f"{url}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            text = (data.get("response") or "").strip()
            parsed = None
            err = None
            if expect_json and text:
                # Some models still wrap or add prose; be tolerant
                candidate = text
                # Try to extract the largest {...} or [...] block if extra text present
                if not (candidate.startswith("{") or candidate.startswith("[")):
                    import re
                    m = re.search(r'(\{.*\}|\[.*\])', candidate, re.DOTALL)
                    if m:
                        candidate = m.group(1)
                try:
                    parsed = json.loads(candidate)
                except Exception as je:
                    err = f"JSON parse failed: {je}. Raw head: {text[:200]}"
            return {"text": text, "parsed": parsed, "error": err}
    except httpx.HTTPStatusError as e:
        return {"text": "", "parsed": None, "error": f"Ollama HTTP {e.response.status_code}: {e.response.text[:300]}"}
    except Exception as e:
        return {"text": "", "parsed": None, "error": f"Ollama call failed ({type(e).__name__}): {e}"}


async def ollama_chat(
    messages: list,
    model: str | None = None,
    timeout: int | None = None,
) -> dict:
    """
    Call Ollama /api/chat with a messages array (role/content).
    Returns {"text": str, "error": str|None} (text is the assistant content).
    """
    import httpx
    oll = get_ollama_settings()
    url = oll["url"]
    mdl = model or oll["model"]
    tmo = timeout or oll["timeout"]

    payload = {
        "model": mdl,
        "messages": messages,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=float(tmo)) as client:
            resp = await client.post(f"{url}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            msg = data.get("message") or {}
            text = (msg.get("content") or "").strip()
            return {"text": text, "error": None}
    except httpx.HTTPStatusError as e:
        return {"text": "", "error": f"Ollama HTTP {e.response.status_code}: {e.response.text[:300]}"}
    except Exception as e:
        return {"text": "", "error": f"Ollama chat failed ({type(e).__name__}): {e}"}


def _format_characters_for_prompt(chars: list) -> str:
    if not chars:
        return "No specific characters."
    lines = []
    for c in chars:
        tw = c.get("trigger_words") or ""
        lines.append(
            f"- {c.get('name','Character')}: {c.get('description','')}. "
            f"Trigger words / style: {tw}. "
            f"LoRA: {c.get('lora_filename') or 'none'} (strength ~{c.get('lora_strength', 0.8)})"
        )
    return "\n".join(lines)


async def ollama_story_breakdown(story_text: str, characters: list, num_scenes: int | None = None, target_seconds: float | None = None, style: str | None = None, debug: bool = False) -> dict:
    """Pass 1: story + chars -> structured scene outline (JSON array)."""
    char_block = _format_characters_for_prompt(characters)
    target = f"Target total length: approximately {target_seconds} seconds." if target_seconds else "Fit a natural music-video pacing (typically 45-90s total)."
    nscenes = f"Produce exactly around {num_scenes} scenes." if num_scenes else "Produce 4-8 scenes (use your judgment for good pacing)."

    system = (
        "You are an expert music-video director and editor. "
        "You break a story into a tight sequence of visual scenes for a synchronized video. "
        "Output ONLY a raw JSON array. Start with [ and end with ]. "
        "Do NOT wrap the array in an object. Do NOT use markdown code fences (```). "
        "Do NOT add any text, explanation, or commentary before or after the JSON. "
        "Return a JSON array of scene objects. Each scene MUST have these exact keys:\n"
        "scene_number (int), title (short string), start_time (float seconds from 0), duration (float seconds), "
        "high_level_description (1-2 sentences), characters (array of character id strings from the provided list).\n"
        "Rules: start_time must be non-overlapping and increasing. The last scene should end near the target total. "
        "Assign characters only from the given list. Keep descriptions concise but evocative."
    )

    user = (
        f"FULL STORY:\n{story_text}\n\n"
        f"CHARACTERS (use only these ids):\n{char_block}\n\n"
        f"PARAMETERS:\n{nscenes}\n{target}\n"
        f"Creative style / mood notes: {style or 'cinematic, music-driven, high visual impact'}\n\n"
        "Output ONLY the raw JSON array now. Nothing else."
    )

    res = await ollama_generate(user, system=system, expect_json=True, force_json_format=False)
    scenes = res.get("parsed")
    out = {}
    if isinstance(scenes, list):
        # light normalization
        for i, s in enumerate(scenes):
            if isinstance(s, dict):
                s.setdefault("id", f"scene_{i+1:03d}")
                s.setdefault("scene_number", i + 1)
                s.setdefault("status", "draft")
                s.setdefault("prompt", "")
                s.setdefault("candidates", [])
                s.setdefault("selected_image_id", None)
                s.setdefault("video_id", None)
        out = {"scenes": scenes, "error": res.get("error")}
    else:
        out = {"scenes": [], "error": res.get("error") or "Model did not return a JSON array", "raw": res.get("text")}

    if debug:
        oll = get_ollama_settings()
        resolved_url = oll["url"]
        resolved_model = oll["model"]

        # Reconstruct the exact request body that was sent to Ollama
        request_body = {
            "model": resolved_model,
            "prompt": user,
            "stream": False,
        }
        if system:
            request_body["system"] = system
        # We deliberately do NOT send "format": "json" by default (it can make some models
        # return garbage or fail). We rely on a strong prompt + tolerant parsing instead.
        # If you ever want to test with it, you can temporarily set force_json_format=True above.

        out["debug"] = {
            "ollama_url": resolved_url,
            "model": resolved_model,
            "request": {
                "url": f"{resolved_url}/api/generate",
                "method": "POST",
                "body": request_body
            },
            "system_prompt": system,
            "user_prompt": user,
            "raw_response": res.get("text", "")
        }
    elif "raw" not in out and res.get("text"):
        out["raw"] = res.get("text")

    return out


async def ollama_scene_prompt(story_text: str, characters: list, scene: dict, style: str | None = None) -> dict:
    """Pass 2: full context + one scene -> single rich visual prompt optimized for Flux + video."""
    char_block = _format_characters_for_prompt(characters)
    scene_desc = scene.get("high_level_description") or scene.get("title", "")
    scene_chars = scene.get("characters", [])

    system = (
        "You are a prompt engineer specialized in Flux Schnell image generation and LTX / image-to-video models. "
        "Write one single, extremely detailed, cinematic English prompt (no line breaks, no numbering). "
        "Incorporate exact character appearance via the provided trigger words and descriptions. "
        "Emphasize lighting, camera angle/movement, mood, color grade, clothing details, expression, environment, and music-video energy. "
        "Keep it under ~220 words but be visually rich. "
        "Output ONLY a raw JSON object like this: {\"prompt\": \"your full prompt here\"}. "
        "Do not add any text outside the JSON object."
    )

    user = (
        f"OVERALL STORY (for emotional continuity):\n{story_text}\n\n"
        f"CHARACTERS AND THEIR VISUAL TRIGGERS:\n{char_block}\n\n"
        f"CURRENT SCENE:\n"
        f"Title: {scene.get('title','')}\n"
        f"High-level: {scene_desc}\n"
        f"Characters in this scene: {scene_chars}\n"
        f"Timing: starts at {scene.get('start_time',0)}s for ~{scene.get('duration',6)}s\n"
        f"Style/mood direction: {style or 'cinematic, high contrast, music video feel'}\n\n"
        "Produce the optimized visual prompt now as JSON."
    )

    res = await ollama_generate(user, system=system, expect_json=True, force_json_format=False)
    parsed = res.get("parsed") or {}
    prompt = parsed.get("prompt") if isinstance(parsed, dict) else None
    if not prompt and res.get("text"):
        # last-ditch: take the text as prompt
        prompt = res["text"].strip()
    return {"prompt": prompt or "", "error": res.get("error"), "raw": res.get("text")}


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


async def check_ollama_connection() -> bool:
    """Check if Ollama server is reachable (uses /api/tags)."""
    try:
        oll = get_ollama_settings()
        import httpx
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{oll['url']}/api/tags")
            return response.status_code == 200
    except Exception:
        return False


async def fetch_ollama_models() -> list[str]:
    """Query Ollama for installed models via /api/tags. Returns list of model names (e.g. 'qwen3:8b')."""
    try:
        oll = get_ollama_settings()
        import httpx
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"{oll['url']}/api/tags")
            if resp.status_code == 200:
                data = resp.json() or {}
                models = []
                for m in (data.get("models") or []):
                    # Ollama returns objects with "name"
                    name = m.get("name") if isinstance(m, dict) else None
                    if name and isinstance(name, str):
                        models.append(name)
                # Also support older shape where it might be a flat list of strings
                if not models and isinstance(data.get("models"), list):
                    for m in data["models"]:
                        if isinstance(m, str):
                            models.append(m)
                return sorted(set(models))
    except Exception as e:
        print(f"[ollama] fetch models error: {e}")
    return []


@app.get("/comfy/status")
async def comfy_status():
    """Endpoint to check if ComfyUI is running"""
    is_connected = await check_comfyui_connection()
    return JSONResponse({
        "connected": is_connected,
        "url": get_comfyui_url()
    })


@app.get("/ollama/status")
async def ollama_status():
    """Endpoint to check if Ollama is running and report current config."""
    connected = await check_ollama_connection()
    oll = get_ollama_settings()
    return JSONResponse({
        "connected": connected,
        "url": oll["url"],
        "model": oll["model"],
        "timeout": oll["timeout"]
    })


@app.get("/ollama/models")
async def ollama_models_endpoint(refresh: bool = False):
    """Return list of models available on the configured Ollama server."""
    models = await fetch_ollama_models()
    oll = get_ollama_settings()
    return JSONResponse({
        "models": models,
        "current_model": oll["model"],
        "url": oll["url"]
    })


@app.post("/ollama/enhance")
async def ollama_enhance_prompt(request: Request):
    """Enhance a user prompt using the selected style/enhancer text via Ollama.
    Expects {prompt: str, enhancer: str}. Returns {enhanced: str, error?: str}
    """
    try:
        data = await request.json()
        original = (data.get("prompt") or "").strip()
        enhancer = (data.get("enhancer") or "").strip()
        if not original:
            return {"enhanced": original}
        oll = get_ollama_settings()
        system = (
            "You are an expert prompt engineer for text-to-image and text-to-video models "
            "(Flux, SDXL, etc). Your job is to take the user's base subject prompt and "
            "seamlessly incorporate the provided style/direction instructions to make a "
            "more vivid, detailed, and effective prompt. Preserve the core subject, action, "
            "and composition. Output ONLY the final enhanced prompt as one clean paragraph. "
            "No explanations, no prefixes, no quotation marks."
        )
        user = f"Style / Direction to apply: {enhancer}\n\nBase prompt: {original}\n\nEnhanced prompt:"
        res = await ollama_generate(
            prompt=user,
            system=system,
            expect_json=False,
        )
        enhanced = (res.get("text") or original).strip()
        # sanitize common model artifacts
        if enhanced.startswith('"') and enhanced.endswith('"'):
            enhanced = enhanced[1:-1].strip()
        if enhanced.lower().startswith("enhanced prompt:"):
            enhanced = enhanced.split(":", 1)[1].strip()
        return {"enhanced": enhanced or original}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"enhanced": original, "error": str(e)}


@app.post("/chat")
async def chat_send(request: Request):
    """
    Simple chat endpoint for the new Chat mode.
    Accepts {prompt, history?, attachment?} where attachment = {name, content}.
    Builds a messages list (system + optional doc context + history + user) and
    calls the live Ollama settings via /api/chat.
    """
    try:
        data = await request.json()
        prompt = (data.get("prompt") or "").strip()
        history = data.get("history") or []
        attachment = data.get("attachment") or None

        if not prompt:
            return JSONResponse({"success": False, "error": "prompt required"}, status_code=400)

        messages = []

        sys = "You are a helpful AI assistant."
        if attachment and attachment.get("content"):
            doc_name = attachment.get("name", "document")
            doc_text = str(attachment.get("content", ""))[:12000]
            sys += f"\n\nThe user attached a document named \"{doc_name}\". Use its content to answer:\n{doc_text}"

        messages.append({"role": "system", "content": sys})

        for h in history:
            if isinstance(h, dict) and h.get("role") in ("user", "assistant") and h.get("content"):
                messages.append({"role": h["role"], "content": h["content"]})

        messages.append({"role": "user", "content": prompt})

        res = await ollama_chat(messages)
        text = res.get("text", "")
        err = res.get("error")

        if err:
            return JSONResponse({"success": False, "error": err})

        return {"success": True, "response": text}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


@app.post("/generate")
async def generate(data: dict):
    prompt = data.get("prompt")
    resolution = data.get("resolution", "720p")
    aspect_ratio = data.get("aspect_ratio", "16:9")
    mode = data.get("mode", "image")           # ← Use mode instead
    duration = data.get("duration")
    count = data.get("count", 4)
    source_image = data.get("source_image")
    modifier_audio = data.get("modifier_audio")
    modifier_image = data.get("modifier_image")
    image_model = data.get("image_model", "schnell")
    i2i_model = data.get("i2i_model", "klein")
    qwen_turbo = data.get("qwen_turbo", True)
    lora_name = data.get("lora_name")

    if mode == "video" and duration:
        if modifier_audio and source_image:
            result = await generate_single_image_audio_to_video(source_image, modifier_audio, prompt, resolution, aspect_ratio, duration)
            return {"success": True, "results": [result]}
        elif source_image:
            result = await generate_single_image_to_video(source_image, prompt, resolution, aspect_ratio, duration)
            return {"success": True, "results": [result]}
        else:
            result = await generate_single_video(prompt, resolution, aspect_ratio, duration)
            return {"success": True, "results": [result]}
    else:
        if source_image and modifier_image:
            # double i2i (2 images)
            result = await generate_double_image_to_image(source_image, modifier_image, prompt)
            return {"success": True, "results": [result]}
        elif source_image:
            # i2i
            result = await generate_single_image_to_image(source_image, prompt, i2i_model=i2i_model)
            return {"success": True, "results": [result]}
        else:
            # Image generation (default)
            lora_strength = float(data.get("lora_strength", 0.8)) if data.get("lora_strength") is not None else 0.8
            results = await generate_multiple_images(prompt, resolution, aspect_ratio, count=count, image_model=image_model, qwen_turbo=qwen_turbo, lora_name=lora_name, lora_strength=lora_strength)
            return {"success": True, "results": results}


@app.post("/generate/stream")
async def generate_stream(data: dict):
    prompt = data.get("prompt", "")
    resolution = data.get("resolution", "720p")
    aspect_ratio = data.get("aspect_ratio", "16:9")
    mode = data.get("mode", "image")
    duration = data.get("duration")
    count = data.get("count")
    source_image = data.get("source_image")  # local filename for image-to-video
    modifier_audio = data.get("modifier_audio")  # audio modifier selected via modal + for ia2v
    modifier_image = data.get("modifier_image")  # image modifier for double i2i (2 refs)
    image_model = data.get("image_model", "schnell")  # for main page text-to-image model choice
    i2i_model = data.get("i2i_model", "klein")  # for modal image-to-image edits
    qwen_turbo = data.get("qwen_turbo", True)
    lora_name = data.get("lora_name")
    lora_strength = float(data.get("lora_strength", 0.8)) if data.get("lora_strength") is not None else 0.8

    if not prompt:
        return JSONResponse({"success": False, "error": "Prompt required"}, status_code=400)

    is_video = (mode == "video" and duration)
    if count is None:
        count = 1 if is_video else 4

    if is_video:
        if modifier_audio and source_image:
            # New: Image + Audio modifier to Video (ltx2_3_image_audio_to_video.json)
            # Triggered when + in modal picked an audio + video mode (or Create Video + audio mod)
            return StreamingResponse(
                generate_image_audio_to_videos_with_progress(
                    source_image, modifier_audio, prompt, resolution, aspect_ratio, duration, count=count
                ),
                media_type="text/event-stream"
            )
        elif source_image:
            # Image-to-Video path (triggered from modal "Create Video From this")
            return StreamingResponse(
                generate_image_to_videos_with_progress(
                    source_image, prompt, resolution, aspect_ratio, duration, count=count
                ),
                media_type="text/event-stream"
            )
        else:
            # Regular text-to-video
            return StreamingResponse(
                generate_videos_with_progress(prompt, resolution, aspect_ratio, duration, count=count),
                media_type="text/event-stream"
            )
    else:
        if source_image and modifier_image:
            # Double image-to-image (2 reference images + prompt) using the new flux2_klein_image_image_to_image workflow.
            # 1st ref = main image (opened in modal), 2nd ref = modifier image (selected via + in modal), when in image mode.
            return StreamingResponse(
                generate_double_image_to_image_with_progress(
                    source_image, modifier_image, prompt, count=count
                ),
                media_type="text/event-stream"
            )
        elif source_image:
            # Image-to-Image path (adjustment prompt from modal) - single ref + prompt, using selected i2i model
            return StreamingResponse(
                generate_image_to_images_with_progress(
                    source_image, prompt, count=count, i2i_model=i2i_model
                ),
                media_type="text/event-stream"
            )
        else:
            return StreamingResponse(
                generate_images_with_progress(prompt, resolution, aspect_ratio, count=count, image_model=image_model, qwen_turbo=qwen_turbo, lora_name=lora_name, lora_strength=lora_strength),
                media_type="text/event-stream"
            )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

@app.get("/history")
async def get_history():
    return load_generations()


@app.get("/settings")
async def get_settings():
    return load_app_settings()


@app.post("/settings")
async def post_settings(request: Request):
    try:
        body = await request.body()
        data = json.loads(body.decode("utf-8", errors="ignore") or "{}")
        current = load_app_settings()
        if isinstance(data, dict):
            if "image_model" in data:
                model = data["image_model"]
                if model in ("schnell", "klein", "qwen"):
                    current["image_model"] = model
            if "i2i_model" in data:
                model = data["i2i_model"]
                if model in ("klein", "flux2"):
                    current["i2i_model"] = model
            if "library_video_playback" in data:
                val = data["library_video_playback"]
                if val in ("1st_frame", "play_loop"):
                    current["library_video_playback"] = val
            if "qwen_turbo" in data:
                current["qwen_turbo"] = bool(data["qwen_turbo"])
            # Server settings (IP/port composed into full URLs by caller or accept full URL)
            if "comfyui_url" in data and isinstance(data["comfyui_url"], str) and data["comfyui_url"].strip():
                current["comfyui_url"] = data["comfyui_url"].strip().rstrip("/")
            if "ollama_url" in data and isinstance(data["ollama_url"], str) and data["ollama_url"].strip():
                current["ollama_url"] = data["ollama_url"].strip().rstrip("/")
            if "ollama_model" in data and isinstance(data["ollama_model"], str) and data["ollama_model"].strip():
                current["ollama_model"] = data["ollama_model"].strip()
            if "ollama_timeout" in data:
                try:
                    t = int(data["ollama_timeout"])
                    if t > 0:
                        current["ollama_timeout"] = t
                except Exception:
                    pass
            if "failed_gen_clear_seconds" in data:
                try:
                    t = int(data["failed_gen_clear_seconds"])
                    if t > 0:
                        current["failed_gen_clear_seconds"] = t
                except Exception:
                    pass
            if "prompt_enhancers" in data and isinstance(data.get("prompt_enhancers"), list):
                current["prompt_enhancers"] = data["prompt_enhancers"]
            save_app_settings(current)
        return {"success": True, "settings": current}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.on_event("startup")
async def on_startup():
    """Fetch available LoRAs from ComfyUI at server startup so settings can list them."""
    global available_loras
    try:
        from utils.comfy_client import fetch_loras_from_comfy
        available_loras = await fetch_loras_from_comfy()
        print(f"[startup] Loaded {len(available_loras)} LoRAs from ComfyUI (via /models/loras or fallback)")
    except Exception as e:
        print(f"[startup] LoRA fetch error (will retry on /loras refresh): {e}")


@app.get("/loras")
async def get_loras(refresh: bool = False):
    """Return cached LoRAs (from /models/loras or fallback /object_info). ?refresh=true to re-query ComfyUI."""
    global available_loras
    if refresh:
        try:
            from utils.comfy_client import fetch_loras_from_comfy
            available_loras = await fetch_loras_from_comfy()
            print(f"[loras] Refreshed to {len(available_loras)} LoRAs (via /models/loras or fallback)")
        except Exception as e:
            print(f"[loras] refresh error: {e}")
    return {"loras": available_loras or []}


@app.get("/comfy/models")
async def get_comfy_models():
    """Return available models from ComfyUI, categorized for the settings model checker.
    Returns {connected: bool, checkpoints: [...], loras: [...], vaes: [...], clips: [...], upscalers: [...] }
    """
    try:
        from utils.comfy_client import fetch_comfy_models
        models = await fetch_comfy_models()
        return {"connected": True, **models}
    except Exception as e:
        print(f"[comfy/models] error: {e}")
        return {
            "connected": False,
            "checkpoints": [],
            "loras": [],
            "vaes": [],
            "clips": [],
            "upscalers": [],
            "error": str(e)
        }


@app.post("/save-generation")
async def save_generation_endpoint(request: Request):
    try:
        body = await request.body()
        raw = body.decode("utf-8", errors="ignore")
        print("[SAVE] Raw body:", raw)

        data = json.loads(raw)

        # Handle case where frontend sends just a string
        if isinstance(data, str):
            print("[SAVE] WARNING: Received string instead of object")
            return {"success": False, "error": "Invalid data format. Expected object, got string."}

        prompt = data.get("prompt")
        filename = data.get("filename")

        if not prompt or not filename:
            return {"success": False, "error": "prompt and filename are required"}

        asset_id = save_generation(
            prompt=prompt,
            filename=filename,
            file_type=data.get("type", "image"),
            aspect_ratio=data.get("aspect_ratio", "3:2"),
            width=data.get("width", 0),
            height=data.get("height", 0),
            duration=data.get("duration"),
            parent_id=data.get("parent_id"),
            derived_from=data.get("derived_from", []),
            metadata=data.get("metadata", {}),
            favorite=data.get("favorite", False)
        )
        return {"success": True, "id": asset_id}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


@app.post("/update-generation")
async def update_generation_endpoint(request: Request):
    try:
        data = await request.json()
        asset_id = data.get("id")
        if not asset_id:
            return {"success": False, "error": "id is required"}
        updates = {}
        if "favorite" in data:
            updates["favorite"] = bool(data.get("favorite"))
        if not updates:
            return {"success": False, "error": "no valid updates provided"}
        success = update_generation(asset_id, updates)
        if success:
            return {"success": True}
        return {"success": False, "error": "asset not found"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


@app.post("/delete-generation")
async def delete_generation_endpoint(request: Request):
    try:
        data = await request.json()
        asset_id = data.get("id")
        cascade = bool(data.get("cascade", False))
        if not asset_id:
            return {"success": False, "error": "id is required"}
        result = delete_generation(asset_id, cascade)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


# ==================== PROJECT ROUTES (sidebar + waveform + cue projects) ====================
@app.get("/projects")
async def get_projects():
    return load_projects()


@app.post("/save-project")
async def save_project_endpoint(request: Request):
    try:
        data = await request.json()
        if not isinstance(data, dict):
            return {"success": False, "error": "project object required"}
        pid = save_project(data)
        return {"success": True, "id": pid}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


@app.post("/update-project")
async def update_project_endpoint(request: Request):
    try:
        data = await request.json()
        pid = data.get("id")
        if not pid:
            return {"success": False, "error": "id is required"}
        updates = {k: v for k, v in data.items() if k != "id"}
        if not updates:
            return {"success": False, "error": "no valid updates provided"}
        success = update_project(pid, updates)
        if success:
            return {"success": True}
        return {"success": False, "error": "project not found"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


@app.post("/delete-project")
async def delete_project_endpoint(request: Request):
    try:
        data = await request.json()
        pid = data.get("id")
        if not pid:
            return {"success": False, "error": "id is required"}
        ok = delete_project(pid)
        return {"success": ok}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


# ==================== STORY MODE ENDPOINTS (Ollama two-pass + timeline apply) ====================

@app.post("/story/breakdown")
async def story_breakdown(request: Request):
    try:
        data = await request.json()
        story_text = (data.get("story_text") or data.get("story") or "").strip()
        characters = data.get("characters") or []
        num_scenes = data.get("num_scenes")
        target_seconds = data.get("target_seconds")
        style = data.get("style") or data.get("mood")
        debug = bool(data.get("debug"))
        if not story_text:
            return {"success": False, "error": "story_text is required"}
        result = await ollama_story_breakdown(story_text, characters, num_scenes, target_seconds, style, debug=debug)
        resp = {"success": True, "scenes": result.get("scenes", []), "error": result.get("error"), "raw": result.get("raw")}
        if debug and "debug" in result:
            resp["debug"] = result["debug"]
        return resp
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


@app.post("/story/generate-prompt")
async def story_generate_prompt(request: Request):
    try:
        data = await request.json()
        story_text = (data.get("story_text") or data.get("story") or "").strip()
        characters = data.get("characters") or []
        scene = data.get("scene") or {}
        style = data.get("style") or data.get("mood")
        if not story_text or not scene:
            return {"success": False, "error": "story_text and scene are required"}
        result = await ollama_scene_prompt(story_text, characters, scene, style)
        return {"success": True, "prompt": result.get("prompt", ""), "error": result.get("error")}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


@app.post("/projects/{project_id}/apply-story-to-timeline")
async def apply_story_to_timeline(project_id: str, request: Request):
    """
    Creates (or replaces) cues from the approved scenes in the project's story.
    A scene is considered ready if it has a selected_image_id.
    We map: time=start_time, name=title, prompt=the rich prompt, selected_image_id, video_id,
    video_prompt (fallback to prompt), lora_name (if we snapshot it on scene).
    """
    try:
        body = await request.json() if await request.body() else {}
        incoming_story = body.get("story")

        projects = load_projects()
        proj = None
        for p in projects:
            if p.get("id") == project_id:
                proj = p
                break
        if not proj:
            return {"success": False, "error": "project not found"}

        story = incoming_story or proj.get("story")
        if not story or not isinstance(story, dict):
            return {"success": False, "error": "no story on project (or provided in body)"}

        scenes = story.get("scenes") or []
        new_cues = []
        for sc in scenes:
            if not isinstance(sc, dict):
                continue
            if not sc.get("selected_image_id"):
                # only approved scenes with a chosen keyframe become cues
                continue

            cue = {
                "id": str(uuid.uuid4()),
                "time": float(sc.get("start_time") or 0),
                "name": sc.get("title") or f"Scene {sc.get('scene_number', '')}",
                "prompt": sc.get("prompt") or sc.get("high_level_description") or "",
                "candidates": [],
                "selected_image_id": sc.get("selected_image_id"),
                "video_id": sc.get("video_id"),
                "video_prompt": sc.get("video_prompt") or (sc.get("prompt") or "") + ", cinematic motion, music sync",
                "mute_audio": False,
                "video_start_offset": 0,
                "lora_name": sc.get("lora_name") or None,
            }
            # If the scene carried a lora snapshot with strength, we could store it; current cue model only has name.
            # Downstream gens from the cue dialog will still let user pick lora again.
            new_cues.append(cue)

        # Sort and (for clean "director" result) replace the cue list.
        # If you prefer append + dedupe, change the next line.
        new_cues.sort(key=lambda c: c.get("time") or 0)
        proj["cues"] = new_cues

        # Adjust project duration to cover the full story length.
        # Use the greater of: story's total_duration (requested sequence length), 
        # the max end time from scenes, or the existing audio duration.
        max_scene_end = 0.0
        for sc in scenes:
            if isinstance(sc, dict):
                end = float(sc.get("start_time") or 0) + float(sc.get("duration") or 0)
                if end > max_scene_end:
                    max_scene_end = end

        story_total = 0.0
        if isinstance(story, dict):
            story_total = float(story.get("total_duration") or 0)

        desired_len = max(max_scene_end, story_total)
        current_dur = float(proj.get("audio_duration") or 0)
        proj["audio_duration"] = max(current_dur, desired_len)

        proj["last_updated"] = datetime.now().isoformat()

        # Persist
        save_project(proj)  # this will re-load + overwrite the matching project

        return {"success": True, "cues_created": len(new_cues), "project": proj}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


@app.post("/export-sequence")
async def export_sequence(request: Request):
    try:
        data = await request.json()
        items = data.get("items", [])
        project_name = data.get("project_name", "sequence")
        if not items:
            return JSONResponse({"success": False, "error": "No items to export"}, status_code=400)

        generations = load_generations()
        asset_map = {g.get("id"): g for g in generations if g.get("id")}

        zip_buffer = BytesIO()
        safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', str(project_name))[:60] or "sequence"

        trim_warnings = []

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for item in items:
                aid = item.get("asset_id")
                dname = item.get("desired_name")
                offset = float(item.get("video_start_offset", 0) or 0)
                if not aid or not dname:
                    continue
                g = asset_map.get(aid)
                if not g:
                    continue
                fname = g.get("filename")
                if not fname:
                    continue
                ftype = g.get("type", "image")
                is_vid = (ftype == "video") or str(fname).lower().endswith(('.mp4', '.mov', '.webm', '.avi'))
                folder = "videos" if is_vid else "images"
                fpath = os.path.join(folder, fname)
                if not os.path.isfile(fpath):
                    continue

                if is_vid and offset > 0.001:
                    # Trim video starting at offset (to end or to original remaining duration)
                    meta = g.get("metadata", {}) or {}
                    orig_dur = float(meta.get("duration") or 0)
                    trim_dur = max(0.1, orig_dur - offset) if orig_dur > offset else None

                    trimmed_success = False
                    trim_method = None

                    # 1. Preferred: ffmpeg (fast, copy if possible)
                    try:
                        with tempfile.TemporaryDirectory() as tmpdir:
                            orig_ext = os.path.splitext(fname)[1] or ".mp4"
                            trimmed_path = os.path.join(tmpdir, f"trimmed{orig_ext}")
                            cmd = [
                                "ffmpeg", "-y",
                                "-ss", str(offset),
                                "-i", fpath,
                            ]
                            if trim_dur:
                                cmd += ["-t", str(trim_dur)]
                            cmd += [
                                "-c", "copy",
                                "-avoid_negative_ts", "make_non_negative",
                                "-movflags", "+faststart",
                                trimmed_path
                            ]
                            subprocess.run(cmd, check=True, capture_output=True)
                            zf.write(trimmed_path, arcname=dname)
                            trimmed_success = True
                            trim_method = "ffmpeg"
                    except Exception as ffmpeg_err:
                        print(f"ffmpeg trim failed for {fname} @ {offset}s: {ffmpeg_err}")

                    # 2. Python-only fallback using OpenCV (re-encodes, no ffmpeg needed)
                    if not trimmed_success and HAS_OPENCV:
                        try:
                            with tempfile.TemporaryDirectory() as tmpdir:
                                orig_ext = os.path.splitext(fname)[1] or ".mp4"
                                trimmed_path = os.path.join(tmpdir, f"trimmed{orig_ext}")
                                trim_video_opencv(fpath, trimmed_path, offset, trim_dur)
                                zf.write(trimmed_path, arcname=dname)
                                trimmed_success = True
                                trim_method = "opencv"
                        except Exception as opencv_err:
                            print(f"OpenCV trim fallback also failed for {fname}: {opencv_err}")

                    if not trimmed_success:
                        # Ultimate fallback: include the full original
                        warning_msg = f"Could not trim '{dname}' (offset {offset}s from '{fname}') - included full original video instead (no working trim method)."
                        print("Warning: " + warning_msg)
                        trim_warnings.append(warning_msg)
                        zf.write(fpath, arcname=dname)
                    else:
                        print(f"Successfully trimmed {dname} using {trim_method}")
                else:
                    # Image or video with no/zero offset: use as-is
                    zf.write(fpath, arcname=dname)

            if trim_warnings:
                warning_text = "TRIM WARNINGS - Some videos could not be trimmed and full originals were included instead:\n\n" + "\n".join(trim_warnings)
                zf.writestr("TRIM_WARNINGS.txt", warning_text)

        zip_buffer.seek(0)

        response = StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.zip"'}
        )

        if trim_warnings:
            # Send a header so the frontend can show a user warning
            response.headers["X-Trim-Warnings"] = "Some videos could not be trimmed properly. See TRIM_WARNINGS.txt inside the zip for details."

        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


@app.post("/upload")
async def upload_asset(file: UploadFile = File(...)):
    if not file.filename:
        return {"error": "No file provided"}

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "bin"
    content_type = (file.content_type or "").lower()

    is_audio = content_type.startswith("audio/") or ext in ["mp3", "wav", "ogg", "m4a", "flac", "aac", "webm"]

    if is_audio:
        folder = "audio"
        ftype = "audio"
    else:
        folder = "images"
        ftype = "image"

    new_filename = f"{uuid.uuid4().hex}.{ext}"
    dest_path = os.path.join(folder, new_filename)

    try:
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return {"filename": new_filename, "type": ftype}
    except Exception as e:
        return {"error": str(e)}