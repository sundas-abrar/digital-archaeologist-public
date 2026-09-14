"""
Safe ZIP extraction.

Handles the two classic dangers of accepting user-uploaded archives:
1. "Zip slip" — a member path like "../../etc/passwd" that escapes the
   extraction directory.
2. Zip bombs / oversized archives — too many files, or too much
   uncompressed data, for a hackathon-scale demo to reasonably handle.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

MAX_FILES = 2000
MAX_TOTAL_UNCOMPRESSED_BYTES = 200 * 1024 * 1024  # 200 MB
MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024  # 50 MB

SKIP_NAMES = {"__MACOSX", ".DS_Store", "Thumbs.db"}


class UnsafeArchiveError(ValueError):
    """Raised when an uploaded archive fails a safety check."""


def safe_extract(zip_path: Path, dest_dir: Path) -> None:
    dest_resolved = dest_dir.resolve()
    dest_resolved.mkdir(parents=True, exist_ok=True)

    if not zipfile.is_zipfile(zip_path):
        raise UnsafeArchiveError("File is not a valid .zip archive.")

    with zipfile.ZipFile(zip_path) as zf:
        infos = zf.infolist()

        if len(infos) == 0:
            raise UnsafeArchiveError("Archive is empty.")
        if len(infos) > MAX_FILES:
            raise UnsafeArchiveError(
                f"Archive has too many entries (> {MAX_FILES}). "
                "Trim the project before uploading."
            )

        total_size = 0
        for info in infos:
            if info.file_size > MAX_SINGLE_FILE_BYTES:
                raise UnsafeArchiveError(
                    f"'{info.filename}' is larger than the {MAX_SINGLE_FILE_BYTES // (1024*1024)}MB per-file limit."
                )
            total_size += info.file_size

            # Zip-slip check: resolved member path must stay inside dest_resolved.
            member_path = (dest_resolved / info.filename).resolve()
            if dest_resolved not in member_path.parents and member_path != dest_resolved:
                raise UnsafeArchiveError(
                    f"Archive contains an unsafe path: '{info.filename}'."
                )

        if total_size > MAX_TOTAL_UNCOMPRESSED_BYTES:
            raise UnsafeArchiveError(
                f"Archive would extract to more than "
                f"{MAX_TOTAL_UNCOMPRESSED_BYTES // (1024*1024)}MB. Too large for this demo."
            )

        zf.extractall(dest_resolved)
