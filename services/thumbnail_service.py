import os
import logging

THUMBNAILS_DIR = "thumbnails"
THUMBNAIL_WIDTH = 320

logger = logging.getLogger(__name__)

# Lazy imports for optional dependencies
Image = None
cv2 = None


def _ensure_imports() -> None:
    """Lazy-load Pillow and OpenCV if available."""
    global Image, cv2
    if Image is None:
        try:
            from PIL import Image as _PIL
            Image = _PIL
        except ImportError:
            logger.warning("Pillow not installed — image thumbnails disabled")
    if cv2 is None:
        try:
            import cv2 as _cv2
            cv2 = _cv2
        except ImportError:
            logger.warning("OpenCV not installed — video thumbnails disabled")


def thumbnail_path(asset_id: str) -> str:
    """Return the filesystem path for a given asset's thumbnail."""
    return os.path.join(THUMBNAILS_DIR, f"{asset_id}.jpg")


def generate_image_thumbnail(asset_id: str, source_path: str) -> bool:
    """Generate a JPEG thumbnail for an image asset using Pillow."""
    _ensure_imports()
    if Image is None:
        return False
    try:
        if not os.path.exists(source_path):
            logger.warning(f"Source not found: {source_path}")
            return False
        img = Image.open(source_path)
        img = img.convert("RGB")
        w, h = img.size
        if w <= 0 or h <= 0:
            return False
        new_w = THUMBNAIL_WIDTH
        new_h = max(1, int(h * (new_w / w)))
        img = img.resize((new_w, new_h), Image.LANCZOS)
        out = thumbnail_path(asset_id)
        img.save(out, "JPEG", quality=80)
        return True
    except Exception as e:
        logger.warning(f"Failed to generate image thumbnail for {asset_id}: {e}")
        return False


def generate_video_thumbnail(asset_id: str, source_path: str) -> bool:
    """Generate a JPEG thumbnail for a video asset using OpenCV."""
    _ensure_imports()
    if cv2 is None:
        return False
    try:
        if not os.path.exists(source_path):
            logger.warning(f"Source not found: {source_path}")
            return False
        cap = cv2.VideoCapture(source_path)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total <= 0:
            cap.release()
            return False
        mid_frame = max(0, total // 2)
        cap.set(cv2.CAP_PROP_POS_FRAMES, mid_frame)
        ret, frame = cap.read()
        cap.release()
        if not ret:
            return False
        h, w = frame.shape[:2]
        if w <= 0 or h <= 0:
            return False
        new_w = THUMBNAIL_WIDTH
        new_h = max(1, int(h * (new_w / w)))
        resized = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
        out = thumbnail_path(asset_id)
        cv2.imwrite(out, resized, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
        return True
    except Exception as e:
        logger.warning(f"Failed to generate video thumbnail for {asset_id}: {e}")
        return False


def generate_thumbnail(asset: dict) -> bool:
    """Dispatch thumbnail generation for an asset based on its type."""
    asset_id = asset.get("id")
    fname = asset.get("filename")
    atype = asset.get("type", "image")
    if not asset_id or not fname:
        return False

    if atype == "audio":
        return False

    if atype == "video" or (isinstance(fname, str) and fname.lower().endswith(".mp4")):
        source = os.path.join("videos", fname)
        return generate_video_thumbnail(asset_id, source)
    else:
        source = os.path.join("images", fname)
        return generate_image_thumbnail(asset_id, source)


def generate_missing_thumbnails() -> dict:
    """Scan all assets and generate thumbnails for those that lack one."""
    from services.generation_service import load_generations
    assets = load_generations()
    total = len(assets)
    generated = 0
    failed = 0
    skipped = 0
    for asset in assets:
        aid = asset.get("id")
        if not aid:
            skipped += 1
            continue
        if os.path.exists(thumbnail_path(aid)):
            skipped += 1
            continue
        ok = generate_thumbnail(asset)
        if ok:
            generated += 1
        else:
            failed += 1
    return {"total": total, "generated": generated, "failed": failed, "skipped": skipped}
