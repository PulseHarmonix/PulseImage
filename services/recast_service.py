"""Recast backend for the Video composer.

Recast uses a source video as a performance/motion/camera reference and a
starting image as the subject identity (optionally the first frame). FastH3 is
the primary engine; LTX 2.3 and LTX 2.5 are experimental local video-guide
implementations.
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import uuid

from PIL import Image, ImageFilter

from services.comfy_service import (
    generate_fasth3_multi_ref_video,
    generate_ltx_recast_video,
)
from services.generation_service import get_asset_by_id
from services.video_frame_service import VideoFrameError, probe_video
from utils.video_workflow_utils import get_ltx_recast_dimensions

VIDEOS_FOLDER = "videos"
IMAGES_FOLDER = "images"
AUDIO_FOLDER = "audio"

RECAST_ENGINES = ("fasth3", "ltx23", "ltx25")
RECAST_PRESERVE_OPTIONS = ("motion", "camera", "background", "lighting", "composition")
RECAST_AUDIO_MODES = ("mute", "copy", "reference")
RECAST_START_IMAGE_MODES = ("first_frame_identity", "identity", "first_frame")
RECAST_REFERENCE_FITS = ("pad", "crop")
RECAST_SOURCE_CONTROLS = ("raw", "canny", "pose", "depth")

RECAST_FPS = 24.0
FASTH3_MAX_SECONDS = 15.0
LTX_MAX_SECONDS = {
    "ltx23": 40.0,
    "ltx25": 40.0,
}


class RecastError(Exception):
    """Structured recast validation/runtime error."""

    def __init__(self, message: str, code: str = "recast_invalid", status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status_code = status_code

    def to_dict(self) -> dict:
        return {"success": False, "error": self.message, "code": self.code}


def _find_binary(name: str) -> str | None:
    """Locate an ffmpeg-family binary on PATH (handles the .exe suffix on Windows)."""
    path = shutil.which(name)
    if not path and os.name == "nt":
        path = shutil.which(f"{name}.exe")
    return path


def _local_path(folder: str, filename: str) -> str:
    return os.path.join(folder, os.path.basename(str(filename)))


def _resolve_local_asset(value, kind: str) -> tuple[str, str | None]:
    """Resolve an asset id or filename to (local filename, asset id or None)."""
    if isinstance(value, (list, tuple, set)):
        raise RecastError(
            f"Recast requires exactly one local {kind}, not multiple.",
            code="recast_reference_count",
        )
    if not isinstance(value, str) or not value.strip():
        raise RecastError(
            f"Recast requires one local {kind}.",
            code="recast_missing_reference",
        )

    raw = value.strip()
    filename = os.path.basename(raw)
    folder = VIDEOS_FOLDER if kind == "source video" else IMAGES_FOLDER
    expected_type = "video" if kind == "source video" else "image"

    if filename and os.path.isfile(os.path.join(folder, filename)):
        return filename, None

    asset = get_asset_by_id(raw)
    if not asset and raw != filename:
        asset = get_asset_by_id(filename)
    if asset and asset.get("type") == expected_type:
        candidate = os.path.basename(str(asset.get("filename") or ""))
        if candidate and os.path.isfile(os.path.join(folder, candidate)):
            return candidate, asset.get("id")

    raise RecastError(
        f"{kind.capitalize()} not found locally: {raw}",
        code="recast_reference_not_found",
    )


def validate_recast_request(data: dict) -> dict:
    """Validate and normalize a recast request.

    Raises :class:`RecastError` with a structured error message when the request
    is not a valid recast combination.
    """
    data = data or {}

    engine = str(data.get("recast_engine") or "").strip().lower()
    if engine not in RECAST_ENGINES:
        raise RecastError(
            "Recast engine must be one of: fasth3, ltx23, ltx25.",
            code="recast_invalid_engine",
        )

    model = str(data.get("video_model") or "").strip().lower()
    if model == "grok":
        raise RecastError(
            "Recast is not available with Grok. Use FastH3 or LTX.",
            code="recast_unsupported_model",
        )

    ref_video, ref_video_asset_id = _resolve_local_asset(data.get("ref_video"), "source video")
    source_image, source_image_asset_id = _resolve_local_asset(
        data.get("source_image"), "starting image"
    )

    raw_ref_images = data.get("ref_images") or []
    if not isinstance(raw_ref_images, list):
        raise RecastError(
            "ref_images must be a list of optional character reference filenames.",
            code="recast_invalid_ref_images",
        )
    extra_images: list[str] = []
    extra_image_asset_ids: list[str | None] = []
    seen = {source_image}
    for item in raw_ref_images:
        filename, asset_id = _resolve_local_asset(item, "reference image")
        if filename in seen:
            continue
        seen.add(filename)
        extra_images.append(filename)
        extra_image_asset_ids.append(asset_id)

    settings = data.get("recast_settings") or {}
    if not isinstance(settings, dict):
        raise RecastError(
            "recast_settings must be an object.",
            code="recast_invalid_settings",
        )

    raw_preserve = settings.get("preserve")
    if raw_preserve is None:
        preserve = list(RECAST_PRESERVE_OPTIONS)
    else:
        if not isinstance(raw_preserve, list):
            raise RecastError(
                "recast_settings.preserve must be a list.",
                code="recast_invalid_preserve",
            )
        preserve = []
        for item in raw_preserve:
            token = str(item).strip().lower()
            if token not in RECAST_PRESERVE_OPTIONS:
                raise RecastError(
                    f"Unsupported preserve value: {item}. "
                    f"Allowed values: {', '.join(RECAST_PRESERVE_OPTIONS)}.",
                    code="recast_invalid_preserve",
                )
            if token not in preserve:
                preserve.append(token)
        if not preserve:
            preserve = list(RECAST_PRESERVE_OPTIONS)

    audio_mode = str(settings.get("audio_mode") or "mute").strip().lower()
    if audio_mode not in RECAST_AUDIO_MODES:
        raise RecastError(
            "recast_settings.audio_mode must be one of: mute, copy, reference.",
            code="recast_invalid_audio_mode",
        )

    start_image_mode = str(
        settings.get("start_image_mode") or "first_frame_identity"
    ).strip().lower()
    if start_image_mode not in RECAST_START_IMAGE_MODES:
        raise RecastError(
            "recast_settings.start_image_mode must be one of: "
            "first_frame_identity, identity, first_frame.",
            code="recast_invalid_start_image_mode",
        )

    reference_fit = str(settings.get("reference_fit") or "pad").strip().lower()
    if reference_fit not in RECAST_REFERENCE_FITS:
        raise RecastError(
            "recast_settings.reference_fit must be one of: pad, crop.",
            code="recast_invalid_reference_fit",
        )

    source_control = str(settings.get("source_control") or "canny").strip().lower()
    if source_control not in RECAST_SOURCE_CONTROLS:
        raise RecastError(
            "recast_settings.source_control must be one of: raw, canny, pose, depth.",
            code="recast_invalid_source_control",
        )

    try:
        guide_strength = float(settings.get("source_guide_strength", 0.5))
    except (TypeError, ValueError):
        raise RecastError(
            "recast_settings.source_guide_strength must be a number between 0 and 1.",
            code="recast_invalid_guide_strength",
        )
    if guide_strength < 0.0 or guide_strength > 1.0:
        raise RecastError(
            "recast_settings.source_guide_strength must be between 0 and 1.",
            code="recast_invalid_guide_strength",
        )

    def _unit_setting(key: str, default: float) -> float:
        try:
            value = float(settings.get(key, default))
        except (TypeError, ValueError):
            raise RecastError(
                f"recast_settings.{key} must be a number between 0 and 1.",
                code=f"recast_invalid_{key}",
            )
        if value < 0.0 or value > 1.0:
            raise RecastError(
                f"recast_settings.{key} must be between 0 and 1.",
                code=f"recast_invalid_{key}",
            )
        return value

    control_attention_strength = _unit_setting("control_attention_strength", 0.8)
    start_image_strength = _unit_setting("start_image_strength", 1.0)
    ref_image_strength = _unit_setting("ref_image_strength", 0.8)

    try:
        source_start = max(0.0, float(settings.get("source_start", 0.0)))
    except (TypeError, ValueError):
        raise RecastError(
            "recast_settings.source_start must be a positive number of seconds.",
            code="recast_invalid_source_start",
        )

    raw_seed = settings.get("seed")
    try:
        seed = None if raw_seed in (None, "", "random") else int(raw_seed)
    except (TypeError, ValueError):
        raise RecastError(
            "recast_settings.seed must be an integer or empty for random.",
            code="recast_invalid_seed",
        )
    if seed is not None and (seed < 0 or seed > 2**32 - 1):
        raise RecastError(
            "recast_settings.seed must be between 0 and 4294967295.",
            code="recast_invalid_seed",
        )

    negative_prompt = str(settings.get("negative_prompt") or "").strip()
    prompt_enhance = bool(settings.get("prompt_enhance", False))
    sampler_name = str(settings.get("sampler_name") or "").strip().lower()
    if sampler_name and sampler_name not in {
        "euler", "euler_ancestral", "euler_ancestral_cfg_pp",
    }:
        raise RecastError(
            "recast_settings.sampler_name must be euler, euler_ancestral, "
            "euler_ancestral_cfg_pp, or empty for auto.",
            code="recast_invalid_sampler",
        )

    try:
        duration = float(data.get("duration"))
    except (TypeError, ValueError):
        duration = 0.0
    if duration <= 0:
        raise RecastError(
            "Recast requires a positive duration.",
            code="recast_invalid_duration",
        )

    if engine == "ltx23" or engine == "ltx25":
        max_extra = 5
    elif start_image_mode in ("first_frame_identity", "identity"):
        max_extra = 5
    else:
        max_extra = 6
    if len(extra_images) > max_extra:
        raise RecastError(
            f"Too many reference images for {engine}. "
            f"At most {max_extra} additional images are supported.",
            code="recast_too_many_refs",
        )

    return {
        "engine": engine,
        "video_model": "fasth3" if engine == "fasth3" else "ltx",
        "ltx_version": "2.3" if engine == "ltx23" else ("2.5" if engine == "ltx25" else None),
        "ref_video": ref_video,
        "ref_video_asset_id": ref_video_asset_id,
        "source_image": source_image,
        "source_image_asset_id": source_image_asset_id,
        "ref_images": extra_images,
        "ref_image_asset_ids": extra_image_asset_ids,
        "duration": duration,
        "resolution": data.get("resolution", "720p"),
        "aspect_ratio": data.get("aspect_ratio", "16:9"),
        "preserve": preserve,
        "audio_mode": audio_mode,
        "start_image_mode": start_image_mode,
        "source_guide_strength": guide_strength,
        "reference_fit": reference_fit,
        "source_control": source_control,
        "control_attention_strength": control_attention_strength,
        "start_image_strength": start_image_strength,
        "ref_image_strength": ref_image_strength,
        "source_start": source_start,
        "seed": seed,
        "negative_prompt": negative_prompt,
        "prompt_enhance": prompt_enhance,
        "sampler_name": sampler_name,
        "prompt": str(data.get("prompt") or "").strip(),
    }


def _prepare_source_video(options: dict) -> dict:
    """Trim/normalize the source video, optionally fitting it to the target aspect."""
    source = options["ref_video"]
    source_path = _local_path(VIDEOS_FOLDER, source)
    if not os.path.isfile(source_path):
        raise RecastError(f"Source video not found: {source}", code="recast_reference_not_found")

    try:
        info = probe_video(source)
    except VideoFrameError as exc:
        raise RecastError(str(exc), code="recast_probe_failed") from exc

    source_duration = float(info.get("duration") or 0.0)
    if source_duration <= 0:
        raise RecastError(
            "Source video duration could not be determined.",
            code="recast_probe_failed",
        )

    start_offset = max(0.0, float(options.get("source_start") or 0.0))
    if start_offset >= source_duration - 0.05:
        raise RecastError(
            f"Source start offset {start_offset:g}s is at or beyond the source duration.",
            code="recast_source_start_out_of_range",
        )
    available = max(0.1, source_duration - start_offset)

    engine = options["engine"]
    limit = FASTH3_MAX_SECONDS if engine == "fasth3" else LTX_MAX_SECONDS.get(engine, 40.0)
    requested = float(options["duration"])

    warnings: list[str] = []
    target = requested
    if target > limit:
        warnings.append(
            f"Requested duration {requested:g}s exceeds the {engine} limit; trimmed to {limit:g}s."
        )
        target = limit
    if available + 0.05 < target:
        warnings.append(
            f"Source video has only {available:g}s available from the selected start; using that."
        )
        target = available
    target = max(0.1, min(target, limit, available))

    if start_offset > 0:
        warnings.append(f"Starting from {start_offset:g}s in the source video.")

    trimmed = target + 0.05 < available
    use_pad = engine in ("ltx23", "ltx25") and options.get("reference_fit") == "pad"
    target_width = target_height = 0
    if use_pad:
        target_width, target_height = get_ltx_recast_dimensions(
            options.get("resolution", "720p"), options.get("aspect_ratio", "16:9")
        )

    ffmpeg = _find_binary("ffmpeg")
    if not ffmpeg:
        raise RecastError(
            "ffmpeg is required for recast source preparation.",
            code="recast_ffmpeg_missing",
            status_code=503,
        )

    out_filename = f"recast_src_{uuid.uuid4().hex}.mp4"
    out_path = _local_path(VIDEOS_FOLDER, out_filename)
    cmd = [ffmpeg, "-y", "-ss", f"{start_offset:.3f}", "-i", source_path, "-t", f"{target:.3f}"]
    if use_pad:
        width = int(target_width)
        height = int(target_height)
        filter_complex = (
            f"[0:v]fps={RECAST_FPS:g},split=2[bg][fg];"
            f"[bg]scale={width}:{height}:force_original_aspect_ratio=increase,"
            f"crop={width}:{height},boxblur=20:3,setsar=1[bg2];"
            f"[fg]scale={width}:{height}:force_original_aspect_ratio=decrease,setsar=1[fg2];"
            f"[bg2][fg2]overlay=(W-w)/2:(H-h)/2,setsar=1[vout]"
        )
        cmd += ["-filter_complex", filter_complex, "-map", "[vout]"]
    else:
        cmd += ["-vf", f"fps={RECAST_FPS:g}"]
    cmd += [
        "-an",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        out_path,
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    except Exception as exc:
        try:
            if os.path.isfile(out_path):
                os.remove(out_path)
        except OSError:
            pass
        raise RecastError(
            f"ffmpeg source preparation failed: {exc}",
            code="recast_source_prepare_failed",
            status_code=502,
        ) from exc

    if result.returncode != 0 or not os.path.isfile(out_path):
        try:
            if os.path.isfile(out_path):
                os.remove(out_path)
        except OSError:
            pass
        raise RecastError(
            "ffmpeg source preparation failed: " + (result.stderr or "")[-300:],
            code="recast_source_prepare_failed",
            status_code=502,
        )

    return {
        "filename": out_filename,
        "duration": target,
        "source_duration": source_duration,
        "source_start": start_offset,
        "trimmed": trimmed,
        "width": int(target_width or info.get("width") or 0),
        "height": int(target_height or info.get("height") or 0),
        "padded": use_pad,
        "warnings": warnings,
    }


def _prepare_start_image(options: dict) -> str | None:
    """Pad the starting image to the target aspect while preserving the subject."""
    if options.get("engine") not in ("ltx23", "ltx25") or options.get("reference_fit") != "pad":
        return None

    source_path = _local_path(IMAGES_FOLDER, options["source_image"])
    if not os.path.isfile(source_path):
        return None

    target_width, target_height = get_ltx_recast_dimensions(
        options.get("resolution", "720p"), options.get("aspect_ratio", "16:9")
    )
    target_width = max(64, int(target_width))
    target_height = max(64, int(target_height))

    try:
        with Image.open(source_path) as opened:
            source = opened.convert("RGB")
    except Exception as exc:
        raise RecastError(
            f"Could not read starting image: {exc}",
            code="recast_image_prepare_failed",
            status_code=502,
        ) from exc

    # Blurred cover background avoids hard letterbox bars while keeping the full subject.
    cover_scale = max(target_width / source.width, target_height / source.height)
    bg_size = (max(1, int(source.width * cover_scale + 0.5)), max(1, int(source.height * cover_scale + 0.5)))
    background = source.resize(bg_size, Image.Resampling.LANCZOS)
    left = max(0, (background.width - target_width) // 2)
    top = max(0, (background.height - target_height) // 2)
    background = background.crop((left, top, left + target_width, top + target_height))
    background = background.filter(ImageFilter.GaussianBlur(radius=max(12, min(target_width, target_height) // 24)))

    contain_scale = min(target_width / source.width, target_height / source.height)
    fg_size = (max(1, int(source.width * contain_scale + 0.5)), max(1, int(source.height * contain_scale + 0.5)))
    foreground = source.resize(fg_size, Image.Resampling.LANCZOS)
    canvas = background.copy()
    canvas.paste(foreground, ((target_width - foreground.width) // 2, (target_height - foreground.height) // 2))

    out_filename = f"recast_ref_{uuid.uuid4().hex}.png"
    out_path = _local_path(IMAGES_FOLDER, out_filename)
    try:
        canvas.save(out_path, "PNG")
    except Exception as exc:
        raise RecastError(
            f"Could not write padded starting image: {exc}",
            code="recast_image_prepare_failed",
            status_code=502,
        ) from exc
    return out_filename


def _probe_source_has_audio(source_filename: str) -> bool:
    path = _local_path(VIDEOS_FOLDER, source_filename)
    ffprobe = _find_binary("ffprobe")
    if not ffprobe:
        raise RecastError(
            "ffprobe is required for recast audio operations.",
            code="recast_ffprobe_missing",
            status_code=503,
        )
    cmd = [
        ffprobe, "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=codec_name",
        "-of", "json",
        path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RecastError(
            "ffprobe failed: " + (result.stderr or "")[-300:],
            code="recast_audio_probe_failed",
            status_code=502,
        )
    try:
        payload = json.loads(result.stdout or "{}")
    except Exception:
        payload = {}
    return bool(payload.get("streams"))


def _extract_source_audio(source_filename: str, duration: float, start: float = 0.0) -> str:
    """Extract the source audio into a temporary WAV under audio/."""
    source_path = _local_path(VIDEOS_FOLDER, source_filename)
    if not _probe_source_has_audio(source_filename):
        raise RecastError(
            "The source video has no audio track for the selected audio mode.",
            code="recast_source_audio_missing",
        )

    ffmpeg = _find_binary("ffmpeg")
    if not ffmpeg:
        raise RecastError(
            "ffmpeg is required for recast audio extraction.",
            code="recast_ffmpeg_missing",
            status_code=503,
        )

    os.makedirs(AUDIO_FOLDER, exist_ok=True)
    out_filename = f"recast_audio_{uuid.uuid4().hex}.wav"
    out_path = _local_path(AUDIO_FOLDER, out_filename)
    cmd = [
        ffmpeg, "-y",
        "-ss", f"{max(0.0, float(start)):.3f}",
        "-i", source_path,
        "-t", f"{max(0.1, float(duration)):.3f}",
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "48000",
        "-ac", "2",
        out_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0 or not os.path.isfile(out_path):
        try:
            if os.path.isfile(out_path):
                os.remove(out_path)
        except OSError:
            pass
        raise RecastError(
            "ffmpeg audio extraction failed: " + (result.stderr or "")[-300:],
            code="recast_audio_extract_failed",
            status_code=502,
        )
    return out_filename


def _mux_audio_onto_video(
    generated_filename: str,
    audio_filename: str,
    duration: float,
) -> str:
    """Mux extracted source audio onto the generated MP4 and replace the result."""
    ffmpeg = _find_binary("ffmpeg")
    if not ffmpeg:
        raise RecastError(
            "ffmpeg is required for recast audio muxing.",
            code="recast_ffmpeg_missing",
            status_code=503,
        )

    generated_path = _local_path(VIDEOS_FOLDER, generated_filename)
    audio_path = _local_path(AUDIO_FOLDER, audio_filename)
    if not os.path.isfile(generated_path):
        raise RecastError("Generated video file is missing.", code="recast_output_missing")
    if not os.path.isfile(audio_path):
        raise RecastError("Extracted audio file is missing.", code="recast_audio_missing")

    out_filename = f"recast_{uuid.uuid4().hex}.mp4"
    out_path = _local_path(VIDEOS_FOLDER, out_filename)
    cmd = [
        ffmpeg, "-y",
        "-i", generated_path,
        "-i", audio_path,
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        "-t", f"{max(0.1, float(duration)):.3f}",
        "-movflags", "+faststart",
        out_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0 or not os.path.isfile(out_path):
        try:
            if os.path.isfile(out_path):
                os.remove(out_path)
        except OSError:
            pass
        raise RecastError(
            "ffmpeg audio mux failed: " + (result.stderr or "")[-300:],
            code="recast_audio_mux_failed",
            status_code=502,
        )

    try:
        os.remove(generated_path)
    except OSError:
        pass
    return out_filename


def _strip_audio(video_filename: str) -> str:
    """Remove the audio track from a generated MP4."""
    ffmpeg = _find_binary("ffmpeg")
    if not ffmpeg:
        raise RecastError(
            "ffmpeg is required to mute recast output.",
            code="recast_ffmpeg_missing",
            status_code=503,
        )
    source_path = _local_path(VIDEOS_FOLDER, video_filename)
    out_filename = f"recast_{uuid.uuid4().hex}.mp4"
    out_path = _local_path(VIDEOS_FOLDER, out_filename)
    cmd = [
        ffmpeg, "-y", "-i", source_path, "-map", "0:v:0", "-c:v", "copy",
        "-an", "-movflags", "+faststart", out_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0 or not os.path.isfile(out_path):
        try:
            if os.path.isfile(out_path):
                os.remove(out_path)
        except OSError:
            pass
        raise RecastError(
            "ffmpeg mute failed: " + (result.stderr or "")[-300:],
            code="recast_audio_mute_failed",
            status_code=502,
        )
    try:
        os.remove(source_path)
    except OSError:
        pass
    return out_filename


def _trim_video_to_duration(video_filename: str, duration: float) -> str:
    """Trim a generated recast MP4 back to the requested fractional duration."""
    ffmpeg = _find_binary("ffmpeg")
    if not ffmpeg:
        raise RecastError(
            "ffmpeg is required to trim recast output.",
            code="recast_ffmpeg_missing",
            status_code=503,
        )
    source_path = _local_path(VIDEOS_FOLDER, video_filename)
    if not os.path.isfile(source_path):
        return video_filename
    out_filename = f"recast_{uuid.uuid4().hex}.mp4"
    out_path = _local_path(VIDEOS_FOLDER, out_filename)
    cmd = [
        ffmpeg, "-y", "-i", source_path,
        "-t", f"{max(0.1, float(duration)):.3f}",
        "-map", "0:v:0", "-map", "0:a?",
        "-c", "copy", "-movflags", "+faststart", out_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0 or not os.path.isfile(out_path):
        try:
            if os.path.isfile(out_path):
                os.remove(out_path)
        except OSError:
            pass
        raise RecastError(
            "ffmpeg output trim failed: " + (result.stderr or "")[-300:],
            code="recast_output_trim_failed",
            status_code=502,
        )
    try:
        os.remove(source_path)
    except OSError:
        pass
    return out_filename


def _build_ltx_recast_prompt(options: dict) -> str:
    """Add recast instructions to the user prompt for the LTX video guides."""
    scene = (options.get("prompt") or "").strip() or "A cinematic recast shot."
    preserve = ", ".join(options.get("preserve") or [])
    mode = options.get("start_image_mode") or "first_frame_identity"
    first_frame = (
        "The first frame must match the starting image, not the source video's final frame. "
        if mode in ("first_frame_identity", "first_frame") else
        "Do not copy the source video's final frame. "
    )
    return (
        scene
        + "\n\nRecast instructions: Use the source video as the source performance, "
        "motion, camera, timing and blocking reference. Preserve "
        + (preserve or "motion, camera, background, lighting and composition")
        + ". Replace the main subject with the starting character from the starting "
        "image. Do not copy the source subject's identity, face, hair or clothing. "
        + first_frame
    )


def build_recast_metadata(options: dict, prepared: dict, result: dict) -> dict:
    """Build metadata stored with a recast result."""
    warnings = list(prepared.get("warnings") or [])
    warnings.extend(result.get("warnings") or [])
    return {
        "source": "recast",
        "recast": True,
        "recast_engine": options["engine"],
        "experimental": options["engine"] in ("ltx23", "ltx25"),
        "ref_video": options["ref_video"],
        "ref_video_asset_id": options.get("ref_video_asset_id"),
        "source_video_filename": options["ref_video"],
        "source_image": options["source_image"],
        "source_image_asset_id": options.get("source_image_asset_id"),
        "starting_image": options["source_image"],
        "ref_images": list(options.get("ref_images") or []),
        "preserve": list(options.get("preserve") or []),
        "audio_mode": options["audio_mode"],
        "start_image_mode": options["start_image_mode"],
        "source_guide_strength": options["source_guide_strength"],
        "reference_fit": options.get("reference_fit"),
        "source_control": options.get("source_control"),
        "control_attention_strength": options.get("control_attention_strength"),
        "start_image_strength": options.get("start_image_strength"),
        "ref_image_strength": options.get("ref_image_strength"),
        "source_start": options.get("source_start", 0.0),
        "seed": options.get("seed"),
        "sampler_name": options.get("sampler_name") or "auto",
        "negative_prompt": options.get("negative_prompt") or "",
        "prompt_enhance": bool(options.get("prompt_enhance")),
        "duration": result.get("duration", prepared.get("duration")),
        "source_duration": prepared.get("source_duration"),
        "source_trimmed": bool(prepared.get("trimmed")),
        "source_padded": bool(prepared.get("padded")),
        "effective_width": prepared.get("width"),
        "effective_height": prepared.get("height"),
        "warnings": warnings,
    }


async def generate_recast(data: dict) -> dict:
    """Run a validated recast request and return a generation-style result."""
    try:
        options = validate_recast_request(data)
    except RecastError as exc:
        return exc.to_dict()

    prepared = None
    temp_audio = None
    temp_start_image = None
    try:
        prepared = await asyncio.to_thread(_prepare_source_video, options)
        duration = float(prepared["duration"])

        # A source without audio must not fail after the video has already been
        # generated. Fall back to mute and keep the recast usable.
        if options["audio_mode"] in ("copy", "reference"):
            has_source_audio = await asyncio.to_thread(
                _probe_source_has_audio, options["ref_video"]
            )
            if not has_source_audio:
                options["audio_mode"] = "mute"
                prepared["warnings"].append(
                    "Source video has no audio track; recast audio mode was changed to mute."
                )

        temp_start_image = await asyncio.to_thread(_prepare_start_image, options)
        start_image_filename = temp_start_image or options["source_image"]

        extra_images = list(options["ref_images"])
        start_mode = options["start_image_mode"]
        use_identity = start_mode in ("first_frame_identity", "identity")
        use_first_frame = start_mode in ("first_frame_identity", "first_frame")

        if options["engine"] == "fasth3":
            ref_images = ([options["source_image"]] if use_identity else []) + extra_images
            ref_labels = []
            ref_roles = []
            if use_identity:
                ref_labels.append("starting character")
                ref_roles.append("character")
            for index, _filename in enumerate(extra_images):
                ref_labels.append(f"character reference {index + 2}")
                ref_roles.append("character")

            ref_audios = []
            audio_mode = "ambient"
            if options["audio_mode"] == "reference":
                temp_audio = await asyncio.to_thread(
                    _extract_source_audio,
                    options["ref_video"],
                    duration,
                    options["source_start"],
                )
                ref_audios = [temp_audio]
                audio_mode = "music"

            result = await generate_fasth3_multi_ref_video(
                ref_images,
                ref_audios,
                options["prompt"],
                options["resolution"],
                options["aspect_ratio"],
                duration,
                image_roles=ref_roles,
                image_labels=ref_labels,
                first_frame_filename=options["source_image"] if use_first_frame else None,
                audio_mode=audio_mode,
                ref_video_filename=prepared["filename"],
                video_reference_mode="recast",
                recast_preserve=options["preserve"],
                start_image_mode=start_mode,
            )
        else:
            ltx_audio_filename = None
            if options["audio_mode"] == "reference":
                temp_audio = await asyncio.to_thread(
                    _extract_source_audio,
                    options["ref_video"],
                    duration,
                    options["source_start"],
                )
                ltx_audio_filename = temp_audio

            result = await generate_ltx_recast_video(
                options["engine"],
                prepared["filename"],
                start_image_filename,
                _build_ltx_recast_prompt(options),
                options["resolution"],
                options["aspect_ratio"],
                duration,
                start_image_mode=start_mode,
                extra_ref_filenames=extra_images,
                guide_strength=options["source_guide_strength"],
                reference_fit=options["reference_fit"],
                source_control=options["source_control"],
                control_attention_strength=options["control_attention_strength"],
                start_image_strength=options["start_image_strength"],
                ref_image_strength=options["ref_image_strength"],
                seed=options["seed"],
                negative_prompt=options["negative_prompt"],
                prompt_enhance=options["prompt_enhance"],
                sampler_name=options["sampler_name"],
                audio_filename=ltx_audio_filename,
            )

        if not result or not result.get("success"):
            error = (result or {}).get("error") or "Recast generation failed"
            return {
                "success": False,
                "error": error,
                "code": "recast_generation_failed",
            }

        if options["engine"] in ("ltx23", "ltx25"):
            # LTX renders an integer-second latent window (rounded up above).
            # Trim the final file back to the exact requested/source duration.
            result["local_filename"] = await asyncio.to_thread(
                _trim_video_to_duration, result["local_filename"], duration
            )
            result["duration"] = duration

        if options["audio_mode"] == "copy":
            temp_audio = await asyncio.to_thread(
                _extract_source_audio,
                options["ref_video"],
                duration,
                options["source_start"],
            )
            try:
                new_filename = await asyncio.to_thread(
                    _mux_audio_onto_video,
                    result["local_filename"],
                    temp_audio,
                    duration,
                )
            except Exception:
                try:
                    os.remove(_local_path(VIDEOS_FOLDER, result["local_filename"]))
                except OSError:
                    pass
                raise
            result["local_filename"] = new_filename
            result["duration"] = duration
        elif options["engine"] in ("ltx23", "ltx25") and options["audio_mode"] == "mute":
            result["local_filename"] = await asyncio.to_thread(
                _strip_audio, result["local_filename"]
            )
            result["duration"] = duration

        metadata = build_recast_metadata(options, prepared, result)
        result["metadata"] = metadata
        result["recast"] = True
        result["recast_engine"] = options["engine"]
        result["experimental"] = options["engine"] in ("ltx23", "ltx25")
        result["warnings"] = metadata["warnings"]
        return result

    except RecastError as exc:
        return exc.to_dict()
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": f"Recast failed: {exc}",
            "code": "recast_failed",
        }
    finally:
        if prepared and prepared.get("filename"):
            try:
                os.remove(_local_path(VIDEOS_FOLDER, prepared["filename"]))
            except OSError:
                pass
        if temp_audio:
            try:
                os.remove(_local_path(AUDIO_FOLDER, temp_audio))
            except OSError:
                pass
        if temp_start_image:
            try:
                os.remove(_local_path(IMAGES_FOLDER, temp_start_image))
            except OSError:
                pass


async def generate_recast_with_progress(
    data: dict,
    count: int = 1,
    job_id: str = "",
    video_upscale=None,
    upscale_detail=None,
):
    """SSE progress wrapper for recast generation."""
    from services.comfy_progress import set_progress_job

    for i in range(max(1, int(count or 1))):
        yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"

        set_progress_job(job_id, i)
        task = asyncio.create_task(generate_recast(data))

        percent = 0
        while not task.done():
            percent = min(percent + 8, 92)
            yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': percent})}\n\n"
            await asyncio.sleep(2)

        result = await task
        if result.get("success"):
            from services.video_upscale_service import maybe_upscale_video_result
            result = await maybe_upscale_video_result(
                result, job_id=job_id, requested=video_upscale, detail=upscale_detail
            )

        yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': 100})}\n\n"

        if result.get("success"):
            yield f"data: {json.dumps({
                'type': 'video_ready',
                'index': i,
                'local_filename': result['local_filename'],
                'width': result.get('width', 0),
                'height': result.get('height', 0),
                'duration': result.get('duration'),
                'upscale': result.get('upscale'),
                'metadata': result.get('metadata'),
                'recast': True,
                'recast_engine': result.get('recast_engine'),
                'experimental': result.get('experimental', False),
                'warnings': result.get('warnings') or [],
            })}\n\n"
        else:
            yield f"data: {json.dumps({
                'type': 'error',
                'index': i,
                'error': result.get('error', 'Unknown error'),
                'code': result.get('code'),
            })}\n\n"
