import json
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse, JSONResponse
from services.comfy_service import (
    generate_images_with_progress,
    generate_videos_with_progress,
    generate_image_to_videos_with_progress,
    generate_single_image_to_video,
    generate_single_image_audio_to_video,
    generate_image_to_images_with_progress,
    generate_single_video,
    generate_double_image_to_image,
    generate_single_image_to_image,
    generate_multiple_images,
    generate_image_audio_to_videos_with_progress,
    generate_double_image_to_image_with_progress,
    generate_fasth3_multi_ref_video,
    generate_fasth3_multi_ref_videos_with_progress,
    resolve_video_model,
    free_comfyui_memory,
    should_free_vram_for_video,
)
from services.generation_service import (
    save_generation,
    update_generation,
    delete_generation,
    load_generations
)
from services.comfy_progress import set_progress_job
from services.video_upscale_service import (
    maybe_upscale_video_result,
    upscale_existing_asset,
)

router = APIRouter()


def video_reference_error(resolved_model, source_image, ref_audios, fasth3_mode):
    if not ref_audios:
        return None
    if resolved_model == "fasth3":
        if fasth3_mode == "i2v":
            return "FastH3 First-frame mode does not support audio references."
        return None
    if not source_image and resolved_model in ("ltx", "grok"):
        return "Audio-only video requires FastH3 and an appropriate model."
    if resolved_model == "grok":
        return "Grok video does not support audio references."
    return None


@router.post("/generate")
async def generate(data: dict):
    """Generate images or videos based on the provided prompt and parameters."""
    prompt = data.get("prompt")
    resolution = data.get("resolution", "720p")
    aspect_ratio = data.get("aspect_ratio", "16:9")
    mode = data.get("mode", "image")           # ← Use mode instead
    duration = data.get("duration")
    count = data.get("count", 4)
    source_image = data.get("source_image")
    modifier_audio = data.get("modifier_audio")
    modifier_image = data.get("modifier_image")
    image_model = data.get("image_model", "schnell")
    i2i_model = data.get("i2i_model", "klein")
    video_model = data.get("video_model")  # "ltx" | "fasth3" | "grok"; None → settings
    ltx_version = data.get("ltx_version")  # "2.3" | "2.5"; None → settings
    ref_images = (data.get("ref_images") or [])[:6]
    ref_audios = (data.get("ref_audios") or [])[:3]
    if modifier_audio and modifier_audio not in ref_audios:
        ref_audios = (ref_audios + [modifier_audio])[:3]
    qwen_turbo = data.get("qwen_turbo", True)
    lora_name = data.get("lora_name")
    job_id = data.get("job_id") or ""
    disable_prompt_enhance = bool(data.get("disable_prompt_enhance"))
    fasth3_mode = data.get("fasth3_mode") or "reference"
    video_upscale = data.get("video_upscale")
    upscale_detail = data.get("upscale_detail")

    if mode == "video" and duration:
        resolved_model = resolve_video_model(video_model)
        reference_error = video_reference_error(
            resolved_model, source_image, ref_audios, fasth3_mode
        )
        if reference_error:
            return {"success": False, "error": reference_error}
        if should_free_vram_for_video(video_model, resolution):
            await free_comfyui_memory()
        if resolved_model == "fasth3":
            # Image-only: optionally use the first-frame I2V workflow.
            if fasth3_mode == "i2v" and source_image and not modifier_audio and not ref_audios:
                set_progress_job(job_id, 0)
                result = await generate_single_image_to_video(
                    source_image, prompt, resolution, aspect_ratio, duration,
                    video_model=video_model, ltx_version=ltx_version,
                )
                result = await maybe_upscale_video_result(
                    result, job_id=job_id, requested=video_upscale, detail=upscale_detail
                )
                return {"success": True, "results": [result]}
            # Reference workflows: 1 image (no audio), 2+ images, or multiple audios.
            if (
                (ref_images or len(ref_audios) > 1 or (not source_image and ref_audios))
                and not (len(ref_images) == 1 and len(ref_audios) == 1)
            ):
                set_progress_job(job_id, 0)
                result = await generate_fasth3_multi_ref_video(
                    ref_images, ref_audios, prompt, resolution, aspect_ratio, duration
                )
                result = await maybe_upscale_video_result(
                    result, job_id=job_id, requested=video_upscale, detail=upscale_detail
                )
                return {"success": True, "results": [result]}
        if modifier_audio and source_image:
            # IA2V is LTX-only (Grok has no image+audio→video)
            set_progress_job(job_id, 0)
            result = await generate_single_image_audio_to_video(
                source_image, modifier_audio, prompt, resolution, aspect_ratio, duration,
                ltx_version=ltx_version, video_model=video_model,
            )
            result = await maybe_upscale_video_result(
                result, job_id=job_id, requested=video_upscale, detail=upscale_detail
            )
            return {"success": True, "results": [result]}
        elif source_image:
            set_progress_job(job_id, 0)
            result = await generate_single_image_to_video(
                source_image, prompt, resolution, aspect_ratio, duration,
                video_model=video_model, ltx_version=ltx_version,
            )
            result = await maybe_upscale_video_result(
                result, job_id=job_id, requested=video_upscale, detail=upscale_detail
            )
            return {"success": True, "results": [result]}
        else:
            set_progress_job(job_id, 0)
            result = await generate_single_video(
                prompt, resolution, aspect_ratio, duration,
                video_model=video_model, ltx_version=ltx_version,
                disable_prompt_enhance=disable_prompt_enhance,
            )
            result = await maybe_upscale_video_result(
                result, job_id=job_id, requested=video_upscale, detail=upscale_detail
            )
            return {"success": True, "results": [result]}
    else:
        if source_image and modifier_image:
            # double i2i (2 images)
            set_progress_job(job_id, 0)
            result = await generate_double_image_to_image(
                source_image, modifier_image, prompt, i2i_model=i2i_model
            )
            return {"success": True, "results": [result]}
        elif source_image:
            # i2i
            set_progress_job(job_id, 0)
            result = await generate_single_image_to_image(source_image, prompt, i2i_model=i2i_model)
            return {"success": True, "results": [result]}
        else:
            # Image generation (default)
            lora_strength = float(data.get("lora_strength", 0.6)) if data.get("lora_strength") is not None else 0.6
            set_progress_job(job_id, 0)
            results = await generate_multiple_images(prompt, resolution, aspect_ratio, count=count, image_model=image_model, qwen_turbo=qwen_turbo, lora_name=lora_name, lora_strength=lora_strength)
            return {"success": True, "results": results}

