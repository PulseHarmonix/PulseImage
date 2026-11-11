"""Optional video post-upscaling via ComfyUI.

RelayVSR X2 and ReCaVSR X4 are implemented. Upscaling is intentionally
best-effort: callers always keep the original generated video, and failures are
reported through an ``upscale`` metadata block rather than raised.
"""
from __future__ import annotations

import asyncio
import copy
import os
import time
from typing import Optional

import httpx

from config import get_comfyui_url, load_app_settings
from services.comfy_service import download_and_save_video, free_comfyui_memory
from services.comfy_progress import post_prompt, set_progress_job
from services.video_frame_service import probe_video
from utils.video_workflow_utils import (
    load_base_recavsr_workflow,
    load_base_relayvsr_workflow,
    modify_recavsr_workflow,
    modify_relayvsr_workflow,
)

VIDEOS_FOLDER = "videos"
SAVE_VIDEO_NODE = "9"

VIDEO_UPSCALE_ENGINES = ("off", "relayvsr_x2", "recavsr_x4")
DEFAULT_RELAYVSR_ENGINE = "relayvsr_x2"

RECAVSR_MODEL = "transformer_int8_convrot.safetensors"
RECAVSR_PROMPT = "prompt.safetensors"
RECAVSR_FLASHDECODER = "flashdecoder.safetensors"
RECAVSR_REQUIRED_MODELS = (RECAVSR_MODEL, RECAVSR_PROMPT, RECAVSR_FLASHDECODER)

RECAVSR_SCALE = 4.0
RECAVSR_COLOR_FIX = "none"
RECAVSR_SEED = 42
RECAVSR_DECODER = "flashdecoder"
RECAVSR_KERNELS = "fast"
RECAVSR_KV_OFFLOAD = False
RECAVSR_ENCODER = "h264 nvenc"
RECAVSR_FILENAME_PREFIX = "video/ReCaVSR_X4"
RECAVSR_DEFAULT_TIMEOUT = 7200
RECAVSR_MAX_OUTPUT_SIDE = 4096
RECAVSR_MAX_OUTPUT_PIXELS = 3840 * 2160

_STATUS_CACHE_SECONDS = 15.0
_status_cache: dict = {"ts": 0.0, "data": None}
_recavsr_status_cache: dict = {"ts": 0.0, "data": None}


def _settings() -> dict:
    try:
        return load_app_settings()
    except Exception:
        return {}


def _resolve_detail(detail) -> float:
    if detail is None:
        detail = _settings().get("relayvsr_detail", 1.0)
    try:
        return max(0.0, min(1.0, float(detail)))
    except (TypeError, ValueError):
        return 1.0


def _resolve_timeout(timeout) -> int:
    if timeout is None:
        timeout = _settings().get("relayvsr_timeout_seconds", 1800)
    try:
        val = int(timeout)
    except (TypeError, ValueError):
        val = 1800
    return val if val > 0 else 1800


def _resolve_recavsr_timeout(timeout) -> int:
    if timeout is None:
        timeout = _settings().get("recavsr_timeout_seconds", RECAVSR_DEFAULT_TIMEOUT)
    try:
        val = int(timeout)
    except (TypeError, ValueError):
        val = RECAVSR_DEFAULT_TIMEOUT
    return val if val > 0 else RECAVSR_DEFAULT_TIMEOUT


def _resolve_model() -> str:
    return str(_settings().get("relayvsr_model") or "relayvsr_x2_lightx2v_int8_convrot.safetensors")


def _resolve_vae() -> str:
    return str(_settings().get("relayvsr_vae") or "relayvsr_flash_vae_x2_fp32.safetensors")


def _model_names(data) -> list[str]:
    """Normalize the various /models or object_info response shapes into names."""
    names: list[str] = []

    def _add(item):
        if isinstance(item, str) and item.strip():
            names.append(item.strip())
        elif isinstance(item, dict):
            name = item.get("name") or item.get("path") or item.get("filename")
            if isinstance(name, str) and name.strip():
                names.append(name.strip())

    if isinstance(data, list):
        for item in data:
            _add(item)
    elif isinstance(data, dict):
        for key in ("value", "models", "data", "loras"):
            candidates = data.get(key)
            if isinstance(candidates, list):
                for item in candidates:
                    _add(item)
                break
    return names


