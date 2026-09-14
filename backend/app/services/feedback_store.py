"""
"Help Us Improve" feedback storage.

No database in this project, so feedback is kept as an append-only
JSONL file at backend/storage/feedback.jsonl \u2014 one JSON object per
line. Simple, human-readable, survives individual upload sessions
being cleared.

This does NOT feed back into the AI prompt automatically (that would
need real persistence + evaluation, out of scope for this pass). It's
a durable record a human can review, and a foundation future work can
build a learning loop on top of.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage"
FEEDBACK_FILE = STORAGE_DIR / "feedback.jsonl"

VALID_TYPES = {
    "correct",
    "incorrect",
    "improve",
    "bug",
    "ai_suggestion",
    "rating",
    "missing_evidence",
    "general",
}


def add_feedback(entry: dict[str, Any]) -> dict[str, Any]:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    record = {
        "id": uuid.uuid4().hex[:12],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "session_id": entry.get("session_id"),
        "finding_id": entry.get("finding_id"),
        "type": entry.get("type"),
        "rating": entry.get("rating"),
        "message": (entry.get("message") or "").strip()[:2000],
    }

    with open(FEEDBACK_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record) + "\n")

    return record


def list_feedback(session_id: str | None = None) -> list[dict[str, Any]]:
    if not FEEDBACK_FILE.exists():
        return []

    out: list[dict[str, Any]] = []
    with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            if session_id is None or record.get("session_id") == session_id:
                out.append(record)

    return out
