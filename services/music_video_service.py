"""CRUD for Music Video projects, character slots, and time segments.

A project owns an audio track, a global settings block (resolution +
aspect ratio) and eight character slots. Each slot owns a list of time
segments, and each segment can be generated into a video clip.
"""
from __future__ import annotations

import json
import math
import re
import uuid
from datetime import datetime
from typing import Any, Optional

from services.database_service import get_db

SLOT_COUNT = 8
MAX_SLOT_IMAGES = 6
SLOT_IMAGE_ROLES = ("background", "character", "prop", "reference")

DEFAULT_SLOT_NAMES = [
    "Drummer",
    "Guitarist",
    "Bass Guitarist",
    "Singer",
    "Group",
    "Piano",
    "Character 7",
    "Character 8",
]

DEFAULT_SETTINGS = {
    "resolution": "720p",
    "aspect_ratio": "3:2",
    "model": "",
}

SEGMENT_PADDING_SECONDS = 3.0
SEGMENT_MAX_SECONDS = 40.0
SEGMENT_FASTH3_MAX_SECONDS = 15.0
SEGMENT_CHUNK_OVERLAP_SECONDS = 3.0
SEGMENT_STAGGER_SECONDS = 3.0
MUSIC_VIDEO_FPS = 24


_OFFSET_DEFAULTS = {"ltx23": 2, "ltx25": 0, "fasth3": 0}
_MODEL_KEYS = ("ltx23", "ltx25", "fasth3", "grok")


def model_key_from_settings(settings: dict | None = None) -> str:
    """Resolve the current app model to a project model key."""
    if settings is None:
        try:
            from config import load_app_settings
            settings = load_app_settings()
        except Exception:
            settings = {}
    settings = settings or {}
    video_model = (settings.get("video_model") or "ltx").lower()
    if video_model == "grok":
        return "grok"
    if video_model == "fasth3":
        return "fasth3"
    if str(settings.get("ltx_version") or "") == "2.5":
        return "ltx25"
    return "ltx23"


def offset_frames_for_model(model_key: str) -> int:
    """Return the configured timecode offset (in frames) for a model key."""
    try:
        from config import load_app_settings
        s = load_app_settings() or {}
        offsets = dict(_OFFSET_DEFAULTS)
        offsets.update(s.get("segment_timecode_offsets") or {})
        return int(offsets.get(model_key, 0))
    except Exception:
        return 0


def project_model_key(project: dict) -> str:
    """Return a project's stored model key, falling back to the app model."""
    model = (project.get("settings") or {}).get("model")
    if model in _MODEL_KEYS:
        return model
    return model_key_from_settings()


def format_segment_timecode(
    start_time: float, fps: int = MUSIC_VIDEO_FPS, offset_frames: int = 0
) -> str:
    """Format a start time as an editor timecode: {m}m{s}s{f}f (frames 0..fps-1)."""
    total_frames = int(round(max(0.0, float(start_time or 0)) * fps)) + int(offset_frames or 0)
    total_frames = max(0, total_frames)
    total_seconds, frames = divmod(total_frames, fps)
    hours, rem = divmod(total_seconds, 3600)
    minutes, seconds = divmod(rem, 60)
    if hours:
        return f"{hours}h{minutes}m{seconds}s{frames}f"
    return f"{minutes}m{seconds}s{frames}f"


def segment_export_name(
    project_title: str,
    start_time: float,
    character: str,
    offset_frames: int = 0,
    timestamp: str | None = None,
) -> str:
    """Build a readable, filesystem-safe export name for a segment render."""
    start_label = format_segment_timecode(start_time, offset_frames=offset_frames)
    stamp = timestamp or datetime.now().strftime("%Y%m%d-%H%M%S")
    parts = [
        (project_title or "").strip() or "Untitled",
        start_label,
        (character or "").strip() or "Character",
        stamp,
    ]
    return " - ".join(parts)

CHARACTER_PROMPTS = {
    "Drummer": "The woman is playing the drums to the music",
    "Guitarist": "The woman is playing the guitar to the music",
    "Bass Guitarist": "The woman is playing the bass guitar to the music",
    "Singer": "The woman is singing to the music",
    "Group": "The women are playing their instruments to the music",
}


