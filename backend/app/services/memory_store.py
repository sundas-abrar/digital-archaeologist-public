"""
Server-side agent memory, kept in SQLite (standard library, no new
dependency).

What is remembered: the goals given to the agent and the questions asked
in "Ask the dig site", per project session. It lives in
STORAGE_DIR/memory.db, so on Render it survives redeploys as long as
STORAGE_DIR points at a persistent disk. Opening the same dashboard link
(?session=...) on another device therefore shows the same memory.

Rules:
  * memory "off" neither reads nor writes: nothing is saved.
  * how much a request may USE is set by the mode (see services.memory),
    enforced here on the server.
  * a failing memory store must never break an agent run or an answer, so
    recall()/remember() log the problem and carry on without memory.
"""

from __future__ import annotations

import logging
import sqlite3
import threading
import time
from contextlib import closing, contextmanager
from pathlib import Path
from typing import Any

from .memory import FULL_RECENT, MEMORY_LIMITS, clean_history, summarize

log = logging.getLogger(__name__)

KINDS = ("goal", "question")
MAX_STORED_PER_SESSION = 50  # unpinned items kept per session
MAX_PINNED = 10  # pinned items are never pruned, but are capped

_SCHEMA = """
CREATE TABLE IF NOT EXISTS memory (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    kind       TEXT NOT NULL,
    text       TEXT NOT NULL,
    created_at REAL NOT NULL,
    pinned     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_memory_session ON memory (session_id, id);
"""

# Tests point this at a temp file. In the app it stays None and the path
# comes from config (imported lazily so this module has no hard dependency
# on python-dotenv).
DB_PATH: Path | None = None


def _db_path() -> Path:
    if DB_PATH is not None:
        return DB_PATH
    from ..config import STORAGE_DIR

    return STORAGE_DIR / "memory.db"


# Writes are serialised inside this process, and each write also takes
# SQLite's own write lock up front (BEGIN IMMEDIATE) so it waits its turn
# instead of failing halfway. The schema is created once per database file,
# not on every connection, and the default rollback journal is used: the
# traffic here is tiny, and WAL's open/close file churn is a poor fit for
# Windows.
_write_lock = threading.Lock()
_schema_lock = threading.Lock()
_schema_ready_for: Path | None = None


def _ensure_schema(path: Path) -> None:
    global _schema_ready_for
    # path.exists() so a deleted memory.db (e.g. someone cleared storage
    # while the server runs) is recreated instead of erroring until restart.
    if _schema_ready_for == path and path.exists():
        return
    with _schema_lock:
        if _schema_ready_for == path and path.exists():
            return
        conn = sqlite3.connect(path, timeout=10)
        try:
            conn.executescript(_SCHEMA)
            cols = [r[1] for r in conn.execute("PRAGMA table_info(memory)")]
            if "pinned" not in cols:  # database created before pinning existed
                conn.execute("ALTER TABLE memory ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0")
                conn.commit()
        finally:
            conn.close()
        _schema_ready_for = path


def _connect() -> sqlite3.Connection:
    path = _db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    _ensure_schema(path)
    # isolation_level=None -> autocommit; transactions are explicit below.
    conn = sqlite3.connect(path, timeout=10, isolation_level=None)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def _write_txn():
    with _write_lock:
        conn = _connect()
        try:
            conn.execute("BEGIN IMMEDIATE")
            try:
                yield conn
                conn.execute("COMMIT")
            except BaseException:
                if conn.in_transaction:
                    conn.execute("ROLLBACK")
                raise
        finally:
            conn.close()


# --------------------------------------------------------------------- #
# Raw operations (raise sqlite3.Error / OSError on trouble)             #
# --------------------------------------------------------------------- #


