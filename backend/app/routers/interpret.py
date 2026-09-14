from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..services.scanner import scan_summary
from ..services.deep_scanner import deep_scan
from ..services.findings_engine import generate_findings
from ..services.ai_interpreter import build_evidence_bundle, interpret_project

router = APIRouter(prefix="/api", tags=["interpret"])

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage"


@router.get("/interpret/{session_id}")
def interpret_session(session_id: str):
    """Phase 5: send structured evidence (not the raw repo) to the LLM."""
    extract_dir = STORAGE_DIR / session_id / "extracted"
    if not extract_dir.exists():
        raise HTTPException(status_code=404, detail="Session not found. Upload the archive again.")

    summary = scan_summary(extract_dir)
    deep = deep_scan(extract_dir)
    findings = generate_findings(extract_dir)

    evidence = build_evidence_bundle(summary, deep, findings)
    result = interpret_project(evidence)

    return {"session_id": session_id, "evidence_sent": evidence, **result}
