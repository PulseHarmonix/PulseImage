"""Story mode persistence and V1 generation helpers.

Story V1 flow: premise -> AI storyboard -> keyframes -> FastH3 clips -> ZIP.
Characters are existing Library image assets flagged with ``character = 1``.
"""
from __future__ import annotations

import io
import json
import os
import re
import shutil
import uuid
import zipfile
from datetime import datetime
from typing import Any, Optional

from services.database_service import get_db
from services.generation_service import get_asset_by_id, save_generation

DEFAULT_SETTINGS = {
    "video_model": "fasth3",
    "resolution": "720p",
    "aspect_ratio": "16:9",
    "style": "cinematic",
    "target_duration": 60,
}

CONTINUITY_MODES = (
    "new_scene",
    "same_scene_frame",
    "same_scene_video",
    "match_cut",
    "none",
    "cut",
)
DEFAULT_MANUAL_CONTINUITY = "new_scene"
FASTH3_MIN_SECONDS = 1.0
FASTH3_MAX_SECONDS = 15.0
STORY_MAX_SECONDS = 90.0
MAX_KEYFRAMES = 4
MAX_CHARACTER_REFS = 6
SCENE_ASSET_ROLES = ("background", "prop", "reference")
DEFAULT_SCENE_ASSET_ROLE = "background"


class StoryError(Exception):
    """Base error carrying an HTTP status for router responses."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


class StoryValidationError(StoryError):
    """Raised when an AI storyboard cannot be validated."""


class StoryGenerationError(StoryError):
    """Raised when a keyframe or clip generation step fails."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message, status_code)


# === Small helpers ===

def _now() -> str:
    return datetime.utcnow().isoformat()


def _parse_json(value: Any, default):
    if value is None:
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return default


def _as_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return ", ".join(part for part in (_as_text(v) for v in value) if part)
    return str(value).strip()


def _to_float(value: Any, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _to_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _normalize_id_list(raw) -> list[str]:
    """Normalize an array of asset IDs stored in JSON text columns."""
    data = _parse_json(raw, [])
    if isinstance(data, str):
        data = [data]
    if not isinstance(data, list):
        return []
    result: list[str] = []
    for item in data:
        if isinstance(item, dict):
            value = _as_text(item.get("id") or item.get("asset_id"))
        else:
            value = _as_text(item)
        if value and value not in result:
            result.append(value)
    return result


def _json_list(value) -> str:
    return json.dumps(_normalize_id_list(value))


def _json_dict(value) -> str:
    return json.dumps(value if isinstance(value, dict) else {})


def _profile_from_metadata(raw) -> dict:
    meta = _parse_json(raw, {})
    profile = meta.get("character_profile") if isinstance(meta, dict) else None
    return profile if isinstance(profile, dict) else {}


def _display_name(
    filename: str,
    prompt: str,
    role_name: str,
    profile: dict,
    metadata=None,
) -> str:
    """Prefer the character's Library/profile name over the generated filename."""
    stem = os.path.splitext(os.path.basename(filename or ""))[0]
    meta = _parse_json(metadata, {}) if metadata is not None else {}
    library_name = meta.get("name") if isinstance(meta, dict) else ""
    return _as_text(
        profile.get("name")
        or library_name
        or prompt
        or role_name
        or stem
    )


# === Story/cast/scene/shot serialization ===

def _story_dict(row) -> dict:
    data = dict(row)
    data["settings"] = _parse_json(data.get("settings"), dict(DEFAULT_SETTINGS))
    data["plan"] = _parse_json(data.get("plan"), {})
    return data


def _cast_entry(row) -> dict:
    data = dict(row)
    profile = _profile_from_metadata(data.get("metadata"))
    filename = data.get("filename") or ""
    prompt = data.get("prompt") or ""
    role_name = data.get("role_name") or ""
    return {
        "character_asset_id": data.get("character_asset_id") or "",
        "role_name": role_name,
        "notes": data.get("notes") or "",
        "name": _display_name(filename, prompt, role_name, profile, data.get("metadata")),
        "filename": filename,
        "profile": profile,
    }


def _scene_dict(row, assets: Optional[list[dict]] = None) -> dict:
    data = dict(row)
    data["shots"] = []
    data["assets"] = assets or []
    data["anchor_frames"] = _parse_json(data.get("anchor_frames"), [])
    if not isinstance(data["anchor_frames"], list):
        data["anchor_frames"] = []
    frame_index = data.get("anchor_frame_index")
    try:
        data["anchor_frame_index"] = int(frame_index) if frame_index is not None else None
    except (TypeError, ValueError):
        data["anchor_frame_index"] = None
    for key in (
        "props",
        "lighting",
        "weather",
        "palette",
        "negative_prompt",
        "anchor_source_video",
        "anchor_cache_key",
    ):
        data.setdefault(key, "")
    return data


def _scene_asset_dict(row) -> dict:
    data = dict(row)
    return {
        "id": data.get("id") or "",
        "scene_id": data.get("scene_id") or "",
        "asset_id": data.get("asset_id") or "",
        "role": data.get("role") or DEFAULT_SCENE_ASSET_ROLE,
        "label": data.get("label") or "",
        "notes": data.get("notes") or "",
        "created": data.get("created") or "",
        "last_updated": data.get("last_updated") or "",
        "filename": data.get("filename") or "",
        "prompt": data.get("prompt") or "",
        "metadata": _parse_json(data.get("metadata"), {}),
        "width": _to_int(data.get("width"), 0),
        "height": _to_int(data.get("height"), 0),
    }


def _shot_dict(row) -> dict:
    data = dict(row)
    data["duration"] = _to_float(data.get("duration"), 6.0)
    data["character_asset_ids"] = _normalize_id_list(data.get("character_asset_ids"))
    data["candidate_image_ids"] = _normalize_id_list(data.get("candidate_image_ids"))
    data["settings"] = _parse_json(data.get("settings"), {})
    return data


def _get_cast(conn, story_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT c.character_asset_id, c.role_name, c.notes, "
        "g.filename, g.prompt, g.metadata "
        "FROM story_cast c LEFT JOIN generations g ON g.id = c.character_asset_id "
        "WHERE c.story_id = ? ORDER BY c.role_name COLLATE NOCASE ASC",
        (story_id,),
    ).fetchall()
    return [_cast_entry(r) for r in rows]


def _get_scene_assets(conn, scene_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT sa.*, g.filename, g.prompt, g.metadata, g.width, g.height "
        "FROM story_scene_assets sa "
        "LEFT JOIN generations g ON g.id = sa.asset_id "
        "WHERE sa.scene_id = ? ORDER BY sa.created ASC",
        (scene_id,),
    ).fetchall()
    return [_scene_asset_dict(r) for r in rows]


def _get_scene(conn, story_id: str, scene_id: str) -> Optional[dict]:
    row = conn.execute(
        "SELECT * FROM story_scenes WHERE id = ? AND story_id = ?",
        (scene_id, story_id),
    ).fetchone()
    if not row:
        return None
    return _scene_dict(row, _get_scene_assets(conn, scene_id))


def _get_shots(conn, scene_id: str) -> list[dict]:
    rows = conn.execute(
        "SELECT s.*, g.filename AS video_filename FROM story_shots s "
        "LEFT JOIN generations g ON g.id = s.video_asset_id "
        "WHERE s.scene_id = ? ORDER BY s.shot_number ASC",
        (scene_id,),
    ).fetchall()
    return [_shot_dict(r) for r in rows]


def _touch_story(conn, story_id: str) -> None:
    conn.execute(
        "UPDATE story_projects SET last_updated = ? WHERE id = ?",
        (_now(), story_id),
    )


def _cleanup_scene_anchor(scene: dict) -> None:
    """Remove a scene's temporary anchor clip and cached frame thumbnails."""
    video_filename = _as_text(scene.get("anchor_source_video"))
    cache_key = _as_text(scene.get("anchor_cache_key"))
    if video_filename:
        try:
            os.remove(os.path.join("videos", video_filename))
        except OSError:
            pass
    if cache_key:
        shutil.rmtree(os.path.join("thumbnails", "frames", cache_key), ignore_errors=True)


# === Story CRUD ===

def list_stories() -> list[dict]:
    """Return every story, newest-updated first."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM story_projects ORDER BY last_updated DESC"
    ).fetchall()
    conn.close()
    return [_story_dict(r) for r in rows]


def create_story(title: str, premise: str = "", settings: dict | None = None) -> dict:
    """Create a story with the default FastH3 settings."""
    story_id = str(uuid.uuid4())
    now = _now()
    merged = dict(DEFAULT_SETTINGS)
    if isinstance(settings, dict):
        merged.update(settings)
    title = _as_text(title) or "Untitled Story"
    conn = get_db()
    conn.execute(
        "INSERT INTO story_projects "
        "(id, title, premise, settings, plan, created, last_updated) "
        "VALUES (?, ?, ?, ?, '{}', ?, ?)",
        (story_id, title, premise or "", json.dumps(merged), now, now),
    )
    conn.commit()
    row = conn.execute(
        "SELECT * FROM story_projects WHERE id = ?", (story_id,)
    ).fetchone()
    conn.close()
    return _story_dict(row)


def get_story(story_id: str) -> Optional[dict]:
    """Return a story with its cast and ordered scenes/shots."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM story_projects WHERE id = ?", (story_id,)
    ).fetchone()
    if not row:
        conn.close()
        return None
    story = _story_dict(row)
    cast = _get_cast(conn, story_id)

    scene_rows = conn.execute(
        "SELECT * FROM story_scenes WHERE story_id = ? ORDER BY scene_number ASC",
        (story_id,),
    ).fetchall()
    scenes = []
    for scene_row in scene_rows:
        scene = _scene_dict(scene_row)
        scene["shots"] = _get_shots(conn, scene["id"])
        scene["assets"] = _get_scene_assets(conn, scene["id"])
        scenes.append(scene)
    conn.close()
    return {"story": story, "cast": cast, "scenes": scenes}


