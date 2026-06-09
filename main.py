import os
from fastapi import FastAPI, Request, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from datetime import datetime
from routers import generations, projects, story, uploads, settings
from config import (
    load_app_settings, 
    save_app_settings, 
    get_comfyui_url,
    get_ollama_settings,
    get_failed_gen_clear_seconds
)
from services.project_service import (
    load_projects,
    save_project,
    update_project,
    delete_project
)
from services.story_service import (
    ollama_story_breakdown,
    ollama_scene_prompt,
    ollama_generate
)
from services.generation_service import (
    load_generations,
    save_generation,
    update_generation,
    delete_generation,
    get_asset_by_id
)

import zipfile
from io import BytesIO
import re
import subprocess
import tempfile



from utils.comfy_client import (
    check_comfyui_connection, 
    generate_multiple_images, 
    generate_images_with_progress,
    generate_single_video,
    generate_videos_with_progress,
    generate_image_to_videos_with_progress,
    generate_single_image_to_video,
    generate_image_to_images_with_progress,
    generate_single_image_to_image,
    generate_image_audio_to_videos_with_progress,
    generate_single_image_audio_to_video,
    generate_double_image_to_image_with_progress,
    generate_double_image_to_image,
    fetch_comfy_models
)

app = FastAPI(title="Pulse Image")
app.mount("/images", StaticFiles(directory="images"), name="images")
app.mount("/videos", StaticFiles(directory="videos"), name="videos")
app.mount("/audio", StaticFiles(directory="audio"), name="audio")

app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/templates", StaticFiles(directory="templates"), name="templates")

app.include_router(projects.router)
app.include_router(uploads.router)
app.include_router(generations.router)
app.include_router(settings.router)
app.include_router(story.router)

# Ensure audio folder exists
os.makedirs("audio", exist_ok=True)
templates = Jinja2Templates(directory="templates")

async def ollama_chat(
    messages: list,
    model: str | None = None,
    timeout: int | None = None,
) -> dict:
    """
    Call Ollama /api/chat with a messages array (role/content).
    Returns {"text": str, "error": str|None} (text is the assistant content).
    """
    import httpx
    oll = get_ollama_settings()
    url = oll["url"]
    mdl = model or oll["model"]
    tmo = timeout or oll["timeout"]

    payload = {
        "model": mdl,
        "messages": messages,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=float(tmo)) as client:
            resp = await client.post(f"{url}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            msg = data.get("message") or {}
            text = (msg.get("content") or "").strip()
            return {"text": text, "error": None}
    except httpx.HTTPStatusError as e:
        return {"text": "", "error": f"Ollama HTTP {e.response.status_code}: {e.response.text[:300]}"}
    except Exception as e:
        return {"text": "", "error": f"Ollama chat failed ({type(e).__name__}): {e}"}

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

async def check_ollama_connection() -> bool:
    """Check if Ollama server is reachable (uses /api/tags)."""
    try:
        oll = get_ollama_settings()
        import httpx
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{oll['url']}/api/tags")
            return response.status_code == 200
    except Exception:
        return False

async def fetch_ollama_models() -> list[str]:
    """Query Ollama for installed models via /api/tags. Returns list of model names (e.g. 'qwen3:8b')."""
    try:
        oll = get_ollama_settings()
        import httpx
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"{oll['url']}/api/tags")
            if resp.status_code == 200:
                data = resp.json() or {}
                models = []
                for m in (data.get("models") or []):
                    # Ollama returns objects with "name"
                    name = m.get("name") if isinstance(m, dict) else None
                    if name and isinstance(name, str):
                        models.append(name)
                # Also support older shape where it might be a flat list of strings
                if not models and isinstance(data.get("models"), list):
                    for m in data["models"]:
                        if isinstance(m, str):
                            models.append(m)
                return sorted(set(models))
    except Exception as e:
        print(f"[ollama] fetch models error: {e}")
    return []

@app.get("/comfy/status")
async def comfy_status():
    """Endpoint to check if ComfyUI is running"""
    is_connected = await check_comfyui_connection()
    return JSONResponse({
        "connected": is_connected,
        "url": get_comfyui_url()
    })

