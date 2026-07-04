from __future__ import annotations

import hashlib
import hmac
import secrets


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def compare_token_hash(token: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_session_token(token), expected_hash)