def update_story(story_id: str, data: dict) -> Optional[dict]:
    """Update a story's title, premise and/or settings."""
    data = data or {}
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM story_projects WHERE id = ?", (story_id,)
    ).fetchone()
    if not row:
        conn.close()
        return None

    fields: list[str] = []
    values: list = []
    if "title" in data:
        fields.append("title = ?")
        values.append(_as_text(data.get("title")) or "Untitled Story")
    if "premise" in data:
        fields.append("premise = ?")
        values.append(_as_text(data.get("premise")))
    if "settings" in data and isinstance(data.get("settings"), dict):
        current = _parse_json(row["settings"], dict(DEFAULT_SETTINGS))
        current.update(data["settings"])
        fields.append("settings = ?")
        values.append(json.dumps(current))
    if fields:
        fields.append("last_updated = ?")
        values.append(_now())
        values.append(story_id)
        conn.execute(
            f"UPDATE story_projects SET {', '.join(fields)} WHERE id = ?", values
        )
        conn.commit()
    row = conn.execute(
        "SELECT * FROM story_projects WHERE id = ?", (story_id,)
    ).fetchone()
    conn.close()
    return _story_dict(row) if row else None


def delete_story(story_id: str) -> bool:
    """Delete a story together with its cast, scenes and shots."""
    conn = get_db()
    exists = conn.execute(
        "SELECT id FROM story_projects WHERE id = ?", (story_id,)
    ).fetchone()
    if not exists:
        conn.close()
        return False
    shot_rows = conn.execute(
        "SELECT s.* FROM story_shots s "
        "JOIN story_scenes sc ON sc.id = s.scene_id WHERE sc.story_id = ?",
        (story_id,),
    ).fetchall()
    for row in shot_rows:
        _cleanup_keyframe_source(_shot_dict(row))
    scene_rows = conn.execute(
        "SELECT * FROM story_scenes WHERE story_id = ?", (story_id,)
    ).fetchall()
    for row in scene_rows:
        _cleanup_scene_anchor(_scene_dict(row))
    conn.execute(
        "DELETE FROM story_scene_assets WHERE scene_id IN "
        "(SELECT id FROM story_scenes WHERE story_id = ?)",
        (story_id,),
    )
    conn.execute(
        "DELETE FROM story_shots WHERE scene_id IN "
        "(SELECT id FROM story_scenes WHERE story_id = ?)",
        (story_id,),
    )
    conn.execute("DELETE FROM story_scenes WHERE story_id = ?", (story_id,))
    conn.execute("DELETE FROM story_cast WHERE story_id = ?", (story_id,))
    conn.execute("DELETE FROM story_projects WHERE id = ?", (story_id,))
    conn.commit()
    conn.close()
    return True


# === Cast CRUD ===

def add_cast(story_id: str, character_asset_id: str, role_name: str = "", notes: str = "") -> Optional[dict]:
    """Cast a character-flagged image asset into a story."""
    character_asset_id = _as_text(character_asset_id)
    if not character_asset_id:
        raise StoryError("character_asset_id is required")
    asset = get_asset_by_id(character_asset_id)
    if not asset:
        raise StoryError("Character asset not found", 404)
    if (asset.get("type") or "").lower() != "image" or not asset.get("character"):
        raise StoryError("Asset must be a character-flagged image asset")

    conn = get_db()
    story = conn.execute(
        "SELECT id FROM story_projects WHERE id = ?", (story_id,)
    ).fetchone()
    if not story:
        conn.close()
        return None
    profile = _profile_from_metadata(asset.get("metadata"))
    role_name = _as_text(role_name) or _display_name(
        asset.get("filename") or "",
        asset.get("prompt") or "",
        "",
        profile,
        asset.get("metadata"),
    )
    conn.execute(
        "INSERT OR REPLACE INTO story_cast "
        "(story_id, character_asset_id, role_name, notes) VALUES (?, ?, ?, ?)",
        (story_id, character_asset_id, role_name, notes or ""),
    )
    _touch_story(conn, story_id)
    conn.commit()
    row = conn.execute(
        "SELECT c.character_asset_id, c.role_name, c.notes, "
        "g.filename, g.prompt, g.metadata "
        "FROM story_cast c LEFT JOIN generations g ON g.id = c.character_asset_id "
        "WHERE c.story_id = ? AND c.character_asset_id = ?",
        (story_id, character_asset_id),
    ).fetchone()
    conn.close()
    return _cast_entry(row) if row else None


def remove_cast(story_id: str, character_asset_id: str) -> bool:
    conn = get_db()
    cur = conn.execute(
        "DELETE FROM story_cast WHERE story_id = ? AND character_asset_id = ?",
        (story_id, character_asset_id),
    )
    deleted = cur.rowcount > 0
    if deleted:
        _touch_story(conn, story_id)
        conn.commit()
    conn.close()
    return deleted


# === Scene CRUD ===

def add_scene(story_id: str, data: dict) -> Optional[dict]:
    """Append a scene to a story."""
    data = data or {}
    conn = get_db()
    story = conn.execute(
        "SELECT id FROM story_projects WHERE id = ?", (story_id,)
    ).fetchone()
    if not story:
        conn.close()
        return None
    row = conn.execute(
        "SELECT COALESCE(MAX(scene_number), 0) AS n FROM story_scenes WHERE story_id = ?",
        (story_id,),
    ).fetchone()
    scene_number = _to_int(data.get("scene_number"), int(row["n"]) + 1)
    scene_id = str(uuid.uuid4())
    now = _now()
    conn.execute(
        "INSERT INTO story_scenes "
        "(id, story_id, scene_number, title, synopsis, location, time_of_day, "
        "mood, props, lighting, weather, palette, negative_prompt, anchor_image_id, "
        "anchor_frames, anchor_source_video, anchor_cache_key, anchor_frame_index, "
        "created, last_updated) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', '', '', NULL, ?, ?)",
        (
            scene_id,
            story_id,
            scene_number,
            _as_text(data.get("title")),
            _as_text(data.get("synopsis")),
            _as_text(data.get("location")),
            _as_text(data.get("time_of_day")),
            _as_text(data.get("mood")),
            _as_text(data.get("props")),
            _as_text(data.get("lighting")),
            _as_text(data.get("weather")),
            _as_text(data.get("palette")),
            _as_text(data.get("negative_prompt")),
            _as_text(data.get("anchor_image_id")) or None,
            now,
            now,
        ),
    )
    _touch_story(conn, story_id)
    conn.commit()
    row = conn.execute(
        "SELECT * FROM story_scenes WHERE id = ?", (scene_id,)
    ).fetchone()
    assets = _get_scene_assets(conn, scene_id)
    conn.close()
    return _scene_dict(row, assets) if row else None


def update_scene(story_id: str, scene_id: str, data: dict) -> Optional[dict]:
    """Update scene fields."""
    data = data or {}
    conn = get_db()
    scene = conn.execute(
        "SELECT * FROM story_scenes WHERE id = ? AND story_id = ?",
        (scene_id, story_id),
    ).fetchone()
    if not scene:
        conn.close()
        return None
    field_map = {
        "title": "title",
        "synopsis": "synopsis",
        "location": "location",
        "time_of_day": "time_of_day",
        "mood": "mood",
        "props": "props",
        "lighting": "lighting",
        "weather": "weather",
        "palette": "palette",
        "negative_prompt": "negative_prompt",
        "anchor_image_id": "anchor_image_id",
    }
    fields: list[str] = []
    values: list = []
    for key, column in field_map.items():
        if key in data:
            fields.append(f"{column} = ?")
            if key == "anchor_image_id":
                values.append(_as_text(data.get(key)) or None)
            else:
                values.append(_as_text(data.get(key)))
    if "scene_number" in data:
        fields.append("scene_number = ?")
        values.append(_to_int(data.get("scene_number"), scene["scene_number"]))
    if fields:
        fields.append("last_updated = ?")
        values.append(_now())
        values.append(scene_id)
        conn.execute(
            f"UPDATE story_scenes SET {', '.join(fields)} WHERE id = ?", values
        )
        _touch_story(conn, story_id)
        conn.commit()
    row = conn.execute(
        "SELECT * FROM story_scenes WHERE id = ?", (scene_id,)
    ).fetchone()
    assets = _get_scene_assets(conn, scene_id)
    conn.close()
    return _scene_dict(row, assets) if row else None


def delete_scene(story_id: str, scene_id: str) -> bool:
    conn = get_db()
    scene = conn.execute(
        "SELECT * FROM story_scenes WHERE id = ? AND story_id = ?",
        (scene_id, story_id),
    ).fetchone()
    if not scene:
        conn.close()
        return False
    _cleanup_scene_anchor(_scene_dict(scene))
    shot_rows = conn.execute(
        "SELECT * FROM story_shots WHERE scene_id = ?", (scene_id,)
    ).fetchall()
    for row in shot_rows:
        _cleanup_keyframe_source(_shot_dict(row))
    conn.execute("DELETE FROM story_shots WHERE scene_id = ?", (scene_id,))
    conn.execute("DELETE FROM story_scene_assets WHERE scene_id = ?", (scene_id,))
    conn.execute("DELETE FROM story_scenes WHERE id = ?", (scene_id,))
    _touch_story(conn, story_id)
    conn.commit()
    conn.close()
    return True


# === Scene reference assets ===

def _normalize_scene_asset_role(value) -> str:
    role = _as_text(value).lower() or DEFAULT_SCENE_ASSET_ROLE
    return role if role in SCENE_ASSET_ROLES else DEFAULT_SCENE_ASSET_ROLE


def _scene_asset_row(conn, row_id: str) -> Optional[dict]:
    row = conn.execute(
        "SELECT sa.*, g.filename, g.prompt, g.metadata, g.width, g.height "
        "FROM story_scene_assets sa "
        "LEFT JOIN generations g ON g.id = sa.asset_id "
        "WHERE sa.id = ?",
        (row_id,),
    ).fetchone()
    return _scene_asset_dict(row) if row else None


