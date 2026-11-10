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
    get_previous_segment,
    MAX_SLOT_IMAGES,
)
from services.audio_service import (
    trim_audio,
    delete_audio,
    get_audio_duration,
    AudioError,
)
from services.comfy_service import (
    generate_single_image_audio_to_video,
    generate_single_image_to_video,
    generate_fasth3_multi_ref_video,
)
from services.generation_service import save_generation
from services.lwks_export_service import (
    build_lwks_zip,
    LwksExportError,
    LwksProjectNotFound,
)
from services.comfy_progress import set_progress_job
from services.video_upscale_service import maybe_upscale_video_result
from services.video_frame_service import (
    extract_full_frame,
    extract_video_clip,
    probe_video,
    VideoFrameError,
)

router = APIRouter()


def _safe_name(value: str, fallback: str = "segment") -> str:
    value = re.sub(r'[\\/:*?"<>|]+', "-", (value or "").strip())
    value = re.sub(r"\s+", " ", value).strip(" .")
    return value or fallback


def _slot_reference_images(slot: dict) -> list[dict]:
    images = [dict(img) for img in (slot.get("images") or []) if isinstance(img, dict)]
    if images:
        return images
    image = slot.get("image") or {}
    if (image.get("filename") or "").strip():
        return [{
            "asset_id": image.get("asset_id") or "",
            "filename": image["filename"],
            "name": image.get("name") or "",
            "role": "background",
            "label": image.get("label") or "",
        }]
    return []


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


