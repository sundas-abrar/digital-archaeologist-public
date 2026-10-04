from __future__ import annotations

import re
import sqlite3
from typing import Literal

from fastapi import APIRouter, HTTPException

from ..config import STORAGE_DIR
from ..services import memory_store

router = APIRouter(prefix="/api/memory", tags=["memory"])

_SESSION_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def _require_session(session_id: str) -> None:
    if not _SESSION_ID.match(session_id) or not (STORAGE_DIR / session_id / "extracted").exists():
        raise HTTPException(status_code=404, detail="Session not found. Upload the archive again.")


@router.get("/{session_id}")
def get_memory(session_id: str, mode: Literal["off", "half", "full"] = "half"):
    """What the agent remembers about this project. `sent` is the part a
    request in `mode` would actually use; `stored` is everything saved."""
    _require_session(session_id)
    try:
        sent = memory_store.recall_entries(session_id, mode)
        stored = memory_store.count(session_id)
    except (sqlite3.Error, OSError) as e:
        raise HTTPException(status_code=503, detail=f"Memory store unavailable: {e}") from e
    return {"session_id": session_id, "mode": mode, "sent": sent, "stored": stored}


@router.delete("/{session_id}")
def forget(session_id: str):
    """Forget everything remembered for this project."""
    _require_session(session_id)
    try:
        cleared = memory_store.clear(session_id)
    except (sqlite3.Error, OSError) as e:
        raise HTTPException(status_code=503, detail=f"Memory store unavailable: {e}") from e
    return {"session_id": session_id, "cleared": cleared}


@router.post("/{session_id}/pin/{item_id}")
def pin_item(session_id: str, item_id: int, pinned: bool = True):
    """Pin (or unpin) one memory item so pruning never drops it."""
    _require_session(session_id)
    try:
        ok = memory_store.pin(session_id, item_id, pinned)
    except (sqlite3.Error, OSError) as e:
        raise HTTPException(status_code=503, detail=f"Memory store unavailable: {e}") from e
    if not ok:
        raise HTTPException(status_code=409, detail="Item not found, or the pin limit is reached.")
    return {"session_id": session_id, "id": item_id, "pinned": pinned}