def _failure(message: str, **extra) -> dict:
    out = {"success": False, "status": "failed", "error": message}
    out.update(extra)
    return out


async def get_relayvsr_status() -> dict:
    """Check ComfyUI nodes and model files required for RelayVSR X2.

    Returns ``{available, nodes_ok, models_ok, missing, model, vae, url}``.
    Results are cached briefly to avoid hammering ComfyUI from the UI.
    """
    now = time.time()
    cached = _status_cache.get("data")
    if cached is not None and (now - float(_status_cache.get("ts") or 0)) < _STATUS_CACHE_SECONDS:
        return cached

    url = get_comfyui_url()
    model = _resolve_model()
    vae = _resolve_vae()
    missing: list[str] = []
    nodes_ok = False
    models_ok = False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            conditioning_ok = False
            try:
                res = await client.get(f"{url}/object_info/RelayVSRConditioning")
                if res.status_code == 200:
                    info = res.json() or {}
                    conditioning_ok = isinstance(info, dict) and "RelayVSRConditioning" in info
            except Exception:
                conditioning_ok = False
            if not conditioning_ok:
                missing.append("RelayVSRConditioning node")

            decode_ok = False
            try:
                res = await client.get(f"{url}/object_info/VSRDecode")
                if res.status_code == 200:
                    info = res.json() or {}
                    decode_ok = isinstance(info, dict) and "VSRDecode" in info
            except Exception:
                decode_ok = False
            if not decode_ok:
                missing.append("VSRDecode node")
            nodes_ok = conditioning_ok and decode_ok

            diffusion_ok = False
            try:
                res = await client.get(f"{url}/models/diffusion_models")
                if res.status_code == 200:
                    diffusion_ok = model in _model_names(res.json())
            except Exception:
                diffusion_ok = False
            if not diffusion_ok:
                missing.append(model)

            vae_ok = False
            try:
                res = await client.get(f"{url}/models/vae")
                if res.status_code == 200:
                    vae_ok = vae in _model_names(res.json())
            except Exception:
                vae_ok = False
            if not vae_ok:
                missing.append(vae)

            models_ok = diffusion_ok and vae_ok
    except Exception as e:
        missing.append(f"ComfyUI unreachable: {e}")
        nodes_ok = False
        models_ok = False

    data = {
        "available": bool(nodes_ok and models_ok),
        "nodes_ok": bool(nodes_ok),
        "models_ok": bool(models_ok),
        "missing": missing,
        "model": model,
        "vae": vae,
        "url": url,
    }
    _status_cache["ts"] = now
    _status_cache["data"] = data
    return data


async def get_recavsr_status() -> dict:
    """Check ComfyUI nodes and model files required for ReCaVSR X4.

    Returns ``{available, implemented, nodes_ok, models_ok, missing, model, url}``.
    ``available`` reflects node/model readiness and ``implemented`` indicates the
    ReCaVSR workflow/service exists and can be executed.
    """
    now = time.time()
    cached = _recavsr_status_cache.get("data")
    if cached is not None and (now - float(_recavsr_status_cache.get("ts") or 0)) < _STATUS_CACHE_SECONDS:
        return cached

    url = get_comfyui_url()
    missing: list[str] = []
    loader_ok = False
    upscale_ok = False
    models_ok = False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.get(f"{url}/object_info/ReCaVSRLoader")
                if res.status_code == 200:
                    info = res.json() or {}
                    loader_ok = isinstance(info, dict) and "ReCaVSRLoader" in info
            except Exception:
                loader_ok = False
            if not loader_ok:
                missing.append("ReCaVSRLoader node")

            try:
                res = await client.get(f"{url}/object_info/ReCaVSRUpscale")
                if res.status_code == 200:
                    info = res.json() or {}
                    upscale_ok = isinstance(info, dict) and "ReCaVSRUpscale" in info
            except Exception:
                upscale_ok = False
            if not upscale_ok:
                missing.append("ReCaVSRUpscale node")
            nodes_ok = loader_ok and upscale_ok

            available_models: set[str] = set()
            try:
                res = await client.get(f"{url}/models/recavsr")
                if res.status_code == 200:
                    names = _model_names(res.json())
                    available_models = {name for name in names}
                    available_models.update(os.path.basename(name) for name in names)
            except Exception:
                available_models = set()

            for model_file in RECAVSR_REQUIRED_MODELS:
                if model_file not in available_models:
                    missing.append(model_file)

            models_ok = all(model_file in available_models for model_file in RECAVSR_REQUIRED_MODELS)
    except Exception as e:
        missing.append(f"ComfyUI unreachable: {e}")
        nodes_ok = False
        models_ok = False

    data = {
        "available": bool(nodes_ok and models_ok),
        "implemented": True,
        "nodes_ok": bool(nodes_ok),
        "models_ok": bool(models_ok),
        "missing": missing,
        "model": RECAVSR_MODEL,
        "url": url,
    }
    _recavsr_status_cache["ts"] = now
    _recavsr_status_cache["data"] = data
    return data


