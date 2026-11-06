"""Text-to-speech service backed by ComfyUI + the Qwen3-TTS node pack."""
import asyncio
import json
import os
import time
import uuid

import httpx

from config import get_comfyui_url, get_failed_gen_clear_seconds, load_app_settings
from services.audio_service import (
    AudioError,
    delete_audio,
    get_audio_duration,
    trim_audio,
)
from services.comfy_progress import post_prompt, set_progress_job
from services.comfy_service import upload_audio_to_comfy
from services.generation_service import (
    get_asset_by_id,
    save_generation,
    update_generation,
)

AUDIO_FOLDER = "audio"
SAVE_NODE = "4"
WORKFLOW_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "workflows", "tts_qwen3.json"
)
CHATTERBOX_WORKFLOW_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "workflows", "tts_chatterbox.json"
)
COSYVOICE_WORKFLOW_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "workflows", "tts_cosyvoice3.json"
)
F5_WORKFLOW_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "workflows", "tts_f5tts.json"
)
ASR_WORKFLOW_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "workflows", "asr_mtb.json"
)
ZONOS2_WORKFLOW_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "workflows", "tts_zonos2.json"
)
INDEXTTS_WORKFLOW_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "workflows", "tts_indextts2.json"
)
XTTS_WORKFLOW_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "workflows", "tts_xttsv2.json"
)
GPT_SOVITS_WORKFLOW_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "workflows", "tts_gptsovits.json"
)
XTTS_LANGS = {
    "english": "en",
    "spanish": "es",
    "french": "fr",
    "german": "de",
    "italian": "it",
    "portuguese": "pt",
    "polish": "pl",
    "turkish": "tr",
    "russian": "ru",
    "dutch": "nl",
    "czech": "cs",
    "arabic": "ar",
    "chinese": "zh-cn",
    "japanese": "ja",
    "hungarian": "hu",
    "korean": "ko",
    "hindi": "hi",
}
ZONOS_EMOTION = {
    "neutral": "none",
    "happy": "happy",
    "sad": "sad",
    "angry": "angry",
    "surprised": "surprised",
    "whisper": "none",
    "fearful": "sad",
    "disgusted": "angry",
}
INDEXTTS_EMOTION_TEXT = {
    "neutral": "Speak in a natural, calm, and steady tone.",
    "happy": "Speak in a very happy and cheerful tone, full of energy.",
    "sad": "Speak in a sad, low-spirited voice with a hint of sorrow.",
    "angry": "Speak with an angry and stern tone, aggressive and sharp.",
    "whisper": "Speak in a very soft whisper, as if sharing a secret.",
    "fearful": "Speak with a trembling, terrified voice, sounding panic-stricken.",
    "surprised": "Speak with a shocked and incredulous tone, pitch raised.",
    "disgusted": "Speak with a tone of revulsion and strong dislike.",
}
COSYVOICE_INSTRUCT = {
    "neutral": "Speak in a natural, calm, and steady tone.",
    "happy": "Speak in a very happy and cheerful tone, full of energy.",
    "sad": "Speak in a sad, low-spirited voice with a hint of sorrow.",
    "angry": "Speak with an angry and stern tone, aggressive and sharp.",
    "whisper": "Speak in a very soft whisper, as if sharing a secret.",
    "fearful": "Speak with a trembling, terrified voice, sounding panic-stricken.",
    "surprised": "Speak with a shocked and incredulous tone, pitch raised.",
    "disgusted": "Speak with a tone of revulsion and strong dislike.",
}
CHATTERBOX_EXAGGERATION = {
    "neutral": 0.5,
    "happy": 0.8,
    "sad": 0.35,
    "angry": 0.9,
    "whisper": 0.25,
    "fearful": 0.8,
    "surprised": 0.8,
    "disgusted": 0.7,
}


def _model_choice(settings: dict) -> str:
    model = str(settings.get("tts_qwen3_model") or "")
    return "0.6B" if "0.6B" in model else "1.7B"


def _precision(settings: dict) -> str:
    precision = str(settings.get("tts_qwen3_precision") or "bf16")
    return precision if precision in ("bf16", "fp32") else "bf16"