def _now() -> str:
    return datetime.utcnow().isoformat()


def _parse_json(val: Any, default):
    if val is None:
        return default
    if isinstance(val, (dict, list)):
        return val
    try:
        return json.loads(val)
    except Exception:
        return default


def _project_dict(row) -> dict:
    d = dict(row)
    d["settings"] = _parse_json(d.get("settings"), dict(DEFAULT_SETTINGS))
    d["audio"] = _parse_json(d.get("audio"), {})
    return d


def _normalize_image_dict(item: Any) -> Optional[dict]:
    if not isinstance(item, dict):
        return None
    filename = (item.get("filename") or "").strip()
    if not filename:
        return None
    role = str(item.get("role") or "").strip().lower()
    if role not in SLOT_IMAGE_ROLES:
        role = ""
    return {
        "asset_id": item.get("asset_id") or "",
        "filename": filename,
        "name": item.get("name") or "",
        "role": role,
        "label": item.get("label") or "",
    }


def _normalize_slot_images(raw_images: Any, legacy_image: Any = None) -> list[dict]:
    """Normalize a slot image list, applying defaults, role rules and limits."""
    raw = _parse_json(raw_images, [])
    if isinstance(raw, dict):
        raw = [raw]
    if not isinstance(raw, list):
        raw = []

    images = [img for img in (_normalize_image_dict(item) for item in raw) if img]
    if not images:
        legacy = _parse_json(legacy_image, {}) if isinstance(legacy_image, str) else legacy_image
        legacy = _normalize_image_dict(legacy)
        if legacy:
            legacy["role"] = "background"
            images.append(legacy)

    images = images[:MAX_SLOT_IMAGES]

    for index, img in enumerate(images):
        if not img["role"]:
            img["role"] = "background" if index == 0 else "character"

    seen_background = False
    for img in images:
        if img["role"] != "background":
            continue
        if seen_background:
            img["role"] = "character"
        else:
            seen_background = True

    return images


def _slot_dict(row) -> dict:
    d = dict(row)
    legacy_image = _parse_json(d.get("image"), {})
    if not isinstance(legacy_image, dict):
        legacy_image = {}
    images = _normalize_slot_images(d.get("images"), legacy_image)
    d["images"] = images
    d["image"] = dict(images[0]) if images else {}
    d["segments"] = []
    return d


def _segment_dict(row) -> dict:
    d = dict(row)
    d["follow_on"] = bool(d.get("follow_on"))
    d["follow_on_video"] = bool(d.get("follow_on_video"))
    return d


