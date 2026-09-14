from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.fix_proposer import propose_fix
from ..services.qa_runner import (
    UnsafeCommandError,
    analyze_failure,
    detect_test_commands,
    run_command,
)

router = APIRouter(prefix="/api/qa", tags=["qa"])

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage"


def _extract_dir(session_id: str) -> Path:
    d = STORAGE_DIR / session_id / "extracted"
    if not d.exists():
        raise HTTPException(status_code=404, detail="Session not found. Upload the archive again.")
    return d


@router.get("/{session_id}/detect")
def detect(session_id: str):
    """Step 1 of the flow: suggest safe, sensible test commands for this project."""
    root = _extract_dir(session_id)
    return detect_test_commands(root)


class RunRequest(BaseModel):
    command: str


@router.post("/{session_id}/run")
def run(session_id: str, body: RunRequest):
    """Steps 'Code executed -> Test failed/passed'. If it failed, failure
    analysis is bundled into the same response so the frontend doesn't
    need a second round trip."""
    root = _extract_dir(session_id)
    try:
        result = run_command(root, body.command)
    except UnsafeCommandError as e:
        raise HTTPException(status_code=400, detail=str(e))

    response: dict = {"result": result}
    if not result["passed"]:
        response["failure"] = analyze_failure(result, root)
    return response


class ProposeFixRequest(BaseModel):
    file: str | None = None
    error_type: str | None = None
    error_message: str | None = None
    code_snippet: str | None = None
    raw_output: str | None = None
    line: int | None = None


@router.post("/{session_id}/propose-fix")
def propose(session_id: str, body: ProposeFixRequest):
    """Steps 'AI analyzes error -> identifies probable cause -> generates
    fix'. Proposes only \u2014 nothing is written to disk here."""
    _extract_dir(session_id)  # validates the session still exists
    return propose_fix(body.model_dump())


class ApplyFixRequest(BaseModel):
    file: str
    new_content: str


@router.post("/{session_id}/apply-fix")
def apply(session_id: str, body: ApplyFixRequest):
    """Step 'Human approval -> Apply fix'. Only called after the person
    explicitly clicks Apply in the UI. Keeps a .bak of the original the
    first time a file is touched, so a bad AI-proposed fix is always
    recoverable."""
    root = _extract_dir(session_id)
    root_resolved = root.resolve()
    target = (root / body.file).resolve()

    if root_resolved != target and root_resolved not in target.parents:
        raise HTTPException(status_code=400, detail="Invalid file path.")
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found.")

    backup = target.with_suffix(target.suffix + ".bak")
    if not backup.exists():
        try:
            backup.write_text(
                target.read_text(encoding="utf-8", errors="ignore"), encoding="utf-8"
            )
        except OSError:
            pass  # backup is best-effort; don't block the fix over it

    target.write_text(body.new_content, encoding="utf-8")
    return {
        "status": "applied",
        "file": body.file,
        "backup": str(backup.relative_to(root)) if backup.exists() else None,
    }