async def upload_video_to_comfy(local_filename: str) -> Optional[str]:
    """Upload a local ``videos/`` file to ComfyUI input via /upload/image.

    ComfyUI's upload handler accepts non-image files; LoadVideo reads the
    returned name from the input folder.
    """
    try:
        full_path = os.path.join(VIDEOS_FOLDER, local_filename)
        if not os.path.isfile(full_path):
            print(f"[RelayVSR] Source video not found locally: {full_path}")
            return None

        print(f"[RelayVSR] Uploading source video to ComfyUI: {local_filename}")
        with open(full_path, "rb") as f:
            files = {"image": (local_filename, f, "video/mp4")}
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(f"{get_comfyui_url()}/upload/image", files=files)
                if response.status_code == 200:
                    data = response.json() or {}
                    comfy_name = data.get("name")
                    if comfy_name:
                        print(f"[RelayVSR] Uploaded as Comfy input: {comfy_name}")
                        return comfy_name
                print(f"[RelayVSR] Upload failed {response.status_code}: {response.text[:300]}")
                return None
    except Exception as e:
        print(f"[RelayVSR] Upload exception: {e}")
        return None


def _find_video_output(outputs: dict, preferred_node: str = SAVE_VIDEO_NODE) -> Optional[dict]:
    """Return the first saved mp4 entry, preferring the SaveVideo node.

    LoadVideo also reports an mp4 under its outputs, but its type is ``input``.
    Only saved output files are downloadable through ComfyUI's ``/view``.
    """
    if not isinstance(outputs, dict):
        return None
    candidates = []
    if preferred_node in outputs:
        candidates.append(outputs[preferred_node])
    for nid, out in outputs.items():
        if nid != preferred_node:
            candidates.append(out)
    for out in candidates:
        if not isinstance(out, dict):
            continue
        for item in out.get("images") or []:
            if not isinstance(item, dict):
                continue
            if str(item.get("filename", "")).lower().endswith(".mp4") and item.get("type") in (None, "output"):
                return item
    return None


