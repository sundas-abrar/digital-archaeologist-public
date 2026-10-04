from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, HTTPException

from ..config import STORAGE_DIR
from ..services.ai_interpreter import build_evidence_bundle
from ..services.deep_scanner import deep_scan
from ..services.findings_engine import generate_findings
from ..services.generate import generate
from ..services.scanner import scan_summary

router = APIRouter(prefix="/api/generate", tags=["generate"])
_SID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


@router.get("/{session_id}/{kind}")
def generate_output(session_id: str, kind: Literal["readme", "plan", "story", "tests", "diagram"]):
    """AI-written README / resurrection plan / 3-tone story / tests, or the Mermaid diagram."""
    root = STORAGE_DIR / session_id / "extracted"
    if not _SID.match(session_id) or not root.exists():
        raise HTTPException(status_code=404, detail="Session not found. Upload the archive again.")
    deep = deep_scan(root)
    evidence = build_evidence_bundle(scan_summary(root), deep, generate_findings(root))
    return generate(kind, root, evidence, deep)
