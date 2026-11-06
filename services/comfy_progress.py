"""Live ComfyUI progress tracking over the /ws WebSocket.

ComfyUI sends execution progress only to the client that submitted the prompt
(matching ``client_id``), so every prompt is posted with a ``client_id`` and a
WebSocket is opened with the same id.

Two percentages are produced:
- ``node_percent``: steps within the current node (``progress`` message).
- ``workflow_percent``: finished nodes + current node fraction / total nodes,
  derived from ``progress_state`` / ``executing`` / ``executed`` / cached nodes.
"""
from __future__ import annotations

import asyncio
import contextvars
import json
import time
import uuid
from typing import Optional

import websockets

from config import get_comfyui_url

_current_job_id: contextvars.ContextVar[str] = contextvars.ContextVar("comfy_job_id", default="")
_current_job_index: contextvars.ContextVar[int] = contextvars.ContextVar("comfy_job_index", default=0)

_trackers: dict[str, "ComfyProgressTracker"] = {}


def set_progress_job(job_id: str, index: int = 0) -> None:
    """Set the job id (and item index) used by the next prompt post."""
    _current_job_id.set(job_id or "")
    _current_job_index.set(int(index or 0))


def get_progress_job() -> str:
    return _current_job_id.get() or ""


def _ws_url(client_id: str) -> str:
    base = get_comfyui_url().rstrip("/")
    if base.startswith("https://"):
        base = "wss://" + base[len("https://"):]
    elif base.startswith("http://"):
        base = "ws://" + base[len("http://"):]
    return f"{base}/ws?clientId={client_id}"


