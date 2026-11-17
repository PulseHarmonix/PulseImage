"""Small in-memory registry for generation jobs started through the HTTP API.

The browser queue is local to the React app, so jobs started by MCP or another
API client are otherwise invisible. This registry records each /generate job
and exposes a lightweight snapshot that the frontend can poll.
"""
from __future__ import annotations

import time
from typing import Any

from services.comfy_progress import get_progress

_jobs: dict[str, dict[str, Any]] = {}
_FINISHED_RETENTION_SECONDS = 30
_MAX_JOBS = 100


def _now_ms() -> int:
    return int(time.time() * 1000)


def start_job(
    job_id: str,
    *,
    label: str,
    mode: str,
    client: str = "",
) -> None:
    if not job_id:
        return
    _jobs[job_id] = {
        "id": job_id,
        "label": label,
        "mode": mode if mode in ("image", "video", "speech", "audio", "upscale") else "image",
        "status": "queued",
        "progress": 0,
        "stage": "queued",
        "error": "",
        "client": client,
        "startedAt": _now_ms(),
        "finishedAt": None,
    }
    _trim()


def finish_job(job_id: str, *, error: str | None = None) -> None:
    job = _jobs.get(job_id)
    if not job:
        return
    job["status"] = "error" if error else "done"
    job["progress"] = 0 if error else 100
    job["stage"] = "error" if error else "done"
    job["error"] = error or ""
    job["finishedAt"] = _now_ms()


def _trim() -> None:
    if len(_jobs) <= _MAX_JOBS:
        return
    finished = sorted(
        (job for job in _jobs.values() if job.get("finishedAt")),
        key=lambda job: job["finishedAt"],
    )
    for job in finished[: max(0, len(_jobs) - _MAX_JOBS)]:
        _jobs.pop(job["id"], None)


def list_jobs() -> list[dict[str, Any]]:
    now_ms = _now_ms()
    expire_before = now_ms - _FINISHED_RETENTION_SECONDS * 1000
    jobs: list[dict[str, Any]] = []
    for job_id, source in list(_jobs.items()):
        job = dict(source)
        if job.get("finishedAt") and job["finishedAt"] < expire_before:
            _jobs.pop(job_id, None)
            continue
        if job["status"] == "queued" or job["status"] == "running":
            snapshot = get_progress(job_id)
            if snapshot:
                progress = snapshot.get("workflow_percent")
                if isinstance(progress, (int, float)):
                    job["progress"] = max(0, min(100, round(progress)))
                stage = snapshot.get("stage")
                if stage:
                    job["stage"] = str(stage)
                state = snapshot.get("state")
                if state == "error":
                    job["status"] = "error"
                    job["stage"] = "error"
                    job["error"] = str(snapshot.get("error") or "Generation failed")
                    job["finishedAt"] = now_ms
                elif state in ("running", "finished") or job["progress"] > 0:
                    job["status"] = "running"
                    job["stage"] = "generating" if state != "finished" else "finalizing"
        jobs.append(job)
    jobs.sort(key=lambda job: job.get("startedAt") or 0, reverse=True)
    return jobs
