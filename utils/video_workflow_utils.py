import json
import copy
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


def build_h3_multi_ref_prompt(
    user_prompt: str,
    image_count: int,
    audio_count: int,
    image_roles: list | None = None,
    image_labels: list | None = None,
    audio_mode: str = "voice",
    video_count: int = 0,
) -> str:
    """Build a structured H3 reference prompt for multiple images/audio refs.

    Images map to <Picture i> and <Subject i>. In ``voice`` mode audio maps to
    <Audio j> and is bound to the same-numbered subject as its voice-timbre
    reference. In ``music`` mode audio is the song/performance track that drives
    movement and lip-sync instead of a subject's timbre.
    Lines written as ``S1: ...`` become ``<d>[English] ...</d>`` dialogue.
    Optional roles/labels make subject definitions role-aware. When
    ``video_count`` is set a <Video 1> motion-continuity reference is added.
    """
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
        )
    if "132" in wf:  # Float (Duration)
        wf["132"]["inputs"]["value"] = float(dur)
    if "129" in wf:  # RandomNoise
        wf["129"]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    return wf