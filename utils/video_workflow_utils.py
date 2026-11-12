import json
import copy
import math
import random
import os
import re

# Go up one level from utils/ to the project root, then into workflows/
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WORKFLOW_PATH = os.path.join(BASE_DIR, "..", "workflows", "ltx2_3_text_to_video.json")
I2V_WORKFLOW_PATH = os.path.join(BASE_DIR, "..", "workflows", "ltx2_3_image_to_video.json")


def load_base_video_workflow() -> dict:
    """Load the base LTX 2.3 text-to-video workflow"""
    with open(WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_video_workflow(
    workflow: dict, prompt: str, width: int, height: int, duration: int,
    disable_prompt_enhance: bool = False,
) -> dict:
    """
    Modify the LTX video workflow with user prompt, dimensions, duration and random seed.
    """
    wf = copy.deepcopy(workflow)

    # === Prompt ===
    if "267:266" in wf:
        wf["267:266"]["inputs"]["value"] = prompt
    if disable_prompt_enhance and "267:330" in wf:  # Switch: use the raw prompt
        wf["267:330"]["inputs"]["value"] = False

    # === Dimensions ===
    if "267:257" in wf:  # Width
        wf["267:257"]["inputs"]["value"] = width
    if "267:258" in wf:  # Height
        wf["267:258"]["inputs"]["value"] = height

    # === Duration (in seconds) ===
    if "267:225" in wf:
        wf["267:225"]["inputs"]["value"] = duration

    # === Randomize seeds every time ===
    for seed_node in ["267:216", "267:237"]:
        if seed_node in wf:
            wf[seed_node]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    return wf


def get_video_dimensions(resolution: str, aspect_ratio: str) -> tuple[int, int]:
    """Calculate width and height for video generation."""
    height_map = {
        "480p": 720,
        "720p": 720,
        "1080p": 1080,
        "1440p": 1440,
        "4K": 2160,
    }

    base_height = height_map.get(resolution, 720)

    aspect_map = {
        "3:2": (3, 2),
        "2:3": (2, 3),
        "16:9": (16, 9),
        "9:16": (9, 16),
        "1:1": (1, 1),
    }

    w_ratio, h_ratio = aspect_map.get(aspect_ratio, (16, 9))

    if aspect_ratio in ["3:2", "16:9"]:
        height = base_height
        width = int(base_height * (w_ratio / h_ratio))
    elif aspect_ratio in ["2:3", "9:16"]:
        width = base_height
        height = int(base_height * (h_ratio / w_ratio))
    else:
        width = base_height
        height = base_height

    if resolution in ("1440p", "4K"):
        width = max(64, ((width + 31) // 32) * 32)
        height = max(64, ((height + 31) // 32) * 32)
    else:
        width = max(512, (width // 64) * 64)
        height = max(512, (height // 64) * 64)

    return width, height


def get_ltx_recast_dimensions(resolution: str, aspect_ratio: str) -> tuple[int, int]:
    """Target dimensions for LTX recast.

    The union-control guide downsamples latents by a factor of two, so both
    axes must be even on the halved stage-1 latent grid. 128px alignment keeps
    that true while staying close to the requested aspect.
    """
    width, height = get_video_dimensions(resolution, aspect_ratio)
    width = max(128, int(round(width / 128.0)) * 128)
    height = max(128, int(round(height / 128.0)) * 128)
    return width, height


def load_base_image_to_video_workflow() -> dict:
    """Load the base LTX 2.3 image-to-video workflow"""
    with open(I2V_WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_image_to_video_workflow(
    workflow: dict, 
    prompt: str, 
    width: int, 
    height: int, 
    duration: int, 
    image_filename: str
) -> dict:
    """
    Modify the LTX image-to-video workflow.
    - Sets the source image (must be pre-uploaded to ComfyUI inputs)
    - Sets user prompt
    - Sets resolution (width/height)
    - Sets video duration (seconds)
    - Randomizes seeds
    """
    wf = copy.deepcopy(workflow)

    # === Source Image (uploaded filename for LoadImage node) ===
    if "269" in wf:
        wf["269"]["inputs"]["image"] = image_filename

    # === Prompt (the main prompt primitive) ===
    if "320:319" in wf:
        wf["320:319"]["inputs"]["value"] = prompt

    # === Dimensions ===
    if "320:312" in wf:  # Width
        wf["320:312"]["inputs"]["value"] = width
    if "320:299" in wf:  # Height
        wf["320:299"]["inputs"]["value"] = height

    # === Duration (in seconds) ===
    if "320:301" in wf:
        wf["320:301"]["inputs"]["value"] = duration

    # === Randomize seeds (two RandomNoise nodes) ===
    for seed_node in ["320:276", "320:277"]:
        if seed_node in wf:
            wf[seed_node]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    # === Ensure image-to-video mode (not switched to text-to-video) ===
    if "320:302" in wf:
        wf["320:302"]["inputs"]["value"] = False

    return wf


IA2V_WORKFLOW_PATH = os.path.join(BASE_DIR, "..", "workflows", "ltx2_3_image_audio_to_video.json")


def load_base_image_audio_to_video_workflow() -> dict:
    """Load the base LTX 2.3 image+audio-to-video workflow"""
    with open(IA2V_WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_image_audio_to_video_workflow(
    workflow: dict,
    prompt: str,
    width: int,
    height: int,
    duration: float,
    image_filename: str,
    audio_filename: str
) -> dict:
    """
    Modify the LTX image-audio-to-video workflow.
    - Sets the source image (269 LoadImage)
    - Sets the modifier audio (276 LoadAudio)
    - Sets user prompt (340:319)
    - Sets resolution (340:330 width, 340:324 height)
    - Sets duration (340:331)
    - Randomizes the two noise seeds (340:285, 340:286)
    """
    wf = copy.deepcopy(workflow)

    # === Source Image (uploaded filename for LoadImage node 269) ===
    if "269" in wf:
        wf["269"]["inputs"]["image"] = image_filename

    # === Modifier Audio (uploaded filename for LoadAudio node 276) ===
    if "276" in wf:
        wf["276"]["inputs"]["audio"] = audio_filename
        # audioUI is for UI preview in comfy; set a plausible value so it doesn't break
        if "audioUI" in wf["276"]["inputs"]:
            wf["276"]["inputs"]["audioUI"] = f"/api/view?filename={audio_filename}&type=input&subfolder=&rand={random.random()}"

    # === Prompt (the main prompt primitive) ===
    if "340:319" in wf:
        wf["340:319"]["inputs"]["value"] = prompt

    # === Dimensions ===
    if "340:330" in wf:  # Width
        wf["340:330"]["inputs"]["value"] = width
    if "340:324" in wf:  # Height
        wf["340:324"]["inputs"]["value"] = height

    # === Duration (in seconds) ===
    if "340:331" in wf:
        wf["340:331"]["inputs"]["value"] = float(duration)

    # === Randomize seeds (two RandomNoise nodes for ia2v) ===
    for seed_node in ["340:285", "340:286"]:
        if seed_node in wf:
            wf[seed_node]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    return wf


# ---------------------------------------------------------------------------
# LTX 2.5 workflows
# ---------------------------------------------------------------------------

LTX25_T2V_PATH = os.path.join(BASE_DIR, "..", "workflows", "ltx2_5_text_to_video.json")
LTX25_I2V_PATH = os.path.join(BASE_DIR, "..", "workflows", "ltx2_5_image_to_video.json")
LTX25_IA2V_PATH = os.path.join(BASE_DIR, "..", "workflows", "ltx2_5_image_audio_to_video.json")


def load_base_ltx25_text_to_video_workflow() -> dict:
    """Load the base LTX 2.5 text-to-video workflow."""
    with open(LTX25_T2V_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_ltx25_text_to_video_workflow(
    workflow: dict, prompt: str, width: int, height: int, duration: int
) -> dict:
    """Inject prompt, dimensions, duration and seeds into the LTX 2.5 T2V workflow.

    The 2.5 graph derives width/height from a ResolutionSelector node; we overwrite
    the linked PrimitiveInt values directly so our computed dimensions are used.
    """
    wf = copy.deepcopy(workflow)

    if "405:376" in wf:  # Prompt
        wf["405:376"]["inputs"]["value"] = prompt
    if "405:372" in wf:  # Width
        wf["405:372"]["inputs"]["value"] = int(width)
    if "405:360" in wf:  # Height
        wf["405:360"]["inputs"]["value"] = int(height)
    if "405:362" in wf:  # Duration (seconds)
        wf["405:362"]["inputs"]["value"] = int(duration)

    for seed_node in ["405:338", "405:339"]:
        if seed_node in wf:
            wf[seed_node]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    # Use our prompt verbatim (no built-in prompt enhancement)
    if "405:383" in wf:
        wf["405:383"]["inputs"]["value"] = False

    return wf


def load_base_ltx25_image_to_video_workflow() -> dict:
    """Load the base LTX 2.5 image-to-video workflow."""
    with open(LTX25_I2V_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_ltx25_image_to_video_workflow(
    workflow: dict,
    prompt: str,
    width: int,
    height: int,
    duration: int,
    image_filename: str,
) -> dict:
    """Inject image, prompt, dimensions, duration and seeds into the LTX 2.5 I2V workflow."""
    wf = copy.deepcopy(workflow)

    if "395" in wf:  # Load First Frame
        wf["395"]["inputs"]["image"] = image_filename
    if "398:376" in wf:  # Prompt
        wf["398:376"]["inputs"]["value"] = prompt
    if "398:372" in wf:  # Width
        wf["398:372"]["inputs"]["value"] = int(width)
    if "398:360" in wf:  # Height
        wf["398:360"]["inputs"]["value"] = int(height)
    if "398:362" in wf:  # Duration
        wf["398:362"]["inputs"]["value"] = int(duration)

    for seed_node in ["398:338", "398:339"]:
        if seed_node in wf:
            wf[seed_node]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    if "398:363" in wf:  # Switch to Text to Video? -> no
        wf["398:363"]["inputs"]["value"] = False
    if "398:383" in wf:  # Disable built-in prompt enhancement
        wf["398:383"]["inputs"]["value"] = False

    return wf


def load_base_ltx25_image_audio_to_video_workflow() -> dict:
    """Load the base LTX 2.5 image+audio-to-video workflow."""
    with open(LTX25_IA2V_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_ltx25_image_audio_to_video_workflow(
    workflow: dict,
    prompt: str,
    width: int,
    height: int,
    duration: float,
    image_filename: str,
    audio_filename: str,
) -> dict:
    """Inject image, audio, prompt, dimensions, duration and seeds into the LTX 2.5 IA2V workflow."""
    wf = copy.deepcopy(workflow)

    if "269" in wf:  # LoadImage
        wf["269"]["inputs"]["image"] = image_filename
    if "276" in wf:  # LoadAudio
        wf["276"]["inputs"]["audio"] = audio_filename
        if "audioUI" in wf["276"]["inputs"]:
            wf["276"]["inputs"]["audioUI"] = (
                f"/api/view?filename={audio_filename}&type=input&subfolder=&rand={random.random()}"
            )

    if "340_319" in wf:  # Prompt
        wf["340_319"]["inputs"]["value"] = prompt
    if "340_330" in wf:  # Width
        wf["340_330"]["inputs"]["value"] = int(width)
    if "340_324" in wf:  # Height
        wf["340_324"]["inputs"]["value"] = int(height)
    if "340_331" in wf:  # Duration (seconds)
        wf["340_331"]["inputs"]["value"] = float(duration)

    for seed_node in ["340_285", "340_286"]:
        if seed_node in wf:
            wf[seed_node]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    if "340_305" in wf:  # Switch to Text to Video? -> no
        wf["340_305"]["inputs"]["value"] = False
    if "340_349" in wf:  # Disable built-in prompt enhancement
        wf["340_349"]["inputs"]["value"] = False

    return wf


# ---------------------------------------------------------------------------
# FastH3 (MiniMax H3) workflows
# ---------------------------------------------------------------------------

FASTH3_T2V_PATH = os.path.join(BASE_DIR, "..", "workflows", "fasth3_text_to_video.json")
FASTH3_I2V_PATH = os.path.join(BASE_DIR, "..", "workflows", "fasth3_image_to_video.json")
FASTH3_REF_PATH = os.path.join(BASE_DIR, "..", "workflows", "fasth3_ominiref_image_audio_to_video.json")

# MiniMax H3 is trained for roughly 5-15s clips at 24fps.
FASTH3_MAX_DURATION = 15.0


def _clamp_fasth3_duration(duration) -> float:
    """Clamp a requested duration into FastH3's supported range."""
    try:
        d = float(duration)
    except (TypeError, ValueError):
        d = 5.0
    return max(1.0, min(d, FASTH3_MAX_DURATION))


def build_h3_reference_prompt(user_prompt: str, has_image: bool = True, has_audio: bool = True) -> str:
    """Ensure an H3 reference-to-video prompt addresses refs with <Picture i>/<Audio j> tags.

    MiniMax H3 uses 1-based per-type tags: <Picture 1> for images, <Audio 1> for audio.
    If the user's prompt already contains the required tags it is returned unchanged;
    otherwise a structured H3 prompt is built around the description. Audio is marked
    ``fully_copy`` so H3 reuses the supplied track 1:1 instead of improvising new words.
    """
    p = (user_prompt or "").strip()
    low = p.lower()
    need_pic = has_image and ("<picture" not in low)
    need_aud = has_audio and ("<audio" not in low)
    if not need_pic and not need_aud:
        return p

    lines = ["subject_definitions:"]
    if has_image:
        lines.append("<Subject 1> is the subject shown in <Picture 1>.")
    if has_audio:
        lines.append("<Audio 1> is the reference audio.")
    lines.append("")

    if has_audio:
        lines.append("summary:")
        if has_image:
            lines.append(
                "[reference generation + audio reuse] The target video features <Subject 1> from "
                "<Picture 1>, with <Audio 1> reused 1:1 as the complete final audio track."
            )
        else:
            lines.append("[audio reuse] <Audio 1> is reused 1:1 as the complete final audio track.")
        lines.append("")

    lines.append("retention_analysis:")
    if has_image:
        lines.append("<Subject 1> (appears in [Shot 1]): fully_preserved - the subject from <Picture 1> is retained.")
    if has_audio:
        lines.append("<Audio 1>: fully_copy - <Audio 1> is reused 1:1 as the target video's complete final audio track.")
    lines.append("")

    lines.append("detailed_description:")
    lines.append("[Shot 1] " + (p or "A cinematic shot."))
    return "\n".join(lines)


def load_base_fasth3_text_to_video_workflow() -> dict:
    """Load the base FastH3 text-to-video workflow."""
    with open(FASTH3_T2V_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_fasth3_text_to_video_workflow(
    workflow: dict, prompt: str, width: int, height: int, duration: float
) -> dict:
    """Inject prompt, dimensions, duration and seed into the FastH3 T2V workflow."""
    wf = copy.deepcopy(workflow)
    dur = _clamp_fasth3_duration(duration)

    node = wf.get("105:104")
    if node:
        node["inputs"]["prompt"] = prompt
        node["inputs"]["width"] = int(width)
        node["inputs"]["height"] = int(height)
    if "105:111" in wf:  # Float (duration)
        wf["105:111"]["inputs"]["value"] = float(dur)
    if "105:15" in wf:  # RandomNoise
        wf["105:15"]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    return wf


def load_base_fasth3_image_to_video_workflow() -> dict:
    """Load the base FastH3 image-to-video workflow."""
    with open(FASTH3_I2V_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_fasth3_image_to_video_workflow(
    workflow: dict, prompt: str, width: int, height: int, duration: float, image_filename: str
) -> dict:
    """Inject image, prompt, dimensions, duration and seed into the FastH3 I2V workflow."""
    wf = copy.deepcopy(workflow)
    dur = _clamp_fasth3_duration(duration)

    if "136" in wf:  # LoadImage
        wf["136"]["inputs"]["image"] = image_filename
    node = wf.get("105:104")
    if node:
        node["inputs"]["prompt"] = prompt
        node["inputs"]["width"] = int(width)
        node["inputs"]["height"] = int(height)
    if "105:111" in wf:
        wf["105:111"]["inputs"]["value"] = float(dur)
    if "105:15" in wf:
        wf["105:15"]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    return wf


def load_base_fasth3_image_audio_guide_workflow() -> dict:
    """Load FastH3 I2V and add an audio guide anchored at frame 0."""
    wf = load_base_fasth3_image_to_video_workflow()
    wf["900"] = {
        "inputs": {"audio": ""},
        "class_type": "LoadAudio",
        "_meta": {"title": "Load Audio"},
    }
    wf["901"] = {
        "inputs": {
            "positive": ["105:104", 0],
            "latent": ["105:104", 1],
            "frame_idx": 0,
            "audio_vae": ["105:24", 0],
            "audio": ["900", 0],
        },
        "class_type": "MiniMaxH3AddGuide",
        "_meta": {"title": "Add Guide for MiniMax H3"},
    }
    if "105:16" in wf:
        wf["105:16"]["inputs"]["conditioning"] = ["901", 0]
    return wf


def modify_fasth3_image_audio_guide_workflow(
    workflow: dict,
    prompt: str,
    width: int,
    height: int,
    duration: float,
    image_filename: str,
    audio_filename: str,
) -> dict:
    """Inject first-frame image and audio guide into the FastH3 workflow."""
    wf = modify_fasth3_image_to_video_workflow(
        workflow, prompt, width, height, duration, image_filename
    )
    wf["900"]["inputs"]["audio"] = audio_filename
    return wf


def load_base_fasth3_reference_image_audio_to_video_workflow() -> dict:
    """Load the base FastH3 OmniRef image+audio-to-video workflow."""
    with open(FASTH3_REF_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_fasth3_reference_image_audio_to_video_workflow(
    workflow: dict,
    prompt: str,
    width: int,
    height: int,
    duration: float,
    image_filename: str,
    audio_filename: str,
) -> dict:
    """Inject refs, prompt (with H3 tags), dimensions, duration and seed into OmniRef."""
    wf = copy.deepcopy(workflow)
    dur = _clamp_fasth3_duration(duration)
    ref_prompt = build_h3_reference_prompt(
        prompt,
        has_image=bool(image_filename),
        has_audio=bool(audio_filename),
    )

    if "138" in wf:  # Input Text (Prompt)
        wf["138"]["inputs"]["value"] = ref_prompt
    if "137" in wf:  # LoadImage -> ref_image_0
        wf["137"]["inputs"]["image"] = image_filename
    if "149" in wf:  # LoadAudio -> ref_audio_0
        wf["149"]["inputs"]["audio"] = audio_filename

    node = wf.get("136")  # MiniMaxH3ReferenceToVideo
    if node:
        node["inputs"]["width"] = int(width)
        node["inputs"]["height"] = int(height)
        node["inputs"]["ref_image_size"] = "max"  # best facial/hair identity fidelity
    if "132" in wf:  # Float (Duration)
        wf["132"]["inputs"]["value"] = float(dur)
    if "129" in wf:  # RandomNoise
        wf["129"]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    return wf


# ---------------------------------------------------------------------------
# LTX 2.3 / 2.5 recast workflows (experimental)
#
# Recast adds the source video as an IC-LoRA video guide and uses the starting
# image as an identity/first-frame guide. The source *performance* drives the
# motion while the starting image supplies the subject identity. LTX versions
# are kept separate because their graphs and node IDs differ.
# ---------------------------------------------------------------------------

LTX_RECAST_FPS = 24.0
LTX_RECAST_UNION_LORA = "ltx-2.3-22b-ic-lora-union-control-ref0.5.safetensors"
LTX_RECAST_SOURCE_CONTROLS = ("raw", "canny", "pose", "depth")
LTX_RECAST_DEFAULT_SAMPLERS = {
    "ltx23": "euler_ancestral_cfg_pp",
    "ltx25": "euler_ancestral",
}
LTX_RECAST_NEGATIVE = "pc game, console game, video game, cartoon, childish, ugly"


def _ltx_recast_guide_node(
    positive,
    negative,
    vae,
    latent,
    image,
    frame_idx: int,
    strength: float,
    downscale,
    attention_strength: float = 1.0,
    crop: str = "center",
) -> dict:
    """Build an advanced IC-LoRA guide node with attention/strength controls."""
    return {
        "class_type": "LTXAddVideoICLoRAGuideAdvanced",
        "inputs": {
            "positive": positive,
            "negative": negative,
            "vae": vae,
            "latent": latent,
            "image": image,
            "frame_idx": int(frame_idx),
            "strength": max(0.0, min(1.0, float(strength))),
            "latent_downscale_factor": downscale,
            "crop": crop,
            "use_tiled_encode": False,
            "tile_size": 256,
            "tile_overlap": 64,
            "attention_strength": max(0.0, min(1.0, float(attention_strength))),
        },
        "_meta": {"title": "IC-LoRA Guide"},
    }


def _ltx_recast_start_frame_idx(start_image_mode: str | None) -> int:
    """Frame index for the starting-image guide.

    Identity-only mode uses the out-of-range (-1) position so the image
    conditions identity/attention without forcing the generated first frame.
    """
    mode = (start_image_mode or "first_frame_identity").strip().lower()
    return -1 if mode == "identity" else 0


def _add_ltx_recast_union_lora(wf: dict, model_ref) -> tuple[list, list]:
    """Apply the installed union-control IC-LoRA and expose its downscale factor."""
    wf["recast_union_lora"] = {
        "class_type": "LTXICLoRALoaderModelOnly",
        "inputs": {
            "model": model_ref,
            "lora_name": LTX_RECAST_UNION_LORA,
            "strength_model": 1.0,
        },
        "_meta": {"title": "LTX Union Control IC-LoRA"},
    }
    return ["recast_union_lora", 0], ["recast_union_lora", 1]


def _add_ltx_recast_control_image(
    wf: dict,
    source_image_ref,
    width: int,
    height: int,
    source_control: str,
) -> list:
    """Turn source frames into a Canny/Pose/Depth control video for the union LoRA."""
    control = (source_control or "raw").strip().lower()
    if control == "raw":
        return source_image_ref

    wf["recast_control_resize"] = {
        "class_type": "ResizeImageMaskNode",
        "inputs": {
            "input": source_image_ref,
            "resize_type": "scale dimensions",
            "resize_type.width": int(width),
            "resize_type.height": int(height),
            "resize_type.crop": "center",
            "scale_method": "lanczos",
        },
        "_meta": {"title": "Resize Source Control"},
    }
    resized_ref = ["recast_control_resize", 0]
    if control == "canny":
        wf["recast_control_preprocess"] = {
            "class_type": "CannyEdgePreprocessor",
            "inputs": {
                "image": resized_ref,
                "low_threshold": 100,
                "high_threshold": 200,
                "resolution": 512,
            },
            "_meta": {"title": "Canny Control"},
        }
    elif control == "pose":
        wf["recast_control_preprocess"] = {
            "class_type": "OpenposePreprocessor",
            "inputs": {
                "image": resized_ref,
                "detect_hand": "enable",
                "detect_body": "enable",
                "detect_face": "enable",
                "resolution": 512,
                "scale_stick_for_xinsr_cn": "disable",
            },
            "_meta": {"title": "Pose Control"},
        }
    else:
        wf["recast_control_preprocess"] = {
            "class_type": "DepthAnythingV2Preprocessor",
            "inputs": {
                "image": resized_ref,
                "ckpt_name": "depth_anything_v2_vitl.pth",
                "resolution": 512,
            },
            "_meta": {"title": "Depth Control"},
        }
    return ["recast_control_preprocess", 0]


def _add_ltx_recast_audio(
    wf: dict,
    positive_ref,
    negative_ref,
    audio_vae_ref,
    audio_filename: str,
) -> tuple[list, list, list]:
    """Add frozen source-audio conditioning using the stock LTX V2V pattern."""
    wf["recast_audio_load"] = {
        "class_type": "LoadAudio",
        "inputs": {"audio": audio_filename},
        "_meta": {"title": "Recast Source Audio"},
    }
    wf["recast_audio_encode"] = {
        "class_type": "VAEEncodeAudio",
        "inputs": {
            "audio": ["recast_audio_load", 0],
            "vae": audio_vae_ref,
        },
        "_meta": {"title": "Encode Recast Audio"},
    }
    wf["recast_audio_ref"] = {
        "class_type": "LTXVSetAudioRefTokens",
        "inputs": {
            "positive": positive_ref,
            "negative": negative_ref,
            "audio_latent": ["recast_audio_encode", 0],
        },
        "_meta": {"title": "Recast Audio Reference"},
    }
    return ["recast_audio_ref", 0], ["recast_audio_ref", 1], ["recast_audio_ref", 2]


def _add_extra_ltx_recast_guides(
    wf: dict,
    chain_end: str,
    vae_ref,
    extra_image_filenames: list | None,
    downscale,
    ref_image_strength: float = 0.8,
) -> str:
    """Chain additional identity reference images at frame -1, returning the new tail."""
    chain = chain_end
    for index, image_name in enumerate((extra_image_filenames or [])[:5]):
        image_node = f"recast_ref_img_{index}"
        guide_node = f"recast_ref_guide_{index}"
        wf[image_node] = {
            "class_type": "LoadImage",
            "inputs": {"image": image_name},
            "_meta": {"title": f"Recast Reference Image {index + 2}"},
        }
        wf[guide_node] = _ltx_recast_guide_node(
            [chain, 0], [chain, 1], vae_ref, [chain, 2],
            [image_node, 0], -1, ref_image_strength, downscale,
            attention_strength=1.0,
        )
        chain = guide_node
    return chain


def _configure_ltx_recast(
    wf: dict,
    version: str,
    prompt: str,
    width: int,
    height: int,
    duration: float,
    source_video_filename: str,
    image_filename: str,
    start_image_mode: str | None = None,
    guide_strength: float = 0.5,
    extra_image_filenames: list | None = None,
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
    """Build the LTX 2.3/2.5 recast graph with union control and identity guides."""
    if version == "ltx25":
        model_ref = ["398:384", 0]
        vae_ref = ["398:385", 0]
        audio_vae_ref = ["398:386", 0]
        prompt_id = "398:376"
        width_id, height_id = "398:372", "398:360"
        duration_id, fps_id = "398:362", "398:361"
        seed_ids = ["398:338", "398:339"]
        sampler_ids = ["398:352", "398:341"]
        prompt_enhance_id = "398:383"
        negative_id = "398:373"
        base_positive = ["398:365", 0]
        base_negative = ["398:365", 1]
        source_latent = ["398:357", 0]
        start_image_node = "395"
        start_image_ref = [start_image_node, 0]
        source_guide_positive = base_positive
        source_guide_negative = base_negative
        stage1_concat = "398:377"
        stage2_concat = "398:340"
        crop_node = "504"
        stage_guider = "398:388"
        stage2_guider = "398:391"
        stage1_guide_tail = "503"
        stage2_guide_tail = "504"
        output_latent = "398:348"
    else:
        model_ref = ["320:285", 0]
        vae_ref = ["320:316", 2]
        audio_vae_ref = ["320:279", 0]
        prompt_id = "320:319"
        width_id, height_id = "320:312", "320:299"
        duration_id, fps_id = "320:301", "320:300"
        seed_ids = ["320:276", "320:277"]
        sampler_ids = ["320:280", "320:291"]
        prompt_enhance_id = "320:328"
        negative_id = "320:313"
        base_positive = ["320:304", 0]
        base_negative = ["320:304", 1]
        source_latent = ["320:296", 0]
        start_image_node = "269"
        start_image_ref = [start_image_node, 0]
        source_guide_positive = base_positive
        source_guide_negative = base_negative
        stage1_concat = "320:318"
        stage2_concat = "320:278"
        crop_node = "320:284"
        stage_guider = "320:314"
        stage2_guider = "320:282"
        stage1_guide_tail = "503"
        stage2_guide_tail = "320:284"
        output_latent = "320:287"

    source_control = (source_control or "canny").strip().lower()
    if source_control not in LTX_RECAST_SOURCE_CONTROLS:
        source_control = "canny"

    wf["500"] = {
        "class_type": "LoadVideo",
        "inputs": {"file": source_video_filename},
        "_meta": {"title": "Source Video"},
    }
    wf["501"] = {
        "class_type": "GetVideoComponents",
        "inputs": {"video": ["500", 0]},
        "_meta": {"title": "Source Video Components"},
    }
    if start_image_node not in wf:
        raise ValueError(f"LTX {version} recast graph is missing its starting-image node ({start_image_node}).")
    if not image_filename:
        raise ValueError("LTX recast requires an uploaded starting image.")
    wf[start_image_node]["inputs"]["image"] = image_filename

    downscale = 1.0
    model_out = model_ref
    if source_control != "raw":
        model_out, downscale = _add_ltx_recast_union_lora(wf, model_ref)

    control_image = _add_ltx_recast_control_image(
        wf, ["501", 0], width, height, source_control
    )

    if audio_filename:
        source_guide_positive, source_guide_negative, audio_latent = _add_ltx_recast_audio(
            wf, base_positive, base_negative, audio_vae_ref, audio_filename
        )
    else:
        audio_latent = None

    wf["502"] = _ltx_recast_guide_node(
        source_guide_positive,
        source_guide_negative,
        vae_ref,
        source_latent,
        control_image,
        0,
        guide_strength,
        downscale,
        attention_strength=control_attention_strength,
    )
    wf["502"]["_meta"] = {"title": "Source Motion / Control Guide"}

    wf["503"] = _ltx_recast_guide_node(
        ["502", 0], ["502", 1], vae_ref, ["502", 2],
        start_image_ref, _ltx_recast_start_frame_idx(start_image_mode),
        start_image_strength, downscale,
        attention_strength=1.0,
    )
    wf["503"]["_meta"] = {"title": "Starting Identity Guide"}
    identity_tail = stage1_guide_tail
    mode = (start_image_mode or "first_frame_identity").strip().lower()
    if mode == "first_frame_identity":
        wf["503_identity"] = _ltx_recast_guide_node(
            ["503", 0], ["503", 1], vae_ref, ["503", 2],
            start_image_ref, -1, start_image_strength, downscale,
            attention_strength=1.0,
        )
        wf["503_identity"]["_meta"] = {"title": "Starting Identity Guide"}
        identity_tail = "503_identity"

    chain = _add_extra_ltx_recast_guides(
        wf, identity_tail, vae_ref, extra_image_filenames,
        downscale, ref_image_strength,
    )

    if version == "ltx25":
        wf["504"] = {
            "class_type": "LTXVCropGuides",
            "inputs": {
                "positive": [chain, 0],
                "negative": [chain, 1],
                "latent": ["398:367", 0],
            },
            "_meta": {"title": "Crop Recast Guides"},
        }
        wf["504"]["inputs"]["positive"] = [chain, 0]
        wf["504"]["inputs"]["negative"] = [chain, 1]
        wf["504"]["inputs"]["latent"] = ["398:367", 0]
        wf["398:388"]["inputs"]["model"] = model_out
        wf["398:391"]["inputs"]["model"] = model_out
        wf["398:388"]["inputs"]["positive"] = [chain, 0]
        wf["398:388"]["inputs"]["negative"] = [chain, 1]
        wf["398:377"]["inputs"]["video_latent"] = [chain, 2]
        wf["398:391"]["inputs"]["positive"] = ["504", 0]
        wf["398:391"]["inputs"]["negative"] = ["504", 1]
        wf["398:348"]["inputs"]["samples"] = ["504", 2]
        if audio_latent:
            wf[stage1_concat]["inputs"]["audio_latent"] = audio_latent
    else:
        wf["320:314"]["inputs"]["model"] = model_out
        wf["320:282"]["inputs"]["model"] = model_out
        wf["320:314"]["inputs"]["positive"] = [chain, 0]
        wf["320:314"]["inputs"]["negative"] = [chain, 1]
        wf["320:318"]["inputs"]["video_latent"] = [chain, 2]
        wf["320:284"]["inputs"]["positive"] = [chain, 0]
        wf["320:284"]["inputs"]["negative"] = [chain, 1]
        wf["320:284"]["inputs"]["latent"] = ["320:307", 0]
        wf["320:287"]["inputs"]["samples"] = ["320:284", 2]
        if audio_latent:
            wf[stage1_concat]["inputs"]["audio_latent"] = audio_latent

    if prompt_id in wf:
        wf[prompt_id]["inputs"]["value"] = prompt
    if width_id in wf:
        wf[width_id]["inputs"]["value"] = int(width)
    if height_id in wf:
        wf[height_id]["inputs"]["value"] = int(height)
    if duration_id in wf:
        # LTX duration is an integer frame window. Round up so fractional
        # source lengths never produce a guide batch longer than the latent.
        wf[duration_id]["inputs"]["value"] = max(1, int(math.ceil(float(duration))))
    if fps_id in wf:
        wf[fps_id]["inputs"]["value"] = int(LTX_RECAST_FPS)
    if negative_id in wf:
        wf[negative_id]["inputs"]["text"] = negative_prompt.strip() or LTX_RECAST_NEGATIVE
    if prompt_enhance_id in wf:
        wf[prompt_enhance_id]["inputs"]["value"] = bool(prompt_enhance)

    chosen_seed = random.randint(0, 2**32 - 1) if seed is None else int(seed)
    for seed_node in seed_ids:
        if seed_node in wf:
            wf[seed_node]["inputs"]["noise_seed"] = chosen_seed

    chosen_sampler = sampler_name.strip().lower() if sampler_name else ""
    if not chosen_sampler:
        chosen_sampler = LTX_RECAST_DEFAULT_SAMPLERS["ltx25" if version == "ltx25" else "ltx23"]
    for sampler_id in sampler_ids:
        if sampler_id in wf:
            wf[sampler_id]["inputs"]["sampler_name"] = chosen_sampler

    if "75" in wf:
        wf["75"]["inputs"]["filename_prefix"] = (
            "video/LTX_2.5_recast" if version == "ltx25" else "video/LTX_2.3_recast"
        )
    return wf


def load_base_ltx23_recast_workflow() -> dict:
    """Load the LTX 2.3 I2V base graph used by recast."""
    return load_base_image_to_video_workflow()


def load_base_ltx25_recast_workflow() -> dict:
    """Load the LTX 2.5 I2V base graph used by recast."""
    return load_base_ltx25_image_to_video_workflow()


def modify_ltx23_recast_workflow(
    workflow: dict,
    prompt: str,
    width: int,
    height: int,
    duration: float,
    source_video_filename: str,
    image_filename: str,
    start_image_mode: str | None = None,
    guide_strength: float = 0.5,
    extra_image_filenames: list | None = None,
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
    """Inject recast references, control, prompt, dimensions and seeds into LTX 2.3."""
    wf = copy.deepcopy(workflow)
    return _configure_ltx_recast(
        wf, "ltx23", prompt, width, height, duration, source_video_filename,
        image_filename, start_image_mode=start_image_mode,
        guide_strength=guide_strength, extra_image_filenames=extra_image_filenames,
        source_control=source_control,
        control_attention_strength=control_attention_strength,
        start_image_strength=start_image_strength,
        ref_image_strength=ref_image_strength,
        seed=seed, negative_prompt=negative_prompt,
        prompt_enhance=prompt_enhance, sampler_name=sampler_name,
        audio_filename=audio_filename,
    )


def modify_ltx25_recast_workflow(
    workflow: dict,
    prompt: str,
    width: int,
    height: int,
    duration: float,
    source_video_filename: str,
    image_filename: str,
    start_image_mode: str | None = None,
    guide_strength: float = 0.5,
    extra_image_filenames: list | None = None,
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
    """Inject recast references, control, prompt, dimensions and seeds into LTX 2.5."""
    wf = copy.deepcopy(workflow)
    return _configure_ltx_recast(
        wf, "ltx25", prompt, width, height, duration, source_video_filename,
        image_filename, start_image_mode=start_image_mode,
        guide_strength=guide_strength, extra_image_filenames=extra_image_filenames,
        source_control=source_control,
        control_attention_strength=control_attention_strength,
        start_image_strength=start_image_strength,
        ref_image_strength=ref_image_strength,
        seed=seed, negative_prompt=negative_prompt,
        prompt_enhance=prompt_enhance, sampler_name=sampler_name,
        audio_filename=audio_filename,
    )


# FastH3 multi-reference workflow (separate from the single-ref OmniRef used by Music Video)
# ---------------------------------------------------------------------------

FASTH3_MULTI_REF_PATH = os.path.join(BASE_DIR, "..", "workflows", "fasth3_multi_image_audio_to_video.json")


def load_base_fasth3_multi_ref_workflow() -> dict:
    """Load the base FastH3 multi-image/audio reference workflow."""
    with open(FASTH3_MULTI_REF_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def parse_h3_script(text: str):
    """Split a prompt into scene text and S#: dialogue segments.

    Finds ``S1:``/``S2:``/``S3:`` tokens anywhere in the text (inline or on
    their own lines). Everything before the first token is the scene text;
    each token's text runs until the next token.

    Returns (scene_text, [(speaker_number, line), ...]).
    """
    raw = text or ""
    pattern = re.compile(r"(?i)(?:^|\s)S(\d+)\s*:\s*")
    matches = list(pattern.finditer(raw))
    if not matches:
        return raw.strip(), []

    scene = raw[:matches[0].start()].strip()
    dialogue = []
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        line = raw[start:end].strip()
        if line:
            dialogue.append((int(m.group(1)), line))
    return scene, dialogue


_H3_PICTURE_REF_RE = re.compile(r"(?i)(?<![\w<])(?:image|picture)\s*#?\s*(\d+)\b")


def _normalize_h3_picture_refs(text: str) -> str:
    """Rewrite textual image references (image 1, picture #2) to <Picture N>."""
    return _H3_PICTURE_REF_RE.sub(lambda m: f"<Picture {m.group(1)}>", text or "")


def _h3_subject_phrase(role: str, label: str, picture: int) -> str:
    pic = f"<Picture {picture}>"
    role = (role or "").strip().lower()
    label = (label or "").strip()
    if role == "background":
        return f"the {label} shown in {pic}" if label else f"the background stage shown in {pic}"
    if role == "prop":
        return f"the {label} shown in {pic}" if label else f"the prop shown in {pic}"
    if role == "reference":
        return f"the {label} shown in {pic}" if label else f"the reference shown in {pic}"
    if label:
        return f"the {label} shown in {pic}"
    return f"the subject shown in {pic}"


_H3_RECAST_PRESERVE_ORDER = ("motion", "camera", "background", "lighting", "composition")


def _h3_recast_preserve_phrase(preserve: list | None) -> str:
    """Return a natural-language list of preserved qualities for recast."""
    chosen = {str(item).strip().lower() for item in (preserve or []) if str(item).strip()}
    ordered = [item for item in _H3_RECAST_PRESERVE_ORDER if item in chosen]
    if not ordered:
        ordered = list(_H3_RECAST_PRESERVE_ORDER)
    if len(ordered) == 1:
        return ordered[0]
    return ", ".join(ordered[:-1]) + " and " + ordered[-1]


def _build_h3_recast_prompt(
    user_prompt: str,
    image_count: int,
    audio_count: int,
    image_roles: list | None,
    image_labels: list | None,
    video_count: int,
    recast_preserve: list | None,
    start_image_mode: str | None,
) -> str:
    """Build a recast-specific H3 prompt.

    Recast treats the source video as a performance/motion reference and
    replaces its subject with the supplied starting character. It must not use
    follow-on/continuity wording or ask the first frame to match the source's
    final frame.
    """
    p = (user_prompt or "").strip()
    if "subject_definitions:" in p.lower():
        return p

    mode = (start_image_mode or "first_frame_identity").strip().lower()
    has_first_frame = mode in ("first_frame_identity", "first_frame")
    has_identity = mode in ("first_frame_identity", "identity")

    image_count = max(0, min(int(image_count or 0), 6))
    audio_count = max(0, min(int(audio_count or 0), 3))
    video_count = 1 if video_count else 0
    roles = list(image_roles or [])
    labels = list(image_labels or [])
    scene, dialogue = parse_h3_script(p)
    scene = _normalize_h3_picture_refs(scene)
    preserve = _h3_recast_preserve_phrase(recast_preserve)

    lines = ["subject_definitions:"]
    for i in range(1, image_count + 1):
        role = roles[i - 1] if i - 1 < len(roles) else ""
        label = labels[i - 1] if i - 1 < len(labels) else ""
        if role.strip().lower() == "character":
            phrase = f"the {label}" if label else "the replacement character"
            lines.append(f"<Subject {i}> is {phrase} shown in <Picture {i}>.")
        else:
            lines.append(f"<Subject {i}> is {_h3_subject_phrase(role, label, i)}.")
    for j in range(1, audio_count + 1):
        lines.append(f"<Audio {j}> is the source performance audio reference.")
    for k in range(1, video_count + 1):
        lines.append(
            f"<Video {k}> is the source performance reference. It defines performance, "
            f"motion, camera, timing and blocking, not the target subject's identity."
        )
    lines.append("")

    lines.append("summary:")
    lines.append(
        "[recast] Replace the main subject of <Video 1> with the starting character. "
        "Use <Video 1> as the source performance, motion, camera, timing and blocking "
        "reference. Preserve: " + preserve + ". "
        "Do not copy the source subject's identity or clothing."
    )
    if audio_count:
        lines.append(
            "Use <Audio 1> as the source performance audio reference for timing and "
            "performance, without copying unrelated identity."
        )
    lines.append("")

    lines.append("retention_analysis:")
    if image_count:
        subject = "<Subject 1>" if has_identity else "The starting character"
        lines.append(
            f"{subject}: fully_preserved - the replacement character identity comes from "
            f"the starting image/reference, never from <Video 1>."
        )
    else:
        lines.append(
            "The starting character: fully_preserved - identity comes from the starting "
            "image, never from <Video 1>."
        )
    if video_count:
        lines.append(
            "<Video 1>: reference - preserve the source performance, motion, camera "
            "movement, timing and character blocking. Do not copy the source subject's "
            "identity, face, hair or clothing."
        )
    for j in range(1, audio_count + 1):
        lines.append(
            f"<Audio {j}>: reference - source performance audio; follow its timing and "
            f"performance without copying unrelated identity."
        )
    lines.append("")

    lines.append("detailed_description:")
    first_frame = (
        "The first generated frame must match the starting image, not the final frame of <Video 1>. "
        if has_first_frame else
        "Do not copy the final frame of <Video 1>; the target video starts from its own composition. "
    )
    replacement = (
        "<Subject 1> from <Picture 1>" if has_identity and image_count else "the starting character"
    )
    lines.append(
        "[Shot 1] Use <Video 1> as the source performance/motion/camera/time/blocking "
        f"reference. Preserve {preserve}. Replace the main subject with {replacement}. "
        "Do not copy the source subject's identity or clothing. "
        + first_frame
        + (scene or "A cinematic recast shot.")
    )
    for speaker, text in dialogue:
        if speaker < 1:
            continue
        text = _normalize_h3_picture_refs(text)
        if image_count and speaker <= image_count:
            lines.append(f"<Subject {speaker}> (S{speaker}) says, <d>[English] {text}</d>")
        else:
            lines.append(f"A voice (S{speaker}) says, <d>[English] {text}</d>")

    return "\n".join(lines)


def build_h3_multi_ref_prompt(
    user_prompt: str,
    image_count: int,
    audio_count: int,
    image_roles: list | None = None,
    image_labels: list | None = None,
    audio_mode: str = "voice",
    video_count: int = 0,
    video_reference_mode: str = "continuity",
    recast_preserve: list | None = None,
    start_image_mode: str | None = None,
) -> str:
    """Build a structured H3 reference prompt for multiple images/audio refs.

    Images map to <Picture i> and <Subject i>. In ``voice`` mode audio maps to
    <Audio j> and is bound to the same-numbered subject as its voice-timbre
    reference. In ``music`` mode audio is the song/performance track that drives
    movement and lip-sync instead of a subject's timbre.
    Lines written as ``S1: ...`` become ``<d>[English] ...</d>`` dialogue.
    Optional roles/labels make subject definitions role-aware. When
    ``video_count`` is set a <Video 1> motion-continuity reference is added,
    unless ``video_reference_mode`` is ``recast``.
    """
    if (video_reference_mode or "").strip().lower() == "recast":
        return _build_h3_recast_prompt(
            user_prompt,
            image_count,
            audio_count,
            image_roles,
            image_labels,
            video_count,
            recast_preserve,
            start_image_mode,
        )

    p = (user_prompt or "").strip()
    if "subject_definitions:" in p.lower():
        return p

    audio_mode = (audio_mode or "voice").strip().lower()
    is_music = audio_mode == "music"

    image_count = max(0, min(int(image_count or 0), 6))
    audio_count = max(0, min(int(audio_count or 0), 3))
    video_count = max(0, min(int(video_count or 0), 1))
    roles = list(image_roles or [])
    labels = list(image_labels or [])
    scene, dialogue = parse_h3_script(p)
    scene = _normalize_h3_picture_refs(scene)

    lines = ["subject_definitions:"]
    for i in range(1, image_count + 1):
        role = roles[i - 1] if i - 1 < len(roles) else ""
        label = labels[i - 1] if i - 1 < len(labels) else ""
        lines.append(f"<Subject {i}> is {_h3_subject_phrase(role, label, i)}.")
    for j in range(1, audio_count + 1):
        if is_music:
            lines.append(f"<Audio {j}> is the song/performance audio reference.")
        elif j <= image_count:
            lines.append(f"<Audio {j}> is the voice-timbre reference for <Subject {j}> (S{j}).")
        else:
            lines.append(f"<Audio {j}> is a standalone reference audio.")
    for k in range(1, video_count + 1):
        lines.append(
            f"<Video {k}> is the immediately preceding clip / motion-continuity reference. "
            f"The new target video starts after <Video {k}>."
        )
    lines.append("")

    subj_tags = ", ".join(f"<Subject {i}> (S{i})" for i in range(1, image_count + 1))
    audio_tags = ", ".join(f"<Audio {j}>" for j in range(1, audio_count + 1))
    video_tags = ", ".join(f"<Video {k}>" for k in range(1, video_count + 1))

    lines.append("summary:")
    if audio_count and image_count:
        audio_desc = (
            "song/performance audio references" if is_music
            else "voice-timbre references"
        )
        lines.append(
            f"[reference generation + audio reference] The target video features {subj_tags}, "
            f"with {audio_tags} used as {audio_desc}."
        )
    elif audio_count:
        lines.append(f"[audio reference] The target video uses {audio_tags} as audio references.")
    elif image_count:
        lines.append(f"[reference generation] The target video features {subj_tags} from the attached reference images.")
    else:
        lines.append("[reference generation] The target video is generated from the prompt.")
    if video_count:
        lines.append(
            f"[continuity] {video_tags} is the immediately preceding clip used as a "
            f"motion-continuity reference; the target video starts after it."
        )
    lines.append("")

    lines.append("retention_analysis:")
    for i in range(1, image_count + 1):
        lines.append(
            f"<Subject {i}> (appears in [Shot 1]): fully_preserved - the subject from <Picture {i}> is retained."
        )
    for j in range(1, audio_count + 1):
        if is_music:
            lines.append(
                f"<Audio {j}>: reference - the performance, movement and lip-sync should follow "
                f"<Audio {j}> (song audio) without copying the original signal."
            )
        elif j <= image_count:
            lines.append(
                f"<Audio {j}>: reference - <Subject {j}> (S{j}) follows <Audio {j}>'s voice timbre "
                f"without copying the original signal."
            )
        else:
            lines.append(f"<Audio {j}>: reference - <Audio {j}> is used as an audio reference.")
    for k in range(1, video_count + 1):
        lines.append(
            f"<Video {k}>: reference - motion, camera movement and character blocking are preserved; "
            f"the first generated frame must match the final frame of <Video {k}>."
        )
    lines.append("")

    lines.append("detailed_description:")
    shot1_prefix = ""
    if video_count:
        shot1_prefix = (
            "Continue directly from <Video 1> without a new shot cut: preserve motion, "
            "camera movement and character blocking, and the first generated frame must "
            "match the final frame of <Video 1>. "
        )
    lines.append("[Shot 1] " + shot1_prefix + (scene or "A cinematic shot."))
    for speaker, text in dialogue:
        if speaker < 1:
            continue
        text = _normalize_h3_picture_refs(text)
        if image_count and speaker <= image_count:
            lines.append(f"<Subject {speaker}> (S{speaker}) says, <d>[English] {text}</d>")
        else:
            lines.append(f"A voice (S{speaker}) says, <d>[English] {text}</d>")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# RelayVSR X2 post-upscaling workflow
# ---------------------------------------------------------------------------

RELAYVSR_WORKFLOW_PATH = os.path.join(BASE_DIR, "..", "workflows", "relayvsr_x2.json")


def load_base_relayvsr_workflow() -> dict:
    """Load the base RelayVSR X2 video-upscaling workflow."""
    with open(RELAYVSR_WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_relayvsr_workflow(
    workflow: dict,
    filename: str,
    detail: float = 1.0,
    seed: int = 0,
    model: str | None = None,
    vae: str | None = None,
) -> dict:
    """Inject the source video, decoder detail, seed and optional model/VAE names.

    The graph is fixed: LoadVideo -> GetVideoComponents -> RelayVSRConditioning ->
    KSampler -> VSRDecode -> CreateVideo -> SaveVideo.
    """
    wf = copy.deepcopy(workflow)

    if "1" in wf:  # LoadVideo
        wf["1"]["inputs"]["file"] = filename
    if "7" in wf:  # VSRDecode
        try:
            d = float(detail)
        except (TypeError, ValueError):
            d = 1.0
        wf["7"]["inputs"]["detail"] = max(0.0, min(1.0, d))
    if "5" in wf:  # KSampler
        try:
            wf["5"]["inputs"]["seed"] = int(seed)
        except (TypeError, ValueError):
            wf["5"]["inputs"]["seed"] = 0
    if model and "3" in wf:  # UNETLoader
        wf["3"]["inputs"]["unet_name"] = model
    if vae and "6" in wf:  # VAELoader
        wf["6"]["inputs"]["vae_name"] = vae

    return wf


# ---------------------------------------------------------------------------
# ReCaVSR X4 post-upscaling workflow
# ---------------------------------------------------------------------------

RECAVSR_WORKFLOW_PATH = os.path.join(BASE_DIR, "..", "workflows", "recavsr_video_4x.json")


def load_base_recavsr_workflow() -> dict:
    """Load the base ReCaVSR X4 video-upscaling workflow."""
    with open(RECAVSR_WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_recavsr_workflow(
    workflow: dict,
    filename: str,
    model: str | None = None,
    scale: float = 4.0,
    color_fix: str = "none",
    seed: int = 42,
    decoder: str = "flashdecoder",
    kernels: str = "fast",
    kv_offload: bool = False,
    encoder: str = "auto",
    filename_prefix: str = "video/ReCaVSR_X4",
) -> dict:
    """Inject the source video and upscale settings into the ReCaVSR graph.

    The graph is fixed: LoadVideo -> ReCaVSRLoader -> ReCaVSRUpscale -> SaveVideo.
    """
    wf = copy.deepcopy(workflow)

    if "1" in wf:  # LoadVideo
        wf["1"]["inputs"]["file"] = filename

    if model and "3" in wf:  # ReCaVSRLoader
        wf["3"]["inputs"]["transformer"] = model

    if "4" in wf:  # ReCaVSRUpscale
        inputs = wf["4"]["inputs"]
        try:
            inputs["scale"] = float(scale)
        except (TypeError, ValueError):
            inputs["scale"] = 4.0
        inputs["color_fix"] = color_fix
        try:
            inputs["seed"] = int(seed)
        except (TypeError, ValueError):
            inputs["seed"] = 42
        inputs["decoder"] = decoder
        inputs["kernels"] = kernels
        inputs["kv_offload"] = bool(kv_offload)
        inputs["encoder"] = encoder

    if "6" in wf:  # SaveVideo
        wf["6"]["inputs"]["filename_prefix"] = filename_prefix

    return wf


def _add_fasth3_multi_ref_guide_nodes(wf: dict) -> None:
    """Add a frame-0 image guide to a multi-ref graph if it is missing."""
    if "901" not in wf:
        wf["900"] = {
            "inputs": {"image": ""},
            "class_type": "LoadImage",
            "_meta": {"title": "First Frame"},
        }
        wf["901"] = {
            "inputs": {
                "positive": ["136", 0],
                "latent": ["136", 1],
                "frame_idx": 0,
                "vae": ["119", 0],
                "image": ["900", 0],
            },
            "class_type": "MiniMaxH3AddGuide",
            "_meta": {"title": "Add Guide for MiniMax H3"},
        }
    if "126" in wf:
        wf["126"]["inputs"]["conditioning"] = ["901", 0]


def load_base_fasth3_multi_ref_guide_workflow() -> dict:
    """Load the multil-ref workflow and add a frame-0 image guide.

    The full multi-reference images and reference audio stay intact; the guide
    only anchors the extracted first frame.
    """
    wf = load_base_fasth3_multi_ref_workflow()
    _add_fasth3_multi_ref_guide_nodes(wf)
    return wf


def modify_fasth3_multi_ref_guide_workflow(
    workflow: dict,
    prompt: str,
    width: int,
    height: int,
    duration: float,
    image_filenames: list,
    audio_filenames: list,
    first_frame_filename: str,
    image_roles: list | None = None,
    image_labels: list | None = None,
    audio_mode: str = "voice",
    ref_video_filename: str | None = None,
    ref_image_size: str = "max",
    video_reference_mode: str = "continuity",
    recast_preserve: list | None = None,
    start_image_mode: str | None = None,
) -> dict:
    """Inject a first-frame guide plus multi-ref images/audio into the workflow."""
    return modify_fasth3_multi_ref_workflow(
        workflow,
        prompt,
        width,
        height,
        duration,
        image_filenames,
        audio_filenames,
        image_roles=image_roles,
        image_labels=image_labels,
        first_frame_filename=first_frame_filename,
        audio_mode=audio_mode,
        ref_video_filename=ref_video_filename,
        ref_image_size=ref_image_size,
        video_reference_mode=video_reference_mode,
        recast_preserve=recast_preserve,
        start_image_mode=start_image_mode,
    )


def modify_fasth3_multi_ref_workflow(
    workflow: dict,
    prompt: str,
    width: int,
    height: int,
    duration: float,
    image_filenames: list,
    audio_filenames: list,
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
    """Inject up to 6 reference images + 3 reference audios into the multi-ref workflow.

    Unused slots are pruned so no placeholder references are sent to the model.
    """
    wf = copy.deepcopy(workflow)
    dur = _clamp_fasth3_duration(duration)
    images = [f for f in (image_filenames or []) if f][:6]
    audios = [f for f in (audio_filenames or []) if f][:3]

    img_nodes = ["137", "ref_img_2", "ref_img_3", "ref_img_4", "ref_img_5", "ref_img_6"]
    aud_nodes = ["149", "ref_aud_2", "ref_aud_3"]

    node = wf.get("136")  # MiniMaxH3ReferenceToVideo
    if node:
        node["inputs"]["width"] = int(width)
        node["inputs"]["height"] = int(height)
        node["inputs"]["ref_image_size"] = "match" if ref_image_size == "match" else "max"

        for i in range(6):
            key = f"ref_images.ref_image_{i}"
            if i < len(images):
                nid = img_nodes[i]
                wf[nid] = {
                    "class_type": "LoadImage",
                    "inputs": {"image": images[i]},
                    "_meta": {"title": f"Reference Image {i + 1}"},
                }
                node["inputs"][key] = [nid, 0]
            else:
                node["inputs"].pop(key, None)
                wf.pop(img_nodes[i], None)

        for j in range(3):
            key = f"ref_audios.ref_audio_{j}"
            if j < len(audios):
                nid = aud_nodes[j]
                wf[nid] = {
                    "class_type": "LoadAudio",
                    "inputs": {"audio": audios[j]},
                    "_meta": {"title": f"Reference Audio {j + 1}"},
                }
                node["inputs"][key] = [nid, 0]
            else:
                node["inputs"].pop(key, None)
                wf.pop(aud_nodes[j], None)

    if first_frame_filename:
        _add_fasth3_multi_ref_guide_nodes(wf)
        wf["900"]["inputs"]["image"] = first_frame_filename

    video_count = 1 if ref_video_filename else 0
    if ref_video_filename and node:
        wf["903"] = {
            "class_type": "LoadVideo",
            "inputs": {"file": ref_video_filename},
            "_meta": {"title": "Reference Video"},
        }
        wf["904"] = {
            "class_type": "GetVideoComponents",
            "inputs": {"video": ["903", 0]},
            "_meta": {"title": "Reference Video Components"},
        }
        node["inputs"]["ref_videos.ref_video_0"] = ["904", 0]
    else:
        if node:
            node["inputs"].pop("ref_videos.ref_video_0", None)
        wf.pop("903", None)
        wf.pop("904", None)

    if "138" in wf:  # Input Text (Prompt)
        wf["138"]["inputs"]["value"] = build_h3_multi_ref_prompt(
            prompt,
            len(images),
            len(audios),
            image_roles=image_roles,
            image_labels=image_labels,
            audio_mode=audio_mode,
            video_count=video_count,
            video_reference_mode=video_reference_mode,
            recast_preserve=recast_preserve,
            start_image_mode=start_image_mode,
        )
    if "132" in wf:  # Float (Duration)
        wf["132"]["inputs"]["value"] = float(dur)
    if "129" in wf:  # RandomNoise
        wf["129"]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    return wf