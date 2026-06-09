# utils/workflow_utils.py
import json
import copy

WORKFLOW_PATH = "workflows/flux_schnell_base_text_to_image.json"
KLEIN_WORKFLOW_PATH = "workflows/flux2_klein_text_to_image.json"
I2I_WORKFLOW_PATH = "workflows/flux2_image_to_image.json"
KLEIN_I2I_WORKFLOW_PATH = "workflows/flux2_klein_image_to_image.json"
QWEN_WORKFLOW_PATH = "workflows/qwen_2512_text_to_image.json"
LORA_WORKFLOW_PATH = "workflows/flux_schnell_base_text_to_image_with_lora.json"


def load_base_workflow() -> dict:
    """Load the base Flux Schnell workflow"""
    with open(WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_base_klein_workflow() -> dict:
    """Load the base Flux 2 Klein text-to-image workflow"""
    with open(KLEIN_WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_base_qwen_workflow() -> dict:
    """Load the Qwen 2.5 2512 text-to-image workflow (with optional 4-step LoRA turbo)"""
    with open(QWEN_WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_base_lora_workflow() -> dict:
    """Load the Flux Schnell text-to-image + LoRA workflow"""
    with open(LORA_WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_workflow(workflow: dict, prompt: str, width: int, height: int) -> dict:
    wf = copy.deepcopy(workflow)

    # Inject prompt
    if "6" in wf:
        wf["6"]["inputs"]["text"] = prompt

    # Set dimensions
    if "27" in wf:
        wf["27"]["inputs"]["width"] = width
        wf["27"]["inputs"]["height"] = height
        wf["27"]["inputs"]["batch_size"] = 1

    # === FIX: Randomize seed every time ===
    if "31" in wf:  # KSampler node
        import random
        wf["31"]["inputs"]["seed"] = random.randint(0, 2**32 - 1)

    return wf


def modify_klein_workflow(workflow: dict, prompt: str, width: int, height: int) -> dict:
    """Modify the Flux2 Klein text-to-image workflow (different node IDs)."""
    wf = copy.deepcopy(workflow)

    # Inject prompt (positive CLIPTextEncode)
    if "75:74" in wf:
        wf["75:74"]["inputs"]["text"] = prompt

    # Set dimensions
    if "75:68" in wf:  # Width
        wf["75:68"]["inputs"]["value"] = width
    if "75:69" in wf:  # Height
        wf["75:69"]["inputs"]["value"] = height

    # === Randomize seed every time ===
    if "75:73" in wf:  # RandomNoise
        import random
        wf["75:73"]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    return wf


def modify_qwen_workflow(workflow: dict, prompt: str, width: int, height: int, enable_turbo: bool = True) -> dict:
    """Modify the Qwen 2512 text-to-image workflow (different node IDs).
    Supports the Enable 4 Steps LoRA boolean which switches steps/CFG/LoRA via internal switches.
    """
    wf = copy.deepcopy(workflow)

    # Inject prompt (positive CLIPTextEncode "238:227")
    if "238:227" in wf:
        wf["238:227"]["inputs"]["text"] = prompt

    # Set dimensions (EmptySD3LatentImage "238:232")
    if "238:232" in wf:
        wf["238:232"]["inputs"]["width"] = width
        wf["238:232"]["inputs"]["height"] = height
        wf["238:232"]["inputs"]["batch_size"] = 1

    # Set turbo/LoRA flag (PrimitiveBoolean "238:229")
    if "238:229" in wf:
        wf["238:229"]["inputs"]["value"] = bool(enable_turbo)

    # === Randomize seed every time (KSampler "238:230") ===
    if "238:230" in wf:
        import random
        wf["238:230"]["inputs"]["seed"] = random.randint(0, 2**32 - 1)

    return wf


def modify_lora_workflow(workflow: dict, prompt: str, width: int, height: int, lora_name: str, strength_model: float = 0.75, strength_clip: float = 0.75) -> dict:
    """Modify the Flux Schnell LoRA workflow.
    Uses LoraLoader node "28", EmptyLatent "5", RandomNoise "25", positive prompt "6".
    """
    wf = copy.deepcopy(workflow)

    # Positive prompt
    if "6" in wf:
        wf["6"]["inputs"]["text"] = prompt

    # Latent dimensions (note: this workflow uses node 5, unlike base schnell's 27)
    if "5" in wf:
        wf["5"]["inputs"]["width"] = width
        wf["5"]["inputs"]["height"] = height
        wf["5"]["inputs"]["batch_size"] = 1

    # LoRA selection + strengths
    if "28" in wf:
        wf["28"]["inputs"]["lora_name"] = lora_name
        wf["28"]["inputs"]["strength_model"] = float(strength_model)
        wf["28"]["inputs"]["strength_clip"] = float(strength_clip)

    # Randomize seed
    if "25" in wf:
        import random
        wf["25"]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    return wf


def get_image_dimensions(resolution: str, aspect_ratio: str) -> tuple[int, int]:
    """
    resolution buttons (480p, 720p, 1080p) = target height in landscape.
    Works correctly for landscape, portrait, and square.
    """
    # Map resolution button to target height (in landscape)
    height_map = {
        "480p": 512,     # Nearest multiple of 64 to 480
        "720p": 704,     # Nearest multiple of 64 to 720
        "1080p": 1088    # Nearest multiple of 64 to 1080
    }

    base_height = height_map.get(resolution, 1024)

    aspect_map = {
        "3:2": (3, 2),
        "2:3": (2, 3),
        "16:9": (16, 9),
        "9:16": (9, 16),
        "1:1": (1, 1),
    }

    w_ratio, h_ratio = aspect_map.get(aspect_ratio, (1, 1))

    if aspect_ratio in ["3:2", "16:9"]:           # Landscape
        height = base_height
        width = int(base_height * (w_ratio / h_ratio))

    elif aspect_ratio in ["2:3", "9:16"]:         # Portrait
        width = base_height
        height = int(base_height * (h_ratio / w_ratio))

    else:                                         # Square (1:1)
        width = base_height
        height = base_height

    # Ensure dimensions are multiples of 64 (required for Flux/SD models)
    width = max(64, (width // 64) * 64)
    height = max(64, (height // 64) * 64)

    return width, height


def load_base_image_to_image_workflow() -> dict:
    """Load the base Flux2 image-to-image workflow"""
    with open(I2I_WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_base_klein_image_to_image_workflow() -> dict:
    """Load the base Flux2 Klein image-to-image workflow"""
    with open(KLEIN_I2I_WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_image_to_image_workflow(workflow: dict, prompt: str, image_filename: str) -> dict:
    """
    Modify the Flux2 i2i workflow:
    - Set the adjustment prompt
    - Set the source image (after uploading to ComfyUI)
    - Randomize the noise seed
    """
    wf = copy.deepcopy(workflow)

    # === Prompt (positive) ===
    if "68:6" in wf:
        wf["68:6"]["inputs"]["text"] = prompt

    # === Source image (LoadImage node) ===
    if "46" in wf:
        wf["46"]["inputs"]["image"] = image_filename

    # === Randomize seed ===
    if "68:25" in wf:  # RandomNoise
        import random
        wf["68:25"]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    return wf


def modify_klein_image_to_image_workflow(workflow: dict, prompt: str, image_filename: str) -> dict:
    """
    Modify the Flux2 Klein i2i workflow:
    - Set the adjustment prompt
    - Set the source image (after uploading to ComfyUI)
    - Randomize the noise seed
    """
    wf = copy.deepcopy(workflow)

    # === Prompt (positive) ===
    if "75:74" in wf:
        wf["75:74"]["inputs"]["text"] = prompt

    # === Source image (LoadImage node) ===
    if "76" in wf:
        wf["76"]["inputs"]["image"] = image_filename

    # === Randomize seed ===
    if "75:73" in wf:  # RandomNoise
        import random
        wf["75:73"]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    return wf


DOUBLE_KLEIN_I2I_WORKFLOW_PATH = "workflows/flux2_klein_image_image_to_image.json"


def load_base_klein_double_image_to_image_workflow() -> dict:
    """Load the base Flux2 Klein double image-to-image (2 refs + prompt) workflow"""
    with open(DOUBLE_KLEIN_I2I_WORKFLOW_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def modify_klein_double_image_to_image_workflow(
    workflow: dict, prompt: str, image1_filename: str, image2_filename: str
) -> dict:
    """
    Modify the Flux2 Klein 2-image-to-image workflow:
    - Set the 1st reference image (main image from modal)
    - Set the 2nd reference image (modifier image from + picker)
    - Set the prompt
    - Randomize the noise seed
    """
    wf = copy.deepcopy(workflow)

    # 1st reference image (LoadImage "76" - main image)
    if "76" in wf:
        wf["76"]["inputs"]["image"] = image1_filename

    # 2nd reference image (LoadImage "81" - modifier)
    if "81" in wf:
        wf["81"]["inputs"]["image"] = image2_filename

    # Prompt (positive CLIPTextEncode "92:113")
    if "92:113" in wf:
        wf["92:113"]["inputs"]["text"] = prompt

    # Randomize seed (RandomNoise "92:105")
    if "92:105" in wf:
        import random
        wf["92:105"]["inputs"]["noise_seed"] = random.randint(0, 2**32 - 1)

    return wf