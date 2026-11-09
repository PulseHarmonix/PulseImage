"""Lightworks 2026 export for music video projects.

Builds an FCP7 (XMEML v5) sequence at 24 fps with one video track per
character lane, a full-song audio track, and copies of every used media
file inside a temporary ZIP.

The package ships two interchangeable XMLs:

* ``(portable)`` - no ``<pathurl>`` elements at all, so Lightworks resolves
  media by ``<name>`` from the folder the XML lives in.
* ``(linked)`` - absolute ``file://localhost/`` URLs for tools that need
  an explicit path.

Media is copied to the ZIP root so the portable XML's filename matching
works after extraction. A PowerShell fixer is bundled to regenerate
absolute paths on the user's machine.
"""
from __future__ import annotations

import os
import re
import tempfile
import uuid
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from urllib.parse import quote

from services.audio_service import audio_path, get_audio_duration
from services.generation_service import get_asset_by_id
from services.music_video_service import get_project
from services.video_frame_service import probe_video
from utils.video_workflow_utils import get_video_dimensions

LWKS_FPS = 24
LWKS_MAX_VIDEO_TRACKS = 24
VIDEOS_FOLDER = "videos"


class LwksExportError(Exception):
    """Raised when a Lightworks export cannot be built."""


class LwksProjectNotFound(LwksExportError):
    """Raised when the requested project does not exist."""


def _timecode(frames: int) -> str:
    """Format a frame count as HH:MM:SS:FF at 24 fps."""
    frames = max(0, int(frames))
    seconds, ff = divmod(frames, LWKS_FPS)
    hours, rem = divmod(seconds, 3600)
    minutes, ss = divmod(rem, 60)
    return f"{hours:02d}:{minutes:02d}:{ss:02d}:{ff:02d}"


def _safe_name(value: str, fallback: str = "Music Video") -> str:
    value = re.sub(r'[\\/:*?"<>|\x00-\x1f]+', "-", (value or "").strip())
    value = re.sub(r"\s+", " ", value).strip(" .")
    return value or fallback


def _frames_from_seconds(seconds: float) -> int:
    return max(1, int(round(float(seconds or 0) * LWKS_FPS)))


def _add_rate(parent) -> None:
    rate = ET.SubElement(parent, "rate")
    ET.SubElement(rate, "timebase").text = str(LWKS_FPS)
    ET.SubElement(rate, "ntsc").text = "FALSE"


def _add_video_samplecharacteristics(parent, width: int, height: int) -> None:
    sc = ET.SubElement(parent, "samplecharacteristics")
    _add_rate(sc)
    ET.SubElement(sc, "width").text = str(int(width))
    ET.SubElement(sc, "height").text = str(int(height))
    ET.SubElement(sc, "anamorphic").text = "FALSE"
    ET.SubElement(sc, "pixelaspectratio").text = "square"
    ET.SubElement(sc, "fielddominance").text = "none"


def _add_audio_samplecharacteristics(parent) -> None:
    sc = ET.SubElement(parent, "samplecharacteristics")
    ET.SubElement(sc, "depth").text = "16"
    ET.SubElement(sc, "samplerate").text = "48000"


def _media_pathurl(path: str, style: str = "localhost") -> str:
    """Return an absolute FCP7 media URL for ``path``.

    ``localhost`` produces ``file://localhost/C:/...`` with URI-escaped
    characters; ``file-uri`` produces the standard ``file:///C:/...`` form.
    """
    resolved = Path(path).resolve()
    if style == "file-uri":
        return resolved.as_uri()
    posix = resolved.as_posix()
    return "file://localhost/" + quote(posix, safe="/:")


def _add_video_file(clipitem, clip: dict, include_pathurl: bool, path_style: str) -> None:
    file_el = ET.SubElement(clipitem, "file", {"id": f"file-{uuid.uuid4()}"})
    ET.SubElement(file_el, "name").text = clip["filename"]
    if include_pathurl:
        ET.SubElement(file_el, "pathurl").text = _media_pathurl(clip["source"], path_style)
    _add_rate(file_el)
    ET.SubElement(file_el, "duration").text = str(clip["source_frames"])
    media = ET.SubElement(file_el, "media")
    video = ET.SubElement(media, "video")
    _add_video_samplecharacteristics(video, clip["width"], clip["height"])


