import json

from config import get_ollama_settings

async def check_ollama_connection() -> bool:
    """Check if Ollama server is reachable (uses /api/tags)."""
    try:
        oll = get_ollama_settings()
        import httpx
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(f"{oll['url']}/api/tags")
            return response.status_code == 200
    except Exception:
        return False

async def fetch_ollama_models() -> list[str]:
    """Query Ollama for installed models via /api/tags. Returns list of model names (e.g. 'qwen3:8b')."""
    try:
        oll = get_ollama_settings()
        import httpx
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"{oll['url']}/api/tags")
            if resp.status_code == 200:
                data = resp.json() or {}
                models = []
                for m in (data.get("models") or []):
                    # Ollama returns objects with "name"
                    name = m.get("name") if isinstance(m, dict) else None
                    if name and isinstance(name, str):
                        models.append(name)
                # Also support older shape where it might be a flat list of strings
                if not models and isinstance(data.get("models"), list):
                    for m in data["models"]:
                        if isinstance(m, str):
                            models.append(m)
                return sorted(set(models))
    except Exception as e:
        print(f"[ollama] fetch models error: {e}")
    return []

async def ollama_generate(
    prompt: str,
    system: str | None = None,
    expect_json: bool = False,
    force_json_format: bool = False,
    model: str | None = None,
    timeout: int | None = None,
) -> dict:
    """Call Ollama /api/generate and return {"text", "parsed", "error"}.

    - expect_json=True → attempt to parse the response as JSON (tolerant extraction)
    - force_json_format=True → send "format": "json" to Ollama (can hurt some models)
    """
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
                candidate = text
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