async def upscale_video_relayvsr(
    local_filename: str,
    job_id: Optional[str] = None,
    detail: Optional[float] = None,
    timeout: Optional[int] = None,
) -> dict:
    """Run RelayVSR X2 on a local video and return the new local file metadata.

    Never raises; a structured failure dict is returned instead.
    """
    try:
        if not local_filename:
            return _failure("No video filename supplied")

        detail_val = _resolve_detail(detail)
        timeout_val = _resolve_timeout(timeout)
        model = _resolve_model()
        vae = _resolve_vae()

        availability = await get_relayvsr_status()
        if not availability.get("available"):
            missing = ", ".join(availability.get("missing") or [])
            return _failure("RelayVSR X2 is unavailable" + (f": {missing}" if missing else ""))

        if job_id:
            set_progress_job(job_id, 0)

        await free_comfyui_memory()

        comfy_name = await upload_video_to_comfy(local_filename)
        if not comfy_name:
            return _failure("Failed to upload video to ComfyUI")

        base_workflow = load_base_relayvsr_workflow()
        workflow = modify_relayvsr_workflow(
            base_workflow,
            comfy_name,
            detail=detail_val,
            seed=0,
            model=model,
            vae=vae,
        )

        async with httpx.AsyncClient(timeout=float(timeout_val) + 120.0) as client:
            res = await post_prompt(client, workflow, stage="upscaling")
            try:
                prompt_id = (res.json() or {}).get("prompt_id")
            except Exception:
                prompt_id = None

            if not prompt_id:
                return _failure(f"ComfyUI rejected the RelayVSR prompt (HTTP {res.status_code})")

            print(f"[RelayVSR] Queued. Prompt ID: {prompt_id}")
            video_info = None
            deadline = time.monotonic() + timeout_val

            while time.monotonic() < deadline:
                await asyncio.sleep(1.0)
                try:
                    history = (await client.get(f"{get_comfyui_url()}/history/{prompt_id}")).json()
                    if prompt_id in history:
                        entry = history[prompt_id] or {}
                        run_status = entry.get("status") or {}
                        if run_status.get("status_str") == "error":
                            message = "ComfyUI RelayVSR execution error"
                            for item in run_status.get("messages") or []:
                                if isinstance(item, list) and len(item) > 1 and item[0] == "execution_error":
                                    details = item[1] or {}
                                    message = details.get("exception_message") or message
                                    break
                            return _failure(message)
                        outputs = entry.get("outputs") or {}
                        video_info = _find_video_output(outputs)
                        if video_info:
                            break
                except Exception:
                    pass

            if not video_info:
                return _failure("No upscaled video output found (timeout or execution error)")

            new_filename = await download_and_save_video(
                video_info.get("filename"), video_info.get("subfolder", "")
            )
            if not new_filename:
                return _failure("Failed to download upscaled video from ComfyUI")

        width = height = 0
        duration = 0.0
        fps = 0.0
        try:
            probe = probe_video(new_filename)
            width = int(probe.get("width") or 0)
            height = int(probe.get("height") or 0)
            duration = float(probe.get("duration") or 0.0)
            fps = float(probe.get("fps") or 0.0)
        except Exception as e:
            print(f"[RelayVSR] probe_video failed for {new_filename}: {e}")

        print(f"[RelayVSR] Upscaled {local_filename} -> {new_filename} ({width}x{height})")

        return {
            "success": True,
            "status": "success",
            "local_filename": new_filename,
            "width": width,
            "height": height,
            "duration": duration,
            "fps": fps,
            "upscale": {
                "status": "done",
                "engine": "relayvsr_x2",
                "model": model,
                "vae": vae,
                "detail": detail_val,
                "factor": 2,
                "source_filename": local_filename,
                "width": width,
                "height": height,
                "duration": duration,
            },
        }
    except Exception as e:
        print(f"[RelayVSR] Critical error: {e}")
        import traceback
        traceback.print_exc()
        return _failure(str(e))


