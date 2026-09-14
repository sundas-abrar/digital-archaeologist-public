"""
Report download.

Assembles everything the dashboard already shows \u2014 summary, findings,
AI interpretation \u2014 into one document the user can take away. This
module only *reads* results from the existing scan/findings/interpret
services; it doesn't change how any of them work.
"""

from __future__ import annotations

import io
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from xml.sax.saxutils import escape as _xml_escape

# Pakistan doesn't observe daylight saving, so a fixed UTC+5 offset is
# accurate year-round \u2014 no external tz database needed.
PKT = timezone(timedelta(hours=5))

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from .scanner import scan_summary
from .deep_scanner import deep_scan
from .findings_engine import generate_findings
from .ai_interpreter import build_evidence_bundle, interpret_project

INK = colors.HexColor("#0A0A0B")
COPPER = colors.HexColor("#A8753F")
MUTED = colors.HexColor("#5C5C58")
HAIRLINE = colors.HexColor("#D9D3C4")

SEVERITY_LABEL = {
    "anomaly": "ANOMALY",
    "notable": "NOTABLE",
    "info": "INFO",
}

# Base-14 PDF fonts (Helvetica/Courier) only support WinAnsiEncoding.
# AI-generated text often contains "smart" Unicode punctuation that isn't
# in that encoding and renders as garbage glyphs (arrows became "fi",
# en-dashes corrupted nearby letters). Normalize to ASCII equivalents
# before anything reaches a Paragraph.
_UNICODE_REPLACEMENTS = {
    "\u2192": "->", "\u2190": "<-", "\u2194": "<->",
    "\u2013": "-", "\u2014": " -- ",
    "\u2011": "-",  # non-breaking hyphen
    "\u2212": "-",  # minus sign
    "\u2018": "'", "\u2019": "'",
    "\u201c": '"', "\u201d": '"',
    "\u2026": "...",
    "\u2022": "-", "\u00b7": "-",
    "\u00a0": " ",  # non-breaking space
    "\u200b": "", "\ufeff": "",  # zero-width space / BOM
}


def _normalize(text: Any) -> str:
    """Fix unsupported Unicode punctuation only \u2014 safe for plain Table
    cells, which reportlab draws as literal text (no XML parsing)."""
    if text is None:
        return ""
    s = str(text)
    for bad, good in _UNICODE_REPLACEMENTS.items():
        s = s.replace(bad, good)
    # Final safety net: silently drop anything still outside cp1252
    # (WinAnsi) rather than let it render as a garbled/substituted glyph.
    return s.encode("cp1252", errors="ignore").decode("cp1252")


def _clean(text: Any) -> str:
    """_normalize(), then XML-escape \u2014 for text going into a Paragraph,
    which *does* parse '<b>' style markup, so stray '&'/'<' in AI text
    must be escaped first or they can break/alter the markup."""
    return _xml_escape(_normalize(text))


def build_report_data(session_id: str, extract_dir: Path) -> dict[str, Any]:
    """Same evidence-gathering path as /api/interpret \u2014 nothing new
    derived here, just collected in one place for rendering."""
    summary = scan_summary(extract_dir)
    deep = deep_scan(extract_dir)
    findings = generate_findings(extract_dir)
    evidence = build_evidence_bundle(summary, deep, findings)
    interpretation = interpret_project(evidence)

    return {
        "session_id": session_id,
        "generated_at": datetime.now(PKT).isoformat(),
        "summary": summary,
        "code": {
            "total_functions": deep.get("total_functions"),
            "total_classes": deep.get("total_classes"),
            "total_todos": deep.get("total_todos"),
            "files_analyzed": deep.get("files_analyzed"),
        },
        "git": deep.get("git", {}),
        "findings": findings.get("findings", []),
        "interpretation": interpretation,
    }


def _styles():
    ss = getSampleStyleSheet()
    return {
        "eyebrow": ParagraphStyle(
            "eyebrow", parent=ss["Normal"], fontName="Helvetica-Bold",
            fontSize=8, textColor=COPPER, spaceAfter=4, leading=10,
        ),
        "h1": ParagraphStyle(
            "h1", parent=ss["Title"], fontName="Helvetica-Bold",
            fontSize=22, textColor=INK, spaceAfter=2, leading=26,
        ),
        "h2": ParagraphStyle(
            "h2", parent=ss["Heading2"], fontName="Helvetica-Bold",
            fontSize=12, textColor=INK, spaceBefore=18, spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "body", parent=ss["Normal"], fontName="Helvetica",
            fontSize=9.5, textColor=INK, leading=14,
        ),
        "muted": ParagraphStyle(
            "muted", parent=ss["Normal"], fontName="Helvetica",
            fontSize=8.5, textColor=MUTED, leading=12,
        ),
        "finding_title": ParagraphStyle(
            "finding_title", parent=ss["Normal"], fontName="Helvetica-Bold",
            fontSize=9.5, textColor=INK, spaceAfter=2,
        ),
        "finding_meta": ParagraphStyle(
            "finding_meta", parent=ss["Normal"], fontName="Helvetica-Bold",
            fontSize=7, textColor=COPPER, spaceAfter=2,
        ),
        "evidence": ParagraphStyle(
            "evidence", parent=ss["Normal"], fontName="Courier",
            fontSize=7.5, textColor=MUTED, leading=11,
        ),
    }


