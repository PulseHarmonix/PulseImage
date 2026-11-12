"""Character profile endpoints.

Characters are Library image assets flagged with ``character = 1``; profile
details are stored under ``metadata.character_profile``.
"""
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from services.character_service import (
    CharacterError,
    get_character,
    list_characters,
    update_character,
)

router = APIRouter()


def _error(exc: Exception) -> JSONResponse:
    if isinstance(exc, CharacterError):
        return JSONResponse({"error": str(exc)}, status_code=exc.status_code)
    return JSONResponse({"error": str(exc)}, status_code=500)


@router.get("/characters")
async def get_characters():
    """List every character-flagged Library image asset."""
    return {"characters": list_characters()}


@router.get("/characters/{asset_id}")
async def get_character_profile(asset_id: str):
    """Return one character and its stored profile."""
    character = get_character(asset_id)
    if not character:
        return JSONResponse({"error": "Character not found"}, status_code=404)
    return {"character": character}


@router.post("/characters/{asset_id}")
async def set_character_profile(asset_id: str, request: Request):
    """Merge profile fields into a character asset and flag it as a character."""
    try:
        data = await request.json()
    except Exception:
        data = {}
    try:
        character = update_character(asset_id, data or {})
    except Exception as exc:
        return _error(exc)
    return {"character": character}