async def upscale_video_recavsr(
    local_filename: str,
    job_id: Optional[str] = None,
    timeout: Optional[int] = None,
) -> dict:
    """Run ReCaVSR X4 on a local video and return the new local file metadata.

    Never raises; a structured failure dict is returned instead.
    """
    try:
        if not local_filename:
            return _failure("No video filename supplied")

        timeout_val = _resolve_recavsr_timeout(timeout)

        availability = await get_recavsr_status()
        if not availability.get("available"):
            missing = ", ".join(availability.get("missing") or [])
            return _failure("ReCaVSR X4 is unavailable" + (f": {missing}" if missing else ""))

        try:
            probe = probe_video(local_filename)
            source_width = int(probe.get("width") or 0)
            source_height = int(probe.get("height") or 0)
        except Exception as exc:
            return _failure(f"Could not read source video dimensions: {exc}")
        if source_width <= 0 or source_height <= 0:
            return _failure("Could not read source video dimensions")
        output_width = int(source_width * RECAVSR_SCALE + 0.5)
        output_height = int(source_height * RECAVSR_SCALE + 0.5)
        if (
            max(output_width, output_height) > RECAVSR_MAX_OUTPUT_SIDE
            or output_width * output_height > RECAVSR_MAX_OUTPUT_PIXELS
        ):
            return _failure(
                f"ReCaVSR X4 output would be {output_width}x{output_height}; "
                f"the H.264 encoder supports at most 4096 px per side and 3840x2160 pixels. "
                "Use a smaller source or RelayVSR X2."
            )

        if job_id:
            set_progress_job(job_id, 0)

        await free_comfyui_memory()

        comfy_name = await upload_video_to_comfy(local_filename)
        if not comfy_name:
            return _failure("Failed to upload video to ComfyUI")

        base_workflow = load_base_recavsr_workflow()
        workflow = modify_recavsr_workflow(
            base_workflow,
            comfy_name,
            model=RECAVSR_MODEL,
            scale=RECAVSR_SCALE,
            color_fix=RECAVSR_COLOR_FIX,
            seed=RECAVSR_SEED,
            decoder=RECAVSR_DECODER,
            kernels=RECAVSR_KERNELS,
            kv_offload=RECAVSR_KV_OFFLOAD,
            encoder=RECAVSR_ENCODER,
            filename_prefix=RECAVSR_FILENAME_PREFIX,
        )

        async with httpx.AsyncClient(timeout=float(timeout_val) + 120.0) as client:
            res = await post_prompt(client, workflow, stage="upscaling")
            try:
                prompt_id = (res.json() or {}).get("prompt_id")
            except Exception:
                prompt_id = None

            if not prompt_id:
                return _failure(f"ComfyUI rejected the ReCaVSR prompt (HTTP {res.status_code})")

            print(f"[ReCaVSR] Queued. Prompt ID: {prompt_id}")
            video_info = None
            deadline = time.monotonic() + timeout_val

            while time.monotonic() < deadline:
                await asyncio.sleep(1.0)
                try:
                    history = (await client.get(f"{get_comfyui_url()}/history/{prompt_id}")).json()
                    if prompt_id in history:
                        entry = history[prompt_id] or {}
                        run_status = entry.get("status") or {}
                        if run_status.get("status_str") == "error":
                            message = "ComfyUI ReCaVSR execution error"
                            for item in run_status.get("messages") or []:
                                if isinstance(item, list) and len(item) > 1 and item[0] == "execution_error":
                                    details = item[1] or {}
                                    message = details.get("exception_message") or message
                                    break
                            return _failure(message)
                        outputs = entry.get("outputs") or {}
                        video_info = _find_video_output(outputs, "6")
                        if video_info:
                            break
                except Exception:
                    pass

            if not video_info:
                return _failure("No upscaled video output found (timeout or execution error)")

            new_filename = await download_and_save_video(
                video_info.get("filename"), video_info.get("subfolder", "")
            )
            if not new_filename:
                return _failure("Failed to download upscaled video from ComfyUI")

        width = height = 0
        duration = 0.0
        fps = 0.0
        try:
            probe = probe_video(new_filename)
            width = int(probe.get("width") or 0)
            height = int(probe.get("height") or 0)
            duration = float(probe.get("duration") or 0.0)
            fps = float(probe.get("fps") or 0.0)
        except Exception as e:
            print(f"[ReCaVSR] probe_video failed for {new_filename}: {e}")

        print(f"[ReCaVSR] Upscaled {local_filename} -> {new_filename} ({width}x{height})")

        return {
            "success": True,
            "status": "success",
            "local_filename": new_filename,
            "width": width,
            "height": height,
            "duration": duration,
            "fps": fps,
            "upscale": {
                "status": "done",
                "engine": "recavsr_x4",
                "model": RECAVSR_MODEL,
                "factor": 4,
                "scale": RECAVSR_SCALE,
                "color_fix": RECAVSR_COLOR_FIX,
                "seed": RECAVSR_SEED,
                "decoder": RECAVSR_DECODER,
                "kernels": RECAVSR_KERNELS,
                "kv_offload": RECAVSR_KV_OFFLOAD,
                "encoder": RECAVSR_ENCODER,
                "source_filename": local_filename,
                "width": width,
                "height": height,
                "duration": duration,
            },
        }
    except Exception as e:
        print(f"[ReCaVSR] Critical error: {e}")
        import traceback
        traceback.print_exc()
        return _failure(str(e))


