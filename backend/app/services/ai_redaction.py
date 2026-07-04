from __future__ import annotations

import hashlib
import re

SECRET_LIKE_PATTERN = re.compile(
    r"(api[_-]?key|appsecret|db[_-]?password|database_url|bearer\s+[a-z0-9._-]+|"
    r"sk-[a-z0-9_-]{8,}|token\s*[:=]\s*[a-z0-9._-]+|cookie\s*[:=])",
    re.IGNORECASE,
)

REDACTED_SECRET_MARKER = "[REDACTED_SECRET_LIKE_INPUT]"


def contains_secret_like_text(value: str) -> bool:
    return bool(SECRET_LIKE_PATTERN.search(value))


def redact_secret_like_text(value: str) -> tuple[str, bool]:
    if not contains_secret_like_text(value):
        return value, False
    return SECRET_LIKE_PATTERN.sub(REDACTED_SECRET_MARKER, value), True


def safe_preview(value: str, max_chars: int = 240) -> str:
    redacted, was_redacted = redact_secret_like_text(value)
    if was_redacted:
        return REDACTED_SECRET_MARKER
    return redacted[:max_chars]


def stable_text_hash(value: str) -> str:
    redacted, _ = redact_secret_like_text(value)
    return hashlib.sha256(redacted.encode("utf-8")).hexdigest()