def add_scene_asset(story_id: str, scene_id: str, data: dict) -> Optional[dict]:
    """Attach a Library image asset to a scene's reference kit."""
    data = data or {}
    asset_id = _as_text(data.get("asset_id"))
    if not asset_id:
        raise StoryError("asset_id is required")
    conn = get_db()
    scene = conn.execute(
        "SELECT id FROM story_scenes WHERE id = ? AND story_id = ?",
        (scene_id, story_id),
    ).fetchone()
    if not scene:
        conn.close()
        return None
    try:
        _image_asset_file(asset_id)
    except StoryError:
        conn.close()
        raise

    role = _normalize_scene_asset_role(data.get("role"))
    label = _as_text(data.get("label"))
    notes = _as_text(data.get("notes"))
    now = _now()
    existing = conn.execute(
        "SELECT id FROM story_scene_assets WHERE scene_id = ? AND asset_id = ?",
        (scene_id, asset_id),
    ).fetchone()
    if existing:
        row_id = existing["id"]
        conn.execute(
            "UPDATE story_scene_assets SET role = ?, label = ?, notes = ?, "
            "last_updated = ? WHERE id = ?",
            (role, label, notes, now, row_id),
        )
    else:
        row_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO story_scene_assets "
            "(id, scene_id, asset_id, role, label, notes, created, last_updated) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (row_id, scene_id, asset_id, role, label, notes, now, now),
        )
    _touch_story(conn, story_id)
    conn.commit()
    asset = _scene_asset_row(conn, row_id)
    conn.close()
    return asset


def remove_scene_asset(story_id: str, scene_id: str, asset_id: str) -> bool:
    """Detach an asset from a scene's reference kit."""
    asset_id = _as_text(asset_id)
    conn = get_db()
    scene = conn.execute(
        "SELECT id FROM story_scenes WHERE id = ? AND story_id = ?",
        (scene_id, story_id),
    ).fetchone()
    if not scene:
        conn.close()
        return False
    cur = conn.execute(
        "DELETE FROM story_scene_assets WHERE scene_id = ? AND asset_id = ?",
        (scene_id, asset_id),
    )
    deleted = cur.rowcount > 0
    if deleted:
        _touch_story(conn, story_id)
        conn.commit()
    conn.close()
    return deleted


def _scene_reference_prompt(scene: dict, role: str, prompt: str, style: str = "") -> str:
    """Build a deterministic still-reference prompt from a scene's look fields."""
    role_label = {
        "background": "environment background reference",
        "prop": "prop reference",
        "reference": "visual reference",
    }.get(role, "visual reference")
    parts = [f"{_as_text(style) or 'cinematic'} style"]
    context = []
    for key, label in (
        ("location", "location"),
        ("time_of_day", "time of day"),
        ("weather", "weather"),
        ("lighting", "lighting"),
        ("palette", "color palette"),
        ("mood", "mood"),
        ("props", "props"),
    ):
        value = _as_text(scene.get(key))
        if value:
            context.append(f"{label}: {value}")
    if context:
        parts.append(", ".join(context))
    parts.append(f"{role_label}: {_as_text(prompt)}")
    negative = _as_text(scene.get("negative_prompt"))
    if negative:
        parts.append(f"avoid: {negative}")
    return ". ".join(part for part in parts if part)


async def generate_scene_asset(story_id: str, scene_id: str, data: dict) -> dict:
    """Generate a still environment/prop reference image for a scene."""
    from config import load_app_settings
    from services.comfy_service import generate_single_image

    data = data or {}
    role = _normalize_scene_asset_role(data.get("role"))
    label = _as_text(data.get("label"))
    prompt = _as_text(data.get("prompt"))
    notes = _as_text(data.get("notes"))
    if not prompt:
        raise StoryError("prompt is required")

    conn = get_db()
    story_row = conn.execute(
        "SELECT * FROM story_projects WHERE id = ?", (story_id,)
    ).fetchone()
    scene_row = conn.execute(
        "SELECT * FROM story_scenes WHERE id = ? AND story_id = ?",
        (scene_id, story_id),
    ).fetchone()
    conn.close()
    if not story_row:
        raise StoryError("Story not found", 404)
    if not scene_row:
        raise StoryError("Scene not found", 404)

    story_settings = _parse_json(story_row["settings"], dict(DEFAULT_SETTINGS))
    resolution = _as_text(story_settings.get("resolution")) or "720p"
    aspect_ratio = _as_text(story_settings.get("aspect_ratio")) or "16:9"
    style = _as_text(story_settings.get("style")) or "cinematic"
    app_settings = load_app_settings()
    image_model = _as_text(app_settings.get("image_model")) or "schnell"
    qwen_turbo = bool(app_settings.get("qwen_turbo", True))

    scene = _scene_dict(scene_row)
    full_prompt = _scene_reference_prompt(scene, role, prompt, style)
    result = await generate_single_image(
        full_prompt,
        resolution,
        aspect_ratio,
        image_model=image_model,
        qwen_turbo=qwen_turbo,
    )
    if not result or not result.get("success"):
        raise StoryGenerationError(
            "Scene reference generation failed: "
            + ((result or {}).get("error") or "unknown error")
        )
    filename = _as_text(result.get("local_filename"))
    if not filename or not os.path.isfile(os.path.join("images", filename)):
        raise StoryGenerationError("Scene reference image file was not returned")

    asset_id = save_generation(
        prompt=full_prompt,
        filename=filename,
        file_type="image",
        aspect_ratio=aspect_ratio,
        width=_to_int(result.get("width"), 0),
        height=_to_int(result.get("height"), 0),
        metadata={
            "source": "story_scene_reference",
            "story_id": story_id,
            "scene_id": scene_id,
            "role": role,
            "label": label,
            "image_model": image_model,
            "resolution": resolution,
            "aspect_ratio": aspect_ratio,
        },
    )
    asset = add_scene_asset(
        story_id,
        scene_id,
        {"asset_id": asset_id, "role": role, "label": label, "notes": notes},
    )
    return {"asset": asset, "generation": result}


# === Shot CRUD ===

def _shot_parent_context(conn, story_id: str, scene_id: str) -> Optional[dict]:
    return conn.execute(
        "SELECT * FROM story_scenes WHERE id = ? AND story_id = ?",
        (scene_id, story_id),
    ).fetchone()


def add_shot(story_id: str, scene_id: str, data: dict) -> Optional[dict]:
    """Append a shot to a scene."""
    data = data or {}
    conn = get_db()
    scene = _shot_parent_context(conn, story_id, scene_id)
    if not scene:
        conn.close()
        return None
    row = conn.execute(
        "SELECT COALESCE(MAX(shot_number), 0) AS n FROM story_shots WHERE scene_id = ?",
        (scene_id,),
    ).fetchone()
    shot_number = _to_int(data.get("shot_number"), int(row["n"]) + 1)
    duration = _clamp(
        _to_float(data.get("duration"), 6.0), FASTH3_MIN_SECONDS, FASTH3_MAX_SECONDS
    )
    continuity = _as_text(data.get("continuity_mode")) or DEFAULT_MANUAL_CONTINUITY
    if continuity not in CONTINUITY_MODES:
        continuity = DEFAULT_MANUAL_CONTINUITY

    shot_id = str(uuid.uuid4())
    now = _now()
    conn.execute(
        "INSERT INTO story_shots "
        "(id, scene_id, shot_number, duration, action, camera, image_prompt, "
        "video_prompt, character_asset_ids, continuity_mode, parent_shot_id, "
        "status, selected_image_id, candidate_image_ids, video_asset_id, error, "
        "settings, created, last_updated) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            shot_id,
            scene_id,
            shot_number,
            duration,
            _as_text(data.get("action")),
            _as_text(data.get("camera")),
            _as_text(data.get("image_prompt")),
            _as_text(data.get("video_prompt")),
            _json_list(data.get("character_asset_ids")),
            continuity,
            _as_text(data.get("parent_shot_id")) or None,
            _as_text(data.get("status")) or "draft",
            _as_text(data.get("selected_image_id")) or None,
            _json_list(data.get("candidate_image_ids")),
            _as_text(data.get("video_asset_id")) or None,
            _as_text(data.get("error")),
            _json_dict(data.get("settings")),
            now,
            now,
        ),
    )
    _touch_story(conn, story_id)
    conn.commit()
    row = conn.execute(
        "SELECT * FROM story_shots WHERE id = ?", (shot_id,)
    ).fetchone()
    conn.close()
    return _shot_dict(row) if row else None


def update_shot(story_id: str, shot_id: str, data: dict) -> Optional[dict]:
    """Update shot fields; JSON columns are serialized automatically."""
    data = data or {}
    conn = get_db()
    row = conn.execute(
        "SELECT s.* FROM story_shots s "
        "JOIN story_scenes sc ON sc.id = s.scene_id "
        "WHERE s.id = ? AND sc.story_id = ?",
        (shot_id, story_id),
    ).fetchone()
    if not row:
        conn.close()
        return None

    fields: list[str] = []
    values: list = []
    text_fields = (
        "action",
        "camera",
        "image_prompt",
        "video_prompt",
        "status",
        "error",
    )
    for key in text_fields:
        if key in data:
            fields.append(f"{key} = ?")
            values.append(_as_text(data.get(key)))

    for key in ("parent_shot_id", "selected_image_id", "video_asset_id"):
        if key in data:
            fields.append(f"{key} = ?")
            values.append(_as_text(data.get(key)) or None)

    if "duration" in data:
        fields.append("duration = ?")
        values.append(
            _clamp(
                _to_float(data.get("duration"), 6.0),
                FASTH3_MIN_SECONDS,
                FASTH3_MAX_SECONDS,
            )
        )
    if "shot_number" in data:
        fields.append("shot_number = ?")
        values.append(_to_int(data.get("shot_number"), row["shot_number"]))
    if "character_asset_ids" in data:
        fields.append("character_asset_ids = ?")
        values.append(_json_list(data.get("character_asset_ids")))
    if "candidate_image_ids" in data:
        fields.append("candidate_image_ids = ?")
        values.append(_json_list(data.get("candidate_image_ids")))
    if "settings" in data:
        fields.append("settings = ?")
        values.append(_json_dict(data.get("settings")))
    if "continuity_mode" in data:
        continuity = _as_text(data.get("continuity_mode")) or DEFAULT_MANUAL_CONTINUITY
        if continuity not in CONTINUITY_MODES:
            continuity = DEFAULT_MANUAL_CONTINUITY
        fields.append("continuity_mode = ?")
        values.append(continuity)

    if fields:
        fields.append("last_updated = ?")
        values.append(_now())
        values.append(shot_id)
        conn.execute(
            f"UPDATE story_shots SET {', '.join(fields)} WHERE id = ?", values
        )
        _touch_story(conn, story_id)
        conn.commit()
    row = conn.execute(
        "SELECT * FROM story_shots WHERE id = ?", (shot_id,)
    ).fetchone()
    conn.close()
    return _shot_dict(row) if row else None


