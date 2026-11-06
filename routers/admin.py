import json
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from config import load_app_settings
from services.database_service import get_db

router = APIRouter()


@router.get("/admin/settings")
async def get_db_settings():
    """Return all settings key-value pairs."""
    conn = get_db()
    rows = conn.execute("SELECT key, value, updated_at FROM settings ORDER BY key").fetchall()
    conn.close()
    return {
        "settings": [
            {"key": r["key"], "value": r["value"], "updated_at": r["updated_at"]} for r in rows
        ]
    }


class UpdateSettingBody(BaseModel):
    key: str
    value: str


@router.post("/admin/update-setting")
async def update_setting(body: UpdateSettingBody):
    """Upsert a single settings key-value pair."""
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        (body.key, body.value),
    )
    conn.commit()
    conn.close()

    return {"success": True}


@router.get("/admin/generations")
async def get_db_generations():
    """Return all generations with metadata, newest first."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, type, prompt, filename, width, height, aspect_ratio, duration, "
        "parent_id, favorite, character, voice, metadata, created, last_updated FROM generations ORDER BY created DESC"
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        item = {
            "id": r["id"],
            "type": r["type"],
            "prompt": r["prompt"],
            "filename": r["filename"],
            "width": r["width"],
            "height": r["height"],
            "aspect_ratio": r["aspect_ratio"],
            "duration": r["duration"],
            "parent_id": r["parent_id"],
            "favorite": bool(r["favorite"]),
            "character": bool(r["character"]),
            "voice": bool(r["voice"]),
            "created": r["created"],
            "last_updated": r["last_updated"],
        }
        try:
            item["metadata"] = json.loads(r["metadata"]) if r["metadata"] else {}
        except Exception:
            item["metadata"] = {}
        result.append(item)
    return {"generations": result}


class UpdateGenerationBody(BaseModel):
    id: str
    prompt: Optional[str] = None
    filename: Optional[str] = None
    favorite: Optional[bool] = None
    character: Optional[bool] = None
    voice: Optional[bool] = None
    width: Optional[int] = None
    height: Optional[int] = None
    aspect_ratio: Optional[str] = None
    type: Optional[str] = None


@router.post("/admin/update-generation")
async def update_generation(body: UpdateGenerationBody):
    """Update editable fields on an existing generation."""
    conn = get_db()
    fields = []
    values = []
    if body.prompt is not None:
        fields.append("prompt = ?")
        values.append(body.prompt)
    if body.filename is not None:
        fields.append("filename = ?")
        values.append(body.filename)
    if body.favorite is not None:
        fields.append("favorite = ?")
        values.append(1 if body.favorite else 0)
    if body.character is not None:
        fields.append("character = ?")
        values.append(1 if body.character else 0)
    if body.voice is not None:
        fields.append("voice = ?")
        values.append(1 if body.voice else 0)
    if body.width is not None:
        fields.append("width = ?")
        values.append(body.width)
    if body.height is not None:
        fields.append("height = ?")
        values.append(body.height)
    if body.aspect_ratio is not None:
        fields.append("aspect_ratio = ?")
        values.append(body.aspect_ratio)
    if body.type is not None:
        fields.append("type = ?")
        values.append(body.type)
    if fields:
        fields.append("last_updated = datetime('now')")
        values.append(body.id)
        conn.execute(
            f"UPDATE generations SET {', '.join(fields)} WHERE id = ?", values
        )
        conn.commit()
    conn.close()
    return {"success": True}


class DeleteGenerationBody(BaseModel):
    id: str


@router.post("/admin/delete-generation")
async def delete_generation(body: DeleteGenerationBody):
    """Delete a single generation by id."""
    conn = get_db()
    conn.execute("DELETE FROM generations WHERE id = ?", (body.id,))
    conn.commit()
    conn.close()
    return {"success": True}


@router.post("/admin/generate-thumbnails")
async def generate_all_thumbnails():
    """Generate missing thumbnails for all generations."""
    from services.thumbnail_service import generate_missing_thumbnails
    result = generate_missing_thumbnails()
    return result
