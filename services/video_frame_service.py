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


def extract_preview_frame(
    video_filename: str,
    asset_id: str,
    frame_index: int,
    fps: float,
) -> dict:
    """Extract a full-resolution JPEG preview for a single frame.

    Cached under ``thumbnails/frames/<asset_id>/full/`` so repeated selections
    are instant and do not create library assets.
    """
    src = _video_path(video_filename)
    if not os.path.isfile(src):
        raise VideoFrameError(f"Video not found: {video_filename}")

    ffmpeg = _find_binary("ffmpeg")
    if not ffmpeg:
        raise VideoFrameError("ffmpeg not found on PATH")

    fps = fps if fps and fps > 0 else DEFAULT_FPS
    index = max(0, int(frame_index))
    time_seconds = index / fps

    out_dir = os.path.join(frame_cache_dir(asset_id), "full")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"f_{index}.jpg")

    if not os.path.isfile(out_path):
        tmp_path = os.path.join(out_dir, f"_tmp_{uuid.uuid4().hex}.jpg")
        cmd = [
            ffmpeg, "-y",
            "-ss", f"{time_seconds:.3f}",
            "-i", src,
            "-frames:v", "1",
            "-q:v", "2",
            tmp_path,
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        except Exception as e:
            raise VideoFrameError(f"ffmpeg preview extraction failed: {e}")

        if result.returncode != 0 or not os.path.isfile(tmp_path):
            try:
                if os.path.isfile(tmp_path):
                    os.remove(tmp_path)
            except Exception:
                pass
            raise VideoFrameError(
                f"ffmpeg preview extraction failed: {(result.stderr or '')[-300:]}"
            )
        os.replace(tmp_path, out_path)

    return {
        "url": f"/thumbnails/frames/{asset_id}/full/f_{index}.jpg",
        "frame_index": index,
        "time": time_seconds,
    }


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


def extract_video_clip(
    video_filename: str,
    start_seconds: float,
    duration_seconds: float,
    fps: float = 24.0,
) -> dict:
    """Extract a short, normalized clip from a video into the ``videos/`` folder.

    Used as a motion-continuity reference for FastH3 follow-on segments. The
    clip is normalized to 24fps H.264/yuv420p with audio stripped and written
    under a unique temporary filename.
    """
    src = _video_path(video_filename)
    if not os.path.isfile(src):
        raise VideoFrameError(f"Video not found: {video_filename}")

    ffmpeg = _find_binary("ffmpeg")
    if not ffmpeg:
        raise VideoFrameError("ffmpeg not found on PATH")

    try:
        start = max(0.0, float(start_seconds))
    except (TypeError, ValueError):
        start = 0.0
    try:
        dur = max(0.0, float(duration_seconds))
    except (TypeError, ValueError):
        dur = 0.0
    if dur <= 0:
        raise VideoFrameError("Clip duration must be greater than zero")

    out_fps = 24.0
    os.makedirs(VIDEOS_FOLDER, exist_ok=True)
    out_filename = f"follow_on_{uuid.uuid4().hex}.mp4"
    out_path = os.path.join(VIDEOS_FOLDER, out_filename)

    cmd = [
        ffmpeg, "-y",
        "-ss", f"{start:.3f}",
        "-t", f"{dur:.3f}",
        "-i", src,
        "-an",
        "-vf", f"fps={out_fps:g}",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        out_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    except Exception as e:
        try:
            if os.path.isfile(out_path):
                os.remove(out_path)
        except Exception:
            pass
        raise VideoFrameError(f"ffmpeg clip extraction failed: {e}")

    if result.returncode != 0 or not os.path.isfile(out_path):
        try:
            if os.path.isfile(out_path):
                os.remove(out_path)
        except Exception:
            pass
        raise VideoFrameError(
            f"ffmpeg clip extraction failed: {(result.stderr or '')[-300:]}"
        )

    return {
        "filename": out_filename,
        "duration": dur,
        "fps": out_fps,
        "frames": int(round(dur * out_fps)),
    }


def clear_frame_cache(asset_id: str) -> None:
    """Remove a video's cached frame thumbnails (best effort)."""
    try:
        shutil.rmtree(frame_cache_dir(asset_id), ignore_errors=True)
    except Exception:
        pass
