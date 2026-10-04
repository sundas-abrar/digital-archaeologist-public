"""Skeptic tools: LLM critic (is a claim supported by the evidence?) and
replanning (what to do when the test step fails)."""

from __future__ import annotations

import json
from typing import Any

from . import llm

CRITIC_PROMPT = """You are the Skeptic on an investigation crew: a strict fact-checker.
You get EVIDENCE (ground truth) and numbered CLAIMS written by another model.
For each claim decide whether the evidence directly supports it. A claim that
adds specifics (names, dates, technologies, causes) not present in the evidence
is NOT supported. Respond with ONLY JSON:
{"verdicts":[{"i":0,"supported":true,"reason":"max 20 words"}]}"""


def _names(evidence: dict[str, Any], deep: dict[str, Any] | None) -> set[str]:
    names = {f["title"] for f in evidence.get("findings", []) if f.get("title")}
    for f in (deep or {}).get("files", []):
        p = f.get("path") or f.get("file") or ""
        if p:
            names.add(p)
            names.add(p.rsplit("/", 1)[-1])
    return names


def critic(evidence: dict[str, Any], interp: dict[str, Any],
           deep: dict[str, Any] | None = None) -> dict[str, Any]:
    """Two passes: the old rule check (insight names real evidence) plus a model
    judging whether each claim is actually supported."""
    insight = interp.get("key_insight", "") or ""
    claims = [c for c in [interp.get("narrative", ""), insight, *interp.get("evolution", [])] if c][:6]
    rule = {"insight_names_real_evidence": any(n and n in insight for n in _names(evidence, deep))}
    res = {"rule": rule, "llm": {"available": False}, "unsupported": 0, "usage": llm.usage_of(None)}
    if not claims:
        return res

    user = json.dumps({"evidence": evidence, "claims": [{"i": i, "text": c} for i, c in enumerate(claims)]}, default=str)
    r = llm.ask(CRITIC_PROMPT, user, max_tokens=700, temperature=0.1)
    res["usage"] = r["usage"]
    if not r["ok"]:
        res["llm"] = {"available": False, "error": r["error"]}
        return res
    verdicts = []
    for v in r["data"].get("verdicts", []):
        i = v.get("i")
        if isinstance(i, int) and 0 <= i < len(claims):
            verdicts.append({"claim": claims[i], "supported": bool(v.get("supported")),
                             "reason": str(v.get("reason", ""))[:200]})
    res["llm"] = {"available": True, "verdicts": verdicts}
    res["unsupported"] = sum(1 for v in verdicts if not v["supported"])
    return res


def replan(failure: dict[str, Any], deep: dict[str, Any]) -> dict[str, Any]:
    """Update the plan after a failed test run (rule-based, no tokens)."""
    file = failure.get("file")
    info = next((f for f in deep.get("files", []) if (f.get("path") or f.get("file")) == file), {}) if file else {}
    focus = {
        "file": file, "line": failure.get("line"),
        "message": str(failure.get("message") or failure.get("error") or failure.get("summary") or "")[:300],
        "functions_in_file": [x["name"] for x in info.get("functions", [])][:10],
        "todos_in_file": len(info.get("todos", [])),
    }
    where = f"focus on {file}" if file else "no failing file identified"
    steps = [f"extract: {where}", "interpret: treat the failure as evidence, not as proof of breakage",
             "report: lower confidence in 'code runs' claims"]
    return {"reason": f"Test run failed ({where}).", "new_steps": steps, "focus_evidence": focus}
