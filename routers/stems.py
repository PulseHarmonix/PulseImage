"""ComfyUI Demucs stem separation endpoints."""
import asyncio
import json

from fastapi import APIRouter, Request

from services.stems_service import (
    export_stem_mix,
    get_stems_capabilities,
    get_stems_status,
    separate_stems,
)

router = APIRouter()


@router.get("/stems/capabilities")
async def stems_capabilities():
    """Return Demucs node availability and ComfyUI connectivity."""
    return await get_stems_capabilities()


@router.get("/stems/{asset_id}")
def stems_status(asset_id: str):
    """Return saved stems or the current separation status for an audio asset."""
    return get_stems_status(asset_id)


@router.post("/stems/{asset_id}")
async def stems_separate(asset_id: str, request: Request):
    """Separate an audio asset into stems with ComfyUI Demucs."""
    data = {}
    try:
        body = await request.body()
        raw = body.decode("utf-8", errors="ignore")
        if raw:
            data = json.loads(raw)
    except Exception:
        data = {}

    job_id = data.get("job_id", "") if isinstance(data, dict) else ""
    return await separate_stems(asset_id, job_id=job_id or "")


@router.post("/stems/{asset_id}/mix")
async def stems_mix(asset_id: str, request: Request):
    """Mix selected stems into a new audio asset."""
    data = {}
    try:
        body = await request.body()
        raw = body.decode("utf-8", errors="ignore")
        if raw:
            data = json.loads(raw)
    except Exception:
        data = {}

    if not isinstance(data, dict):
        data = {}
    stem_ids = data.get("stem_ids")
    volumes = data.get("volumes")
    if not isinstance(stem_ids, list):
        stem_ids = []
    if not isinstance(volumes, dict):
        volumes = {}

    return await asyncio.to_thread(export_stem_mix, asset_id, stem_ids, volumes)
