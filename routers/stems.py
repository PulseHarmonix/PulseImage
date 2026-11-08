"""ComfyUI Demucs stem separation endpoints."""
import json

from fastapi import APIRouter, Request

from services.stems_service import (
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