def _attention(settings: dict) -> str:
    mode = str(settings.get("tts_qwen3_attn_mode") or "sdpa")
    mapped = {
        "flash_attention_2": "flash_attn",
        "sage_attention": "sage_attn",
    }.get(mode, mode)
    return mapped if mapped in ("auto", "sage_attn", "flash_attn", "sdpa", "eager") else "sdpa"

LANGUAGES = [
    "English",
    "Chinese",
    "Japanese",
    "Korean",
    "German",
    "French",
    "Russian",
    "Portuguese",
    "Spanish",
    "Italian",
]

EMOTION_INSTRUCT = {
    "neutral": "Speak in a natural, calm, and steady tone.",
    "happy": "Speak in a very happy and cheerful tone, full of energy.",
    "angry": "Speak with an angry and stern tone, aggressive and sharp.",
    "sad": "Speak in a sad, low-spirited voice with a hint of sorrow.",
    "whisper": "Speak in a very soft whisper, as if sharing a secret.",
    "fearful": "Speak with a trembling, terrified voice, sounding panic-stricken.",
    "surprised": "Speak with a shocked and incredulous tone, pitch raised.",
    "disgusted": "Speak with a tone of revulsion and strong dislike.",
}

AUDIO_EXTENSIONS = (".wav", ".mp3", ".flac", ".ogg", ".m4a")

ENGINE_CONFIGS = {
    "qwen3": {
        "label": "Qwen3-TTS",
        "node_pack": "ComfyUI-Qwen-TTS (FB) or wanaigc/ComfyUI-Qwen3-TTS",
        "model": "Qwen/Qwen3-TTS-12Hz-1.7B-Base",
        "node_keywords": ["fb_qwen3ttsvoiceclone", "qwen3ttsvoiceclone"],
        "languages": LANGUAGES,
        "default_language": "English",
        "controls": {
            "emotion": False,
            "whisper": False,
            "instruction": False,
            "ref_text": True,
            "seed": True,
            "speed": False,
        },
    },
    "chatterbox": {
        "label": "Chatterbox",
        "node_pack": "ComfyUI-Chatterbox (wildminder)",
        "model": "ResembleAI Chatterbox (~2.5 GB)",
        "node_keywords": ["chatterboxtts", "chatterbox"],
        "languages": ["English"],
        "default_language": "English",
        "controls": {
            "emotion": True,
            "whisper": False,
            "instruction": False,
            "ref_text": False,
            "seed": True,
            "speed": False,
        },
    },
    "cosyvoice3": {
        "label": "CosyVoice 3",
        "node_pack": "ComfyUI_FL-CosyVoice3 or comfyui-ts-cosyvoice",
        "model": "Fun-CosyVoice3-0.5B",
        "node_keywords": ["cosyvoice"],
        "languages": ["English", "Chinese", "Japanese", "Korean"],
        "default_language": "English",
        "controls": {
            "emotion": True,
            "whisper": True,
            "instruction": True,
            "ref_text": False,
            "seed": True,
            "speed": True,
        },
    },
    "indextts25": {
        "label": "IndexTTS 2",
        "node_pack": "indextts-mw (ComfyUI_IndexTTS)",
        "model": "IndexTTS 2 (auto-download)",
        "node_keywords": ["indextts"],
        "languages": ["English", "Chinese"],
        "default_language": "English",
        "controls": {
            "emotion": True,
            "whisper": True,
            "instruction": True,
            "ref_text": False,
            "seed": False,
            "speed": False,
        },
    },
    "f5tts": {
        "label": "F5-TTS",
        "node_pack": "ComfyUI-F5-TTS (niknah)",
        "model": "F5TTS_v1_Base (CC-BY-NC weights)",
        "node_keywords": ["f5tts"],
        "languages": ["English", "Chinese"],
        "default_language": "English",
        "controls": {
            "emotion": False,
            "whisper": False,
            "instruction": False,
            "ref_text": False,
            "seed": True,
            "speed": True,
        },
    },
    "xttsv2": {
        "label": "XTTS v2",
        "node_pack": "ComfyUI-XTTS (AIFSH)",
        "model": "coqui/XTTS-v2 (CPML non-commercial)",
        "node_keywords": ["xtts"],
        "languages": [
            "English",
            "Spanish",
            "French",
            "German",
            "Italian",
            "Portuguese",
            "Polish",
            "Turkish",
            "Russian",
            "Dutch",
            "Czech",
            "Arabic",
            "Chinese",
            "Japanese",
            "Hungarian",
            "Korean",
            "Hindi",
        ],
        "default_language": "English",
        "controls": {
            "emotion": False,
            "whisper": False,
            "instruction": False,
            "ref_text": False,
            "seed": True,
            "speed": True,
        },
    },
    "zonos2": {
        "label": "Zonos2",
        "node_pack": "zonos2-tts-comfyui-emotion",
        "model": "Zyphra/ZONOS2 FP8",
        "node_keywords": ["zonos"],
        "languages": [
            "English",
            "Chinese",
            "Japanese",
            "Korean",
            "French",
            "German",
            "Spanish",
            "Italian",
            "Portuguese",
        ],
        "default_language": "English",
        "controls": {
            "emotion": True,
            "whisper": False,
            "instruction": False,
            "ref_text": False,
            "seed": True,
            "speed": False,
        },
    },
    "gpt_sovits": {
        "label": "GPT-SoVITS",
        "node_pack": "GSTTS-ComfyUI (AIFSH)",
        "model": "GPT-SoVITS base checkpoints + reference",
        "node_keywords": ["sovits"],
        "languages": ["English", "Chinese"],
        "default_language": "English",
        "controls": {
            "emotion": False,
            "whisper": False,
            "instruction": False,
            "ref_text": False,
            "seed": False,
            "speed": False,
        },
    },
}

