"""
Testing / QA panel: execute -> test -> failure analysis -> auto-fix
proposal -> human approval -> apply fix -> re-test -> verify.

This runs commands against the user's OWN uploaded project, on their
OWN machine \u2014 it is not a hosted multi-tenant sandbox. Given that
trust model, the safety measures here are:
- a fixed allowlist of interpreter executables (python, pytest, npm...)
- commands are split with shlex and run with shell=False, so shell
  metacharacters (;, &&, |, backticks, $(...)) can't do anything even
  if present \u2014 they're just literal argv text passed to the
  interpreter, not shell syntax
- a hard timeout on every run
- output is truncated before being stored/returned

None of this makes running arbitrary third-party code "safe" in an
absolute sense \u2014 the person running it should only do so with
projects they trust, same as running `npm test` on any repo they clone.
"""

from __future__ import annotations

import json
import shlex
import subprocess
from pathlib import Path
from typing import Any

ALLOWED_EXECUTABLES = {
    "python",
    "python3",
    "pytest",
    "npm",
    "npx",
    "node",
    "yarn",
    "pnpm",
    "go",
    "dotnet",
    "mvn",
    "gradle",
    "ruby",
    "java",
}

DISALLOWED_SUBSTRINGS = ("&&", "||", ";", "|", ">", "<", "`", "$(")

MAX_OUTPUT_CHARS = 8000
DEFAULT_TIMEOUT = 60


class UnsafeCommandError(ValueError):
    pass


def validate_command(command: str) -> list[str]:
    if len(command) > 500:
        raise UnsafeCommandError("Command is too long.")

    for bad in DISALLOWED_SUBSTRINGS:
        if bad in command:
            raise UnsafeCommandError(
                f"Command contains disallowed shell syntax: '{bad}'. "
                "Only a single interpreter invocation is allowed."
            )

    try:
        # posix=False: don't treat backslashes as escape characters, so
        # Windows-style paths (if a custom command includes one) survive
        # intact instead of losing characters after each backslash.
        parts = shlex.split(command, posix=False)
        # posix=False leaves surrounding quote characters in place; strip
        # them off each token so "foo.py" and foo.py behave the same.
        parts = [p[1:-1] if len(p) >= 2 and p[0] == p[-1] == '"' else p for p in parts]
    except ValueError as e:
        raise UnsafeCommandError(f"Couldn't parse command: {e}")

    if not parts:
        raise UnsafeCommandError("Empty command.")

    if parts[0] not in ALLOWED_EXECUTABLES:
        raise UnsafeCommandError(
            f"'{parts[0]}' isn't an allowed interpreter. Allowed: "
            + ", ".join(sorted(ALLOWED_EXECUTABLES))
        )

    return parts


def detect_test_commands(root: Path) -> dict[str, Any]:
    suggestions: list[dict[str, str]] = []

    has_pytest_files = any(root.rglob("test_*.py")) or any(root.rglob("*_test.py"))
    if has_pytest_files or (root / "pytest.ini").exists() or (root / "conftest.py").exists():
        suggestions.append({"label": "Run pytest", "command": "python -m pytest -q"})

    package_json = root / "package.json"
    if package_json.exists():
        try:
            data = json.loads(package_json.read_text(encoding="utf-8", errors="ignore"))
            scripts = data.get("scripts", {})
            if "test" in scripts:
                suggestions.append({"label": "npm test", "command": "npm test"})
            if "build" in scripts:
                suggestions.append({"label": "npm run build", "command": "npm run build"})
        except (json.JSONDecodeError, OSError):
            pass

    if not suggestions:
        py_files = list(root.rglob("*.py"))[:50]
        if py_files:
            # Always forward slashes \u2014 shlex (and Python itself) treats
            # backslashes as escape characters, which mangles Windows-style
            # paths like "pkg\\app.py" into "pkgapp.py". Python accepts
            # forward slashes fine on Windows too.
            rel = [str(p.relative_to(root)).replace("\\", "/") for p in py_files]
            suggestions.append(
                {
                    "label": "Syntax-check Python files",
                    "command": "python -m py_compile " + " ".join(rel),
                }
            )

    return {"suggestions": suggestions}


