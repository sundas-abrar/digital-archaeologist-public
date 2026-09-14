"""
Phase 2 scanning: walk the extracted project and produce
- a file tree the frontend can render
- a lightweight summary (extension counts, total size)

Deep extraction (functions, classes, imports, TODOs, git history) is
Phase 3 — this stays intentionally shallow.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from .safe_zip import SKIP_NAMES


def _human_size(num_bytes: int) -> str:
    size = float(num_bytes)
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f}{unit}"
        size /= 1024
    return f"{size:.1f}TB"


def build_file_tree(path: Path, root: Path) -> dict[str, Any]:
    is_root = path == root
    node: dict[str, Any] = {
        "name": root.name if is_root else path.name,
        "path": "." if is_root else str(path.relative_to(root)).replace("\\", "/"),
        "type": "dir" if path.is_dir() else "file",
    }

    if path.is_dir():
        children = sorted(
            (c for c in path.iterdir() if c.name not in SKIP_NAMES),
            key=lambda p: (p.is_file(), p.name.lower()),
        )
        node["children"] = [build_file_tree(c, root) for c in children]
    else:
        stat = path.stat()
        node["size"] = stat.st_size
        node["size_human"] = _human_size(stat.st_size)
        node["extension"] = path.suffix.lower() or "(none)"

    return node


def scan_summary(root: Path) -> dict[str, Any]:
    total_files = 0
    total_dirs = 0
    total_size = 0
    extension_counts: dict[str, int] = {}
    has_git = False

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_NAMES]
        if ".git" in dirnames:
            has_git = True

        total_dirs += len(dirnames)
        for fname in filenames:
            if fname in SKIP_NAMES:
                continue
            total_files += 1
            fpath = Path(dirpath) / fname
            try:
                total_size += fpath.stat().st_size
            except OSError:
                continue
            ext = fpath.suffix.lower() or "(none)"
            extension_counts[ext] = extension_counts.get(ext, 0) + 1

    top_extensions = sorted(
        extension_counts.items(), key=lambda kv: kv[1], reverse=True
    )[:8]

    return {
        "total_files": total_files,
        "total_dirs": total_dirs,
        "total_size": total_size,
        "total_size_human": _human_size(total_size),
        "has_git_history": has_git,
        "top_extensions": [{"extension": ext, "count": c} for ext, c in top_extensions],
    }
