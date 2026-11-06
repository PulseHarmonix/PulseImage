"""Audio helpers for the Music Video feature.

Uses the system ffmpeg/ffprobe binaries to trim and inspect audio tracks
stored in the local ``audio/`` folder.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import uuid

AUDIO_FOLDER = "audio"


class AudioError(Exception):
    """Raised when an audio operation cannot be completed."""


def _find_binary(name: str) -> str | None:
    """Locate an ffmpeg-family binary on PATH (handles the .exe suffix on Windows)."""
    path = shutil.which(name)
    if not path and os.name == "nt":
        path = shutil.which(f"{name}.exe")
    return path


def ffmpeg_available() -> bool:
    """Return True if ffmpeg can be located on the system."""
    return _find_binary("ffmpeg") is not None


def audio_path(filename: str) -> str:
    """Return the full path to an audio file inside the audio folder."""
    return os.path.join(AUDIO_FOLDER, filename)


def get_audio_duration(filename: str) -> float | None:
    """Return the duration of an audio file in seconds, or None if unknown."""
    src = audio_path(filename)
    if not os.path.isfile(src):
        return None

    ffprobe = _find_binary("ffprobe")
    if not ffprobe:
        return None

    try:
        result = subprocess.run(
            [
                ffprobe,
                "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                src,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        out = (result.stdout or "").strip()
        return float(out) if out else None
    except Exception:
        return None


def trim_audio(source_filename: str, start: float, end: float) -> str:
    """Trim an audio file to the [start, end] range.

    Returns the new filename inside the audio folder. The caller is responsible
    for deleting the temporary file once generation is complete.
    """
    src = audio_path(source_filename)
    if not os.path.isfile(src):
        raise AudioError(f"Audio file not found: {source_filename}")

    try:
        start_f = max(0.0, float(start))
        end_f = float(end)
    except (TypeError, ValueError):
        raise AudioError("Invalid start/end time")

    if end_f <= start_f:
        raise AudioError("End time must be greater than start time")

    duration = end_f - start_f

    ffmpeg = _find_binary("ffmpeg")
    if not ffmpeg:
        raise AudioError("ffmpeg not found on PATH")

    os.makedirs(AUDIO_FOLDER, exist_ok=True)
    # WAV PCM gives sample-accurate trims, which matters for music sync.
    out_filename = f"mv_tmp_{uuid.uuid4().hex}.wav"
    out_path = audio_path(out_filename)

    cmd = [
        ffmpeg, "-y",
        "-ss", f"{start_f:.3f}",
        "-i", src,
        "-t", f"{duration:.3f}",
        "-vn",
        "-acodec", "pcm_s16le",
        out_path,
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except Exception as e:
        raise AudioError(f"ffmpeg failed: {e}")

    if result.returncode != 0 or not os.path.isfile(out_path):
        tail = (result.stderr or "")[-300:]
        raise AudioError(f"ffmpeg trim failed: {tail}")

    return out_filename


def delete_audio(filename: str) -> None:
    """Best-effort delete of a file inside the audio folder."""
    try:
        path = audio_path(filename)
        if os.path.isfile(path):
            os.remove(path)
    except Exception:
        pass