def render_report_pdf(report: dict[str, Any]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=LETTER,
        topMargin=0.85 * inch, bottomMargin=0.75 * inch,
        leftMargin=0.85 * inch, rightMargin=0.85 * inch,
    )
    st = _styles()
    story: list[Any] = []

    summary = report["summary"]
    interp = report.get("interpretation") or {}
    findings = report.get("findings") or []
    git = report.get("git") or {}

    # Header
    story.append(Paragraph("EXCAVATION REPORT", st["eyebrow"]))
    title = interp.get("project_title") if interp.get("available") else "Untitled Project"
    story.append(Paragraph(_clean(title) or "Untitled Project", st["h1"]))
    story.append(Paragraph(
        _clean(
            f"session {report['session_id']} \u00b7 generated "
            f"{report['generated_at'][:19].replace('T', ' ')}"
        ),
        st["muted"],
    ))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=HAIRLINE))
    story.append(Spacer(1, 14))

    # Summary stats table
    story.append(Paragraph("SITE SUMMARY", st["h2"]))
    rows = [
        ["Files", str(summary.get("total_files", "\u2014"))],
        ["Total size", summary.get("total_size_human", "\u2014")],
        ["Git history", "Yes" if summary.get("has_git_history") else "No"],
        ["Functions / classes", f"{report['code'].get('total_functions', 0)} / {report['code'].get('total_classes', 0)}"],
        ["Open TODOs", str(report["code"].get("total_todos", 0))],
    ]
    if git.get("available"):
        rows.append(["Commits", str(git.get("commit_count", "\u2014"))])
        rows.append(["Authors", _normalize(", ".join(git.get("authors", [])[:5]) or "\u2014")])

    table = Table(rows, colWidths=[1.8 * inch, 4.4 * inch])
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
        ("TEXTCOLOR", (1, 0), (1, -1), INK),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, HAIRLINE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(table)

    # AI interpretation
    if interp.get("available"):
        story.append(Paragraph("RECONSTRUCTED STORY", st["h2"]))
        if interp.get("estimated_timeline"):
            story.append(Paragraph(f"<b>Timeline:</b> {_clean(interp['estimated_timeline'])}", st["body"]))
            story.append(Spacer(1, 6))
        if interp.get("narrative"):
            story.append(Paragraph(_clean(interp["narrative"]), st["body"]))
            story.append(Spacer(1, 8))
        evolution = interp.get("evolution") or []
        if evolution:
            story.append(Paragraph(" -&gt; ".join(_clean(e) for e in evolution), st["muted"]))
            story.append(Spacer(1, 8))
        if interp.get("key_insight"):
            story.append(Paragraph(f"<b>Key insight:</b> {_clean(interp['key_insight'])}", st["body"]))
    else:
        story.append(Paragraph("RECONSTRUCTED STORY", st["h2"]))
        story.append(Paragraph(
            _clean(interp.get("error", "AI interpretation was not available for this report.")),
            st["muted"],
        ))

    # Findings
    story.append(Paragraph(f"FINDINGS ({len(findings)})", st["h2"]))
    if not findings:
        story.append(Paragraph("No findings surfaced in this pass.", st["muted"]))
    for i, f in enumerate(findings, start=1):
        story.append(Paragraph(
            f"{i:02d} \u00b7 {SEVERITY_LABEL.get(f.get('severity'), (f.get('severity') or '').upper())}",
            st["finding_meta"],
        ))
        story.append(Paragraph(_clean(f.get("title", "")), st["finding_title"]))
        story.append(Paragraph(_clean(f.get("description", "")), st["body"]))
        evidence = f.get("evidence") or []
        if evidence:
            story.append(Paragraph(_clean(" \u00b7 ".join(evidence[:8])), st["evidence"]))
        story.append(Spacer(1, 10))

    doc.build(story)
    return buf.getvalue()
