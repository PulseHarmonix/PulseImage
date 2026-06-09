import json
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from config import (
    load_app_settings,
    save_app_settings,
    get_comfyui_url,
    get_ollama_settings,
)
from typing import Dict, Any

available_loras: list = []

router = APIRouter()

@router.get("/settings")
async def get_settings():
    return load_app_settings()
    
@router.post("/settings")
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

@router.get("/loras")
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

@router.get("/comfy/models")
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
