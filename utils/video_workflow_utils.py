import json
import copy
import random
import os

# Go up one level from utils/ to the project root, then into workflows/
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WORKFLOW_PATH = os.path.join(BASE_DIR, "..", "workflows", "ltx2_3_text_to_video.json")
I2V_WORKFLOW_PATH = os.path.join(BASE_DIR, "..", "workflows", "ltx2_3_image_to_video.json")


def load_base_video_workflow() -> dict:
    """Load the base LTX 2.3 text-to-video workflow"""
    with open(WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_video_workflow(workflow: dict, prompt: str, width: int, height: int, duration: int) -> dict:
    """
    Modify the LTX video workflow with user prompt, dimensions, duration and random seed.
    """
    wf = copy.deepcopy(workflow)

    # === Prompt ===
    if "267:266" in wf:
        wf["267:266"]["inputs"]["value"] = prompt

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
    """
    Calculate width and height for video generation.
    """
    height_map = {
        "480p": 720,
        "720p": 720,
        "1080p": 1080,
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

    if aspect_ratio in ["3:2", "16:9"]:           # Landscape
        height = base_height
        width = int(base_height * (w_ratio / h_ratio))
    elif aspect_ratio in ["2:3", "9:16"]:         # Portrait
        width = base_height
        height = int(base_height * (h_ratio / w_ratio))
    else:                                         # Square
        width = base_height
        height = base_height

    # Ensure dimensions are multiples of 64
    width = max(512, (width // 64) * 64)
    height = max(512, (height // 64) * 64)

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