def list_projects() -> list[dict]:
    """Return all music video projects, newest first."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, title, settings, audio, created, last_updated "
        "FROM music_projects ORDER BY last_updated DESC"
    ).fetchall()
    conn.close()
    return [_project_dict(r) for r in rows]


def create_project(title: str = "Untitled Music Video") -> dict:
    """Create a project along with its eight character slots."""
    pid = str(uuid.uuid4())
    now = _now()
    settings = dict(DEFAULT_SETTINGS)
    settings["model"] = model_key_from_settings()
    conn = get_db()
    conn.execute(
        "INSERT INTO music_projects (id, title, settings, audio, created, last_updated) "
        "VALUES (?, ?, ?, '{}', ?, ?)",
        (pid, title or "Untitled Music Video", json.dumps(settings), now, now),
    )
    for i in range(SLOT_COUNT):
        conn.execute(
            "INSERT INTO music_slots (id, project_id, slot_number, name, image, created, last_updated) "
            "VALUES (?, ?, ?, ?, '{}', ?, ?)",
            (str(uuid.uuid4()), pid, i + 1, DEFAULT_SLOT_NAMES[i], now, now),
        )
    conn.commit()
    conn.close()
    return get_project(pid)


def get_project(project_id: str) -> Optional[dict]:
    """Return a project with its slots and their segments."""
    conn = get_db()
    row = conn.execute(
        "SELECT id, title, settings, audio, created, last_updated "
        "FROM music_projects WHERE id = ?",
        (project_id,),
    ).fetchone()
    if not row:
        conn.close()
        return None
    project = _project_dict(row)

    # Backfill a readable audio name for projects saved before we stored it.
    audio = project.get("audio") or {}
    if audio.get("filename") and not (audio.get("name") or "").strip():
        name_row = None
        if audio.get("asset_id"):
            name_row = conn.execute(
                "SELECT prompt FROM generations WHERE id = ?", (audio["asset_id"],)
            ).fetchone()
        if (not name_row or not (name_row["prompt"] or "").strip()):
            name_row = conn.execute(
                "SELECT prompt FROM generations WHERE filename = ?", (audio["filename"],)
            ).fetchone()
        if name_row and (name_row["prompt"] or "").strip():
            audio["name"] = name_row["prompt"].strip()
            project["audio"] = audio

    slot_rows = conn.execute(
        "SELECT * FROM music_slots WHERE project_id = ? ORDER BY slot_number ASC",
        (project_id,),
    ).fetchall()
    slots = [_slot_dict(s) for s in slot_rows]

    seg_rows = conn.execute(
        "SELECT s.* FROM music_segments s "
        "JOIN music_slots sl ON sl.id = s.slot_id "
        "WHERE sl.project_id = ? ORDER BY s.start_time ASC, s.created ASC",
        (project_id,),
    ).fetchall()

    by_slot: dict[str, list] = {}
    for s in seg_rows:
        by_slot.setdefault(s["slot_id"], []).append(_segment_dict(s))
    for slot in slots:
        slot["segments"] = by_slot.get(slot["id"], [])

    conn.close()
    project["slots"] = slots
    return project


def update_title(project_id: str, title: str) -> bool:
    conn = get_db()
    cur = conn.execute(
        "UPDATE music_projects SET title = ?, last_updated = ? WHERE id = ?",
        (title or "Untitled Music Video", _now(), project_id),
    )
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def delete_project(project_id: str) -> bool:
    conn = get_db()
    conn.execute(
        "DELETE FROM music_segments WHERE slot_id IN "
        "(SELECT id FROM music_slots WHERE project_id = ?)",
        (project_id,),
    )
    conn.execute("DELETE FROM music_slots WHERE project_id = ?", (project_id,))
    cur = conn.execute("DELETE FROM music_projects WHERE id = ?", (project_id,))
    conn.commit()
    ok = cur.rowcount > 0
    conn.close()
    return ok


def _touch_project(conn, project_id: str) -> None:
    conn.execute(
        "UPDATE music_projects SET last_updated = ? WHERE id = ?",
        (_now(), project_id),
    )


def update_settings(project_id: str, settings: dict) -> Optional[dict]:
    """Merge new settings (resolution/aspect_ratio) into a project."""
    conn = get_db()
    row = conn.execute(
        "SELECT settings FROM music_projects WHERE id = ?", (project_id,)
    ).fetchone()
    if not row:
        conn.close()
        return None
    current = _parse_json(row["settings"], dict(DEFAULT_SETTINGS))
    if isinstance(settings, dict):
        current.update(settings)
    model = str(current.get("model") or "").strip()
    if model not in ("", "ltx23", "ltx25", "fasth3", "grok"):
        model = ""
    current["model"] = model
    conn.execute(
        "UPDATE music_projects SET settings = ?, last_updated = ? WHERE id = ?",
        (json.dumps(current), _now(), project_id),
    )
    conn.commit()
    conn.close()
    return current


def set_audio(project_id: str, audio: dict) -> Optional[dict]:
    """Set (or clear) the project's audio track reference."""
    conn = get_db()
    row = conn.execute(
        "SELECT id FROM music_projects WHERE id = ?", (project_id,)
    ).fetchone()
    if not row:
        conn.close()
        return None
    conn.execute(
        "UPDATE music_projects SET audio = ?, last_updated = ? WHERE id = ?",
        (json.dumps(audio or {}), _now(), project_id),
    )
    conn.commit()
    conn.close()
    return audio or {}


