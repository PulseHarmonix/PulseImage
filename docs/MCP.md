# Pulse Image MCP Server

Pulse Image includes a local **Model Context Protocol (MCP)** server so MCP-capable AI clients can control the studio.

It can search the library, generate images and videos, run LTX/FastH3 recast, generate speech and music, work with stories and music-video projects, inspect frames, use stems, change settings, and call any Pulse REST endpoint.

The MCP server does **not** run generation itself. It calls the local Pulse Image FastAPI backend, which must be running.

---

## Requirements

- Pulse Image backend running on `http://127.0.0.1:8000`
- Python virtual environment with `mcp` installed
- ComfyUI and any required models available for generation

Install dependencies if needed:

```powershell
venv\Scripts\python.exe -m pip install -r requirements.txt
```

The MCP SDK is included in `requirements.txt`.

---

## Start Pulse Image

Start the backend first:

```powershell
python main.py
```

Keep it running while the MCP server is in use.

---

## Transport options

### stdio — recommended for OpenCode and desktop MCP clients

```powershell
venv\Scripts\python.exe mcp_server.py --transport stdio
```

The MCP client starts this process and communicates over stdin/stdout. The process must run from the Pulse Image project directory.

### Streamable HTTP

```powershell
venv\Scripts\python.exe mcp_server.py --transport streamable-http --host 127.0.0.1 --port 8765
```

MCP endpoint:

```text
http://127.0.0.1:8765/mcp
```

### SSE

```powershell
venv\Scripts\python.exe mcp_server.py --transport sse --host 127.0.0.1 --port 8765
```

SSE endpoint:

```text
http://127.0.0.1:8765/sse
```

---

## OpenCode setup

The repository includes `opencode.jsonc` with a local `pulse-image` MCP server:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "pulse-image": {
        "type": "local",
        "command": ["venv/Scripts/python.exe", "mcp_server.py", "--transport", "stdio"],
        "cwd": ".",
        "codemode": false,
        "timeout": {
          "execution": 43200000
        }
      }
    }
  }
}
```

Check the connection:

```powershell
opencode mcp list
```

Expected:

```text
✓ pulse-image connected
```

If the tools do not appear in an already-open OpenCode session, restart the session or use `/mcps` to reconnect the server.

OpenCode may display MCP tools with a server prefix, for example `pulse-image_pulse_generate_image`. Either name can be used when asking OpenCode to run an action.

### Remote OpenCode configuration

If running the HTTP transport manually:

```jsonc
{
  "mcp": {
    "servers": {
      "pulse-image": {
        "type": "remote",
        "url": "http://127.0.0.1:8765/mcp",
        "oauth": false,
        "timeout": {
          "execution": 43200000
        }
      }
    }
  }
}
```

---

## Basic workflow

1. Start `python main.py`.
2. Start the MCP server, or let OpenCode start it through `opencode.jsonc`.
3. Ask the AI client to use the `pulse-image` tools.
4. Generated images, videos, recasts, speech, music, and story assets are saved through the normal Pulse library paths.

Always prefer **asset IDs** or uploaded filenames over raw filesystem paths.

Useful discovery tools:

- `pulse_openapi` — full REST API schema
- `pulse_api` — arbitrary Pulse JSON API request
- `pulse_library` — search the library
- `pulse_models` — ComfyUI checkpoints and LoRAs
- `pulse_capabilities` — ComfyUI, Ollama, stems, music, TTS status

### Example OpenCode prompts

```text
Use pulse-image to list my 10 most recent video assets.

Use pulse-image to generate a 240p 16:9 image of a lighthouse at dusk.

Use pulse-image to generate a 6 second LTX 2.5 video from this prompt: ...

Use pulse-image to recast the video asset <video-id> using the character image
<image-id>, preserve the source motion, and mute the audio.

