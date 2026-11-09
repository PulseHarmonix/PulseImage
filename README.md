# Pulse Image

Local-first AI studio for image, video, speech, music, and music-video generation.

Written by Pulse Harmonix

**Early/experimental version.** The project is under active development.

---

## DISCLAIMERS

- This software is provided "as is" for personal, educational, and experimental use only.
- It depends on third-party AI systems (ComfyUI and Ollama). You are responsible for downloading and using models in compliance with their licenses.
- Generated content may contain visual artifacts, unexpected results, or biased outputs.
- The developers accept no liability for content created with this tool or for issues arising from its use.
- Always review and respect the terms of service of ComfyUI, Ollama, and the model creators.

---

## FEATURES

- **Studio** - prompt composer for image, video, and speech, with attachments, prompt tabs, model controls, and a global queue.
- **Library** - searchable asset grid, filters, bulk actions, drag/drop import, fullscreen inspector, To Prompt, variations, video upscaling, image editing, music covers, and score/plan views.
- **Music Video** - projects, character slots, timed sections, draggable segment timeline, section playback, auto-generation, ZIP export, and Lightworks 2026 FCP7 XML package export.
- **Music Generator** - YuE2 song generation and covers, unique song titles, recent songs, sheet music, vocal timing, and score/plan details.
- **Stems** - lazy six-stem extraction for any audio asset with a synchronized mixer, waveforms, and export of the current audible stem selection as a new audio asset.
- **Single Frame** - scrub generated videos and save full-resolution frames to the Library.
- **Motion** - prompt-based camera/motion presets and image-to-video with LTX/FastH3, using previews from `motion-presets/`.
- **Voices** - TTS engine readiness, voice metadata, transcript/language editing, and speaker previews.
- **Models and Settings** - model selection, required-model checks, LoRA listing, ComfyUI/Ollama URLs, prompt enhancers, RelayVSR defaults, and raw settings.
- **Admin** - raw settings editing, library flag editing/deletion, and thumbnail backfill.

---

## SYSTEM REQUIREMENTS

- Python 3.12+
- Node.js 20.19+ or 22.12+ and npm
- FFmpeg and ffprobe on `PATH` for frame extraction, audio trimming, and audio duration checks
- A running ComfyUI instance (local or remote)
- An Ollama instance for prompt enhancement (optional for basic generation)
- Rust only if you want to build the optional Tauri desktop shell

---

## MODELS AND SERVICES

Exact required filenames are defined in the workflow JSON files under `workflows/` and audited on the **Models** page.

**Ollama**
- `qwen3:8b` is the recommended/default prompt-enhancement model.

**ComfyUI image models**
- Flux Schnell
- Flux 2 Klein
- Flux 2
- Qwen Image 2512
- Grok Imagine / Grok Imagine Quality (cloud xAI, optional)

**ComfyUI video models**
- LTX 2.3 and LTX 2.5
- FastH3 (reference, first-frame, image+audio, and multi-reference flows)
- Grok Imagine video (cloud xAI, optional)
- RelayVSR X2 (optional video post-upscale)

**ComfyUI music models**
- YuE2 native nodes with `yue2_3b_int8_convrot.safetensors`
- SheetSage2 nodes for audio-to-ABC cover transcription
- `ComfyUI-Demucs-AudioSeparator` with the `htdemucs_6s` model for lazy six-stem extraction

**Speech**
- Qwen3-TTS
- Chatterbox
- CosyVoice 3
- IndexTTS 2
- F5-TTS
- XTTS v2
- Zonos2
- GPT-SoVITS

Engine install status and supported controls are shown on the **Models** and **Voices** pages.

---

## INSTALLATION

1. Install Python 3.12+ and Node.js.
2. Create and activate a virtual environment:

   ```powershell
   python -m venv venv
   venv\Scripts\Activate.ps1
   ```

3. Install the backend dependencies:

   ```powershell
   pip install -r requirements.txt
   ```

