import uuid
import json
from datetime import datetime
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from services.database_service import get_db
from services.ollama_service import ollama_chat

router = APIRouter()

@router.get("/chat/sessions")
async def list_sessions():
    """Return all chat sessions, newest first."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, title, created FROM chat_sessions ORDER BY created DESC"
    ).fetchall()
    conn.close()
    return [{"id": r["id"], "title": r["title"], "created": r["created"]} for r in rows]

@router.post("/chat/sessions")
async def create_session():
    """Create a new chat session and return its id."""
    sid = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO chat_sessions (id, title) VALUES (?, ?)",
        (sid, "New Chat")
    )
    conn.commit()
    conn.close()
    return {"id": sid, "title": "New Chat", "created": datetime.utcnow().isoformat()}

@router.post("/chat/sessions/{session_id}/delete")
async def delete_session(session_id: str):
    """Delete a chat session and all its messages."""
    conn = get_db()
    conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()
    return {"success": True}

@router.put("/chat/sessions/{session_id}/title")
async def update_session_title(session_id: str, request: Request):
    """Update the title of a chat session."""
    data = await request.json()
    title = (data.get("title") or "").strip()
    if not title:
        return JSONResponse({"success": False, "error": "title required"}, status_code=400)
    conn = get_db()
    conn.execute("UPDATE chat_sessions SET title = ? WHERE id = ?", (title, session_id))
    conn.commit()
    conn.close()
    return {"success": True}

@router.get("/chat/sessions/{session_id}/messages")
async def get_session_messages(session_id: str):
    """Return all messages for a chat session, oldest first."""
    conn = get_db()
    rows = conn.execute(
        "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC",
        (session_id,)
    ).fetchall()
    conn.close()
    return [{"role": r["role"], "content": r["content"]} for r in rows]

@router.post("/chat/sessions/{session_id}/messages")
async def save_session_messages(session_id: str, request: Request):
    """Save a batch of messages to a chat session."""
    data = await request.json()
    messages = data.get("messages", [])
    if not messages:
        return JSONResponse({"success": False, "error": "messages required"}, status_code=400)
    conn = get_db()
    for m in messages:
        role = m.get("role")
        content = m.get("content")
        if role and content:
            conn.execute(
                "INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)",
                (session_id, role, content)
            )
    conn.commit()
    conn.close()
    return {"success": True}

@router.post("/chat/sessions/{session_id}/auto-title")
async def auto_title_session(session_id: str):
    """Ask Ollama to generate a short title based on the first user message."""
    conn = get_db()
    row = conn.execute(
        "SELECT content FROM chat_messages WHERE session_id = ? AND role = 'user' ORDER BY timestamp ASC LIMIT 1",
        (session_id,)
    ).fetchone()
    if not row:
        conn.close()
        return {"success": False, "error": "no messages"}
    first_prompt = row["content"][:200]
    try:
        messages = [
            {"role": "system", "content": "Generate a very short title (max 6 words, no quotes) for this chat conversation based on the user's first message. Reply with only the title."},
            {"role": "user", "content": first_prompt}
        ]
        res = await ollama_chat(messages)
        title = (res.get("text") or "").strip().strip('"').strip("'")[:60]
        if not title:
            title = "Chat"
        conn.execute("UPDATE chat_sessions SET title = ? WHERE id = ?", (title, session_id))
        conn.commit()
        conn.close()
        return {"success": True, "title": title}
    except Exception as e:
        conn.close()
        return {"success": False, "error": str(e)}