def update_slot(slot_id: str, data: dict) -> Optional[dict]:
    """Update a slot's name and/or image references."""
    conn = get_db()
    row = conn.execute("SELECT * FROM music_slots WHERE id = ?", (slot_id,)).fetchone()
    if not row:
        conn.close()
        return None

    fields = []
    values: list = []
    if "name" in data:
        fields.append("name = ?")
        values.append(data.get("name") or "")
    if "images" in data or "image" in data:
        if "images" in data:
            images = _normalize_slot_images(data.get("images"))
        else:
            images = _normalize_slot_images(None, data.get("image"))
        fields.append("images = ?")
        values.append(json.dumps(images))
        fields.append("image = ?")
        values.append(json.dumps(images[0] if images else {}))

    if fields:
        fields.append("last_updated = ?")
        values.append(_now())
        values.append(slot_id)
        conn.execute(f"UPDATE music_slots SET {', '.join(fields)} WHERE id = ?", values)
        _touch_project(conn, row["project_id"])
        conn.commit()

    slot = conn.execute("SELECT * FROM music_slots WHERE id = ?", (slot_id,)).fetchone()
    conn.close()
    return _slot_dict(slot) if slot else None


def get_slot(slot_id: str) -> Optional[dict]:
    conn = get_db()
    row = conn.execute("SELECT * FROM music_slots WHERE id = ?", (slot_id,)).fetchone()
    conn.close()
    return _slot_dict(row) if row else None


def add_segment(slot_id: str, start_time: float = 0, end_time: float = 0, prompt: str = "") -> Optional[dict]:
    conn = get_db()
    slot = conn.execute("SELECT id, project_id FROM music_slots WHERE id = ?", (slot_id,)).fetchone()
    if not slot:
        conn.close()
        return None
    sid = str(uuid.uuid4())
    now = _now()
    conn.execute(
        "INSERT INTO music_segments (id, slot_id, start_time, end_time, prompt, status, created, last_updated) "
        "VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)",
        (sid, slot_id, float(start_time or 0), float(end_time or 0), prompt or "", now, now),
    )
    _touch_project(conn, slot["project_id"])
    conn.commit()
    seg = conn.execute("SELECT * FROM music_segments WHERE id = ?", (sid,)).fetchone()
    conn.close()
    return _segment_dict(seg) if seg else None


def auto_create_segments(project_id: str) -> dict:
    """Create segments from section timings for image slots that have none.

    - Pads each section by SEGMENT_PADDING_SECONDS, clamped to the audio length.
    - Staggers each image slot's start from 0s down to -SEGMENT_STAGGER_SECONDS.
    - Splits long sections into chunks with SEGMENT_CHUNK_OVERLAP_SECONDS overlap.
    - Uses 15s chunks for FastH3 and 30s for LTX.
    - Skips slots without an image or that already have segments.
    """
    from services.audio_service import get_audio_duration

    project = get_project(project_id)
    if not project:
        return {"created": 0, "slots_processed": 0, "slots_skipped": 0, "sections": 0}

    model_key = project_model_key(project)
    max_seconds = SEGMENT_FASTH3_MAX_SECONDS if model_key == "fasth3" else SEGMENT_MAX_SECONDS

    audio = project.get("audio") or {}
    audio_filename = audio.get("filename")
    audio_duration = get_audio_duration(audio_filename) if audio_filename else None

    sections = [
        s for s in (project.get("settings") or {}).get("sections", [])
        if float(s.get("end") or 0) > float(s.get("start") or 0)
    ]

    image_slots = [
        slot for slot in project.get("slots", [])
        if (slot.get("images") or []) or (slot.get("image") or {}).get("filename")
    ]
    slot_count = len(image_slots)

    conn = get_db()
    now = _now()
    created = 0
    processed = 0
    skipped = 0
    try:
        for slot_index, slot in enumerate(image_slots):
            if slot.get("segments"):
                skipped += 1
                continue
            processed += 1
            # Stagger scene starts from 0s down to -SEGMENT_STAGGER_SECONDS.
            offset = (slot_index * SEGMENT_STAGGER_SECONDS / (slot_count - 1)) if slot_count > 1 else 0.0
            prompt = CHARACTER_PROMPTS.get(
                (slot.get("name") or "").strip(),
                "The character is performing to the music",
            )
            for sec in sections:
                start = max(0.0, float(sec.get("start") or 0) - SEGMENT_PADDING_SECONDS - offset)
                end = float(sec.get("end") or 0) + SEGMENT_PADDING_SECONDS
                if audio_duration:
                    end = min(end, audio_duration)
                if end <= start:
                    continue
                span = end - start
                if span <= max_seconds:
                    count = 1
                    chunk = span
                else:
                    usable = max(1.0, max_seconds - SEGMENT_CHUNK_OVERLAP_SECONDS)
                    count = max(1, math.ceil(span / usable))
                    chunk = span / count
                for i in range(count):
                    seg_start = start + i * chunk
                    if i == count - 1:
                        seg_end = end
                    else:
                        seg_end = min(end, seg_start + chunk + SEGMENT_CHUNK_OVERLAP_SECONDS)
                    conn.execute(
                        "INSERT INTO music_segments "
                        "(id, slot_id, start_time, end_time, prompt, status, created, last_updated) "
                        "VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)",
                        (
                            str(uuid.uuid4()),
                            slot["id"],
                            round(seg_start, 2),
                            round(seg_end, 2),
                            prompt,
                            now,
                            now,
                        ),
                    )
                    created += 1
        if created:
            _touch_project(conn, project_id)
        conn.commit()
    finally:
        conn.close()

    return {
        "created": created,
        "slots_processed": processed,
        "slots_skipped": skipped,
        "sections": len(sections),
    }


