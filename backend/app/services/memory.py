"""
Agent memory: how much earlier context a request may carry.

What is remembered lives on the server (services.memory_store). This
module only defines how much of it a request may use, so a modified
client can't push an unbounded prompt through the model.

    off  -> nothing
    half -> the 3 most recent items (+ pinned items)
    full -> a short summary of older items + pinned items + the 3 most recent
"""

from __future__ import annotations

import re
from typing import Any, Literal

MemoryMode = Literal["off", "half", "full"]

MEMORY_LIMITS: dict[str, int] = {"off": 0, "half": 3, "full": 10}
FULL_RECENT = 3  # raw items sent in "full" mode, after the summary
SUMMARY_CHARS = 400
MAX_ITEM_CHARS = 300
MAX_RAW_ITEMS = 50  # parsed before trimming, so a huge array is cut early

_WS = re.compile(r"\s+")


def clean_history(items: Any, mode: str) -> list[str]:
    """Validate, normalise and trim history to what `mode` allows."""
    limit = MEMORY_LIMITS.get(mode, 0)
    if limit == 0 or not isinstance(items, list):
        return []

    cleaned: list[str] = []
    for item in items[-MAX_RAW_ITEMS:]:
        if not isinstance(item, str):
            continue
        text = _WS.sub(" ", item).strip()[:MAX_ITEM_CHARS]
        if text:
            cleaned.append(text)
    return cleaned[-limit:]


def summarize(older: list[str]) -> str:
    """Rolling summary of older items: deduplicated, each shortened, capped.
    Deterministic (no model call), so it costs no tokens."""
    seen: list[str] = []
    for t in older:
        short = t if len(t) <= 60 else t[:57] + "..."
        if short not in seen:
            seen.append(short)
    text = f"Summary of {len(older)} earlier item(s): " + "; ".join(seen)
    return text if len(text) <= SUMMARY_CHARS else text[: SUMMARY_CHARS - 3] + "..."
