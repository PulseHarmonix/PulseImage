# services/comfy_service.py
import httpx
import os
import uuid
import json
import asyncio
import time

from services.comfy_progress import (
    get_progress_job,
    post_prompt,
    progress_idle_timed_out,
    set_progress_job,
)
from config import get_generation_idle_timeout_seconds, get_generation_max_attempts

from typing import Optional, AsyncGenerator

# Lazy import PIL only when needed for i2i dimensions
try:
    from PIL import Image
except ImportError:
    Image = None  # will fallback to 0,0 if not available
from utils.workflow_utils import (
    load_base_workflow,
    modify_workflow,
    get_image_dimensions,
    load_base_klein_workflow,
    modify_klein_workflow,
    load_base_qwen_workflow,
    modify_qwen_workflow,
    load_base_lora_workflow,
    modify_lora_workflow,
    load_base_image_to_image_workflow,
    modify_image_to_image_workflow,
    load_base_klein_image_to_image_workflow,
    modify_klein_image_to_image_workflow,
    load_base_klein_double_image_to_image_workflow,
    modify_klein_double_image_to_image_workflow
)
from utils.video_workflow_utils import (
    load_base_video_workflow,
    modify_video_workflow,
    get_ltx_recast_dimensions,
    get_video_dimensions,
    load_base_image_to_video_workflow,
    modify_image_to_video_workflow,
    load_base_image_audio_to_video_workflow,
    modify_image_audio_to_video_workflow,
    load_base_ltx25_text_to_video_workflow,
    modify_ltx25_text_to_video_workflow,
    load_base_ltx25_image_to_video_workflow,
    modify_ltx25_image_to_video_workflow,
    load_base_ltx25_image_audio_to_video_workflow,
    modify_ltx25_image_audio_to_video_workflow,
    load_base_fasth3_text_to_video_workflow,
    modify_fasth3_text_to_video_workflow,
    load_base_fasth3_image_to_video_workflow,
    modify_fasth3_image_to_video_workflow,
    load_base_fasth3_image_audio_guide_workflow,
    modify_fasth3_image_audio_guide_workflow,
    load_base_fasth3_reference_image_audio_to_video_workflow,
    modify_fasth3_reference_image_audio_to_video_workflow,
    load_base_fasth3_multi_ref_workflow,
    modify_fasth3_multi_ref_workflow,
    load_base_fasth3_multi_ref_guide_workflow,
    modify_fasth3_multi_ref_guide_workflow,
    load_base_ltx23_recast_workflow,
    modify_ltx23_recast_workflow,
    load_base_ltx25_recast_workflow,
    modify_ltx25_recast_workflow,
)

IMAGES_FOLDER = "images"
VIDEOS_FOLDER = "videos"
AUDIO_FOLDER = "audio"

# Make sure folders exist
os.makedirs(IMAGES_FOLDER, exist_ok=True)
os.makedirs(VIDEOS_FOLDER, exist_ok=True)
os.makedirs(AUDIO_FOLDER, exist_ok=True)


def get_comfyui_url() -> str:
    """Return the current ComfyUI base URL from the database (falls back to localhost)."""
    from config import get_comfyui_url as config_get_comfyui_url
    return config_get_comfyui_url()


async def check_comfyui_connection() -> bool:
    """Check if ComfyUI is reachable"""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{get_comfyui_url()}/system_stats")
            return response.status_code == 200
    except Exception:
        return False


COMFY_QUEUE_SETTLE_SECONDS = 3.0


async def wait_for_comfy_queue_idle(
    settle_seconds: float = COMFY_QUEUE_SETTLE_SECONDS,
    max_wait_seconds: float = 180.0,
) -> None:
    """Wait until ComfyUI has no running/pending jobs, then settle briefly.

    Prevents firing the next prompt while the previous render is still
    finalizing, which can leave the queue wedged.
    """
    start = time.monotonic()
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            while time.monotonic() - start < max_wait_seconds:
                try:
                    q = (await client.get(f"{get_comfyui_url()}/queue")).json()
                except Exception:
                    break  # ComfyUI unreachable; let the caller report it
                running = q.get("queue_running") or []
                pending = q.get("queue_pending") or []
                if not running and not pending:
                    break
                await asyncio.sleep(1.0)
    except Exception:
        pass
    if settle_seconds > 0:
        await asyncio.sleep(settle_seconds)


async def interrupt_comfy_prompt(prompt_id: str | None = None) -> None:
    """Best-effort request for ComfyUI to cancel the current/pending prompt.

    Never raises: a failed interrupt must not break the caller's error path.
    """
    try:
        payload = {"prompt_id": prompt_id} if prompt_id else {}
        async with httpx.AsyncClient(timeout=10.0) as client:
            await client.post(f"{get_comfyui_url()}/interrupt", json=payload)
    except Exception as e:
        print(f"⚠️ Failed to interrupt ComfyUI prompt {prompt_id or '(current)'}: {e}")


