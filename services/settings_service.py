available_loras: list = []

async def refresh_loras() -> list:
    """Fetch latest LoRAs from ComfyUI and return the list."""
    global available_loras
    try:
        from services.comfy_service import fetch_loras_from_comfy
        available_loras = await fetch_loras_from_comfy()
        print(f"[settings] Loaded {len(available_loras)} LoRAs from ComfyUI")
        return available_loras
    except Exception as e:
        print(f"[settings] LoRA refresh error: {e}")
        return []