def run_command(root: Path, command: str, timeout: int = DEFAULT_TIMEOUT) -> dict[str, Any]:
    parts = validate_command(command)
    try:
        result = subprocess.run(
            parts,
            cwd=root,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=False,
        )
        return {
            "command": command,
            "returncode": result.returncode,
            "passed": result.returncode == 0,
            "stdout": result.stdout[-MAX_OUTPUT_CHARS:],
            "stderr": result.stderr[-MAX_OUTPUT_CHARS:],
            "timed_out": False,
        }
    except FileNotFoundError:
        return {
            "command": command,
            "returncode": None,
            "passed": False,
            "stdout": "",
            "stderr": f"'{parts[0]}' isn't installed, or isn't on PATH, on this machine.",
            "timed_out": False,
        }
    except subprocess.TimeoutExpired:
        return {
            "command": command,
            "returncode": None,
            "passed": False,
            "stdout": "",
            "stderr": f"Command timed out after {timeout}s.",
            "timed_out": True,
        }


_FILE_LINE_PATTERNS = (
    # Python traceback: File "path", line N
    (r'File "([^"]+)", line (\d+)'),
    # pytest short summary: path/to/file.py:23: AssertionError
    (r"([^\s:]+\.py):(\d+):"),
    # Node/JS stack frames: at Object.<anonymous> (path/to/file.js:12:5)
    (r"\(([^():]+\.[jt]sx?):(\d+):\d+\)"),
)


def _find_failing_file(output: str, root: Path) -> tuple[str | None, int | None]:
    import re

    candidates: list[tuple[str, int]] = []
    for pattern in _FILE_LINE_PATTERNS:
        for match in re.finditer(pattern, output):
            raw_path, raw_line = match.group(1), match.group(2)
            candidate = Path(raw_path)
            try:
                if not candidate.is_absolute():
                    candidate = (root / candidate).resolve()
                else:
                    candidate = candidate.resolve()
                root_resolved = root.resolve()
                if root_resolved == candidate or root_resolved in candidate.parents:
                    if candidate.exists() and candidate.is_file():
                        rel = str(candidate.relative_to(root_resolved)).replace("\\", "/")
                        candidates.append((rel, int(raw_line)))
            except (ValueError, OSError):
                continue

    if not candidates:
        return None, None

    # A real traceback lists frames outermost-first, innermost-last \u2014
    # the last in-project frame is usually where the bug actually is,
    # not just the test that called into it. Prefer a non-test file if
    # the very last frame happens to be the test itself but an earlier
    # frame points somewhere else more specific.
    for rel, line in reversed(candidates):
        if not (rel.startswith("test_") or rel.endswith("_test.py") or "/test_" in rel):
            return rel, line

    return candidates[-1]


def _find_exception(output: str) -> tuple[str | None, str | None]:
    import re

    # Python-style: SomeError: message (traceback's final line)
    m = re.search(r"^(\w+(?:Error|Exception|Warning)):\s*(.*)$", output, re.MULTILINE)
    if m:
        return m.group(1), m.group(2).strip()[:300]

    # pytest -q tail format: "test_file.py:12: AssertionError" (no message
    # on that line \u2014 the detail is on the "E   ..." line(s) above it)
    m = re.search(r":\d+:\s*(\w+(?:Error|Exception|Warning))\s*$", output, re.MULTILINE)
    if m:
        e_lines = re.findall(r"^E\s+(.*)$", output, re.MULTILINE)
        message = e_lines[0].strip()[:300] if e_lines else None
        return m.group(1), message

    # Bare "E   assert ..." with no named exception class at all
    e_lines = re.findall(r"^E\s+(.*)$", output, re.MULTILINE)
    if e_lines:
        return "AssertionError", e_lines[0].strip()[:300]

    return None, None


def analyze_failure(result: dict[str, Any], root: Path) -> dict[str, Any]:
    output = (result.get("stderr", "") or "") + "\n" + (result.get("stdout", "") or "")

    target_file, target_line = _find_failing_file(output, root)
    error_type, error_message = _find_exception(output)

    code_snippet = ""
    if target_file:
        full_path = root / target_file
        if full_path.exists():
            try:
                code_snippet = full_path.read_text(encoding="utf-8", errors="ignore")[:4000]
            except OSError:
                code_snippet = ""

    return {
        "error_type": error_type,
        "error_message": error_message,
        "file": target_file,
        "line": target_line,
        "code_snippet": code_snippet,
        "raw_output": output[-MAX_OUTPUT_CHARS:],
    }
