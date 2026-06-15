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
    rows = conn.execute(
        "SELECT id, type, prompt, filename, width, height, aspect_ratio, duration, "
        "parent_id, favorite, metadata, created, last_updated FROM generations ORDER BY created DESC"
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
    width: Optional[int] = None
    height: Optional[int] = None
    aspect_ratio: Optional[str] = None
    type: Optional[str] = None


@router.post("/admin/update-generation")
async def update_generation(body: UpdateGenerationBody):
    """Update editable fields on an existing generation."""
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


@router.get("/admin/chat-sessions")
async def get_db_chat_sessions():
    """Return all chat sessions with their full message history."""
    rows = conn.execute(
        "SELECT id, title, created FROM chat_sessions ORDER BY created DESC"
    ).fetchall()
    sessions = []
    for r in rows:
        msgs = conn.execute(
            "SELECT id, role, content, timestamp FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC",
            (r["id"],)
        ).fetchall()
        sessions.append({
            "id": r["id"],
            "title": r["title"],
            "created": r["created"],
            "messages": [
                {"id": m["id"], "role": m["role"], "content": m["content"], "timestamp": m["timestamp"]}
                for m in msgs
            ]
        })
    conn.close()
    return {"sessions": sessions}


class DeleteChatSessionBody(BaseModel):
    id: str


@router.post("/admin/delete-chat-session")
async def delete_chat_session(body: DeleteChatSessionBody):
    """Delete a chat session and all its messages."""
    conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (body.id,))
    conn.execute("DELETE FROM chat_sessions WHERE id = ?", (body.id,))
    conn.commit()
    conn.close()
    return {"success": True}


class UpdateChatSessionBody(BaseModel):
    id: str
    key: str
    value: str


@router.post("/admin/update-chat-session")
async def update_chat_session(body: UpdateChatSessionBody):
    """Update a chat session's title or replace its messages."""
    if body.key == "title":
        conn.execute("UPDATE chat_sessions SET title = ? WHERE id = ?", (body.value, body.id))
    elif body.key == "messages":
        import json as _json
        try:
            msgs = _json.loads(body.value)
            if isinstance(msgs, list):
                conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (body.id,))
                for m in msgs:
                    role = m.get("role") if isinstance(m, dict) else None
                    content = m.get("content") if isinstance(m, dict) else None
                    cid = m.get("id") if isinstance(m, dict) else None
                    if role and content is not None:
                        if cid:
                            conn.execute(
                                "INSERT INTO chat_messages (id, session_id, role, content) VALUES (?, ?, ?, ?)",
                                (cid, body.id, role, content)
                            )
                        else:
                            conn.execute(
                                "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)",
                                (body.id, role, content)
                            )
        except Exception:
            pass
    conn.commit()
    conn.close()
    return {"success": True}


class DeleteDirectorSessionBody(BaseModel):
    id: str


@router.get("/admin/director-sessions")
async def get_db_director_sessions():
    """Return all director sessions with scenes and messages."""
    rows = conn.execute(
        "SELECT id, title, settings, main_audio_id, created, last_updated FROM director_sessions ORDER BY created DESC"
    ).fetchall()
    sessions = []
    for r in rows:
        scenes = conn.execute(
            "SELECT id, scene_number, start_time, duration, description, characters, generated_prompt, candidate_images, selected_image_id, video_id, video_duration, audio_muted, dialogue, lora_name, lora_strength, status FROM director_scenes WHERE session_id = ? ORDER BY scene_number ASC",
            (r["id"],)
        ).fetchall()
        msgs = conn.execute(
            "SELECT id, role, content, scene_data, asset_ids, timestamp FROM director_messages WHERE session_id = ? ORDER BY timestamp ASC",
            (r["id"],)
        ).fetchall()
        sessions.append({
            "id": r["id"],
            "title": r["title"],
            "settings": r["settings"],
            "main_audio_id": r["main_audio_id"],
            "created": r["created"],
            "last_updated": r["last_updated"],
            "scenes": [{k: s[k] for k in s.keys()} for s in scenes],
            "messages": [{k: m[k] for k in m.keys()} for m in msgs]
        })
    conn.close()
    return {"sessions": sessions}


class UpdateDirectorSessionBody(BaseModel):
    id: str
    key: str
    value: str


@router.post("/admin/update-director-session")
async def update_director_session(body: UpdateDirectorSessionBody):
    """Update a director session's title, settings, scenes, or messages."""
    if body.key == "title":
        conn.execute("UPDATE director_sessions SET title = ? WHERE id = ?", (body.value, body.id))
    elif body.key == "settings":
        conn.execute("UPDATE director_sessions SET settings = ? WHERE id = ?", (body.value, body.id))
    elif body.key == "scenes":
        import json as _json
        try:
            scs = _json.loads(body.value)
            if isinstance(scs, list):
                conn.execute("DELETE FROM director_scenes WHERE session_id = ?", (body.id,))
                for sc in scs:
                    conn.execute(
                        """INSERT INTO director_scenes
                           (id, session_id, scene_number, start_time, duration, description, characters,
                            generated_prompt, candidate_images, selected_image_id, status)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (sc.get("id", ""), body.id,
                         sc.get("scene_number", 1),
                         sc.get("start_time", 0),
                         sc.get("duration", 5),
                         sc.get("description", ""),
                         _json.dumps(sc.get("characters", [])),
                         sc.get("generated_prompt", ""),
                         _json.dumps(sc.get("candidate_images", [])),
                         sc.get("selected_image_id", ""),
                         sc.get("status", "draft"))
                    )
        except Exception:
            pass
    elif body.key == "messages":
        import json as _json
        try:
            msgs = _json.loads(body.value)
            if isinstance(msgs, list):
                conn.execute("DELETE FROM director_messages WHERE session_id = ?", (body.id,))
                for m in msgs:
                    conn.execute(
                        "INSERT INTO director_messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                        (body.id, m.get("role", ""), m.get("content", ""), m.get("timestamp", ""))
                    )
        except Exception:
            pass
    conn.commit()
    conn.close()
    return {"success": True}


@router.post("/admin/delete-director-session")
async def delete_director_session(body: DeleteDirectorSessionBody):
    """Delete a director session and all its scenes, messages, and assets."""
    conn.execute("DELETE FROM director_available_assets WHERE session_id = ?", (body.id,))
    conn.execute("DELETE FROM director_messages WHERE session_id = ?", (body.id,))
    conn.execute("DELETE FROM director_scenes WHERE session_id = ?", (body.id,))
    conn.execute("DELETE FROM director_sessions WHERE id = ?", (body.id,))
    conn.commit()
    conn.close()
    return {"success": True}
