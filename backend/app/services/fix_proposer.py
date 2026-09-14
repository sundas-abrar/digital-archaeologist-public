"""
QA panel, step 4: 'AI analyzes error -> identifies probable cause ->
generates fix'. Mirrors ai_interpreter.py's Groq client pattern exactly
(same package, same env vars) so there's only one way this project
talks to an LLM.

Never applies anything itself \u2014 it only proposes. Applying is a
separate, explicit, human-approved step (qa_runner doesn't touch disk
here; the /apply-fix route does, only after the person clicks Apply).
"""

from __future__ import annotations

import json
import os
from typing import Any

try:
    from groq import Groq
except ImportError:  # library not installed yet locally
    Groq = None  # type: ignore[assignment, misc]

GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

SYSTEM_PROMPT = """You are a careful software engineer fixing a failing test or \
build. You are given the error output and the full current content of the file \
most likely responsible. Propose the SMALLEST fix that would plausibly resolve \
the error \u2014 don't refactor, rename, or restyle anything unrelated to the bug.

Respond with ONLY a JSON object, no markdown fences, no commentary, with \
exactly these keys:
{
  "explanation": "2-4 plain sentences: what's wrong and why this fix addresses it",
  "proposed_file_content": "the FULL corrected file content, ready to save as-is",
  "confidence": "high | medium | low, your honest confidence this fix resolves the failure"
}

If the error output doesn't give you enough to safely propose a fix, set \
proposed_file_content to null and explain what additional information would be \
needed instead of guessing."""


def _client():
    if Groq is None:
        return "no_package"
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return "no_key"
    return Groq(api_key=api_key)


def propose_fix(failure: dict[str, Any]) -> dict[str, Any]:
    if not failure.get("code_snippet"):
        return {
            "available": False,
            "error": (
                "Couldn't identify which file the failure points to from the "
                "test output, so there's no source to propose a fix against."
            ),
        }

    client = _client()
    if client == "no_package":
        return {
            "available": False,
            "error": (
                "The 'groq' package isn't installed. Run "
                "'pip install -r requirements.txt' inside your backend venv."
            ),
        }
    if client == "no_key":
        return {
            "available": False,
            "error": (
                "GROQ_API_KEY not configured. Copy backend/.env.example to "
                "backend/.env and add your key from console.groq.com/keys, "
                "then restart uvicorn."
            ),
        }

    user_payload = {
        "file": failure.get("file"),
        "error_type": failure.get("error_type"),
        "error_message": failure.get("error_message"),
        "test_output_tail": (failure.get("raw_output") or "")[-2000:],
        "current_file_content": (failure.get("code_snippet") or "")[:4000],
    }

    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(user_payload, default=str)},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_tokens=2000,
        )
    except Exception as e:  # noqa: BLE001 - surface the real reason to the UI
        return {"available": False, "error": f"Groq request failed: {e}"}

    raw = completion.choices[0].message.content if completion.choices else None
    try:
        parsed = json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return {"available": False, "error": "Model did not return valid JSON."}

    return {
        "available": True,
        "model": GROQ_MODEL,
        "file": failure.get("file"),
        "explanation": parsed.get("explanation", ""),
        "proposed_file_content": parsed.get("proposed_file_content"),
        "confidence": parsed.get("confidence", "medium"),
    }
