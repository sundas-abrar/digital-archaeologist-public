from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..services.feedback_store import VALID_TYPES, add_feedback, list_feedback

router = APIRouter(prefix="/api", tags=["feedback"])


class FeedbackIn(BaseModel):
    session_id: Optional[str] = None
    finding_id: Optional[str] = None
    type: str = Field(..., description="one of: " + ", ".join(sorted(VALID_TYPES)))
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    message: Optional[str] = None


@router.post("/feedback")
def submit_feedback(payload: FeedbackIn):
    if payload.type not in VALID_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid feedback type. Must be one of: {', '.join(sorted(VALID_TYPES))}",
        )

    record = add_feedback(payload.model_dump())
    return {"ok": True, "feedback": record}


@router.get("/feedback/{session_id}")
def get_session_feedback(session_id: str):
    return {"session_id": session_id, "feedback": list_feedback(session_id)}
