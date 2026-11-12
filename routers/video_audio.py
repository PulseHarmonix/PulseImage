"""Video audio endpoints: probe a video's audio track and extract it.

Provides audio inspection for the Video Audio page and saves the extracted
track to the library as an audio asset.
"""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from services.generation_service import get_asset_by_id
from services.video_audio_service import (
    probe_video_audio,
    extract_video_audio,
    VideoAudioError,
)

router = APIRouter()


def _get_video_asset(asset_id: str):
    asset = get_asset_by_id(asset_id)
    if not asset:
        return None, "Asset not found"
    if asset.get("type") != "video" and not str(asset.get("filename", "")).lower().endswith(".mp4"):
        return None, "Asset is not a video"
    return asset, None


@router.post("/video-audio/info")
async def video_audio_info(request: Request):
    """Return audio stream details for a video asset."""
    data = await request.json()
    asset_id = (data or {}).get("asset_id")
    if not asset_id:
        return JSONResponse({"success": False, "error": "asset_id required"}, status_code=400)

    asset, err = _get_video_asset(asset_id)
    if err:
        return JSONResponse({"success": False, "error": err}, status_code=404)

    try:
        info = probe_video_audio(asset["filename"])
    except VideoAudioError as e:
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


@router.post("/video-audio/extract")
async def video_audio_extract(request: Request):
    """Extract a video's audio track and save it to the library as audio."""
    data = await request.json()
    asset_id = (data or {}).get("asset_id")
    if not asset_id:
        return JSONResponse({"success": False, "error": "asset_id required"}, status_code=400)

    asset, err = _get_video_asset(asset_id)
    if err:
        return JSONResponse({"success": False, "error": err}, status_code=404)

    try:
        created = extract_video_audio(asset_id)
    except VideoAudioError as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=400)
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

    return {"success": True, "asset": created}
