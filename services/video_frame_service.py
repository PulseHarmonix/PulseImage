"""Video frame extraction for the Single Frame app.

Uses the system ffmpeg/ffprobe binaries to probe videos and extract frame
thumbnails (cached under ``thumbnails/frames/<asset_id>/``) or full-resolution
frames (saved under ``images/``).
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import uuid

VIDEOS_FOLDER = "videos"
IMAGES_FOLDER = "images"
FRAMES_CACHE_ROOT = os.path.join("thumbnails", "frames")

DEFAULT_FPS = 24.0
FRAME_WINDOW = 24
THUMB_WIDTH = 200


class VideoFrameError(Exception):
    """Raised when a video frame operation cannot be completed."""


def _find_binary(name: str) -> str | None:
    """Locate an ffmpeg-family binary on PATH (handles the .exe suffix on Windows)."""
    path = shutil.which(name)
    if not path and os.name == "nt":
        path = shutil.which(f"{name}.exe")
    return path


def _video_path(filename: str) -> str:
    return os.path.join(VIDEOS_FOLDER, filename)


def frame_cache_dir(asset_id: str) -> str:
    """Return the cache directory for a video's frame thumbnails."""
    return os.path.join(FRAMES_CACHE_ROOT, asset_id)


def _parse_fps(value) -> float:
    """Parse an ffprobe frame-rate string like '24000/1001' or '24/1'."""
    try:
        if isinstance(value, (int, float)):
            return float(value) if value else DEFAULT_FPS
        s = str(value or "").strip()
        if "/" in s:
            num, den = s.split("/", 1)
            num_f = float(num)
            den_f = float(den)
            if den_f:
                return num_f / den_f
            return DEFAULT_FPS
        f = float(s)
        return f if f > 0 else DEFAULT_FPS
    except Exception:
        return DEFAULT_FPS


def probe_video(filename: str) -> dict:
    """Return {duration, fps, width, height, frame_count} for a video."""
    src = _video_path(filename)
    if not os.path.isfile(src):
        raise VideoFrameError(f"Video not found: {filename}")

    ffprobe = _find_binary("ffprobe")
    if not ffprobe:
        raise VideoFrameError("ffprobe not found on PATH")

    cmd = [
        ffprobe,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,avg_frame_rate,r_frame_rate,duration,nb_frames",
        "-show_entries", "format=duration",
        "-of", "json",
        src,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except Exception as e:
        raise VideoFrameError(f"ffprobe failed: {e}")

    if result.returncode != 0:
        raise VideoFrameError(f"ffprobe failed: {(result.stderr or '')[-300:]}")

    try:
        data = json.loads(result.stdout or "{}")
    except Exception:
        data = {}

    stream = (data.get("streams") or [{}])[0]
    fmt = data.get("format") or {}

    fps = _parse_fps(stream.get("avg_frame_rate") or stream.get("r_frame_rate"))
    try:
        duration = float(stream.get("duration") or fmt.get("duration") or 0)
    except (TypeError, ValueError):
        duration = 0.0
    try:
        width = int(stream.get("width") or 0)
        height = int(stream.get("height") or 0)
    except (TypeError, ValueError):
        width = height = 0

    frame_count = 0
    try:
        nb = int(stream.get("nb_frames") or 0)
    except (TypeError, ValueError):
        nb = 0
    if nb > 0:
        frame_count = nb
    elif duration > 0 and fps > 0:
        frame_count = int(round(duration * fps))

    return {
        "duration": duration,
        "fps": fps,
        "width": width,
        "height": height,
        "frame_count": frame_count,
    }


def extract_frame_window(
    video_filename: str,
    asset_id: str,
    fps: float,
    start_index: int,
    count: int = FRAME_WINDOW,
) -> list[dict]:
    """Extract (or reuse cached) thumbnails for a window of frames.

    Returns a list of {index, time, url} for frames that exist.
    """
    src = _video_path(video_filename)
    if not os.path.isfile(src):
        raise VideoFrameError(f"Video not found: {video_filename}")

    ffmpeg = _find_binary("ffmpeg")
    if not ffmpeg:
        raise VideoFrameError("ffmpeg not found on PATH")

    fps = fps if fps and fps > 0 else DEFAULT_FPS
    count = max(1, min(int(count or FRAME_WINDOW), FRAME_WINDOW))
    start_index = max(0, int(start_index or 0))

    cache = frame_cache_dir(asset_id)
    os.makedirs(cache, exist_ok=True)

    missing = [
        i for i in range(start_index, start_index + count)
        if not os.path.isfile(os.path.join(cache, f"f_{i}.jpg"))
    ]

    if missing:
        start_time = start_index / fps
        tmp_pattern = os.path.join(cache, "_tmp_%04d.jpg")
        cmd = [
            ffmpeg, "-y",
            "-ss", f"{start_time:.3f}",
            "-i", src,
            "-frames:v", str(count),
            "-vf", f"scale={THUMB_WIDTH}:-2",
            "-q:v", "4",
            tmp_pattern,
        ]
        try:
            subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        except Exception as e:
            raise VideoFrameError(f"ffmpeg frame extraction failed: {e}")

        for k in range(count):
            tmp = os.path.join(cache, f"_tmp_{k + 1:04d}.jpg")
            if os.path.isfile(tmp):
                os.replace(tmp, os.path.join(cache, f"f_{start_index + k}.jpg"))

    frames = []
    for i in range(start_index, start_index + count):
        if os.path.isfile(os.path.join(cache, f"f_{i}.jpg")):
            frames.append({
                "index": i,
                "time": i / fps,
                "url": f"/thumbnails/frames/{asset_id}/f_{i}.jpg",
            })
    return frames


def extract_full_frame(video_filename: str, time_seconds: float) -> dict:
    """Extract a single full-resolution PNG frame into the images folder."""
    src = _video_path(video_filename)
    if not os.path.isfile(src):
        raise VideoFrameError(f"Video not found: {video_filename}")

    ffmpeg = _find_binary("ffmpeg")
    if not ffmpeg:
        raise VideoFrameError("ffmpeg not found on PATH")

    os.makedirs(IMAGES_FOLDER, exist_ok=True)
    out_filename = f"{uuid.uuid4().hex}.png"
    out_path = os.path.join(IMAGES_FOLDER, out_filename)

    cmd = [
        ffmpeg, "-y",
        "-ss", f"{max(0.0, float(time_seconds)):.3f}",
        "-i", src,
        "-frames:v", "1",
        out_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except Exception as e:
        raise VideoFrameError(f"ffmpeg frame extraction failed: {e}")

    if result.returncode != 0 or not os.path.isfile(out_path):
        raise VideoFrameError(f"ffmpeg frame extraction failed: {(result.stderr or '')[-300:]}")

    width, height = 0, 0
    try:
        from PIL import Image
        with Image.open(out_path) as img:
            width, height = img.size
    except Exception:
        pass

    return {"filename": out_filename, "width": width, "height": height}


def clear_frame_cache(asset_id: str) -> None:
    """Remove a video's cached frame thumbnails (best effort)."""
    try:
        shutil.rmtree(frame_cache_dir(asset_id), ignore_errors=True)
    except Exception:
        pass