def _add_video_clipitem(
    track, clip: dict, include_pathurl: bool, path_style: str
) -> None:
    clipitem = ET.SubElement(track, "clipitem", {"id": f"clipitem-{uuid.uuid4()}"})
    ET.SubElement(clipitem, "name").text = f'{clip["character"]} - {_timecode(clip["start_frame"])}'
    ET.SubElement(clipitem, "duration").text = str(clip["source_out"])
    _add_rate(clipitem)
    ET.SubElement(clipitem, "start").text = str(clip["start_frame"])
    ET.SubElement(clipitem, "end").text = str(clip["end_frame"])
    ET.SubElement(clipitem, "in").text = "0"
    ET.SubElement(clipitem, "out").text = str(clip["source_out"])
    _add_video_file(clipitem, clip, include_pathurl, path_style)


def _add_audio_clipitem(
    track, audio: dict, include_pathurl: bool, path_style: str
) -> None:
    clipitem = ET.SubElement(track, "clipitem", {"id": f"clipitem-{uuid.uuid4()}"})
    ET.SubElement(clipitem, "name").text = audio["name"]
    ET.SubElement(clipitem, "duration").text = str(audio["frames"])
    _add_rate(clipitem)
    ET.SubElement(clipitem, "start").text = "0"
    ET.SubElement(clipitem, "end").text = str(audio["frames"])
    ET.SubElement(clipitem, "in").text = "0"
    ET.SubElement(clipitem, "out").text = str(audio["frames"])
    file_el = ET.SubElement(clipitem, "file", {"id": f"file-{uuid.uuid4()}"})
    ET.SubElement(file_el, "name").text = audio["filename"]
    if include_pathurl:
        ET.SubElement(file_el, "pathurl").text = _media_pathurl(
            audio["source"], path_style
        )
    _add_rate(file_el)
    ET.SubElement(file_el, "duration").text = str(audio["frames"])
    media = ET.SubElement(file_el, "media")
    audio_media = ET.SubElement(media, "audio")
    _add_audio_samplecharacteristics(audio_media)
    ET.SubElement(audio_media, "channelcount").text = "2"
    sourcetrack = ET.SubElement(clipitem, "sourcetrack")
    ET.SubElement(sourcetrack, "mediatype").text = "audio"
    ET.SubElement(sourcetrack, "trackindex").text = "1"


def _project_audio(project: dict) -> dict:
    audio = project.get("audio") or {}
    filename = audio.get("filename")
    if not filename:
        raise LwksExportError("No audio track set for this project")
    source = audio_path(filename)
    if not os.path.isfile(source):
        raise LwksExportError("Project audio file is missing")
    duration = get_audio_duration(filename)
    if not duration or duration <= 0:
        raise LwksExportError("Could not determine project audio duration")
    name = (audio.get("name") or "").strip() or os.path.splitext(os.path.basename(filename))[0]
    return {
        "filename": os.path.basename(filename),
        "source": source,
        "frames": _frames_from_seconds(duration),
        "duration": float(duration),
        "name": name,
    }


def _resolve_video(seg: dict) -> tuple[str, str]:
    """Return (filename, source path) for a segment's generated video."""
    asset = get_asset_by_id(seg["video_asset_id"]) if seg.get("video_asset_id") else None
    candidates = []
    if seg.get("video_filename"):
        candidates.append(seg["video_filename"])
    if asset and asset.get("filename"):
        candidates.append(asset["filename"])
    for filename in candidates:
        source = os.path.join(VIDEOS_FOLDER, filename)
        if os.path.isfile(source):
            return filename, source
    return (candidates[0] if candidates else ""), ""


