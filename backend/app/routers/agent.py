from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from ..services.agent_runner import run_agent

router = APIRouter(prefix="/api/agent", tags=["agent"])

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage"


@router.get("/{session_id}/run")
def run(session_id: str, goal: str = "Determine how this project evolved."):
    """Streams the autonomous agent run as Server-Sent Events, one JSON
    event per pipeline step, so the frontend can show it happening live
    instead of one big spinner."""
    extract_dir = STORAGE_DIR / session_id / "extracted"
    if not extract_dir.exists():
        raise HTTPException(status_code=404, detail="Session not found. Upload the archive again.")

    def event_stream():
        try:
            for event in run_agent(extract_dir, goal):
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
