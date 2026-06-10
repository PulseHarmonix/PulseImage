import json
import os

SETTINGS_FILE = "settings.json"

def load_app_settings() -> dict:
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                s = json.load(f)
                if "image_model" not in s or s["image_model"] not in ("schnell", "klein", "qwen"):
                    s["image_model"] = "schnell"
                if "i2i_model" not in s or s["i2i_model"] not in ("klein", "flux2"):
                    s["i2i_model"] = "klein"
                if "library_video_playback" not in s or s["library_video_playback"] not in ("1st_frame", "play_loop"):
                    s["library_video_playback"] = "1st_frame"
                if "qwen_turbo" not in s or not isinstance(s.get("qwen_turbo"), bool):
                    s["qwen_turbo"] = True
                # Server connection settings (moved from config.py)
                if "comfyui_url" not in s or not isinstance(s.get("comfyui_url"), str) or not s.get("comfyui_url").strip():
                    s["comfyui_url"] = "http://127.0.0.1:8188"
                if "ollama_url" not in s or not isinstance(s.get("ollama_url"), str) or not s.get("ollama_url").strip():
                    s["ollama_url"] = "http://127.0.0.1:11434"
                if "ollama_model" not in s or not isinstance(s.get("ollama_model"), str) or not s.get("ollama_model").strip():
                    s["ollama_model"] = "qwen3:8b"
                if "ollama_timeout" not in s or not isinstance(s.get("ollama_timeout"), (int, float)) or s.get("ollama_timeout") <= 0:
                    s["ollama_timeout"] = 180
                if "failed_gen_clear_seconds" not in s or not isinstance(s.get("failed_gen_clear_seconds"), (int, float)) or s.get("failed_gen_clear_seconds") <= 0:
                    s["failed_gen_clear_seconds"] = 600
                if "prompt_enhancers" not in s or not isinstance(s.get("prompt_enhancers"), list) or len(s.get("prompt_enhancers", [])) == 0:
                    s["prompt_enhancers"] = [
                        {"id": "none", "name": "No enhancement", "prompt": ""},
                        {"id": "cinematic", "name": "Cinematic", "prompt": "cinematic lighting, dramatic composition, film grain, anamorphic lens, color graded, shot on 35mm, high production value, moody atmosphere"},
                        {"id": "anime", "name": "Anime", "prompt": "detailed anime style, clean linework, vibrant colors, expressive eyes, dynamic anime composition, studio quality, sharp cel shading"},
                        {"id": "photoreal", "name": "Photorealistic", "prompt": "photorealistic, ultra detailed, natural lighting and skin pores, shot on professional full-frame DSLR, 8k, realistic textures, subtle film grain"},
                        {"id": "fantasy", "name": "Fantasy Art", "prompt": "epic fantasy illustration, magical glows, intricate details, rich saturated palette, painterly, high fantasy concept art, volumetric god rays"},
                        {"id": "cyberpunk", "name": "Cyberpunk", "prompt": "cyberpunk neon city, rain reflections, holographic signs, high-tech low-life, dramatic rim lighting, blade runner aesthetic, moody blues and magentas"},
                        {"id": "horror", "name": "Horror", "prompt": "horror movie still, deep shadows, unsettling atmosphere, fog, high contrast chiaroscuro, eerie practical lighting, psychological dread"},
                        {"id": "watercolor", "name": "Watercolor", "prompt": "delicate watercolor illustration, soft bleeding edges, layered translucent washes, visible paper texture, artistic and light, beautiful color bleeding"},
                        {"id": "oil", "name": "Oil Painting", "prompt": "classical oil painting on canvas, rich impasto texture, dramatic renaissance lighting, visible brush strokes, museum quality fine art"},
                        {"id": "3d", "name": "3D Render", "prompt": "high-end 3D CGI render, octane/redshift quality, clean materials, studio product lighting, perfect reflections, ultra sharp, subsurface scattering"},
                        {"id": "pixel", "name": "Pixel Art", "prompt": "beautiful 16-bit / 32-bit pixel art, crisp pixels, limited but vibrant palette, retro game aesthetic, clean dithering, nostalgic charm"},
                        {"id": "surreal", "name": "Surreal", "prompt": "surreal dreamlike scene, impossible architecture, melting forms, symbolic, salvador dali influence, ethereal lighting, unexpected juxtapositions"},
                        {"id": "minimal", "name": "Minimalist", "prompt": "minimalist elegant composition, generous negative space, simple refined forms, muted harmonious palette, zen calm, graphic design precision"},
                        {"id": "vintage", "name": "Vintage Film", "prompt": "1970s vintage film photography, kodachrome colors, heavy film grain, slight fade, lens flare, warm nostalgic tones, analog photo look"},
                        {"id": "steampunk", "name": "Steampunk", "prompt": "intricate steampunk machinery, brass copper leather, victorian industrial, glowing gauges, dramatic side lighting, rich sepia and teal palette"},
                        {"id": "scifi", "name": "Sci-Fi", "prompt": "futuristic sci-fi concept art, sleek advanced tech, clean hard surface modeling, dramatic cinematic lighting, space opera scale, polished materials"},
                        {"id": "cartoon", "name": "Cartoon", "prompt": "modern vibrant cartoon style, bold clean outlines, saturated playful colors, expressive features, pixar/disney 3d cartoon influence, polished"},
                        {"id": "hyperreal", "name": "Hyperrealistic", "prompt": "hyperrealistic macro detail, insane texture fidelity, perfect anatomy and materials, razor sharp focus, controlled studio lighting"},
                        {"id": "darkmoody", "name": "Dark Moody", "prompt": "dark moody cinematic lighting, deep crushed blacks, low key, desaturated cool tones, heavy atmosphere, film noir tension"},
                        {"id": "epic", "name": "Epic", "prompt": "epic sweeping vista, heroic scale, majestic god rays, golden hour, national geographic level grandeur, awe-inspiring composition, ultra wide"}
                    ]
                return s
        except Exception:
            pass
    return {
        "image_model": "schnell",
        "i2i_model": "klein",
        "library_video_playback": "1st_frame",
        "qwen_turbo": True,
        "comfyui_url": "http://127.0.0.1:8188",
        "ollama_url": "http://127.0.0.1:11434",
        "ollama_model": "qwen3:8b",
        "ollama_timeout": 180,
        "failed_gen_clear_seconds": 600,
        "prompt_enhancers": [
            {"id": "none", "name": "No enhancement", "prompt": ""},
            {"id": "cinematic", "name": "Cinematic", "prompt": "cinematic lighting, dramatic composition, film grain, anamorphic lens, color graded, shot on 35mm, high production value, moody atmosphere"},
            {"id": "anime", "name": "Anime", "prompt": "detailed anime style, clean linework, vibrant colors, expressive eyes, dynamic anime composition, studio quality, sharp cel shading"},
            {"id": "photoreal", "name": "Photorealistic", "prompt": "photorealistic, ultra detailed, natural lighting and skin pores, shot on professional full-frame DSLR, 8k, realistic textures, subtle film grain"},
            {"id": "fantasy", "name": "Fantasy Art", "prompt": "epic fantasy illustration, magical glows, intricate details, rich saturated palette, painterly, high fantasy concept art, volumetric god rays"},
            {"id": "cyberpunk", "name": "Cyberpunk", "prompt": "cyberpunk neon city, rain reflections, holographic signs, high-tech low-life, dramatic rim lighting, blade runner aesthetic, moody blues and magentas"},
            {"id": "horror", "name": "Horror", "prompt": "horror movie still, deep shadows, unsettling atmosphere, fog, high contrast chiaroscuro, eerie practical lighting, psychological dread"},
            {"id": "watercolor", "name": "Watercolor", "prompt": "delicate watercolor illustration, soft bleeding edges, layered translucent washes, visible paper texture, artistic and light, beautiful color bleeding"},
            {"id": "oil", "name": "Oil Painting", "prompt": "classical oil painting on canvas, rich impasto texture, dramatic renaissance lighting, visible brush strokes, museum quality fine art"},
            {"id": "3d", "name": "3D Render", "prompt": "high-end 3D CGI render, octane/redshift quality, clean materials, studio product lighting, perfect reflections, ultra sharp, subsurface scattering"},
            {"id": "pixel", "name": "Pixel Art", "prompt": "beautiful 16-bit / 32-bit pixel art, crisp pixels, limited but vibrant palette, retro game aesthetic, clean dithering, nostalgic charm"},
            {"id": "surreal", "name": "Surreal", "prompt": "surreal dreamlike scene, impossible architecture, melting forms, symbolic, salvador dali influence, ethereal lighting, unexpected juxtapositions"},
            {"id": "minimal", "name": "Minimalist", "prompt": "minimalist elegant composition, generous negative space, simple refined forms, muted harmonious palette, zen calm, graphic design precision"},
            {"id": "vintage", "name": "Vintage Film", "prompt": "1970s vintage film photography, kodachrome colors, heavy film grain, slight fade, lens flare, warm nostalgic tones, analog photo look"},
            {"id": "steampunk", "name": "Steampunk", "prompt": "intricate steampunk machinery, brass copper leather, victorian industrial, glowing gauges, dramatic side lighting, rich sepia and teal palette"},
            {"id": "scifi", "name": "Sci-Fi", "prompt": "futuristic sci-fi concept art, sleek advanced tech, clean hard surface modeling, dramatic cinematic lighting, space opera scale, polished materials"},
            {"id": "cartoon", "name": "Cartoon", "prompt": "modern vibrant cartoon style, bold clean outlines, saturated playful colors, expressive features, pixar/disney 3d cartoon influence, polished"},
            {"id": "hyperreal", "name": "Hyperrealistic", "prompt": "hyperrealistic macro detail, insane texture fidelity, perfect anatomy and materials, razor sharp focus, controlled studio lighting"},
            {"id": "darkmoody", "name": "Dark Moody", "prompt": "dark moody cinematic lighting, deep crushed blacks, low key, desaturated cool tones, heavy atmosphere, film noir tension"},
            {"id": "epic", "name": "Epic", "prompt": "epic sweeping vista, heroic scale, majestic god rays, golden hour, national geographic level grandeur, awe-inspiring composition, ultra wide"}
        ]
    }

