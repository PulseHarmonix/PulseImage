"""
Grok Imagine (xAI) image generation and editing.

Uses REST endpoints:
  POST https://api.x.ai/v1/images/generations  (T2I)
  POST https://api.x.ai/v1/images/edits        (I2I / multi-ref edit)

API key from settings `xai_api_key` (SQLite), with optional env `XAI_API_KEY` fallback.
"""
from __future__ import annotations

import asyncio
import base64
import os
import uuid
from typing import Optional

import httpx

IMAGES_FOLDER = "images"
XAI_BASE = "https://api.x.ai/v1"
GROK_MODEL_IDS = ("grok", "grok-quality")
XAI_MODEL_MAP = {
    "grok": "grok-imagine-image",
    "grok-quality": "grok-imagine-image-quality",
}

try:
    from PIL import Image
except ImportError:
    Image = None  # type: ignore


def is_grok_model(model_id: Optional[str]) -> bool:
    return (model_id or "") in GROK_MODEL_IDS


def resolve_xai_model(model_id: Optional[str]) -> str:
    return XAI_MODEL_MAP.get(model_id or "", "grok-imagine-image-quality")


def map_resolution(bb_res: Optional[str]) -> str:
    """Map Pulse bottom-bar resolution to Imagine 1k/2k."""
    r = (bb_res or "720p").strip().lower()
    if r in ("1080p", "1080", "2k"):
        return "2k"
    return "1k"


def _sanitize_api_key(raw: object) -> str:
    """Normalize key from settings/env (strip quotes, whitespace, accidental JSON wrapping)."""
    if raw is None:
        return ""
    key = str(raw).strip()
    # Unwrap JSON-encoded strings e.g. "\"xai-...\""
    if (key.startswith('"') and key.endswith('"')) or (key.startswith("'") and key.endswith("'")):
        key = key[1:-1].strip()
    # Remove common accidental prefixes/labels
    for prefix in ("Bearer ", "bearer ", "API_KEY=", "XAI_API_KEY="):
        if key.startswith(prefix):
            key = key[len(prefix):].strip()
    return key.strip()


def get_xai_api_key() -> str:
    """Prefer SQLite setting; fall back to env XAI_API_KEY."""
    try:
        from config import load_app_settings
        key = _sanitize_api_key(load_app_settings().get("xai_api_key"))
        if key:
            return key
    except Exception:
        pass
    return _sanitize_api_key(os.environ.get("XAI_API_KEY"))


