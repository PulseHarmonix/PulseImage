"""Single Frame endpoints: probe a video and extract frames.

Provides frame thumbnails for the Single Frame window and saves a selected
full-resolution frame to the library as an image asset.
"""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from services.generation_service import get_asset_by_id, save_generation
from services.video_frame_service import (
    probe_video,
    extract_frame_window,
    extract_full_frame,
    VideoFrameError,
    FRAME_WINDOW,
)

router = APIRouter()


def _get_video_asset(asset_id: str):
    asset = get_asset_by_id(asset_id)
    if not asset:
        return None, "Asset not found"
    if asset.get("type") != "video" and not str(asset.get("filename", "")).lower().endswith(".mp4"):
        return None, "Asset is not a video"
    return asset, None


@router.post("/frames/info")
async def frames_info(request: Request):
    """Return duration/fps/dimensions/frame count for a video asset."""
    data = await request.json()
    asset_id = (data or {}).get("asset_id")
    if not asset_id:
        return JSONResponse({"success": False, "error": "asset_id required"}, status_code=400)

    asset, err = _get_video_asset(asset_id)
    if err:
        return JSONResponse({"success": False, "error": err}, status_code=404)

    try:
        info = probe_video(asset["filename"])
    except VideoFrameError as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

    return {
        "success": True,
        "asset_id": asset_id,
        "filename": asset["filename"],
        "prompt": asset.get("prompt") or "",
        **info,
    }


@router.post("/frames/window")
async def frames_window(request: Request):
    """Return a window of frame thumbnails (default 24 frames) for a video."""
    data = await request.json()
    asset_id = (data or {}).get("asset_id")
    if not asset_id:
        return JSONResponse({"success": False, "error": "asset_id required"}, status_code=400)

    asset, err = _get_video_asset(asset_id)
    if err:
        return JSONResponse({"success": False, "error": err}, status_code=404)

    start_index = (data or {}).get("start_index", 0)
    count = (data or {}).get("count", FRAME_WINDOW)
    fps = (data or {}).get("fps")

    try:
        if not fps:
            fps = probe_video(asset["filename"])["fps"]
        frames = extract_frame_window(asset["filename"], asset_id, float(fps), start_index, count)
    except VideoFrameError as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

    return {"success": True, "frames": frames, "fps": float(fps)}


@router.post("/frames/save")
async def frames_save(request: Request):
    """Extract a full-resolution frame and save it to the library as an image."""
    data = await request.json()
    asset_id = (data or {}).get("asset_id")
    frame_index = (data or {}).get("frame_index")
    if not asset_id or frame_index is None:
        return JSONResponse({"success": False, "error": "asset_id and frame_index required"}, status_code=400)

    asset, err = _get_video_asset(asset_id)
    if err:
        return JSONResponse({"success": False, "error": err}, status_code=404)

    try:
        info = probe_video(asset["filename"])
        fps = info.get("fps") or 24.0
        time_seconds = max(0.0, float(frame_index) / float(fps))
        result = extract_full_frame(asset["filename"], time_seconds)
    except VideoFrameError as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

    width = result.get("width") or 0
    height = result.get("height") or 0
    aspect_ratio = asset.get("aspect_ratio")
    if not aspect_ratio and width and height:
        aspect_ratio = f"{width}:{height}"

    base_prompt = (asset.get("prompt") or asset.get("filename") or "video").strip()
    prompt = f"Frame {int(frame_index)} @ {time_seconds:.2f}s from {base_prompt}"

    try:
        new_id = save_generation(
            prompt=prompt,
            filename=result["filename"],
            file_type="image",
            aspect_ratio=aspect_ratio or "16:9",
            width=width,
            height=height,
            parent_id=asset_id,
            derived_from=[asset_id],
            metadata={
                "source": "single_frame",
                "frame_index": int(frame_index),
                "time": time_seconds,
            },
        )
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

    return {
        "success": True,
        "id": new_id,
        "filename": result["filename"],
        "width": width,
        "height": height,
        "frame_index": int(frame_index),
        "time": time_seconds,
    }
