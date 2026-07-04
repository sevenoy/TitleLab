# TitleLab Phase 5C OpenAI Provider Dry-run Contract

当前阶段：TITLELAB-MAXPLAN-PHASE5C-OPENAI-PROVIDER-DRYRUN-CONTRACT

Phase 5C 只固化 OpenAI provider dry-run contract。本阶段不启用真实 provider，不读取真实 API key，不触网，不新增 SDK 依赖，不修改小程序，不新增 migration，不连接真实数据库，不部署、不上传体验版、不提交审核。

## 1. Scope

Phase 5C 覆盖：

- OpenAI title suggestion request builder。
- Structured Outputs JSON schema contract。
- prompt caching-friendly message builder。
- fake transport protocol。
- structured response parser and normalizer。
- usage / cost estimate placeholder。
- provider error mapping。
- requestId / provider request id tracing。
- redacted audit payload。
- local static preflight gate。

默认运行路径仍是 Phase 5A/5B 的 `mock` provider：

```text
TITLELAB_AI_PROVIDER=mock
TITLELAB_AI_REAL_PROVIDER_ENABLED=false
TITLELAB_AI_OPENAI_DRYRUN_ENABLED=false
OPENAI_API_KEY=
```

## 2. Why No Real OpenAI Call Yet

Phase 5C 的目标是把可测试 contract 做实，而不是消费真实外部服务。真实调用至少还需要后续 Phase 5D 单独 gate：

- 非生产环境。
- 受管 server-side secret。
- 明确预算和回滚。
- 脱敏日志确认。
- 用户明确授权真实 smoke。

因此本阶段的所有 OpenAI contract 测试都使用 `FakeOpenAITransport`。

## 3. Structured Outputs

结构化输出 schema 固定为 `titlelab_title_suggestions_v1`。响应根对象只允许：

```text
suggestions[]
```

每条 suggestion 必须且只能包含：

```text
title
rationale
tags
riskLevel
score
```

规则：

- `additionalProperties=false`。
- `riskLevel` 仅允许 `low`、`medium`、`high`。
- `score` 必须在 0 到 1。
- schema mismatch 映射为 `AI_PROVIDER_SCHEMA_MISMATCH`。
- malformed JSON 映射为 `AI_PROVIDER_BAD_RESPONSE`。
- 自由文本不会直接透传给客户端。

## 4. Fake Transport

`FakeOpenAITransport` 是 Phase 5C 唯一测试 transport。它支持：

- success structured response。
- malformed JSON。
- schema mismatch。
- rate limit。
- timeout。
- generic provider error。
- fake usage tokens。

它不读取环境变量，不访问网络，不包含真实 OpenAI endpoint，不依赖 SDK。

## 5. Prompt Caching

prompt builder 将内容拆成两段 message：

- `system`：稳定前缀，包含固定规则、输出格式、安全规则、prompt version 和 schema name。
- `user`：动态 payload，包含 locale、content type、tone、platform、count、constraints、reference titles 和 redacted source text。

稳定前缀不包含用户输入或 secret-like 内容。builder 输出：

- `promptCacheKey`
- `stablePrefixHash`
- `dynamicPayloadHash`

`TITLELAB_AI_PROMPT_CACHE_KEY_PREFIX=` 只作为安全占位，默认空值时使用内部本地前缀。

## 6. Usage / Cost Estimate

Phase 5C 只做本地估算和上游 fake usage 归一：

- input tokens。
- output tokens。
- total tokens。
- prompt cached tokens。
- estimated cost cents 固定为 0。

本阶段不联网获取价格，不记录真实账单，不做真实消费预算扣减。

## 7. Error Mapping

Phase 5C 新增 provider 级错误码：

- `AI_PROVIDER_RATE_LIMITED`
- `AI_PROVIDER_TIMEOUT`
- `AI_PROVIDER_SCHEMA_MISMATCH`
- `AI_PROVIDER_BAD_RESPONSE`

其他未分类 provider 错误仍归一为 `AI_PROVIDER_ERROR`。

## 8. Redaction / Audit / requestId

redacted audit payload 包含：

- internal requestId。
- provider request id。
- model。
- prompt cache key。
- stable/dynamic hash。
- request hash。
- response hash。
- prompt preview。
- usage estimate。
- error code。

audit preview 使用 secret-like redaction，不记录完整 API key、token、cookie、password、AppSecret、DB password，也不记录完整 secret-like source text。

## 9. No Client-side OpenAI

小程序仍不得直连 OpenAI，不得保存或传入 API key，不得新增 AI UI。本阶段未修改 `miniprogram/**`。

## 10. Preflight

从仓库根目录运行：

```bash
python3 scripts/titlelab_phase5c_openai_dryrun_contract_check.py
```

preflight 检查：

- Phase 5B preflight 仍通过。
- mock provider 仍默认启用。
- real provider gate 默认关闭。
- OpenAI dry-run gate 默认关闭。
- `.env.example` 只有安全占位。
- 不新增 OpenAI SDK 依赖。
- 不出现真实 OpenAI endpoint 运行时代码直连。
- 小程序没有 OpenAI marker 或 key name。
- AI endpoint 仍保留 auth、workspace membership 和 provider readiness gate。
- 只允许 auth POST 和 AI title-suggestions POST。
- 未修改 miniprogram、migration、DB 层或依赖文件。
- fake transport、schema mismatch、rate limit、timeout、prompt cache 和 redacted audit 测试存在。

## 11. Future Phase 5D

Phase 5D 如要做 controlled live OpenAI smoke，必须另起 RELEASE_GATE，并至少确认：

- 用户明确授权真实外部调用。
- 非生产后端环境。
- server-side managed secret 注入。
- 不打印 secret、token、cookie、password、AppSecret、DB password。
- 明确预算、timeout、retry、限流和回滚。
- production / release / deploy 仍需单独授权。