def delete_shot(story_id: str, shot_id: str) -> bool:
    conn = get_db()
    row = conn.execute(
        "SELECT s.* FROM story_shots s "
        "JOIN story_scenes sc ON sc.id = s.scene_id "
        "WHERE s.id = ? AND sc.story_id = ?",
        (shot_id, story_id),
    ).fetchone()
    if not row:
        conn.close()
        return False
    _cleanup_keyframe_source(_shot_dict(row))
    conn.execute("DELETE FROM story_shots WHERE id = ?", (shot_id,))
    _touch_story(conn, story_id)
    conn.commit()
    conn.close()
    return True


def get_shot_context(story_id: str, shot_id: str) -> Optional[dict]:
    """Return a shot together with its scene, verifying story ownership."""
    conn = get_db()
    row = conn.execute(
        "SELECT s.* FROM story_shots s "
        "JOIN story_scenes sc ON sc.id = s.scene_id "
        "WHERE s.id = ? AND sc.story_id = ?",
        (shot_id, story_id),
    ).fetchone()
    if not row:
        conn.close()
        return None
    shot = _shot_dict(row)
    scene_row = conn.execute(
        "SELECT * FROM story_scenes WHERE id = ?", (shot["scene_id"],)
    ).fetchone()
    scene = (
        _scene_dict(scene_row, _get_scene_assets(conn, shot["scene_id"]))
        if scene_row
        else None
    )
    conn.close()
    return {"shot": shot, "scene": scene}


# === Prompt construction ===

def _character_description(entry: dict) -> str:
    profile = entry.get("profile") or {}
    name = _as_text(entry.get("name") or profile.get("name") or entry.get("role_name"))
    parts = [name] if name else []
    appearance = _as_text(profile.get("appearance"))
    wardrobe = _as_text(profile.get("wardrobe"))
    description = _as_text(profile.get("description"))
    if appearance:
        parts.append(f"appearance: {appearance}")
    if wardrobe:
        parts.append(f"wardrobe: {wardrobe}")
    if description:
        parts.append(description)
    return ", ".join(parts)


def _build_shot_prompts(style: str, scene: dict, shot: dict, characters: list[dict]) -> tuple[str, str]:
    """Build deterministic image/video prompts from style, scene, shot and cast."""
    style = _as_text(style) or "cinematic"
    scene_bits = []
    if _as_text(scene.get("location")):
        scene_bits.append(f"location: {_as_text(scene.get('location'))}")
    if _as_text(scene.get("time_of_day")):
        scene_bits.append(f"time of day: {_as_text(scene.get('time_of_day'))}")
    if _as_text(scene.get("weather")):
        scene_bits.append(f"weather: {_as_text(scene.get('weather'))}")
    if _as_text(scene.get("lighting")):
        scene_bits.append(f"lighting: {_as_text(scene.get('lighting'))}")
    if _as_text(scene.get("palette")):
        scene_bits.append(f"color palette: {_as_text(scene.get('palette'))}")
    if _as_text(scene.get("mood")):
        scene_bits.append(f"mood: {_as_text(scene.get('mood'))}")
    if _as_text(scene.get("props")):
        scene_bits.append(f"props: {_as_text(scene.get('props'))}")
    action = _as_text(shot.get("action"))
    camera = _as_text(shot.get("camera"))
    character_text = "; ".join(
        desc for desc in (_character_description(c) for c in characters) if desc
    )
    negative = _as_text(scene.get("negative_prompt"))

    lead = f"{style} style"
    parts = [lead]
    if scene_bits:
        parts.append(", ".join(scene_bits))
    if action:
        parts.append(action)
    if character_text:
        parts.append(f"characters: {character_text}")
    if negative:
        parts.append(f"avoid: {negative}")
    base = ". ".join(part for part in parts if part)

    camera_text = f" Camera: {camera}." if camera else ""
    image_prompt = (
        f"{base}.{camera_text} Cinematic film still, coherent composition, "
        "detailed, consistent character identity."
    ).strip()
    video_prompt = (
        f"{base}.{camera_text} Natural motion, consistent character identity, "
        "cinematic lighting, no dialogue."
    ).strip()
    return image_prompt, video_prompt


def _cast_name_map(cast: list[dict]) -> dict[str, dict]:
    """Map every known cast alias (lowercase) to its cast entry."""
    mapping: dict[str, dict] = {}
    for entry in cast:
        profile = entry.get("profile") or {}
        for candidate in (
            entry.get("role_name"),
            entry.get("name"),
            profile.get("name"),
        ):
            key = _as_text(candidate).lower()
            if key and key not in mapping:
                mapping[key] = entry
    return mapping


# === AI storyboard plan ===

def _plan_system_prompt() -> str:
    return (
        "You are a film storyboard planner. Return only a single JSON object. "
        "Do not include markdown, comments or prose outside the JSON."
    )


def _build_plan_prompt(data: dict) -> str:
    story = data["story"]
    settings = story.get("settings") or {}
    cast = data.get("cast") or []
    style = _as_text(settings.get("style")) or "cinematic"
    target_duration = _to_float(settings.get("target_duration"), 60)

    cast_lines = []
    for entry in cast:
        profile = entry.get("profile") or {}
        details = _character_description(entry)
        cast_lines.append(f"- {entry.get('name') or entry.get('role_name')}: {details}")
    if not cast_lines:
        cast_lines.append("- (no cast defined; every shot characters array must be empty)")

    schema = {
        "title": "",
        "logline": "",
        "style": "",
        "scenes": [
            {
                "title": "",
                "synopsis": "",
                "location": "",
                "time_of_day": "",
                "weather": "",
                "lighting": "",
                "palette": "",
                "mood": "",
                "props": "",
                "negative_prompt": "",
                "shots": [
                    {
                        "action": "",
                        "camera": "",
                        "duration": 6,
                        "characters": ["Name"],
                        "continuity": "same_scene_frame",
                    }
                ],
            }
        ],
    }

    return (
        "Create a visually coherent short film storyboard from this premise.\n\n"
        f"Premise:\n{_as_text(story.get('premise')) or '(none provided)'}\n\n"
        f"Style: {style}\n"
        f"Target duration: {target_duration:g} seconds (must be 30-90 seconds total).\n\n"
        "Cast (use these exact names only; do not invent characters):\n"
        + "\n".join(cast_lines)
        + "\n\nRequirements:\n"
        "- Each shot must be 5-8 seconds; never exceed 15 seconds (FastH3 limit).\n"
        "- Total runtime across all shots must be 30-90 seconds.\n"
        "- Use FastH3-friendly shots: one clear action per shot, simple camera motion.\n"
        "- No dialogue or lip-sync; describe visual action only.\n"
        "- continuity must be one of: new_scene, same_scene_frame, same_scene_video, match_cut, none.\n"
        "- The characters array must contain only known cast names from the list above.\n"
        "- Every scene should define lighting, weather, palette, mood, props and negative_prompt for visual consistency.\n"
        "- Return 3-8 scenes with 1-5 shots each, enough to fill the target duration.\n\n"
        "Required JSON shape:\n"
        + json.dumps(schema, indent=2)
        + "\n\nReturn only the JSON object."
    )


def _correction_prompt(base_prompt: str, error: str, previous_text: str = "") -> str:
    snippet = (previous_text or "").strip()
    if len(snippet) > 1500:
        snippet = snippet[:1500]
    return (
        f"{base_prompt}\n\n"
        "Your previous answer was invalid.\n"
        f"Validation error: {error}\n"
        + (f"Previous answer head:\n{snippet}\n" if snippet else "")
        + "Correct every issue and return ONLY the complete JSON object."
    )


