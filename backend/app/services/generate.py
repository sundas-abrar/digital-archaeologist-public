"""Generative outputs built only from scan evidence. AI-written text is always
marked as such. Kinds: readme, plan, story, tests, diagram."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from . import llm

BANNER = "AI-written from scan evidence only. Review before relying on it."
RULES = ("Use ONLY the evidence given. Never invent names, dates, technologies or features. "
         "If evidence is thin, say so. ")

PROMPTS = {
    "readme": RULES + "Write a README.md (Markdown) for this recovered project: title guess, what the evidence "
                      "suggests it is, structure, what is known, what is unknown.",
    "plan": RULES + "Write a short 'resurrection plan' (Markdown): numbered steps to get this project running "
                    "again, ordered by what the evidence (missing README, TODOs, failing tests, languages) suggests.",
}
STORY_PROMPT = RULES + ('Return ONLY JSON: {"technical":"3-5 sentences for engineers","plain":"3-5 sentences '
                        'for a non-technical reader","blurb":"one paragraph, max 60 words"}')
TESTS_PROMPT = ("Write pytest tests for the given Python functions. Only test behaviour visible in the code. "
                "Return ONLY Python code, no fences.")


def _usage_out(r: dict[str, Any]) -> dict[str, Any]:
    return {"usage": r["usage"], "seconds": r["seconds"]}


def untested_functions(root: Path, deep: dict[str, Any], limit: int = 5) -> list[dict[str, Any]]:
    """Python functions whose name never appears in any test file."""
    tests = ""
    for f in deep.get("files", []):
        p = f.get("path") or f.get("file") or ""
        if p.endswith(".py") and re.search(r"(^|/)(test_|tests/)|_test\.py$", p):
            try:
                tests += (root / p).read_text(errors="ignore")
            except OSError:
                pass
    out = []
    for f in deep.get("files", []):
        p = f.get("path") or f.get("file") or ""
        if not p.endswith(".py") or re.search(r"(^|/)(test_|tests/)|_test\.py$", p):
            continue
        for fn in f.get("functions", []):
            if not fn["name"].startswith("_") and fn["name"] not in tests:
                out.append({"file": p, "name": fn["name"], "line": fn["line"]})
    return out[:limit]


def _source(root: Path, file: str, line: int, max_lines: int = 40) -> str:
    try:
        lines = (root / file).read_text(errors="ignore").splitlines()
    except OSError:
        return ""
    start = line - 1
    indent = len(lines[start]) - len(lines[start].lstrip())
    end = start + 1
    while end < len(lines) and end - start < max_lines:
        s = lines[end]
        if s.strip() and len(s) - len(s.lstrip()) <= indent:
            break
        end += 1
    return "\n".join(lines[start:end])


def mermaid_diagram(deep: dict[str, Any]) -> str:
    """Folder -> busiest files, as Mermaid source (deterministic, no tokens)."""
    def clean(s: str) -> str:
        return re.sub(r'["\[\]{}()<>|;]', "", s)[:40]
    by_dir: dict[str, list[tuple[str, int]]] = {}
    for f in deep.get("files", []):
        p = f.get("path") or f.get("file") or ""
        if p:
            d = p.rsplit("/", 1)[0] if "/" in p else "(root)"
            by_dir.setdefault(d, []).append((p.rsplit("/", 1)[-1], len(f.get("functions", []))))
    lines = ["graph TD", '  R["project"]']
    for i, (d, files) in enumerate(sorted(by_dir.items(), key=lambda kv: -len(kv[1]))[:8]):
        lines.append(f'  D{i}["{clean(d)}"] --> R')
        for j, (name, n) in enumerate(sorted(files, key=lambda x: -x[1])[:3]):
            lines.append(f'  F{i}_{j}["{clean(name)} ({n} fn)"] --> D{i}')
    return "\n".join(lines)


def generate(kind: str, root: Path, evidence: dict[str, Any], deep: dict[str, Any]) -> dict[str, Any]:
    if kind == "diagram":
        return {"kind": kind, "ai_written": False, "mermaid": mermaid_diagram(deep)}

    if kind in PROMPTS:
        r = llm.ask(PROMPTS[kind], json.dumps(evidence, default=str), json_mode=False, max_tokens=1200)
        if not r["ok"]:
            return {"kind": kind, "ai_written": False, "error": r["error"]}
        return {"kind": kind, "ai_written": True, "notice": BANNER, "content": r["text"], **_usage_out(r)}

    if kind == "story":
        r = llm.ask(STORY_PROMPT, json.dumps(evidence, default=str), max_tokens=900)
        if not r["ok"]:
            return {"kind": kind, "ai_written": False, "error": r["error"]}
        d = r["data"]
        return {"kind": kind, "ai_written": True, "notice": BANNER,
                "tones": {k: str(d.get(k, "")) for k in ("technical", "plain", "blurb")}, **_usage_out(r)}

    if kind == "tests":
        targets = untested_functions(root, deep)
        if not targets:
            return {"kind": kind, "ai_written": False, "untested": [], "error": "No untested Python functions found."}
        snippets = [{**t, "source": _source(root, t["file"], t["line"])} for t in targets]
        r = llm.ask(TESTS_PROMPT, json.dumps(snippets), json_mode=False, max_tokens=1400)
        base = {"kind": kind, "untested": targets,
                "note": "Only these function bodies (max 40 lines each) were sent to the model."}
        if not r["ok"]:
            return {**base, "ai_written": False, "error": r["error"]}
        return {**base, "ai_written": True, "notice": BANNER,
                "content": f"# {BANNER}\n{r['text']}", **_usage_out(r)}

    raise ValueError(f"unknown kind {kind!r}")