async def fetch_loras_from_comfy() -> list[str]:
    """Query ComfyUI for available LoRAs.
    Prefers the direct /models/loras endpoint (user-confirmed working; lists files in loras folder + subdirs).
    Falls back to /object_info LoraLoader options for compatibility with older setups.
    Returns list of .safetensors filenames (may include subfolder paths like foo/bar.safetensors).
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Primary: direct models endpoint (user confirmed /models/loras works)
            res = await client.get(f"{get_comfyui_url()}/models/loras")
            if res.status_code == 200:
                data = res.json()
                loras = []
                # Direct list (common)
                if isinstance(data, list):
                    for item in data:
                        if isinstance(item, str) and item.strip():
                            loras.append(item)
                        elif isinstance(item, dict):
                            name = item.get("name") or item.get("path") or item.get("filename")
                            if name and isinstance(name, str) and name.strip():
                                loras.append(name)
                # Wrapped object (some versions / configs)
                elif isinstance(data, dict):
                    candidates = data.get("models") or data.get("loras") or data.get("data") or []
                    if isinstance(candidates, list):
                        for item in candidates:
                            if isinstance(item, str) and item.strip():
                                loras.append(item)
                            elif isinstance(item, dict):
                                name = item.get("name") or item.get("path") or item.get("filename")
                                if name and isinstance(name, str) and name.strip():
                                    loras.append(name)
                if loras:
                    return sorted(set(loras))

            # Fallback: /object_info for LoraLoader (older or different setups)
            res = await client.get(f"{get_comfyui_url()}/object_info")
            if res.status_code == 200:
                data = res.json()
                loras = set()
                for loader in ("LoraLoader", "LoraLoaderModelOnly"):
                    if loader in data:
                        inputs = data[loader].get("input", {}).get("required", {})
                        lora_spec = inputs.get("lora_name")
                        if isinstance(lora_spec, list) and len(lora_spec) >= 2:
                            opts = lora_spec[1]
                            if isinstance(opts, dict) and "options" in opts and isinstance(opts["options"], list):
                                for o in opts["options"]:
                                    if isinstance(o, str) and o.strip():
                                        loras.add(o)
                        elif isinstance(lora_spec, dict) and "options" in lora_spec:
                            for o in lora_spec["options"]:
                                if isinstance(o, str) and o.strip():
                                    loras.add(o)
                if loras:
                    return sorted(loras)

            return []
    except Exception as e:
        print(f"⚠️ Failed to fetch LoRAs from ComfyUI: {e}")
        return []


async def fetch_comfy_models() -> dict:
    """Query ComfyUI for available models across common categories.

    Returns a dict with keys: checkpoints, loras, vaes, clips, upscalers,
    audio encoders, and ReCaVSR assets.
    Each value is a list of model filenames (strings).
    On failure, returns empty lists for all categories.
    """
    url = get_comfyui_url()
    # Map our display categories to ComfyUI /models/ folder names
    category_map = {
        "checkpoints": "checkpoints",
        "loras": "loras",
        "vaes": "vae",
        "clips": "clip",
        "upscalers": "upscale_models",
        "audio": "audio_encoders",
        "recavsr": "recavsr",
        # unet often lives under checkpoints or unet folder; we fold into checkpoints for simplicity
    }
    result = {cat: [] for cat in category_map.keys()}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for our_key, folder in category_map.items():
                try:
                    res = await client.get(f"{url}/models/{folder}")
                    if res.status_code == 200:
                        data = res.json()
                        models = []
                        if isinstance(data, list):
                            for item in data:
                                if isinstance(item, str) and item.strip():
                                    models.append(item)
                                elif isinstance(item, dict):
                                    name = item.get("name") or item.get("path") or item.get("filename")
                                    if name and isinstance(name, str) and name.strip():
                                        models.append(name)
                        elif isinstance(data, dict):
                            candidates = data.get("models") or data.get("data") or []
                            if isinstance(candidates, list):
                                for item in candidates:
                                    if isinstance(item, str) and item.strip():
                                        models.append(item)
                                    elif isinstance(item, dict):
                                        name = item.get("name") or item.get("path") or item.get("filename")
                                        if name and isinstance(name, str) and name.strip():
                                            models.append(name)
                        result[our_key] = sorted(set(models))
                except Exception:
                    # per-category failure is ok, keep empty for that category
                    pass

            # Also try /models/unet and merge into checkpoints if present
            try:
                res = await client.get(f"{url}/models/unet")
                if res.status_code == 200:
                    data = res.json()
                    unets = []
                    if isinstance(data, list):
                        for item in data:
                            if isinstance(item, str) and item.strip():
                                unets.append(item)
                            elif isinstance(item, dict):
                                name = item.get("name") or item.get("path") or item.get("filename")
                                if name and isinstance(name, str) and name.strip():
                                    unets.append(name)
                    elif isinstance(data, dict):
                        candidates = data.get("models") or data.get("data") or []
                        if isinstance(candidates, list):
                            for item in candidates:
                                if isinstance(item, str) and item.strip():
                                    unets.append(item)
                                elif isinstance(item, dict):
                                    name = item.get("name") or item.get("path") or item.get("filename")
                                    if name and isinstance(name, str) and name.strip():
                                        unets.append(name)
                    result["checkpoints"] = sorted(set(result["checkpoints"] + unets))
            except Exception:
                pass

            # Check diffusion_models folder (common for Flux, LTX, SD3, etc.)
            try:
                res = await client.get(f"{url}/models/diffusion_models")
                if res.status_code == 200:
                    data = res.json()
                    diffusion_models = []
                    if isinstance(data, list):
                        for item in data:
                            if isinstance(item, str) and item.strip():
                                diffusion_models.append(item)
                            elif isinstance(item, dict):
                                name = item.get("name") or item.get("path") or item.get("filename")
                                if name and isinstance(name, str) and name.strip():
                                    diffusion_models.append(name)
                    elif isinstance(data, dict):
                        candidates = data.get("models") or data.get("data") or []
                        if isinstance(candidates, list):
                            for item in candidates:
                                if isinstance(item, str) and item.strip():
                                    diffusion_models.append(item)
                                elif isinstance(item, dict):
                                    name = item.get("name") or item.get("path") or item.get("filename")
                                    if name and isinstance(name, str) and name.strip():
                                        diffusion_models.append(name)

                    # Merge into checkpoints
                    result["checkpoints"] = sorted(set(result["checkpoints"] + diffusion_models))
            except Exception:
                pass

           # Also check text_encoders (very common with Flux, LTX, SD3, etc.)
            try:
                res = await client.get(f"{url}/models/text_encoders")
                if res.status_code == 200:
                    data = res.json()
                    text_encoders = []
                    if isinstance(data, list):
                        for item in data:
                            if isinstance(item, str) and item.strip():
                                text_encoders.append(item)
                            elif isinstance(item, dict):
                                name = item.get("name") or item.get("path") or item.get("filename")
                                if name and isinstance(name, str) and name.strip():
                                    text_encoders.append(name)
                    elif isinstance(data, dict):
                        candidates = data.get("models") or data.get("data") or []
                        if isinstance(candidates, list):
                            for item in candidates:
                                if isinstance(item, str) and item.strip():
                                    text_encoders.append(item)
                                elif isinstance(item, dict):
                                    name = item.get("name") or item.get("path") or item.get("filename")
                                    if name and isinstance(name, str) and name.strip():
                                        text_encoders.append(name)

                    # Merge into clips category
                    result["clips"] = sorted(set(result["clips"] + text_encoders))
            except Exception:
                pass 

            # Also check latent_upscale_models
            try:
                res = await client.get(f"{url}/models/latent_upscale_models")
                if res.status_code == 200:
                    data = res.json()
                    latent_upscalers = []
                    if isinstance(data, list):
                        for item in data:
                            if isinstance(item, str) and item.strip():
                                latent_upscalers.append(item)
                            elif isinstance(item, dict):
                                name = item.get("name") or item.get("path") or item.get("filename")
                                if name and isinstance(name, str) and name.strip():
                                    latent_upscalers.append(name)
                    elif isinstance(data, dict):
                        candidates = data.get("models") or data.get("data") or []
                        if isinstance(candidates, list):
                            for item in candidates:
                                if isinstance(item, str) and item.strip():
                                    latent_upscalers.append(item)
                                elif isinstance(item, dict):
                                    name = item.get("name") or item.get("path") or item.get("filename")
                                    if name and isinstance(name, str) and name.strip():
                                        latent_upscalers.append(name)

                    # Merge into upscalers
                    result["upscalers"] = sorted(set(result["upscalers"] + latent_upscalers))
            except Exception:
                pass

        return result
    except Exception as e:
        print(f"⚠️ Failed to fetch models from ComfyUI: {e}")
        return {cat: [] for cat in category_map.keys()}


async def download_and_save_image(filename: str, subfolder: str = "") -> str | None:
    """Download image from ComfyUI and save it locally. Returns local filename or None."""
    try:
        params = {
            "filename": filename,
            "subfolder": subfolder,
            "type": "output"
        }

        print(f"Attempting to download: {filename} (subfolder: {subfolder})")

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{get_comfyui_url()}/view", params=params)

            print(f"ComfyUI /view response status: {response.status_code}")

            if response.status_code == 200:
                ext = os.path.splitext(filename)[1] or ".png"
                new_filename = f"{uuid.uuid4().hex}{ext}"
                filepath = os.path.join(IMAGES_FOLDER, new_filename)

                with open(filepath, "wb") as f:
                    f.write(response.content)

                print(f" Successfully saved image as: {new_filename}")
                return new_filename
            else:
                print(f" Failed to download. Status: {response.status_code}")
                print(f"Response text: {response.text[:200]}")
                return None

    except Exception as e:
        print(f" Exception while downloading image: {e}")
        return None


async def generate_single_image(prompt: str, resolution: str, aspect_ratio: str, image_model: str = "schnell", qwen_turbo: bool = True, lora_name: Optional[str] = None, lora_strength: float = 0.6) -> dict:
    """Generate a single image from a text prompt using the specified ComfyUI workflow model"""
    print(">>> generate_single_image started")

    try:
        from services.grok_imagine_service import is_grok_model, generate_single_image as grok_t2i
        if is_grok_model(image_model):
            if lora_name:
                print("[T2I] LoRA ignored for Grok Imagine models")
            return await grok_t2i(prompt, resolution, aspect_ratio, image_model=image_model)

        width, height = get_image_dimensions(resolution, aspect_ratio)
        if lora_name:
            print(f">>> workflow: LoRA ({lora_name.split('.')[0]})")
            base_workflow = load_base_lora_workflow()
            workflow = modify_lora_workflow(base_workflow, prompt, width, height, lora_name, strength_model=lora_strength, strength_clip=lora_strength)
        elif image_model == "klein":
            print(">>> workflow: Klein")
            base_workflow = load_base_klein_workflow()
            workflow = modify_klein_workflow(base_workflow, prompt, width, height)
        elif image_model == "qwen":
            print(">>> workflow: Qwen")
            base_workflow = load_base_qwen_workflow()
            workflow = modify_qwen_workflow(base_workflow, prompt, width, height, enable_turbo=qwen_turbo)
        else:
            print(">>> workflow: Schnell")
            base_workflow = load_base_workflow()
            workflow = modify_workflow(base_workflow, prompt, width, height)

        async with httpx.AsyncClient(timeout=180.0) as client:
            # Queue the prompt
            res = await post_prompt(client, workflow)
            prompt_data = res.json()
            prompt_id = prompt_data.get("prompt_id")
            print(f"Prompt queued. ID: {prompt_id}")

            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            # Poll history until outputs are ready.
            # Poll until the output appears. The idle timeout resets on progress; a safety loop bound prevents an infinite wait.
            # Dynamically find the SaveImage node output (node ID varies by workflow:
            # "9" for Flux Schnell/Klein, "60" for Qwen, etc.). This avoids hard-coded
            # node assumptions that broke Qwen retrieval.
            try:
                # Deferred import to avoid circular dependency (main.py imports generate_* from this module at load time).
                from config import get_generation_max_attempts
                max_attempts = get_generation_max_attempts()
            except Exception:
                max_attempts = get_generation_max_attempts()
            outputs = {}
            images = []
            for attempt in range(max_attempts):
                await asyncio.sleep(1)
                if progress_idle_timed_out(get_progress_job()):
                    await interrupt_comfy_prompt(prompt_id)
                    return {
                        "success": False,
                        "error": f"Generation timed out: no progress for {get_generation_idle_timeout_seconds()}s",
                    }
                try:
                    history_res = await client.get(f"{get_comfyui_url()}/history/{prompt_id}")
                    history = history_res.json()
                    if prompt_id in history:
                        outputs = history[prompt_id].get("outputs", {})
                        if attempt % 5 == 0:
                            print(f"[T2I] Prompt found in history (attempt {attempt}). Nodes: {list(outputs.keys())} (model={image_model})")
                        for nid, out in outputs.items():
                            if isinstance(out, dict) and out.get("images"):
                                cand = out.get("images", [])
                                if cand:
                                    images = cand
                                    print(f"[T2I] Found images in node {nid}")
                                    # continue; last one wins in case of multiple image outputs
                        if images:
                            break
                except Exception:
                    pass  # keep polling

            if not images:
                return {"success": False, "error": "No images generated (timeout or error)"}

            # Download image
            print("Downloading image from ComfyUI...")
            local_filename = await download_and_save_image(
                images[0]["filename"], 
                images[0].get("subfolder", "")
            )

            if local_filename:
                print(f" Image saved: {local_filename}")
                return {
                    "success": True,
                    "local_filename": local_filename,
                    "width": width,
                    "height": height
                }
            else:
                return {"success": False, "error": "Download failed"}

    except Exception as e:
        print(f" Error in generate_single_image: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


async def generate_multiple_images(prompt: str, resolution: str, aspect_ratio: str, count: int = 4, image_model: str = "schnell", qwen_turbo: bool = True, lora_name: Optional[str] = None, lora_strength: float = 0.6) -> list[dict]:
    """Generate multiple images by calling generate_single_image in a loop"""
    results = []
    for i in range(count):
        print(f"\n--- Generating image {i+1}/{count} ---")
        result = await generate_single_image(prompt, resolution, aspect_ratio, image_model=image_model, qwen_turbo=qwen_turbo, lora_name=lora_name, lora_strength=lora_strength)
        results.append(result)
    return results


async def generate_images_with_progress(prompt: str, resolution: str, aspect_ratio: str, count: int = 4, image_model: str = "schnell", qwen_turbo: bool = True, lora_name: Optional[str] = None, lora_strength: float = 0.6, job_id: str = "") -> AsyncGenerator[str, None]:
    """Generate multiple images as an async generator, yielding SSE progress events for each"""
    from services.grok_imagine_service import is_grok_model, generate_images as grok_generate_images

    # Grok: batch n images in one API call, still emit per-index SSE events
    if is_grok_model(image_model):
        for i in range(count):
            yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"
            yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': 20})}\n\n"
        if lora_name:
            print("[T2I] LoRA ignored for Grok Imagine models")
        task = asyncio.create_task(
            grok_generate_images(prompt, resolution, aspect_ratio, count=count, image_model=image_model)
        )
        progress_steps = [40, 60, 80]
        for percent in progress_steps:
            if task.done():
                break
            for i in range(count):
                yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': percent})}\n\n"
            await asyncio.sleep(0.6)
        results = await task
        for i, result in enumerate(results):
            yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': 100})}\n\n"
            if result.get("success"):
                yield f"data: {json.dumps({'type': 'image_ready', 'index': i, 'local_filename': result['local_filename'], 'width': result.get('width', 0), 'height': result.get('height', 0)})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'error', 'index': i, 'error': result.get('error', 'Unknown error')})}\n\n"
        return

    for i in range(count):
        # Tell frontend this card has started
        yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"

        # Generate the image in the background
        set_progress_job(job_id, i)
        task = asyncio.create_task(
            generate_single_image(prompt, resolution, aspect_ratio, image_model=image_model, qwen_turbo=qwen_turbo, lora_name=lora_name, lora_strength=lora_strength)
        )

        # Send smooth progress updates while waiting
        progress_steps = [0, 25, 50, 75, 90]
        for percent in progress_steps:
            if task.done():
                break
            yield f"data: {json.dumps({
                'type': 'progress',
                'index': i,
                'percent': percent
            })}\n\n"
            await asyncio.sleep(0.8)  # Adjust speed if needed

        # Wait for the image to finish if it hasn't already
        result = await task

        # Final 100%
        yield f"data: {json.dumps({
            'type': 'progress',
            'index': i,
            'percent': 100
        })}\n\n"

        if result.get("success"):
            yield f"data: {json.dumps({
                'type': 'image_ready',
                'index': i,
                'local_filename': result['local_filename'],
                'width': result['width'],
                'height': result['height']
            })}\n\n"
        else:
            yield f"data: {json.dumps({
                'type': 'error',
                'index': i,
                'error': result.get('error', 'Unknown error')
            })}\n\n"

# ==================== VIDEO GENERATION ====================


async def download_and_save_video(filename: str, subfolder: str = "") -> str | None:
    """Download a video file from ComfyUI output by filename and save it to the local videos folder"""
    if not filename:
        return None

    try:
        params = {
            "filename": filename,
            "subfolder": subfolder,
            "type": "output"
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.get(f"{get_comfyui_url()}/view", params=params)

            if response.status_code == 200:
                ext = os.path.splitext(filename)[1] or ".mp4"
                new_filename = f"{uuid.uuid4().hex}{ext}"
                filepath = os.path.join(VIDEOS_FOLDER, new_filename)

                with open(filepath, "wb") as f:
                    f.write(response.content)

                print(f"[Video] Saved: {new_filename}")
                return new_filename
            return None

    except Exception:
        return None


async def upload_image_to_comfy(local_filename: str) -> str | None:
    """
    Upload a local image (from our images/ folder) to ComfyUI's input folder.
    Returns the filename that should be used in LoadImage nodes.
    """
    try:
        full_path = os.path.join(IMAGES_FOLDER, local_filename)
        if not os.path.exists(full_path):
            print(f"[I2V] Source image not found locally: {full_path}")
            return None

        print(f"[I2V] Uploading source image to ComfyUI: {local_filename}")

        with open(full_path, "rb") as f:
            files = {
                "image": (local_filename, f, "image/png")  # Comfy accepts png/jpg etc.
            }
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{get_comfyui_url()}/upload/image",
                    files=files
                )

                if response.status_code == 200:
                    data = response.json()
                    comfy_name = data.get("name")
                    print(f"[I2V]  Uploaded as Comfy input: {comfy_name}")
                    return comfy_name
                else:
                    print(f"[I2V] Upload failed {response.status_code}: {response.text}")
                    return None

    except Exception as e:
        print(f"[I2V] Upload exception: {e}")
        return None


async def upload_audio_to_comfy(local_filename: str) -> str | None:
    """
    Upload a local audio file (from our audio/ folder) to ComfyUI's input folder.
    Uses the /upload/image endpoint (Comfy accepts non-images for input/ and LoadAudio works with the returned name).
    Returns the filename to use in LoadAudio nodes.
    """
    try:
        full_path = os.path.join(AUDIO_FOLDER, local_filename)
        if not os.path.exists(full_path):
            print(f"[IA2V] Source audio not found locally: {full_path}")
            return None

        print(f"[IA2V] Uploading source audio to ComfyUI: {local_filename}")

        ext = os.path.splitext(local_filename)[1].lower()
        mime = "audio/mpeg" if ext in (".mp3", ".mpeg") else ("audio/wav" if ext == ".wav" else "audio/*")

        with open(full_path, "rb") as f:
            files = {
                "image": (local_filename, f, mime)  # form key is "image" for Comfy's upload handler
            }
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{get_comfyui_url()}/upload/image",
                    files=files
                )

                if response.status_code == 200:
                    data = response.json()
                    comfy_name = data.get("name")
                    print(f"[IA2V] Uploaded audio as Comfy input: {comfy_name}")
                    return comfy_name
                else:
                    print(f"[IA2V] Audio upload failed {response.status_code}: {response.text}")
                    return None

    except Exception as e:
        print(f"[IA2V] Audio upload exception: {e}")
        return None


async def upload_video_to_comfy(local_filename: str) -> str | None:
    """
    Upload a local video (from our videos/ folder) to ComfyUI's input folder.
    Uses the /upload/image endpoint (Comfy accepts non-images for input/ and
    LoadVideo works with the returned name). Mirrors the RelayVSR helper.
    """
    try:
        full_path = os.path.join(VIDEOS_FOLDER, local_filename)
        if not os.path.isfile(full_path):
            print(f"[VIDEO REF] Source video not found locally: {full_path}")
            return None

        print(f"[VIDEO REF] Uploading source video to ComfyUI: {local_filename}")
        with open(full_path, "rb") as f:
            files = {"image": (local_filename, f, "video/mp4")}
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    f"{get_comfyui_url()}/upload/image",
                    files=files,
                )
                if response.status_code == 200:
                    data = response.json() or {}
                    comfy_name = data.get("name")
                    if comfy_name:
                        print(f"[VIDEO REF] Uploaded as Comfy input: {comfy_name}")
                        return comfy_name
                print(f"[VIDEO REF] Upload failed {response.status_code}: {response.text[:300]}")
                return None
    except Exception as e:
        print(f"[VIDEO REF] Upload exception: {e}")
        return None


def resolve_ltx_version(ltx_version: str | None = None) -> str:
    """Return the LTX version to use ('2.3' or '2.5'), falling back to settings."""
    v = ltx_version
    if v not in ("2.3", "2.5"):
        try:
            from config import load_app_settings
            v = str(load_app_settings().get("ltx_version", "2.3"))
        except Exception:
            v = "2.3"
    return v if v in ("2.3", "2.5") else "2.3"


def resolve_video_model(video_model: str | None = None) -> str:
    """Return the video family to use ('ltx', 'fasth3', 'grok'), falling back to settings."""
    m = video_model
    if m not in ("ltx", "fasth3", "grok"):
        try:
            from config import load_app_settings
            m = str(load_app_settings().get("video_model", "ltx"))
        except Exception:
            m = "ltx"
    return m if m in ("ltx", "fasth3", "grok") else "ltx"


async def free_comfyui_memory() -> bool:
    """Best-effort request for ComfyUI to unload models and free VRAM.

    Waits for the queue to go idle first, then posts to /free. Never raises.
    Returns True only when ComfyUI responds with HTTP 200.
    """
    try:
        await wait_for_comfy_queue_idle()
    except Exception:
        pass
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{get_comfyui_url()}/free",
                json={"unload_models": True, "free_memory": True},
            )
            if response.status_code == 200:
                print("[ComfyUI] Freed VRAM (unload_models + free_memory)")
                return True
            print(f"⚠️ ComfyUI /free returned status {response.status_code}")
            return False
    except Exception as e:
        print(f"⚠️ Failed to free ComfyUI memory: {e}")
        return False


def should_free_vram_for_video(
    video_model: str | None,
    resolution: str | None = None,
) -> bool:
    """Return True for every local ComfyUI video model.

    Grok runs in the cloud, so it does not need a local VRAM reset.
    """
    return resolve_video_model(video_model) in ("ltx", "fasth3")


async def generate_single_video(
    prompt: str,
    resolution: str,
    aspect_ratio: str,
    duration: int,
    video_model: str = None,
    ltx_version: str = None,
    disable_prompt_enhance: bool = False,
) -> dict:
    """Generate a single video from a text prompt using the video workflow and download the result"""
    print("\n>>> [VIDEO] generate_single_video started")

    try:
        from services.grok_imagine_service import generate_video as grok_video
        model = resolve_video_model(video_model)
        if model == "grok":
            return await grok_video(prompt, resolution, aspect_ratio, duration)

        width, height = get_video_dimensions(resolution, aspect_ratio)
        if model == "fasth3":
            base_workflow = load_base_fasth3_text_to_video_workflow()
            workflow = modify_fasth3_text_to_video_workflow(base_workflow, prompt, width, height, duration)
            save_node = "92"
        else:
            ltx_ver = resolve_ltx_version(ltx_version)
            if ltx_ver == "2.5":
                base_workflow = load_base_ltx25_text_to_video_workflow()
                workflow = modify_ltx25_text_to_video_workflow(base_workflow, prompt, width, height, duration)
            else:
                base_workflow = load_base_video_workflow()
                workflow = modify_video_workflow(
                    base_workflow, prompt, width, height, duration,
                    disable_prompt_enhance=disable_prompt_enhance,
                )
            save_node = "75"

        async with httpx.AsyncClient(timeout=600.0) as client:
            res = await post_prompt(client, workflow)
            prompt_id = res.json().get("prompt_id")

            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            print(f"[VIDEO] Queued. Prompt ID: {prompt_id}")

            video_info = None

            try:
                # Deferred import to avoid circular dependency (main.py imports generate_* from this module at load time).
                from config import get_generation_max_attempts
                max_attempts = get_generation_max_attempts()
            except Exception:
                max_attempts = get_generation_max_attempts()
            for attempt in range(max_attempts):
                await asyncio.sleep(1)
                if progress_idle_timed_out(get_progress_job()):
                    await interrupt_comfy_prompt(prompt_id)
                    return {
                        "success": False,
                        "error": f"Generation timed out: no progress for {get_generation_idle_timeout_seconds()}s",
                    }

                try:
                    history = (await client.get(f"{get_comfyui_url()}/history/{prompt_id}")).json()

                    if prompt_id in history:
                        outputs = history[prompt_id].get("outputs", {})

                        if attempt % 10 == 0:
                            print(f"[VIDEO] Prompt found in history (attempt {attempt}). Nodes: {list(outputs.keys())}")

                        # Check the SaveVideo node for this workflow family
                        if save_node in outputs:
                            save_out = outputs[save_node]

                            # The video is returned under 'images' key with .mp4 extension
                            if isinstance(save_out, dict) and save_out.get('images'):
                                for item in save_out['images']:
                                    if isinstance(item, dict) and item.get('filename', '').endswith('.mp4'):
                                        video_info = item
                                        print(f"[VIDEO] Found video file in node {save_node}: {video_info}")
                                        break

                            if video_info:
                                break

                except Exception as e:
                    if attempt % 20 == 0:
                        print(f"[VIDEO] Polling warning: {e}")

            if not video_info:
                print("[VIDEO]  No video file found after polling")
                return {"success": False, "error": "No video output found"}

            # Download the video
            local_filename = await download_and_save_video(
                video_info.get("filename"),
                video_info.get("subfolder", "")
            )

            if local_filename:
                print(f"[VIDEO]  Successfully saved: {local_filename}")
                return {
                    "success": True,
                    "local_filename": local_filename,
                    "width": width,
                    "height": height,
                    "duration": duration
                }
            else:
                return {"success": False, "error": "Download failed"}

    except Exception as e:
        print(f"[VIDEO] Critical error: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


async def generate_single_image_to_video(
    source_image_filename: str,
    prompt: str,
    resolution: str,
    aspect_ratio: str,
    duration: int,
    video_model: str = None,
    ltx_version: str = None,
    audio_filename: str | None = None,
) -> dict:
    """
    Generate a video from a source image using the LTX image-to-video workflow.
    - Uploads the source image to ComfyUI
    - Uses the provided prompt (or original)
    - Applies resolution, duration, random seeds
    """
    print("\n>>> [I2V] generate_single_image_to_video started")

    try:
        from services.grok_imagine_service import generate_video as grok_video
        model = resolve_video_model(video_model)
        if model == "grok":
            return await grok_video(
                prompt, resolution, aspect_ratio, duration,
                source_image_filename=source_image_filename,
            )

        # 1. Upload the source image so the workflow's LoadImage can reference it
        comfy_image_name = await upload_image_to_comfy(source_image_filename)
        if not comfy_image_name:
            return {"success": False, "error": "Failed to upload source image"}

        width, height = get_video_dimensions(resolution, aspect_ratio)
        if model == "fasth3":
            if audio_filename:
                comfy_audio_name = await upload_audio_to_comfy(audio_filename)
                if not comfy_audio_name:
                    return {"success": False, "error": "Failed to upload guide audio"}
                base_workflow = load_base_fasth3_image_audio_guide_workflow()
                workflow = modify_fasth3_image_audio_guide_workflow(
                    base_workflow,
                    prompt,
                    width,
                    height,
                    duration,
                    comfy_image_name,
                    comfy_audio_name,
                )
            else:
                base_workflow = load_base_fasth3_image_to_video_workflow()
                workflow = modify_fasth3_image_to_video_workflow(
                    base_workflow, prompt, width, height, duration, comfy_image_name
                )
            save_node = "92"
        else:
            ltx_ver = resolve_ltx_version(ltx_version)
            if ltx_ver == "2.5":
                base_workflow = load_base_ltx25_image_to_video_workflow()
                workflow = modify_ltx25_image_to_video_workflow(
                    base_workflow, prompt, width, height, duration, comfy_image_name
                )
            else:
                base_workflow = load_base_image_to_video_workflow()
                workflow = modify_image_to_video_workflow(
                    base_workflow, prompt, width, height, duration, comfy_image_name
                )
            save_node = "75"

        async with httpx.AsyncClient(timeout=600.0) as client:
            res = await post_prompt(client, workflow)
            prompt_id = res.json().get("prompt_id")

            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            print(f"[I2V] Queued. Prompt ID: {prompt_id}")

            video_info = None

            try:
                # Deferred import to avoid circular dependency (main.py imports generate_* from this module at load time).
                from config import get_generation_max_attempts
                max_attempts = get_generation_max_attempts()
            except Exception:
                max_attempts = get_generation_max_attempts()
            for attempt in range(max_attempts):
                await asyncio.sleep(1)
                if progress_idle_timed_out(get_progress_job()):
                    await interrupt_comfy_prompt(prompt_id)
                    return {
                        "success": False,
                        "error": f"Generation timed out: no progress for {get_generation_idle_timeout_seconds()}s",
                    }

                try:
                    history = (await client.get(f"{get_comfyui_url()}/history/{prompt_id}")).json()

                    if prompt_id in history:
                        outputs = history[prompt_id].get("outputs", {})

                        if attempt % 10 == 0:
                            print(f"[I2V] Prompt found in history (attempt {attempt}). Nodes: {list(outputs.keys())}")

                        # Check the SaveVideo node for this workflow family
                        if save_node in outputs:
                            save_out = outputs[save_node]

                            if isinstance(save_out, dict) and save_out.get('images'):
                                for item in save_out['images']:
                                    if isinstance(item, dict) and item.get('filename', '').endswith('.mp4'):
                                        video_info = item
                                        print(f"[I2V] Found video file in node {save_node}: {video_info}")
                                        break

                            if video_info:
                                break

                except Exception as e:
                    if attempt % 20 == 0:
                        print(f"[I2V] Polling warning: {e}")

            if not video_info:
                print("[I2V]  No video file found after polling")
                return {"success": False, "error": "No video output found"}

            # Download the video (reuse existing helper)
            local_filename = await download_and_save_video(
                video_info.get("filename"),
                video_info.get("subfolder", "")
            )

            if local_filename:
                print(f"[I2V]  Successfully saved: {local_filename}")
                return {
                    "success": True,
                    "local_filename": local_filename,
                    "width": width,
                    "height": height,
                    "duration": duration
                }
            else:
                return {"success": False, "error": "Download failed"}

    except Exception as e:
        print(f"[I2V] Critical error: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


async def generate_single_image_audio_to_video(
    source_image_filename: str,
    audio_filename: str,
    prompt: str,
    resolution: str,
    aspect_ratio: str,
    duration: int,
    ltx_version: str = None,
    video_model: str = None,
) -> dict:
    """
    Generate a video from a source image + audio using an image-audio-to-video workflow.
    - Uploads the source image and the audio file to ComfyUI
    - Uses the provided prompt (or original)
    - Applies resolution, duration, random seeds
    - Called when audio modifier is selected in modal + video mode
    """
    print("\n>>> [IA2V] generate_single_image_audio_to_video started")

    # Let any previous render finish and ComfyUI settle before touching inputs.
    await wait_for_comfy_queue_idle()

    try:
        # 1. Upload the main source image (the one viewed in modal)
        comfy_image_name = await upload_image_to_comfy(source_image_filename)
        if not comfy_image_name:
            return {"success": False, "error": "Failed to upload source image"}

        # 2. Upload the audio modifier
        comfy_audio_name = await upload_audio_to_comfy(audio_filename)
        if not comfy_audio_name:
            return {"success": False, "error": "Failed to upload modifier audio"}

        model = resolve_video_model(video_model)
        width, height = get_video_dimensions(resolution, aspect_ratio)
        if model == "fasth3":
            base_workflow = load_base_fasth3_reference_image_audio_to_video_workflow()
            workflow = modify_fasth3_reference_image_audio_to_video_workflow(
                base_workflow, prompt, width, height, duration, comfy_image_name, comfy_audio_name
            )
            save_node = "92"
        else:
            ltx_ver = resolve_ltx_version(ltx_version)
            if ltx_ver == "2.5":
                base_workflow = load_base_ltx25_image_audio_to_video_workflow()
                workflow = modify_ltx25_image_audio_to_video_workflow(
                    base_workflow, prompt, width, height, duration, comfy_image_name, comfy_audio_name
                )
            else:
                base_workflow = load_base_image_audio_to_video_workflow()
                workflow = modify_image_audio_to_video_workflow(
                    base_workflow, prompt, width, height, duration, comfy_image_name, comfy_audio_name
                )
            save_node = "341"

        async with httpx.AsyncClient(timeout=600.0) as client:
            res = await post_prompt(client, workflow)
            prompt_id = res.json().get("prompt_id")

            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            print(f"[IA2V] Queued. Prompt ID: {prompt_id}")

            video_info = None

            try:
                # Deferred import to avoid circular dependency (main.py imports generate_* from this module at load time).
                from config import get_generation_max_attempts
                max_attempts = get_generation_max_attempts()
            except Exception:
                max_attempts = get_generation_max_attempts()
            for attempt in range(max_attempts):
                await asyncio.sleep(1)
                if progress_idle_timed_out(get_progress_job()):
                    await interrupt_comfy_prompt(prompt_id)
                    return {
                        "success": False,
                        "error": f"Generation timed out: no progress for {get_generation_idle_timeout_seconds()}s",
                    }

                try:
                    history = (await client.get(f"{get_comfyui_url()}/history/{prompt_id}")).json()

                    if prompt_id in history:
                        outputs = history[prompt_id].get("outputs", {})

                        if attempt % 10 == 0:
                            print(f"[IA2V] Prompt found in history (attempt {attempt}). Nodes: {list(outputs.keys())}")

                        # Check the SaveVideo node for this workflow family
                        if save_node in outputs:
                            save_out = outputs[save_node]

                            if isinstance(save_out, dict) and save_out.get('images'):
                                for item in save_out['images']:
                                    if isinstance(item, dict) and item.get('filename', '').endswith('.mp4'):
                                        video_info = item
                                        print(f"[IA2V] Found video file in node {save_node}: {video_info}")
                                        break

                            if video_info:
                                break

                except Exception as e:
                    if attempt % 20 == 0:
                        print(f"[IA2V] Polling warning: {e}")

            if not video_info:
                print("[IA2V]  No video file found after polling")
                return {"success": False, "error": "No video output found"}

            # Download the video (reuse existing helper)
            local_filename = await download_and_save_video(
                video_info.get("filename"),
                video_info.get("subfolder", "")
            )

            if local_filename:
                print(f"[IA2V]  Successfully saved: {local_filename}")
                return {
                    "success": True,
                    "local_filename": local_filename,
                    "width": width,
                    "height": height,
                    "duration": duration
                }
            else:
                return {"success": False, "error": "Download failed"}

    except Exception as e:
        print(f"[IA2V] Critical error: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


async def generate_fasth3_multi_ref_video(
    ref_images: list,
    ref_audios: list,
    prompt: str,
    resolution: str,
    aspect_ratio: str,
    duration: float,
    image_roles: list | None = None,
    image_labels: list | None = None,
    first_frame_filename: str | None = None,
    audio_mode: str = "voice",
    ref_video_filename: str | None = None,
    ref_image_size: str = "max",
    video_reference_mode: str = "continuity",
    recast_preserve: list | None = None,
    start_image_mode: str | None = None,
) -> dict:
    """Generate a FastH3 video from multiple reference images and audio clips.

    Uses the dedicated multi-ref workflow so the single-ref OmniRef workflow
    (used by Music Video) is unaffected. When ``first_frame_filename`` is set a
    frame-0 image guide is added on top of the same multi-reference graph. When
    ``ref_video_filename`` is set the clip is used as a motion-continuity
    reference video. ``video_reference_mode="recast"`` switches the prompt and
    treats the clip as a performance reference instead of a follow-on.
    """
    print("\n>>> [FASTH3 MULTI-REF] generate_fasth3_multi_ref_video started")
    prompt_id = None
    try:
        image_names = []
        for fn in (ref_images or [])[:6]:
            name = await upload_image_to_comfy(fn)
            if not name:
                return {"success": False, "error": f"Failed to upload reference image: {fn}"}
            image_names.append(name)

        audio_names = []
        for fn in (ref_audios or [])[:3]:
            name = await upload_audio_to_comfy(fn)
            if not name:
                return {"success": False, "error": f"Failed to upload reference audio: {fn}"}
            audio_names.append(name)

        if not image_names and not audio_names and not first_frame_filename and not ref_video_filename:
            return {"success": False, "error": "No references supplied"}

        comfy_first_frame_name = None
        if first_frame_filename:
            comfy_first_frame_name = await upload_image_to_comfy(first_frame_filename)
            if not comfy_first_frame_name:
                return {
                    "success": False,
                    "error": f"Failed to upload first-frame image: {first_frame_filename}",
                }

        comfy_ref_video_name = None
        if ref_video_filename:
            comfy_ref_video_name = await upload_video_to_comfy(ref_video_filename)
            if not comfy_ref_video_name:
                return {
                    "success": False,
                    "error": f"Failed to upload reference video: {ref_video_filename}",
                }

        width, height = get_video_dimensions(resolution, aspect_ratio)
        if comfy_first_frame_name:
            base_workflow = load_base_fasth3_multi_ref_guide_workflow()
            workflow = modify_fasth3_multi_ref_guide_workflow(
                base_workflow,
                prompt,
                width,
                height,
                duration,
                image_names,
                audio_names,
                comfy_first_frame_name,
                image_roles=image_roles,
                image_labels=image_labels,
                audio_mode=audio_mode,
                ref_video_filename=comfy_ref_video_name,
                ref_image_size=ref_image_size,
                video_reference_mode=video_reference_mode,
                recast_preserve=recast_preserve,
                start_image_mode=start_image_mode,
            )
        else:
            base_workflow = load_base_fasth3_multi_ref_workflow()
            workflow = modify_fasth3_multi_ref_workflow(
                base_workflow,
                prompt,
                width,
                height,
                duration,
                image_names,
                audio_names,
                image_roles=image_roles,
                image_labels=image_labels,
                audio_mode=audio_mode,
                ref_video_filename=comfy_ref_video_name,
                ref_image_size=ref_image_size,
                video_reference_mode=video_reference_mode,
                recast_preserve=recast_preserve,
                start_image_mode=start_image_mode,
            )
        save_node = "92"

        async with httpx.AsyncClient(timeout=600.0) as client:
            res = await post_prompt(client, workflow)
            prompt_id = res.json().get("prompt_id")
            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            print(f"[FASTH3 MULTI-REF] Queued. Prompt ID: {prompt_id}")

            video_info = None
            try:
                from config import get_generation_max_attempts
                max_attempts = get_generation_max_attempts()
            except Exception:
                max_attempts = get_generation_max_attempts()
            for attempt in range(max_attempts):
                await asyncio.sleep(1)
                if progress_idle_timed_out(get_progress_job()):
                    await interrupt_comfy_prompt(prompt_id)
                    return {
                        "success": False,
                        "error": f"Generation timed out: no progress for {get_generation_idle_timeout_seconds()}s",
                    }
                try:
                    history = (await client.get(f"{get_comfyui_url()}/history/{prompt_id}")).json()
                    if prompt_id in history:
                        outputs = history[prompt_id].get("outputs", {})
                        if attempt % 10 == 0:
                            print(f"[FASTH3 MULTI-REF] Prompt found in history (attempt {attempt}). Nodes: {list(outputs.keys())}")
                        if save_node in outputs:
                            save_out = outputs[save_node]
                            if isinstance(save_out, dict) and save_out.get("images"):
                                for item in save_out["images"]:
                                    if isinstance(item, dict) and item.get("filename", "").endswith(".mp4"):
                                        video_info = item
                                        print(f"[FASTH3 MULTI-REF] Found video file in node {save_node}: {video_info}")
                                        break
                            if video_info:
                                break
                except Exception as e:
                    if attempt % 20 == 0:
                        print(f"[FASTH3 MULTI-REF] Polling warning: {e}")

            if not video_info:
                print("[FASTH3 MULTI-REF]  No video file found after polling; interrupting ComfyUI job")
                await interrupt_comfy_prompt(prompt_id)
                return {"success": False, "error": "No video output found"}

            local_filename = await download_and_save_video(
                video_info.get("filename"), video_info.get("subfolder", "")
            )
            if not local_filename:
                return {"success": False, "error": "Download failed"}

            return {
                "success": True,
                "local_filename": local_filename,
                "width": width,
                "height": height,
                "duration": duration,
            }

    except Exception as e:
        print(f"[FASTH3 MULTI-REF] Critical error: {e}")
        import traceback
        traceback.print_exc()
        if prompt_id:
            await interrupt_comfy_prompt(prompt_id)
        return {"success": False, "error": str(e)}


async def generate_ltx_recast_video(
    engine: str,
    ref_video_filename: str,
    source_image_filename: str,
    prompt: str,
    resolution: str,
    aspect_ratio: str,
    duration: float,
    start_image_mode: str = "first_frame_identity",
    extra_ref_filenames: list | None = None,
    guide_strength: float = 0.5,
    reference_fit: str = "pad",
    source_control: str = "canny",
    control_attention_strength: float = 0.8,
    start_image_strength: float = 1.0,
    ref_image_strength: float = 0.8,
    seed: int | None = None,
    negative_prompt: str = "",
    prompt_enhance: bool = False,
    sampler_name: str = "",
    audio_filename: str | None = None,
) -> dict:
    """Generate an experimental local LTX recast video.

    ``engine`` is ``ltx23`` or ``ltx25``. The source video is uploaded as an
    IC-LoRA video guide; the starting image is used as an identity/first-frame
    guide. Each LTX version uses its own workflow graph.
    """
    print(f"\n>>> [LTX RECAST] generate_ltx_recast_video started ({engine})")
    prompt_id = None
    try:
        comfy_video_name = await upload_video_to_comfy(ref_video_filename)
        if not comfy_video_name:
            return {"success": False, "error": "Failed to upload source video"}

        comfy_image_name = await upload_image_to_comfy(source_image_filename)
        if not comfy_image_name:
            return {"success": False, "error": "Failed to upload starting image"}

        extra_names = []
        for filename in (extra_ref_filenames or [])[:5]:
            name = await upload_image_to_comfy(filename)
            if not name:
                return {"success": False, "error": f"Failed to upload reference image: {filename}"}
            extra_names.append(name)

        comfy_audio_name = None
        if audio_filename:
            comfy_audio_name = await upload_audio_to_comfy(audio_filename)
            if not comfy_audio_name:
                return {"success": False, "error": "Failed to upload source audio"}

        width, height = get_ltx_recast_dimensions(resolution, aspect_ratio)
        common = dict(
            start_image_mode=start_image_mode,
            guide_strength=guide_strength,
            extra_image_filenames=extra_names,
            source_control=source_control,
            control_attention_strength=control_attention_strength,
            start_image_strength=start_image_strength,
            ref_image_strength=ref_image_strength,
            seed=seed,
            negative_prompt=negative_prompt,
            prompt_enhance=prompt_enhance,
            sampler_name=sampler_name,
            audio_filename=comfy_audio_name,
        )
        if engine == "ltx25":
            base_workflow = load_base_ltx25_recast_workflow()
            workflow = modify_ltx25_recast_workflow(
                base_workflow,
                prompt,
                width,
                height,
                duration,
                comfy_video_name,
                comfy_image_name,
                **common,
            )
        else:
            base_workflow = load_base_ltx23_recast_workflow()
            workflow = modify_ltx23_recast_workflow(
                base_workflow,
                prompt,
                width,
                height,
                duration,
                comfy_video_name,
                comfy_image_name,
                **common,
            )
        save_node = "75"

        async with httpx.AsyncClient(timeout=600.0) as client:
            res = await post_prompt(client, workflow)
            prompt_id = res.json().get("prompt_id")
            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            print(f"[LTX RECAST] Queued. Prompt ID: {prompt_id}")

            video_info = None
            try:
                from config import get_generation_max_attempts
                max_attempts = get_generation_max_attempts()
            except Exception:
                max_attempts = get_generation_max_attempts()
            for attempt in range(max_attempts):
                await asyncio.sleep(1)
                if progress_idle_timed_out(get_progress_job()):
                    await interrupt_comfy_prompt(prompt_id)
                    return {
                        "success": False,
                        "error": f"Generation timed out: no progress for {get_generation_idle_timeout_seconds()}s",
                    }
                try:
                    history = (await client.get(f"{get_comfyui_url()}/history/{prompt_id}")).json()
                    if prompt_id in history:
                        entry = history[prompt_id] or {}
                        run_status = entry.get("status") or {}
                        if run_status.get("status_str") == "error":
                            message = "LTX Recast execution error"
                            for item in run_status.get("messages") or []:
                                if isinstance(item, list) and len(item) > 1 and item[0] == "execution_error":
                                    details = item[1] or {}
                                    message = details.get("exception_message") or message
                                    break
                            await interrupt_comfy_prompt(prompt_id)
                            return {"success": False, "error": message}
                        outputs = entry.get("outputs", {})
                        if attempt % 10 == 0:
                            print(
                                f"[LTX RECAST] Prompt found in history (attempt {attempt}). "
                                f"Nodes: {list(outputs.keys())}"
                            )
                        if save_node in outputs:
                            save_out = outputs[save_node]
                            if isinstance(save_out, dict) and save_out.get("images"):
                                for item in save_out["images"]:
                                    if isinstance(item, dict) and item.get("filename", "").endswith(".mp4"):
                                        video_info = item
                                        print(f"[LTX RECAST] Found video file in node {save_node}: {video_info}")
                                        break
                            if video_info:
                                break
                except Exception as e:
                    if attempt % 20 == 0:
                        print(f"[LTX RECAST] Polling warning: {e}")

            if not video_info:
                print("[LTX RECAST]  No video file found after polling; interrupting ComfyUI job")
                await interrupt_comfy_prompt(prompt_id)
                return {"success": False, "error": "No video output found"}

            local_filename = await download_and_save_video(
                video_info.get("filename"), video_info.get("subfolder", "")
            )
            if not local_filename:
                return {"success": False, "error": "Download failed"}

            return {
                "success": True,
                "local_filename": local_filename,
                "width": width,
                "height": height,
                "duration": duration,
                "recast_engine": engine,
                "experimental": True,
            }

    except Exception as e:
        print(f"[LTX RECAST] Critical error: {e}")
        import traceback
        traceback.print_exc()
        if prompt_id:
            await interrupt_comfy_prompt(prompt_id)
        return {"success": False, "error": str(e)}


async def generate_single_image_to_image(
    source_image_filename: str,
    prompt: str,
    i2i_model: str = "klein"
) -> dict:
    """
    Generate an image from a source image using the selected i2i workflow (Flux 2 or Flux 2 Klein).
    - Uploads the source image to ComfyUI
    - Uses the adjustment prompt
    - Applies random seed
    - Output is a new image (derived from input size via workflow)
    """
    print("\n>>> [I2I] generate_single_image_to_image started (model:", i2i_model, ")")

    try:
        from services.grok_imagine_service import is_grok_model, edit_single_image as grok_edit
        if is_grok_model(i2i_model):
            return await grok_edit(source_image_filename, prompt, i2i_model=i2i_model)

        # 1. Upload the source image
        comfy_image_name = await upload_image_to_comfy(source_image_filename)
        if not comfy_image_name:
            return {"success": False, "error": "Failed to upload source image"}

        # Pre-compute source dims as reliable fallback for i2i (output size is derived from input via the workflow's scale-to-2MP).
        # This ensures we never persist 0x0 for modal prompt-bar image generations (i2i path) even if output PIL read fails or PIL unavailable for the generated file.
        source_w, source_h = 0, 0
        if Image is not None:
            try:
                src_path = os.path.join(IMAGES_FOLDER, source_image_filename)
                if os.path.exists(src_path):
                    with Image.open(src_path) as img:
                        source_w, source_h = img.size
            except Exception:
                source_w, source_h = 0, 0

        if i2i_model == "flux2":
            base_workflow = load_base_image_to_image_workflow()
            workflow = modify_image_to_image_workflow(
                base_workflow, prompt, comfy_image_name
            )
        else:
            base_workflow = load_base_klein_image_to_image_workflow()
            workflow = modify_klein_image_to_image_workflow(
                base_workflow, prompt, comfy_image_name
            )

        async with httpx.AsyncClient(timeout=300.0) as client:
            res = await post_prompt(client, workflow)
            prompt_id = res.json().get("prompt_id")

            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            print(f"[I2I] Queued. Prompt ID: {prompt_id}")

            image_info = None

            try:
                # Deferred import to avoid circular dependency (main.py imports generate_* from this module at load time).
                from config import get_generation_max_attempts
                max_attempts = get_generation_max_attempts()
            except Exception:
                max_attempts = get_generation_max_attempts()
            for attempt in range(max_attempts):  # Idle timeout resets on progress; safety loop bound only.
                await asyncio.sleep(1)
                if progress_idle_timed_out(get_progress_job()):
                    await interrupt_comfy_prompt(prompt_id)
                    return {
                        "success": False,
                        "error": f"Generation timed out: no progress for {get_generation_idle_timeout_seconds()}s",
                    }

                try:
                    history = (await client.get(f"{get_comfyui_url()}/history/{prompt_id}")).json()

                    if prompt_id in history:
                        outputs = history[prompt_id].get("outputs", {})

                        if attempt % 5 == 0:
                            print(f"[I2I] Prompt found in history (attempt {attempt}). Nodes: {list(outputs.keys())}")

                        # Check node 9 (SaveImage) - standard for flux image workflows
                        if '9' in outputs:
                            node9 = outputs['9']

                            if isinstance(node9, dict) and node9.get('images'):
                                for item in node9['images']:
                                    if isinstance(item, dict) and not item.get('filename', '').endswith('.mp4'):
                                        image_info = item
                                        print(f"[I2I]  Found image file in node 9: {image_info}")
                                        break

                            if image_info:
                                break

                except Exception as e:
                    if attempt % 10 == 0:
                        print(f"[I2I] Polling warning: {e}")

            if not image_info:
                print("[I2I]  No image file found after polling")
                return {"success": False, "error": "No image output found"}

            # Download the image (reuse existing helper)
            local_filename = await download_and_save_image(
                image_info.get("filename"),
                image_info.get("subfolder", "")
            )

            if local_filename:
                print(f"[I2I]  Successfully saved: {local_filename}")
                # Prefer actual dims from the generated output file; fallback to source dims (reliable for i2i children in generations.json)
                w, h = source_w, source_h
                if Image is not None:
                    try:
                        with Image.open(os.path.join(IMAGES_FOLDER, local_filename)) as img:
                            w, h = img.size
                    except Exception:
                        pass  # keep source dims
                return {
                    "success": True,
                    "local_filename": local_filename,
                    "width": w,
                    "height": h
                }
            else:
                return {"success": False, "error": "Download failed"}

    except Exception as e:
        print(f"[I2I] Critical error: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


async def generate_image_to_images_with_progress(
    source_image_filename: str,
    prompt: str,
    count: int = 1,
    i2i_model: str = "klein",
    job_id: str = ""
) -> AsyncGenerator[str, None]:
    """Progress wrapper for image-to-image generation from modal prompt bar (adjustment prompt)."""
    for i in range(count):
        yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"

        set_progress_job(job_id, i)
        task = asyncio.create_task(
            generate_single_image_to_image(source_image_filename, prompt, i2i_model=i2i_model)
        )

        # Send smooth progress updates while waiting (similar to regular images)
        progress_steps = [0, 25, 50, 75, 90]
        for percent in progress_steps:
            if task.done():
                break
            yield f"data: {json.dumps({
                'type': 'progress',
                'index': i,
                'percent': percent
            })}\n\n"
            await asyncio.sleep(0.8)

        result = await task

        yield f"data: {json.dumps({
            'type': 'progress',
            'index': i,
            'percent': 100
        })}\n\n"

        if result.get("success"):
            yield f"data: {json.dumps({
                'type': 'image_ready',
                'index': i,
                'local_filename': result['local_filename'],
                'width': result['width'],
                'height': result['height']
            })}\n\n"
        else:
            yield f"data: {json.dumps({
                'type': 'error',
                'index': i,
                'error': result.get('error', 'Unknown error')
            })}\n\n"


async def generate_double_image_to_image(
    main_image_filename: str,
    second_image_filename: str,
    prompt: str,
    i2i_model: str = None,
) -> dict:
    """
    Generate an image from two reference images + prompt using the Flux2 Klein double i2i workflow.
    - Uploads both source images to ComfyUI (main as 1st ref, modifier as 2nd ref)
    - Uses the prompt
    - Applies random seed
    """
    print("\n>>> [DOUBLE_I2I] generate_double_image_to_image started")

    try:
        from services.grok_imagine_service import is_grok_model, edit_double_image as grok_double
        model = i2i_model
        if model is None:
            try:
                from config import load_app_settings
                model = load_app_settings().get("i2i_model", "klein")
            except Exception:
                model = "klein"
        if is_grok_model(model):
            return await grok_double(
                main_image_filename, second_image_filename, prompt, i2i_model=model
            )

        # 1. Upload the main image (1st reference)
        comfy_main_name = await upload_image_to_comfy(main_image_filename)
        if not comfy_main_name:
            return {"success": False, "error": "Failed to upload main image"}

        # 2. Upload the modifier image (2nd reference)
        comfy_second_name = await upload_image_to_comfy(second_image_filename)
        if not comfy_second_name:
            return {"success": False, "error": "Failed to upload second image"}

        base_workflow = load_base_klein_double_image_to_image_workflow()
        workflow = modify_klein_double_image_to_image_workflow(
            base_workflow, prompt, comfy_main_name, comfy_second_name
        )

        async with httpx.AsyncClient(timeout=300.0) as client:
            res = await post_prompt(client, workflow)
            prompt_id = res.json().get("prompt_id")

            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            print(f"[DOUBLE_I2I] Queued. Prompt ID: {prompt_id}")

            image_info = None

            try:
                # Deferred import to avoid circular dependency (main.py imports generate_* from this module at load time).
                from config import get_generation_max_attempts
                max_attempts = get_generation_max_attempts()
            except Exception:
                max_attempts = get_generation_max_attempts()
            for attempt in range(max_attempts):  # Idle timeout resets on progress; safety loop bound only.
                await asyncio.sleep(1)
                if progress_idle_timed_out(get_progress_job()):
                    await interrupt_comfy_prompt(prompt_id)
                    return {
                        "success": False,
                        "error": f"Generation timed out: no progress for {get_generation_idle_timeout_seconds()}s",
                    }

                try:
                    history = (await client.get(f"{get_comfyui_url()}/history/{prompt_id}")).json()

                    if prompt_id in history:
                        outputs = history[prompt_id].get("outputs", {})

                        if attempt % 5 == 0:
                            print(f"[DOUBLE_I2I] Prompt found in history (attempt {attempt}). Nodes: {list(outputs.keys())}")

                        # Check node 94 (SaveImage) from the workflow
                        if '94' in outputs:
                            node94 = outputs['94']

                            if isinstance(node94, dict) and node94.get('images'):
                                for item in node94['images']:
                                    if isinstance(item, dict) and not item.get('filename', '').endswith('.mp4'):
                                        image_info = item
                                        print(f"[DOUBLE_I2I]  Found image file in node 94: {image_info}")
                                        break

                            if image_info:
                                break

                except Exception as e:
                    if attempt % 10 == 0:
                        print(f"[DOUBLE_I2I] Polling warning: {e}")

            if not image_info:
                print("[DOUBLE_I2I]  No image file found after polling")
                return {"success": False, "error": "No image output found"}

            # Download the image
            local_filename = await download_and_save_image(
                image_info.get("filename"),
                image_info.get("subfolder", "")
            )

            if local_filename:
                print(f"[DOUBLE_I2I]  Successfully saved: {local_filename}")
                # Get actual dimensions
                w, h = 0, 0
                if Image is not None:
                    try:
                        with Image.open(os.path.join(IMAGES_FOLDER, local_filename)) as img:
                            w, h = img.size
                    except Exception:
                        w, h = 0, 0
                return {
                    "success": True,
                    "local_filename": local_filename,
                    "width": w,
                    "height": h
                }
            else:
                return {"success": False, "error": "Download failed"}

    except Exception as e:
        print(f"[DOUBLE_I2I] Critical error: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


async def generate_double_image_to_image_with_progress(
    main_image_filename: str,
    second_image_filename: str,
    prompt: str,
    count: int = 1,
    i2i_model: str = None,
    job_id: str = "",
) -> AsyncGenerator[str, None]:
    """Progress wrapper for double image-to-image (2 refs + prompt) from modal when modifier image selected in image mode."""
    for i in range(count):
        yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"

        set_progress_job(job_id, i)
        task = asyncio.create_task(
            generate_double_image_to_image(
                main_image_filename, second_image_filename, prompt, i2i_model=i2i_model
            )
        )

        # Send smooth progress updates
        progress_steps = [0, 25, 50, 75, 90]
        for percent in progress_steps:
            if task.done():
                break
            yield f"data: {json.dumps({
                'type': 'progress',
                'index': i,
                'percent': percent
            })}\n\n"
            await asyncio.sleep(0.8)

        result = await task

        yield f"data: {json.dumps({
            'type': 'progress',
            'index': i,
            'percent': 100
        })}\n\n"

        if result.get("success"):
            yield f"data: {json.dumps({
                'type': 'image_ready',
                'index': i,
                'local_filename': result['local_filename'],
                'width': result['width'],
                'height': result['height']
            })}\n\n"
        else:
            yield f"data: {json.dumps({
                'type': 'error',
                'index': i,
                'error': result.get('error', 'Unknown error')
            })}\n\n"


async def generate_videos_with_progress(
    prompt: str,
    resolution: str,
    aspect_ratio: str,
    duration: int,
    count: int = 1,
    video_model: str = None,
    ltx_version: str = None,
    job_id: str = "",
    disable_prompt_enhance: bool = False,
    video_upscale=None,
    upscale_detail=None,
) -> AsyncGenerator[str, None]:
    """Progress wrapper for text-to-video (used from library page video mode)."""
    for i in range(count):
        yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"

        set_progress_job(job_id, i)
        task = asyncio.create_task(
            generate_single_video(
                prompt, resolution, aspect_ratio, duration,
                video_model=video_model, ltx_version=ltx_version,
                disable_prompt_enhance=disable_prompt_enhance,
            )
        )

        percent = 0
        while not task.done():
            percent = min(percent + 8, 92)
            yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': percent})}\n\n"
            await asyncio.sleep(2)

        result = await task
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
                'width': result['width'],
                'height': result['height'],
                'duration': result.get('duration', duration),
                'upscale': result.get('upscale')
            })}\n\n"
        else:
            yield f"data: {json.dumps({
                'type': 'error',
                'index': i,
                'error': result.get('error', 'Unknown error')
            })}\n\n"


async def generate_image_to_videos_with_progress(
    source_image_filename: str,
    prompt: str,
    resolution: str,
    aspect_ratio: str,
    duration: int,
    count: int = 1,
    video_model: str = None,
    ltx_version: str = None,
    job_id: str = "",
    video_upscale=None,
    upscale_detail=None,
) -> AsyncGenerator[str, None]:
    """Progress wrapper for image-to-video generation (used from modal 'Create Video From this')."""
    for i in range(count):
        yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"

        set_progress_job(job_id, i)
        task = asyncio.create_task(
            generate_single_image_to_video(
                source_image_filename, prompt, resolution, aspect_ratio, duration,
                video_model=video_model, ltx_version=ltx_version,
            )
        )

        percent = 0
        while not task.done():
            percent = min(percent + 8, 92)
            yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': percent})}\n\n"
            await asyncio.sleep(2)

        result = await task
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
                'width': result['width'],
                'height': result['height'],
                'duration': result.get('duration', duration),
                'upscale': result.get('upscale')
            })}\n\n"
        else:
            yield f"data: {json.dumps({
                'type': 'error',
                'index': i,
                'error': result.get('error', 'Unknown error')
            })}\n\n"


async def generate_image_audio_to_videos_with_progress(
    source_image_filename: str,
    audio_filename: str,
    prompt: str,
    resolution: str,
    aspect_ratio: str,
    duration: int,
    count: int = 1,
    ltx_version: str = None,
    video_model: str = None,
    job_id: str = "",
    video_upscale=None,
    upscale_detail=None,
) -> AsyncGenerator[str, None]:
    """Progress wrapper for image+audio-to-video generation (used when audio modifier + video selected in modal)."""
    for i in range(count):
        yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"

        set_progress_job(job_id, i)
        task = asyncio.create_task(
            generate_single_image_audio_to_video(
                source_image_filename, audio_filename, prompt, resolution, aspect_ratio, duration,
                ltx_version=ltx_version, video_model=video_model,
            )
        )

        percent = 0
        while not task.done():
            percent = min(percent + 8, 92)
            yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': percent})}\n\n"
            await asyncio.sleep(2)

        result = await task
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
                'width': result['width'],
                'height': result['height'],
                'duration': result.get('duration', duration),
                'upscale': result.get('upscale')
            })}\n\n"
        else:
            yield f"data: {json.dumps({
                'type': 'error',
                'index': i,
                'error': result.get('error', 'Unknown error')
            })}\n\n"

async def generate_fasth3_multi_ref_videos_with_progress(
    ref_images: list,
    ref_audios: list,
    prompt: str,
    resolution: str,
    aspect_ratio: str,
    duration: float,
    count: int = 1,
    job_id: str = "",
    video_upscale=None,
    upscale_detail=None,
) -> AsyncGenerator[str, None]:
    """Progress wrapper for FastH3 multi-reference video generation."""
    for i in range(count):
        yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"

        set_progress_job(job_id, i)
        task = asyncio.create_task(
            generate_fasth3_multi_ref_video(
                ref_images, ref_audios, prompt, resolution, aspect_ratio, duration
            )
        )

        percent = 0
        while not task.done():
            percent = min(percent + 8, 92)
            yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': percent})}\n\n"
            await asyncio.sleep(2)

        result = await task
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
                'duration': result.get('duration', duration),
                'upscale': result.get('upscale')
            })}\n\n"
        else:
            yield f"data: {json.dumps({
                'type': 'error',
                'index': i,
                'error': result.get('error', 'Unknown error')
            })}\n\n"
