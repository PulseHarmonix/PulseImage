import uuid
import json
import os
import re
import sqlite3
from datetime import datetime
from fastapi import APIRouter, Request, UploadFile, File
from fastapi.responses import JSONResponse
from services.database_service import get_db
from services.director_agent import process_director_message
from services.generation_service import save_generation

router = APIRouter()


def _row_to_dict(row: sqlite3.Row) -> dict:
    """Convert a sqlite3.Row to a plain dict."""
    return dict(row)


@router.post("/director/sessions")
async def create_director_session():
    """Create a new director session."""
    sid = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    conn = get_db()
    conn.execute(
        "INSERT INTO director_sessions (id, title, created, last_updated) VALUES (?, ?, ?, ?)",
        (sid, "New Director Session", now, now)
    )
    conn.commit()
    conn.close()
    return {"id": sid, "title": "New Director Session", "created": now, "last_updated": now}


@router.get("/director/sessions")
async def list_director_sessions():
    """List all director sessions, newest first."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, title, settings, main_audio_id, created, last_updated FROM director_sessions ORDER BY last_updated DESC"
    ).fetchall()
    conn.close()
    return {"sessions": [_row_to_dict(r) for r in rows]}


@router.get("/director/sessions/{session_id}")
async def get_director_session(session_id: str):
    """Return a director session with scenes, messages, and assets."""
    conn = get_db()
    row = conn.execute(
        "SELECT id, title, settings, main_audio_id, created, last_updated FROM director_sessions WHERE id = ?",
        (session_id,)
    ).fetchone()
    if not row:
        conn.close()
        return JSONResponse({"error": "Session not found"}, status_code=404)

    session = _row_to_dict(row)

    # Load scenes
    scenes = conn.execute(
        "SELECT id, session_id, scene_number, start_time, duration, description, characters, "
        "generated_prompt, candidate_images, selected_image_id, video_id, video_duration, "
        "audio_muted, dialogue, lora_name, lora_strength, status "
        "FROM director_scenes WHERE session_id = ? ORDER BY scene_number ASC",
        (session_id,)
    ).fetchall()
    session["scenes"] = [_row_to_dict(s) for s in scenes]

    # Load messages (last 50)
    msgs = conn.execute(
        "SELECT id, session_id, role, content, scene_data, asset_ids, timestamp "
        "FROM director_messages WHERE session_id = ? ORDER BY timestamp ASC LIMIT 50",
        (session_id,)
    ).fetchall()
    session["messages"] = [_row_to_dict(m) for m in msgs]

    # Load available assets
    assets = conn.execute(
        "SELECT id, session_id, asset_id, type, filename FROM director_available_assets WHERE session_id = ?",
        (session_id,)
    ).fetchall()
    session["available_assets"] = [_row_to_dict(a) for a in assets]

    # Parse JSON fields
    try:
        session["settings"] = json.loads(session["settings"]) if isinstance(session["settings"], str) else session["settings"]
    except Exception:
        session["settings"] = {}
    for s in session["scenes"]:
        for f in ("characters", "candidate_images"):
            try:
                s[f] = json.loads(s[f]) if isinstance(s[f], str) else s[f]
            except Exception:
                s[f] = []
    for m in session["messages"]:
        for f in ("scene_data", "asset_ids"):
            try:
                m[f] = json.loads(m[f]) if isinstance(m[f], str) else m[f]
            except Exception:
                m[f] = {} if f == "scene_data" else []

    conn.close()
    return session


@router.post("/director/sessions/{session_id}/chat")
async def director_chat(session_id: str, request: Request):
    """Process a chat message in a director session via the agent."""
    body = await request.json()
    user_message = body.get("message", "").strip()
    if not user_message:
        return JSONResponse({"error": "message is required"}, status_code=400)

    conn = get_db()

    # Verify session exists
    row = conn.execute("SELECT id, settings FROM director_sessions WHERE id = ?", (session_id,)).fetchone()
    if not row:
        conn.close()
        return JSONResponse({"error": "Session not found"}, status_code=404)

    # Use settings from request body (hot off the frontend), fall back to DB
    request_settings = body.get("settings")
    if request_settings and isinstance(request_settings, dict) and request_settings.get("loras"):
        settings = request_settings
    else:
        try:
            settings = json.loads(row["settings"]) if isinstance(row["settings"], str) else {}
        except Exception:
            settings = {}

    # Auto-title from first user message
    title_row = conn.execute("SELECT title FROM director_sessions WHERE id = ?", (session_id,)).fetchone()
    if title_row and title_row["title"] == "New Director Session":
        auto_title = user_message[:60] + ("..." if len(user_message) > 60 else "")
        conn.execute("UPDATE director_sessions SET title = ? WHERE id = ?", (auto_title, session_id))

    # Save user message
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO director_messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
        (session_id, "user", user_message, now)
    )

    # Load conversation history for the agent
    msg_rows = conn.execute(
        "SELECT role, content FROM director_messages WHERE session_id = ? ORDER BY timestamp ASC",
        (session_id,)
    ).fetchall()
    messages = [{"role": m["role"], "content": m["content"]} for m in msg_rows]

    # Process via agent (keep conn open for possible [GENERATE] block)
    response_text, debug_messages = await process_director_message(messages, settings)
    raw_response = response_text  # capture before [GENERATE] stripping

    # Check for [GENERATE] marker
    generate_data = None
    generate_marker = "[GENERATE]"
    if generate_marker in response_text:
        parts = response_text.split(generate_marker, 1)
        clean_text = parts[0].strip()
        json_part = parts[1].strip()
        # Strip markdown code fences if present
        json_part = re.sub(r'^```(?:json)?\s*', '', json_part)
        json_part = re.sub(r'\s*```$', '', json_part)
        # Log what we're about to parse for debugging
        debug_messages.append({"role": "system", "content": f"[GENERATE] json_part[:500]: {json_part[:500]}"})
        # Extract the first complete JSON object using raw_decode
        # (handles braces inside strings, trailing text, etc.)
        generate_data = None
        brace_start = json_part.find('{')
        if brace_start >= 0:
            try:
                decoder = json.JSONDecoder()
                generate_data, _ = decoder.raw_decode(json_part, brace_start)
            except json.JSONDecodeError as e1:
                debug_messages.append({"role": "system", "content": f"[GENERATE] raw_decode error: {e1}"})
                # Try to repair common LLM mistake: settings placed inside scenes array
                # e.g. {"scenes":[{...},"settings":{...}]}  → {"scenes":[{...}],"settings":{...}}
                json_part, count = re.subn(r'\},\s*"settings"\s*:\s*\{', r'}],"settings":{', json_part)
                debug_messages.append({"role": "system", "content": f"[GENERATE] re.subn count: {count}"})
                if count:
                    # Step 2: remove the now-dangling ] between settings-close and root-close
                    # Pattern: }]}  →  }}   (settings-close + dangling scenes-close + root-close)
                    json_part = json_part.replace('}]}', '}}')
                    debug_messages.append({"role": "system", "content": f"[GENERATE] After step2, ends with: ...{json_part[-80:]}"})
                try:
                    decoder = json.JSONDecoder()
                    generate_data, _ = decoder.raw_decode(json_part, brace_start)
                    debug_messages.append({"role": "system", "content": "[GENERATE] Recovered by moving settings outside scenes array"})
                except json.JSONDecodeError as e2:
                    debug_messages.append({"role": "system", "content": f"[GENERATE] Second raw_decode also failed: {e2}"})
                    ctx = json_part[max(0, e2.pos-40):e2.pos+40]
                    debug_messages.append({"role": "system", "content": f"[GENERATE] Context at error: ...{ctx}..."})
        if generate_data is None:
            debug_messages.append({"role": "system", "content": f"[GENERATE] JSON parse failed. Raw:\n{parts[1].strip()[:2000]}"})

        if generate_data:
            debug_messages.append({"role": "system", "content": f"[GENERATE] Parsed successfully. {len(generate_data.get('scenes',[]))} scenes. Settings: {json.dumps(generate_data.get('settings',{}))}"})

        if generate_data and "scenes" in generate_data and len(generate_data["scenes"]):
            # Replace existing scenes — clear old ones first
            conn.execute("DELETE FROM director_scenes WHERE session_id = ?", (session_id,))
            session_lora = settings.get("loras", [])
            default_lora = (session_lora[0] if isinstance(session_lora, list) and session_lora else None) or None
            for i, sc in enumerate(generate_data["scenes"]):
                scene_id = str(uuid.uuid4())
                sc["id"] = scene_id
                sc_lora = sc.get("lora_name") or default_lora
                if isinstance(sc_lora, dict):
                    sc_lora = sc_lora.get("name", "")
                sc["lora_name"] = str(sc_lora) if sc_lora else None
                conn.execute(
                    """INSERT INTO director_scenes
                       (id, session_id, scene_number, duration, description, generated_prompt, start_time, status, lora_name)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (scene_id, session_id,
                     sc.get("scene_number", i + 1),
                     sc.get("duration", 5),
                     sc.get("description", ""),
                     sc.get("prompt", ""),
                     sc.get("start_time", 0),
                     "pending",
                     str(sc_lora) if sc_lora else None)
                )
            # Apply any settings the agent returned
            if "settings" in generate_data and isinstance(generate_data["settings"], dict):
                try:
                    current = json.loads(row["settings"]) if isinstance(row["settings"], str) else {}
                except Exception:
                    current = {}
                current.update(generate_data["settings"])
                conn.execute("UPDATE director_sessions SET settings = ? WHERE id = ?", (json.dumps(current), session_id))
                settings = current
            conn.commit()
            response_text = clean_text

    # === [SCENES] marker: delete/regenerate individual scenes ===
    scene_actions = None
    scenes_marker = "[SCENES]"
    if scenes_marker in response_text:
        sc_parts = response_text.split(scenes_marker, 1)
        response_text = sc_parts[0].strip()
        try:
            sc_json = sc_parts[1].strip()
            sc_json = re.sub(r'^```(?:json)?\s*', '', sc_json)
            sc_json = re.sub(r'\s*```$', '', sc_json)
            sc_json, _ = re.subn(r'\},\s*"actions"\s*:\s*\[', r'}],"actions":[', sc_json)
            brace_start = sc_json.find('{')
            if brace_start >= 0:
                decoder = json.JSONDecoder()
                sc_data, _ = decoder.raw_decode(sc_json, brace_start)
            else:
                sc_data = json.loads(sc_json)
            if sc_data and "actions" in sc_data:
                scene_actions = []
                for act in sc_data["actions"]:
                    sn = act.get("scene_number")
                    action = act.get("action", "")
                    if not sn or action not in ("delete", "regenerate"):
                        continue
                    row_sc = conn.execute(
                        "SELECT id, scene_number FROM director_scenes WHERE session_id = ? AND scene_number = ?",
                        (session_id, sn)
                    ).fetchone()
                    if not row_sc:
                        continue
                    if action == "delete":
                        deleted_num = row_sc["scene_number"]
                        conn.execute("DELETE FROM director_scenes WHERE id = ?", (row_sc["id"],))
                        conn.execute("UPDATE director_scenes SET scene_number = scene_number - 1 WHERE session_id = ? AND scene_number > ?",
                                   (session_id, deleted_num))
                        scene_actions.append({"scene_number": sn, "action": "delete"})
                    elif action == "regenerate":
                        conn.execute(
                            "UPDATE director_scenes SET candidate_images = '[]', selected_image_id = NULL, status = 'pending' WHERE id = ?",
                            (row_sc["id"],))
                        scene_actions.append({"scene_number": sn, "action": "regenerate", "scene_id": row_sc["id"]})
                conn.commit()
                debug_messages.append({"role": "system", "content": f"[SCENES] Processed {len(scene_actions)} actions"})
        except Exception as e:
            debug_messages.append({"role": "system", "content": f"[SCENES] Parse error: {e}"})

    # === [ANIMATE] marker: generate videos from scene images ===
    animate_data = None
    animate_marker = "[ANIMATE]"
    if animate_marker in response_text:
        an_parts = response_text.split(animate_marker, 1)
        response_text = an_parts[0].strip()
        try:
            an_json = an_parts[1].strip()
            an_json = re.sub(r'^```(?:json)?\s*', '', an_json)
            an_json = re.sub(r'\s*```$', '', an_json)
            brace_start = an_json.find('{')
            if brace_start >= 0:
                decoder = json.JSONDecoder()
                animate_data, _ = decoder.raw_decode(an_json, brace_start)
            else:
                animate_data = json.loads(an_json)
        except Exception:
            animate_data = {"mode": "image_to_video"}
        debug_messages.append({"role": "system", "content": "[ANIMATE] Video generation requested"})

    # Log the raw Ollama response in debug messages (before [GENERATE] strip)
    debug_messages.append({"role": "system", "content": f"RAW OLLAMA RESPONSE:\n{raw_response[:3000]}"})

    # Save assistant response
    now = datetime.utcnow().isoformat()
    conn.execute(
        "INSERT INTO director_messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
        (session_id, "assistant", response_text, now)
    )
    conn.execute(
        "UPDATE director_sessions SET last_updated = ? WHERE id = ?",
        (now, session_id)
    )
    # Persist frontend-provided settings back to DB (keeps DB in sync after processing)
    if request_settings and isinstance(request_settings, dict):
        try:
            current = json.loads(row["settings"]) if isinstance(row["settings"], str) else {}
        except Exception:
            current = {}
        current.update(settings)
        conn.execute("UPDATE director_sessions SET settings = ? WHERE id = ?", (json.dumps(current), session_id))
    conn.commit()
    conn.close()

    result = {"response": response_text, "settings": settings, "debug_messages": debug_messages}
    if generate_data and "scenes" in generate_data:
        result["scenes"] = generate_data["scenes"]
        result["generate"] = True
    if scene_actions:
        result["scene_actions"] = scene_actions
    if animate_data:
        result["animate"] = True
        result["animate_mode"] = animate_data.get("mode", "image_to_video")
    return result