@router.post("/generate/stream")
async def generate_stream(data: dict):
    """Stream generation progress via Server-Sent Events for images or videos."""
    prompt = data.get("prompt", "")
    resolution = data.get("resolution", "720p")
    aspect_ratio = data.get("aspect_ratio", "16:9")
    mode = data.get("mode", "image")
    duration = data.get("duration")
    count = data.get("count")
    source_image = data.get("source_image")  # local filename for image-to-video
    modifier_audio = data.get("modifier_audio")  # audio modifier selected via modal + for ia2v
    modifier_image = data.get("modifier_image")  # image modifier for double i2i (2 refs)
    image_model = data.get("image_model", "schnell")  # for main page text-to-image model choice
    i2i_model = data.get("i2i_model", "klein")  # for modal image-to-image edits
    video_model = data.get("video_model")  # "ltx" | "fasth3" | "grok"
    ltx_version = data.get("ltx_version")  # "2.3" | "2.5"
    ref_images = (data.get("ref_images") or [])[:6]
    ref_audios = (data.get("ref_audios") or [])[:3]
    if modifier_audio and modifier_audio not in ref_audios:
        ref_audios = (ref_audios + [modifier_audio])[:3]
    qwen_turbo = data.get("qwen_turbo", True)
    lora_name = data.get("lora_name")
    lora_strength = float(data.get("lora_strength", 0.6)) if data.get("lora_strength") is not None else 0.6
    job_id = data.get("job_id") or ""
    disable_prompt_enhance = bool(data.get("disable_prompt_enhance"))
    fasth3_mode = data.get("fasth3_mode") or "reference"
    video_upscale = data.get("video_upscale")
    upscale_detail = data.get("upscale_detail")

    if not prompt:
        return JSONResponse({"success": False, "error": "Prompt required"}, status_code=400)

    is_video = (mode == "video" and duration)
    if count is None:
        count = 1 if is_video else 4

    if is_video:
        resolved_model = resolve_video_model(video_model)
        reference_error = video_reference_error(
            resolved_model, source_image, ref_audios, fasth3_mode
        )
        if reference_error:
            return JSONResponse({"success": False, "error": reference_error}, status_code=400)
        if should_free_vram_for_video(video_model, resolution):
            await free_comfyui_memory()
        if resolved_model == "fasth3":
            if fasth3_mode == "i2v" and source_image and not modifier_audio and not ref_audios:
                return StreamingResponse(
                    generate_image_to_videos_with_progress(
                        source_image, prompt, resolution, aspect_ratio, duration,
                        count=count, video_model=video_model, ltx_version=ltx_version, job_id=job_id,
                        video_upscale=video_upscale, upscale_detail=upscale_detail,
                    ),
                    media_type="text/event-stream"
                )
            if (
                (ref_images or len(ref_audios) > 1 or (not source_image and ref_audios))
                and not (len(ref_images) == 1 and len(ref_audios) == 1)
            ):
                return StreamingResponse(
                    generate_fasth3_multi_ref_videos_with_progress(
                        ref_images, ref_audios, prompt, resolution, aspect_ratio, duration, count=count, job_id=job_id,
                        video_upscale=video_upscale, upscale_detail=upscale_detail,
                    ),
                    media_type="text/event-stream"
                )
        if modifier_audio and source_image:
            # IA2V is LTX-only
            return StreamingResponse(
                generate_image_audio_to_videos_with_progress(
                    source_image, modifier_audio, prompt, resolution, aspect_ratio, duration,
                    count=count, ltx_version=ltx_version, video_model=video_model, job_id=job_id,
                    video_upscale=video_upscale, upscale_detail=upscale_detail,
                ),
                media_type="text/event-stream"
            )
        elif source_image:
            return StreamingResponse(
                generate_image_to_videos_with_progress(
                    source_image, prompt, resolution, aspect_ratio, duration,
                    count=count, video_model=video_model, ltx_version=ltx_version, job_id=job_id,
                    video_upscale=video_upscale, upscale_detail=upscale_detail,
                ),
                media_type="text/event-stream"
            )
        else:
            return StreamingResponse(
                generate_videos_with_progress(
                    prompt, resolution, aspect_ratio, duration,
                    count=count, video_model=video_model, ltx_version=ltx_version, job_id=job_id,
                    disable_prompt_enhance=disable_prompt_enhance,
                    video_upscale=video_upscale, upscale_detail=upscale_detail,
                ),
                media_type="text/event-stream"
            )
    else:
        if source_image and modifier_image:
            # Double image-to-image (2 reference images + prompt) — Comfy Klein or Grok multi-ref edit
            return StreamingResponse(
                generate_double_image_to_image_with_progress(
                    source_image, modifier_image, prompt, count=count, i2i_model=i2i_model, job_id=job_id
                ),
                media_type="text/event-stream"
            )
        elif source_image:
            # Image-to-Image path (adjustment prompt from modal) - single ref + prompt, using selected i2i model
            return StreamingResponse(
                generate_image_to_images_with_progress(
                    source_image, prompt, count=count, i2i_model=i2i_model, job_id=job_id
                ),
                media_type="text/event-stream"
            )
        else:
            return StreamingResponse(
                generate_images_with_progress(prompt, resolution, aspect_ratio, count=count, image_model=image_model, qwen_turbo=qwen_turbo, lora_name=lora_name, lora_strength=lora_strength, job_id=job_id),
                media_type="text/event-stream"
            )

