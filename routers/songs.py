"""YuE2 song generation endpoints."""
import json

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from services.yue2_service import generate_cover, generate_song, get_yue2_capabilities

router = APIRouter()


@router.get("/songs/capabilities")
async def songs_capabilities():
    """Return YuE2 node availability and ComfyUI connectivity."""
    return await get_yue2_capabilities()


@router.post("/songs/generate")
async def songs_generate(request: Request):
    """Generate a song from a style prompt and lyrics using ComfyUI/YuE2."""
    try:
        body = await request.body()
        data = json.loads(body.decode("utf-8", errors="ignore") or "{}")
        if not isinstance(data, dict):
            return JSONResponse(
                {"success": False, "error": "Invalid data format"}, status_code=400
            )

        result = await generate_song(
            style=data.get("style", ""),
            lyrics=data.get("lyrics", ""),
            title=data.get("title", ""),
            planning=data.get("planning", "full"),
            max_duration=data.get("max_duration", 600),
            acoustic_steps=data.get("acoustic_steps", 32),
            max_score_tokens=data.get("max_score_tokens", 8192),
            seed=data.get("seed", 0),
            job_id=data.get("job_id", ""),
            temperature=data.get("temperature", 1.0),
            top_p=data.get("top_p", 0.95),
            top_k=data.get("top_k", 100),
            repetition_penalty=data.get("repetition_penalty", 1.2),
            guidance=data.get("guidance", 1.0),
            tile_frames=data.get("tile_frames", 1024),
            download_missing=data.get("download_missing", True),
        )
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}
@router.post("/songs/cover")
async def songs_cover(request: Request):
    """Cover a selected library audio asset using YuE2 and SheetSage2."""
    try:
        body = await request.body()
        data = json.loads(body.decode("utf-8", errors="ignore") or "{}")
        if not isinstance(data, dict):
            return JSONResponse(
                {"success": False, "error": "Invalid data format"}, status_code=400
            )

        result = await generate_cover(
            asset_id=data.get("asset_id", ""),
            style=data.get("style", ""),
            lyrics=data.get("lyrics", ""),
            title=data.get("title", ""),
            max_duration=data.get("max_duration", 600),
            acoustic_steps=data.get("acoustic_steps", 32),
            max_score_tokens=data.get("max_score_tokens", 8192),
            seed=data.get("seed", 0),
            job_id=data.get("job_id", ""),
            temperature=data.get("temperature", 1.0),
            top_p=data.get("top_p", 0.95),
            top_k=data.get("top_k", 100),
            repetition_penalty=data.get("repetition_penalty", 1.2),
            guidance=data.get("guidance", 1.0),
        )
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}
