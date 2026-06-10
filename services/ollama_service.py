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

async def ollama_chat(
    messages: list,
    model: str | None = None,
    timeout: int | None = None,
) -> dict:
    """
    Call Ollama /api/chat with a messages array (role/content).
    Returns {"text": str, "error": str|None} (text is the assistant content).
    """
    import httpx
    oll = get_ollama_settings()
    url = oll["url"]
    mdl = model or oll["model"]
    tmo = timeout or oll["timeout"]

    payload = {
        "model": mdl,
        "messages": messages,
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=float(tmo)) as client:
            resp = await client.post(f"{url}/api/chat", json=payload)
            resp.raise_for_status()
            data = resp.json()
            msg = data.get("message") or {}
            text = (msg.get("content") or "").strip()
            return {"text": text, "error": None}
    except httpx.HTTPStatusError as e:
        return {"text": "", "error": f"Ollama HTTP {e.response.status_code}: {e.response.text[:300]}"}
    except Exception as e:
        return {"text": "", "error": f"Ollama chat failed ({type(e).__name__}): {e}"}
