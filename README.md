PULSE IMAGE

AI-Powered Image \& Video Generation Studio



Pulse Image is a modern web-based creative studio for generating high-quality images and videos. It combines the power of ComfyUI workflows with Ollama for intelligent prompt enhancement, story breakdown, and chat-assisted creation.



Written by Pulse Harmonix with Super Grok and Grok Build

This is an early/experimental version of the application. Significant code cleanup, refactoring, improved architecture, and feature polish are planned for future releases.



================================================================================

DISCLAIMERS

================================================================================



\- This software is provided "as is" for personal, educational, and experimental use only.

\- It depends on third-party AI systems (ComfyUI + Ollama). You are solely responsible for downloading and using models in compliance with their respective licenses.

\- Generated content may contain visual artifacts, unexpected results, or biased outputs.

\- The developers accept no liability for any content created with this tool or any issues arising from its use.

\- Always review and respect the terms of service of ComfyUI, Ollama, and the model creators.



================================================================================

SYSTEM REQUIREMENTS

================================================================================



\- Python 3.12.5 or higher

\- Visual Studio Code (strongly recommended)

\- A running ComfyUI instance (local or remote)

\- Ollama instance (local or remote)



RECOMMENDED MODELS



Ollama (for prompt enhancement, story mode, and chat):

\- qwen3:8b (recommended and default in settings)



ComfyUI Models

The exact model filenames are referenced inside the workflow JSON files located in the workflows/ folder. Common models include:



Image Models:

\- flux1-schnell-fp8.safetensors                                                          (checkpoints)

\- flux-2-klein-base-9b-fp8.safetensors                                                   (diffusion\_models)

\- qwen\_image\_2512\_fp8\_e4m3fn.safetensors                                                 (diffusion\_models)

\- flux2\_dev\_fp8mixed.safetensors                                                         (diffusion\_models)



Video Models (LTX 2.3 family):

\- ltx-2.3-22b-dev-fp8.safetensors                                                        (checkpoints)

\- ltx\_2.3\_22b\_distilled\_1.1\_lora\_dynamic\_fro09\_avg\_rank\_111\_bf16.safetensors             (loras)

\- ltx-2.3-spatial-upscaler-x2-1.1.safetensors                                            (latent\_upscale\_models)



Supporting Models (VAE, CLIP, Text Encoders, Loras):

\- ae.safetensors                                                                         (vae)

\- clip\_l.safetensors                                                                     (vae)

\- full\_encoder\_small\_decoder.safetensors                                                 (vae)

\- qwen\_image\_vae.safetensors                                                             (vae)

\- mistral\_3\_small\_flux2\_bf16.safetensors                                                 (text\_encoders)

\- qwen\_3\_8b\_fp8mixed.safetensors                                                         (text\_encoders)

\- gemma\_3\_12B\_it\_fp4\_mixed.safetensors                                                   (text\_encoders)

\- qwen\_2.5\_vl\_7b\_fp8\_scaled.safetensors                                                  (text\_encoders)

\- t5xxl\_fp16.safetensors                                                                 (clip)

\- flux1-schnell.safetensors                                                              (unet)

\- flux\_2-turbo-lora\_comfyui.safetensors                                                  (loras)

\- gemma-3-12b-it-abliterated\_lora\_rank64\_bf16.safetensors                                (loras)

\- qwen-image-2512-lightning-4steps-V1.0-fp32.safetensors                                 (loras)





Tip: After installing the app, use the built-in "Check Models" button in Settings to verify your ComfyUI installation.



================================================================================

INSTALLATION INSTRUCTIONS

================================================================================



1\. INSTALL PYTHON



&#x20;  Download Python 3.10+ from https://www.python.org/downloads/

&#x20;  During installation, check the box "Add Python to PATH"

&#x20;  Verify installation:

&#x20;      python --version



2\. OPEN THE PROJECT IN VISUAL STUDIO CODE



&#x20;  Open Visual Studio Code

&#x20;  Go to File -> Open Folder

&#x20;  Select the folder containing main.py, requirements.txt, utils/, workflows/, etc.



3\. CREATE A VIRTUAL ENVIRONMENT



&#x20;  Open the integrated terminal in VS Code (Ctrl + `) and run:

&#x20;      python -m venv venv



4\. ACTIVATE THE VIRTUAL ENVIRONMENT



&#x20;  Windows (PowerShell - recommended):

&#x20;      venv\\Scripts\\Activate.ps1



&#x20;  If you get an execution policy error, run this first:

&#x20;      Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser



&#x20;  Windows (Command Prompt):

&#x20;      venv\\Scripts\\activate.bat



&#x20;  macOS / Linux:

&#x20;      source venv/bin/activate



&#x20;  You should see (venv) appear at the start of your terminal prompt.



5\. INSTALL DEPENDENCIES



