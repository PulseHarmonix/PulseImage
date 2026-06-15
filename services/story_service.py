import json
from config import get_ollama_settings


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
