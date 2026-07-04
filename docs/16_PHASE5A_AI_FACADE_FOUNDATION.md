# TitleLab Phase 5A AI Facade Foundation

当前阶段：TITLELAB-MAXPLAN-PHASE5A-AI-FACADE-FOUNDATION

本文记录 Phase 5A 后端 AI Facade 基础。Phase 5A 只建立受控后端入口、结构化 schema、mock provider、安全/成本门禁和最小审计记录，不接真实 OpenAI，不读取真实 API key，不接小程序 AI UI，不部署，不连接真实数据库，不新增 migration。

## 1. Scope

Phase 5A 新增一个后端 AI 入口：

```text
POST /api/v1/workspaces/{workspace_id}/ai/title-suggestions
```

该接口必须：

- 要求 `Authorization: Bearer <session>`，或仅限 local/dev/test 的 `X-TitleLab-User-Id` fallback。
- 校验 `workspace_members`，保证对象级 workspace 鉴权。
- 返回 Phase 2C envelope：`code`、`message`、`data`、`requestId`、`serverTime`、`version`。
- 只生成结构化标题建议，不写入 `content_items`，不新增业务 CRUD。

## 2. Request Schema

`AITitleSuggestionRequest` 包含：

- `sourceText`
- `contentType`
- `tone`
- `platform`
- `count`
- `constraints`
- `referenceTitles`
- `locale`

## 3. Response Schema

`AITitleSuggestionsData` 包含：

- `suggestions[]`
- `provider`
- `model`
- `mock`
- `usageEstimate`
- `warnings`

每条 suggestion 包含：

- `title`
- `rationale`
- `tags`
- `riskLevel`
- `score`

## 4. Mock Provider

Phase 5A 默认 provider 是 `mock`，模型名是 `titlelab-mock-title-v1`。

Mock provider 保证：

- 不触网。
- 不调用 OpenAI 线上 API 域名。
- 不读取真实 `OPENAI_API_KEY`。
- 输出稳定、可测试的结构化结果。
- `count` 受安全上限控制。

## 5. Safety And Cost Gate

Phase 5A 的安全/成本门禁包括：

- 拒绝空输入：`AI_EMPTY_INPUT`。
- 限制 `sourceText` 最大长度：`AI_INPUT_TOO_LONG`。
- `count` 超过安全上限时裁剪并返回 warning。
- 不支持 locale 时 fallback 到 `zh-CN` 并返回 warning。
- secret-looking 输入不原样回显，返回 warning。
- 非 mock provider 在 real provider gate 关闭时 fail-fast：`AI_PROVIDER_DISABLED`。

## 6. Audit Foundation

Phase 5A 复用既有 `ai_generation_records` 表，不新增 migration。

最小记录字段：

- `workspace_id`
- `user_id`
- `prompt`
- `provider`
- `model`
- `input_payload`
- `output_text`
- `status`
- `latency_ms`
- `cost_amount`

`input_payload` 只保存裁剪后的 source preview 或 secret-like redaction，不保存真实 secret。

## 7. Configuration

占位配置：

```text
TITLELAB_AI_PROVIDER=mock
TITLELAB_AI_REAL_PROVIDER_ENABLED=false
OPENAI_API_KEY=
```

`OPENAI_API_KEY` 只能为空或由后续受管 secret 注入；Phase 5A 不读取真实值。

## 8. Explicit Non-Goals

Phase 5A 不做：

- 真实 OpenAI 调用。
- 小程序 AI UI。
- 小程序直连 OpenAI。
- 内容创建、编辑、删除或导入。
- migration。
- 真实数据库连接或生产 migration。
- 部署、上传体验版、提交审核。

## 9. Future Phase 5B Gate

如后续需要真实 provider，必须另起 gate，至少确认：

- 非生产环境与回滚方式。
- 受管 secret 注入，不在仓库保存真实 key。
- 请求超时、重试、限流、成本预算和日志脱敏。
- 真实 provider 测试不得打印 token、cookie、password、AppSecret、API key 或 DB 密码。
