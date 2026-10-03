from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..config import STORAGE_DIR
from ..services.ask_service import (
    AskFailed,
    AskUnavailable,
    answer_question,
    get_context,
)
from ..services.memory import MAX_ITEM_CHARS, MAX_RAW_ITEMS, clean_history

router = APIRouter(prefix="/api/ask", tags=["ask"])


class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=1000)
    memory: Literal["off", "half", "full"] = "off"
    # Generous bounds here; clean_history applies the real per-mode limit.
    history: list[str] = Field(default_factory=list, max_length=MAX_RAW_ITEMS)


@router.post("/{session_id}")
def ask(session_id: str, body: AskRequest):
    """Answer a question about an uploaded project from its extracted
    evidence, citing the files/commits the answer rests on."""
    extract_dir = STORAGE_DIR / session_id / "extracted"
    if not extract_dir.exists():
        raise HTTPException(status_code=404, detail="Session not found. Upload the archive again.")

    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="Question can't be empty.")

    history = clean_history(
        [h[: MAX_ITEM_CHARS * 2] for h in body.history], body.memory
    )

    try:
        context, allowed = get_context(session_id, extract_dir)
        result = answer_question(context, allowed, question, history)
    except AskUnavailable as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except AskFailed as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    return {"session_id": session_id, **result}
