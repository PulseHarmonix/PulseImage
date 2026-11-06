"""Music Video endpoints.

Manages projects (audio + character slots + timed segments) and generates
LTX image+audio-to-video clips for individual segments.
"""
import json
import os
import re
import tempfile
import zipfile
from datetime import datetime

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse
from starlette.background import BackgroundTask

from services.music_video_service import (
    list_projects,
    create_project,
    get_project,
    update_title,
    delete_project,
    update_settings,
    set_audio,
    update_slot,
    add_segment,
    update_segment,
    delete_segment,
    clear_segments,
    auto_create_segments,
    list_segment_videos,
    segment_export_name,
    project_model_key,
    offset_frames_for_model,
    set_segment_status,
    set_segment_result,
    get_segment_context,
)
from services.audio_service import (
    trim_audio,
    delete_audio,
    get_audio_duration,
    AudioError,
)
from services.comfy_service import generate_single_image_audio_to_video
from services.generation_service import save_generation
from services.comfy_progress import set_progress_job
from services.video_upscale_service import maybe_upscale_video_result

router = APIRouter()


def _safe_name(value: str, fallback: str = "segment") -> str:
    value = re.sub(r'[\\/:*?"<>|]+', "-", (value or "").strip())
    value = re.sub(r"\s+", " ", value).strip(" .")
    return value or fallback


# === Projects ===

@router.get("/music/projects")
async def list_music_projects():
    """Return all music video projects, newest first."""
    return {"projects": list_projects()}


@router.post("/music/projects")
async def create_music_project(request: Request):
    """Create a new music video project with eight character slots."""
    try:
        data = await request.json()
    except Exception:
        data = {}
    title = (data or {}).get("title") or "Untitled Music Video"
    return create_project(title)


@router.get("/music/projects/{project_id}")
async def get_music_project(project_id: str):
    """Return a project with its slots and segments."""
    project = get_project(project_id)
    if not project:
        return JSONResponse({"error": "Project not found"}, status_code=404)
    return project


@router.post("/music/projects/{project_id}/title")
async def set_music_project_title(project_id: str, request: Request):
    """Rename a project."""
    data = await request.json()
    title = (data or {}).get("title") or ""
    if not title.strip():
        return JSONResponse({"success": False, "error": "title required"}, status_code=400)
    ok = update_title(project_id, title)
    return {"success": ok}


@router.post("/music/projects/{project_id}/settings")
async def set_music_project_settings(project_id: str, request: Request):
    """Update a project's resolution and/or aspect ratio."""
    data = await request.json()
    settings = (data or {}).get("settings") or {}
    updated = update_settings(project_id, settings)
    if updated is None:
        return JSONResponse({"error": "Project not found"}, status_code=404)
    return {"success": True, "settings": updated}


@router.post("/music/projects/{project_id}/audio")
async def set_music_project_audio(project_id: str, request: Request):
    """Set the project's audio track (asset id + filename)."""
    data = await request.json()
    filename = (data or {}).get("filename") or ""
    audio = {
        "asset_id": (data or {}).get("asset_id") or "",
        "filename": filename,
        "name": ((data or {}).get("name") or "").strip(),
    }
    result = set_audio(project_id, audio)
    if result is None:
        return JSONResponse({"error": "Project not found"}, status_code=404)
    duration = get_audio_duration(filename) if filename else None
    return {"success": True, "audio": result, "duration": duration}


@router.delete("/music/projects/{project_id}")
async def delete_music_project(project_id: str):
    """Delete a project, its slots, and its segments."""
    ok = delete_project(project_id)
    return {"success": ok}


# === Slots ===

@router.post("/music/slots/{slot_id}")
async def update_music_slot(slot_id: str, request: Request):
    """Update a character slot's name and/or image."""
    data = await request.json()
    slot = update_slot(slot_id, data or {})
    if not slot:
        return JSONResponse({"error": "Slot not found"}, status_code=404)
    return slot


