"""Audio stem separation backed by ComfyUI's Demucs custom node."""

from __future__ import annotations

import array
import asyncio
import json
import math
import os
import shutil
import subprocess
import sys
import time
import uuid

import httpx

from config import get_comfyui_url
from services.audio_service import audio_path, delete_audio, get_audio_duration
from services.comfy_progress import post_prompt, set_progress_job
from services.comfy_service import upload_audio_to_comfy
from services.database_service import get_db
from services.generation_service import delete_generation, get_asset_by_id, save_generation

AUDIO_FOLDER = "audio"
MODEL = "htdemucs_6s"
DEMUCS_NODE = "DemucsAudioSeparator"
SEPARATION_TIMEOUT_SECONDS = 3600
WAVEFORM_POINTS = 300
WAVEFORM_SAMPLE_RATE = 4000
AUDIO_EXTENSIONS = (".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".webm", ".opus")

STEMS = (
    ("vocals", "Vocals", 0),
    ("drums", "Drums", 1),
    ("bass", "Bass", 2),
    ("other", "Other", 3),
    ("guitar", "Guitar", 4),
    ("piano", "Piano", 5),
)
STEM_ORDER = {stem: position for position, (stem, _title, _index) in enumerate(STEMS)}

_runs: dict[str, dict] = {}
_source_waveforms: dict[str, list[float]] = {}


def _find_binary(name: str) -> str | None:
    path = shutil.which(name)
    if not path and os.name == "nt":
        path = shutil.which(f"{name}.exe")
    return path


def _save_node_id(index: int) -> str:
    return str(10 + index)


def _parse_metadata(row) -> dict:
    try:
        data = json.loads(row["metadata"] or "{}")
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _is_audio(asset: dict) -> bool:
    if asset.get("type") == "audio":
        return True
    filename = str(asset.get("filename") or "").lower()
    return filename.endswith(AUDIO_EXTENSIONS)


def _asset_duration(asset: dict):
    meta = asset.get("metadata") or {}
    duration = meta.get("duration")
    if duration is None:
        duration = asset.get("duration")
    return duration


def _source_name(asset: dict) -> str:
    meta = asset.get("metadata") or {}
    for key in ("name", "title"):
        value = meta.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    prompt = str(asset.get("prompt") or "").strip()
    if prompt:
        return prompt[:120]
    base = os.path.splitext(str(asset.get("filename") or ""))[0]
    return base or "Audio"


def get_audio_waveform(filename: str, points: int = WAVEFORM_POINTS) -> list[float]:
    """Return normalized peak values for a local audio file, or [] if unavailable."""
    source = audio_path(filename)
    if not os.path.isfile(source):
        return []

    ffmpeg = _find_binary("ffmpeg")
    if not ffmpeg:
        return []

    try:
        result = subprocess.run(
            [
                ffmpeg,
                "-v", "error",
                "-i", source,
                "-vn",
                "-ac", "1",
                "-ar", str(WAVEFORM_SAMPLE_RATE),
                "-f", "s16le",
                "pipe:1",
            ],
            capture_output=True,
            timeout=60,
        )
    except Exception:
        return []

    data = result.stdout or b""
    if result.returncode != 0 or not data:
        return []
    if len(data) % 2:
        data = data[:-1]

    samples = array.array("h")
    samples.frombytes(data)
    if sys.byteorder != "little":
        samples.byteswap()
    if not samples:
        return []

    bucket = max(1, math.ceil(len(samples) / max(1, points)))
    peaks = []
    peak = 0
    for index, sample in enumerate(samples):
        value = abs(sample)
        if value > peak:
            peak = value
        if (index + 1) % bucket == 0:
            peaks.append(peak)
            peak = 0
    if peak:
        peaks.append(peak)
    if not peaks:
        return []

    highest = max(peaks) or 1
    return [round(value / highest, 4) for value in peaks]


def _source_waveform(asset: dict) -> list[float]:
    meta = asset.get("metadata") or {}
    waveform = meta.get("waveform")
    if isinstance(waveform, list):
        return waveform

    filename = str(asset.get("filename") or "")
    if not filename:
        return []
    if filename in _source_waveforms:
        return _source_waveforms[filename]

    waveform = get_audio_waveform(filename)
    _source_waveforms[filename] = waveform
    return waveform


def _source_payload(asset: dict) -> dict:
    return {
        "id": asset.get("id"),
        "name": _source_name(asset),
        "filename": asset.get("filename") or "",
        "duration": _asset_duration(asset),
        "waveform": _source_waveform(asset),
    }


def _stem_payload(asset_id: str, filename: str, name: str, stem: str, duration, waveform) -> dict:
    return {
        "id": asset_id,
        "name": name,
        "stem": stem,
        "filename": filename,
        "duration": duration,
        "waveform": waveform if isinstance(waveform, list) else [],
    }


def _response(asset: dict | None, status: str, error: str | None = None, stems: list[dict] | None = None) -> dict:
    return {
        "success": status != "error",
        "status": status,
        "error": error,
        "source": _source_payload(asset) if asset else None,
        "stems": stems or [],
    }


def get_stem_assets(parent_id: str) -> list[dict]:
    """Return saved stem assets for a source audio asset."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, filename, duration, metadata FROM generations "
        "WHERE parent_id = ? AND type = 'audio' ORDER BY created",
        (parent_id,),
    ).fetchall()
    conn.close()

    stems = []
    for row in rows:
        meta = _parse_metadata(row)
        if meta.get("source") != "stems" and meta.get("kind") != "stem":
            continue
        stem_info = meta.get("stem") or {}
        stem = stem_info.get("stem") if isinstance(stem_info, dict) else ""
        if not isinstance(stem, str) or not stem:
            continue
        duration = meta.get("duration")
        if duration is None:
            duration = row["duration"]
        stems.append(
            _stem_payload(
                row["id"],
                row["filename"] or "",
                meta.get("name") or "",
                stem,
                duration,
                meta.get("waveform"),
            )
        )

    stems.sort(key=lambda item: STEM_ORDER.get(item["stem"], len(STEM_ORDER)))
    return stems


def _delete_existing_stems(parent_id: str) -> None:
    for stem in get_stem_assets(parent_id):
        delete_generation(stem["id"])


async def _resolve_save_format() -> str:
    url = get_comfyui_url().rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{url}/object_info/SaveAudioAdvanced")
            data = (response.json() or {}).get("SaveAudioAdvanced") or {}
            spec = (data.get("input") or {}).get("required", {}).get("format")
            options = []
            if isinstance(spec, list) and len(spec) > 1:
                if isinstance(spec[1], dict):
                    options = spec[1].get("options") or []
                elif isinstance(spec[1], list):
                    options = spec[1]
            keys = [
                item.get("key") if isinstance(item, dict) else item
                for item in options
            ]
            if "wav" in keys:
                return "wav"
            if "flac" in keys:
                return "flac"
    except Exception:
        pass
    return "wav"


async def get_stems_capabilities() -> dict:
    """Return Demucs node availability and ComfyUI connectivity."""
    url = get_comfyui_url().rstrip("/")
    result = {
        "available": False,
        "comfy_connected": False,
        "node_installed": False,
        "model": MODEL,
        "error": None,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                status = await client.get(f"{url}/system_stats")
                result["comfy_connected"] = status.status_code == 200
            except Exception as exc:
                result["error"] = str(exc)
                return result

            try:
                info = await client.get(f"{url}/object_info/{DEMUCS_NODE}")
                result["node_installed"] = info.status_code == 200 and bool(info.json())
            except Exception as exc:
                result["error"] = str(exc)
                return result
    except Exception as exc:
        result["error"] = str(exc)
        return result

    if not result["comfy_connected"]:
        result["error"] = "ComfyUI is not reachable"
    elif not result["node_installed"]:
        result["error"] = f"{DEMUCS_NODE} is not installed in ComfyUI"
    result["available"] = bool(result["comfy_connected"] and result["node_installed"])
    return result


def build_stem_workflow(comfy_audio: str, asset_id: str, save_format: str = "wav") -> dict:
    workflow = {
        "1": {
            "class_type": "LoadAudio",
            "inputs": {"audio": comfy_audio},
        },
        "2": {
            "class_type": DEMUCS_NODE,
            "inputs": {
                "audio": ["1", 0],
                "model": MODEL,
                "device": "cuda",
                "precision": "float16",
                "shifts": 1,
                "overlap": 0.25,
                "split": True,
                "normalize": True,
                "gain_multiplier": 1.0,
                "vocals": True,
                "drums": True,
                "bass": True,
                "other": True,
                "guitar": True,
                "piano": True,
                "instrumental": False,
            },
        },
    }

    for stem, _title, index in STEMS:
        workflow[_save_node_id(index)] = {
            "class_type": "SaveAudioAdvanced",
            "inputs": {
                "audio": ["2", index],
                "filename_prefix": f"audio/stems/{asset_id}/{stem}",
                "format": save_format,
            },
        }
    return workflow


def _audio_output_item(item) -> dict | None:
    if isinstance(item, dict) and item.get("filename"):
        return item
    if isinstance(item, (list, tuple)) and item:
        filename = str(item[0])
        if filename.lower().endswith(AUDIO_EXTENSIONS):
            subfolder = str(item[1]) if len(item) > 1 else ""
            if subfolder.lower() == "output":
                subfolder = ""
            return {"filename": filename, "subfolder": subfolder, "type": "output"}
    return None


def _find_save_output(outputs: dict, node_id: str) -> dict | None:
    out = outputs.get(node_id)
    if not isinstance(out, dict):
        return None
    for key in ("audio", "files", "images"):
        value = out.get(key)
        info = _audio_output_item(value)
        if info:
            return info
        if isinstance(value, (list, tuple)):
            for item in value:
                info = _audio_output_item(item)
                if info:
                    return info
    return None


def _history_error(item: dict) -> str | None:
    status = item.get("status") or {}
    if status.get("status_str") != "error":
        return None
    for msg in status.get("messages") or []:
        if msg and msg[0] == "execution_error":
            detail = msg[1] or {}
            return detail.get("exception_message") or "Stem separation failed"
    return "Stem separation failed"


async def _run_separation(workflow: dict, job_id: str) -> tuple[dict | None, str | None]:
    set_progress_job(job_id, 0)
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await post_prompt(client, workflow)
            if response.status_code != 200:
                try:
                    detail = response.json()
                except Exception:
                    detail = {}
                return None, detail.get("error") or f"ComfyUI error {response.status_code}"
            prompt_id = (response.json() or {}).get("prompt_id")
            if not prompt_id:
                return None, "No prompt_id returned by ComfyUI"

            deadline = time.monotonic() + SEPARATION_TIMEOUT_SECONDS
            while time.monotonic() < deadline:
                await asyncio.sleep(1)
                try:
                    history = (await client.get(f"{get_comfyui_url()}/history/{prompt_id}")).json()
                except Exception:
                    continue
                if prompt_id not in history:
                    continue

                item = history[prompt_id] or {}
                error = _history_error(item)
                if error:
                    return None, error

                outputs = item.get("outputs") or {}
                found = {}
                for stem, _title, index in STEMS:
                    info = _find_save_output(outputs, _save_node_id(index))
                    if info:
                        found[stem] = info
                if len(found) == len(STEMS):
                    return found, None

            return None, "Stem separation timed out or produced no output"
    except Exception as exc:
        return None, str(exc)


def _convert_to_wav(local_filename: str) -> str:
    if os.path.splitext(local_filename)[1].lower() == ".wav":
        return local_filename

    ffmpeg = _find_binary("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required to convert stems to WAV")

    out_filename = f"{uuid.uuid4().hex}.wav"
    source = audio_path(local_filename)
    output = audio_path(out_filename)
    try:
        result = subprocess.run(
            [
                ffmpeg,
                "-y",
                "-v", "error",
                "-i", source,
                "-acodec", "pcm_s16le",
                output,
            ],
            capture_output=True,
            text=True,
            timeout=300,
        )
    except Exception as exc:
        raise RuntimeError(f"Failed to convert stem to WAV: {exc}")

    if result.returncode != 0 or not os.path.isfile(output):
        tail = (result.stderr or "")[-300:]
        raise RuntimeError(f"Failed to convert stem to WAV: {tail}")

    delete_audio(local_filename)
    return out_filename


async def _download_stems(outputs: dict) -> dict[str, str]:
    downloaded = {}
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            for stem, _title, _index in STEMS:
                info = outputs.get(stem)
                if not info:
                    raise RuntimeError(f"Missing {stem} output from Demucs")
                source_filename = str(info.get("filename") or "")
                ext = os.path.splitext(source_filename)[1].lower() or ".wav"
                params = {
                    "filename": source_filename,
                    "subfolder": info.get("subfolder", ""),
                    "type": info.get("type") or "output",
                }
                response = await client.get(f"{get_comfyui_url()}/view", params=params)
                if response.status_code != 200:
                    raise RuntimeError(f"Failed to download {stem} stem")

                local_filename = f"{uuid.uuid4().hex}{ext}"
                os.makedirs(AUDIO_FOLDER, exist_ok=True)
                with open(os.path.join(AUDIO_FOLDER, local_filename), "wb") as handle:
                    handle.write(response.content)
                downloaded[stem] = _convert_to_wav(local_filename)
        return downloaded
    except Exception:
        for local_filename in downloaded.values():
            delete_audio(local_filename)
        raise


def _save_stems(source: dict, downloaded: dict[str, str]) -> list[dict]:
    parent_id = source["id"]
    source_name = _source_name(source)
    _delete_existing_stems(parent_id)

    saved_ids = []
    stems = []
    try:
        for stem, title, _index in STEMS:
            local_filename = downloaded.get(stem)
            if not local_filename:
                raise RuntimeError(f"Missing downloaded {stem} stem")

            duration = get_audio_duration(local_filename)
            waveform = get_audio_waveform(local_filename)
            name = f"{source_name} - {title}"
            metadata = {
                "name": name,
                "source": "stems",
                "kind": "stem",
                "is_music": False,
                "stem": {
                    "parent_id": parent_id,
                    "stem": stem,
                    "model": MODEL,
                },
                "duration": duration,
                "waveform": waveform,
            }
            asset_id = save_generation(
                prompt=name,
                filename=local_filename,
                file_type="audio",
                duration=duration,
                parent_id=parent_id,
                derived_from=[parent_id],
                metadata=metadata,
            )
            saved_ids.append(asset_id)
            stems.append(
                _stem_payload(asset_id, local_filename, name, stem, duration, waveform)
            )
        return stems
    except Exception:
        for asset_id in saved_ids:
            delete_generation(asset_id)
        raise


def get_stems_status(asset_id: str) -> dict:
    """Return the current stem status for an audio asset."""
    asset = get_asset_by_id(asset_id)
    if not asset:
        return _response(None, "error", "Asset not found")
    if not _is_audio(asset):
        return _response(asset, "error", "Asset is not audio")

    stems = get_stem_assets(asset_id)
    if stems:
        return _response(asset, "ready", stems=stems)

    run = _runs.get(asset_id)
    if run and run.get("status") == "running":
        return _response(asset, "running")
    if run and run.get("status") == "error":
        return _response(asset, "error", run.get("error") or "Stem separation failed")

    return _response(asset, "idle")


async def separate_stems(asset_id: str, job_id: str = "") -> dict:
    """Separate an audio asset into stems, blocking until the run completes."""
    asset = get_asset_by_id(asset_id)
    if not asset:
        return _response(None, "error", "Asset not found")
    if not _is_audio(asset):
        return _response(asset, "error", "Asset is not audio")

    stems = get_stem_assets(asset_id)
    if stems:
        return _response(asset, "ready", stems=stems)

    run = _runs.get(asset_id)
    if run and run.get("status") == "running":
        return _response(asset, "running")

    run_job = job_id or uuid.uuid4().hex
    _runs[asset_id] = {
        "job_id": run_job,
        "status": "running",
        "error": None,
        "started": time.monotonic(),
    }

    downloaded = {}
    try:
        capabilities = await get_stems_capabilities()
        if not capabilities.get("available"):
            error = capabilities.get("error") or f"{DEMUCS_NODE} is not available in ComfyUI"
            _runs[asset_id] = {
                "job_id": run_job,
                "status": "error",
                "error": error,
                "started": time.monotonic(),
            }
            return _response(asset, "error", error)

        comfy_audio = await upload_audio_to_comfy(asset["filename"])
        if not comfy_audio:
            raise RuntimeError("Failed to upload source audio to ComfyUI")

        save_format = await _resolve_save_format()
        workflow = build_stem_workflow(comfy_audio, asset_id, save_format)
        outputs, error = await _run_separation(workflow, run_job)
        if error or not outputs:
            raise RuntimeError(error or "Stem separation failed")

        downloaded = await _download_stems(outputs)
        stems = _save_stems(asset, downloaded)
        _runs.pop(asset_id, None)
        return _response(asset, "ready", stems=stems)
    except Exception as exc:
        error = str(exc)
        for local_filename in downloaded.values():
            delete_audio(local_filename)
        _runs[asset_id] = {
            "job_id": run_job,
            "status": "error",
            "error": error,
            "started": time.monotonic(),
        }
        return _response(asset, "error", error)
