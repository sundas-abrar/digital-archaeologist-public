"""
Simple shared-password gate for deployment.

Not a real auth system \u2014 no users, no sessions, just one shared
secret so a publicly-reachable deployment (which can execute uploaded
code via the Testing/QA and Agent panels) isn't wide open to anyone who
finds the URL.

If SITE_PASSWORD isn't set (e.g. local development), the gate is a
no-op and everything behaves exactly as before.
"""

from __future__ import annotations

import os

from fastapi import Header, HTTPException

SITE_PASSWORD = os.getenv("SITE_PASSWORD", "")


def require_site_password(x_site_password: str | None = Header(default=None)) -> None:
    if not SITE_PASSWORD:
        return
    if x_site_password != SITE_PASSWORD:
        raise HTTPException(status_code=401, detail="Missing or incorrect site password.")
