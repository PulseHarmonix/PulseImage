from fastapi import APIRouter
from fastapi.responses import JSONResponse

from config import get_comfyui_url
from services.comfy_service import check_comfyui_connection

router = APIRouter()

@router.get("/comfy/status")
async def comfy_status():
    """Endpoint to check if ComfyUI is running"""
    is_connected = await check_comfyui_connection()
    return JSONResponse({
        "connected": is_connected,
        "url": get_comfyui_url()
    })