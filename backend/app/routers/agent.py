from __future__ import annotations

import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from ..config import STORAGE_DIR
from ..services.agent_runner import run_agent
from ..services.memory_store import recall, remember

router = APIRouter(prefix="/api/agent", tags=["agent"])


@router.get("/{session_id}/run")
def run(
    session_id: str,
    goal: str = Query("Determine how this project evolved.", max_length=500),
    depth: Literal["half", "full"] = "full",
    memory: Literal["off", "half", "full"] = "off",
):
    """Streams the autonomous agent run as Server-Sent Events, one JSON
    event per pipeline step, so the frontend can show it happening live
    instead of one big spinner.

    depth:   "half" skips test execution and the AI narrative.
    memory:  how much saved memory (earlier goals/questions for this
             project) the run may use. "off" reads and saves nothing."""
    extract_dir = STORAGE_DIR / session_id / "extracted"
    if not extract_dir.exists():
        raise HTTPException(status_code=404, detail="Session not found. Upload the archive again.")

    remembered = recall(session_id, memory)  # read first: the new goal isn't its own history
    remember(session_id, memory, "goal", goal)

    def event_stream():
        try:
            for event in run_agent(extract_dir, goal, depth=depth, history=remembered):
                yield f"data: {json.dumps(event, default=str)}\n\n"
        except Exception as e:  # noqa: BLE001 - never let the stream die silently
            error_event = {"step": "error", "status": "failed", "detail": str(e), "data": {}}
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable proxy buffering, if any sits in front
        },
    )