Use pulse-image to show the full REST API schema and explain how to list stories.
```

Ask OpenCode to return **asset IDs** after each generation so later calls can reference the saved media without filesystem paths.

Deletion tools permanently remove assets and their files. Confirm asset IDs before deleting anything.

---

## Tool overview

The server exposes 52 tools.

### Library and assets

- `pulse_library`
- `pulse_get_asset`
- `pulse_upload_asset`
- `pulse_upload_asset_b64`
- `pulse_update_asset`
- `pulse_delete_asset`

### Models and system

- `pulse_models`
- `pulse_capabilities`
- `pulse_settings`
- `pulse_update_settings`
- `pulse_admin_settings`
- `pulse_admin_update_setting`
- `pulse_admin_generations`
- `pulse_progress`

### Image generation

- `pulse_generate_image`
- `pulse_edit_image`

### Video and recast

- `pulse_generate_video`
- `pulse_recast_video`
- `pulse_upscale_video`

### Speech, music, and audio

- `pulse_generate_speech`
- `pulse_generate_song`
- `pulse_generate_song_cover`
- `pulse_separate_stems`
- `pulse_mix_stems`
- `pulse_stems_status`

### Frames and video audio

- `pulse_frames_info`
- `pulse_frames_window`
- `pulse_frames_preview`
- `pulse_save_frame`
- `pulse_video_audio_info`
- `pulse_extract_video_audio`

### Stories

- `pulse_stories`
- `pulse_story`
- `pulse_create_story`
- `pulse_update_story`
- `pulse_delete_story`
- `pulse_story_add_cast`
- `pulse_story_add_scene`
- `pulse_story_update_scene`
- `pulse_story_add_shot`
- `pulse_story_plan`
- `pulse_story_keyframes`
- `pulse_story_generate_shot`
- `pulse_story_export`

### Music video

- `pulse_music_video_projects`
- `pulse_music_video_create`
- `pulse_music_video_project`
- `pulse_music_video_generate_segment`
- `pulse_music_video_export_segments`
- `pulse_music_video_export_lwks`

### Generic API

- `pulse_api`
- `pulse_openapi`

---

## Example requests

### Generate an image

```json
{
  "prompt": "A red ceramic coffee mug on a wooden table, soft studio lighting",
  "image_model": "schnell",
  "resolution": "720p",
  "aspect_ratio": "16:9",
  "count": 1
}
```

With a LoRA:

```json
{
  "prompt": "A portrait of a woman in a red jacket, studio lighting",
  "image_model": "schnell",
  "resolution": "240p",
  "aspect_ratio": "16:9",
  "count": 1,
  "lora_name": "woman1ai.safetensors",
  "lora_strength": 0.6
}
```

### Generate a video

```json
{
  "prompt": "A slow cinematic shot of a red ceramic coffee mug on a wooden table",
  "video_model": "ltx",
  "ltx_version": "2.5",
  "resolution": "720p",
  "aspect_ratio": "16:9",
  "duration": 6,
  "video_upscale": "off"
}
```

### Recast a video

```json
{
  "ref_video": "source.mp4",
  "source_image": "character.png",
  "prompt": "A cinematic recast of the character walking through the scene",
  "recast_engine": "ltx25",
  "resolution": "720p",
  "aspect_ratio": "9:16",
  "duration": 6,
  "recast_settings": {
    "audio_mode": "mute",
    "start_image_mode": "identity",
    "source_control": "depth",
    "source_guide_strength": 0.55,
    "control_attention_strength": 0.55,
    "start_image_strength": 1.0,
    "ref_image_strength": 1.0,
    "reference_fit": "pad",
    "seed": 1
  }
}
```

### Generate speech

```json
{
  "text": "This is a test of the Pulse Image voice system.",
  "voice_filename": "voice.wav",
  "engine": "qwen3",
  "language": "English",
  "emotion": "neutral"
}
```

### Generate a song

```json
{
  "style": "cinematic synthwave",
  "lyrics": "Neon lights across the bay",
  "title": "Night Drive",
  "instrumental": false,
  "max_duration": 60
}
```

### Call any REST endpoint

Use `pulse_openapi` to discover endpoints, then:

```json
{
  "method": "GET",
  "path": "/history"
}
```

Generate:

```json
{
  "method": "POST",
  "path": "/generate",
  "body": {
    "mode": "image",
    "prompt": "A lighthouse at dusk",
    "image_model": "schnell"
  }
}
```

---

## Long-running jobs

Image and short jobs usually finish quickly. Video, recast, music, stem, and some story jobs can take minutes.

In the current MCP implementation, generation tool calls wait for the Pulse backend to finish. OpenCode is configured with a 12-hour execution timeout so long videos are not cut off.

For very long work, keep the OpenCode session open and avoid cancelling the tool call. The MCP server's HTTP timeout defaults to 12 hours and can be changed with `PULSE_MCP_HTTP_TIMEOUT` if needed.

---

## Security

The MCP server is currently intended for **local, trusted use only**.

- Bind HTTP transport to `127.0.0.1`.
- Do not expose port `8765` to a public network.
- There is currently no MCP authentication.
- Any local MCP client can generate media and access library assets.
- Do not run the server on an untrusted machine or shared network.

If remote access is needed later, add a bearer token and a tool allowlist first.

---

## Troubleshooting

### `pulse-image` is not connected

```powershell
opencode mcp list
```

Check that:

- `venv/Scripts/python.exe` exists
- `mcp` is installed in that virtual environment
- `mcp_server.py` is in the project root
- OpenCode is running from the project directory

### MCP server starts but tools fail

Start the backend and test it:

```powershell
python main.py
Invoke-RestMethod http://127.0.0.1:8000/comfy/status
```

The MCP server calls the backend at `PULSE_IMAGE_URL`, default `http://127.0.0.1:8000`.

### Backend is on another port

Set the URL when starting the MCP server:

```powershell
venv\Scripts\python.exe mcp_server.py --transport stdio --pulse-url http://127.0.0.1:8001
```

Or set the environment variable:

```powershell
$env:PULSE_IMAGE_URL = "http://127.0.0.1:8001"
```

### Reconnecting OpenCode

Use `/mcps` in OpenCode to reconnect the `pulse-image` server. Restarting the OpenCode session also reloads MCP tools.
