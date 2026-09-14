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

from pathlib import Path
from typing import Any, Iterator

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


def _event(step: str, status: str, detail: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"step": step, "status": status, "detail": detail, "data": data or {}}


def run_agent(root: Path, goal: str) -> Iterator[dict[str, Any]]:
    goal = (goal or "Determine how this project evolved.").strip()

    yield _event("plan", "done", f'Goal: "{goal}". Plan: scan \u2192 extract evidence \u2192 find relationships \u2192 test \u2192 interpret \u2192 report.')

    yield _event("scan", "running", "Scanning file structure and metadata...")
    try:
        summary = scan_summary(root)
    except Exception as e:  # noqa: BLE001
        yield _event("scan", "failed", f"Scan failed: {e}")
        return
    yield _event(
        "scan", "done",
        f"{summary['total_files']} files across {summary['total_dirs']} folders, "
        f"{summary['total_size_human']} total.",
        {"summary": summary},
    )

    yield _event("extract", "running", "Extracting functions, classes, imports, TODOs, and git history...")
    try:
        deep = deep_scan(root)
    except Exception as e:  # noqa: BLE001
        yield _event("extract", "failed", f"Extraction failed: {e}")
        return
    git_note = ""
    if deep.get("git", {}).get("available"):
        git_note = f" Git history: {deep['git'].get('commit_count', 0)} commits."
    yield _event(
        "extract", "done",
        f"{deep['total_functions']} functions, {deep['total_classes']} classes, "
        f"{deep['total_todos']} TODOs across {deep['files_analyzed']} files analyzed.{git_note}",
        {"deep_scan": deep},
    )

    yield _event("relationships", "running", "Connecting evidence into findings, checking for anomalies...")
    try:
        findings_result = generate_findings(root)
    except Exception as e:  # noqa: BLE001
        yield _event("relationships", "failed", f"Findings engine failed: {e}")
        return
    anomalies = [f for f in findings_result["findings"] if f["severity"] == "anomaly"]
    detail = f"{findings_result['total_findings']} finding(s) surfaced"
    detail += f", {len(anomalies)} flagged as anomalies." if anomalies else "."
    yield _event("relationships", "done", detail, {"findings": findings_result})

    # Testing/QA: only attempted if there's something plausible to run.
    # Agent mode never applies fixes on its own \u2014 that always stays a
    # human-approved action in the Testing/QA tab.
    qa_run_result: dict[str, Any] | None = None
    try:
        suggestions = detect_test_commands(root)["suggestions"]
    except Exception:  # noqa: BLE001
        suggestions = []

    if suggestions:
        cmd = suggestions[0]["command"]
        yield _event("test", "running", f"Executing: {cmd}")
        try:
            qa_run_result = run_command(root, cmd)
        except Exception as e:  # noqa: BLE001
            yield _event("test", "failed", f"Execution error: {e}")
            qa_run_result = None
        else:
            if qa_run_result["passed"]:
                yield _event("test", "done", "Execution succeeded \u2014 code runs cleanly.", {"run": qa_run_result})
            else:
                failure = analyze_failure(qa_run_result, root)
                location = f" in {failure['file']}:{failure['line']}" if failure.get("file") else ""
                yield _event(
                    "test", "failed",
                    f"Execution failed{location}. Logged as evidence; open Testing/QA to review and propose a fix.",
                    {"run": qa_run_result, "failure": failure},
                )
    else:
        yield _event("test", "skipped", "No runnable test/entry point detected for this project type.")

    yield _event("interpret", "running", "Sending evidence (not raw files) to the AI for narrative reconstruction...")
    evidence = build_evidence_bundle(summary, deep, findings_result)
    try:
        interpretation = interpret_project(evidence)
    except Exception as e:  # noqa: BLE001
        interpretation = {"available": False, "error": str(e)}

    if interpretation.get("available"):
        yield _event("interpret", "done", interpretation.get("narrative", "") or "Narrative reconstructed.", {"interpretation": interpretation})
    else:
        yield _event("interpret", "skipped", interpretation.get("error", "AI interpretation unavailable."), {"interpretation": interpretation})

    yield _event(
        "report", "done",
        "Investigation complete.",
        {
            "goal": goal,
            "summary": summary,
            "deep_scan": deep,
            "findings": findings_result,
            "interpretation": interpretation,
            "qa": qa_run_result,
        },
    )