def list_segment_videos(project_id: str) -> list[dict]:
    """Return generated segment videos for a project, with library display names."""
    from services.generation_service import get_asset_by_id

    project = get_project(project_id)
    if not project:
        return []

    model_key = project_model_key(project)
    offset = offset_frames_for_model(model_key)

    items = []
    for slot in project.get("slots", []):
        character = (slot.get("name") or "Character").strip() or "Character"
        for seg in slot.get("segments", []):
            if not seg.get("video_filename"):
                continue
            asset = get_asset_by_id(seg["video_asset_id"]) if seg.get("video_asset_id") else None
            if asset:
                filename = asset.get("filename") or seg["video_filename"]
                name = (asset.get("metadata") or {}).get("name") or ""
            else:
                filename = seg["video_filename"]
                name = ""
            stamp = None
            if name:
                last = name.rsplit(" - ", 1)[-1]
                if re.match(r"^\d{8}-\d{6}$", last):
                    stamp = last
            if not stamp and asset:
                try:
                    stamp = datetime.fromisoformat(str(asset.get("created"))).strftime("%Y%m%d-%H%M%S")
                except Exception:
                    stamp = None
            if not stamp:
                stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            start = float(seg.get("start_time") or 0)
            export_name = segment_export_name(
                project.get("title") or "",
                start,
                character,
                offset_frames=offset,
                timestamp=stamp,
            )
            items.append({
                "character": character,
                "filename": filename,
                "name": name,
                "export_name": export_name,
                "model": model_key,
                "offset_frames": offset,
                "timestamp": stamp,
                "start": start,
                "end": float(seg.get("end_time") or 0),
            })
    return items


def update_segment(segment_id: str, data: dict) -> Optional[dict]:
    """Update a segment's start/end/prompt."""
    conn = get_db()
    row = conn.execute(
        "SELECT s.*, sl.project_id AS project_id FROM music_segments s "
        "JOIN music_slots sl ON sl.id = s.slot_id WHERE s.id = ?",
        (segment_id,),
    ).fetchone()
    if not row:
        conn.close()
        return None

    fields = []
    values: list = []
    if "start_time" in data:
        try:
            fields.append("start_time = ?")
            values.append(float(data.get("start_time") or 0))
        except (TypeError, ValueError):
            pass
    if "end_time" in data:
        try:
            fields.append("end_time = ?")
            values.append(float(data.get("end_time") or 0))
        except (TypeError, ValueError):
            pass
    if "prompt" in data:
        fields.append("prompt = ?")
        values.append(data.get("prompt") or "")
    if "follow_on" in data:
        fields.append("follow_on = ?")
        values.append(1 if data.get("follow_on") else 0)
    if "follow_on_video" in data:
        fields.append("follow_on_video = ?")
        values.append(1 if data.get("follow_on_video") else 0)

    if fields:
        fields.append("last_updated = ?")
        values.append(_now())
        values.append(segment_id)
        conn.execute(f"UPDATE music_segments SET {', '.join(fields)} WHERE id = ?", values)
        _touch_project(conn, row["project_id"])
        conn.commit()

    seg = conn.execute("SELECT * FROM music_segments WHERE id = ?", (segment_id,)).fetchone()
    conn.close()
    return _segment_dict(seg) if seg else None