_NODE_KEYS_CACHE = {"ts": 0.0, "keys": set()}


async def _comfy_node_keys() -> set:
    """Return ComfyUI object_info node keys, cached for 15 seconds."""
    now = time.time()
    if now - _NODE_KEYS_CACHE["ts"] < 15:
        return _NODE_KEYS_CACHE["keys"]

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(f"{get_comfyui_url()}/object_info")
            keys = set(res.json().keys())
        _NODE_KEYS_CACHE["ts"] = now
        _NODE_KEYS_CACHE["keys"] = keys
        return keys
    except Exception:
        _NODE_KEYS_CACHE["ts"] = now
        _NODE_KEYS_CACHE["keys"] = set()
        return set()


async def get_engines() -> dict:
    """Return the available TTS engines, their controls, and install status."""
    keys = await _comfy_node_keys()
    engines = []
    for engine_id, cfg in ENGINE_CONFIGS.items():
        installed = any(
            keyword in key.lower()
            for key in keys
            for keyword in cfg["node_keywords"]
        )
        engines.append(
            {
                "id": engine_id,
                "label": cfg["label"],
                "installed": installed,
                "node_pack": cfg["node_pack"],
                "model": cfg["model"],
                "languages": cfg["languages"],
                "default_language": cfg["default_language"],
                "controls": cfg["controls"],
            }
        )
    return {"engines": engines}