def _normalize_plan(raw: Any, name_map: dict[str, dict]) -> dict:
    """Validate and normalize an AI plan, raising StoryValidationError on failure."""
    if not isinstance(raw, dict):
        raise StoryValidationError("Storyboard response is not a JSON object")

    scenes_raw = raw.get("scenes")
    if not isinstance(scenes_raw, list) or not scenes_raw:
        raise StoryValidationError("Storyboard must contain a non-empty scenes array")

    unknown: list[str] = []
    scenes: list[dict] = []

    for scene_raw in scenes_raw:
        if not isinstance(scene_raw, dict):
            raise StoryValidationError("Every scene must be a JSON object")
        shots_raw = scene_raw.get("shots")
        if not isinstance(shots_raw, list) or not shots_raw:
            raise StoryValidationError("Every scene must contain at least one shot")

        shots: list[dict] = []
        for shot_raw in shots_raw:
            if not isinstance(shot_raw, dict):
                raise StoryValidationError("Every shot must be a JSON object")

            duration = _clamp(
                _to_float(shot_raw.get("duration"), 6.0),
                FASTH3_MIN_SECONDS,
                FASTH3_MAX_SECONDS,
            )

            characters_raw = shot_raw.get("characters") or []
            if isinstance(characters_raw, str):
                characters_raw = [characters_raw]
            if not isinstance(characters_raw, list):
                characters_raw = []

            characters: list[str] = []
            for name in characters_raw:
                key = _as_text(name).lower()
                if not key:
                    continue
                entry = name_map.get(key)
                if not entry:
                    label = _as_text(name)
                    if label and label not in unknown:
                        unknown.append(label)
                    continue
                display = _as_text(entry.get("name") or entry.get("role_name"))
                if display and display not in characters:
                    characters.append(display)

            continuity = _as_text(shot_raw.get("continuity")) or "same_scene_frame"
            if continuity not in CONTINUITY_MODES:
                raise StoryValidationError(
                    "Invalid continuity value "
                    f"'{continuity}'. Allowed: {', '.join(CONTINUITY_MODES)}"
                )

            shots.append(
                {
                    "action": _as_text(shot_raw.get("action")),
                    "camera": _as_text(shot_raw.get("camera")),
                    "duration": round(duration, 2),
                    "characters": characters,
                    "continuity": continuity,
                }
            )

        scenes.append(
            {
                "title": _as_text(scene_raw.get("title")),
                "synopsis": _as_text(scene_raw.get("synopsis")),
                "location": _as_text(scene_raw.get("location")),
                "time_of_day": _as_text(scene_raw.get("time_of_day")),
                "props": _as_text(scene_raw.get("props")),
                "weather": _as_text(scene_raw.get("weather")),
                "lighting": _as_text(scene_raw.get("lighting")),
                "palette": _as_text(scene_raw.get("palette")),
                "mood": _as_text(scene_raw.get("mood")),
                "negative_prompt": _as_text(scene_raw.get("negative_prompt")),
                "shots": shots,
            }
        )

    if unknown:
        known = ", ".join(entry.get("name") or entry.get("role_name") for entry in name_map.values())
        raise StoryValidationError(
            "Unknown cast names: "
            + ", ".join(unknown)
            + (f". Known cast: {known}" if known else ". No cast is defined.")
        )

    _cap_total_duration(scenes)
    if not scenes:
        raise StoryValidationError("Storyboard has no scenes after duration validation")

    return {
        "title": _as_text(raw.get("title")),
        "logline": _as_text(raw.get("logline")),
        "style": _as_text(raw.get("style")),
        "scenes": scenes,
    }


def _cap_total_duration(scenes: list[dict]) -> None:
    """Scale shots down and trim from the end so the plan is ~90s maximum."""
    shots = [shot for scene in scenes for shot in scene["shots"]]
    total = sum(shot["duration"] for shot in shots)
    if total <= STORY_MAX_SECONDS:
        return

    factor = STORY_MAX_SECONDS / total
    for shot in shots:
        shot["duration"] = round(
            max(FASTH3_MIN_SECONDS, shot["duration"] * factor), 2
        )

    total = sum(shot["duration"] for shot in shots)
    while total > STORY_MAX_SECONDS and any(scene["shots"] for scene in scenes):
        for scene in reversed(scenes):
            if scene["shots"]:
                removed = scene["shots"].pop()
                total -= removed["duration"]
                break
    scenes[:] = [scene for scene in scenes if scene["shots"]]


def _plan_from_result(result: dict, name_map: dict[str, dict]) -> tuple[Optional[dict], str, str]:
    """Return (plan, error_kind, error_message) from an Ollama result."""
    if not result:
        return None, "parse", "Ollama returned no response"
    if result.get("error"):
        return None, "parse", str(result.get("error"))
    raw = result.get("parsed")
    if raw is None:
        return None, "parse", "Ollama returned no JSON object"
    try:
        return _normalize_plan(raw, name_map), "", ""
    except StoryValidationError as exc:
        return None, "validation", str(exc)


def _replace_story_plan(story_id: str, plan: dict, cast: list[dict]) -> None:
    """Replace all scenes/shots for a story with the validated plan."""
    name_map = _cast_name_map(cast)
    style = _as_text(plan.get("style")) or ""
    now = _now()

    conn = get_db()
    try:
        existing_scenes = conn.execute(
            "SELECT * FROM story_scenes WHERE story_id = ?", (story_id,)
        ).fetchall()
        for row in existing_scenes:
            _cleanup_scene_anchor(_scene_dict(row))
        conn.execute(
            "DELETE FROM story_scene_assets WHERE scene_id IN "
            "(SELECT id FROM story_scenes WHERE story_id = ?)",
            (story_id,),
        )
        conn.execute(
            "DELETE FROM story_shots WHERE scene_id IN "
            "(SELECT id FROM story_scenes WHERE story_id = ?)",
            (story_id,),
        )
        conn.execute("DELETE FROM story_scenes WHERE story_id = ?", (story_id,))

        for scene_index, scene in enumerate(plan["scenes"], start=1):
            scene_id = str(uuid.uuid4())
            conn.execute(
                "INSERT INTO story_scenes "
                "(id, story_id, scene_number, title, synopsis, location, "
                "time_of_day, mood, props, lighting, weather, palette, "
                "negative_prompt, anchor_image_id, anchor_frames, "
                "anchor_source_video, anchor_cache_key, anchor_frame_index, "
                "created, last_updated) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, '[]', "
                "'', '', NULL, ?, ?)",
                (
                    scene_id,
                    story_id,
                    scene_index,
                    scene.get("title") or "",
                    scene.get("synopsis") or "",
                    scene.get("location") or "",
                    scene.get("time_of_day") or "",
                    scene.get("mood") or "",
                    scene.get("props") or "",
                    scene.get("lighting") or "",
                    scene.get("weather") or "",
                    scene.get("palette") or "",
                    scene.get("negative_prompt") or "",
                    now,
                    now,
                ),
            )

            for shot_index, shot in enumerate(scene["shots"], start=1):
                character_entries = []
                character_ids = []
                for name in shot.get("characters") or []:
                    entry = name_map.get(_as_text(name).lower())
                    if entry:
                        character_entries.append(entry)
                        if entry.get("character_asset_id") not in character_ids:
                            character_ids.append(entry["character_asset_id"])
                image_prompt, video_prompt = _build_shot_prompts(
                    style, scene, shot, character_entries
                )
                conn.execute(
                    "INSERT INTO story_shots "
                    "(id, scene_id, shot_number, duration, action, camera, "
                    "image_prompt, video_prompt, character_asset_ids, "
                    "continuity_mode, parent_shot_id, status, selected_image_id, "
                    "candidate_image_ids, video_asset_id, error, settings, "
                    "created, last_updated) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'draft', NULL, "
                    "'[]', NULL, '', '{}', ?, ?)",
                    (
                        str(uuid.uuid4()),
                        scene_id,
                        shot_index,
                        shot.get("duration") or 6,
                        shot.get("action") or "",
                        shot.get("camera") or "",
                        image_prompt,
                        video_prompt,
                        json.dumps(character_ids),
                        shot.get("continuity") or "same_scene_frame",
                        now,
                        now,
                    ),
                )

        conn.execute(
            "UPDATE story_projects SET plan = ?, last_updated = ? WHERE id = ?",
            (json.dumps(plan), now, story_id),
        )
        conn.commit()
    finally:
        conn.close()


async def generate_story_plan(story_id: str) -> dict:
    """Generate a storyboard with Ollama and replace scenes/shots."""
    from services.ollama_service import ollama_generate

    data = get_story(story_id)
    if not data:
        raise StoryError("Story not found", 404)

    base_prompt = _build_plan_prompt(data)
    system = _plan_system_prompt()
    name_map = _cast_name_map(data.get("cast") or [])

    result = await ollama_generate(
        prompt=base_prompt,
        system=system,
        expect_json=True,
        force_json_format=True,
    )
    plan, error_kind, error_message = _plan_from_result(result, name_map)

    if plan is None:
        retry_prompt = _correction_prompt(
            base_prompt, error_message, (result or {}).get("text") or ""
        )
        retry = await ollama_generate(
            prompt=retry_prompt,
            system=system,
            expect_json=True,
            force_json_format=True,
        )
        plan, error_kind, error_message = _plan_from_result(retry, name_map)
        if plan is None:
            status = 400 if error_kind == "validation" else 502
            raise StoryError(
                f"Storyboard generation failed: {error_message}", status
            )

    _replace_story_plan(story_id, plan, data.get("cast") or [])
    saved = get_story(story_id)
    return {"plan": plan, **(saved or {})}


# === Keyframe generation ===

def _character_entries_for_shot(shot: dict, cast: list[dict]) -> list[dict]:
    ids = _normalize_id_list(shot.get("character_asset_ids"))
    if not ids:
        ids = [
            entry.get("character_asset_id")
            for entry in cast
            if entry.get("character_asset_id")
        ]
    cast_by_id = {
        entry.get("character_asset_id"): entry
        for entry in cast
        if entry.get("character_asset_id")
    }
    entries: list[dict] = []
    seen: set[str] = set()
    for asset_id in ids:
        if not asset_id or asset_id in seen:
            continue
        seen.add(asset_id)
        entry = cast_by_id.get(asset_id)
        if not entry:
            asset = get_asset_by_id(asset_id)
            if not asset:
                continue
            profile = _profile_from_metadata(asset.get("metadata"))
            entry = {
                "character_asset_id": asset_id,
                "role_name": "",
                "notes": "",
                "name": _display_name(
                    asset.get("filename") or "",
                    asset.get("prompt") or "",
                    "",
                    profile,
                    asset.get("metadata"),
                ),
                "filename": asset.get("filename") or "",
                "profile": profile,
            }
        entries.append(entry)
    return entries


def _scene_character_entries(
    conn, story_id: str, scene_id: str, cast: list[dict]
) -> list[dict]:
    """Return cast entries for characters present in a scene (or the whole cast)."""
    rows = conn.execute(
        "SELECT character_asset_ids FROM story_shots WHERE scene_id = ? "
        "ORDER BY shot_number ASC",
        (scene_id,),
    ).fetchall()
    ids: list[str] = []
    for row in rows:
        for asset_id in _normalize_id_list(row["character_asset_ids"]):
            if asset_id and asset_id not in ids:
                ids.append(asset_id)
    return _character_entries_for_shot({"character_asset_ids": ids}, cast)


