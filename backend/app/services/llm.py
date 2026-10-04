"""Shared Groq helper for the crew roles and generators.

Every call returns timing and token usage so each AI step can be measured.
Never raises: failures come back as {"ok": False, "error": ...}.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any

try:
    from groq import Groq
except ImportError:  # library not installed yet locally
    Groq = None  # type: ignore[assignment, misc]

MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")


def usage_of(completion: Any) -> dict[str, int]:
    """Token counts from a Groq completion (zeros if the SDK gave none)."""
    u = getattr(completion, "usage", None)
    p = int(getattr(u, "prompt_tokens", 0) or 0)
    c = int(getattr(u, "completion_tokens", 0) or 0)
    t = int(getattr(u, "total_tokens", 0) or 0) or p + c
    return {"prompt_tokens": p, "completion_tokens": c, "total_tokens": t}


def ask(system: str, user: str, *, json_mode: bool = True, max_tokens: int = 900,
        temperature: float = 0.3) -> dict[str, Any]:
    """One chat call. Returns ok, data (json_mode) or text, usage, seconds, error."""
    out: dict[str, Any] = {"ok": False, "usage": usage_of(None), "seconds": 0.0}
    if Groq is None:
        return {**out, "error": "The 'groq' package isn't installed."}
    key = os.getenv("GROQ_API_KEY")
    if not key:
        return {**out, "error": "GROQ_API_KEY not configured."}

    kwargs: dict[str, Any] = dict(
        model=MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    t0 = time.perf_counter()
    try:
        client = Groq(api_key=key)
        try:
            completion = client.chat.completions.create(**kwargs, extra_body={"reasoning_effort": "low"})
        except TypeError:
            completion = client.chat.completions.create(**kwargs)
    except Exception as e:  # noqa: BLE001
        return {**out, "seconds": round(time.perf_counter() - t0, 2), "error": f"Groq request failed: {e}"}

    out["seconds"] = round(time.perf_counter() - t0, 2)
    out["usage"] = usage_of(completion)
    raw = completion.choices[0].message.content if completion.choices else None
    if not raw:
        return {**out, "error": "The model returned an empty answer."}
    if not json_mode:
        return {**out, "ok": True, "text": raw.strip()}
    try:
        return {**out, "ok": True, "data": json.loads(raw)}
    except json.JSONDecodeError:
        return {**out, "error": "Model did not return valid JSON."}
