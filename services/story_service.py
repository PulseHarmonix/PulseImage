import json
from config import get_ollama_settings

async def ollama_story_breakdown(story_text: str, characters: list, num_scenes: int | None = None, target_seconds: float | None = None, style: str | None = None, debug: bool = False) -> dict:
    """Pass 1: story + chars -> structured scene outline (JSON array)."""
    char_block = _format_characters_for_prompt(characters)
    target = f"Target total length: approximately {target_seconds} seconds." if target_seconds else "Fit a natural music-video pacing (typically 45-90s total)."
    nscenes = f"Produce exactly around {num_scenes} scenes." if num_scenes else "Produce 4-8 scenes (use your judgment for good pacing)."

    system = (
        "You are an expert music-video director and editor. "
        "You break a story into a tight sequence of visual scenes for a synchronized video. "
        "Output ONLY a raw JSON array. Start with [ and end with ]. "
        "Do NOT wrap the array in an object. Do NOT use markdown code fences (```). "
        "Do NOT add any text, explanation, or commentary before or after the JSON. "
        "Return a JSON array of scene objects. Each scene MUST have these exact keys:\n"
        "scene_number (int), title (short string), start_time (float seconds from 0), duration (float seconds), "
        "high_level_description (1-2 sentences), characters (array of character id strings from the provided list).\n"
        "Rules: start_time must be non-overlapping and increasing. The last scene should end near the target total. "
        "Assign characters only from the given list. Keep descriptions concise but evocative."
    )

    user = (
        f"FULL STORY:\n{story_text}\n\n"
        f"CHARACTERS (use only these ids):\n{char_block}\n\n"
        f"PARAMETERS:\n{nscenes}\n{target}\n"
        f"Creative style / mood notes: {style or 'cinematic, music-driven, high visual impact'}\n\n"
        "Output ONLY the raw JSON array now. Nothing else."
    )

    res = await ollama_generate(user, system=system, expect_json=True, force_json_format=False)
    scenes = res.get("parsed")
    out = {}
    if isinstance(scenes, list):
        # light normalization
        for i, s in enumerate(scenes):
            if isinstance(s, dict):
                s.setdefault("id", f"scene_{i+1:03d}")
                s.setdefault("scene_number", i + 1)
                s.setdefault("status", "draft")
                s.setdefault("prompt", "")
                s.setdefault("candidates", [])
                s.setdefault("selected_image_id", None)
                s.setdefault("video_id", None)
        out = {"scenes": scenes, "error": res.get("error")}
    else:
        out = {"scenes": [], "error": res.get("error") or "Model did not return a JSON array", "raw": res.get("text")}

    if debug:
        oll = get_ollama_settings()
        resolved_url = oll["url"]
        resolved_model = oll["model"]

        # Reconstruct the exact request body that was sent to Ollama
        request_body = {
            "model": resolved_model,
            "prompt": user,
            "stream": False,
        }
        if system:
            request_body["system"] = system
        # We deliberately do NOT send "format": "json" by default (it can make some models
        # return garbage or fail). We rely on a strong prompt + tolerant parsing instead.
        # If you ever want to test with it, you can temporarily set force_json_format=True above.

        out["debug"] = {
            "ollama_url": resolved_url,
            "model": resolved_model,
            "request": {
                "url": f"{resolved_url}/api/generate",
                "method": "POST",
                "body": request_body
            },
            "system_prompt": system,
            "user_prompt": user,
            "raw_response": res.get("text", "")
        }
    elif "raw" not in out and res.get("text"):
        out["raw"] = res.get("text")

    return out