def add(session_id: str, kind: str, text: str) -> bool:
    """Store one entry. Returns False if skipped (empty, or an exact repeat
    of the most recent entry, so re-running a goal doesn't flood memory)."""
    if kind not in KINDS:
        raise ValueError(f"unknown memory kind: {kind!r}")
    cleaned = clean_history([text], "full")
    if not cleaned:
        return False
    value = cleaned[0]

    with _write_txn() as conn:
        last = conn.execute(
            "SELECT kind, text FROM memory WHERE session_id = ? ORDER BY id DESC LIMIT 1",
            (session_id,),
        ).fetchone()
        if last is not None and last["kind"] == kind and last["text"] == value:
            return False

        conn.execute(
            "INSERT INTO memory (session_id, kind, text, created_at) VALUES (?, ?, ?, ?)",
            (session_id, kind, value, time.time()),
        )
        conn.execute(
            """DELETE FROM memory WHERE session_id = ? AND pinned = 0 AND id NOT IN (
                   SELECT id FROM memory WHERE session_id = ? AND pinned = 0 ORDER BY id DESC LIMIT ?)""",
            (session_id, session_id, MAX_STORED_PER_SESSION),
        )
    return True


def recent(session_id: str, limit: int) -> list[dict[str, Any]]:
    """The last `limit` entries, oldest first."""
    if limit <= 0:
        return []
    with closing(_connect()) as conn:
        rows = conn.execute(
            "SELECT id, kind, text, created_at, pinned FROM memory "
            "WHERE session_id = ? ORDER BY id DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
    return [dict(r) for r in reversed(rows)]


def all_entries(session_id: str) -> list[dict[str, Any]]:
    """Everything stored for the session, oldest first."""
    with closing(_connect()) as conn:
        rows = conn.execute(
            "SELECT id, kind, text, created_at, pinned FROM memory WHERE session_id = ? ORDER BY id",
            (session_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def pin(session_id: str, item_id: int, pinned: bool = True) -> bool:
    """Pin/unpin one item. Pinned items survive pruning. False if not found
    or the pin limit is reached."""
    with _write_txn() as conn:
        if pinned:
            n = conn.execute("SELECT COUNT(*) FROM memory WHERE session_id = ? AND pinned = 1", (session_id,)).fetchone()[0]
            if n >= MAX_PINNED:
                return False
        cur = conn.execute("UPDATE memory SET pinned = ? WHERE id = ? AND session_id = ?",
                           (1 if pinned else 0, item_id, session_id))
        return cur.rowcount > 0


def count(session_id: str) -> int:
    with closing(_connect()) as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM memory WHERE session_id = ?", (session_id,)
        ).fetchone()
    return int(row["n"])


def clear(session_id: str) -> int:
    """Forget everything for this session. Returns how many entries went."""
    with _write_txn() as conn:
        return conn.execute("DELETE FROM memory WHERE session_id = ?", (session_id,)).rowcount


# --------------------------------------------------------------------- #
# Safe API used by the agent and Ask routes                             #
# --------------------------------------------------------------------- #


def recall_entries(session_id: str, mode: str) -> list[dict[str, Any]]:
    """What a request in `mode` may use, as entries. half: pinned + last 3.
    full: summary of older items + pinned + last FULL_RECENT."""
    if MEMORY_LIMITS.get(mode, 0) == 0:
        return []
    rows = all_entries(session_id)
    keep = MEMORY_LIMITS["half"] if mode == "half" else FULL_RECENT
    recent_rows = rows[-keep:]
    older = rows[:-keep]
    pinned = [r for r in older if r["pinned"]]
    out = pinned + recent_rows
    if mode == "full":
        rest = [r["text"] for r in older if not r["pinned"]]
        if rest:
            out = [{"id": None, "kind": "summary", "text": summarize(rest), "created_at": 0, "pinned": 0}] + out
    return out


def recall(session_id: str, mode: str) -> list[str]:
    """What a request in `mode` is allowed to use, as plain strings."""
    try:
        return [e["text"] for e in recall_entries(session_id, mode)]
    except (sqlite3.Error, OSError):
        log.exception("memory recall failed; continuing without memory")
        return []


def remember(session_id: str, mode: str, kind: str, text: str) -> None:
    """Save an entry, unless memory is off."""
    if MEMORY_LIMITS.get(mode, 0) == 0:
        return
    try:
        add(session_id, kind, text)
    except (sqlite3.Error, OSError):
        log.exception("memory write failed; continuing")
