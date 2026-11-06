from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from config import get_ollama_settings
from services.ollama_service import (
    ollama_generate,
    check_ollama_connection,
    fetch_ollama_models,
)

router = APIRouter()

@router.get("/ollama/status")
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

@router.get("/ollama/models")
async def ollama_models_endpoint(refresh: bool = False):
    """Return list of models available on the configured Ollama server."""
    models = await fetch_ollama_models()
    oll = get_ollama_settings()
    return JSONResponse({
        "models": models,
        "current_model": oll["model"],
        "url": oll["url"]
    })

@router.post("/ollama/enhance")
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