def _collect_slots(project: dict, song_frames: int) -> tuple[list[dict], list[str], list[str]]:
    slots_out = []
    missing = []
    warnings = []

    for slot in project.get("slots") or []:
        character = (slot.get("name") or "Character").strip() or "Character"
        slot_number = int(slot.get("slot_number") or 0)
        clips = []
        segments = sorted(
            slot.get("segments") or [],
            key=lambda s: (float(s.get("start_time") or 0), float(s.get("end_time") or 0)),
        )
        for seg in segments:
            start = float(seg.get("start_time") or 0)
            end = float(seg.get("end_time") or 0)
            filename, source = _resolve_video(seg)
            stamp = f"{character} | {start:.3f}s - {end:.3f}s | {_timecode(round(start * LWKS_FPS))}"
            if not filename:
                missing.append(f"{stamp} | no generated video")
                continue
            if not source:
                missing.append(f"{stamp} | missing video file: {filename}")
                continue

            try:
                info = probe_video(filename)
            except Exception:
                missing.append(f"{stamp} | unreadable video file: {filename}")
                continue

            if end <= start:
                warnings.append(f"{character} segment at {start:.3f}s has no duration; skipped")
                continue

            start_frame = int(round(start * LWKS_FPS))
            end_frame = int(round(end * LWKS_FPS))
            if start_frame < 0:
                warnings.append(
                    f"{character} segment at {start:.3f}s starts before 0; clamped"
                )
                start_frame = 0
            if start_frame >= song_frames:
                warnings.append(
                    f"{character} segment at {_timecode(start_frame)} starts after the song end; skipped"
                )
                continue
            if end_frame > song_frames:
                warnings.append(
                    f"{character} segment at {_timecode(start_frame)} extended past the song end; clamped"
                )
                end_frame = song_frames
            if end_frame <= start_frame:
                continue

            segment_frames = end_frame - start_frame
            source_frames = int(round(float(info.get("duration") or 0) * LWKS_FPS))
            if source_frames <= 0:
                source_frames = int(info.get("frame_count") or 0)
            if source_frames <= 0:
                source_frames = segment_frames
                warnings.append(
                    f"{character} segment at {_timecode(start_frame)} has unknown source duration; "
                    "using segment length"
                )
            source_out = min(segment_frames, source_frames)
            if source_out <= 0:
                missing.append(f"{stamp} | unreadable video file: {filename}")
                continue
            if source_out < segment_frames:
                end_frame = start_frame + source_out
                warnings.append(
                    f"{character} segment at {_timecode(start_frame)} is shorter than its "
                    "timeline range; timeline clip trimmed to available media"
                )

            clips.append({
                "slot_number": slot_number,
                "character": character,
                "filename": filename,
                "source": source,
                "start_frame": start_frame,
                "end_frame": end_frame,
                "source_frames": source_frames,
                "source_out": source_out,
                "width": int(info.get("width") or 0),
                "height": int(info.get("height") or 0),
                "lane": 0,
            })

        if clips:
            slots_out.append({
                "slot_number": slot_number,
                "character": character,
                "clips": clips,
            })

    return slots_out, missing, warnings


def _assign_lanes(clips: list[dict]) -> list[list[dict]]:
    """Pack a character's clips into the fewest non-overlapping lanes."""
    lanes: list[list[dict]] = []
    for clip in sorted(clips, key=lambda c: (c["start_frame"], c["end_frame"])):
        for index, lane in enumerate(lanes):
            if lane[-1]["end_frame"] <= clip["start_frame"]:
                clip["lane"] = index
                lane.append(clip)
                break
        else:
            clip["lane"] = len(lanes)
            lanes.append([clip])
    return lanes


def _build_tracks(slots: list[dict]) -> list[dict]:
    """Return logical tracks in top-to-bottom order (slot 1 first)."""
    tracks = []
    for slot in slots:
        for lane_index, lane in enumerate(_assign_lanes(slot["clips"])):
            tracks.append({
                "character": slot["character"],
                "slot_number": slot["slot_number"],
                "lane": lane_index,
                "clips": lane,
            })
    return tracks


def _sequence_dimensions(settings: dict) -> tuple[int, int]:
    try:
        width, height = get_video_dimensions(
            settings.get("resolution") or "720p",
            settings.get("aspect_ratio") or "3:2",
        )
    except Exception:
        width = height = 0
    return int(width or 0), int(height or 0)


def _apply_dimensions(tracks: list[dict], width: int, height: int) -> tuple[int, int]:
    if width <= 0 or height <= 0:
        for track in tracks:
            for clip in track["clips"]:
                if clip["width"] > 0 and clip["height"] > 0:
                    width, height = clip["width"], clip["height"]
                    break
            if width > 0 and height > 0:
                break
    if width <= 0 or height <= 0:
        width, height = 1280, 720
    for track in tracks:
        for clip in track["clips"]:
            if clip["width"] <= 0 or clip["height"] <= 0:
                clip["width"] = width
                clip["height"] = height
    return width, height