4. Install and build the React frontend:

   ```powershell
   cd frontend
   npm install
   npm run build
   cd ..
   ```

5. Ensure FFmpeg/ffprobe are available on `PATH`.

6. Start ComfyUI and, optionally, Ollama.

7. Start Pulse Image:

   ```powershell
   python main.py
   ```

8. Open `http://127.0.0.1:8000/`.

If the frontend has not been built, the server returns a friendly 503 page with the build command.

---

## FIRST-TIME SETUP

1. Open **Settings**.
2. Set the ComfyUI URL (usually `http://127.0.0.1:8188`) and Ollama URL (usually `http://127.0.0.1:11434`).
3. Save settings and open **Models** to check required model/workflow readiness.
4. Add or select a voice in **Voices** before using Speech generation.
5. For YuE2 music and covers, verify the YuE2/SheetSage2 nodes and checkpoint are installed.

### Grok Imagine (optional cloud service)

1. Create an xAI API key at https://console.x.ai.
2. Open **Admin -> Settings Editor**.
3. Set `xai_api_key` and save.
4. Choose a Grok image/video model on **Models** or in the composer.

Grok still requires network access and a valid API key. ComfyUI generation paths remain local.

---

## DEVELOPMENT

Start the backend:

```powershell
python main.py
```

Start the Vite dev server in a second terminal:

```powershell
cd frontend
npm run dev
```

Open `http://127.0.0.1:5173/`. The dev frontend calls the FastAPI server at `http://127.0.0.1:8000`.

Frontend checks:

```powershell
cd frontend
npm run build
npm run lint
```

Backend syntax check:

```powershell
python -m compileall -q main.py config.py routers services utils
```

---

## ROUTING AND STORAGE

- The React app is served at `/`.
- Client-side routes include `/library`, `/songs`, `/music`, `/frames`, `/voices`, `/models`, `/settings`, and `/admin`.
- Deep links fall back to the React index.
- Legacy `/app` URLs redirect to their root equivalents.
- SQLite is the primary data store in `pulseimage.db`.
- Generated media is stored in `images/`, `videos/`, `audio/`, and `thumbnails/`.
- `/motion-presets` serves drop-in preset preview videos and is not part of the Library.

---

## PROJECT STRUCTURE

```text
PulseImage/
|-- main.py                  # FastAPI entry point and SPA serving
|-- config.py                # Settings defaults and DB loading
|-- requirements.txt         # Python dependencies
|-- frontend/                # React studio (Vite + TypeScript)
|   |-- src/                 # Pages, components, API client, stores
|   `-- dist/                # Production build served by FastAPI
|-- routers/                 # FastAPI API routes
|   |-- admin.py
|   |-- comfy.py
|   |-- frames.py
|   |-- generations.py
|   |-- music.py
|   |-- ollama.py
|   |-- settings.py
|   |-- songs.py
|   |-- tts.py
|   `-- uploads.py
|-- services/                # ComfyUI, media, database, TTS, music services
|-- utils/                   # Workflow modification helpers
|-- workflows/               # ComfyUI workflow JSON templates
|-- images/                  # Generated images
|-- videos/                  # Generated videos
|-- audio/                   # Generated audio
|-- thumbnails/              # Generated thumbnails and frame cache
`-- src-tauri/               # Optional Tauri desktop shell
```

---

## TROUBLESHOOTING

- **"Pulse Image UI is not built"** - run `npm run build` inside `frontend/`.
- **ComfyUI offline** - check the URL in Settings and confirm ComfyUI is running.
- **Ollama offline** - prompt enhancement is optional; check the URL and installed models.
- **Missing models** - open Models to compare installed files with the workflow requirements.
- **No frame/audio durations** - install FFmpeg and ffprobe and restart the backend.
- **Music covers unavailable** - install the SheetSage2 nodes and confirm the YuE2 checkpoint is present.
- **Stems unavailable** - install `ComfyUI-Demucs-AudioSeparator` in ComfyUI and restart it. The `htdemucs_6s` model downloads on the first separation.
