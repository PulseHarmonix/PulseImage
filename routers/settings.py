import json
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from config import (
    load_app_settings,
    get_comfyui_url,
    get_ollama_settings,
)
from typing import Dict, Any
from services.settings_service import available_loras, refresh_loras
from services.database_service import get_db

router = APIRouter()

def _upsert_db(key: str, value: object) -> None:
    """Store a single setting key/value into the database."""
    val_str = json.dumps(value) if not isinstance(value, str) else value
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        (key, val_str),
    )
    conn.commit()
    conn.close()


@router.get("/settings")
async def get_settings():
    """Return all current application settings."""
    return load_app_settings()
    
@router.post("/settings")
async def post_settings(request: Request):
    """Update one or more application settings from the request body."""
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
            if "library_density" in data and data["library_density"] in ("full", "compact"):
                current["library_density"] = data["library_density"]
            if "library_filters" in data and isinstance(data.get("library_filters"), list):
                valid = [t for t in data["library_filters"] if t in ("image", "video", "audio")]
                current["library_filters"] = valid
            if "window_states" in data and isinstance(data.get("window_states"), dict):
                current["window_states"] = data["window_states"]
            if "theme" in data and isinstance(data["theme"], str):
                current["theme"] = data["theme"]
            if "customTheme" in data:
                current["customTheme"] = data["customTheme"]

            # Write each key from the incoming data to the database
            for key in data:
                if key in current:
                    _upsert_db(key, current[key])
        return {"success": True, "settings": current}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.get("/loras")
async def get_loras(refresh: bool = False):
    """Return cached LoRAs. Use ?refresh=true to re-query ComfyUI."""
    if refresh:
        loras = await refresh_loras()
        print(f"[loras] Refreshed to {len(loras)} LoRAs")
        return {"loras": loras}

    # Normal case - get current value
    from services.settings_service import available_loras
    return {"loras": available_loras or []}

@router.get("/comfy/models")
async def get_comfy_models():
    """Return available models from ComfyUI, categorized for the settings model checker.
    Returns {connected: bool, checkpoints: [...], loras: [...], vaes: [...], clips: [...], upscalers: [...] }
    """
    try:
        from services.comfy_service import fetch_comfy_models
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