def _scene_asset_ref_files(scene: dict) -> list[tuple[str, str, str]]:
    """Resolve scene reference assets to (filename, label, role) tuples."""
    entries: list[tuple[str, str, str]] = []
    for asset in scene.get("assets") or []:
        if not isinstance(asset, dict):
            continue
        asset_id = _as_text(asset.get("asset_id"))
        if not asset_id:
            continue
        try:
            _asset, filename = _image_asset_file(asset_id)
        except StoryError:
            continue
        role = _normalize_scene_asset_role(asset.get("role"))
        label = _as_text(asset.get("label")) or os.path.splitext(
            os.path.basename(filename)
        )[0]
        entries.append((filename, label, role))
    return entries


def _collect_generation_refs(
    scene: dict, characters: list[dict]
) -> tuple[list[str], list[str], list[str], str]:
    """Collect FastH3 image refs as anchor/background, characters, then props/refs."""
    candidates: list[tuple[str, str, str]] = []
    seen: set[str] = set()

    def push(filename: str, label: str, role: str) -> None:
        if not filename or filename in seen:
            return
        seen.add(filename)
        candidates.append((filename, label or "scene reference", role))

    anchor_id = _as_text(scene.get("anchor_image_id"))
    if anchor_id:
        try:
            _anchor_asset, anchor_filename = _image_asset_file(anchor_id)
        except StoryError:
            anchor_filename = ""
        if anchor_filename:
            push(anchor_filename, "scene anchor", "background")

    scene_assets = _scene_asset_ref_files(scene)
    for filename, label, role in scene_assets:
        if role == "background":
            push(filename, label, "background")

    for entry in characters:
        for filename, label in _character_ref_files(entry):
            push(filename, label, "character")

    for filename, label, role in scene_assets:
        if role in ("prop", "reference"):
            push(filename, label, role)

    chosen = candidates[:MAX_CHARACTER_REFS]
    warning = ""
    if len(candidates) > MAX_CHARACTER_REFS:
        warning = (
            f"Using {MAX_CHARACTER_REFS} of {len(candidates)} scene/character "
            "references; extra props or references were dropped."
        )
    return (
        [item[0] for item in chosen],
        [item[1] for item in chosen],
        [item[2] for item in chosen],
        warning,
    )


def _image_asset_file(asset_id: str) -> tuple[dict, str]:
    asset = get_asset_by_id(asset_id)
    if not asset:
        raise StoryError(f"Image asset not found: {asset_id}", 404)
    if (asset.get("type") or "").lower() != "image":
        raise StoryError(f"Asset is not an image: {asset_id}")
    filename = asset.get("filename") or ""
    if not filename or not os.path.isfile(os.path.join("images", filename)):
        raise StoryError(f"Image file is missing for asset: {asset_id}")
    return asset, filename


def _character_ref_files(entry: dict) -> list[tuple[str, str]]:
    """Return primary and additional character reference files with labels."""
    primary_id = _as_text(entry.get("character_asset_id"))
    profile = entry.get("profile") or {}
    name = _as_text(entry.get("name") or entry.get("role_name") or profile.get("name"))
    files: list[tuple[str, str]] = []
    seen: set[str] = set()

    def add(asset_id: str) -> None:
        if not asset_id or asset_id in seen:
            return
        seen.add(asset_id)
        try:
            _asset, filename = _image_asset_file(asset_id)
        except StoryError:
            return
        label = name or os.path.splitext(os.path.basename(filename))[0]
        files.append((filename, label))

    add(primary_id)
    refs = profile.get("references") if isinstance(profile, dict) else None
    if isinstance(refs, list):
        for ref_id in refs:
            add(_as_text(ref_id))
    return files


def _set_shot_status(story_id: str, shot_id: str, status: str, error: str = "") -> None:
    try:
        update_shot(story_id, shot_id, {"status": status, "error": error})
    except Exception:
        pass


def _cleanup_keyframe_source(shot: dict) -> None:
    """Remove a shot's temporary casting clip and cached frame thumbnails."""
    settings = shot.get("settings") if isinstance(shot.get("settings"), dict) else {}
    video_filename = _as_text(settings.get("keyframe_source_video"))
    cache_key = _as_text(settings.get("keyframe_cache_key"))
    if video_filename:
        try:
            os.remove(os.path.join("videos", video_filename))
        except OSError:
            pass
    if cache_key:
        shutil.rmtree(os.path.join("thumbnails", "frames", cache_key), ignore_errors=True)


async def generate_shot_keyframes(story_id: str, shot_id: str, count: int = 2) -> dict:
    """Generate a one-second FastH3 casting clip and expose its 24 frames."""
    try:
        return await _generate_shot_keyframes_inner(story_id, shot_id, count)
    except StoryError as exc:
        _set_shot_status(story_id, shot_id, "error", str(exc))
        raise
    except Exception as exc:
        _set_shot_status(story_id, shot_id, "error", str(exc))
        raise StoryGenerationError(str(exc), 502) from exc


async def _generate_shot_keyframes_inner(story_id: str, shot_id: str, count: int) -> dict:
    from services.comfy_service import free_comfyui_memory, generate_fasth3_multi_ref_video
    from services.video_frame_service import (
        VideoFrameError,
        extract_frame_window,
        probe_video,
    )

    data = get_story(story_id)
    if not data:
        raise StoryError("Story not found", 404)
    ctx = get_shot_context(story_id, shot_id)
    if not ctx:
        raise StoryError("Shot not found", 404)

    shot = ctx["shot"]
    scene = ctx["scene"] or {}
    settings = data["story"].get("settings") or {}

    style = _as_text(settings.get("style")) or "cinematic"
    resolution = _as_text(settings.get("resolution")) or "720p"
    aspect_ratio = _as_text(settings.get("aspect_ratio")) or "16:9"

    characters = _character_entries_for_shot(shot, data.get("cast") or [])
    built_image_prompt, _ = _build_shot_prompts(style, scene, shot, characters)
    prompt = _as_text(shot.get("image_prompt")) or built_image_prompt

    ref_files, ref_labels, ref_roles, _ref_warning = _collect_generation_refs(
        scene, characters
    )

    if not ref_files:
        raise StoryGenerationError(
            "Add at least one cast character or scene anchor before generating a casting clip."
        )

    update_shot(story_id, shot_id, {"status": "generating", "error": ""})
    await free_comfyui_memory()

    casting_prompt = (
        f"{prompt} One-second casting shot that establishes the character identities "
        "and the starting composition for this scene. Stable camera, clear faces."
    ).strip()

    plate = await generate_fasth3_multi_ref_video(
        ref_files,
        [],
        casting_prompt,
        resolution,
        aspect_ratio,
        1,
        image_roles=ref_roles,
        image_labels=ref_labels,
        audio_mode="ambient",
    )
    if not plate or not plate.get("success"):
        raise StoryGenerationError(
            "Casting clip generation failed: "
            + ((plate or {}).get("error") or "unknown error")
        )

    video_filename = _as_text(plate.get("local_filename"))
    if not video_filename or not os.path.isfile(os.path.join("videos", video_filename)):
        raise StoryGenerationError("Casting clip file was not returned")

    try:
        info = probe_video(video_filename)
    except VideoFrameError as exc:
        raise StoryGenerationError(str(exc), 502) from exc
    fps = _to_float(info.get("fps"), 24.0) or 24.0
    cache_key = f"story_{shot_id}_{uuid.uuid4().hex}"
    try:
        frames = extract_frame_window(video_filename, cache_key, fps, 0, 24)
    except VideoFrameError as exc:
        raise StoryGenerationError(str(exc), 502) from exc
    if not frames:
        raise StoryGenerationError("Casting clip produced no frames")

    old_settings = shot.get("settings") if isinstance(shot.get("settings"), dict) else {}
    merged_settings = dict(old_settings)
    merged_settings.update(
        {
            "keyframe_source_video": video_filename,
            "keyframe_cache_key": cache_key,
            "keyframe_fps": fps,
            "keyframe_aspect_ratio": aspect_ratio,
            "keyframe_frames": frames,
            "keyframe_frame_index": None,
        }
    )

    updated = update_shot(
        story_id,
        shot_id,
        {
            "candidate_image_ids": [],
            "selected_image_id": None,
            "status": "keyframes_ready",
            "error": "",
            "settings": merged_settings,
        },
    )
    if old_settings.get("keyframe_source_video") != video_filename:
        _cleanup_keyframe_source({**shot, "settings": old_settings})

    return {
        "shot": updated,
        "frames": frames,
        "source_video": video_filename,
        "fps": fps,
    }


def select_shot_frame(story_id: str, shot_id: str, frame_index: int) -> dict:
    """Save a selected casting-clip frame as the shot's starting image."""
    from services.video_frame_service import VideoFrameError, extract_full_frame, probe_video

    ctx = get_shot_context(story_id, shot_id)
    if not ctx:
        raise StoryError("Shot not found", 404)
    shot = ctx["shot"]
    settings = shot.get("settings") if isinstance(shot.get("settings"), dict) else {}
    video_filename = _as_text(settings.get("keyframe_source_video"))
    if not video_filename or not os.path.isfile(os.path.join("videos", video_filename)):
        raise StoryError("Generate a casting clip before selecting a frame.", 400)
    try:
        info = probe_video(video_filename)
    except VideoFrameError as exc:
        raise StoryError(str(exc), 502) from exc
    fps = _to_float(info.get("fps"), 24.0) or 24.0
    index = int(_clamp(_to_int(frame_index, 0), 0, max(0, int(info.get("frame_count") or 24) - 1)))
    try:
        frame = extract_full_frame(video_filename, index / fps)
    except VideoFrameError as exc:
        raise StoryError(str(exc), 502) from exc

    seq = ctx["scene"].get("scene_number") if ctx.get("scene") else 0
    asset_id = save_generation(
        prompt=f"Story keyframe ? scene {seq} ? shot {shot.get('shot_number')} ? frame {index}",
        filename=frame.get("filename") or "",
        file_type="image",
        aspect_ratio=_as_text(settings.get("keyframe_aspect_ratio")) or "16:9",
        width=frame.get("width", 0) or 0,
        height=frame.get("height", 0) or 0,
        parent_id=None,
        metadata={
            "source": "story_keyframe",
            "story_id": story_id,
            "scene_id": (ctx.get("scene") or {}).get("id") or "",
            "shot_id": shot_id,
            "frame_index": index,
            "source_video": video_filename,
        },
    )
    settings["keyframe_frame_index"] = index
    updated = update_shot(
        story_id,
        shot_id,
        {
            "selected_image_id": asset_id,
            "status": "keyframe_approved",
            "error": "",
            "settings": settings,
        },
    )
    return {"shot": updated, "asset": get_asset_by_id(asset_id), "frame_index": index}