def _mime_for_path(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    if ext in (".jpg", ".jpeg"):
        return "image/jpeg"
    if ext == ".webp":
        return "image/webp"
    if ext == ".gif":
        return "image/gif"
    return "image/png"


def file_to_data_uri(local_filename: str) -> str:
    path = os.path.join(IMAGES_FOLDER, local_filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Source image not found: {path}")
    with open(path, "rb") as f:
        data = f.read()
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{_mime_for_path(path)};base64,{b64}"


def save_b64_to_images(b64_data: str) -> dict:
    """Decode base64 image, save under images/, return success dict with dims."""
    # Strip data-URI prefix if present
    if "," in b64_data and b64_data.strip().startswith("data:"):
        b64_data = b64_data.split(",", 1)[1]
    raw = base64.b64decode(b64_data)
    # Detect format from magic bytes
    ext = "png"
    if raw[:3] == b"\xff\xd8\xff":
        ext = "jpg"
    elif raw[:4] == b"RIFF":
        ext = "webp"
    filename = f"{uuid.uuid4().hex}.{ext}"
    os.makedirs(IMAGES_FOLDER, exist_ok=True)
    path = os.path.join(IMAGES_FOLDER, filename)
    with open(path, "wb") as f:
        f.write(raw)
    width, height = 0, 0
    if Image is not None:
        try:
            with Image.open(path) as img:
                width, height = img.size
        except Exception:
            pass
    return {
        "success": True,
        "local_filename": filename,
        "width": width,
        "height": height,
    }


async def _download_url_to_images(url: str) -> dict:
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.get(url)
        r.raise_for_status()
        raw = r.content
    ext = "png"
    ctype = (r.headers.get("content-type") or "").lower()
    if "jpeg" in ctype or "jpg" in ctype:
        ext = "jpg"
    elif "webp" in ctype:
        ext = "webp"
    elif raw[:3] == b"\xff\xd8\xff":
        ext = "jpg"
    filename = f"{uuid.uuid4().hex}.{ext}"
    path = os.path.join(IMAGES_FOLDER, filename)
    os.makedirs(IMAGES_FOLDER, exist_ok=True)
    with open(path, "wb") as f:
        f.write(raw)
    width, height = 0, 0
    if Image is not None:
        try:
            with Image.open(path) as img:
                width, height = img.size
        except Exception:
            pass
    return {
        "success": True,
        "local_filename": filename,
        "width": width,
        "height": height,
    }


async def _parse_image_items(data: dict) -> list[dict]:
    """Convert API response data[] items to local file results."""
    items = data.get("data") or []
    results = []
    for item in items:
        if not isinstance(item, dict):
            continue
        b64 = item.get("b64_json")
        if b64:
            results.append(save_b64_to_images(b64))
            continue
        url = item.get("url")
        if url:
            try:
                results.append(await _download_url_to_images(url))
            except Exception as e:
                results.append({"success": False, "error": f"Download failed: {e}"})
    return results


async def generate_images(
    prompt: str,
    resolution: str = "720p",
    aspect_ratio: str = "3:2",
    count: int = 1,
    image_model: str = "grok-quality",
) -> list[dict]:
    """Text-to-image via Grok Imagine. Returns list of result dicts."""
    api_key = get_xai_api_key()
    if not api_key:
        return [{
            "success": False,
            "error": "xAI API key not set. Add xai_api_key in Admin → Settings Editor (or set XAI_API_KEY).",
        }] * max(1, count)

    total = max(1, int(count or 1))
    all_results: list[dict] = []
    remaining = total
    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            while remaining > 0:
                n = min(remaining, 10)  # API max per request
                body = {
                    "model": resolve_xai_model(image_model),
                    "prompt": prompt,
                    "n": n,
                    "aspect_ratio": aspect_ratio or "3:2",
                    "resolution": map_resolution(resolution),
                    "response_format": "b64_json",
                }
                print(f"[GROK T2I] model={body['model']} n={n} (batch of {total}) res={body['resolution']}")
                r = await client.post(
                    f"{XAI_BASE}/images/generations",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json=body,
                )
                if r.status_code >= 400:
                    err_txt = r.text[:500]
                    print(f"[GROK T2I] HTTP {r.status_code}: {err_txt}")
                    if r.status_code in (401, 403) or "Incorrect API key" in err_txt:
                        err = {
                            "success": False,
                            "error": (
                                "xAI rejected the API key. Paste the secret from console.x.ai "
                                "into Admin → Settings Editor → xai_api_key."
                            ),
                        }
                        return [err] * total
                    all_results.extend([{"success": False, "error": f"xAI API {r.status_code}: {err_txt}"}] * n)
                    remaining -= n
                    continue
                data = r.json()
                batch = await _parse_image_items(data)
                if not batch:
                    all_results.extend([{"success": False, "error": "No images in xAI response"}] * n)
                else:
                    all_results.extend(batch)
                remaining -= n
        while len(all_results) < total:
            all_results.append({"success": False, "error": "Missing image in batch response"})
        return all_results[:total]
    except Exception as e:
        print(f"[GROK T2I] Error: {e}")
        import traceback
        traceback.print_exc()
        return [{"success": False, "error": str(e)}] * total


async def generate_single_image(
    prompt: str,
    resolution: str = "720p",
    aspect_ratio: str = "3:2",
    image_model: str = "grok-quality",
) -> dict:
    results = await generate_images(prompt, resolution, aspect_ratio, count=1, image_model=image_model)
    return results[0] if results else {"success": False, "error": "No result"}


async def edit_images(
    source_filenames: list[str],
    prompt: str,
    resolution: str = "720p",
    aspect_ratio: Optional[str] = None,
    i2i_model: str = "grok-quality",
    count: int = 1,
) -> list[dict]:
    """Image edit with 1–3 local source images (filenames under images/)."""
    api_key = get_xai_api_key()
    if not api_key:
        return [{
            "success": False,
            "error": "xAI API key not set. Add xai_api_key in Admin → Settings Editor (or set XAI_API_KEY).",
        }]

    if not source_filenames:
        return [{"success": False, "error": "No source images"}]

    try:
        uris = [file_to_data_uri(fn) for fn in source_filenames[:3]]
    except Exception as e:
        return [{"success": False, "error": str(e)}]

    n = max(1, min(int(count or 1), 10))
    body: dict = {
        "model": resolve_xai_model(i2i_model),
        "prompt": prompt,
        "n": n,
        "response_format": "b64_json",
        "resolution": map_resolution(resolution),
    }
    if len(uris) == 1:
        body["image"] = {"url": uris[0], "type": "image_url"}
    else:
        body["images"] = [{"url": u, "type": "image_url"} for u in uris]
        if aspect_ratio:
            body["aspect_ratio"] = aspect_ratio

    print(f"[GROK I2I] model={body['model']} refs={len(uris)} n={n}")

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            r = await client.post(
                f"{XAI_BASE}/images/edits",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            if r.status_code >= 400:
                err_txt = r.text[:500]
                print(f"[GROK I2I] HTTP {r.status_code}: {err_txt}")
                return [{"success": False, "error": f"xAI API {r.status_code}: {err_txt}"}]
            data = r.json()
        results = await _parse_image_items(data)
        if not results:
            return [{"success": False, "error": "No images in xAI edit response"}]
        return results
    except Exception as e:
        print(f"[GROK I2I] Error: {e}")
        import traceback
        traceback.print_exc()
        return [{"success": False, "error": str(e)}]


async def edit_single_image(
    source_filename: str,
    prompt: str,
    i2i_model: str = "grok-quality",
    resolution: str = "720p",
) -> dict:
    results = await edit_images(
        [source_filename], prompt, resolution=resolution, i2i_model=i2i_model, count=1
    )
    return results[0] if results else {"success": False, "error": "No result"}


async def edit_double_image(
    main_filename: str,
    second_filename: str,
    prompt: str,
    i2i_model: str = "grok-quality",
    aspect_ratio: Optional[str] = None,
    resolution: str = "720p",
) -> dict:
    results = await edit_images(
        [main_filename, second_filename],
        prompt,
        resolution=resolution,
        aspect_ratio=aspect_ratio,
        i2i_model=i2i_model,
        count=1,
    )
    return results[0] if results else {"success": False, "error": "No result"}


# ---------------------------------------------------------------------------
# Video (async poll)
# ---------------------------------------------------------------------------

VIDEOS_FOLDER = "videos"
GROK_VIDEO_MODEL = "grok-imagine-video"
GROK_VIDEO_MAX_DURATION = 15


def is_grok_video_model(model_id: Optional[str]) -> bool:
    return (model_id or "").strip().lower() == "grok"


def map_video_resolution(bb_res: Optional[str]) -> str:
    """Map Pulse res to Grok video: 480p | 720p (1080p → 720p for base model)."""
    r = (bb_res or "720p").strip().lower()
    if r in ("480p", "480"):
        return "480p"
    if r in ("1080p", "1080"):
        # grok-imagine-video: prefer 720p; 1080p mainly for 1.5 I2V
        return "720p"
    return "720p"


def clamp_video_duration(duration) -> int:
    try:
        d = int(duration or 6)
    except Exception:
        d = 6
    return max(1, min(d, GROK_VIDEO_MAX_DURATION))


async def _download_video_url(url: str) -> str:
    """Download remote mp4 to videos/ folder; return local filename."""
    os.makedirs(VIDEOS_FOLDER, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.mp4"
    path = os.path.join(VIDEOS_FOLDER, filename)
    async with httpx.AsyncClient(timeout=300.0, follow_redirects=True) as client:
        r = await client.get(url)
        r.raise_for_status()
        with open(path, "wb") as f:
            f.write(r.content)
    return filename


async def generate_video(
    prompt: str,
    resolution: str = "720p",
    aspect_ratio: str = "16:9",
    duration: int = 6,
    source_image_filename: Optional[str] = None,
) -> dict:
    """
    Text-to-video or image-to-video via Grok Imagine.
    Async: POST generations → poll GET /videos/{id} → download mp4.
    """
    api_key = get_xai_api_key()
    if not api_key:
        return {
            "success": False,
            "error": "xAI API key not set. Add xai_api_key in Admin → Settings Editor.",
        }

    dur = clamp_video_duration(duration)
    res = map_video_resolution(resolution)
    ar = aspect_ratio or "16:9"
    body: dict = {
        "model": GROK_VIDEO_MODEL,
        "prompt": prompt,
        "duration": dur,
        "aspect_ratio": ar,
        "resolution": res,
    }
    if source_image_filename:
        try:
            uri = file_to_data_uri(source_image_filename)
            body["image"] = {"url": uri, "type": "image_url"}
        except Exception as e:
            return {"success": False, "error": f"Source image: {e}"}

    mode = "I2V" if source_image_filename else "T2V"
    print(f"[GROK VIDEO {mode}] model={GROK_VIDEO_MODEL} dur={dur}s res={res} ar={ar}")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            start = await client.post(
                f"{XAI_BASE}/videos/generations",
                headers=headers,
                json=body,
            )
            if start.status_code >= 400:
                err_txt = start.text[:500]
                print(f"[GROK VIDEO] start HTTP {start.status_code}: {err_txt}")
                if "Incorrect API key" in err_txt or start.status_code in (401, 403):
                    return {
                        "success": False,
                        "error": "xAI rejected the API key. Check xai_api_key in Settings Editor.",
                    }
                return {"success": False, "error": f"xAI video start {start.status_code}: {err_txt}"}

            start_data = start.json()
            request_id = start_data.get("request_id")
            if not request_id:
                return {"success": False, "error": f"No request_id from xAI: {start_data}"}

            print(f"[GROK VIDEO] request_id={request_id}")

            # Poll — video can take several minutes
            max_polls = 180  # ~15 min at 5s
            poll_headers = {"Authorization": f"Bearer {api_key}"}
            for attempt in range(max_polls):
                await asyncio.sleep(5)
                poll = await client.get(
                    f"{XAI_BASE}/videos/{request_id}",
                    headers=poll_headers,
                    timeout=60.0,
                )
                if poll.status_code >= 400:
                    print(f"[GROK VIDEO] poll HTTP {poll.status_code}: {poll.text[:300]}")
                    continue
                data = poll.json()
                status = (data.get("status") or "").lower()
                if attempt % 3 == 0:
                    print(f"[GROK VIDEO] poll {attempt}: status={status}")

                if status == "done":
                    video = data.get("video") or {}
                    url = video.get("url")
                    out_dur = video.get("duration", dur)
                    if not url:
                        return {"success": False, "error": "Video done but no URL"}
                    local_filename = await _download_video_url(url)
                    print(f"[GROK VIDEO] saved {local_filename}")
                    return {
                        "success": True,
                        "local_filename": local_filename,
                        "width": 0,
                        "height": 0,
                        "duration": out_dur if out_dur is not None else dur,
                    }
                if status == "failed":
                    err = data.get("error") or {}
                    msg = err.get("message") if isinstance(err, dict) else str(err)
                    return {"success": False, "error": msg or "Video generation failed"}
                if status == "expired":
                    return {"success": False, "error": "Video request expired"}

            return {"success": False, "error": "Video generation timed out"}

    except Exception as e:
        print(f"[GROK VIDEO] Error: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}