def get_previous_segment(segment_id: str) -> Optional[dict]:
    """Return the previous segment in the same slot, ordered by start/created."""
    conn = get_db()
    current = conn.execute(
        "SELECT * FROM music_segments WHERE id = ?", (segment_id,)
    ).fetchone()
    if not current:
        conn.close()
        return None
    row = conn.execute(
        "SELECT * FROM music_segments "
        "WHERE slot_id = ? AND id != ? AND "
        "(start_time < ? OR (start_time = ? AND created < ?)) "
        "ORDER BY start_time DESC, created DESC LIMIT 1",
        (
            current["slot_id"],
            segment_id,
            current["start_time"],
            current["start_time"],
            current["created"],
        ),
    ).fetchone()
    conn.close()
    return _segment_dict(row) if row else None


def delete_segment(segment_id: str) -> bool:
    conn = get_db()
    row = conn.execute(
        "SELECT s.id, sl.project_id AS project_id FROM music_segments s "
        "JOIN music_slots sl ON sl.id = s.slot_id WHERE s.id = ?",
        (segment_id,),
    ).fetchone()
    if not row:
        conn.close()
        return False
    conn.execute("DELETE FROM music_segments WHERE id = ?", (segment_id,))
    _touch_project(conn, row["project_id"])
    conn.commit()
    conn.close()
    return True


def clear_segments(project_id: str) -> int:
    """Delete every segment belonging to a project's slots. Returns the count."""
    conn = get_db()
    exists = conn.execute("SELECT id FROM music_projects WHERE id = ?", (project_id,)).fetchone()
    if not exists:
        conn.close()
        return 0
    cur = conn.execute(
        "DELETE FROM music_segments WHERE slot_id IN "
        "(SELECT id FROM music_slots WHERE project_id = ?)",
        (project_id,),
    )
    _touch_project(conn, project_id)
    conn.commit()
    deleted = cur.rowcount
    conn.close()
    return deleted


def set_segment_status(segment_id: str, status: str, error: str = "") -> None:
    """Update only the status/error of a segment (used during generation)."""
    conn = get_db()
    conn.execute(
        "UPDATE music_segments SET status = ?, error = ?, last_updated = ? WHERE id = ?",
        (status, error or "", _now(), segment_id),
    )
    conn.commit()
    conn.close()


def reset_interrupted_segments() -> int:
    """Mark segments left in 'generating' (e.g. after a restart) as interrupted."""
    conn = get_db()
    cur = conn.execute(
        "UPDATE music_segments SET status = 'error', error = 'Interrupted', last_updated = ? "
        "WHERE status = 'generating'",
        (_now(),),
    )
    conn.commit()
    count = cur.rowcount
    conn.close()
    return count


def set_segment_result(segment_id: str, video_asset_id: str, video_filename: str) -> Optional[dict]:
    """Store the generated video reference on a segment and mark it ready."""
    conn = get_db()
    conn.execute(
        "UPDATE music_segments SET video_asset_id = ?, video_filename = ?, status = 'ready', "
        "error = '', last_updated = ? WHERE id = ?",
        (video_asset_id, video_filename, _now(), segment_id),
    )
    conn.commit()
    seg = conn.execute("SELECT * FROM music_segments WHERE id = ?", (segment_id,)).fetchone()
    conn.close()
    return _segment_dict(seg) if seg else None


def get_segment_context(segment_id: str) -> Optional[dict]:
    """Return the segment together with its slot and project (for generation)."""
    conn = get_db()
    seg = conn.execute("SELECT * FROM music_segments WHERE id = ?", (segment_id,)).fetchone()
    if not seg:
        conn.close()
        return None
    slot = conn.execute("SELECT * FROM music_slots WHERE id = ?", (seg["slot_id"],)).fetchone()
    if not slot:
        conn.close()
        return None
    project = conn.execute(
        "SELECT * FROM music_projects WHERE id = ?", (slot["project_id"],)
    ).fetchone()
    conn.close()
    if not project:
        return None
    return {
        "segment": _segment_dict(seg),
        "slot": _slot_dict(slot),
        "project": _project_dict(project),
    }
