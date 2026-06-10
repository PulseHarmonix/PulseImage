from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from config import get_ollama_settings
from services.ollama_service import (
    ollama_chat,
    check_ollama_connection,
    fetch_ollama_models,
)
from services.story_service import ollama_generate   # used by enhance

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

@router.post("/chat")
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

