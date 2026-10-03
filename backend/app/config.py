"""
Shared configuration.

STORAGE_DIR is where uploads, extracted projects and feedback live.
Locally it defaults to backend/storage. On Render (or any host with an
ephemeral filesystem) set the STORAGE_DIR environment variable to a
persistent disk mount, e.g. /var/data/storage, otherwise every redeploy
wipes all sessions.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parent.parent

# Load .env here too: routers import this module before main.py gets to
# call load_dotenv, and STORAGE_DIR must be resolved at import time.
load_dotenv(_BACKEND_DIR / ".env")

STORAGE_DIR = Path(os.getenv("STORAGE_DIR") or (_BACKEND_DIR / "storage"))
