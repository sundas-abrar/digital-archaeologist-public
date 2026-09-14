from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException

from ..services.deep_scanner import deep_scan
from ..services.findings_engine import generate_findings, investigate_finding

router = APIRouter(prefix="/api", tags=["scan"])

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage"


@router.get("/scan/{session_id}")
def scan_session(session_id: str):
    extract_dir = STORAGE_DIR / session_id / "extracted"
    if not extract_dir.exists():
        raise HTTPException(status_code=404, detail="Session not found. Upload the archive again.")

    result = deep_scan(extract_dir)
    return {"session_id": session_id, **result}


@router.get("/findings/{session_id}")
def findings_session(session_id: str):
    """Phase 4: run the findings engine over an already-uploaded session."""
    extract_dir = STORAGE_DIR / session_id / "extracted"
    if not extract_dir.exists():
        raise HTTPException(status_code=404, detail="Session not found. Upload the archive again.")

    result = generate_findings(extract_dir)
    return {"session_id": session_id, **result}


@router.post("/findings/{session_id}/improve/{finding_id}")
def improve_finding(session_id: str, finding_id: str):
    """"Improve Analysis" — re-investigate a single finding and report
    previous vs. revised confidence, plus any newly surfaced evidence."""
    extract_dir = STORAGE_DIR / session_id / "extracted"
    if not extract_dir.exists():
        raise HTTPException(status_code=404, detail="Session not found. Upload the archive again.")

    result = investigate_finding(extract_dir, finding_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Finding not found. Re-run findings first.")

    return {"session_id": session_id, **result}
