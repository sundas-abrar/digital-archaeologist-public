from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from ..services.safe_zip import UnsafeArchiveError, safe_extract
from ..services.scanner import build_file_tree, scan_summary

router = APIRouter(prefix="/api", tags=["upload"])

STORAGE_DIR = Path(__file__).resolve().parent.parent.parent / "storage"
STORAGE_DIR.mkdir(exist_ok=True)

# Anything that could run as code on the server/host is rejected outright.
# Everything else (docs, text, images, code files, archives) is welcome —
# this is an archaeology tool, evidence comes in many formats.
BLOCKED_EXTENSIONS = {
    ".exe", ".dll", ".so", ".dylib", ".bin", ".msi", ".apk", ".jar",
    ".sh", ".bat", ".cmd", ".com", ".scr", ".ps1", ".app",
}

MAX_SINGLE_FILE_BYTES = 25 * 1024 * 1024  # 25MB — generous for a doc/pdf/image
MAX_FILES_PER_UPLOAD = 50


def _unique_path(dest_dir: Path, name: str) -> Path:
    """Avoid clobbering an existing file/folder when names collide
    across multiple uploaded items (e.g. two files both named notes.txt)."""
    candidate = dest_dir / name
    if not candidate.exists():
        return candidate

    stem = Path(name).stem
    suffix = Path(name).suffix
    i = 1
    while True:
        candidate = dest_dir / f"{stem} ({i}){suffix}"
        if not candidate.exists():
            return candidate
        i += 1


async def _save_single_file(upload: UploadFile, dest_dir: Path) -> None:
    dest_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(upload.filename or "file").name  # strip any path components
    dest = _unique_path(dest_dir, safe_name)

    size = 0
    with open(dest, "wb") as out:
        while chunk := await upload.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_SINGLE_FILE_BYTES:
                out.close()
                dest.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=400,
                    detail=f"'{upload.filename}' is too large "
                    f"(> {MAX_SINGLE_FILE_BYTES // (1024 * 1024)}MB).",
                )
            out.write(chunk)


@router.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files at once (> {MAX_FILES_PER_UPLOAD}). Zip them up instead.",
        )

    for f in files:
        if not f.filename:
            raise HTTPException(status_code=400, detail="One of the files has no name.")
        ext = Path(f.filename).suffix.lower()
        if ext in BLOCKED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"'{ext}' files aren't accepted for safety reasons.",
            )

    session_id = uuid.uuid4().hex[:12]
    session_dir = STORAGE_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    extract_dir = session_dir / "extracted"
    extract_dir.mkdir(parents=True, exist_ok=True)

    multiple = len(files) > 1

    try:
        for f in files:
            ext = Path(f.filename or "").suffix.lower()

            if ext == ".zip":
                # Archive: extract safely. If several items were dropped
                # together, give each zip its own named subfolder so their
                # contents don't collide.
                zip_path = session_dir / f"upload_{uuid.uuid4().hex[:8]}.zip"
                try:
                    with open(zip_path, "wb") as out:
                        shutil.copyfileobj(f.file, out)

                    zip_stem = Path(f.filename).stem or "archive"
                    target_dir = (
                        _unique_path(extract_dir, zip_stem) if multiple else extract_dir
                    )
                    try:
                        safe_extract(zip_path, target_dir)
                    except UnsafeArchiveError as e:
                        raise HTTPException(
                            status_code=400, detail=f"'{f.filename}': {e}"
                        )
                finally:
                    zip_path.unlink(missing_ok=True)
            else:
                # Single artifact (txt, pdf, docx, image, a lone code file, ...)
                await _save_single_file(f, extract_dir)

        tree = build_file_tree(extract_dir, extract_dir)
        summary = scan_summary(extract_dir)

    except HTTPException:
        shutil.rmtree(session_dir, ignore_errors=True)
        raise
    except Exception as e:  # noqa: BLE001 - surface unexpected errors, don't leak a 500 with no context
        shutil.rmtree(session_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Failed to process upload: {e}")

    display_name = files[0].filename if len(files) == 1 else f"{len(files)} files"

    return {
        "session_id": session_id,
        "filename": display_name,
        "file_tree": tree,
        "summary": summary,
    }


@router.get("/upload/{session_id}/tree")
def get_tree(session_id: str):
    extract_dir = STORAGE_DIR / session_id / "extracted"
    if not extract_dir.exists():
        raise HTTPException(status_code=404, detail="Session not found. Upload again.")

    tree = build_file_tree(extract_dir, extract_dir)
    summary = scan_summary(extract_dir)
    return {"session_id": session_id, "file_tree": tree, "summary": summary}
