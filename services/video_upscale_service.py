"""Optional RelayVSR X2 video post-upscaling via ComfyUI.

The upscaler is intentionally best-effort: callers always keep the original
generated video, and failures are reported through an ``upscale`` metadata
block rather than raised.
"""
from __future__ import annotations

import asyncio
import copy
import os
import time
from typing import Optional

import httpx

from config import get_comfyui_url, load_app_settings
from services.comfy_service import download_and_save_video, wait_for_comfy_queue_idle
from services.comfy_progress import post_prompt, set_progress_job
from services.video_frame_service import probe_video
from utils.video_workflow_utils import (
    load_base_relayvsr_workflow,
    modify_relayvsr_workflow,
)

VIDEOS_FOLDER = "videos"
SAVE_VIDEO_NODE = "9"

_STATUS_CACHE_SECONDS = 15.0
_status_cache: dict = {"ts": 0.0, "data": None}


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


def _find_video_output(outputs: dict) -> Optional[dict]:
    """Return the first saved mp4 entry, preferring the SaveVideo node."""
    if not isinstance(outputs, dict):
        return None
    candidates = []
    if SAVE_VIDEO_NODE in outputs:
        candidates.append(outputs[SAVE_VIDEO_NODE])
    for nid, out in outputs.items():
        if nid != SAVE_VIDEO_NODE:
            candidates.append(out)
    for out in candidates:
        if not isinstance(out, dict):
            continue
        for item in out.get("images") or []:
            if isinstance(item, dict) and str(item.get("filename", "")).lower().endswith(".mp4"):
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

        await wait_for_comfy_queue_idle()

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


def _upscale_requested(requested, settings: dict) -> bool:
    """Decide whether the optional upscale pass should run."""
    if requested is None:
        return str(settings.get("video_upscale") or "off") == "relayvsr_x2"
    if isinstance(requested, bool):
        return requested
    if isinstance(requested, str):
        return requested.strip().lower() in ("relayvsr_x2", "on", "true", "1", "yes")
    return bool(requested)


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
    if not _upscale_requested(requested, settings):
        return result

    original_filename = result.get("local_filename")
    original_width = result.get("width")
    original_height = result.get("height")

    if not original_filename:
        result["upscale"] = {"status": "failed", "error": "No local filename to upscale"}
        return result

    status = await get_relayvsr_status()
    if not status.get("available"):
        result["upscale"] = {
            "status": "skipped",
            "error": "RelayVSR X2 is not available",
            "missing": status.get("missing") or [],
        }
        return result

    up = await upscale_video_relayvsr(original_filename, job_id=job_id, detail=detail)
    if not up.get("success"):
        result["upscale"] = {
            "status": "failed",
            "error": up.get("error") or "Upscale failed",
        }
        return result

    upscale_meta = dict(up.get("upscale") or {})
    upscale_meta.update({
        "original_filename": original_filename,
        "original_width": original_width,
        "original_height": original_height,
    })

    result["local_filename"] = up.get("local_filename") or original_filename
    result["width"] = up.get("width") or (
        int(original_width) * 2 if isinstance(original_width, (int, float)) and original_width else original_width
    )
    result["height"] = up.get("height") or (
        int(original_height) * 2 if isinstance(original_height, (int, float)) and original_height else original_height
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

        up = await upscale_video_relayvsr(filename, job_id=job_id, detail=detail)
        if not up.get("success"):
            return {"success": False, "error": up.get("error") or "Upscale failed", "asset": asset}

        upscale_meta = dict(up.get("upscale") or {})
        upscale_meta.update({
            "original_filename": filename,
            "original_width": asset.get("width"),
            "original_height": asset.get("height"),
        })

        metadata = copy.deepcopy(asset.get("metadata") or {})
        gen = metadata.get("gen")
        gen = copy.deepcopy(gen) if isinstance(gen, dict) else {}
        gen["video_upscale"] = "relayvsr_x2"
        gen["upscale"] = upscale_meta
        metadata["gen"] = gen
        metadata["upscale"] = copy.deepcopy(upscale_meta)

        duration = up.get("duration")
        if duration is None:
            duration = (asset.get("metadata") or {}).get("duration")

        src_w = asset.get("width")
        src_h = asset.get("height")
        new_w = up.get("width") or (
            int(src_w) * 2 if isinstance(src_w, (int, float)) and src_w else 0
        )
        new_h = up.get("height") or (
            int(src_h) * 2 if isinstance(src_h, (int, float)) and src_h else 0
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