# === Segments ===

@router.post("/music/slots/{slot_id}/segments")
async def add_music_segment(slot_id: str, request: Request):
    """Add a time segment to a slot."""
    data = await request.json()
    seg = add_segment(
        slot_id,
        start_time=(data or {}).get("start_time", 0),
        end_time=(data or {}).get("end_time", 0),
        prompt=(data or {}).get("prompt", ""),
    )
    if not seg:
        return JSONResponse({"error": "Slot not found"}, status_code=404)
    return seg


@router.post("/music/segments/{segment_id}")
async def update_music_segment(segment_id: str, request: Request):
    """Update a segment's start/end/prompt."""
    data = await request.json()
    seg = update_segment(segment_id, data or {})
    if not seg:
        return JSONResponse({"error": "Segment not found"}, status_code=404)
    return seg


@router.delete("/music/segments/{segment_id}")
async def delete_music_segment(segment_id: str):
    """Delete a segment."""
    ok = delete_segment(segment_id)
    return {"success": ok}


@router.post("/music/projects/{project_id}/segments/clear")
async def clear_music_segments(project_id: str):
    """Delete every segment from all character slots in a project."""
    deleted = clear_segments(project_id)
    return {"success": True, "deleted": deleted}


@router.post("/music/projects/{project_id}/segments/reapply-names")
async def reapply_music_segment_names(project_id: str):
    """Re-apply model-aware export names to a project's segment generations."""
    from services.generation_service import reapply_segment_export_names
    result = reapply_segment_export_names(project_id)
    if result is None:
        return JSONResponse({"error": "Project not found"}, status_code=404)
    return {"success": True, **result}


@router.post("/music/projects/{project_id}/auto-segments")
async def auto_create_music_segments(project_id: str):
    """Create segments from section timings for image slots that have none."""
    result = auto_create_segments(project_id)
    return {"success": True, **result}


@router.get("/music/projects/{project_id}/segments/zip")
def download_segment_zip(project_id: str):
    """Zip every generated segment video into one file (one folder per character)."""
    project = get_project(project_id)
    if not project:
        return JSONResponse({"error": "Project not found"}, status_code=404)

    items = list_segment_videos(project_id)
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    tmp.close()
    used = set()
    added = 0
    try:
        with zipfile.ZipFile(tmp.name, "w", zipfile.ZIP_STORED) as zf:
            for item in items:
                path = os.path.join("videos", item["filename"])
                if not os.path.isfile(path):
                    continue
                ext = os.path.splitext(item["filename"])[1] or ".mp4"
                base = _safe_name(
                    item.get("export_name") or item.get("name") or f'{item["character"]} - {item["start"]:.2f}-{item["end"]:.2f}',
                    "segment",
                )
                if base.lower().endswith(ext.lower()):
                    base = base[: -len(ext)]
                folder = _safe_name(item["character"], "Character")
                arcname = f"{folder}/{base}{ext}"
                counter = 2
                while arcname.lower() in used:
                    arcname = f"{folder}/{base} ({counter}){ext}"
                    counter += 1
                used.add(arcname.lower())
                zf.write(path, arcname)
                added += 1
        if not added:
            os.remove(tmp.name)
            return JSONResponse({"error": "No generated segments available"}, status_code=404)
    except Exception as e:
        try:
            os.remove(tmp.name)
        except OSError:
            pass
        return JSONResponse({"error": str(e)}, status_code=500)

    title = _safe_name(project.get("title") or "Music Video", "Music Video")
    return FileResponse(
        tmp.name,
        media_type="application/zip",
        filename=f"{title} - segments.zip",
        background=BackgroundTask(os.remove, tmp.name),
    )