class ComfyProgressTracker:
    def __init__(self, client_id: str, workflow: dict, index: int = 0, stage: str = "generating"):
        self.client_id = client_id
        self.workflow = workflow or {}
        self.index = index
        self.stage = stage or "generating"
        self.total_nodes = max(1, len(self.workflow))
        self.cached_nodes: set[str] = set()
        self.finished_nodes: set[str] = set()
        self.node_states: dict[str, dict] = {}
        self.current_node: Optional[str] = None
        self.node_value = 0.0
        self.node_max = 0.0
        self.state = "connecting"
        self.error = ""
        self.queue_remaining = None
        self.started_at = time.time()
        self.updated_at = self.started_at
        self._ws = None
        self._task = None
        self._watchdog = None
        self._cleanup_task = None

    def _node_title(self, node_id: Optional[str]) -> str:
        if not node_id:
            return ""
        node = self.workflow.get(node_id) or {}
        meta = node.get("_meta") or {}
        return meta.get("title") or node.get("class_type") or str(node_id)

    def snapshot(self) -> dict:
        node_percent = 0
        if self.node_max > 0:
            node_percent = max(0, min(100, round((self.node_value / self.node_max) * 100)))

        effective_total = max(1, self.total_nodes - len(self.cached_nodes))
        finished = len(self.finished_nodes - self.cached_nodes)
        current_fraction = (self.node_value / self.node_max) if self.node_max > 0 else 0.0
        if self.state == "finished":
            workflow_percent = 100
        elif self.state == "error":
            workflow_percent = 0
        else:
            workflow_percent = max(0, min(99, round(((finished + current_fraction) / effective_total) * 100)))

        return {
            "job_id": self.client_id,
            "index": self.index,
            "stage": self.stage,
            "state": self.state,
            "error": self.error,
            "node_id": self.current_node,
            "node_title": self._node_title(self.current_node),
            "node_percent": node_percent,
            "workflow_percent": workflow_percent,
            "node_value": self.node_value,
            "node_max": self.node_max,
            "finished_nodes": len(self.finished_nodes),
            "total_nodes": self.total_nodes,
            "queue_remaining": self.queue_remaining,
        }

    async def start(self) -> None:
        try:
            self._ws = await websockets.connect(
                _ws_url(self.client_id),
                open_timeout=10,
                ping_interval=20,
                max_size=None,
            )
            self.state = "running"
            self._task = asyncio.create_task(self._listen())
            self._watchdog = asyncio.create_task(self._watchdog_loop())
        except Exception as e:
            self.state = "disconnected"
            self.error = str(e)

    async def _watchdog_loop(self) -> None:
        await asyncio.sleep(1800)
        if self.state not in ("finished", "error"):
            self.state = "disconnected"
            self.error = "Progress tracker timed out"
            await self._close_ws()

    async def _listen(self) -> None:
        try:
            async for raw in self._ws:
                if isinstance(raw, (bytes, bytearray)):
                    continue
                try:
                    msg = json.loads(raw)
                except Exception:
                    continue
                self._handle(msg)
                if self.state in ("finished", "error"):
                    break
        except Exception as e:
            if self.state not in ("finished", "error"):
                self.state = "disconnected"
                self.error = str(e)
        finally:
            await self._close_ws()
            self._schedule_cleanup()

    def _handle(self, msg: dict) -> None:
        t = msg.get("type")
        d = msg.get("data") or {}
        self.updated_at = time.time()

        if t == "status":
            try:
                self.queue_remaining = ((d.get("status") or {}).get("exec_info") or {}).get("queue_remaining")
            except Exception:
                pass
        elif t == "execution_start":
            self.state = "running"
            self.current_node = None
            self.node_value = 0.0
            self.node_max = 0.0
        elif t == "execution_cached":
            for nid in d.get("nodes") or []:
                self.cached_nodes.add(str(nid))
        elif t == "executing":
            nid = d.get("node")
            if nid is None:
                self.state = "finished"
            else:
                self.current_node = str(nid)
                self.state = "running"
        elif t == "progress":
            nid = d.get("node")
            if nid is not None:
                self.current_node = str(nid)
            self.node_value = float(d.get("value") or 0)
            self.node_max = float(d.get("max") or 0)
            if self.current_node:
                self.node_states[self.current_node] = {
                    "value": self.node_value,
                    "max": self.node_max,
                    "state": "running",
                }
        elif t == "progress_state":
            for nid, st in (d.get("nodes") or {}).items():
                nid = str(nid)
                val = float(st.get("value") or 0)
                mx = float(st.get("max") or 0)
                state = st.get("state") or "running"
                self.node_states[nid] = {"value": val, "max": mx, "state": state}
                if state == "finished":
                    self.finished_nodes.add(nid)
                elif state == "running":
                    self.current_node = nid
                    self.node_value = val
                    self.node_max = mx
        elif t == "executed":
            nid = d.get("node")
            if nid is not None:
                self.finished_nodes.add(str(nid))
        elif t == "execution_success":
            self.state = "finished"
        elif t == "execution_error":
            self.state = "error"
            self.error = str(d.get("exception_message") or d.get("error") or "Execution error")
        elif t == "execution_interrupted":
            self.state = "error"
            self.error = "Interrupted"

    async def _close_ws(self) -> None:
        if self._ws is not None:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None

    def _schedule_cleanup(self) -> None:
        if self._cleanup_task:
            return
        try:
            self._cleanup_task = asyncio.create_task(self._cleanup())
        except RuntimeError:
            pass

    async def _cleanup(self) -> None:
        await asyncio.sleep(10)
        if _trackers.get(self.client_id) is self:
            _trackers.pop(self.client_id, None)

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
        await self._close_ws()


async def post_prompt(client, workflow: dict, stage: str = "generating"):
    """POST a workflow to ComfyUI with a matching client_id + progress tracker.

    ``stage`` lets the frontend distinguish generation ("generating") from the
    optional RelayVSR pass ("upscaling") while reusing the same job id.
    """
    job_id = get_progress_job() or uuid.uuid4().hex
    index = _current_job_index.get()
    tracker = ComfyProgressTracker(job_id, workflow, index, stage=stage)
    _trackers[job_id] = tracker
    await tracker.start()
    return await client.post(
        f"{get_comfyui_url()}/prompt",
        json={"prompt": workflow, "client_id": job_id},
    )


def get_progress(job_id: str) -> Optional[dict]:
    tracker = _trackers.get(job_id)
    return tracker.snapshot() if tracker else None
