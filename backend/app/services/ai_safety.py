from __future__ import annotations

import re
from dataclasses import dataclass

from app.schemas import AIWarning, ErrorCode

MAX_SOURCE_TEXT_CHARS = 2000
MAX_REFERENCE_TITLES = 5
MAX_REFERENCE_TITLE_CHARS = 80
MAX_CONSTRAINTS = 5
MAX_CONSTRAINT_CHARS = 120
MAX_SUGGESTION_COUNT = 5
SUPPORTED_LOCALES = {"zh-CN", "en-US"}

SECRET_LIKE_PATTERN = re.compile(
    r"(api[_-]?key|appsecret|db[_-]?password|database_url|bearer\s+[a-z0-9._-]+|"
    r"sk-[a-z0-9_-]{8,}|token\s*[:=]\s*[a-z0-9._-]+|cookie\s*[:=])",
    re.IGNORECASE,
)


class AISafetyError(ValueError):
    def __init__(self, code: ErrorCode, message: str) -> None:
        self.code = code
        super().__init__(message)


@dataclass(frozen=True)
class SanitizedAIRequest:
    source_text: str
    content_type: str
    tone: str
    platform: str
    count: int
    constraints: list[str]
    reference_titles: list[str]
    locale: str
    warnings: list[AIWarning]
    contains_secret_like_text: bool


def sanitize_title_suggestion_request(
    source_text: str,
    content_type: str,
    tone: str | None,
    platform: str | None,
    count: int,
    constraints: list[str],
    reference_titles: list[str],
    locale: str,
) -> SanitizedAIRequest:
    warnings: list[AIWarning] = []
    normalized_source = normalize_space(source_text)
    if not normalized_source:
        raise AISafetyError(ErrorCode.AI_EMPTY_INPUT, "ai_empty_input")
    if len(normalized_source) > MAX_SOURCE_TEXT_CHARS:
        raise AISafetyError(ErrorCode.AI_INPUT_TOO_LONG, "ai_input_too_long")

    safe_locale = locale.strip() or "zh-CN"
    if safe_locale not in SUPPORTED_LOCALES:
        warnings.append(AIWarning(code="UNSUPPORTED_LOCALE_FALLBACK", message="unsupported_locale_fallback"))
        safe_locale = "zh-CN"

    safe_count = count
    if safe_count > MAX_SUGGESTION_COUNT:
        warnings.append(AIWarning(code="COUNT_CLAMPED", message="count_clamped_to_safe_limit"))
        safe_count = MAX_SUGGESTION_COUNT

    contains_secret_like_text = bool(SECRET_LIKE_PATTERN.search(normalized_source))
    if contains_secret_like_text:
        warnings.append(AIWarning(code="SECRET_LIKE_INPUT_REDACTED", message="secret_like_input_not_echoed"))
        normalized_source = "[REDACTED_SECRET_LIKE_INPUT]"

    safe_constraints, constraint_secret_found = normalize_limited_list(
        constraints, MAX_CONSTRAINTS, MAX_CONSTRAINT_CHARS
    )
    safe_reference_titles, reference_secret_found = normalize_limited_list(
        reference_titles, MAX_REFERENCE_TITLES, MAX_REFERENCE_TITLE_CHARS
    )
    safe_content_type, content_type_secret_found = normalize_label(content_type, default="title")
    safe_tone, tone_secret_found = normalize_label(tone, default="balanced")
    safe_platform, platform_secret_found = normalize_label(platform, default="generic")
    contains_any_secret_like_text = any(
        [
            contains_secret_like_text,
            constraint_secret_found,
            reference_secret_found,
            content_type_secret_found,
            tone_secret_found,
            platform_secret_found,
        ]
    )
    if contains_any_secret_like_text and not contains_secret_like_text:
        warnings.append(AIWarning(code="SECRET_LIKE_INPUT_REDACTED", message="secret_like_input_not_echoed"))
    return SanitizedAIRequest(
        source_text=normalized_source,
        content_type=safe_content_type,
        tone=safe_tone,
        platform=safe_platform,
        count=safe_count,
        constraints=safe_constraints,
        reference_titles=safe_reference_titles,
        locale=safe_locale,
        warnings=warnings,
        contains_secret_like_text=contains_any_secret_like_text,
    )


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_label(value: str | None, default: str) -> tuple[str, bool]:
    normalized = normalize_space(value or "")
    if not normalized:
        return default, False
    if SECRET_LIKE_PATTERN.search(normalized):
        return default, True
    return normalized.lower(), False


def normalize_limited_list(values: list[str], max_items: int, max_chars: int) -> tuple[list[str], bool]:
    normalized: list[str] = []
    secret_found = False
    for value in values[:max_items]:
        item = normalize_space(value)
        if item:
            if SECRET_LIKE_PATTERN.search(item):
                secret_found = True
                normalized.append("[REDACTED_SECRET_LIKE_INPUT]")
            else:
                normalized.append(item[:max_chars])
    return normalized, secret_found


def redacted_source_summary(sanitized: SanitizedAIRequest) -> str:
    if sanitized.contains_secret_like_text:
        return "[REDACTED_SECRET_LIKE_INPUT]"
    return sanitized.source_text[:240]
