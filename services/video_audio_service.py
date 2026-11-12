"""Extract the audio track from a video asset into the audio library.

Uses the system ffmpeg/ffprobe binaries to inspect and extract audio tracks
from videos stored in the local ``videos/`` folder. Extracted tracks are saved
as WAV files under ``audio/`` and registered as audio assets.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import uuid

from services.audio_service import get_audio_duration
from services.generation_service import get_asset_by_id, save_generation

VIDEOS_FOLDER = "videos"
AUDIO_FOLDER = "audio"

SAMPLE_RATE = 48000
CHANNELS = 2


class VideoAudioError(Exception):
    """Raised when a video audio operation cannot be completed."""


def _find_binary(name: str) -> str | None:
    """Locate an ffmpeg-family binary on PATH (handles the .exe suffix on Windows)."""
    path = shutil.which(name)
    if not path and os.name == "nt":
        path = shutil.which(f"{name}.exe")
    return path


def _video_path(filename: str) -> str:
    return os.path.join(VIDEOS_FOLDER, os.path.basename(filename))


def probe_video_audio(video_filename: str) -> dict:
    """Return {has_audio, codec, channels, sample_rate, duration} for a video."""
    src = _video_path(video_filename)
    if not os.path.isfile(src):
        raise VideoAudioError(f"Video not found: {video_filename}")

    ffprobe = _find_binary("ffprobe")
    if not ffprobe:
        raise VideoAudioError("ffprobe not found on PATH")

    cmd = [
        ffprobe,
        "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=codec_name,channels,sample_rate,duration",
        "-show_entries", "format=duration",
        "-of", "json",
        src,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except Exception as e:
        raise VideoAudioError(f"ffprobe failed: {e}")

    if result.returncode != 0:
        raise VideoAudioError(f"ffprobe failed: {(result.stderr or '')[-300:]}")

    try:
        data = json.loads(result.stdout or "{}")
    except Exception:
        data = {}

    streams = data.get("streams") or []
    stream = streams[0] if streams else {}
    fmt = data.get("format") or {}

    try:
        duration = float(stream.get("duration") or fmt.get("duration") or 0)
    except (TypeError, ValueError):
        duration = 0.0
    try:
        channels = int(stream.get("channels") or 0)
    except (TypeError, ValueError):
        channels = 0
    try:
        sample_rate = int(stream.get("sample_rate") or 0)
    except (TypeError, ValueError):
        sample_rate = 0

    has_audio = bool(stream)
    return {
        "has_audio": has_audio,
        "codec": stream.get("codec_name") if has_audio else None,
        "channels": channels,
        "sample_rate": sample_rate,
        "duration": duration,
    }


def extract_video_audio(asset_id: str) -> dict:
    """Extract a video's audio track and save it to the library as audio.

    Returns the newly created audio asset. Raises :class:`VideoAudioError` when
    the asset is invalid, has no audio stream, or extraction fails.
    """
    asset = get_asset_by_id(asset_id)
    if not asset:
        raise VideoAudioError("Asset not found")

    filename = asset.get("filename") or ""
    if asset.get("type") != "video" and not filename.lower().endswith(".mp4"):
        raise VideoAudioError("Asset is not a video")

    src = _video_path(filename)
    if not os.path.isfile(src):
        raise VideoAudioError(f"Video file not found: {filename}")

    info = probe_video_audio(filename)
    if not info.get("has_audio"):
        raise VideoAudioError("This video has no audio track to extract")

    ffmpeg = _find_binary("ffmpeg")
    if not ffmpeg:
        raise VideoAudioError("ffmpeg not found on PATH")

    os.makedirs(AUDIO_FOLDER, exist_ok=True)
    out_filename = f"va_{uuid.uuid4().hex}.wav"
    out_path = os.path.join(AUDIO_FOLDER, out_filename)

    cmd = [
        ffmpeg, "-y",
        "-i", src,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", str(SAMPLE_RATE),
        "-ac", str(CHANNELS),
        out_path,
    ]

    try:
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        except Exception as e:
            raise VideoAudioError(f"ffmpeg audio extraction failed: {e}")

        if result.returncode != 0 or not os.path.isfile(out_path):
            raise VideoAudioError(
                f"ffmpeg audio extraction failed: {(result.stderr or '')[-300:]}"
            )

        duration = get_audio_duration(out_filename)

        base = (
            asset.get("prompt")
            or (asset.get("metadata") or {}).get("name")
            or os.path.splitext(filename)[0]
        )
        base = str(base).strip()
        name = f"Audio from {base}" if base else "Extracted audio"

        new_id = save_generation(
            prompt=name,
            filename=out_filename,
            file_type="audio",
            duration=duration,
            parent_id=asset_id,
            derived_from=[asset_id],
            metadata={
                "source": "video_audio",
                "video_asset_id": asset_id,
                "original_video_filename": filename,
                "name": name,
            },
        )
    except Exception:
        try:
            if os.path.isfile(out_path):
                os.remove(out_path)
        except Exception:
            pass
        raise

    created = get_asset_by_id(new_id)
    if created:
        return created
    return {
        "id": new_id,
        "type": "audio",
        "filename": out_filename,
        "prompt": name,
        "parent_id": asset_id,
        "metadata": {
            "source": "video_audio",
            "video_asset_id": asset_id,
            "original_video_filename": filename,
            "name": name,
        },
    }
