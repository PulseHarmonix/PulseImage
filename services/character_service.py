"""Character profiles backed by Library image assets.

Characters are regular generation assets flagged with ``character = 1``.
Profile details live inside ``metadata.character_profile`` so the existing
library, thumbnails and generation flows remain untouched.
"""
from __future__ import annotations

import os

from services.database_service import get_db
from services.generation_service import get_asset_by_id, update_generation, _db_row_to_asset

MAX_REFERENCE_IMAGES = 5
IMAGE_EXTENSIONS = (
    ".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"
)


class CharacterError(Exception):
    """Raised when a character operation cannot be completed."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def _profile_defaults() -> dict:
    return {
        "name": "",
        "description": "",
        "appearance": "",
        "wardrobe": "",
        "aliases": "",
        "tags": [],
        "references": [],
        "voice_asset_id": "",
        "prompt": "",
        "negative_prompt": "",
    }


def _as_text(value) -> str:
    """Coerce a value to a trimmed display string."""
    if value is None:
        return ""
    if isinstance(value, (list, tuple)):
        return ", ".join(part for part in (_as_text(v) for v in value) if part)
    return str(value).strip()


def _is_image_asset(asset: dict | None) -> bool:
    """Return True when the asset represents a library image."""
    if not asset:
        return False
    if (asset.get("type") or "").lower() == "image":
        return True
    filename = (asset.get("filename") or "").lower()
    return bool(filename) and filename.endswith(IMAGE_EXTENSIONS)


def _profile_from_asset(asset: dict) -> dict:
    """Return a complete profile dict, merged over defaults."""
    meta = asset.get("metadata") or {}
    raw = meta.get("character_profile") if isinstance(meta, dict) else None
    profile = _profile_defaults()
    if isinstance(raw, dict):
        profile.update(raw)
    if not isinstance(profile.get("tags"), list):
        profile["tags"] = _normalize_tags(profile.get("tags"))
    if not isinstance(profile.get("references"), list):
        profile["references"] = []
    return profile


def _default_name(asset: dict, profile: dict) -> str:
    """Pick a deterministic fallback name for a character profile."""
    for value in (
        profile.get("name"),
        os.path.splitext(os.path.basename(asset.get("filename") or ""))[0],
        asset.get("prompt"),
    ):
        text = _as_text(value)
        if text:
            return text
    return "Character"


def _normalize_tags(raw) -> list[str]:
    """Normalize tags to a de-duplicated list of strings."""
    if raw is None:
        return []
    if isinstance(raw, str):
        parts = raw.split(",")
    elif isinstance(raw, (list, tuple)):
        parts = list(raw)
    else:
        return []
    tags: list[str] = []
    for part in parts:
        tag = _as_text(part)
        if tag and tag not in tags:
            tags.append(tag)
    return tags


def _normalize_references(raw, primary_asset_id: str) -> list[str]:
    """Validate reference IDs as image assets, capped at five entries."""
    if raw is None:
        return []
    if isinstance(raw, str):
        raw = [raw] if raw.strip() else []
    if not isinstance(raw, (list, tuple)):
        raise CharacterError("references must be a list of image asset IDs")

    references: list[str] = []
    for item in raw:
        if isinstance(item, dict):
            ref_id = _as_text(item.get("id") or item.get("asset_id"))
        else:
            ref_id = _as_text(item)
        if not ref_id or ref_id == primary_asset_id or ref_id in references:
            continue
        ref_asset = get_asset_by_id(ref_id)
        if not ref_asset:
            raise CharacterError(f"Reference image not found: {ref_id}")
        if not _is_image_asset(ref_asset):
            raise CharacterError(f"Reference is not an image asset: {ref_id}")
        references.append(ref_id)
    if len(references) > MAX_REFERENCE_IMAGES:
        raise CharacterError(
            f"Maximum of {MAX_REFERENCE_IMAGES} reference images allowed"
        )
    return references


def _summary(asset: dict) -> dict:
    """Return the compact character shape used by list responses."""
    return {
        "id": asset.get("id") or "",
        "filename": asset.get("filename") or "",
        "prompt": asset.get("prompt") or "",
        "metadata": asset.get("metadata") or {},
        "width": asset.get("width") or 0,
        "height": asset.get("height") or 0,
    }


def _character_assets() -> list[dict]:
    """Load every character-flagged image asset from the library."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, type, prompt, filename, width, height, aspect_ratio, "
        "duration, parent_id, favorite, character, voice, metadata, created, "
        "last_updated FROM generations WHERE character = 1 AND type = 'image' "
        "ORDER BY created DESC"
    ).fetchall()
    conn.close()
    return [_db_row_to_asset(r) for r in rows]


def list_characters() -> list[dict]:
    """Return every character-flagged image asset as a summary."""
    return [_summary(asset) for asset in _character_assets()]


def get_character(asset_id: str) -> dict | None:
    """Return a character-flagged asset, or None when it is not a character."""
    asset = get_asset_by_id(asset_id)
    if not asset or not asset.get("character") or not _is_image_asset(asset):
        return None
    return asset


def update_character(asset_id: str, data: dict) -> dict:
    """Merge profile fields into an image asset and force the character flag."""
    asset = get_asset_by_id(asset_id)
    if not asset:
        raise CharacterError("Asset not found", 404)
    if not _is_image_asset(asset):
        raise CharacterError("Character must be an image asset")

    data = data or {}
    metadata = dict(asset.get("metadata") or {})
    profile = _profile_from_asset(asset)

    if "references" in data:
        profile["references"] = _normalize_references(
            data.get("references"), asset_id
        )
    if "tags" in data:
        profile["tags"] = _normalize_tags(data.get("tags"))

    for key in (
        "description",
        "appearance",
        "wardrobe",
        "aliases",
        "voice_asset_id",
        "prompt",
        "negative_prompt",
    ):
        if key in data:
            profile[key] = _as_text(data.get(key))

    requested_name = _as_text(data.get("name")) if "name" in data else ""
    profile["name"] = requested_name or _default_name(asset, profile)

    metadata["character_profile"] = profile
    update_generation(asset_id, {"metadata": metadata, "character": True})

    updated = get_asset_by_id(asset_id)
    if not updated:
        raise CharacterError("Asset not found after update", 404)
    return updated
