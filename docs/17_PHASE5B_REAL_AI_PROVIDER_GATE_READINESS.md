# TitleLab Phase 5B Real AI Provider Gate Readiness

当前阶段：TITLELAB-MAXPLAN-PHASE5B-REAL-AI-PROVIDER-GATE-READINESS

Phase 5B 只把真实 AI provider 开启前必须具备的后端 gate 固化下来。默认仍使用 mock provider，real provider gate 关闭。本阶段不真实调用 OpenAI，不读取真实 API key，不连接真实数据库，不新增 migration，不修改小程序，不部署、不上传体验版、不提交审核。

## 1. Scope

Phase 5B 覆盖：

- real provider gate readiness。
- OpenAI provider disabled placeholder。
- structured output contract。
- timeout / retry / rate limit / budget gate。
- redaction / safe logging / audit boundary。
- local static AI preflight。
- README、handoff 和 Phase 文档。

## 2. Real Provider Gate

后端通过 `validate_ai_provider_readiness(settings)` 和 `assert_ai_provider_readiness(settings)` 统一判断 provider readiness。

默认配置必须保持：

```text
TITLELAB_AI_PROVIDER=mock
TITLELAB_AI_REAL_PROVIDER_ENABLED=false
```

规则：

- real provider disabled + provider mock：PASS。
- real provider disabled + provider openai：`AI_PROVIDER_DISABLED`。
- real provider enabled + provider mock：`AI_CONFIG_ERROR`。
- real provider enabled + missing model：`AI_CONFIG_ERROR`。
- real provider enabled + missing managed key：`AI_PROVIDER_DISABLED`。
- provider 不支持：`AI_CONFIG_ERROR`。

Phase 5B 不读取真实 key；测试和 preflight 只传入布尔状态 `api_key_present`。

## 3. Secret Injection Boundary

真实 API key 只能由后续受管 server-side secret 注入。客户端、小程序、docs、README、测试和 git 历史不得保存真实值。

`.env.example` 只允许空占位：

```text
OPENAI_API_KEY=
```

接口响应、warnings、audit record 和日志摘要不得返回 API key、token、cookie、password、AppSecret 或 DB password。

## 4. Structured Output Contract

真实 provider 将来必须先产出结构化 JSON，再 normalize 为 Phase 5A response schema：

- `suggestions[]`
- `title`
- `rationale`
- `tags`
- `riskLevel`
- `score`

模型自由格式文本不得直接透传给客户端。`ai_openai_provider.py` 只保留 placeholder 和 structured output schema，不执行真实调用。

## 5. Prompt Caching And Stable Prefix

后续 Phase 5C 若启用真实 provider，应保持稳定 prompt prefix：

- `promptVersion`
- `locale`
- `contentType`
- `tone`
- `platform`
- `constraints`
- `referenceTitles`

高频请求应优先复用固定前缀和上下文裁剪，避免把完整历史或敏感输入塞进在线请求。

## 6. Timeout / Retry / Rate Limit / Budget

Phase 5B 新增配置 gate：

```text
TITLELAB_AI_TIMEOUT_SECONDS=15
TITLELAB_AI_MAX_RETRIES=1
TITLELAB_AI_DAILY_BUDGET_CENTS=0
TITLELAB_AI_MAX_INPUT_CHARS=2000
TITLELAB_AI_MAX_OUTPUT_ITEMS=5
```

规则：

- timeout 必须在安全范围内。
- retry 不得超过上限。
- input chars 和 output items 必须有上限。
- daily budget 为 `0` 表示 Phase 5B 不启用真实消费预算，只保留 gate。
- 超过输出项上限返回 `AI_RATE_LIMITED` 或被安全裁剪。

## 7. Redaction / Logging / Audit

Phase 5B 加强 redaction boundary：

- secret-like input 不原样进入 prompt、response title、audit preview 或日志摘要。
- audit record 保存 `sourceTextPreview` 和 `sourceTextHash`，不保存完整 secret-like source。
- provider gate 摘要只记录 `apiKeySource=managed_server_secret`，不记录 key value。
- warnings 使用 `SECRET_LIKE_INPUT_REDACTED` 提醒客户端输入已脱敏。

## 8. AI Preflight

本地静态检查命令：

```bash
python3 scripts/titlelab_phase5b_ai_provider_gate_check.py
```

preflight 检查：

- provider 默认 mock。
- real provider gate 默认 false。
- `.env.example` 只有安全占位。
- backend runtime 不出现 OpenAI 线上 endpoint marker。
- miniprogram 不出现 OpenAI endpoint marker 或 key 名。
- AI endpoint 保持 auth、workspace membership 和 provider readiness gate。
- 仅允许 auth POST + AI title-suggestions POST。
- 未修改 miniprogram。
- 未修改 migration 或 db 层。
- real enabled + missing managed key 必须 FAIL。
- mock disabled-real gate 必须 PASS。

## 9. No Client-Side OpenAI

小程序不得直连 OpenAI，不得传入 API key，不得新增 AI UI。本阶段不修改 `miniprogram/**`。

## 10. Rollback

最小 rollback：

```text
TITLELAB_AI_PROVIDER=mock
TITLELAB_AI_REAL_PROVIDER_ENABLED=false
OPENAI_API_KEY=
```

在任何真实 provider 异常或预算风险出现时，先切回 mock provider，再通过 requestId 和 audit record 做只读分析。

## 11. Future Phase 5C Gate

Phase 5C 若要 controlled real provider enable，必须另起 RELEASE_GATE，并至少确认：

- 非生产环境。
- 受管 secret 注入。
- 外部 API 超时、重试、限流和预算。
- 完整脱敏日志。
- requestId 追踪。
- 回滚策略。
- 用户明确授权真实调用。