def select_shot_image(story_id: str, shot_id: str, asset_id: str) -> dict:
    """Approve a candidate keyframe for a shot."""
    asset_id = _as_text(asset_id)
    if not asset_id:
        raise StoryError("asset_id is required")
    ctx = get_shot_context(story_id, shot_id)
    if not ctx:
        raise StoryError("Shot not found", 404)
    _image_asset_file(asset_id)
    updated = update_shot(
        story_id,
        shot_id,
        {
            "selected_image_id": asset_id,
            "status": "keyframe_approved",
            "error": "",
        },
    )
    return updated or {}


# === Scene anchor ===

def _scene_anchor_prompt(scene: dict, style: str) -> str:
    parts = [f"{_as_text(style) or 'cinematic'} style"]
    context = []
    for key, label in (
        ("location", "location"),
        ("time_of_day", "time of day"),
        ("weather", "weather"),
        ("lighting", "lighting"),
        ("palette", "color palette"),
        ("mood", "mood"),
        ("props", "props"),
    ):
        value = _as_text(scene.get(key))
        if value:
            context.append(f"{label}: {value}")
    if context:
        parts.append(", ".join(context))
    parts.append(
        "One-second casting shot that establishes the scene location, props and "
        "lighting while keeping every character identity clear. Stable camera, "
        "clear faces, consistent look."
    )
    negative = _as_text(scene.get("negative_prompt"))
    if negative:
        parts.append(f"avoid: {negative}")
    return ". ".join(part for part in parts if part)


async def generate_scene_anchor(story_id: str, scene_id: str) -> dict:
    """Generate a one-second scene casting clip and expose its 24 anchor frames."""
    from services.comfy_service import free_comfyui_memory, generate_fasth3_multi_ref_video
    from services.video_frame_service import (
        VideoFrameError,
        extract_frame_window,
        probe_video,
    )

    conn = get_db()
    story_row = conn.execute(
        "SELECT * FROM story_projects WHERE id = ?", (story_id,)
    ).fetchone()
    scene_row = conn.execute(
        "SELECT * FROM story_scenes WHERE id = ? AND story_id = ?",
        (scene_id, story_id),
    ).fetchone()
    if not story_row:
        conn.close()
        raise StoryError("Story not found", 404)
    if not scene_row:
        conn.close()
        raise StoryError("Scene not found", 404)
    cast = _get_cast(conn, story_id)
    scene = _scene_dict(scene_row, _get_scene_assets(conn, scene_id))
    characters = _scene_character_entries(conn, story_id, scene_id, cast)
    conn.close()

    settings = _parse_json(story_row["settings"], dict(DEFAULT_SETTINGS))
    style = _as_text(settings.get("style")) or "cinematic"
    resolution = _as_text(settings.get("resolution")) or "720p"
    aspect_ratio = _as_text(settings.get("aspect_ratio")) or "16:9"

    ref_scene = dict(scene)
    ref_scene["anchor_image_id"] = None
    ref_files, ref_labels, ref_roles, warning = _collect_generation_refs(
        ref_scene, characters
    )
    if not ref_files:
        raise StoryGenerationError(
            "Add scene reference images or cast characters before generating "
            "a scene anchor."
        )

    prompt = _scene_anchor_prompt(scene, style)
    await free_comfyui_memory()
    plate = await generate_fasth3_multi_ref_video(
        ref_files,
        [],
        prompt,
        resolution,
        aspect_ratio,
        1,
        image_roles=ref_roles,
        image_labels=ref_labels,
        audio_mode="ambient",
    )
    if not plate or not plate.get("success"):
        raise StoryGenerationError(
            "Scene anchor generation failed: "
            + ((plate or {}).get("error") or "unknown error")
        )

    video_filename = _as_text(plate.get("local_filename"))
    if not video_filename or not os.path.isfile(os.path.join("videos", video_filename)):
        raise StoryGenerationError("Scene anchor clip file was not returned")

    cache_key = f"story_scene_{scene_id}_{uuid.uuid4().hex}"
    try:
        info = probe_video(video_filename)
        fps = _to_float(info.get("fps"), 24.0) or 24.0
        frames = extract_frame_window(video_filename, cache_key, fps, 0, 24)
    except VideoFrameError as exc:
        try:
            os.remove(os.path.join("videos", video_filename))
        except OSError:
            pass
        shutil.rmtree(os.path.join("thumbnails", "frames", cache_key), ignore_errors=True)
        raise StoryGenerationError(str(exc), 502) from exc
    if not frames:
        try:
            os.remove(os.path.join("videos", video_filename))
        except OSError:
            pass
        shutil.rmtree(os.path.join("thumbnails", "frames", cache_key), ignore_errors=True)
        raise StoryGenerationError("Scene anchor clip produced no frames")

    old_video = _as_text(scene.get("anchor_source_video"))
    old_cache = _as_text(scene.get("anchor_cache_key"))
    now = _now()
    conn = get_db()
    conn.execute(
        "UPDATE story_scenes SET anchor_frames = ?, anchor_source_video = ?, "
        "anchor_cache_key = ?, anchor_frame_index = NULL, last_updated = ? "
        "WHERE id = ?",
        (json.dumps(frames), video_filename, cache_key, now, scene_id),
    )
    _touch_story(conn, story_id)
    conn.commit()
    row = conn.execute(
        "SELECT * FROM story_scenes WHERE id = ?", (scene_id,)
    ).fetchone()
    updated_scene = _scene_dict(row, _get_scene_assets(conn, scene_id))
    conn.close()

    if old_video != video_filename or old_cache != cache_key:
        _cleanup_scene_anchor(
            {"anchor_source_video": old_video, "anchor_cache_key": old_cache}
        )

    result = {
        "scene": updated_scene,
        "frames": frames,
        "source_video": video_filename,
        "fps": fps,
    }
    if warning:
        result["warning"] = warning
    return result


def select_scene_anchor_frame(story_id: str, scene_id: str, frame_index: int) -> dict:
    """Save a chosen scene-anchor frame as the scene's anchor image asset."""
    from services.video_frame_service import VideoFrameError, extract_full_frame, probe_video

    conn = get_db()
    story_row = conn.execute(
        "SELECT * FROM story_projects WHERE id = ?", (story_id,)
    ).fetchone()
    scene_row = conn.execute(
        "SELECT * FROM story_scenes WHERE id = ? AND story_id = ?",
        (scene_id, story_id),
    ).fetchone()
    if not story_row:
        conn.close()
        raise StoryError("Story not found", 404)
    if not scene_row:
        conn.close()
        raise StoryError("Scene not found", 404)
    scene = _scene_dict(scene_row, _get_scene_assets(conn, scene_id))
    conn.close()

    video_filename = _as_text(scene.get("anchor_source_video"))
    if not video_filename or not os.path.isfile(os.path.join("videos", video_filename)):
        raise StoryError("Generate a scene anchor before selecting a frame.", 400)
    try:
        info = probe_video(video_filename)
    except VideoFrameError as exc:
        raise StoryError(str(exc), 502) from exc
    fps = _to_float(info.get("fps"), 24.0) or 24.0
    frame_count = _to_int(info.get("frame_count"), 24) or 24
    index = int(_clamp(_to_int(frame_index, 0), 0, max(0, frame_count - 1)))
    try:
        frame = extract_full_frame(video_filename, index / fps)
    except VideoFrameError as exc:
        raise StoryError(str(exc), 502) from exc

    settings = _parse_json(story_row["settings"], dict(DEFAULT_SETTINGS))
    aspect_ratio = _as_text(settings.get("aspect_ratio")) or "16:9"
    seq = _to_int(scene.get("scene_number"), 0)
    asset_id = save_generation(
        prompt=f"Story scene anchor - scene {seq} - frame {index}",
        filename=frame.get("filename") or "",
        file_type="image",
        aspect_ratio=aspect_ratio,
        width=frame.get("width", 0) or 0,
        height=frame.get("height", 0) or 0,
        parent_id=None,
        metadata={
            "source": "story_scene_anchor",
            "story_id": story_id,
            "scene_id": scene_id,
            "frame_index": index,
            "source_video": video_filename,
        },
    )
    now = _now()
    conn = get_db()
    conn.execute(
        "UPDATE story_scenes SET anchor_image_id = ?, anchor_frame_index = ?, "
        "last_updated = ? WHERE id = ?",
        (asset_id, index, now, scene_id),
    )
    _touch_story(conn, story_id)
    conn.commit()
    row = conn.execute(
        "SELECT * FROM story_scenes WHERE id = ?", (scene_id,)
    ).fetchone()
    updated_scene = _scene_dict(row, _get_scene_assets(conn, scene_id))
    conn.close()
    return {"scene": updated_scene, "asset": get_asset_by_id(asset_id)}


# === Clip generation ===

def _find_previous_video_shot(story_id: str, shot: dict) -> Optional[dict]:
    conn = get_db()
    parent_id = _as_text(shot.get("parent_shot_id"))
    if parent_id:
        row = conn.execute(
            "SELECT s.* FROM story_shots s "
            "JOIN story_scenes sc ON sc.id = s.scene_id "
            "WHERE s.id = ? AND sc.story_id = ?",
            (parent_id, story_id),
        ).fetchone()
        if row and _as_text(row["video_asset_id"]):
            conn.close()
            return _shot_dict(row)

    row = conn.execute(
        "SELECT * FROM story_shots WHERE scene_id = ? AND shot_number < ? "
        "AND video_asset_id IS NOT NULL AND video_asset_id != '' "
        "ORDER BY shot_number DESC LIMIT 1",
        (shot.get("scene_id"), shot.get("shot_number") or 0),
    ).fetchone()
    conn.close()
    return _shot_dict(row) if row else None


