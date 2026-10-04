"""
Agent Mode: Goal -> Plan -> Investigate -> Gather Evidence -> Analyze ->
Test -> Find Relationships -> Interpret -> Report.

This is an ORCHESTRATION layer, not a new source of truth: every step
below calls the exact same functions the manual dashboard tabs call
(scan_summary, deep_scan, generate_findings, interpret_project,
qa_runner). Agent mode just runs them in sequence, autonomously, and
narrates what it's doing at each step \u2014 instead of the person
clicking through tabs themselves.

Implemented as a generator so the API layer can stream each step to
the frontend as it happens (Server-Sent Events), rather than the
person staring at one big spinner until everything finishes.
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Iterator

from .crew import critic, replan
from .ai_interpreter import build_evidence_bundle, interpret_project
from .deep_scanner import deep_scan
from .findings_engine import generate_findings
from .qa_runner import analyze_failure, detect_test_commands, run_command
from .scanner import scan_summary

STEP_ORDER = [
    "plan",
    "scan",
    "extract",
    "relationships",
    "test",
    "interpret",
    "report",
]


def _event(step: str, status: str, detail: str, data: dict[str, Any] | None = None,
           role: str | None = None, t0: float | None = None, tokens: int | None = None) -> dict[str, Any]:
    """role = which crew member did it. t0/tokens add per-step metrics on settled events."""
    data = dict(data or {})
    if t0 is not None and status != "running":
        data["metrics"] = {"seconds": round(time.perf_counter() - t0, 2),
                           **({"tokens": tokens} if tokens is not None else {})}
    ev: dict[str, Any] = {"step": step, "status": status, "detail": detail, "data": data}
    if role:
        ev["role"] = role
    return ev


# A half run skips the two steps that are slow, cost tokens, or execute
# uploaded code. Keep in sync with HALF_SKIPS in the frontend.
HALF_SKIPS = {"test", "interpret"}


def surveyor(root: Path, goal: str, half: bool, history: list[str]) -> Iterator[dict[str, Any]]:
    """Surveyor: plans, then maps the site with the scan + extraction tools.
    Hands {summary, deep} to the Historian (None if a tool failed)."""
    route = "scan \u2192 extract evidence \u2192 find relationships \u2192 report" if half else (
        "scan \u2192 extract evidence \u2192 find relationships \u2192 test \u2192 interpret \u2192 report"
    )
    plan = f'Goal: "{goal}". {"Half run" if half else "Full run"}. Plan: {route}.'
    if history:
        plan += f" Using {len(history)} remembered item(s) from earlier in this session."
    yield _event("plan", "done", plan, role="Surveyor")

    t0 = time.perf_counter()
    yield _event("scan", "running", "Scanning file structure and metadata...", role="Surveyor")
    try:
        summary = scan_summary(root)
    except Exception as e:  # noqa: BLE001
        yield _event("scan", "failed", f"Scan failed: {e}", role="Surveyor", t0=t0)
        return None
    yield _event(
        "scan", "done",
        f"{summary['total_files']} files across {summary['total_dirs']} folders, "
        f"{summary['total_size_human']} total.",
        {"summary": summary}, role="Surveyor", t0=t0,
    )

    t0 = time.perf_counter()
    yield _event("extract", "running", "Extracting functions, classes, imports, TODOs, and git history...", role="Surveyor")
    try:
        deep = deep_scan(root)
    except Exception as e:  # noqa: BLE001
        yield _event("extract", "failed", f"Extraction failed: {e}", role="Surveyor", t0=t0)
        return None
    git_note = ""
    if deep.get("git", {}).get("available"):
        git_note = f" Git history: {deep['git'].get('commit_count', 0)} commits."
    yield _event(
        "extract", "done",
        f"{deep['total_functions']} functions, {deep['total_classes']} classes, "
        f"{deep['total_todos']} TODOs across {deep['files_analyzed']} files analyzed.{git_note}",
        {"deep_scan": deep}, role="Surveyor", t0=t0,
    )
    return {"summary": summary, "deep": deep}


def historian(root: Path, survey: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Historian: links the Surveyor's evidence into findings and anomalies."""
    t0 = time.perf_counter()
    yield _event("relationships", "running", "Connecting evidence into findings, checking for anomalies...", role="Historian")
    try:
        findings_result = generate_findings(root)
    except Exception as e:  # noqa: BLE001
        yield _event("relationships", "failed", f"Findings engine failed: {e}", role="Historian", t0=t0)
        return None
    anomalies = [f for f in findings_result["findings"] if f["severity"] == "anomaly"]
    detail = f"{findings_result['total_findings']} finding(s) surfaced"
    detail += f", {len(anomalies)} flagged as anomalies." if anomalies else "."
    yield _event("relationships", "done", detail, {"findings": findings_result}, role="Historian", t0=t0)
    return {"findings": findings_result, "anomalies": len(anomalies)}


