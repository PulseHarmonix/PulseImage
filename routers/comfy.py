from fastapi import APIRouter
from fastapi.responses import JSONResponse

from config import get_comfyui_url
from services.comfy_service import check_comfyui_connection
from services.comfy_progress import get_progress

router = APIRouter()

@router.get("/comfy/status")
async def comfy_status():
    """Endpoint to check if ComfyUI is running"""
    is_connected = await check_comfyui_connection()
    return JSONResponse({
        "connected": is_connected,
        "url": get_comfyui_url()
    })


@router.get("/comfy/capabilities")
async def comfy_capabilities():
    """Return optional ComfyUI capability status (currently RelayVSR X2)."""
    from services.video_upscale_service import get_relayvsr_status
    status = await get_relayvsr_status()
    return JSONResponse({
        "relayvsr": status,
        "video_upscale": "relayvsr_x2" if status.get("available") else "off",
    })


@router.get("/comfy/progress/{job_id}")
async def comfy_progress(job_id: str):
    """Return the latest live progress for a generation job."""
    snap = get_progress(job_id)
    if not snap:
        return JSONResponse({
            "job_id": job_id,
            "state": "unknown",
            "workflow_percent": 0,
            "node_percent": 0,
        })
    return JSONResponse(snap)