def _build_xml(
    project_title: str,
    song_frames: int,
    width: int,
    height: int,
    xml_tracks: list[dict],
    audio: dict,
    include_pathurl: bool = False,
    path_style: str = "localhost",
) -> str:
    xmeml = ET.Element("xmeml", {"version": "5"})
    sequence = ET.SubElement(xmeml, "sequence")
    ET.SubElement(sequence, "name").text = project_title
    ET.SubElement(sequence, "duration").text = str(song_frames)
    _add_rate(sequence)

    timecode = ET.SubElement(sequence, "timecode")
    _add_rate(timecode)
    ET.SubElement(timecode, "string").text = "00:00:00:00"
    ET.SubElement(timecode, "frame").text = "0"
    ET.SubElement(timecode, "displayformat").text = "NDF"

    media = ET.SubElement(sequence, "media")
    video = ET.SubElement(media, "video")
    video_format = ET.SubElement(video, "format")
    _add_video_samplecharacteristics(video_format, width, height)
    for track_plan in xml_tracks:
        track = ET.SubElement(video, "track")
        for clip in track_plan["clips"]:
            _add_video_clipitem(track, clip, include_pathurl, path_style)

    audio_media = ET.SubElement(media, "audio")
    ET.SubElement(audio_media, "numOutputChannels").text = "2"
    audio_format = ET.SubElement(audio_media, "format")
    _add_audio_samplecharacteristics(audio_format)
    audio_track = ET.SubElement(audio_media, "track")
    _add_audio_clipitem(audio_track, audio, include_pathurl, path_style)

    ET.indent(xmeml, space="  ")
    body = ET.tostring(xmeml, encoding="unicode")
    return '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n' + body


def _build_readme(
    project_title: str,
    tracks: list[dict],
    width: int,
    height: int,
    audio: dict,
    warnings: list[str],
) -> str:
    track_count = len(tracks)
    lines = [
        "Lightworks 2026 Import Notes",
        "============================",
        "",
        f"Project: {project_title}",
        f"Sequence: {width}x{height}, 24 fps, timecode 00:00:00:00",
        f"Audio: {audio['name']} on A1, full song from 0.0s to {audio['duration']:.3f}s",
        "",
        "IMPORTANT: Extract this ZIP to a normal folder first.",
        "Keep the XML files and the media files together in the same folder.",
        "Do not open or drag an XML straight out of the ZIP preview.",
        "",
        "How to import:",
        "  1. Extract the whole ZIP to a folder you control.",
        "  2. Open Lightworks and use the Import panel (do not drag-and-drop",
        "     the XML onto the timeline).",
        "  3. In the Import panel, open Interchange options.",
        "  4. Choose Simple Scan first and import the portable XML:",
        "       '<project> - Lightworks (portable).xml'",
        "     It has no <pathurl> entries, so Lightworks matches media by the",
        "     <name> values against the files sitting next to the XML.",
        "  5. If clips are still offline, repeat the import with Thorough Scan.",
        "  6. If media is still offline, run 'Fix-Lightworks-Paths.bat'.",
        "     It creates two machine-specific XMLs in the same folder:",
        "       '<project> - Lightworks (portable) (fixed-localhost).xml'",
        "       '<project> - Lightworks (portable) (fixed-file-uri).xml'",
        "     Import those instead. The original portable XML is untouched.",
        "",
        "A relative <pathurl> is deliberately not used: FCP7/Lightworks does",
        "not reliably resolve relative media URLs. The portable XML therefore",
        "omits <pathurl> entirely and relies on filename matching.",
        "",
        "The package also contains a '(linked)' XML with absolute",
        "file://localhost/ URLs. It is useful when the media stays at the",
        "exact path it had on the machine that exported the package.",
        "",
        "The full song is on A1. Video tracks contain video-only clips;",
        "generated clip audio is intentionally not used.",
        "",
        f"Video track map ({track_count} tracks; V1 = bottom, V{track_count} = top):",
    ]
    for vnum, track in enumerate(reversed(tracks), start=1):
        lane = "primary" if track["lane"] == 0 else f"overflow {track['lane']}"
        lines.append(f"  V{vnum}: {track['character']} ({lane})")
    lines.extend([
        "",
        "Notes:",
        "- Sequence and clip rates are 24 fps.",
        "- File metadata uses each source clip's actual width, height, and duration.",
        "- Segments extending beyond the song duration are clamped to the song end.",
        "- Segments without a generated video, or with a missing/unreadable file,",
        "  are listed in missing-clips.txt and are not included.",
    ])
    if warnings:
        lines.append("")
        lines.append("Warnings:")
        for warning in warnings:
            lines.append(f"- {warning}")
    return "\n".join(lines) + "\n"