def _engine_factor(engine: str) -> int:
    """Return the spatial scale factor for an upscale engine."""
    return 4 if engine == "recavsr_x4" else 2


def resolve_upscale_engine(requested=None, settings: Optional[dict] = None) -> str:
    """Resolve a request/setting into one of ``off``, ``relayvsr_x2``, ``recavsr_x4``.

    ``None`` uses the configured ``video_upscale`` setting. A boolean ``True``
    enables the configured engine (falling back to RelayVSR X2 when the setting
    is off), while ``False`` disables upscaling. Legacy ``on``/``true`` style
    strings are treated like ``True``.
    """
    if settings is None:
        settings = _settings()

    configured = str(settings.get("video_upscale") or "off").strip().lower()
    if configured not in VIDEO_UPSCALE_ENGINES:
        configured = "off"

    if requested is None:
        return configured

    if isinstance(requested, bool):
        if not requested:
            return "off"
        return configured if configured != "off" else DEFAULT_RELAYVSR_ENGINE

    if isinstance(requested, str):
        value = requested.strip().lower()
        if value in VIDEO_UPSCALE_ENGINES:
            return value
        if value in ("on", "true", "1", "yes"):
            return configured if configured != "off" else DEFAULT_RELAYVSR_ENGINE
        if value in ("off", "false", "0", "no", ""):
            return "off"
        return "off"

    return configured if requested else "off"


async def maybe_upscale_video_result(
    result: dict,
    job_id: Optional[str] = None,
    requested=None,
    detail: Optional[float] = None,
) -> dict:
    """Post-upscale a successful generation result, preserving the original on failure."""
    if not isinstance(result, dict) or not result.get("success"):
        return result

    settings = _settings()
    engine = resolve_upscale_engine(requested, settings)
    if engine == "off":
        return result

    original_filename = result.get("local_filename")
    original_width = result.get("width")
    original_height = result.get("height")

    if not original_filename:
        result["upscale"] = {
            "status": "failed",
            "engine": engine,
            "factor": _engine_factor(engine),
            "error": "No local filename to upscale",
        }
        return result

    if engine == "recavsr_x4":
        status = await get_recavsr_status()
        if not status.get("available"):
            missing = ", ".join(status.get("missing") or [])
            result["upscale"] = {
                "status": "skipped",
                "engine": "recavsr_x4",
                "factor": 4,
                "error": "ReCaVSR X4 is unavailable" + (f": {missing}" if missing else ""),
                "missing": status.get("missing") or [],
                "source_filename": original_filename,
                "original_filename": original_filename,
                "original_width": original_width,
                "original_height": original_height,
            }
            return result
        up = await upscale_video_recavsr(original_filename, job_id=job_id)
    else:
        status = await get_relayvsr_status()
        if not status.get("available"):
            result["upscale"] = {
                "status": "skipped",
                "engine": "relayvsr_x2",
                "factor": 2,
                "error": "RelayVSR X2 is not available",
                "missing": status.get("missing") or [],
            }
            return result

        up = await upscale_video_relayvsr(original_filename, job_id=job_id, detail=detail)

    if not up.get("success"):
        result["upscale"] = {
            "status": "failed",
            "engine": engine,
            "factor": _engine_factor(engine),
            "error": up.get("error") or "Upscale failed",
        }
        return result

    upscale_meta = dict(up.get("upscale") or {})
    factor = _engine_factor(engine)
    upscale_meta.update({
        "engine": engine,
        "factor": factor,
        "original_filename": original_filename,
        "original_width": original_width,
        "original_height": original_height,
    })

    result["local_filename"] = up.get("local_filename") or original_filename
    result["width"] = up.get("width") or (
        int(original_width) * factor if isinstance(original_width, (int, float)) and original_width else original_width
    )
    result["height"] = up.get("height") or (
        int(original_height) * factor if isinstance(original_height, (int, float)) and original_height else original_height
    )
    if up.get("duration"):
        result["duration"] = up.get("duration")
    if up.get("fps"):
        result["fps"] = up.get("fps")
    result["upscale"] = upscale_meta
    return result