async def ollama_scene_prompt(story_text: str, characters: list, scene: dict, style: str | None = None) -> dict:
    """Pass 2: full context + one scene -> single rich visual prompt optimized for Flux + video."""
    char_block = _format_characters_for_prompt(characters)
    scene_desc = scene.get("high_level_description") or scene.get("title", "")
    scene_chars = scene.get("characters", [])

    system = (
        "You are a prompt engineer specialized in Flux Schnell image generation and LTX / image-to-video models. "
        "Write one single, extremely detailed, cinematic English prompt (no line breaks, no numbering). "
        "Incorporate exact character appearance via the provided trigger words and descriptions. "
        "Emphasize lighting, camera angle/movement, mood, color grade, clothing details, expression, environment, and music-video energy. "
        "Keep it under ~220 words but be visually rich. "
        "Output ONLY a raw JSON object like this: {\"prompt\": \"your full prompt here\"}. "
        "Do not add any text outside the JSON object."
    )

    user = (
        f"OVERALL STORY (for emotional continuity):\n{story_text}\n\n"
        f"CHARACTERS AND THEIR VISUAL TRIGGERS:\n{char_block}\n\n"
        f"CURRENT SCENE:\n"
        f"Title: {scene.get('title','')}\n"
        f"High-level: {scene_desc}\n"
        f"Characters in this scene: {scene_chars}\n"
        f"Timing: starts at {scene.get('start_time',0)}s for ~{scene.get('duration',6)}s\n"
        f"Style/mood direction: {style or 'cinematic, high contrast, music video feel'}\n\n"
        "Produce the optimized visual prompt now as JSON."
    )

    res = await ollama_generate(user, system=system, expect_json=True, force_json_format=False)
    parsed = res.get("parsed") or {}
    prompt = parsed.get("prompt") if isinstance(parsed, dict) else None
    if not prompt and res.get("text"):
        # last-ditch: take the text as prompt
        prompt = res["text"].strip()
    return {"prompt": prompt or "", "error": res.get("error"), "raw": res.get("text")}

def _format_characters_for_prompt(chars: list) -> str:
    if not chars:
        return "No specific characters."
    lines = []
    for c in chars:
        tw = c.get("trigger_words") or ""
        lines.append(
            f"- {c.get('name','Character')}: {c.get('description','')}. "
            f"Trigger words / style: {tw}. "
            f"LoRA: {c.get('lora_filename') or 'none'} (strength ~{c.get('lora_strength', 0.8)})"
        )
    return "\n".join(lines)

async def ollama_generate(
    prompt: str,
    system: str | None = None,
    expect_json: bool = False,
    force_json_format: bool = False,
    model: str | None = None,
    timeout: int | None = None,
) -> dict:
    """
    Call Ollama /api/generate. Returns {"text": str, "parsed": object|None, "error": str|None}
    - expect_json=True  → we will attempt to parse the response as JSON (with tolerant extraction)
    - force_json_format=True → send "format": "json" to Ollama (can hurt some models; often better to rely on prompt + parsing)
    """
    # Deferred import so we don't fight a running uvicorn lock on the module during edits
    import httpx

    oll = get_ollama_settings()
    url = oll["url"]
    mdl = model or oll["model"]
    tmo = timeout or oll["timeout"]

    payload = {
        "model": mdl,
        "prompt": prompt,
        "stream": False,
    }
    if system:
        payload["system"] = system
    if force_json_format:
        payload["format"] = "json"

    try:
        async with httpx.AsyncClient(timeout=float(tmo)) as client:
            resp = await client.post(f"{url}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            text = (data.get("response") or "").strip()
            parsed = None
            err = None
            if expect_json and text:
                # Some models still wrap or add prose; be tolerant
                candidate = text
                # Try to extract the largest {...} or [...] block if extra text present
                if not (candidate.startswith("{") or candidate.startswith("[")):
                    import re
                    m = re.search(r'(\{.*\}|\[.*\])', candidate, re.DOTALL)
                    if m:
                        candidate = m.group(1)
                try:
                    parsed = json.loads(candidate)
                except Exception as je:
                    err = f"JSON parse failed: {je}. Raw head: {text[:200]}"
            return {"text": text, "parsed": parsed, "error": err}
    except httpx.HTTPStatusError as e:
        return {"text": "", "parsed": None, "error": f"Ollama HTTP {e.response.status_code}: {e.response.text[:300]}"}
    except Exception as e:
        return {"text": "", "parsed": None, "error": f"Ollama call failed ({type(e).__name__}): {e}"}
