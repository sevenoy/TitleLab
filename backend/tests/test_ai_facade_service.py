from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.core import AiGenerationRecord, User, Workspace, WorkspaceMember
from app.schemas import AITitleSuggestionRequest, ErrorCode
from app.services.ai_facade_service import AIFacadeConfig, AIFacadeError, generate_title_suggestions


def seed_service_data(session: Session) -> None:
    session.add_all(
        [
            User(id="user-service-ai", username="service-ai", display_name="Service AI", status="active"),
            Workspace(id="workspace-service-ai", name="Workspace Service AI", slug="workspace-service-ai"),
            WorkspaceMember(
                id="member-service-ai",
                workspace_id="workspace-service-ai",
                user_id="user-service-ai",
                role="editor",
            ),
        ]
    )
    session.commit()


def request_payload(**overrides: object) -> AITitleSuggestionRequest:
    payload: dict[str, object] = {
        "sourceText": "为新品发布准备一组稳定、可测试的标题建议",
        "contentType": "title",
        "tone": "clear",
        "platform": "wechat",
        "count": 2,
        "constraints": ["不使用夸张承诺"],
        "referenceTitles": ["新品发布标题参考"],
        "locale": "zh-CN",
    }
    payload.update(overrides)
    return AITitleSuggestionRequest(**payload)


def test_mock_facade_returns_structured_suggestions_and_audit_record(db_session: Session) -> None:
    seed_service_data(db_session)

    data = generate_title_suggestions(
        db=db_session,
        workspace_id="workspace-service-ai",
        user_id="user-service-ai",
        request_payload=request_payload(),
        config=AIFacadeConfig(provider="mock", real_provider_enabled=False),
    )

    assert data.provider == "mock"
    assert data.model == "titlelab-mock-title-v1"
    assert data.mock is True
    assert len(data.suggestions) == 2
    assert data.usageEstimate.returnedCount == 2
    assert all(suggestion.title for suggestion in data.suggestions)

    record = db_session.scalar(select(AiGenerationRecord))
    assert record is not None
    assert record.workspace_id == "workspace-service-ai"
    assert record.user_id == "user-service-ai"
    assert record.input_payload["schemaVersion"] == "phase5a-title-suggestions-v1"
    assert record.cost_amount == 0


def test_real_provider_stays_disabled_and_does_not_read_openai_key(db_session: Session, monkeypatch) -> None:
    seed_service_data(db_session)
    key_name = "OPENAI" + "_API_KEY"

    def fail_if_env_key_is_read(key: str) -> str:
        if key == key_name:
            raise AssertionError("real provider key must not be read in Phase 5A")
        return ""

    monkeypatch.setattr("os.environ.__getitem__", fail_if_env_key_is_read)

    try:
        generate_title_suggestions(
            db=db_session,
            workspace_id="workspace-service-ai",
            user_id="user-service-ai",
            request_payload=request_payload(),
            config=AIFacadeConfig(provider="openai", real_provider_enabled=False),
        )
    except AIFacadeError as exc:
        assert exc.code == ErrorCode.AI_PROVIDER_DISABLED
    else:
        raise AssertionError("real provider should stay disabled")

    assert db_session.scalar(select(AiGenerationRecord)) is None


def test_unsupported_locale_returns_warning_and_mock_fallback(db_session: Session) -> None:
    seed_service_data(db_session)

    data = generate_title_suggestions(
        db=db_session,
        workspace_id="workspace-service-ai",
        user_id="user-service-ai",
        request_payload=request_payload(locale="fr-FR"),
    )

    assert len(data.suggestions) == 2
    assert [warning.code for warning in data.warnings] == ["UNSUPPORTED_LOCALE_FALLBACK"]