@app.get("/ollama/status")
async def ollama_status():
    """Endpoint to check if Ollama is running and report current config."""
    connected = await check_ollama_connection()
    oll = get_ollama_settings()
    return JSONResponse({
        "connected": connected,
        "url": oll["url"],
        "model": oll["model"],
        "timeout": oll["timeout"]
    })

@app.get("/ollama/models")
async def ollama_models_endpoint(refresh: bool = False):
    """Return list of models available on the configured Ollama server."""
    models = await fetch_ollama_models()
    oll = get_ollama_settings()
    return JSONResponse({
        "models": models,
        "current_model": oll["model"],
        "url": oll["url"]
    })

@app.post("/ollama/enhance")
async def ollama_enhance_prompt(request: Request):
    """Enhance a user prompt using the selected style/enhancer text via Ollama.
    Expects {prompt: str, enhancer: str}. Returns {enhanced: str, error?: str}
    """
    try:
        data = await request.json()
        original = (data.get("prompt") or "").strip()
        enhancer = (data.get("enhancer") or "").strip()
        if not original:
            return {"enhanced": original}
        oll = get_ollama_settings()
        system = (
            "You are an expert prompt engineer for text-to-image and text-to-video models "
            "(Flux, SDXL, etc). Your job is to take the user's base subject prompt and "
            "seamlessly incorporate the provided style/direction instructions to make a "
            "more vivid, detailed, and effective prompt. Preserve the core subject, action, "
            "and composition. Output ONLY the final enhanced prompt as one clean paragraph. "
            "No explanations, no prefixes, no quotation marks."
        )
        user = f"Style / Direction to apply: {enhancer}\n\nBase prompt: {original}\n\nEnhanced prompt:"
        res = await ollama_generate(
            prompt=user,
            system=system,
            expect_json=False,
        )
        enhanced = (res.get("text") or original).strip()
        # sanitize common model artifacts
        if enhanced.startswith('"') and enhanced.endswith('"'):
            enhanced = enhanced[1:-1].strip()
        if enhanced.lower().startswith("enhanced prompt:"):
            enhanced = enhanced.split(":", 1)[1].strip()
        return {"enhanced": enhanced or original}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"enhanced": original, "error": str(e)}

@app.post("/chat")
async def chat_send(request: Request):
    """
    Simple chat endpoint for the new Chat mode.
    Accepts {prompt, history?, attachment?} where attachment = {name, content}.
    Builds a messages list (system + optional doc context + history + user) and
    calls the live Ollama settings via /api/chat.
    """
    try:
        data = await request.json()
        prompt = (data.get("prompt") or "").strip()
        history = data.get("history") or []
        attachment = data.get("attachment") or None

        if not prompt:
            return JSONResponse({"success": False, "error": "prompt required"}, status_code=400)

        messages = []

        sys = "You are a helpful AI assistant."
        if attachment and attachment.get("content"):
            doc_name = attachment.get("name", "document")
            doc_text = str(attachment.get("content", ""))[:12000]
            sys += f"\n\nThe user attached a document named \"{doc_name}\". Use its content to answer:\n{doc_text}"

        messages.append({"role": "system", "content": sys})

        for h in history:
            if isinstance(h, dict) and h.get("role") in ("user", "assistant") and h.get("content"):
                messages.append({"role": h["role"], "content": h["content"]})

        messages.append({"role": "user", "content": prompt})

        res = await ollama_chat(messages)
        text = res.get("text", "")
        err = res.get("error")

        if err:
            return JSONResponse({"success": False, "error": err})

        return {"success": True, "response": text}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

@app.on_event("startup")
async def on_startup():
    """Fetch available LoRAs from ComfyUI at server startup so settings can list them."""
    global available_loras
    try:
        from utils.comfy_client import fetch_loras_from_comfy
        available_loras = await fetch_loras_from_comfy()
        print(f"[startup] Loaded {len(available_loras)} LoRAs from ComfyUI (via /models/loras or fallback)")
    except Exception as e:
        print(f"[startup] LoRA fetch error (will retry on /loras refresh): {e}")






       