def _build_missing_report(missing: list[str]) -> str:
    lines = [
        "Segments skipped (no generated video or missing/unreadable file)",
        "==============================================================",
        "",
    ]
    lines.extend(missing or ["None."])
    return "\n".join(lines) + "\n"


def _build_fixer_script() -> str:
    return r"""# Fix-Lightworks-Paths.ps1
# Builds machine-specific copies of the portable Lightworks XML with absolute
# <pathurl> values. The original portable XML is never modified.

$ErrorActionPreference = 'Stop'

$scriptPath = $MyInvocation.MyCommand.Path
if (-not $scriptPath) {
    Write-Host "ERROR: Could not determine the script location." -ForegroundColor Red
    exit 1
}
$root = Split-Path -Parent $scriptPath
if (-not (Test-Path -LiteralPath $root -PathType Container)) {
    Write-Host "ERROR: Could not locate the folder containing this script." -ForegroundColor Red
    exit 1
}

$portable = Get-ChildItem -LiteralPath $root -Filter '* - Lightworks (portable).xml' -File |
    Select-Object -First 1
if (-not $portable) {
    Write-Host "ERROR: No '* - Lightworks (portable).xml' file was found in:" -ForegroundColor Red
    Write-Host "  $root"
    Write-Host "Extract the ZIP first, then run this script from the extracted folder."
    exit 1
}

$base = [System.IO.Path]::GetFileNameWithoutExtension($portable.Name)
$localhostOut = Join-Path $root ("{0} (fixed-localhost).xml" -f $base)
$fileUriOut = Join-Path $root ("{0} (fixed-file-uri).xml" -f $base)

function ConvertTo-LocalhostUrl {
    param([string]$Path)
    $full = [System.IO.Path]::GetFullPath($Path)
    $uri = New-Object System.Uri($full)
    $escapedPath = $uri.AbsolutePath
    if (-not $escapedPath.StartsWith('/')) {
        $escapedPath = '/' + $escapedPath
    }
    return 'file://localhost' + $escapedPath
}

function ConvertTo-FileUri {
    param([string]$Path)
    $full = [System.IO.Path]::GetFullPath($Path)
    return (New-Object System.Uri($full)).AbsoluteUri
}

$missing = New-Object System.Collections.Generic.List[string]

function Write-FixedXml {
    param(
        [string]$SourceFile,
        [string]$Destination,
        [string]$Style
    )

    $doc = New-Object System.Xml.XmlDocument
    $doc.PreserveWhitespace = $false
    $doc.Load($SourceFile)

    $files = $doc.SelectNodes('//file')
    $count = 0
    foreach ($fileNode in $files) {
        $nameNode = $fileNode.SelectSingleNode('name')
        if ($null -eq $nameNode) {
            continue
        }
        $name = $nameNode.InnerText
        if ([string]::IsNullOrWhiteSpace($name)) {
            continue
        }

        $mediaPath = Join-Path $root $name
        if (-not (Test-Path -LiteralPath $mediaPath -PathType Leaf)) {
            if (-not $missing.Contains($name)) {
                $missing.Add($name)
            }
            continue
        }

        if ($Style -eq 'file-uri') {
            $url = ConvertTo-FileUri -Path $mediaPath
        }
        else {
            $url = ConvertTo-LocalhostUrl -Path $mediaPath
        }

        $pathurlNode = $fileNode.SelectSingleNode('pathurl')
        if ($null -eq $pathurlNode) {
            $pathurlNode = $doc.CreateElement('pathurl')
            [void]$nameNode.ParentNode.InsertAfter($pathurlNode, $nameNode)
        }
        $pathurlNode.InnerText = $url
        $count = $count + 1
    }

    $doc.Save($Destination)
    Write-Host "Wrote $Destination ($count media paths)"
}

Write-Host "Lightworks path fixer"
Write-Host "====================="
Write-Host "Folder: $root"
Write-Host "Portable XML: $($portable.Name)"
Write-Host ""

Write-FixedXml -SourceFile $portable.FullName -Destination $localhostOut -Style 'localhost'
Write-FixedXml -SourceFile $portable.FullName -Destination $fileUriOut -Style 'file-uri'

Write-Host ""
if ($missing.Count -gt 0) {
    Write-Host "WARNING: These media files were not found next to the XML:" -ForegroundColor Yellow
    foreach ($name in $missing) {
        Write-Host "  - $name" -ForegroundColor Yellow
    }
    Write-Host "Keep the media files and the XML together in the same folder."
    Write-Host ""
}

Write-Host "Done. Try the '(fixed-localhost)' XML first, then '(fixed-file-uri)'."
Write-Host "Use the Lightworks Import panel with Interchange > Thorough Scan."
"""


