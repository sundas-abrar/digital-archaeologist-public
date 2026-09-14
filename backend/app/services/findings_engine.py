"""
Phase 4: Findings Engine.

Takes the evidence already collected by scanner.py (Phase 2) and
deep_scanner.py (Phase 3) and looks for *connections* in it, instead of
just reporting raw stats:

- timeline_anomaly  -- a file that "looks later" (final, v2, revised)
                       but was modified before the file it supersedes
- repeated_file      -- clusters of files that are clearly the same
                       document across multiple revisions
- hotspot            -- files with a heavy concentration of TODO/FIXME
                       comments, or an unusually large number of
                       functions/classes for one file
- contributor        -- patterns in git authorship / commit timing
- artifact           -- standalone facts worth surfacing (project span,
                       largest file, missing README, etc.)

Each finding carries `evidence`: the actual filenames/values behind the
claim, so nothing is asserted without a receipt.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from .safe_zip import SKIP_NAMES
from .deep_scanner import deep_scan

# Markers that suggest a file is a revision of some earlier file.
# Order matters loosely: later entries are "further along" than earlier ones.
_REVISION_MARKERS = [
    "draft", "wip", "old", "v1", "rough",
    "v2", "v3", "revised", "updated", "new",
    "final", "final2", "finalfinal", "actual", "real", "submission",
]
_MARKER_RANK = {m: i for i, m in enumerate(_REVISION_MARKERS)}

_MARKER_PATTERN = re.compile(
    r"[\s_\-\.]?(" + "|".join(sorted(_REVISION_MARKERS, key=len, reverse=True)) + r")",
    re.IGNORECASE,
)
_PAREN_COPY_PATTERN = re.compile(r"\s?\(\d+\)$")
_TRAILING_NUM_PATTERN = re.compile(r"[\s_\-]?\d+$")


@dataclass
class Finding:
    id: str
    category: str
    severity: str  # info | notable | anomaly
    title: str
    description: str
    evidence: list[str] = field(default_factory=list)


_CONFIDENCE_BASE = {"anomaly": 55, "notable": 45, "info": 35}


def _confidence(severity: str, evidence_count: int) -> int:
    """Heuristic confidence score: how much weight the evidence backing
    a finding gives it. Not a statistical measure — just severity plus
    a diminishing bump per corroborating piece of evidence, capped so
    nothing claims false certainty."""
    base = _CONFIDENCE_BASE.get(severity, 35)
    return min(96, base + min(evidence_count, 10) * 4)


@dataclass
class _FileMeta:
    rel_path: str
    name: str
    stem: str
    ext: str
    size: int
    mtime: datetime


def _human_size(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"


def _walk_files(root: Path) -> list[_FileMeta]:
    out: list[_FileMeta] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_NAMES and d != ".git"]
        for fname in filenames:
            if fname in SKIP_NAMES:
                continue
            fpath = Path(dirpath) / fname
            try:
                stat = fpath.stat()
            except OSError:
                continue
            rel = str(fpath.relative_to(root)).replace("\\", "/")
            out.append(
                _FileMeta(
                    rel_path=rel,
                    name=fname,
                    stem=Path(fname).stem,
                    ext=fpath.suffix.lower() or "(none)",
                    size=stat.st_size,
                    mtime=datetime.fromtimestamp(stat.st_mtime),
                )
            )
    return out


def _normalize_stem(stem: str) -> str:
    """Strip revision markers, trailing numbers and '(1)'-style copy
    suffixes so 'Report_final_v2' and 'Report_draft' both collapse to
    'report', letting us cluster them as the same underlying document."""
    s = stem.lower()
    s = _PAREN_COPY_PATTERN.sub("", s)
    prev = None
    while prev != s:
        prev = s
        s = _MARKER_PATTERN.sub("", s)
    s = _TRAILING_NUM_PATTERN.sub("", s)
    s = re.sub(r"[\s_\-]+", " ", s).strip()
    return s


def _revision_rank(stem: str) -> int:
    """Higher = looks like a later/more-final revision."""
    low = stem.lower()
    best = -1
    for marker, rank in _MARKER_RANK.items():
        if re.search(r"(?<![a-z])" + re.escape(marker) + r"(?![a-z])", low):
            best = max(best, rank)
    return best


def _group_related_files(files: list[_FileMeta]) -> dict[str, list[_FileMeta]]:
    groups: dict[str, list[_FileMeta]] = {}
    for f in files:
        key = f"{_normalize_stem(f.stem)}{f.ext}"
        if not key.strip(f.ext):
            continue  # normalized to nothing useful, skip
        groups.setdefault(key, []).append(f)
    return {k: v for k, v in groups.items() if len(v) >= 2}


def find_timeline_anomalies(files: list[_FileMeta]) -> list[Finding]:
    findings: list[Finding] = []
    for key, group in _group_related_files(files).items():
        ranked = [(f, _revision_rank(f.stem)) for f in group]
        if all(r == -1 for _, r in ranked):
            continue  # no version-ish naming to reason about
        # sort by how "final" the name looks
        by_name_order = sorted(ranked, key=lambda t: t[1])
        by_time_order = sorted(ranked, key=lambda t: t[0].mtime)
        if [f.rel_path for f, _ in by_name_order] != [f.rel_path for f, _ in by_time_order]:
            later_name, later_rank = max(ranked, key=lambda t: t[1])
            earlier_name, earlier_rank = min(ranked, key=lambda t: t[1])
            if later_rank > earlier_rank and later_name.mtime < earlier_name.mtime:
                findings.append(
                    Finding(
                        id=f"timeline:{key}",
                        category="timeline_anomaly",
                        severity="anomaly",
                        title=f'"{later_name.name}" was modified before "{earlier_name.name}"',
                        description=(
                            f'"{later_name.name}" reads like the later revision, but its '
                            f"timestamp ({later_name.mtime.date()}) is earlier than "
                            f'"{earlier_name.name}" ({earlier_name.mtime.date()}). Possible '
                            "causes: files were copied/extracted out of order, or the "
                            "naming doesn't reflect what actually happened."
                        ),
                        evidence=[later_name.rel_path, earlier_name.rel_path],
                    )
                )
    return findings


def find_repeated_files(files: list[_FileMeta], skip_keys: set[str] = frozenset()) -> list[Finding]:
    findings: list[Finding] = []
    for key, group in _group_related_files(files).items():
        if key in skip_keys:
            continue
        ordered = sorted(group, key=lambda f: f.mtime)
        findings.append(
            Finding(
                id=f"repeated:{key}",
                category="repeated_file",
                severity="notable" if len(group) >= 3 else "info",
                title=f"{len(group)} versions of the same file",
                description=(
                    f"These files look like revisions of one document, in this order "
                    f"by modification time: "
                    + " → ".join(f.name for f in ordered)
                    + "."
                ),
                evidence=[f.rel_path for f in ordered],
            )
        )
    return findings


def find_hotspots(deep_scan_files: list[dict[str, Any]]) -> list[Finding]:
    findings: list[Finding] = []
    for f in deep_scan_files:
        todos = f.get("todos") or []
        if len(todos) >= 3:
            tags = sorted({t["tag"] for t in todos})
            findings.append(
                Finding(
                    id=f"hotspot-todo:{f['path']}",
                    category="hotspot",
                    severity="notable" if len(todos) >= 6 else "info",
                    title=f"{f['path']} has {len(todos)} unresolved comments",
                    description=(
                        f"{len(todos)} {'/'.join(tags)} comments concentrated in one file "
                        "— a likely spot for unfinished or risky work."
                    ),
                    evidence=[f"{f['path']}:{t['line']}" for t in todos[:8]],
                )
            )

        code_units = len(f.get("functions") or []) + len(f.get("classes") or [])
        if code_units >= 15:
            findings.append(
                Finding(
                    id=f"hotspot-size:{f['path']}",
                    category="hotspot",
                    severity="info",
                    title=f"{f['path']} concentrates {code_units} functions/classes",
                    description=(
                        "This file carries an unusually large share of the codebase's "
                        "structure in one place — worth checking if it should be split up."
                    ),
                    evidence=[f['path']],
                )
            )
    return findings


def find_contributor_findings(git_info: dict[str, Any]) -> list[Finding]:
    findings: list[Finding] = []
    if not git_info.get("available"):
        return findings

    authors = git_info.get("authors") or []
    commits = git_info.get("commits") or []

    if len(authors) == 1 and commits:
        findings.append(
            Finding(
                id="contributor:solo",
                category="contributor",
                severity="info",
                title="Solo project",
                description=(
                    f"All {len(commits)} commits come from one author: {authors[0]}."
                ),
                evidence=[authors[0]],
            )
        )
    elif len(authors) >= 2:
        findings.append(
            Finding(
                id="contributor:multi",
                category="contributor",
                severity="info",
                title=f"{len(authors)} contributors",
                description=(
                    f"Commit history includes {len(authors)} distinct authors: "
                    + ", ".join(authors[:6])
                    + ("…" if len(authors) > 6 else "")
                    + "."
                ),
                evidence=authors[:8],
            )
        )

    first = git_info.get("first_commit")
    last = git_info.get("last_commit")
    if first and last and first.get("date") and last.get("date"):
        try:
            d_first = datetime.fromisoformat(first["date"])
            d_last = datetime.fromisoformat(last["date"])
            span_hours = abs((d_last - d_first).total_seconds()) / 3600
            if len(commits) >= 8 and span_hours <= 30:
                findings.append(
                    Finding(
                        id="contributor:burst",
                        category="contributor",
                        severity="anomaly",
                        title="Commit burst: most history made in under a day",
                        description=(
                            f"{len(commits)} commits span roughly {span_hours:.0f} hours "
                            f"({d_first.date()} → {d_last.date()}) — consistent with a "
                            "hackathon-style crunch rather than steady, ongoing work."
                        ),
                        evidence=[first["hash"], last["hash"]],
                    )
                )
        except ValueError:
            pass

    return findings


def find_artifacts(files: list[_FileMeta], deep_scan_files: list[dict[str, Any]]) -> list[Finding]:
    findings: list[Finding] = []
    if not files:
        return findings

    oldest = min(files, key=lambda f: f.mtime)
    newest = max(files, key=lambda f: f.mtime)
    span_days = (newest.mtime - oldest.mtime).total_seconds() / 86400
    if span_days >= 1:
        findings.append(
            Finding(
                id="artifact:span",
                category="artifact",
                severity="info",
                title=f"Project spans roughly {span_days:.0f} days",
                description=(
                    f'Oldest file "{oldest.name}" ({oldest.mtime.date()}) to newest '
                    f'"{newest.name}" ({newest.mtime.date()}), based on file '
                    "modification timestamps."
                ),
                evidence=[oldest.rel_path, newest.rel_path],
            )
        )

    largest = max(files, key=lambda f: f.size)
    if largest.size > 0:
        findings.append(
            Finding(
                id="artifact:largest",
                category="artifact",
                severity="info",
                title=f"Largest file: {largest.name} ({_human_size(largest.size)})",
                description="Flagged in case it's a generated/vendored asset worth excluding, or a key deliverable worth highlighting.",
                evidence=[largest.rel_path],
            )
        )

    has_readme = any(f.stem.lower() == "readme" for f in files)
    if not has_readme:
        findings.append(
            Finding(
                id="artifact:no-readme",
                category="artifact",
                severity="notable",
                title="No README found",
                description="No file named README was found at any level of the archive.",
                evidence=[],
            )
        )

    total_todos = sum(len(f.get("todos") or []) for f in deep_scan_files)
    if total_todos == 0 and deep_scan_files:
        findings.append(
            Finding(
                id="artifact:clean-todos",
                category="artifact",
                severity="info",
                title="No TODO/FIXME comments left behind",
                description="The scanned source files carry no outstanding TODO, FIXME, HACK, or XXX markers.",
                evidence=[],
            )
        )

    return findings


def generate_findings(root: Path) -> dict[str, Any]:
    files = _walk_files(root)
    scan = deep_scan(root)

    anomalies = find_timeline_anomalies(files)
    anomaly_keys = {f.id.split(":", 1)[1] for f in anomalies}

    findings: list[Finding] = []
    findings += anomalies
    findings += find_repeated_files(files, skip_keys=anomaly_keys)
    findings += find_hotspots(scan["files"])
    findings += find_contributor_findings(scan["git"])
    findings += find_artifacts(files, scan["files"])

    # Anomalies first, then notable, then info — most interesting on top.
    order = {"anomaly": 0, "notable": 1, "info": 2}
    findings.sort(key=lambda f: order.get(f.severity, 3))

    return {
        "generated_at": datetime.now().isoformat(),
        "total_findings": len(findings),
        "findings": [
            {
                "id": f.id,
                "category": f.category,
                "severity": f.severity,
                "title": f.title,
                "description": f.description,
                "evidence": f.evidence,
                "confidence": _confidence(f.severity, len(f.evidence)),
            }
            for f in findings
        ],
    }


def investigate_finding(root: Path, finding_id: str) -> dict[str, Any] | None:
    """"Improve Analysis" — re-open one finding and look for corroborating
    signal already sitting in the deep-scan data (function/class/TODO/import
    counts for the files cited as evidence) that the fast findings pass
    doesn't surface. Recomputes confidence from the enlarged evidence set.
    Returns None if the finding id no longer exists (e.g. project changed)."""
    baseline = generate_findings(root)
    original = next((f for f in baseline["findings"] if f["id"] == finding_id), None)
    if original is None:
        return None

    scan = deep_scan(root)
    files_by_path = {f["path"]: f for f in scan["files"]}

    extra_evidence: list[str] = []
    for item in original["evidence"]:
        path = item.split(":", 1)[0]
        meta = files_by_path.get(path)
        if not meta:
            continue

        funcs = meta.get("functions") or []
        classes = meta.get("classes") or []
        todos = meta.get("todos") or []
        imports = meta.get("imports") or []

        if funcs:
            extra_evidence.append(f"{path}: {len(funcs)} function(s) defined")
        if classes:
            extra_evidence.append(f"{path}: {len(classes)} class(es) defined")
        if todos:
            extra_evidence.append(f"{path}: {len(todos)} TODO/FIXME marker(s)")
        if imports:
            shown = ", ".join(imports[:3]) + ("…" if len(imports) > 3 else "")
            extra_evidence.append(f"{path}: imports {shown}")

    extra_evidence = list(dict.fromkeys(extra_evidence))[:6]  # de-dupe, cap

    previous_confidence = original["confidence"]
    revised_confidence = _confidence(
        original["severity"], len(original["evidence"]) + len(extra_evidence)
    )

    return {
        "finding_id": finding_id,
        "title": original["title"],
        "previous_confidence": previous_confidence,
        "revised_confidence": revised_confidence,
        "new_evidence": extra_evidence,
        "new_evidence_count": len(extra_evidence),
    }
