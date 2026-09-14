from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..services.ai_interpreter import interpret_evidence
from ..services.deep_scanner import deep_scan
from ..services.findings_engine import generate_findings
from ..services.scanner import build_file_tree, flatten_files, scan_summary

router = APIRouter(prefix="/api", tags=["findings"])

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage"


def _collect_session_evidence(session_id: str):
    extract_dir = STORAGE_DIR / session_id / "extracted"
    if not extract_dir.exists():
        raise HTTPException(status_code=404, detail="Session not found. Upload the archive again.")

    tree = build_file_tree(extract_dir, extract_dir)
    summary = scan_summary(extract_dir)
    deep = deep_scan(extract_dir)
    files_flat = flatten_files(tree)

    # Filesystem mtimes reflect when the zip was EXTRACTED, not when the
    # files were actually last changed \u2014 if git history exists, prefer
    # the real commit dates for anything git knows about.
    git_dates = deep.get("git_file_dates", {})
    if git_dates:
        for f in files_flat:
            gd = git_dates.get(f["path"])
            if gd:
                f["modified"] = gd["last_seen"]
                f["git_first_seen"] = gd["first_seen"]

    findings = generate_findings(files_flat, deep)

    modified_dates = [f["modified"] for f in files_flat if f.get("modified")]
    first_modified = min(modified_dates) if modified_dates else None
    last_modified = max(modified_dates) if modified_dates else None

    return {
        "project_name_guess": tree.get("name", "project"),
        "summary": summary,
        "findings": findings,
        "git": deep.get("git", {}),
        "first_modified": first_modified,
        "last_modified": last_modified,
    }


@router.get("/findings/{session_id}")
def get_findings(session_id: str):
    """Phase 4: rule-based findings, no AI call, fast."""
    evidence = _collect_session_evidence(session_id)
    return {"session_id": session_id, **evidence}


@router.post("/interpret/{session_id}")
def interpret_session(session_id: str):
    """Phase 5: sends the Phase 4 evidence (not raw files) to an LLM
    for a narrative reconstruction. Falls back to a template narrative
    if no API key is configured."""
    evidence = _collect_session_evidence(session_id)
    interpretation = interpret_evidence(evidence)
    return {
        "session_id": session_id,
        "evidence": evidence,
        "interpretation": interpretation,
    }