def skeptic(root: Path, survey: dict[str, Any], half: bool) -> Iterator[dict[str, Any]]:
    """Skeptic: runs the tests; if they fail, REPLANS instead of only logging.
    Never applies fixes (that stays a human-approved action in Testing/QA)."""
    qa_run_result: dict[str, Any] | None = None
    failure: dict[str, Any] | None = None
    plan_update: dict[str, Any] | None = None
    suggestions: list[dict[str, Any]] = []
    if not half:
        try:
            suggestions = detect_test_commands(root)["suggestions"]
        except Exception:  # noqa: BLE001
            suggestions = []

    t0 = time.perf_counter()
    if half:
        yield _event("test", "skipped", "Half run: test execution skipped.", role="Skeptic")
    elif suggestions:
        cmd = suggestions[0]["command"]
        yield _event("test", "running", f"Executing: {cmd}", role="Skeptic")
        try:
            qa_run_result = run_command(root, cmd)
        except Exception as e:  # noqa: BLE001
            yield _event("test", "failed", f"Execution error: {e}", role="Skeptic", t0=t0)
            qa_run_result = None
        else:
            if qa_run_result["passed"]:
                yield _event("test", "done", "Execution succeeded \u2014 code runs cleanly.", {"run": qa_run_result}, role="Skeptic", t0=t0)
            else:
                failure = analyze_failure(qa_run_result, root)
                location = f" in {failure['file']}:{failure['line']}" if failure.get("file") else ""
                yield _event(
                    "test", "failed",
                    f"Execution failed{location}. Logged as evidence; open Testing/QA to review and propose a fix.",
                    {"run": qa_run_result, "failure": failure}, role="Skeptic", t0=t0,
                )
                plan_update = replan(failure, survey["deep"])
                yield _event(
                    "plan", "done",
                    f"Replanned: {plan_update['reason']} New steps: " + "; ".join(plan_update["new_steps"]) + ".",
                    {"replan": plan_update}, role="Skeptic",
                )
    else:
        yield _event("test", "skipped", "No runnable test/entry point detected for this project type.", role="Skeptic")
    return {"qa": qa_run_result, "failure": failure, "replan": plan_update}


def scribe(survey: dict[str, Any], hist: dict[str, Any], test: dict[str, Any], goal: str,
           half: bool, history: list[str]) -> Iterator[dict[str, Any]]:
    """Scribe: writes the narrative from the crew's structured hand-offs, then
    the Skeptic's LLM critic checks whether the evidence supports each claim."""
    if half:
        interpretation = {"available": False, "skipped": True, "error": "Half run: AI narrative skipped."}
        yield _event("interpret", "skipped", interpretation["error"], {"interpretation": interpretation}, role="Scribe")
        return {"interpretation": interpretation, "critic": None, "tokens": 0}

    t0 = time.perf_counter()
    yield _event("interpret", "running", "Sending evidence (not raw files) to the AI for narrative reconstruction...", role="Scribe")
    evidence = build_evidence_bundle(survey["summary"], survey["deep"], hist["findings"])
    if test.get("replan"):
        evidence["test_failure"] = test["replan"]["focus_evidence"]  # replanned focus reaches the Scribe
    try:
        interpretation = interpret_project(evidence, goal=goal, history=history)
    except Exception as e:  # noqa: BLE001
        interpretation = {"available": False, "error": str(e)}

    tokens = int((interpretation.get("usage") or {}).get("total_tokens", 0))
    review = None
    if interpretation.get("available"):
        review = critic(evidence, interpretation, survey["deep"])
        tokens += int((review.get("usage") or {}).get("total_tokens", 0))
        detail = interpretation.get("narrative", "") or "Narrative reconstructed."
        if review.get("unsupported"):
            detail += f" [Skeptic: {review['unsupported']} claim(s) not supported by the evidence.]"
        yield _event("interpret", "done", detail, {"interpretation": interpretation, "critic": review},
                     role="Scribe", t0=t0, tokens=tokens)
    else:
        yield _event("interpret", "skipped", interpretation.get("error", "AI interpretation unavailable."),
                     {"interpretation": interpretation}, role="Scribe", t0=t0, tokens=tokens)
    return {"interpretation": interpretation, "critic": review, "tokens": tokens}


def run_agent(
    root: Path,
    goal: str,
    depth: str = "full",
    history: list[str] | None = None,
) -> Iterator[dict[str, Any]]:
    """depth: "full" runs every step. "half" skips test execution and the
    AI narrative. history: already-trimmed memory items (see services.memory).

    Four roles run in turn, each passing a structured result to the next:
    Surveyor -> Historian -> Skeptic -> Scribe (+ Skeptic's critic)."""
    goal = (goal or "Determine how this project evolved.").strip()
    half = depth == "half"
    history = history or []
    started = time.perf_counter()

    survey = yield from surveyor(root, goal, half, history)
    if survey is None:
        return
    hist = yield from historian(root, survey)
    if hist is None:
        return
    test = yield from skeptic(root, survey, half)
    story = yield from scribe(survey, hist, test, goal, half, history)

    yield _event(
        "report", "done",
        "Investigation complete.",
        {
            "goal": goal,
            "depth": "half" if half else "full",
            "memory_items_used": len(history),
            "summary": survey["summary"],
            "deep_scan": survey["deep"],
            "findings": hist["findings"],
            "interpretation": story["interpretation"],
            "critic": story["critic"],
            "replan": test["replan"],
            "qa": test["qa"],
            "metrics": {"seconds": round(time.perf_counter() - started, 2), "tokens": story["tokens"]},
        },
        role="Scribe",
    )
