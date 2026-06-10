import os
import zipfile
from io import BytesIO
import re
import subprocess
import tempfile
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse,JSONResponse
from services.generation_service import load_generations
from services.story_service import (
    ollama_story_breakdown,
    ollama_scene_prompt,
)

# Optional OpenCV for pure-Python video trimming fallback (no system ffmpeg required).
# Re-encodes, so slower and slightly lower quality than ffmpeg -c copy, but works everywhere.
try:
    import cv2
    HAS_OPENCV = True
except ImportError:
    HAS_OPENCV = False
    cv2 = None

# ==================== STORY MODE ENDPOINTS (Ollama two-pass + timeline apply) ====================


router = APIRouter()

@router.post("/story/breakdown")
async def story_breakdown(request: Request):
    try:
        data = await request.json()
        story_text = (data.get("story_text") or data.get("story") or "").strip()
        characters = data.get("characters") or []
        num_scenes = data.get("num_scenes")
        target_seconds = data.get("target_seconds")
        style = data.get("style") or data.get("mood")
        debug = bool(data.get("debug"))
        if not story_text:
            return {"success": False, "error": "story_text is required"}
        result = await ollama_story_breakdown(story_text, characters, num_scenes, target_seconds, style, debug=debug)
        resp = {"success": True, "scenes": result.get("scenes", []), "error": result.get("error"), "raw": result.get("raw")}
        if debug and "debug" in result:
            resp["debug"] = result["debug"]
        return resp
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}

@router.post("/story/generate-prompt")
async def story_generate_prompt(request: Request):
    try:
        data = await request.json()
        story_text = (data.get("story_text") or data.get("story") or "").strip()
        characters = data.get("characters") or []
        scene = data.get("scene") or {}
        style = data.get("style") or data.get("mood")
        if not story_text or not scene:
            return {"success": False, "error": "story_text and scene are required"}
        result = await ollama_scene_prompt(story_text, characters, scene, style)
        return {"success": True, "prompt": result.get("prompt", ""), "error": result.get("error")}
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


@router.post("/export-sequence")
async def export_sequence(request: Request):
    try:
        data = await request.json()
        items = data.get("items", [])
        project_name = data.get("project_name", "sequence")
        if not items:
            return JSONResponse({"success": False, "error": "No items to export"}, status_code=400)

        generations = load_generations()
        asset_map = {g.get("id"): g for g in generations if g.get("id")}

        zip_buffer = BytesIO()
        safe_name = re.sub(r'[^a-zA-Z0-9_-]', '_', str(project_name))[:60] or "sequence"

        trim_warnings = []

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for item in items:
                aid = item.get("asset_id")
                dname = item.get("desired_name")
                offset = float(item.get("video_start_offset", 0) or 0)
                if not aid or not dname:
                    continue
                g = asset_map.get(aid)
                if not g:
                    continue
                fname = g.get("filename")
                if not fname:
                    continue
                ftype = g.get("type", "image")
                is_vid = (ftype == "video") or str(fname).lower().endswith(('.mp4', '.mov', '.webm', '.avi'))
                folder = "videos" if is_vid else "images"
                fpath = os.path.join(folder, fname)
                if not os.path.isfile(fpath):
                    continue

                if is_vid and offset > 0.001:
                    # Trim video starting at offset (to end or to original remaining duration)
                    meta = g.get("metadata", {}) or {}
                    orig_dur = float(meta.get("duration") or 0)
                    trim_dur = max(0.1, orig_dur - offset) if orig_dur > offset else None

                    trimmed_success = False
                    trim_method = None

                    # 1. Preferred: ffmpeg (fast, copy if possible)
                    try:
                        with tempfile.TemporaryDirectory() as tmpdir:
                            orig_ext = os.path.splitext(fname)[1] or ".mp4"
                            trimmed_path = os.path.join(tmpdir, f"trimmed{orig_ext}")
                            cmd = [
                                "ffmpeg", "-y",
                                "-ss", str(offset),
                                "-i", fpath,
                            ]
                            if trim_dur:
                                cmd += ["-t", str(trim_dur)]
                            cmd += [
                                "-c", "copy",
                                "-avoid_negative_ts", "make_non_negative",
                                "-movflags", "+faststart",
                                trimmed_path
                            ]
                            subprocess.run(cmd, check=True, capture_output=True)
                            zf.write(trimmed_path, arcname=dname)
                            trimmed_success = True
                            trim_method = "ffmpeg"
                    except Exception as ffmpeg_err:
                        print(f"ffmpeg trim failed for {fname} @ {offset}s: {ffmpeg_err}")

                    # 2. Python-only fallback using OpenCV (re-encodes, no ffmpeg needed)
                    if not trimmed_success and HAS_OPENCV:
                        try:
                            with tempfile.TemporaryDirectory() as tmpdir:
                                orig_ext = os.path.splitext(fname)[1] or ".mp4"
                                trimmed_path = os.path.join(tmpdir, f"trimmed{orig_ext}")
                                trim_video_opencv(fpath, trimmed_path, offset, trim_dur)
                                zf.write(trimmed_path, arcname=dname)
                                trimmed_success = True
                                trim_method = "opencv"
                        except Exception as opencv_err:
                            print(f"OpenCV trim fallback also failed for {fname}: {opencv_err}")

                    if not trimmed_success:
                        # Ultimate fallback: include the full original
                        warning_msg = f"Could not trim '{dname}' (offset {offset}s from '{fname}') - included full original video instead (no working trim method)."
                        print("Warning: " + warning_msg)
                        trim_warnings.append(warning_msg)
                        zf.write(fpath, arcname=dname)
                    else:
                        print(f"Successfully trimmed {dname} using {trim_method}")
                else:
                    # Image or video with no/zero offset: use as-is
                    zf.write(fpath, arcname=dname)

            if trim_warnings:
                warning_text = "TRIM WARNINGS - Some videos could not be trimmed and full originals were included instead:\n\n" + "\n".join(trim_warnings)
                zf.writestr("TRIM_WARNINGS.txt", warning_text)

        zip_buffer.seek(0)

        response = StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{safe_name}.zip"'}
        )

        if trim_warnings:
            # Send a header so the frontend can show a user warning
            response.headers["X-Trim-Warnings"] = "Some videos could not be trimmed properly. See TRIM_WARNINGS.txt inside the zip for details."

        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

def trim_video_opencv(input_path: str, output_path: str, start_sec: float, trim_dur: float | None = None):
    """Trim video starting at start_sec for trim_dur seconds (or to end if None).
    Pure Python using OpenCV (re-encodes the output).
    Uses time-based seeking (POS_MSEC) for better support of sub-second / millisecond offsets.
    """
    if not HAS_OPENCV or cv2 is None:
        raise RuntimeError("OpenCV (opencv-python-headless) is not installed")

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video file: {input_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    # Use millisecond-precise time-based seek (better for non-integer offsets)
    cap.set(cv2.CAP_PROP_POS_MSEC, start_sec * 1000.0)

    # Prefer H.264 (avc1) if available for better compatibility, fall back to mp4v
    fourcc = cv2.VideoWriter_fourcc(*"avc1")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
    if not out.isOpened():
        # fallback codec
        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        if not out.isOpened():
            raise RuntimeError("Could not open VideoWriter for output (codec issue?)")

    # Compute how many frames to write based on duration if provided
    max_frames = int(trim_dur * fps) if trim_dur else None
    written = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if max_frames is not None and written >= max_frames:
            break
        out.write(frame)
        written += 1

    cap.release()
    out.release()