@router.post("/upscale-video")
async def upscale_video(data: dict):
    """Upscale an existing video asset into a new derived asset via RelayVSR X2."""
    asset_id = (data or {}).get("asset_id")
    if not asset_id:
        return {"success": False, "error": "asset_id is required"}

    job_id = (data or {}).get("job_id") or ""
    detail = (data or {}).get("detail")

    result = await upscale_existing_asset(asset_id, job_id=job_id, detail=detail)
    return {
        "success": bool(result.get("success")),
        "result": result.get("result"),
        "asset": result.get("asset"),
        "error": result.get("error"),
    }


@router.post("/save-generation")
async def save_generation_endpoint(request: Request):
    """Save a generated asset (image/video) to the library."""
    try:
        body = await request.body()
        raw = body.decode("utf-8", errors="ignore")
        print("[SAVE] Raw body:", raw)

        data = json.loads(raw)

        # Handle case where frontend sends just a string
        if isinstance(data, str):
            print("[SAVE] WARNING: Received string instead of object")
            return {"success": False, "error": "Invalid data format. Expected object, got string."}

        prompt = data.get("prompt")
        filename = data.get("filename")

        if not prompt or not filename:
            return {"success": False, "error": "prompt and filename are required"}

        asset_id = save_generation(
            prompt=prompt,
            filename=filename,
            file_type=data.get("type", "image"),
            aspect_ratio=data.get("aspect_ratio", "3:2"),
            width=data.get("width", 0),
            height=data.get("height", 0),
            duration=data.get("duration"),
            parent_id=data.get("parent_id"),
            derived_from=data.get("derived_from", []),
            metadata=data.get("metadata", {}),
            favorite=data.get("favorite", False),
            character=data.get("character", False),
            voice=data.get("voice", False)
        )
        return {"success": True, "id": asset_id}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

@router.post("/update-generation")
async def update_generation_endpoint(request: Request):
    """Update an existing generation's metadata (e.g. favorite status)."""
    try:
        data = await request.json()
        asset_id = data.get("id")
        if not asset_id:
            return {"success": False, "error": "id is required"}
        updates = {}
        if "favorite" in data:
            updates["favorite"] = bool(data.get("favorite"))
        if "character" in data:
            updates["character"] = bool(data.get("character"))
        if "voice" in data:
            updates["voice"] = bool(data.get("voice"))
        if not updates:
            return {"success": False, "error": "no valid updates provided"}
        success = update_generation(asset_id, updates)
        if success:
            return {"success": True}
        return {"success": False, "error": "asset not found"}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

@router.post("/delete-generation")
async def delete_generation_endpoint(request: Request):
    """Delete a generation from the library, optionally cascading to derived assets."""
    try:
        data = await request.json()
        asset_id = data.get("id")
        cascade = bool(data.get("cascade", False))
        if not asset_id:
            return {"success": False, "error": "id is required"}
        result = delete_generation(asset_id, cascade)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

@router.get("/history")
async def get_history():
    """Return the full generation history from the library."""
    return load_generations()