def save_app_settings(settings: dict):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)
    except Exception as e:
        print("Failed to save settings:", e)

def get_comfyui_url() -> str:
    """Return the current ComfyUI base URL from settings (or sensible default)."""
    s = load_app_settings()
    url = (s.get("comfyui_url") or "").strip()
    return url or "http://127.0.0.1:8188"

def get_ollama_settings() -> dict:
    """Return current Ollama connection settings."""
    s = load_app_settings()
    url = (s.get("ollama_url") or "").strip() or "http://127.0.0.1:11434"
    model = (s.get("ollama_model") or "").strip() or "qwen3:8b"
    try:
        timeout = int(s.get("ollama_timeout") or 180)
    except Exception:
        timeout = 180
    if timeout <= 0:
        timeout = 180
    return {"url": url.rstrip("/"), "model": model, "timeout": timeout}

def get_failed_gen_clear_seconds() -> int:
    """Return the configured timeout (in seconds) before a generation is considered failed.
    This value is used as the loop bound (with 1s sleep) for history polling in comfy_service.py
    for both image and video generation paths (T2I, I2I, T2V, I2V, IA2V, etc.).
    """
    s = load_app_settings()
    try:
        val = s.get("failed_gen_clear_seconds", 600)
        val = int(val)
        return val if val > 0 else 600
    except Exception:
        return 600