@router.post("/director/sessions/{session_id}/settings")
async def update_director_settings(session_id: str, request: Request):
    """Update the settings for a director session."""
    body = await request.json()
    settings = body.get("settings", {})

    conn = get_db()
    row = conn.execute("SELECT id, settings FROM director_sessions WHERE id = ?", (session_id,)).fetchone()
    if not row:
        conn.close()
        return JSONResponse({"error": "Session not found"}, status_code=404)

    try:
        current = json.loads(row["settings"]) if isinstance(row["settings"], str) else {}
    except Exception:
        current = {}

    current.update(settings)
    settings_json = json.dumps(current)

    conn.execute(
        "UPDATE director_sessions SET settings = ?, last_updated = ? WHERE id = ?",
        (settings_json, datetime.utcnow().isoformat(), session_id)
    )
    conn.commit()
    conn.close()

    return {"success": True, "settings": current}


@router.post("/director/sessions/{session_id}/scene")
async def create_director_scene(session_id: str, request: Request):
    """Create or update a scene in a director session."""
    body = await request.json()
    scene_id = body.get("id", str(uuid.uuid4()))
    scene_number = body.get("scene_number", 1)
    description = body.get("description", "")
    duration = body.get("duration", 5)
    start_time = body.get("start_time", 0)
    lora_name = body.get("lora_name")
    lora_strength = body.get("lora_strength", 0.6)
    dialogue = body.get("dialogue", "")
    characters = json.dumps(body.get("characters", []))

    conn = get_db()
    # Check if scene exists (update) or create new
    existing = conn.execute("SELECT id FROM director_scenes WHERE id = ?", (scene_id,)).fetchone()
    if existing:
        conn.execute(
            """UPDATE director_scenes SET scene_number=?, description=?, duration=?, start_time=?,
               lora_name=?, lora_strength=?, dialogue=?, characters=? WHERE id=?""",
            (scene_number, description, duration, start_time, lora_name, lora_strength, dialogue, characters, scene_id)
        )
    else:
        conn.execute(
            """INSERT INTO director_scenes (id, session_id, scene_number, description, duration, start_time,
               lora_name, lora_strength, dialogue, characters) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (scene_id, session_id, scene_number, description, duration, start_time, lora_name, lora_strength, dialogue, characters)
        )

    conn.execute("UPDATE director_sessions SET last_updated = ? WHERE id = ?",
                 (datetime.utcnow().isoformat(), session_id))
    conn.commit()
    conn.close()

    return {"success": True, "id": scene_id}


@router.post("/director/sessions/{session_id}/scene/{scene_id}/delete")
async def delete_director_scene(session_id: str, scene_id: str):
    """Delete a scene and renumber remaining scenes."""
    conn = get_db()
    # Get the deleted scene's number for renumbering
    deleted = conn.execute("SELECT scene_number FROM director_scenes WHERE id = ? AND session_id = ?",
                           (scene_id, session_id)).fetchone()
    if not deleted:
        conn.close()
        return JSONResponse({"error": "Scene not found"}, status_code=404)
    deleted_num = deleted["scene_number"]
    conn.execute("DELETE FROM director_scenes WHERE id = ? AND session_id = ?", (scene_id, session_id))
    # Renumber remaining scenes after the deleted one
    conn.execute("UPDATE director_scenes SET scene_number = scene_number - 1 WHERE session_id = ? AND scene_number > ?",
                 (session_id, deleted_num))
    conn.execute("UPDATE director_sessions SET last_updated = ? WHERE id = ?",
                 (datetime.utcnow().isoformat(), session_id))
    conn.commit()
    conn.close()
    return {"success": True, "deleted_scene_number": deleted_num}


@router.post("/director/sessions/{session_id}/scene/reorder")
async def reorder_director_scenes(session_id: str, request: Request):
    """Reorder scenes by assigning new scene numbers."""
    body = await request.json()
    order = body.get("order", [])
    conn = get_db()
    for i, scene_id in enumerate(order):
        conn.execute("UPDATE director_scenes SET scene_number = ? WHERE id = ? AND session_id = ?",
                     (i + 1, scene_id, session_id))
    conn.execute("UPDATE director_sessions SET last_updated = ? WHERE id = ?",
                 (datetime.utcnow().isoformat(), session_id))
    conn.commit()
    conn.close()
    return {"success": True}


@router.post("/director/sessions/{session_id}/available-assets")
async def add_director_available_asset(session_id: str, request: Request):
    """Add an available asset reference to a director session."""
    body = await request.json()
    asset_id = body.get("asset_id")
    asset_type = body.get("type", "image")
    filename = body.get("filename", "")

    aid = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO director_available_assets (id, session_id, asset_id, type, filename) VALUES (?, ?, ?, ?, ?)",
        (aid, session_id, asset_id, asset_type, filename)
    )
    conn.commit()
    conn.close()
    return {"success": True, "id": aid}


@router.post("/director/sessions/{session_id}/available-assets/remove")
async def remove_director_available_asset(session_id: str, request: Request):
    """Remove an available asset reference from a director session."""
    body = await request.json()
    asset_id = body.get("asset_id")
    conn = get_db()
    conn.execute("DELETE FROM director_available_assets WHERE session_id = ? AND asset_id = ?",
                 (session_id, asset_id))
    conn.commit()
    conn.close()
    return {"success": True}


@router.post("/director/sessions/{session_id}/title")
async def update_director_session_title(session_id: str, request: Request):
    """Update the title of a director session."""
    body = await request.json()
    title = body.get("title", "").strip()
    if not title:
        return JSONResponse({"error": "title is required"}, status_code=400)
    conn = get_db()
    conn.execute("UPDATE director_sessions SET title = ?, last_updated = ? WHERE id = ?",
                 (title, datetime.utcnow().isoformat(), session_id))
    conn.commit()
    conn.close()
    return {"success": True, "title": title}


@router.post("/director/sessions/{session_id}/upload")
async def upload_director_asset(session_id: str, file: UploadFile = File(...)):
    """Upload a file and add it as an available asset for this session."""
    allowed = ("image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm", "audio/mpeg", "audio/wav", "audio/ogg")
    if file.content_type not in allowed:
        return JSONResponse({"error": f"Unsupported type: {file.content_type}"}, status_code=400)

    ext_map = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
               "video/mp4": "mp4", "video/webm": "webm",
               "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg"}
    ext = ext_map.get(file.content_type, "bin")
    asset_type = "image" if file.content_type.startswith("image") else ("video" if file.content_type.startswith("video") else "audio")

    filename = f"{uuid.uuid4()}.{ext}"
    folder = asset_type + "s"
    os.makedirs(folder, exist_ok=True)
    content = await file.read()
    with open(os.path.join(folder, filename), "wb") as f:
        f.write(content)

    aid = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO director_available_assets (id, session_id, asset_id, type, filename) VALUES (?, ?, ?, ?, ?)",
        (aid, session_id, aid, asset_type, filename)
    )
    conn.commit()
    conn.close()
    return {"success": True, "id": aid, "type": asset_type, "filename": filename}


@router.post("/director/sessions/{session_id}/scene/{scene_id}/save-image")
async def save_director_scene_image(session_id: str, scene_id: str, request: Request):
    """Save a generated image as a candidate for a scene."""
    body = await request.json()
    filename = body.get("filename", "")
    prompt = body.get("prompt", "")
    width = body.get("width", 0)
    height = body.get("height", 0)
    lora_name = body.get("lora_name")

    asset_id = save_generation(
        prompt=prompt,
        filename=filename,
        file_type="image",
        width=width,
        height=height,
        aspect_ratio=body.get("aspect_ratio", "16:9")
    )

    conn = get_db()
    scene = conn.execute("SELECT candidate_images FROM director_scenes WHERE id = ? AND session_id = ?",
                         (scene_id, session_id)).fetchone()
    if not scene:
        conn.close()
        return JSONResponse({"error": "Scene not found"}, status_code=404)

    candidates = json.loads(scene["candidate_images"]) if isinstance(scene["candidate_images"], str) else scene["candidate_images"] or []
    candidates.append(asset_id)

    update_fields = {"candidate_images": json.dumps(candidates), "status": "images_ready"}
    if lora_name:
        update_fields["lora_name"] = lora_name
    conn.execute(
        f"UPDATE director_scenes SET {', '.join(f'{k}=?' for k in update_fields)} WHERE id = ? AND session_id = ?",
        tuple(update_fields.values()) + (scene_id, session_id)
    )
    conn.execute("UPDATE director_sessions SET last_updated = ? WHERE id = ?",
                 (datetime.utcnow().isoformat(), session_id))
    conn.commit()
    conn.close()

    return {"success": True, "asset_id": asset_id, "candidates": candidates}


@router.post("/director/sessions/{session_id}/scene/{scene_id}/select-image")
async def select_director_scene_image(session_id: str, scene_id: str, request: Request):
    """Set the selected (approved) image for a scene."""
    body = await request.json()
    asset_id = body.get("asset_id")

    conn = get_db()
    conn.execute("UPDATE director_scenes SET selected_image_id = ?, status = ? WHERE id = ? AND session_id = ?",
                 (asset_id, "approved", scene_id, session_id))
    conn.execute("UPDATE director_sessions SET last_updated = ? WHERE id = ?",
                 (datetime.utcnow().isoformat(), session_id))
    conn.commit()
    conn.close()
    return {"success": True}


@router.post("/director/sessions/{session_id}/scene/{scene_id}/save-video")
async def save_director_scene_video(session_id: str, scene_id: str, request: Request):
    """Save a generated video for a scene."""
    body = await request.json()
    filename = body.get("filename", "")
    prompt = body.get("prompt", "")
    duration = body.get("duration", 0)
    width = body.get("width", 0)
    height = body.get("height", 0)
    parent_id = body.get("parent_id")

    asset_id = save_generation(
        prompt=prompt,
        filename=filename,
        file_type="video",
        width=width,
        height=height,
        duration=duration,
        parent_id=parent_id,
        derived_from=[parent_id] if parent_id else []
    )

    conn = get_db()
    conn.execute(
        "UPDATE director_scenes SET video_id = ?, video_duration = ?, status = 'has_video' WHERE id = ? AND session_id = ?",
        (asset_id, duration, scene_id, session_id)
    )
    conn.execute("UPDATE director_sessions SET last_updated = ? WHERE id = ?",
                 (datetime.utcnow().isoformat(), session_id))
    conn.commit()
    conn.close()

    return {"success": True, "asset_id": asset_id, "width": width, "height": height}


@router.post("/director/sessions/{session_id}/scene/{scene_id}/remove-candidate")
async def remove_director_scene_candidate(session_id: str, scene_id: str, request: Request):
    """Remove a candidate image from a scene (delete the asset, not the scene)."""
    body = await request.json()
    asset_id = body.get("asset_id")

    conn = get_db()
    scene = conn.execute("SELECT candidate_images, selected_image_id FROM director_scenes WHERE id = ? AND session_id = ?",
                         (scene_id, session_id)).fetchone()
    if not scene:
        conn.close()
        return JSONResponse({"error": "Scene not found"}, status_code=404)

    candidates = json.loads(scene["candidate_images"]) if isinstance(scene["candidate_images"], str) else scene["candidate_images"] or []
    if asset_id in candidates:
        candidates.remove(asset_id)

    new_selected = scene["selected_image_id"]
    if new_selected == asset_id:
        new_selected = candidates[0] if candidates else None

    conn.execute("UPDATE director_scenes SET candidate_images = ?, selected_image_id = ?, status = ? WHERE id = ? AND session_id = ?",
                 (json.dumps(candidates), new_selected, "approved" if new_selected else "images_ready" if candidates else "pending", scene_id, session_id))
    conn.execute("UPDATE director_sessions SET last_updated = ? WHERE id = ?",
                 (datetime.utcnow().isoformat(), session_id))
    conn.commit()
    conn.close()
    return {"success": True, "candidates": candidates, "selected_image_id": new_selected}


@router.delete("/director/sessions/{session_id}")
async def delete_director_session(session_id: str):
    """Delete a director session and all its associated data."""
    conn = get_db()
    conn.execute("DELETE FROM director_available_assets WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM director_messages WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM director_scenes WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM director_sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()
    return {"success": True}


@router.post("/director/sessions/{session_id}/add-message")
async def add_director_message(session_id: str, request: Request):
    """Add a message (user or assistant) to a director session."""
    body = await request.json()
    role = body.get("role", "assistant")
    content = body.get("content", "")
    if not content:
        return JSONResponse({"error": "content is required"}, status_code=400)
    now = datetime.utcnow().isoformat()
    conn = get_db()
    row = conn.execute("SELECT id FROM director_sessions WHERE id = ?", (session_id,)).fetchone()
    if not row:
        conn.close()
        return JSONResponse({"error": "Session not found"}, status_code=404)
    conn.execute(
        "INSERT INTO director_messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
        (session_id, role, content, now)
    )
    conn.execute("UPDATE director_sessions SET last_updated = ? WHERE id = ?", (now, session_id))
    conn.commit()
    conn.close()
    return {"success": True}