async def upscale_existing_asset(
    asset_id: str,
    job_id: Optional[str] = None,
    detail: Optional[float] = None,
    requested=None,
) -> dict:
    """Upscale an existing video asset into a NEW derived asset, leaving the original intact."""
    try:
        from services.generation_service import get_asset_by_id, save_generation

        asset = get_asset_by_id(asset_id)
        if not asset:
            return {"success": False, "error": "Asset not found", "asset": None}

        filename = asset.get("filename") or ""
        is_video = asset.get("type") == "video" or str(filename).lower().endswith(".mp4")
        if not is_video:
            return {"success": False, "error": "Asset is not a video", "asset": asset}
        if not filename:
            return {"success": False, "error": "Asset has no filename", "asset": asset}

        settings = _settings()
        configured = str(settings.get("video_upscale") or "off")
        engine = resolve_upscale_engine(
            requested if requested is not None else (
                configured if configured != "off" else DEFAULT_RELAYVSR_ENGINE
            ),
            settings,
        )
        if engine == "off":
            return {
                "success": False,
                "status": "skipped",
                "engine": "off",
                "error": "Video upscaling is disabled",
                "asset": asset,
            }

        factor = _engine_factor(engine)
        if engine == "recavsr_x4":
            status = await get_recavsr_status()
            if not status.get("available"):
                missing = ", ".join(status.get("missing") or [])
                reason = "ReCaVSR X4 is unavailable" + (f": {missing}" if missing else "")
                upscale_meta = {
                    "status": "skipped",
                    "engine": "recavsr_x4",
                    "factor": 4,
                    "error": reason,
                    "missing": status.get("missing") or [],
                    "original_filename": filename,
                    "original_width": asset.get("width"),
                    "original_height": asset.get("height"),
                }
                return {
                    "success": False,
                    "status": "skipped",
                    "engine": "recavsr_x4",
                    "error": reason,
                    "missing": status.get("missing") or [],
                    "asset": asset,
                    "upscale": upscale_meta,
                }
            up = await upscale_video_recavsr(filename, job_id=job_id)
        else:
            up = await upscale_video_relayvsr(filename, job_id=job_id, detail=detail)

        if not up.get("success"):
            return {
                "success": False,
                "status": "failed",
                "engine": engine,
                "factor": factor,
                "error": up.get("error") or "Upscale failed",
                "asset": asset,
            }

        upscale_meta = dict(up.get("upscale") or {})
        upscale_meta.update({
            "engine": engine,
            "factor": factor,
            "original_filename": filename,
            "original_width": asset.get("width"),
            "original_height": asset.get("height"),
        })

        metadata = copy.deepcopy(asset.get("metadata") or {})
        gen = metadata.get("gen")
        gen = copy.deepcopy(gen) if isinstance(gen, dict) else {}
        gen["video_upscale"] = engine
        gen["upscale"] = upscale_meta
        metadata["gen"] = gen
        metadata["upscale"] = copy.deepcopy(upscale_meta)

        duration = up.get("duration")
        if duration is None:
            duration = (asset.get("metadata") or {}).get("duration")

        src_w = asset.get("width")
        src_h = asset.get("height")
        new_w = up.get("width") or (
            int(src_w) * factor if isinstance(src_w, (int, float)) and src_w else 0
        )
        new_h = up.get("height") or (
            int(src_h) * factor if isinstance(src_h, (int, float)) and src_h else 0
        )

        new_id = save_generation(
            prompt=asset.get("prompt") or "",
            filename=up.get("local_filename"),
            file_type="video",
            aspect_ratio=asset.get("aspect_ratio") or "3:2",
            width=new_w,
            height=new_h,
            duration=duration,
            parent_id=asset_id,
            derived_from=[asset_id],
            metadata=metadata,
        )

        new_asset = get_asset_by_id(new_id)
        return {
            "success": True,
            "result": up,
            "asset": new_asset,
            "upscale": upscale_meta,
        }
    except Exception as e:
        print(f"[RelayVSR] upscale_existing_asset error: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e), "asset": None}
