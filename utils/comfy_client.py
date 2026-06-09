# utils/comfy_client.py
import httpx
import os
import uuid
import json
import asyncio

from typing import Optional

# Lazy import PIL only when needed for i2i dimensions
try:
    from PIL import Image
except ImportError:
    Image = None  # will fallback to 0,0 if not available
from .workflow_utils import (
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
from .video_workflow_utils import (
    load_base_video_workflow,
    modify_video_workflow,
    get_video_dimensions,
    load_base_image_to_video_workflow,
    modify_image_to_video_workflow,
    load_base_image_audio_to_video_workflow,
    modify_image_audio_to_video_workflow
)

IMAGES_FOLDER = "images"
VIDEOS_FOLDER = "videos"
AUDIO_FOLDER = "audio"

# Make sure folders exist
os.makedirs(IMAGES_FOLDER, exist_ok=True)
os.makedirs(VIDEOS_FOLDER, exist_ok=True)
os.makedirs(AUDIO_FOLDER, exist_ok=True)


def get_comfyui_url() -> str:
    """Return the current ComfyUI base URL from settings.json (falls back to localhost)."""
    try:
        if os.path.exists("settings.json"):
            with open("settings.json", "r", encoding="utf-8") as f:
                s = json.load(f)
                url = s.get("comfyui_url")
                if isinstance(url, str) and url.strip():
                    return url.strip().rstrip("/")
    except Exception:
        pass
    return "http://127.0.0.1:8188"


async def check_comfyui_connection() -> bool:
    """Check if ComfyUI is reachable"""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{get_comfyui_url()}/system_stats")
            return response.status_code == 200
    except Exception:
        return False


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

    Returns a dict with keys: checkpoints, loras, vaes, clips, upscalers.
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

                print(f"✅ Successfully saved image as: {new_filename}")
                return new_filename
            else:
                print(f"❌ Failed to download. Status: {response.status_code}")
                print(f"Response text: {response.text[:200]}")
                return None

    except Exception as e:
        print(f"❌ Exception while downloading image: {e}")
        return None


async def generate_single_image(prompt: str, resolution: str, aspect_ratio: str, image_model: str = "schnell", qwen_turbo: bool = True, lora_name: Optional[str] = None, lora_strength: float = 0.8):
    print(">>> generate_single_image started")

    try:
        width, height = get_image_dimensions(resolution, aspect_ratio)
        if lora_name:
            # LoRA takes precedence (Flux Schnell + LoRA workflow); only supported for schnell
            base_workflow = load_base_lora_workflow()
            workflow = modify_lora_workflow(base_workflow, prompt, width, height, lora_name, strength_model=lora_strength, strength_clip=lora_strength)
        elif image_model == "klein":
            base_workflow = load_base_klein_workflow()
            workflow = modify_klein_workflow(base_workflow, prompt, width, height)
        elif image_model == "qwen":
            base_workflow = load_base_qwen_workflow()
            workflow = modify_qwen_workflow(base_workflow, prompt, width, height, enable_turbo=qwen_turbo)
        else:
            base_workflow = load_base_workflow()
            workflow = modify_workflow(base_workflow, prompt, width, height)

        async with httpx.AsyncClient(timeout=180.0) as client:
            # Queue the prompt
            res = await client.post(f"{get_comfyui_url()}/prompt", json={"prompt": workflow})
            prompt_data = res.json()
            prompt_id = prompt_data.get("prompt_id")
            print(f"Prompt queued. ID: {prompt_id}")

            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            # Poll history until outputs are ready.
            # Uses failed_gen_clear_seconds from settings (read at call time) as the max attempts (1s sleep each).
            # Dynamically find the SaveImage node output (node ID varies by workflow:
            # "9" for Flux Schnell/Klein, "60" for Qwen, etc.). This avoids hard-coded
            # node assumptions that broke Qwen retrieval.
            try:
                # Deferred import to avoid circular dependency (main.py imports generate_* from this module at load time).
                from main import get_failed_gen_clear_seconds
                max_attempts = get_failed_gen_clear_seconds()
            except Exception:
                max_attempts = 600
            outputs = {}
            images = []
            for attempt in range(max_attempts):
                await asyncio.sleep(1)
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
                print(f"✅ Image saved: {local_filename}")
                return {
                    "success": True,
                    "local_filename": local_filename,
                    "width": width,
                    "height": height
                }
            else:
                return {"success": False, "error": "Download failed"}

    except Exception as e:
        print(f"❌ Error in generate_single_image: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


async def generate_multiple_images(prompt: str, resolution: str, aspect_ratio: str, count: int = 4, image_model: str = "schnell", qwen_turbo: bool = True, lora_name: Optional[str] = None, lora_strength: float = 0.8):
    results = []
    for i in range(count):
        print(f"\n--- Generating image {i+1}/{count} ---")
        result = await generate_single_image(prompt, resolution, aspect_ratio, image_model=image_model, qwen_turbo=qwen_turbo, lora_name=lora_name, lora_strength=lora_strength)
        results.append(result)
    return results


async def generate_images_with_progress(prompt: str, resolution: str, aspect_ratio: str, count: int = 4, image_model: str = "schnell", qwen_turbo: bool = True, lora_name: Optional[str] = None, lora_strength: float = 0.8):
    for i in range(count):
        # Tell frontend this card has started
        yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"

        # Generate the image in the background
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
                    print(f"[I2V] ✅ Uploaded as Comfy input: {comfy_name}")
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
                    print(f"[IA2V] ✅ Uploaded audio as Comfy input: {comfy_name}")
                    return comfy_name
                else:
                    print(f"[IA2V] Audio upload failed {response.status_code}: {response.text}")
                    return None

    except Exception as e:
        print(f"[IA2V] Audio upload exception: {e}")
        return None


async def generate_single_video(prompt: str, resolution: str, aspect_ratio: str, duration: int):
    print("\n>>> [VIDEO] generate_single_video started")

    try:
        base_workflow = load_base_video_workflow()
        width, height = get_video_dimensions(resolution, aspect_ratio)
        workflow = modify_video_workflow(base_workflow, prompt, width, height, duration)

        async with httpx.AsyncClient(timeout=600.0) as client:
            res = await client.post(f"{get_comfyui_url()}/prompt", json={"prompt": workflow})
            prompt_id = res.json().get("prompt_id")

            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            print(f"[VIDEO] Queued. Prompt ID: {prompt_id}")

            video_info = None

            try:
                # Deferred import to avoid circular dependency (main.py imports generate_* from this module at load time).
                from main import get_failed_gen_clear_seconds
                max_attempts = get_failed_gen_clear_seconds()
            except Exception:
                max_attempts = 600
            for attempt in range(max_attempts):
                await asyncio.sleep(1)

                try:
                    history = (await client.get(f"{get_comfyui_url()}/history/{prompt_id}")).json()

                    if prompt_id in history:
                        outputs = history[prompt_id].get("outputs", {})

                        if attempt % 10 == 0:
                            print(f"[VIDEO] Prompt found in history (attempt {attempt}). Nodes: {list(outputs.keys())}")

                        # Check node 75 (SaveVideo)
                        if '75' in outputs:
                            node75 = outputs['75']

                            # The video is returned under 'images' key with .mp4 extension
                            if isinstance(node75, dict) and node75.get('images'):
                                for item in node75['images']:
                                    if isinstance(item, dict) and item.get('filename', '').endswith('.mp4'):
                                        video_info = item
                                        print(f"[VIDEO] ✅ Found video file in node 75: {video_info}")
                                        break

                            if video_info:
                                break

                except Exception as e:
                    if attempt % 20 == 0:
                        print(f"[VIDEO] Polling warning: {e}")

            if not video_info:
                print("[VIDEO] ❌ No video file found after polling")
                return {"success": False, "error": "No video output found"}

            # Download the video
            local_filename = await download_and_save_video(
                video_info.get("filename"),
                video_info.get("subfolder", "")
            )

            if local_filename:
                print(f"[VIDEO] ✅ Successfully saved: {local_filename}")
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
    duration: int
):
    """
    Generate a video from a source image using the LTX 2.3 image-to-video workflow.
    - Uploads the source image to ComfyUI
    - Uses the provided prompt (or original)
    - Applies resolution, duration, random seeds
    """
    print("\n>>> [I2V] generate_single_image_to_video started")

    try:
        # 1. Upload the source image so the workflow's LoadImage can reference it
        comfy_image_name = await upload_image_to_comfy(source_image_filename)
        if not comfy_image_name:
            return {"success": False, "error": "Failed to upload source image"}

        base_workflow = load_base_image_to_video_workflow()
        width, height = get_video_dimensions(resolution, aspect_ratio)
        workflow = modify_image_to_video_workflow(
            base_workflow, prompt, width, height, duration, comfy_image_name
        )

        async with httpx.AsyncClient(timeout=600.0) as client:
            res = await client.post(f"{get_comfyui_url()}/prompt", json={"prompt": workflow})
            prompt_id = res.json().get("prompt_id")

            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            print(f"[I2V] Queued. Prompt ID: {prompt_id}")

            video_info = None

            try:
                # Deferred import to avoid circular dependency (main.py imports generate_* from this module at load time).
                from main import get_failed_gen_clear_seconds
                max_attempts = get_failed_gen_clear_seconds()
            except Exception:
                max_attempts = 600
            for attempt in range(max_attempts):
                await asyncio.sleep(1)

                try:
                    history = (await client.get(f"{get_comfyui_url()}/history/{prompt_id}")).json()

                    if prompt_id in history:
                        outputs = history[prompt_id].get("outputs", {})

                        if attempt % 10 == 0:
                            print(f"[I2V] Prompt found in history (attempt {attempt}). Nodes: {list(outputs.keys())}")

                        # Check node 75 (SaveVideo) - same as text-to-video
                        if '75' in outputs:
                            node75 = outputs['75']

                            if isinstance(node75, dict) and node75.get('images'):
                                for item in node75['images']:
                                    if isinstance(item, dict) and item.get('filename', '').endswith('.mp4'):
                                        video_info = item
                                        print(f"[I2V] ✅ Found video file in node 75: {video_info}")
                                        break

                            if video_info:
                                break

                except Exception as e:
                    if attempt % 20 == 0:
                        print(f"[I2V] Polling warning: {e}")

            if not video_info:
                print("[I2V] ❌ No video file found after polling")
                return {"success": False, "error": "No video output found"}

            # Download the video (reuse existing helper)
            local_filename = await download_and_save_video(
                video_info.get("filename"),
                video_info.get("subfolder", "")
            )

            if local_filename:
                print(f"[I2V] ✅ Successfully saved: {local_filename}")
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
    duration: int
):
    """
    Generate a video from a source image + audio modifier using the LTX 2.3 image-audio-to-video workflow.
    - Uploads the source image and the audio file to ComfyUI
    - Uses the provided prompt (or original)
    - Applies resolution, duration, random seeds
    - Called when audio modifier is selected in modal + video mode
    """
    print("\n>>> [IA2V] generate_single_image_audio_to_video started")

    try:
        # 1. Upload the main source image (the one viewed in modal)
        comfy_image_name = await upload_image_to_comfy(source_image_filename)
        if not comfy_image_name:
            return {"success": False, "error": "Failed to upload source image"}

        # 2. Upload the audio modifier
        comfy_audio_name = await upload_audio_to_comfy(audio_filename)
        if not comfy_audio_name:
            return {"success": False, "error": "Failed to upload modifier audio"}

        base_workflow = load_base_image_audio_to_video_workflow()
        width, height = get_video_dimensions(resolution, aspect_ratio)
        workflow = modify_image_audio_to_video_workflow(
            base_workflow, prompt, width, height, duration, comfy_image_name, comfy_audio_name
        )

        async with httpx.AsyncClient(timeout=600.0) as client:
            res = await client.post(f"{get_comfyui_url()}/prompt", json={"prompt": workflow})
            prompt_id = res.json().get("prompt_id")

            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            print(f"[IA2V] Queued. Prompt ID: {prompt_id}")

            video_info = None

            try:
                # Deferred import to avoid circular dependency (main.py imports generate_* from this module at load time).
                from main import get_failed_gen_clear_seconds
                max_attempts = get_failed_gen_clear_seconds()
            except Exception:
                max_attempts = 600
            for attempt in range(max_attempts):
                await asyncio.sleep(1)

                try:
                    history = (await client.get(f"{get_comfyui_url()}/history/{prompt_id}")).json()

                    if prompt_id in history:
                        outputs = history[prompt_id].get("outputs", {})

                        if attempt % 10 == 0:
                            print(f"[IA2V] Prompt found in history (attempt {attempt}). Nodes: {list(outputs.keys())}")

                        # Check node 341 (SaveVideo for the ia2v workflow)
                        if '341' in outputs:
                            node = outputs['341']

                            if isinstance(node, dict) and node.get('images'):
                                for item in node['images']:
                                    if isinstance(item, dict) and item.get('filename', '').endswith('.mp4'):
                                        video_info = item
                                        print(f"[IA2V] ✅ Found video file in node 341: {video_info}")
                                        break

                            if video_info:
                                break

                except Exception as e:
                    if attempt % 20 == 0:
                        print(f"[IA2V] Polling warning: {e}")

            if not video_info:
                print("[IA2V] ❌ No video file found after polling")
                return {"success": False, "error": "No video output found"}

            # Download the video (reuse existing helper)
            local_filename = await download_and_save_video(
                video_info.get("filename"),
                video_info.get("subfolder", "")
            )

            if local_filename:
                print(f"[IA2V] ✅ Successfully saved: {local_filename}")
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