@router.post("/music/segments/{segment_id}/generate")
async def generate_music_segment(segment_id: str, request: Request):
    """Trim the project audio to the segment range and generate an LTX video."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    job_id = (body or {}).get("job_id") or ""
    video_upscale = (body or {}).get("video_upscale")
    upscale_detail = (body or {}).get("upscale_detail")
    set_progress_job(job_id, 0)

    ctx = get_segment_context(segment_id)
    if not ctx:
        return JSONResponse({"error": "Segment not found"}, status_code=404)

    segment = ctx["segment"]
    slot = ctx["slot"]
    project = ctx["project"]

    project_model = project_model_key(project)
    offset = offset_frames_for_model(project_model)

    audio = project.get("audio") or {}
    audio_filename = audio.get("filename")
    if not audio_filename:
        return {"success": False, "error": "No audio track set for this project"}

    image = slot.get("image") or {}
    image_filename = image.get("filename")
    if not image_filename:
        return {"success": False, "error": f"No image set for slot '{slot.get('name') or 'character'}'"}

    start = segment.get("start_time") or 0
    end = segment.get("end_time") or 0
    if end <= start:
        return {"success": False, "error": "End time must be greater than start time"}

    prompt = (segment.get("prompt") or "").strip()
    if not prompt:
        return {"success": False, "error": "Prompt is required for this segment"}

    settings = project.get("settings") or {}
    resolution = settings.get("resolution") or "720p"
    aspect_ratio = settings.get("aspect_ratio") or "3:2"
    duration = float(end) - float(start)

    video_model = "ltx"
    ltx_version = "2.3"
    if project_model == "ltx25":
        ltx_version = "2.5"
    elif project_model == "fasth3":
        video_model = "fasth3"
    elif project_model == "grok":
        video_model = "grok"

    set_segment_status(segment_id, "generating")

    trimmed_filename = None
    try:
        trimmed_filename = trim_audio(audio_filename, start, end)
    except AudioError as e:
        set_segment_status(segment_id, "error", str(e))
        return {"success": False, "error": str(e)}
    except Exception as e:
        set_segment_status(segment_id, "error", str(e))
        return {"success": False, "error": str(e)}

    try:
        result = await generate_single_image_audio_to_video(
            image_filename,
            trimmed_filename,
            prompt,
            resolution,
            aspect_ratio,
            duration,
            ltx_version=ltx_version,
            video_model=video_model,
        )
    except Exception as e:
        set_segment_status(segment_id, "error", str(e))
        delete_audio(trimmed_filename)
        return {"success": False, "error": str(e)}

    delete_audio(trimmed_filename)

    if not result or not result.get("success"):
        err = (result or {}).get("error") or "Video generation failed"
        set_segment_status(segment_id, "error", err)
        return {"success": False, "error": err}

    result = await maybe_upscale_video_result(
        result, job_id=job_id, requested=video_upscale, detail=upscale_detail
    )

    local_filename = result.get("local_filename")
    width = result.get("width", 0)
    height = result.get("height", 0)
    out_duration = result.get("duration", duration)

    parent_id = image.get("asset_id") or None
    export_name = segment_export_name(
        project.get("title") or "",
        start,
        slot.get("name") or "",
        offset_frames=offset,
    )

    asset_id = save_generation(
        prompt=prompt,
        filename=local_filename,
        file_type="video",
        aspect_ratio=aspect_ratio,
        width=width,
        height=height,
        duration=out_duration,
        parent_id=parent_id,
        derived_from=[parent_id] if parent_id else [],
        metadata={
            "name": export_name,
            "music": {
                "project_id": project.get("id"),
                "slot_id": slot.get("id"),
                "segment_id": segment_id,
                "character": slot.get("name") or "",
                "start_time": start,
                "end_time": end,
                "model": project_model,
                "offset_frames": offset,
            },
            "upscale": result.get("upscale"),
        },
    )

    set_segment_result(segment_id, asset_id, local_filename)

    return {
        "success": True,
        "asset_id": asset_id,
        "filename": local_filename,
        "name": export_name,
        "width": width,
        "height": height,
        "duration": out_duration,
    }