def _build_fixer_launcher() -> str:
    return r"""@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Fix-Lightworks-Paths.ps1"
set "EXITCODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXITCODE%
"""


def _queue_media(
    media_files: list[tuple[str, str]],
    seen: set[str],
    used_names: set[str],
    source: str,
    filename: str,
) -> None:
    key = os.path.normcase(os.path.abspath(source))
    if key in seen:
        return
    seen.add(key)

    base = os.path.basename(filename) or "media"
    arcname = base
    stem, ext = os.path.splitext(base)
    counter = 2
    while arcname.lower() in used_names:
        arcname = f"{stem} ({counter}){ext}"
        counter += 1
    used_names.add(arcname.lower())
    media_files.append((source, arcname))


def build_lwks_zip(project_id: str) -> tuple[str, str]:
    """Build a Lightworks ZIP package and return (zip path, download name)."""
    project = get_project(project_id)
    if not project:
        raise LwksProjectNotFound("Project not found")

    audio = _project_audio(project)
    song_frames = audio["frames"]

    settings = project.get("settings") or {}
    width, height = _sequence_dimensions(settings)

    slots, missing, warnings = _collect_slots(project, song_frames)
    if not slots:
        raise LwksExportError("No generated segment videos available for this project")

    tracks = _build_tracks(slots)
    if len(tracks) > LWKS_MAX_VIDEO_TRACKS:
        raise LwksExportError(
            f"Lightworks supports at most {LWKS_MAX_VIDEO_TRACKS} video tracks; "
            f"this project needs {len(tracks)}."
        )

    width, height = _apply_dimensions(tracks, width, height)

    project_title = (project.get("title") or "Untitled Music Video").strip() or "Untitled Music Video"
    safe_title = _safe_name(project_title, "Music Video")
    portable_name = f"{safe_title} - Lightworks (portable).xml"
    linked_name = f"{safe_title} - Lightworks (linked).xml"
    zip_name = f"{safe_title} - Lightworks.zip"

    xml_tracks = list(reversed(tracks))
    portable_xml = _build_xml(
        project_title, song_frames, width, height, xml_tracks, audio,
        include_pathurl=False,
    )
    linked_xml = _build_xml(
        project_title, song_frames, width, height, xml_tracks, audio,
        include_pathurl=True, path_style="localhost",
    )
    readme_text = _build_readme(project_title, tracks, width, height, audio, warnings)
    missing_text = _build_missing_report(missing)
    fixer_script = _build_fixer_script()
    fixer_launcher = _build_fixer_launcher()

    media_files: list[tuple[str, str]] = []
    seen: set[str] = set()
    used_names: set[str] = set()
    for track in tracks:
        for clip in track["clips"]:
            _queue_media(media_files, seen, used_names, clip["source"], clip["filename"])
    _queue_media(media_files, seen, used_names, audio["source"], audio["filename"])

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    tmp_path = tmp.name
    tmp.close()
    try:
        with zipfile.ZipFile(tmp_path, "w") as zf:
            zf.writestr(portable_name, portable_xml, compress_type=zipfile.ZIP_DEFLATED)
            zf.writestr(linked_name, linked_xml, compress_type=zipfile.ZIP_DEFLATED)
            zf.writestr("README.txt", readme_text, compress_type=zipfile.ZIP_DEFLATED)
            zf.writestr("missing-clips.txt", missing_text, compress_type=zipfile.ZIP_DEFLATED)
            zf.writestr(
                "Fix-Lightworks-Paths.ps1", fixer_script,
                compress_type=zipfile.ZIP_DEFLATED,
            )
            zf.writestr(
                "Fix-Lightworks-Paths.bat", fixer_launcher,
                compress_type=zipfile.ZIP_DEFLATED,
            )
            for source, arcname in media_files:
                zf.write(source, arcname, compress_type=zipfile.ZIP_STORED)
    except Exception as e:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
        raise LwksExportError(f"Failed to build Lightworks archive: {e}") from e

    return tmp_path, zip_name
