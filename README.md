# Pulse Image

AI-Powered Image & Video Generation Studio

macOS-style desktop frontend with window manager, theme system, timeline editor, and full ComfyUI/Ollama integration.

Written by Pulse Harmonix

**Early/experimental version.** Significant code cleanup, refactoring, improved architecture, and feature polish are planned for future releases.

---

## DISCLAIMERS

- This software is provided "as is" for personal, educational, and experimental use only.
- It depends on third-party AI systems (ComfyUI + Ollama). You are solely responsible for downloading and using models in compliance with their respective licenses.
- Generated content may contain visual artifacts, unexpected results, or biased outputs.
- The developers accept no liability for any content created with this tool or any issues arising from its use.
- Always review and respect the terms of service of ComfyUI, Ollama, and the model creators.

---

## SYSTEM REQUIREMENTS

- Python 3.12.5 or higher
- Visual Studio Code (strongly recommended)
- A running ComfyUI instance (local or remote)
- Ollama instance (local or remote)

---

## RECOMMENDED MODELS

**Ollama (for prompt enhancement and chat):**
- qwen3:8b (recommended and default in settings)

**ComfyUI Models** — exact filenames are referenced inside workflow JSON files in `workflows/`.

Image Models:
- flux1-schnell-fp8.safetensors                                                          (checkpoints)
- flux-2-klein-base-9b-fp8.safetensors                                                   (diffusion_models)
- qwen_image_2512_fp8_e4m3fn.safetensors                                                 (diffusion_models)
- flux2_dev_fp8mixed.safetensors                                                         (diffusion_models)

Video Models (LTX 2.3 family):
- ltx-2.3-22b-dev-fp8.safetensors                                                        (checkpoints)
- ltx_2.3_22b_distilled_1.1_lora_dynamic_fro09_avg_rank_111_bf16.safetensors             (loras)
- ltx-2.3-spatial-upscaler-x2-1.1.safetensors                                            (latent_upscale_models)

Supporting Models (VAE, CLIP, Text Encoders, Loras):
- ae.safetensors                                                                         (vae)
- clip_l.safetensors                                                                     (vae)
- full_encoder_small_decoder.safetensors                                                 (vae)
- qwen_image_vae.safetensors                                                             (vae)
- mistral_3_small_flux2_bf16.safetensors                                                 (text_encoders)
- qwen_3_8b_fp8mixed.safetensors                                                         (text_encoders)
- gemma_3_12B_it_fp4_mixed.safetensors                                                   (text_encoders)
- qwen_2.5_vl_7b_fp8_scaled.safetensors                                                  (text_encoders)
- t5xxl_fp16.safetensors                                                                 (clip)
- flux1-schnell.safetensors                                                              (unet)
- flux_2-turbo-lora_comfyui.safetensors                                                  (loras)
- gemma-3-12b-it-abliterated_lora_rank64_bf16.safetensors                                (loras)
- qwen-image-2512-lightning-4steps-V1.0-fp32.safetensors                                 (loras)


---

## INSTALLATION

1. **Install Python** 3.10+ from https://www.python.org/downloads/ (check "Add Python to PATH")
2. **Open the project** in Visual Studio Code
3. **Create a virtual environment:**
   ```
   python -m venv venv
   ```
4. **Activate it:**
   - Windows PowerShell: `venv\Scripts\Activate.ps1`
   - Windows CMD: `venv\Scripts\activate.bat`
   - macOS/Linux: `source venv/bin/activate`
5. **Install dependencies:**
   ```
   pip install -r requirements.txt
   ```
6. **Start required services:** ComfyUI (usually http://127.0.0.1:8188) and Ollama with `ollama serve`
7. **Run Pulse Image:**
   ```
   python main.py
   ```
8. **Open http://localhost:8000** in your browser (Edge recommended during testing)

---

## FIRST-TIME SETUP

1. Open Settings (bottom bar gear icon or menu)
2. Configure ComfyUI URL (usually http://127.0.0.1:8188) and Ollama URL (usually http://127.0.0.1:11434)
3. Click "Check Models" to verify your ComfyUI installation
4. Save settings

---

## PROJECT STRUCTURE

```
PulseImage/
├── main.py                  # FastAPI entry point, serves index.html at /
├── config.py                # App settings defaults and DB loading
├── requirements.txt
├── .gitignore
├── AGENTS.md                # Development context for AI coding agents
├── README.md
│
├── routers/
│   ├── admin.py             # Admin CRUD endpoints (settings, library)
│   ├── comfy.py             # ComfyUI proxy endpoints
│   ├── generations.py       # Image/video generation endpoints
│   ├── ollama.py            # Ollama chat/prompt endpoints
│   ├── settings.py          # User settings get/save
│   └── uploads.py           # File upload/delete
│
├── services/
│   ├── comfy_service.py     # ComfyUI workflow execution
│   ├── database_service.py  # SQLite connection management
│   ├── dialogue_manager.py  # Chat/assistant logic
│   ├── generation_service.py
│   ├── ollama_service.py
│   ├── settings_service.py
│   └── story_service.py     # Ollama generate (used by enhance)
│
├── utils/
│   ├── workflow_utils.py
│   └── video_workflow_utils.py
│
├── workflows/               # ComfyUI workflow JSON templates
│   └── *.json
│
├── templates/
│   └── index.html          # Desktop shell (no Tailwind)
│
├── static/index/
│   ├── css/style.css        # All styling, CSS custom properties for theming
│   └── js/app.js            # Vanilla JS — window manager, timeline, theme engine
│
├── images/                  # Generated images
├── videos/                  # Generated videos
├── audio/                   # Audio files
└── thumbnails/              # Disk-based thumbnails (Pillow/OpenCV)
```

---

## KEY FEATURES

- **macOS-style desktop UI** — draggable/resizable windows, menubar, desktop icons, window manager with state persistence
- **Image & Video Generation** — via ComfyUI workflows (Flux, LTX, Qwen models)
- **Chat** — iMessage-style interface with SSE streaming
- **Library** — masonry grid with lazy loading, video/audio playback, star/trash, scroll preservation
- **Preview** — image/video/audio preview, variations, related items
- **Bottom Prompt Bar** — mode toggle, resolution/aspect/duration pills, attachments with constraints
- **Timeline Editor** — waveform visualization, cue editing, playhead, transport controls, preview pane, export, audio support
- **Project Management** — macOS-style grid of project cards with icons, cue counts, durations; opens timeline on click
- **Theme System** — 10 presets (macOS Dark/Light, Cyberpunk, Nature, etc.) + full visual theme editor with color pickers; persisted to DB
- **Admin Windows** — Settings Editor, Library Editor with tree view, collapse/expand, scroll preserve, refresh

---

## TECHNICAL NOTES

- **No build step** — vanilla JS, CSS custom properties, CDN Font Awesome
- **No Tailwind CSS** — all styling via `style.css` or inline JS
- **SQLite database** — the only data store. No JSON files. Tables: `settings`, `generations`, `library`
- **Entry point is `/`** — serves `index.html`
- **Tauri scaffolded** at `src-tauri/` but cannot build without Rust toolchain (`cargo` not installed)
- **Themes** stored as full variable maps (~80 CSS custom properties) in `THEMES` object; custom themes saved as `customTheme` in DB settings

---

## TESTING & USAGE

- **First test:** Open Chat and verify Ollama connection
- **Library:** Shows all generations; click to preview; star/trash items
- **Generating:** Type a prompt in the bottom bar; use mode/resolution pills to configure
- **Theme:** Use Theme menu in menubar to switch presets or open the visual theme editor

Enjoy creating with Pulse Image!
