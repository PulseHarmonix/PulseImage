import json
import os
import uuid
from datetime import datetime
import sqlite3
from typing import Optional
from services.database_service import get_db


def _db_row_to_asset(r: sqlite3.Row) -> dict:
    """Convert a DB row to an asset dict matching the JSON schema."""
    import json as _json
    meta = {}
    try:
        raw_meta = r["metadata"]
        if raw_meta:
            meta = _json.loads(raw_meta)
    except Exception:
        meta = {}
    dur = r["duration"] if r["duration"] is not None else None
    if dur is not None:
        meta["duration"] = dur
    return {
        "id": r["id"],
        "type": r["type"],
        "prompt": r["prompt"] or "",
        "filename": r["filename"] or "",
        "width": r["width"] or 0,
        "height": r["height"] or 0,
        "aspect_ratio": r["aspect_ratio"] or "3:2",
        "created": r["created"] or datetime.now().isoformat(),
        "last_updated": r["last_updated"] or datetime.now().isoformat(),
        "parent_id": r["parent_id"],
        "derived_from": [],
        "metadata": meta,
        "children": [],
        "favorite": bool(r["favorite"])
    }


def _upsert_db(asset: dict) -> None:
    """Write a single asset into the generations table."""
    conn = get_db()
    conn.execute(
        """INSERT OR REPLACE INTO generations
           (id, type, prompt, filename, width, height, aspect_ratio, duration,
            parent_id, favorite, metadata, created, last_updated)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            asset["id"],
            asset.get("type", "image"),
            asset.get("prompt", ""),
            asset.get("filename", ""),
            asset.get("width", 0),
            asset.get("height", 0),
            asset.get("aspect_ratio", "3:2"),
            asset.get("metadata", {}).get("duration"),
            asset.get("parent_id"),
            1 if asset.get("favorite") else 0,
            json.dumps({k: v for k, v in asset.get("metadata", {}).items() if k != "duration"}),
            asset.get("created", datetime.now().isoformat()),
            datetime.now().isoformat()
        )
    )
    conn.commit()
    conn.close()


def _delete_db(asset_id: str) -> None:
    """Delete a single asset from the generations table."""
    conn = get_db()
    conn.execute("DELETE FROM generations WHERE id = ?", (asset_id,))
    conn.commit()
    conn.close()


def save_generation(
    prompt: str,
    filename: str,
    file_type: str = "image",
    aspect_ratio: str = "3:2",
    width: int = 0,
    height: int = 0,
    duration: int = None,
    parent_id: str = None,
    derived_from: list = None,
    metadata: dict = None,
    favorite: bool = False
) -> str:
    """Persist a new generation asset to the database and generate its thumbnail."""
    if derived_from is None:
        derived_from = []
    if metadata is None:
        metadata = {}

    new_asset = {
        "id": str(uuid.uuid4()),
        "type": file_type,
        "prompt": prompt,
        "filename": filename,
        "width": width,
        "height": height,
        "aspect_ratio": aspect_ratio,
        "created": datetime.now().isoformat(),
        "last_updated": datetime.now().isoformat(),
        "parent_id": parent_id,
        "derived_from": derived_from,
        "metadata": metadata,
        "children": [],
        "favorite": favorite
    }

    if duration is not None:
        new_asset["metadata"]["duration"] = duration

    _upsert_db(new_asset)

    from services.thumbnail_service import generate_thumbnail
    generate_thumbnail(new_asset)

    return new_asset["id"]


def update_generation(asset_id: str, updates: dict) -> bool:
    """Update editable fields of an existing generation asset."""
    conn = get_db()
    fields = []
    values = []

    field_map = {
        "prompt": "prompt",
        "filename": "filename",
        "type": "type",
        "width": "width",
        "height": "height",
        "aspect_ratio": "aspect_ratio",
        "parent_id": "parent_id",
        "favorite": "favorite",
    }
    for key, col in field_map.items():
        if key in updates:
            val = updates[key]
            if key == "favorite":
                val = 1 if val else 0
            fields.append(f"{col} = ?")
            values.append(val)

    if "metadata" in updates:
        meta = updates["metadata"]
        meta_str = json.dumps(meta) if isinstance(meta, dict) else str(meta)
        fields.append("metadata = ?")
        values.append(meta_str)
        dur = meta.get("duration") if isinstance(meta, dict) else None
        if dur is not None:
            fields.append("duration = ?")
            values.append(dur)

    if fields:
        fields.append("last_updated = datetime('now')")
        values.append(asset_id)
        conn.execute(
            f"UPDATE generations SET {', '.join(fields)} WHERE id = ?", values
        )
        conn.commit()
    conn.close()

    return True


def delete_generation(asset_id: str, cascade: bool = False) -> dict:
    """Delete asset by id, optionally cascading to children. Also deletes the disk file."""
    conn = get_db()
    ids_to_delete = {asset_id}

    if cascade:
        def collect_children(pid: str, collected: set) -> None:
            """Recursively gather all descendant IDs of a given parent."""
            rows = conn.execute("SELECT id FROM generations WHERE parent_id = ?", (pid,)).fetchall()
            for r in rows:
                cid = r["id"]
                if cid not in collected:
                    collected.add(cid)
                    collect_children(cid, collected)
        collect_children(asset_id, ids_to_delete)

    files_deleted = 0
    for gid in ids_to_delete:
        row = conn.execute("SELECT filename, type FROM generations WHERE id = ?", (gid,)).fetchone()
        if row:
            fname = row["filename"]
            if fname:
                gtype = row["type"]
                if gtype == "video" or (isinstance(fname, str) and fname.lower().endswith(".mp4")):
                    folder = "videos"
                elif gtype == "audio" or (isinstance(fname, str) and any(fname.lower().endswith(ext) for ext in [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".webm"])):
                    folder = "audio"
                else:
                    folder = "images"
                fpath = os.path.join(folder, fname)
                try:
                    if os.path.exists(fpath):
                        os.remove(fpath)
                        files_deleted += 1
                except Exception as ex:
                    print(f"Warning: could not remove file {fpath}: {ex}")
        tpath = os.path.join("thumbnails", f"{gid}.jpg")
        try:
            if os.path.exists(tpath):
                os.remove(tpath)
        except Exception as ex:
            print(f"Warning: could not remove thumbnail {tpath}: {ex}")
        conn.execute("DELETE FROM generations WHERE id = ?", (gid,))

    conn.commit()
    conn.close()

    return {"success": True, "deleted_count": len(ids_to_delete), "files_deleted": files_deleted}


def get_asset_by_id(asset_id: str) -> Optional[dict]:
    """Helper to find an asset by its ID."""
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM generations WHERE id = ?", (asset_id,)
    ).fetchone()
    conn.close()
    if row:
        return _db_row_to_asset(row)
    return None


def load_generations() -> list[dict]:
    """Read all generations from the database."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, type, prompt, filename, width, height, aspect_ratio, duration, "
        "parent_id, favorite, metadata, created, last_updated FROM generations ORDER BY created DESC"
    ).fetchall()
    conn.close()

    result = []
    for r in rows:
        result.append(_db_row_to_asset(r))

    by_parent = {}
    for a in result:
        pid = a.get("parent_id")
        if pid:
            by_parent.setdefault(pid, []).append(a["id"])
    for a in result:
        a["children"] = by_parent.get(a["id"], [])

    return result
