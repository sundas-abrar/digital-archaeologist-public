from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Response

from ..services.report_builder import build_report_data, render_report_pdf

router = APIRouter(prefix="/api", tags=["report"])

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage"


@router.get("/report/{session_id}")
def download_report(session_id: str, format: str = "pdf"):
    """Download the full investigation report for a session.

    format=pdf (default) returns a formatted PDF.
    format=json returns the same data as raw JSON.
    """
    extract_dir = STORAGE_DIR / session_id / "extracted"
    if not extract_dir.exists():
        raise HTTPException(status_code=404, detail="Session not found. Upload the archive again.")

    report = build_report_data(session_id, extract_dir)

    if format == "json":
        return report

    pdf_bytes = render_report_pdf(report)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="digital-archaeologist-{session_id}.pdf"'
        },
    )
