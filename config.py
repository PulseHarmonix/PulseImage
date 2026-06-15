import json

def _get_defaults() -> dict:
    """Return the default settings dictionary with all factory values."""
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
        "library_density": "full",
        "library_filters": ["image"],
        "window_states": {},
        "theme": "macOS Dark",
        "customTheme": None,
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


def _apply_defaults(s: dict) -> dict:
    """Fill any missing or invalid keys in s with factory defaults."""
    defaults = _get_defaults()
    for key, default_val in defaults.items():
        if key not in s or s[key] is None:
            s[key] = default_val
        elif key == "image_model" and s[key] not in ("schnell", "klein", "qwen"):
            s[key] = default_val
        elif key == "i2i_model" and s[key] not in ("klein", "flux2"):
            s[key] = default_val
        elif key == "library_video_playback" and s[key] not in ("1st_frame", "play_loop"):
            s[key] = default_val
        elif key == "qwen_turbo" and not isinstance(s[key], bool):
            s[key] = default_val
        elif key in ("comfyui_url", "ollama_url", "ollama_model") and (not isinstance(s[key], str) or not s[key].strip()):
            s[key] = default_val
        elif key in ("ollama_timeout", "failed_gen_clear_seconds") and (not isinstance(s[key], (int, float)) or s[key] <= 0):
            s[key] = default_val
        elif key == "library_density" and s[key] not in ("full", "compact"):
            s[key] = default_val
        elif key == "library_filters" and not isinstance(s[key], list):
            s[key] = default_val
        elif key == "window_states" and not isinstance(s[key], dict):
            s[key] = default_val
        elif key == "prompt_enhancers" and (not isinstance(s[key], list) or len(s[key]) == 0):
            s[key] = default_val
    return s


def _parse_db_val(v: str) -> object:
    """Try to parse a DB value as JSON; return raw string on failure."""
    if v is None:
        return None
    try:
        return json.loads(v)
    except (json.JSONDecodeError, TypeError):
        return v


def load_app_settings() -> dict:
    """Load settings from the DB, apply defaults, and return the merged dict."""
    try:
        from services.database_service import get_db
        conn = get_db()
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        conn.close()
        if rows:
            s = {}
            for r in rows:
                s[r["key"]] = _parse_db_val(r["value"])
            return _apply_defaults(s)
    except Exception:
        pass

    return _get_defaults()


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