async def generate_shot_clip(story_id: str, shot_id: str) -> dict:
    """Generate a FastH3 clip for a shot using its approved keyframe."""
    try:
        return await _generate_shot_clip_inner(story_id, shot_id)
    except StoryError as exc:
        _set_shot_status(story_id, shot_id, "error", str(exc))
        raise
    except Exception as exc:
        _set_shot_status(story_id, shot_id, "error", str(exc))
        raise StoryGenerationError(str(exc), 502) from exc


async def _generate_shot_clip_inner(story_id: str, shot_id: str) -> dict:
    from services.comfy_service import (
        free_comfyui_memory,
        generate_fasth3_multi_ref_video,
        generate_single_image_to_video,
    )
    from services.video_frame_service import (
        VideoFrameError,
        extract_full_frame,
        extract_video_clip,
        probe_video,
    )

    data = get_story(story_id)
    if not data:
        raise StoryError("Story not found", 404)
    ctx = get_shot_context(story_id, shot_id)
    if not ctx:
        raise StoryError("Shot not found", 404)

    shot = ctx["shot"]
    scene = ctx["scene"] or {}
    settings = data["story"].get("settings") or {}

    video_model = (_as_text(settings.get("video_model")) or "fasth3").lower()
    if video_model != "fasth3":
        raise StoryError(
            "Story V1 clip generation requires the FastH3 video model."
        )

    selected_id = _as_text(shot.get("selected_image_id"))
    selected_filename = ""
    if selected_id:
        _selected_asset, selected_filename = _image_asset_file(selected_id)

    resolution = _as_text(settings.get("resolution")) or "720p"
    aspect_ratio = _as_text(settings.get("aspect_ratio")) or "16:9"
    duration = _clamp(
        _to_float(shot.get("duration"), 6.0),
        FASTH3_MIN_SECONDS,
        FASTH3_MAX_SECONDS,
    )
    continuity = _as_text(shot.get("continuity_mode")) or DEFAULT_MANUAL_CONTINUITY
    if continuity not in CONTINUITY_MODES:
        continuity = DEFAULT_MANUAL_CONTINUITY

    characters = _character_entries_for_shot(shot, data.get("cast") or [])
    _, built_video_prompt = _build_shot_prompts(
        _as_text(settings.get("style")) or "cinematic", scene, shot, characters
    )
    prompt = _as_text(shot.get("video_prompt")) or built_video_prompt

    first_frame_filename = selected_filename
    ref_video_filename = ""
    temp_images: list[str] = []
    temp_videos: list[str] = []

    try:
        if continuity in ("same_scene_frame", "same_scene_video"):
            previous = _find_previous_video_shot(story_id, shot)
            if previous and _as_text(previous.get("video_asset_id")):
                previous_asset = get_asset_by_id(previous["video_asset_id"])
                previous_filename = (previous_asset or {}).get("filename") or ""
                previous_path = os.path.join("videos", previous_filename)
                if previous_filename and os.path.isfile(previous_path):
                    try:
                        info = probe_video(previous_filename)
                    except VideoFrameError as exc:
                        raise StoryGenerationError(str(exc), 502) from exc
                    prev_duration = _to_float(info.get("duration"), 0.0)
                    prev_fps = _to_float(info.get("fps"), 24.0) or 24.0
                    frame_time = max(0.0, prev_duration - (1.0 / prev_fps))
                    try:
                        frame = extract_full_frame(previous_filename, frame_time)
                    except VideoFrameError as exc:
                        raise StoryGenerationError(str(exc), 502) from exc
                    first_frame_filename = frame.get("filename") or selected_filename
                    if first_frame_filename and first_frame_filename != selected_filename:
                        temp_images.append(first_frame_filename)

                    if continuity == "same_scene_video" and prev_duration > 0:
                        clip_start = max(0.0, prev_duration - 2.0)
                        clip_duration = min(2.0, prev_duration)
                        try:
                            clip = extract_video_clip(
                                previous_filename, clip_start, clip_duration
                            )
                        except VideoFrameError as exc:
                            raise StoryGenerationError(str(exc), 502) from exc
                        ref_video_filename = clip.get("filename") or ""
                        if ref_video_filename:
                            temp_videos.append(ref_video_filename)

        ref_filenames, ref_labels, ref_roles, _ref_warning = _collect_generation_refs(
            scene, characters
        )

        if not first_frame_filename and not ref_filenames:
            raise StoryGenerationError(
                "Select a starting frame or add cast/reference images before generating this clip."
            )

        update_shot(story_id, shot_id, {"status": "generating", "error": ""})
        await free_comfyui_memory()

        if ref_filenames:
            result = await generate_fasth3_multi_ref_video(
                ref_filenames,
                [],
                prompt,
                resolution,
                aspect_ratio,
                duration,
                image_roles=ref_roles,
                image_labels=ref_labels,
                first_frame_filename=first_frame_filename or None,
                audio_mode="ambient",
                ref_video_filename=ref_video_filename or None,
            )
        else:
            result = await generate_single_image_to_video(
                first_frame_filename,
                prompt,
                resolution,
                aspect_ratio,
                duration,
                video_model="fasth3",
            )

        if not result or not result.get("success"):
            raise StoryGenerationError(
                (result or {}).get("error") or "Clip generation failed"
            )

        parent_id = selected_id or None
        derived_from: list[str] = []
        if selected_id:
            derived_from.append(selected_id)
        for entry in characters:
            asset_id = entry.get("character_asset_id")
            if asset_id and asset_id not in derived_from:
                derived_from.append(asset_id)

        asset_id = save_generation(
            prompt=prompt,
            filename=result.get("local_filename") or "",
            file_type="video",
            aspect_ratio=aspect_ratio,
            width=result.get("width", 0) or 0,
            height=result.get("height", 0) or 0,
            duration=result.get("duration", duration) or duration,
            parent_id=parent_id,
            derived_from=derived_from,
            metadata={
                "source": "story_clip",
                "story_id": story_id,
                "scene_id": scene.get("id") or "",
                "shot_id": shot_id,
                "parent_selected_keyframe": selected_id,
                "continuity_mode": continuity,
                "video_model": video_model,
                "resolution": resolution,
                "aspect_ratio": aspect_ratio,
                "duration": result.get("duration", duration) or duration,
            },
        )

        updated = update_shot(
            story_id,
            shot_id,
            {
                "video_asset_id": asset_id,
                "status": "ready",
                "error": "",
            },
        )
        return {"shot": updated, "asset": get_asset_by_id(asset_id)}
    finally:
        for filename in temp_images:
            try:
                os.remove(os.path.join("images", filename))
            except OSError:
                pass
        for filename in temp_videos:
            try:
                os.remove(os.path.join("videos", filename))
            except OSError:
                pass


# === ZIP export ===

def _safe_filename(value: str, fallback: str = "story") -> str:
    value = re.sub(r'[\\/:*?"<>|]+', "-", (value or "").strip())
    value = re.sub(r"\s+", " ", value).strip(" .")
    return value or fallback


def build_story_export(story_id: str) -> tuple[bytes, str]:
    """Build an in-memory ZIP with the storyboard, selected clips and manifest."""
    data = get_story(story_id)
    if not data:
        raise StoryError("Story not found", 404)

    story = data["story"]
    clips: list[dict] = []
    missing: list[dict] = []
    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "storyboard.json",
            json.dumps(data, indent=2, ensure_ascii=False),
        )

        for scene in data.get("scenes") or []:
            scene_number = _to_int(scene.get("scene_number"), 0)
            for shot in scene.get("shots") or []:
                shot_number = _to_int(shot.get("shot_number"), 0)
                video_asset_id = _as_text(shot.get("video_asset_id"))
                label = f"scene_{scene_number:02d}_shot_{shot_number:02d}"
                if not video_asset_id:
                    continue
                asset = get_asset_by_id(video_asset_id)
                filename = (asset or {}).get("filename") or ""
                source_path = os.path.join("videos", filename)
                if not asset or not filename or not os.path.isfile(source_path):
                    missing.append(
                        {
                            "scene_number": scene_number,
                            "shot_number": shot_number,
                            "shot_id": shot.get("id") or "",
                            "video_asset_id": video_asset_id,
                            "reason": "video file missing",
                        }
                    )
                    continue
                extension = os.path.splitext(filename)[1] or ".mp4"
                archive_name = f"clips/{label}{extension}"
                archive.write(source_path, archive_name)
                clips.append(
                    {
                        "scene_number": scene_number,
                        "shot_number": shot_number,
                        "shot_id": shot.get("id") or "",
                        "video_asset_id": video_asset_id,
                        "source_filename": filename,
                        "archive_name": archive_name,
                    }
                )

        if missing:
            lines = [
                "Missing selected clips:",
                *[
                    f"scene_{item['scene_number']:02d}_shot_{item['shot_number']:02d} "
                    f"(shot {item['shot_id']}, asset {item['video_asset_id']}): "
                    f"{item['reason']}"
                    for item in missing
                ],
            ]
            archive.writestr("missing.txt", "\n".join(lines) + "\n")

        manifest = {
            "story_id": story_id,
            "title": story.get("title") or "",
            "premise": story.get("premise") or "",
            "settings": story.get("settings") or {},
            "exported_at": _now(),
            "clip_count": len(clips),
            "missing_count": len(missing),
            "clips": clips,
            "missing": missing,
        }
        archive.writestr(
            "manifest.json",
            json.dumps(manifest, indent=2, ensure_ascii=False),
        )

    title = _safe_filename(story.get("title") or "Story", "Story")
    return buffer.getvalue(), f"{title} - story.zip"
