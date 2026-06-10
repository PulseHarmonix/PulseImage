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
)
from services.generation_service import (
    save_generation,
    update_generation,
    delete_generation,
    load_generations
)

router = APIRouter()

@router.post("/generate")
async def generate(data: dict):
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
    qwen_turbo = data.get("qwen_turbo", True)
    lora_name = data.get("lora_name")

    if mode == "video" and duration:
        if modifier_audio and source_image:
            result = await generate_single_image_audio_to_video(source_image, modifier_audio, prompt, resolution, aspect_ratio, duration)
            return {"success": True, "results": [result]}
        elif source_image:
            result = await generate_single_image_to_video(source_image, prompt, resolution, aspect_ratio, duration)
            return {"success": True, "results": [result]}
        else:
            result = await generate_single_video(prompt, resolution, aspect_ratio, duration)
            return {"success": True, "results": [result]}
    else:
        if source_image and modifier_image:
            # double i2i (2 images)
            result = await generate_double_image_to_image(source_image, modifier_image, prompt)
            return {"success": True, "results": [result]}
        elif source_image:
            # i2i
            result = await generate_single_image_to_image(source_image, prompt, i2i_model=i2i_model)
            return {"success": True, "results": [result]}
        else:
            # Image generation (default)
            lora_strength = float(data.get("lora_strength", 0.8)) if data.get("lora_strength") is not None else 0.8
            results = await generate_multiple_images(prompt, resolution, aspect_ratio, count=count, image_model=image_model, qwen_turbo=qwen_turbo, lora_name=lora_name, lora_strength=lora_strength)
            return {"success": True, "results": results}

@router.post("/generate/stream")
async def generate_stream(data: dict):
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
    qwen_turbo = data.get("qwen_turbo", True)
    lora_name = data.get("lora_name")
    lora_strength = float(data.get("lora_strength", 0.8)) if data.get("lora_strength") is not None else 0.8

    if not prompt:
        return JSONResponse({"success": False, "error": "Prompt required"}, status_code=400)

    is_video = (mode == "video" and duration)
    if count is None:
        count = 1 if is_video else 4

    if is_video:
        if modifier_audio and source_image:
            # New: Image + Audio modifier to Video (ltx2_3_image_audio_to_video.json)
            # Triggered when + in modal picked an audio + video mode (or Create Video + audio mod)
            return StreamingResponse(
                generate_image_audio_to_videos_with_progress(
                    source_image, modifier_audio, prompt, resolution, aspect_ratio, duration, count=count
                ),
                media_type="text/event-stream"
            )
        elif source_image:
            # Image-to-Video path (triggered from modal "Create Video From this")
            return StreamingResponse(
                generate_image_to_videos_with_progress(
                    source_image, prompt, resolution, aspect_ratio, duration, count=count
                ),
                media_type="text/event-stream"
            )
        else:
            # Regular text-to-video
            return StreamingResponse(
                generate_videos_with_progress(prompt, resolution, aspect_ratio, duration, count=count),
                media_type="text/event-stream"
            )
    else:
        if source_image and modifier_image:
            # Double image-to-image (2 reference images + prompt) using the new flux2_klein_image_image_to_image workflow.
            # 1st ref = main image (opened in modal), 2nd ref = modifier image (selected via + in modal), when in image mode.
            return StreamingResponse(
                generate_double_image_to_image_with_progress(
                    source_image, modifier_image, prompt, count=count
                ),
                media_type="text/event-stream"
            )
        elif source_image:
            # Image-to-Image path (adjustment prompt from modal) - single ref + prompt, using selected i2i model
            return StreamingResponse(
                generate_image_to_images_with_progress(
                    source_image, prompt, count=count, i2i_model=i2i_model
                ),
                media_type="text/event-stream"
            )
        else:
            return StreamingResponse(
                generate_images_with_progress(prompt, resolution, aspect_ratio, count=count, image_model=image_model, qwen_turbo=qwen_turbo, lora_name=lora_name, lora_strength=lora_strength),
                media_type="text/event-stream"
            )

@router.post("/save-generation")
async def save_generation_endpoint(request: Request):
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
            favorite=data.get("favorite", False)
        )
        return {"success": True, "id": asset_id}

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

@router.post("/update-generation")
async def update_generation_endpoint(request: Request):
    try:
        data = await request.json()
        asset_id = data.get("id")
        if not asset_id:
            return {"success": False, "error": "id is required"}
        updates = {}
        if "favorite" in data:
            updates["favorite"] = bool(data.get("favorite"))
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
    return load_generations()
