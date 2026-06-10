import json
import os
import uuid
from datetime import datetime

GENERATIONS_FILE = "library.json"

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
):
    if derived_from is None:
        derived_from = []
    if metadata is None:
        metadata = {}

    generations = load_generations()

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

    generations.append(new_asset)

    with open(GENERATIONS_FILE, "w") as f:
        json.dump(generations, f, indent=2)

    return new_asset["id"]

def update_generation(asset_id: str, updates: dict):
    generations = load_generations()
    for item in generations:
        if item.get("id") == asset_id:
            item.update(updates)
            item["last_updated"] = datetime.now().isoformat()
            with open(GENERATIONS_FILE, "w") as f:
                json.dump(generations, f, indent=2)
            return True
    return False

def delete_generation(asset_id: str, cascade: bool = False):
    """Delete asset by id, optionally cascading to related (children/derived). Also deletes the disk file."""
    generations = load_generations()
    ids_to_delete = {asset_id}
    if cascade:
        def collect_related(pid, collected):
            for g in generations:
                gid = g.get("id")
                if gid in collected:
                    continue
                if g.get("parent_id") == pid or (pid in (g.get("derived_from") or [])):
                    collected.add(gid)
                    collect_related(gid, collected)
        collect_related(asset_id, ids_to_delete)

    remaining = []
    files_deleted = 0
    for g in generations:
        if g.get("id") in ids_to_delete:
            fname = g.get("filename")
            if fname:
                gtype = g.get("type", "image")
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
            continue
        remaining.append(g)

    with open(GENERATIONS_FILE, "w") as f:
        json.dump(remaining, f, indent=2)

    return {"success": True, "deleted_count": len(ids_to_delete), "files_deleted": files_deleted}

def get_asset_by_id(asset_id: str):
    """Helper to find an asset by its ID (useful for future referencing features)"""
    generations = load_generations()
    for item in generations:
        if item.get("id") == asset_id:
            return item
    return None

def load_generations():
    if not os.path.exists(GENERATIONS_FILE):
        old_path = "images/generations.json"
        if os.path.exists(old_path):
            try:
                import shutil
                shutil.move(old_path, GENERATIONS_FILE)
            except Exception:
                # fallback load from old if move fails
                with open(old_path, "r") as f:
                    generations = json.load(f)
                return generations
        else:
            return []

    with open(GENERATIONS_FILE, "r") as f:
        generations = json.load(f)

    # Migration from old grouped structure → clean per-asset structure
    migrated = []
    needs_save = False

    for item in generations:
        if "files" in item and isinstance(item.get("files"), list):
            # Convert old multi-file entries
            for f in item["files"]:
                new_item = {
                    "id": str(uuid.uuid4()),
                    "type": f.get("type", "image"),
                    "prompt": item.get("prompt", ""),
                    "filename": f.get("filename"),
                    "width": f.get("width", 0),
                    "height": f.get("height", 0),
                    "aspect_ratio": f.get("aspect_ratio", "3:2"),
                    "created": item.get("created", datetime.now().isoformat()),
                    "last_updated": item.get("last_updated", datetime.now().isoformat()),
                    "parent_id": item.get("parent_id"),
                    "derived_from": item.get("derived_from", []),
                    "metadata": item.get("metadata", {}),
                    "children": []
                }
                if f.get("duration"):
                    new_item["metadata"]["duration"] = f.get("duration")
                new_item["favorite"] = False
                migrated.append(new_item)
            needs_save = True
        else:
            # Already new format
            if "id" not in item:
                item["id"] = str(uuid.uuid4())
                needs_save = True
            if "parent_id" not in item:
                item["parent_id"] = None
                needs_save = True
            if "derived_from" not in item:
                item["derived_from"] = []
                needs_save = True
            if "children" not in item:
                item["children"] = []
                needs_save = True
            if "metadata" not in item:
                item["metadata"] = {}
                needs_save = True
            if "favorite" not in item:
                item["favorite"] = False
                needs_save = True
            migrated.append(item)

    if needs_save:
        with open(GENERATIONS_FILE, "w") as f:
            json.dump(migrated, f, indent=2)
        return migrated

    return generations
