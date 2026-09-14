"""
Phase 5: AI Interpretation.

The whole point here: we do NOT dump the repository into the model.
We hand it the *evidence* that Phases 2-4 already extracted \u2014 file
stats, code stats, git patterns, and the findings engine's output \u2014
and ask it to reconstruct a story from that. This keeps the prompt
small, keeps raw source code out of a third-party API call, and forces
the model to reason over the same evidence a human would see in the
dashboard rather than re-deriving things itself.
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

SYSTEM_PROMPT = """You are a digital archaeologist. You are given structured \
evidence extracted from an old project archive: file/extension stats, code \
stats, git history patterns, and a list of "findings" already detected by a \
rule-based engine (timeline anomalies, repeated files, hotspots, etc).

Reconstruct the project's likely story using ONLY this evidence. Do not \
invent specifics (people's names, exact dates, technologies) that are not \
present in the evidence. If the evidence is thin, say so plainly instead of \
guessing.

Critical consistency rule: the fields you are given are ground truth. Never \
write a narrative that contradicts them \u2014 for example, if git.available is \
true, do not claim the project has no git history; if total_todos is 0, do \
not claim there are outstanding TODOs. Check every claim in your narrative \
against the evidence fields before finalizing your answer.

Respond with ONLY a JSON object, no markdown fences, no commentary, with \
exactly these keys:
{
  "project_title": "short guess at what this project is, based on filenames/extensions",
  "estimated_timeline": "a date range or duration if derivable from the evidence, else 'Unclear from available evidence'",
  "evolution": ["3-5 short phrase stages describing how the project likely progressed, grounded in the evidence given"],
  "narrative": "2-4 sentence plain-language story of the project, referencing specific evidence",
  "key_insight": "the single most interesting connection in the evidence, referencing a specific finding or file by name"
}"""


def _client():
    if Groq is None:
        return "no_package"
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return "no_key"
    return Groq(api_key=api_key)


def build_evidence_bundle(
    summary: dict[str, Any],
    deep_scan_result: dict[str, Any],
    findings_result: dict[str, Any],
) -> dict[str, Any]:
    """Compact evidence only \u2014 no file contents, no source code."""
    git = deep_scan_result.get("git", {})

    return {
        "summary": {
            "total_files": summary.get("total_files"),
            "total_dirs": summary.get("total_dirs"),
            "total_size_human": summary.get("total_size_human"),
            "has_git_history": summary.get("has_git_history"),
            "top_extensions": summary.get("top_extensions"),
        },
        "code": {
            "total_functions": deep_scan_result.get("total_functions"),
            "total_classes": deep_scan_result.get("total_classes"),
            "total_todos": deep_scan_result.get("total_todos"),
            "files_analyzed": deep_scan_result.get("files_analyzed"),
        },
        "git": {
            "available": git.get("available", False),
            "commit_count": git.get("commit_count"),
            "authors": git.get("authors"),
            "first_commit": git.get("first_commit"),
            "last_commit": git.get("last_commit"),
        },
        "findings": [
            {
                "category": f["category"],
                "severity": f["severity"],
                "title": f["title"],
                "description": f["description"],
            }
            for f in findings_result.get("findings", [])[:15]
        ],
    }


def interpret_project(evidence: dict[str, Any]) -> dict[str, Any]:
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

    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(evidence, default=str)},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
            max_tokens=1500,
            extra_body={"reasoning_effort": "low"},
        )
    except TypeError:
        # Older groq SDKs may not recognize extra_body \u2014 retry without it.
        # max_tokens=1500 alone still fixes the empty-JSON issue in most cases.
        try:
            completion = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(evidence, default=str)},
                ],
                response_format={"type": "json_object"},
                temperature=0.4,
                max_tokens=1500,
            )
        except Exception as e:  # noqa: BLE001
            return {"available": False, "error": f"Groq request failed: {e}"}
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
        "project_title": parsed.get("project_title", "Untitled project"),
        "estimated_timeline": parsed.get(
            "estimated_timeline", "Unclear from available evidence"
        ),
        "evolution": parsed.get("evolution", []),
        "narrative": parsed.get("narrative", ""),
        "key_insight": parsed.get("key_insight", ""),
    }