&#x20;  pip install -r requirements.txt



&#x20;  This installs FastAPI, Uvicorn, Pillow, httpx, OpenCV (for video fallback), Jinja2, etc.



6\. START REQUIRED SERVICES



&#x20;  Before running Pulse Image, make sure these are running:



&#x20;  - ComfyUI (usually at http://127.0.0.1:8188)

&#x20;  - Ollama with the recommended model:

&#x20;      ollama pull qwen3:8b

&#x20;      ollama serve



7\. RUN PULSE IMAGE



&#x20;  With the virtual environment activated, run:

&#x20;      python main.py



&#x20;  The server will start on:

&#x20;      http://0.0.0.0:8000



&#x20;  You should see output indicating the FastAPI server is running.



8\. OPEN IN BROWSER



&#x20;  Open your web browser and navigate to:

&#x20;      http://localhost:8000



&#x20;  Recommended Browser: Microsoft Edge (best compatibility during current testing phase)



================================================================================

FIRST-TIME SETUP (IMPORTANT)

================================================================================



1\. Once the interface loads, click "Library" in the left sidebar.

2\. At the bottom of the screen, click the gear icon (settings) on the prompt input bar to open Settings.

3\. Configure the following for your system:

&#x20;  - ComfyUI URL          -> usually http://127.0.0.1:8188

&#x20;  - Ollama URL           -> usually http://127.0.0.1:11434

&#x20;  - Ollama Model         -> qwen3:8b

&#x20;  - Default Image Model and Image-to-Image Model

&#x20;  - Other options (video playback behavior, generation timeout, etc.)

4\. Click the "Check Models" button.

&#x20;  This will query your ComfyUI instance and show which models are available.

5\. Adjust any missing models in ComfyUI if the check reports issues.

6\. Save your settings.



You are now ready to generate images and videos.



================================================================================

PROJECT STRUCTURE (OVERVIEW)

================================================================================



PulseImage/

├── main.py                 # FastAPI backend

├── requirements.txt

├── settings.json

├── library.json            # Generated assets metadata

├── projects.json           # Saved projects + timelines

├── utils/

│   ├── comfy\_client.py     # Communication with ComfyUI

│   ├── workflow\_utils.py

│   └── video\_workflow\_utils.py

├── workflows/              # ComfyUI workflow JSON files

├── templates/

│   └── index.html

├── static/js/

│   └── app.js              # Frontend application

├── images/                 # Generated images

├── videos/                 # Generated videos

└── audio/                  # Uploaded audio files



================================================================================

TESTING \& USAGE NOTES

================================================================================



Recommended first test:

Go to the Chat section and make sure the Ollama connection works. Just type something simple and check if it responds.



Library View:

\- Shows all previous generations plus any imported images, videos, and audio files.

\- Click on any card to open a preview.

\- Images display their resolution.

\- Videos also show the video length.

\- The trashcan icon permanently deletes the file from disk and removes it from the library.

\- In preview mode you can download the file and mark it as a favourite (yellow star). Favourited items show a yellow star icon in the library view.



Generating in Library:

\- In library view you can generate new images and videos simply by typing a prompt in the bottom bar.

\- When testing, keep an eye on the ComfyUI console to confirm the generation command was received.

\- The + button next to the prompt allows you to:

&#x20; - Upload an image, video, or audio file directly into the library, or

&#x20; - Select a Flux Schnell LoRA for consistent character/style generation (advanced feature).



Preview Mode Behavior:

\- If you have an image selected in preview and you are in Image mode, typing a prompt will modify/edit the image.

\- If you switch to Video mode, the same image will be animated into a video.

\- Related images and videos created from a master item appear as small icons on the master card and in the related section when previewing.

\- Pressing the + button in preview shows available modifier images and audio files.

&#x20; - In Image mode: Selecting another image will combine it with the previewed image according to your prompt (double image-to-image).

&#x20; - In Video mode: You can add an audio track (speech or music) so the character in the image can talk or sing.

\- Note: Adding a second image as a modifier for video generation is not yet supported (planned as first-frame / last-frame feature in a future version).



================================================================================

KNOWN BUGS

================================================================================



1\. Sometimes the scrollbar in the Library view does not appear.

&#x20;  Fix: Click the "Library" button in the sidebar again. This usually forces the scroller to initialize correctly.



2\. In preview mode, if a video has been playing and you navigate back to the library, the audio may continue playing in the background.

&#x20;  Fix: Click on any image in the library, then go back to preview mode. This stops the orphaned audio.



================================================================================

NOTES

================================================================================



\- The application is designed to work with a locally running ComfyUI instance.

\- All generation happens through ComfyUI workflows (highly customizable).

\- Future versions will include better code organization, more robust error handling, and additional features.

\- For best performance, run everything locally on a machine with a capable GPU.



Enjoy creating with Pulse Image!

