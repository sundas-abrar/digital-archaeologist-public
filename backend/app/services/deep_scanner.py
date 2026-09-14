"""
Phase 3: Archaeological Scanner.

Goes file-by-file through the extracted project and pulls out evidence:
- functions and classes (regex-based, not a full parser \u2014 good enough
  to find "what exists", not to type-check it)
- import/require statements
- TODO / FIXME / HACK / XXX comments, with line numbers
- git commit history, if a .git folder survived the zip

This is intentionally shallow parsing over a wide set of files rather
than deep parsing of a few \u2014 the goal is evidence collection, not
a compiler.
"""

from __future__ import annotations

import os
import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

from .safe_zip import SKIP_NAMES

MAX_FILE_SIZE_TO_PARSE = 1_000_000  # skip anything > 1MB (generated/binary-ish)
MAX_FILES_TO_DEEP_SCAN = 800

TEXT_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rb", ".php",
    ".c", ".cpp", ".h", ".cs", ".md", ".txt", ".yml", ".yaml", ".json",
    ".html", ".css",
}

_JS_LIKE = (".js", ".jsx", ".ts", ".tsx")

FUNCTION_PATTERNS: dict[str, re.Pattern] = {
    ".py": re.compile(r"^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\("),
    ".java": re.compile(
        r"(?:public|private|protected|static)[\w\s<>\[\],]*\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;]*\)\s*\{"
    ),
}
_js_fn = re.compile(
    r"function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\("
    r"|const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\("
    r"|const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>"
)
for _ext in _JS_LIKE:
    FUNCTION_PATTERNS[_ext] = _js_fn

CLASS_PATTERNS: dict[str, re.Pattern] = {
    ".py": re.compile(r"^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)"),
    ".java": re.compile(r"(?:public\s+)?(?:abstract\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)"),
}
_js_cls = re.compile(r"class\s+([A-Za-z_$][A-Za-z0-9_$]*)")
for _ext in _JS_LIKE:
    CLASS_PATTERNS[_ext] = _js_cls

IMPORT_PATTERNS: dict[str, re.Pattern] = {
    ".py": re.compile(r"^\s*(?:import|from)\s+([\w\.]+)"),
}
_js_import = re.compile(
    r"import\s+.*?from\s+['\"]([^'\"]+)['\"]"
    r"|require\(\s*['\"]([^'\"]+)['\"]\s*\)"
)
for _ext in _JS_LIKE:
    IMPORT_PATTERNS[_ext] = _js_import

TODO_PATTERN = re.compile(r"\b(TODO|FIXME|HACK|XXX)\b[:\s]*(.*)", re.IGNORECASE)


def _read_lines(path: Path) -> list[str] | None:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.readlines()
    except OSError:
        return None


def analyze_file(path: Path, rel_path: str) -> dict[str, Any]:
    ext = path.suffix.lower()
    stat = path.stat()

    info: dict[str, Any] = {
        "path": rel_path,
        "extension": ext or "(none)",
        "size": stat.st_size,
        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
    }

    if stat.st_size > MAX_FILE_SIZE_TO_PARSE or ext not in TEXT_EXTENSIONS:
        return info

    lines = _read_lines(path)
    if lines is None:
        return info

    fn_pat = FUNCTION_PATTERNS.get(ext)
    cls_pat = CLASS_PATTERNS.get(ext)
    imp_pat = IMPORT_PATTERNS.get(ext)

    functions: list[dict] = []
    classes: list[dict] = []
    imports: list[str] = []
    todos: list[dict] = []

    for i, line in enumerate(lines, start=1):
        if fn_pat:
            m = fn_pat.search(line)
            if m:
                name = next((g for g in m.groups() if g), None)
                if name:
                    functions.append({"name": name, "line": i})
        if cls_pat:
            m = cls_pat.search(line)
            if m:
                classes.append({"name": m.group(1), "line": i})
        if imp_pat:
            m = imp_pat.search(line)
            if m:
                mod = next((g for g in m.groups() if g), None)
                if mod:
                    imports.append(mod)

        todo_m = TODO_PATTERN.search(line)
        if todo_m:
            todos.append(
                {
                    "tag": todo_m.group(1).upper(),
                    "text": todo_m.group(2).strip()[:200],
                    "line": i,
                }
            )

    if functions:
        info["functions"] = functions
    if classes:
        info["classes"] = classes
    if imports:
        info["imports"] = sorted(set(imports))
    if todos:
        info["todos"] = todos

    return info


def scan_git_history(root: Path, max_commits: int = 200) -> dict[str, Any]:
    if not (root / ".git").exists():
        return {"available": False}

    try:
        result = subprocess.run(
            [
                "git",
                "log",
                f"-n{max_commits}",
                "--date=iso-strict",
                "--pretty=format:%H|%an|%ad|%s",
            ],
            cwd=root,
            capture_output=True,
            text=True,
            timeout=15,
        )
    except (OSError, subprocess.TimeoutExpired):
        return {"available": False, "error": "git command not available on this machine"}

    if result.returncode != 0:
        return {"available": False, "error": (result.stderr or "unknown git error").strip()[:200]}

    commits = []
    authors = set()
    for line in result.stdout.strip().splitlines():
        parts = line.split("|", 3)
        if len(parts) != 4:
            continue
        commit_hash, author, date, message = parts
        commits.append(
            {"hash": commit_hash[:8], "author": author, "date": date, "message": message}
        )
        authors.add(author)

    return {
        "available": True,
        "commit_count": len(commits),
        "authors": sorted(authors),
        "first_commit": commits[-1] if commits else None,
        "last_commit": commits[0] if commits else None,
        "commits": commits,
    }


def deep_scan(root: Path) -> dict[str, Any]:
    files_report: list[dict[str, Any]] = []
    total_functions = 0
    total_classes = 0
    total_todos = 0
    scanned = 0

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_NAMES and d != ".git"]
        if scanned >= MAX_FILES_TO_DEEP_SCAN:
            break
        for fname in filenames:
            if fname in SKIP_NAMES:
                continue
            if scanned >= MAX_FILES_TO_DEEP_SCAN:
                break
            fpath = Path(dirpath) / fname
            rel = str(fpath.relative_to(root)).replace("\\", "/")
            info = analyze_file(fpath, rel)

            if any(k in info for k in ("functions", "classes", "imports", "todos")):
                files_report.append(info)

            total_functions += len(info.get("functions", []))
            total_classes += len(info.get("classes", []))
            total_todos += len(info.get("todos", []))
            scanned += 1

    return {
        "files_analyzed": scanned,
        "files_with_findings": len(files_report),
        "total_functions": total_functions,
        "total_classes": total_classes,
        "total_todos": total_todos,
        "files": files_report,
        "git": scan_git_history(root),
    }
