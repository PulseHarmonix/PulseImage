"""Text-to-speech endpoints."""
import json

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from services.tts_service import (
    generate_speech,
    get_engines,
    save_voice_metadata,
)

router = APIRouter()


@router.get("/tts/engines")
async def tts_engines():
    """Return the available TTS engines and their controls."""
    return await get_engines()


@router.post("/tts/generate")
async def tts_generate(request: Request):
    """Generate speech from text using a reference voice."""
    try:
        body = await request.body()
        data = json.loads(body.decode("utf-8", errors="ignore") or "{}")
        if not isinstance(data, dict):
            return JSONResponse(
                {"success": False, "error": "Invalid data format"}, status_code=400
            )

        result = await generate_speech(
            text=data.get("text", ""),
            voice_id=data.get("voice_id", ""),
            voice_filename=data.get("voice_filename", ""),
            engine=data.get("engine", "qwen3"),
            language=data.get("language", "English"),
            emotion=data.get("emotion", "neutral"),
            instruction=data.get("instruction", ""),
            ref_text=data.get("ref_text", ""),
            seed=data.get("seed", 0),
            job_id=data.get("job_id", ""),
        )
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/tts/voices/{asset_id}")
async def tts_save_voice(asset_id: str, request: Request):
    """Save voice-library metadata (transcript/language/engine) for an asset."""
    try:
        body = await request.body()
        data = json.loads(body.decode("utf-8", errors="ignore") or "{}")
        if not isinstance(data, dict):
            data = {}

        voice = save_voice_metadata(asset_id, data)
        if voice is None:
            return JSONResponse(
                {"success": False, "error": "Asset not found"}, status_code=404
            )
        return {"success": True, "voice": voice}
    except Exception as e:
        return {"success": False, "error": str(e)}
