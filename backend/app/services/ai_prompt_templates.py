from __future__ import annotations

from app.services.ai_safety import SanitizedAIRequest, redacted_source_summary

TITLE_SUGGESTION_PROMPT_VERSION = "title-suggestions-v1"


def build_title_suggestion_prompt(payload: SanitizedAIRequest) -> str:
    reference_block = "; ".join(payload.reference_titles) if payload.reference_titles else "none"
    constraints_block = "; ".join(payload.constraints) if payload.constraints else "none"
    return "\n".join(
        [
            f"promptVersion={TITLE_SUGGESTION_PROMPT_VERSION}",
            f"locale={payload.locale}",
            f"contentType={payload.content_type}",
            f"tone={payload.tone}",
            f"platform={payload.platform}",
            f"count={payload.count}",
            f"constraints={constraints_block}",
            f"referenceTitles={reference_block}",
            f"sourceText={redacted_source_summary(payload)}",
            "Return structured title suggestions only.",
        ]
    )