def _load_workflow(path: str = WORKFLOW_PATH) -> dict:
    """Load a TTS workflow template from disk."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def build_qwen3_workflow(
    text: str,
    comfy_audio_name: str,
    ref_text: str,
    language: str,
    emotion: str,
    instruction: str,
    seed: int,
) -> dict:
    """Build a Qwen3-TTS voice-clone workflow from the template and settings."""
    workflow = _load_workflow(WORKFLOW_PATH)
    settings = load_app_settings()

    if language not in LANGUAGES:
        language = "English"

    try:
        seed_val = int(seed)
    except (TypeError, ValueError):
        seed_val = 0

    ref_text_clean = (ref_text or "").strip()
    model_choice = _model_choice(settings)
    precision = _precision(settings)
    attention = _attention(settings)

    workflow["1"]["inputs"]["audio"] = comfy_audio_name
    workflow["2"]["inputs"].update(
        {
            "ref_audio": ["1", 0],
            "ref_text": ref_text_clean,
            "model_choice": model_choice,
            "device": "auto",
            "precision": precision,
            "attention": attention,
            "x_vector_only": not bool(ref_text_clean),
        }
    )
    workflow["3"]["inputs"].update(
        {
            "target_text": text,
            "model_choice": model_choice,
            "device": "auto",
            "precision": precision,
            "language": language,
            "voice_clone_prompt": ["2", 0],
            "seed": seed_val,
            "max_new_tokens": 2048,
            "attention": attention,
        }
    )
    workflow["4"]["inputs"].update(
        {"audio": ["3", 0], "filename_prefix": "audio/qwen3tts"}
    )
    return workflow


def build_chatterbox_workflow(
    text: str,
    comfy_audio_name: str,
    emotion: str,
    seed: int,
) -> dict:
    """Build a Chatterbox voice-clone workflow (English pack)."""
    workflow = _load_workflow(CHATTERBOX_WORKFLOW_PATH)
    try:
        seed_val = int(seed)
    except (TypeError, ValueError):
        seed_val = 0

    exaggeration = CHATTERBOX_EXAGGERATION.get(
        (emotion or "neutral").strip().lower(), 0.5
    )
    workflow["1"]["inputs"]["audio"] = comfy_audio_name
    workflow["2"]["inputs"].update(
        {
            "text": text,
            "audio_prompt": ["1", 0],
            "seed": seed_val,
            "exaggeration": exaggeration,
        }
    )
    return workflow


def build_cosyvoice3_workflow(
    text: str,
    comfy_audio_name: str,
    emotion: str,
    instruction: str,
    seed: int,
) -> dict:
    """Build a CosyVoice 3 instruct/clone workflow."""
    workflow = _load_workflow(COSYVOICE_WORKFLOW_PATH)
    try:
        seed_val = int(seed)
    except (TypeError, ValueError):
        seed_val = 0

    instruct = (instruction or "").strip() or COSYVOICE_INSTRUCT.get(
        (emotion or "neutral").strip().lower(),
        "Speak in a clear, natural voice.",
    )
    workflow["1"]["inputs"]["audio"] = comfy_audio_name
    workflow["3"]["inputs"].update(
        {
            "text": text,
            "instruct_text": instruct,
            "reference_audio": ["1", 0],
            "seed": seed_val,
        }
    )
    return workflow


def build_f5_workflow(
    text: str,
    comfy_audio_name: str,
    language: str,
    seed: int,
) -> dict:
    """Build an F5-TTS workflow using the uploaded sample + .txt transcript."""
    workflow = _load_workflow(F5_WORKFLOW_PATH)
    try:
        seed_val = int(seed)
    except (TypeError, ValueError):
        seed_val = 0

    workflow["1"]["inputs"]["audio"] = comfy_audio_name
    workflow["2"]["inputs"].update(
        {
            "sample": comfy_audio_name,
            "speech": text,
            "seed": seed_val,
        }
    )
    return workflow


def build_asr_workflow(
    comfy_audio_name: str,
    txt_filename: str,
    language: str,
) -> dict:
    """Build a Whisper ASR workflow that writes the transcript into ComfyUI input."""
    workflow = _load_workflow(ASR_WORKFLOW_PATH)
    lang_code = "zh" if str(language).strip().lower() == "chinese" else "en"
    workflow["1"]["inputs"]["audio"] = comfy_audio_name
    workflow["3"]["inputs"]["language"] = lang_code
    workflow["4"]["inputs"]["file"] = txt_filename
    return workflow


def build_zonos2_workflow(
    text: str,
    comfy_audio_name: str,
    emotion: str,
    seed: int,
) -> dict:
    """Build a Zonos2 voice-clone workflow."""
    workflow = _load_workflow(ZONOS2_WORKFLOW_PATH)
    try:
        seed_val = int(seed)
    except (TypeError, ValueError):
        seed_val = 0
    emotion_key = ZONOS_EMOTION.get(
        (emotion or "neutral").strip().lower(), "none"
    )
    workflow["1"]["inputs"]["audio"] = comfy_audio_name
    workflow["3"]["inputs"].update(
        {
            "text": text,
            "reference_audio": ["1", 0],
            "seed": seed_val,
            "emotion": emotion_key,
        }
    )
    return workflow


def build_gptsovits_workflow(
    text: str,
    comfy_audio_name: str,
    language: str,
) -> dict:
    """Build a GPT-SoVITS workflow with automatic reference transcription."""
    workflow = _load_workflow(GPT_SOVITS_WORKFLOW_PATH)
    is_chinese = str(language or "English").strip().lower() == "chinese"
    lang_code = "zh" if is_chinese else "en"
    lang_label = "Chinese" if is_chinese else "English"
    workflow["1"]["inputs"]["audio"] = comfy_audio_name
    workflow["3"]["inputs"]["language"] = lang_code
    workflow["4"]["inputs"].update({"text": text, "language": lang_label})
    workflow["5"]["inputs"]["language"] = lang_label
    return workflow


def build_xtts_workflow(
    text: str,
    comfy_audio_name: str,
    language: str,
) -> dict:
    """Build an XTTS v2 voice-clone workflow."""
    workflow = _load_workflow(XTTS_WORKFLOW_PATH)
    lang_code = XTTS_LANGS.get(
        str(language or "English").strip().lower(), "en"
    )
    workflow["1"]["inputs"]["audio"] = comfy_audio_name
    workflow["2"]["inputs"].update({"text": text, "language": lang_code})
    return workflow


def _audio_output_info(item) -> dict | None:
    """Normalize ComfyUI audio output entries (dict or UI list) into file info."""
    if isinstance(item, dict) and item.get("filename"):
        return item
    if isinstance(item, (list, tuple)) and item:
        filename = str(item[0])
        if filename.lower().endswith(AUDIO_EXTENSIONS):
            subfolder = str(item[1]) if len(item) > 1 else ""
            if subfolder.lower() == "output":
                subfolder = ""
            return {
                "filename": filename,
                "subfolder": subfolder,
                "type": "output",
            }
    return None


def build_indextts2_workflow(
    text: str,
    comfy_audio_name: str,
    emotion: str,
    instruction: str,
) -> dict:
    """Build an IndexTTS2 voice-clone workflow."""
    workflow = _load_workflow(INDEXTTS_WORKFLOW_PATH)
    emo_text = (instruction or "").strip() or INDEXTTS_EMOTION_TEXT.get(
        (emotion or "neutral").strip().lower(), ""
    )
    workflow["1"]["inputs"]["audio"] = comfy_audio_name
    workflow["2"]["inputs"].update(
        {
            "audio": ["1", 0],
            "text": text,
            "use_emo_text": bool(emo_text and (emotion or "").strip().lower() != "neutral"),
            "emo_text": emo_text,
        }
    )
    return workflow


async def _run_asr_to_input(
    comfy_audio_name: str,
    txt_filename: str,
    language: str,
) -> str | None:
    """Transcribe the reference and write <name>.txt next to it in ComfyUI input."""
    workflow = build_asr_workflow(comfy_audio_name, txt_filename, language)
    set_progress_job("", 0)
    async with httpx.AsyncClient(timeout=600.0) as client:
        res = await post_prompt(client, workflow)
        if res.status_code != 200:
            try:
                err = res.json()
            except Exception:
                err = {}
            return err.get("error") or f"ASR ComfyUI error {res.status_code}"
        prompt_id = res.json().get("prompt_id")
        if not prompt_id:
            return "ASR failed: no prompt_id"

        max_attempts = min(300, get_failed_gen_clear_seconds())
        for _attempt in range(max_attempts):
            await asyncio.sleep(1)
            try:
                history = (
                    await client.get(f"{get_comfyui_url()}/history/{prompt_id}")
                ).json()
            except Exception:
                continue
            if prompt_id not in history:
                continue
            item = history[prompt_id]
            status = item.get("status") or {}
            if status.get("status_str") == "error":
                for msg in status.get("messages") or []:
                    if msg and msg[0] == "execution_error":
                        detail = msg[1] or {}
                        return (
                            detail.get("exception_message")
                            or "ASR execution failed"
                        )
                return "ASR execution failed"
            if status.get("status_str") == "success" or item.get("outputs"):
                return None
        return "ASR timed out"
    return "ASR failed"


async def generate_speech(
    text: str,
    voice_id: str = "",
    voice_filename: str = "",
    engine: str = "qwen3",
    language: str = "English",
    emotion: str = "neutral",
    instruction: str = "",
    ref_text: str = "",
    seed: int = 0,
    job_id: str = "",
) -> dict:
    """Generate speech via ComfyUI using a reference voice, and save the result."""
    try:
        if not text or not str(text).strip():
            return {"success": False, "error": "Text is required"}

        if engine not in ENGINE_CONFIGS:
            return {"success": False, "error": f"Unsupported TTS engine: {engine}"}

        if engine != "qwen3":
            cfg = ENGINE_CONFIGS[engine]
            keys = await _comfy_node_keys()
            installed = any(
                keyword in key.lower()
                for key in keys
                for keyword in cfg["node_keywords"]
            )
            if not installed:
                return {
                    "success": False,
                    "error": (
                        f"{cfg['label']} is not installed in ComfyUI. "
                        f"Install {cfg['node_pack']} and {cfg['model']}."
                    ),
                }
            if engine not in ("chatterbox", "cosyvoice3", "f5tts", "zonos2", "indextts25", "xttsv2", "gpt_sovits"):
                return {
                    "success": False,
                    "error": (
                        f"{cfg['label']} is installed but its workflow adapter "
                        "is not wired yet."
                    ),
                }

        filename = ""
        if voice_id:
            asset = get_asset_by_id(voice_id)
            if not asset or not asset.get("voice"):
                return {"success": False, "error": "Voice not found in library"}
            filename = asset.get("filename") or ""
        else:
            filename = voice_filename

        if not filename:
            return {"success": False, "error": "Drag a voice from the Voices library"}

        filename = os.path.basename(filename)

        if not os.path.isfile(os.path.join(AUDIO_FOLDER, filename)):
            return {"success": False, "error": f"Voice file not found: {filename}"}

        if job_id:
            set_progress_job(job_id, 0)

        ref_filename = filename
        temp_ref = None
        ref_duration = get_audio_duration(filename)
        if ref_duration and ref_duration > 30.0:
            try:
                temp_ref = trim_audio(filename, 0.0, 30.0)
                ref_filename = temp_ref
            except AudioError as e:
                return {
                    "success": False,
                    "error": f"Could not trim reference audio to 30s: {e}",
                }

        comfy_audio_name = await upload_audio_to_comfy(ref_filename)
        if temp_ref:
            delete_audio(temp_ref)
        if not comfy_audio_name:
            return {"success": False, "error": "Failed to upload voice to ComfyUI"}

        if engine == "qwen3":
            workflow = build_qwen3_workflow(
                text, comfy_audio_name, ref_text, language, emotion, instruction, seed
            )
            save_node = "4"
        elif engine == "cosyvoice3":
            workflow = build_cosyvoice3_workflow(
                text, comfy_audio_name, emotion, instruction, seed
            )
            save_node = "4"
        elif engine == "f5tts":
            txt_filename = os.path.splitext(comfy_audio_name)[0] + ".txt"
            asr_error = await _run_asr_to_input(
                comfy_audio_name, txt_filename, language
            )
            if asr_error:
                return {"success": False, "error": f"F5 reference ASR failed: {asr_error}"}
            if job_id:
                set_progress_job(job_id, 0)
            workflow = build_f5_workflow(
                text, comfy_audio_name, language, seed
            )
            save_node = "3"
        elif engine == "zonos2":
            workflow = build_zonos2_workflow(
                text, comfy_audio_name, emotion, seed
            )
            save_node = "4"
        elif engine == "indextts25":
            workflow = build_indextts2_workflow(
                text, comfy_audio_name, emotion, instruction
            )
            save_node = "3"
        elif engine == "xttsv2":
            workflow = build_xtts_workflow(
                text, comfy_audio_name, language
            )
            save_node = "3"
        elif engine == "gpt_sovits":
            workflow = build_gptsovits_workflow(
                text, comfy_audio_name, language
            )
            save_node = "8"
        else:
            workflow = build_chatterbox_workflow(
                text, comfy_audio_name, emotion, seed
            )
            save_node = "3"

        async with httpx.AsyncClient(timeout=600.0) as client:
            res = await post_prompt(client, workflow)
            if res.status_code != 200:
                try:
                    err = res.json()
                except Exception:
                    err = {}
                return {
                    "success": False,
                    "error": err.get("error") or f"ComfyUI error {res.status_code}",
                }
            prompt_id = res.json().get("prompt_id")
            if not prompt_id:
                return {"success": False, "error": "No prompt_id"}

            max_attempts = get_failed_gen_clear_seconds()
            audio_info = None
            for _attempt in range(max_attempts):
                await asyncio.sleep(1)
                try:
                    history = (
                        await client.get(f"{get_comfyui_url()}/history/{prompt_id}")
                    ).json()
                    if prompt_id not in history:
                        continue
                    outputs = history[prompt_id].get("outputs", {})

                    save_out = outputs.get(save_node)
                    if isinstance(save_out, dict):
                        audio_val = save_out.get("audio")
                        info = _audio_output_info(audio_val)
                        if info:
                            audio_info = info
                        else:
                            for item in audio_val or []:
                                info = _audio_output_info(item)
                                if info:
                                    audio_info = info
                                    break

                    if not audio_info:
                        for out in outputs.values():
                            if not isinstance(out, dict):
                                continue
                            for key in ("audio", "images", "files"):
                                val = out.get(key)
                                info = _audio_output_info(val)
                                if info:
                                    audio_info = info
                                    break
                                for item in val or []:
                                    info = _audio_output_info(item)
                                    if info:
                                        audio_info = info
                                        break
                                if audio_info:
                                    break
                            if audio_info:
                                break

                    if audio_info:
                        break
                except Exception:
                    pass

            if not audio_info:
                return {"success": False, "error": "No audio output found"}

            params = {
                "filename": audio_info.get("filename"),
                "subfolder": audio_info.get("subfolder", ""),
                "type": "output",
            }
            response = await client.get(f"{get_comfyui_url()}/view", params=params)
            if response.status_code != 200:
                return {"success": False, "error": "Download failed"}

            ext = os.path.splitext(audio_info.get("filename", ""))[1] or ".wav"
            local_filename = f"{uuid.uuid4().hex}{ext}"
            os.makedirs(AUDIO_FOLDER, exist_ok=True)
            with open(os.path.join(AUDIO_FOLDER, local_filename), "wb") as f:
                f.write(response.content)

        duration = get_audio_duration(local_filename)

        metadata = {
            "tts": {
                "engine": engine,
                "voice_id": voice_id,
                "voice_name": filename,
                "language": language,
                "emotion": emotion,
                "instruction": instruction,
                "seed": seed,
            },
            "duration": duration,
        }

        asset_id = save_generation(
            prompt=text,
            filename=local_filename,
            file_type="audio",
            metadata=metadata,
        )

        if job_id:
            set_progress_job(job_id, 100)

        return {
            "success": True,
            "asset_id": asset_id,
            "filename": local_filename,
            "duration": duration,
            "engine": engine,
            "voice_id": voice_id,
            "name": text,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def save_voice_metadata(asset_id: str, data: dict) -> dict | None:
    """Persist voice-library metadata (transcript/language/engine) on an asset."""
    asset = get_asset_by_id(asset_id)
    if asset is None:
        return None

    meta = asset.get("metadata") or {}
    voice = meta.get("voice") if isinstance(meta.get("voice"), dict) else {}

    for key in ("transcript", "language", "engine"):
        if key in data:
            voice[key] = str(data[key] or "")

    meta["voice"] = voice
    update_generation(asset_id, {"metadata": meta})
    return voice