async def generate_single_image_to_image(
    source_image_filename: str,
    prompt: str,
    i2i_model: str = "klein"
):
    """
    Generate an image from a source image using the selected i2i workflow (Flux 2 or Flux 2 Klein).
    - Uploads the source image to ComfyUI
    - Uses the adjustment prompt
    - Applies random seed
    - Output is a new image (derived from input size via workflow)
    """
    print("\n>>> [I2I] generate_single_image_to_image started (model:", i2i_model, ")")

    try:
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
            res = await client.post(f"{get_comfyui_url()}/prompt", json={"prompt": workflow})
            prompt_id = res.json().get("prompt_id")

            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            print(f"[I2I] Queued. Prompt ID: {prompt_id}")

            image_info = None

            try:
                # Deferred import to avoid circular dependency (main.py imports generate_* from this module at load time).
                from main import get_failed_gen_clear_seconds
                max_attempts = get_failed_gen_clear_seconds()
            except Exception:
                max_attempts = 600
            for attempt in range(max_attempts):  # Uses failed_gen_clear_seconds from settings (images typically complete faster than videos)
                await asyncio.sleep(1)

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
                                        print(f"[I2I] ✅ Found image file in node 9: {image_info}")
                                        break

                            if image_info:
                                break

                except Exception as e:
                    if attempt % 10 == 0:
                        print(f"[I2I] Polling warning: {e}")

            if not image_info:
                print("[I2I] ❌ No image file found after polling")
                return {"success": False, "error": "No image output found"}

            # Download the image (reuse existing helper)
            local_filename = await download_and_save_image(
                image_info.get("filename"),
                image_info.get("subfolder", "")
            )

            if local_filename:
                print(f"[I2I] ✅ Successfully saved: {local_filename}")
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
    i2i_model: str = "klein"
):
    """Progress wrapper for image-to-image generation from modal prompt bar (adjustment prompt)."""
    for i in range(count):
        yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"

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
    prompt: str
):
    """
    Generate an image from two reference images + prompt using the Flux2 Klein double i2i workflow.
    - Uploads both source images to ComfyUI (main as 1st ref, modifier as 2nd ref)
    - Uses the prompt
    - Applies random seed
    """
    print("\n>>> [DOUBLE_I2I] generate_double_image_to_image started")

    try:
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
            res = await client.post(f"{get_comfyui_url()}/prompt", json={"prompt": workflow})
            prompt_id = res.json().get("prompt_id")

            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            print(f"[DOUBLE_I2I] Queued. Prompt ID: {prompt_id}")

            image_info = None

            try:
                # Deferred import to avoid circular dependency (main.py imports generate_* from this module at load time).
                from main import get_failed_gen_clear_seconds
                max_attempts = get_failed_gen_clear_seconds()
            except Exception:
                max_attempts = 600
            for attempt in range(max_attempts):  # Uses failed_gen_clear_seconds from settings (images typically complete faster than videos)
                await asyncio.sleep(1)

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
                                        print(f"[DOUBLE_I2I] ✅ Found image file in node 94: {image_info}")
                                        break

                            if image_info:
                                break

                except Exception as e:
                    if attempt % 10 == 0:
                        print(f"[DOUBLE_I2I] Polling warning: {e}")

            if not image_info:
                print("[DOUBLE_I2I] ❌ No image file found after polling")
                return {"success": False, "error": "No image output found"}

            # Download the image
            local_filename = await download_and_save_image(
                image_info.get("filename"),
                image_info.get("subfolder", "")
            )

            if local_filename:
                print(f"[DOUBLE_I2I] ✅ Successfully saved: {local_filename}")
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
    count: int = 1
):
    """Progress wrapper for double image-to-image (2 refs + prompt) from modal when modifier image selected in image mode."""
    for i in range(count):
        yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"

        task = asyncio.create_task(
            generate_double_image_to_image(main_image_filename, second_image_filename, prompt)
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


async def generate_videos_with_progress(prompt: str, resolution: str, aspect_ratio: str, duration: int, count: int = 1):
    """Progress wrapper for text-to-video (used from library page video mode)."""
    for i in range(count):
        yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"

        task = asyncio.create_task(
            generate_single_video(prompt, resolution, aspect_ratio, duration)
        )

        percent = 0
        while not task.done():
            percent = min(percent + 8, 92)
            yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': percent})}\n\n"
            await asyncio.sleep(2)

        result = await task

        yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': 100})}\n\n"

        if result.get("success"):
            yield f"data: {json.dumps({
                'type': 'video_ready',
                'index': i,
                'local_filename': result['local_filename'],
                'width': result['width'],
                'height': result['height'],
                'duration': result.get('duration', duration)
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
    count: int = 1
):
    """Progress wrapper for image-to-video generation (used from modal 'Create Video From this')."""
    for i in range(count):
        yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"

        task = asyncio.create_task(
            generate_single_image_to_video(source_image_filename, prompt, resolution, aspect_ratio, duration)
        )

        percent = 0
        while not task.done():
            percent = min(percent + 8, 92)
            yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': percent})}\n\n"
            await asyncio.sleep(2)

        result = await task

        yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': 100})}\n\n"

        if result.get("success"):
            yield f"data: {json.dumps({
                'type': 'video_ready',
                'index': i,
                'local_filename': result['local_filename'],
                'width': result['width'],
                'height': result['height'],
                'duration': result.get('duration', duration)
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
    count: int = 1
):
    """Progress wrapper for image+audio-to-video generation (used when audio modifier + video selected in modal)."""
    for i in range(count):
        yield f"data: {json.dumps({'type': 'start', 'index': i})}\n\n"

        task = asyncio.create_task(
            generate_single_image_audio_to_video(source_image_filename, audio_filename, prompt, resolution, aspect_ratio, duration)
        )

        percent = 0
        while not task.done():
            percent = min(percent + 8, 92)
            yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': percent})}\n\n"
            await asyncio.sleep(2)

        result = await task

        yield f"data: {json.dumps({'type': 'progress', 'index': i, 'percent': 100})}\n\n"

        if result.get("success"):
            yield f"data: {json.dumps({
                'type': 'video_ready',
                'index': i,
                'local_filename': result['local_filename'],
                'width': result['width'],
                'height': result['height'],
                'duration': result.get('duration', duration)
            })}\n\n"
        else:
            yield f"data: {json.dumps({
                'type': 'error',
                'index': i,
                'error': result.get('error', 'Unknown error')
            })}\n\n"