@router.get("/music/projects/{project_id}/lwks")
def download_lightworks_export(project_id: str):
    """Export the project as a Lightworks FCP7 XML package."""
    try:
        zip_path, download_name = build_lwks_zip(project_id)
    except LwksProjectNotFound:
        return JSONResponse({"error": "Project not found"}, status_code=404)
    except LwksExportError as e:
        return JSONResponse({"error": str(e)}, status_code=400)
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=download_name,
        background=BackgroundTask(os.remove, zip_path),
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

    start = segment.get("start_time") or 0
    end = segment.get("end_time") or 0
    if end <= start:
        return {"success": False, "error": "End time must be greater than start time"}

    prompt = (segment.get("prompt") or "").strip()
    if not prompt:
        return {"success": False, "error": "Prompt is required for this segment"}

    follow_on = bool(segment.get("follow_on"))
    follow_on_video = bool(segment.get("follow_on_video")) and follow_on
    follow_on_video_fallback = None
    temp_video_filename = None
    clip_start = 0.0

    video_model = "ltx"
    ltx_version = "2.3"
    if project_model == "ltx25":
        ltx_version = "2.5"
    elif project_model == "fasth3":
        video_model = "fasth3"
    elif project_model == "grok":
        video_model = "grok"

    if follow_on_video and video_model != "fasth3":
        err = "Video follow-on requires the FastH3 model."
        set_segment_status(segment_id, "error", err)
        return {"success": False, "error": err}

    reference_images = _slot_reference_images(slot)
    previous_segment = None
    previous_video_asset_id = None
    frame_offset = 0.0
    temp_frame_filename = None
    follow_on_background_replaced = False

    if follow_on:
        previous_segment = get_previous_segment(segment_id)
        if not previous_segment:
            return {"success": False, "error": "No previous segment to follow on from"}
        previous_video_filename = previous_segment.get("video_filename")
        previous_video_asset_id = previous_segment.get("video_asset_id") or None
        if not previous_video_filename:
            return {
                "success": False,
                "error": "Previous segment has no generated video to follow on from",
            }
        if not os.path.isfile(os.path.join("videos", previous_video_filename)):
            return {
                "success": False,
                "error": f"Previous segment video not found: {previous_video_filename}",
            }
        try:
            info = probe_video(previous_video_filename)
            prev_duration = float(info.get("duration") or 0)
            prev_fps = float(info.get("fps") or 0) or 24.0
            previous_start = float(previous_segment.get("start_time") or 0)
            frame_offset = max(0.0, float(start) - previous_start)
            frame_offset = min(frame_offset, max(0.0, prev_duration - 1.0 / prev_fps))
            frame = extract_full_frame(previous_video_filename, frame_offset)
        except VideoFrameError as e:
            return {"success": False, "error": str(e)}
        temp_frame_filename = frame.get("filename")

        if follow_on_video:
            clip_start = max(0.0, frame_offset - 2.0)
            clip_duration = frame_offset - clip_start
            if clip_duration < 2.0:
                follow_on_video = False
                follow_on_video_fallback = "clip_too_short"
            else:
                try:
                    clip = extract_video_clip(
                        previous_video_filename, clip_start, 2.0
                    )
                except VideoFrameError as e:
                    if temp_frame_filename:
                        try:
                            os.remove(os.path.join("images", temp_frame_filename))
                        except OSError:
                            pass
                    return {"success": False, "error": str(e)}
                temp_video_filename = clip.get("filename")

        frame_image = {
            "asset_id": "",
            "filename": temp_frame_filename,
            "name": "",
            "role": "background",
            "label": "",
        }
        background_index = next(
            (
                i
                for i, img in enumerate(reference_images)
                if str(img.get("role") or "").lower() == "background"
            ),
            None,
        )
        if background_index is not None:
            reference_images[background_index] = frame_image
            follow_on_background_replaced = True
        else:
            reference_images.insert(0, frame_image)
    elif not reference_images:
        return {"success": False, "error": f"No image set for slot '{slot.get('name') or 'character'}'"}

    reference_images = [
        img for img in reference_images if (img.get("filename") or "").strip()
    ]
    reference_images = reference_images[:MAX_SLOT_IMAGES]
    image_filenames = [img["filename"] for img in reference_images]
    image_roles = [img.get("role") or "" for img in reference_images]
    image_labels = [img.get("label") or "" for img in reference_images]
    image = reference_images[0] if reference_images else {}
    image_filename = image.get("filename")

    settings = project.get("settings") or {}
    resolution = settings.get("resolution") or "720p"
    aspect_ratio = settings.get("aspect_ratio") or "3:2"
    duration = float(end) - float(start)

    try:
        if video_model != "fasth3" and len(image_filenames) > 1:
            if follow_on:
                err = (
                    "Multiple reference images are not supported for LTX follow-on "
                    "segments; use FastH3 or a single reference image."
                )
            else:
                err = "Multiple reference images require the FastH3 model."
            set_segment_status(segment_id, "error", err)
            return {"success": False, "error": err}

        set_segment_status(segment_id, "generating")

        use_multi_ref = video_model == "fasth3" and (
            len(image_filenames) > 1 or follow_on_video
        )
        follow_on_i2v = follow_on and video_model == "fasth3" and not use_multi_ref

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
            if use_multi_ref:
                result = await generate_fasth3_multi_ref_video(
                    image_filenames,
                    [trimmed_filename],
                    prompt,
                    resolution,
                    aspect_ratio,
                    duration,
                    image_roles=image_roles,
                    image_labels=image_labels,
                    first_frame_filename=temp_frame_filename if follow_on else None,
                    audio_mode="music",
                    ref_video_filename=temp_video_filename if follow_on_video else None,
                    ref_image_size="match" if follow_on_video else "max",
                )
            elif follow_on_i2v:
                result = await generate_single_image_to_video(
                    image_filename,
                    prompt,
                    resolution,
                    aspect_ratio,
                    duration,
                    video_model=video_model,
                    audio_filename=trimmed_filename,
                )
            else:
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
            if trimmed_filename:
                delete_audio(trimmed_filename)
            return {"success": False, "error": str(e)}

        if trimmed_filename:
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

        previous_id = previous_segment.get("id") if previous_segment else None
        parent_id = previous_video_asset_id if follow_on else (image.get("asset_id") or None)
        derived_from = []
        for ref in (image.get("asset_id"), parent_id):
            if ref and ref not in derived_from:
                derived_from.append(ref)
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
            derived_from=derived_from,
            metadata={
                "name": export_name,
                "gen": {
                    "mode": "video",
                    "video_model": video_model,
                    "ltx_version": ltx_version if video_model == "ltx" else None,
                    "fasth3_mode": (
                        (
                            "multi_ref_video_guide"
                            if follow_on_video
                            else ("multi_ref_guide" if follow_on else "multi_ref")
                        )
                        if use_multi_ref
                        else (
                            "i2v_audio_guide"
                            if follow_on_i2v
                            else ("reference" if video_model == "fasth3" else None)
                        )
                    ),
                    "resolution": resolution,
                    "aspect_ratio": aspect_ratio,
                    "duration": out_duration,
                    "original_prompt": prompt,
                    "reference_image_size": "match" if follow_on_video else "max",
                    "video_upscale": "relayvsr_x2"
                    if (result.get("upscale") or {}).get("status") == "done"
                    else "off",
                },
                "music": {
                    "project_id": project.get("id"),
                    "slot_id": slot.get("id"),
                    "segment_id": segment_id,
                    "character": slot.get("name") or "",
                    "start_time": start,
                    "end_time": end,
                    "model": project_model,
                    "offset_frames": offset,
                    "audio_source": "project_segment",
                    "audio_used_for_generation": True,
                    "audio_muxed_from_project": False,
                    "follow_on": follow_on,
                    "follow_on_from_segment_id": previous_id if follow_on else None,
                    "follow_on_from_asset_id": previous_video_asset_id if follow_on else None,
                    "follow_on_time": round(frame_offset, 3) if follow_on else None,
                    "follow_on_background_replaced": follow_on_background_replaced,
                    "follow_on_first_frame": bool(follow_on and video_model == "fasth3"),
                    "follow_on_video": follow_on_video,
                    "follow_on_video_start": round(clip_start, 3) if follow_on_video else None,
                    "follow_on_video_end": round(frame_offset, 3) if follow_on_video else None,
                    "follow_on_video_frames": 48 if follow_on_video else 0,
                    "follow_on_video_fallback": follow_on_video_fallback,
                    "reference_images": [
                        {
                            "filename": img["filename"],
                            "role": img.get("role") or "",
                            "label": img.get("label") or "",
                            "asset_id": img.get("asset_id") or "",
                        }
                        for img in reference_images
                    ],
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
    finally:
        if temp_frame_filename:
            try:
                os.remove(os.path.join("images", temp_frame_filename))
            except OSError:
                pass
        if temp_video_filename:
            try:
                os.remove(os.path.join("videos", temp_video_filename))
            except OSError:
                pass
