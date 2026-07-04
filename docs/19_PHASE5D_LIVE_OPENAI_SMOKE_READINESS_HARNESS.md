# TitleLab Phase 5D Live OpenAI Smoke Readiness Harness

当前阶段：TITLELAB-MAXPLAN-PHASE5D-LIVE-OPENAI-SMOKE-READINESS-HARNESS

Phase 5D 只新增未来极小额度 live smoke 前的 readiness harness。本阶段不执行真实 OpenAI 调用，不读取真实 API key，不触网，不新增 SDK 依赖，不修改小程序，不新增 migration，不连接真实数据库，不部署、不上传体验版、不提交审核。

## 1. Scope

Phase 5D 覆盖：

- live smoke manual authorization gate。
- kill switch。
- 最大请求数 gate。
- 极小预算上限 gate。
- expected model gate。
- managed secret presence 只读布尔输入。
- runner 默认拒绝真实执行。
- Phase 5D preflight。
- Phase 5E 执行前 checklist。

默认运行路径仍保持安全：

```text
TITLELAB_AI_PROVIDER=mock
TITLELAB_AI_REAL_PROVIDER_ENABLED=false
TITLELAB_AI_OPENAI_DRYRUN_ENABLED=false
TITLELAB_AI_LIVE_SMOKE_ENABLED=false
TITLELAB_AI_LIVE_SMOKE_MAX_REQUESTS=1
TITLELAB_AI_LIVE_SMOKE_MAX_BUDGET_CENTS=
TITLELAB_AI_LIVE_SMOKE_REQUIRE_MANUAL_APPROVAL=true
TITLELAB_AI_LIVE_SMOKE_EXPECTED_MODEL=
TITLELAB_AI_LIVE_SMOKE_KILL_SWITCH=true
OPENAI_API_KEY=
```

## 2. Why No Real OpenAI Call In Phase 5D

Phase 5D 的目标是把真实 smoke 前的启动门禁做实，而不是消费外部服务。真实调用会带来费用、日志、secret、网络、上游错误和回滚责任，必须放到后续 Phase 5E 单独授权。

本阶段所有检查只验证本地 readiness：

- 不读取真实 key value。
- 不调用外部 endpoint。
- 不写数据库。
- 不改变 provider 默认值。
- 不把真实执行能力放进 runner 默认路径。

## 3. Manual Authorization Conditions For Phase 5E

后续 Phase 5E 如要执行 controlled live smoke，必须同时满足：

- 用户在当轮命令中明确授权真实外部调用。
- 使用非生产后端测试环境。
- server-side managed secret 已由安全渠道注入。
- 本轮只传入 key present 布尔事实，不打印 key value。
- `TITLELAB_AI_PROVIDER=openai`。
- `TITLELAB_AI_REAL_PROVIDER_ENABLED=true`。
- `TITLELAB_AI_LIVE_SMOKE_ENABLED=true`。
- `TITLELAB_AI_LIVE_SMOKE_KILL_SWITCH=false`。
- `TITLELAB_AI_LIVE_SMOKE_MAX_REQUESTS=1`。
- `TITLELAB_AI_LIVE_SMOKE_MAX_BUDGET_CENTS` 明确且不超过极小上限。
- `TITLELAB_AI_LIVE_SMOKE_EXPECTED_MODEL` 与实际模型一致。
- timeout、retry、rate limit 和 rollback 均已复核。

## 4. Managed Secret Injection

真实 API key 只能存在于服务端受管 secret 中。禁止：

- 写入仓库、docs、README、测试、截图或日志。
- 从小程序、客户端、请求 body 或 query 参数传入。
- 在 runner、preflight、错误信息或 audit payload 中打印。

Phase 5D guard 只接受 `api_key_present=True/False` 这类布尔事实，不读取 secret value。

## 5. Budget, Request Count, Timeout, Retry, Rate Limit

Phase 5D readiness 规则：

- 最大请求数必须为 1。
- smoke 预算必须明确，且不超过 5 cents。
- expected model 必须明确。
- timeout 和 retry 继续复用 Phase 5B provider gate。
- 任何预算缺失、预算过高、请求数超过 1、model 不匹配都必须 fail-fast。

## 6. Kill Switch

`TITLELAB_AI_LIVE_SMOKE_KILL_SWITCH=true` 是默认值。只要 kill switch 开启，live smoke readiness 必须拒绝。

最小回滚配置：

```text
TITLELAB_AI_PROVIDER=mock
TITLELAB_AI_REAL_PROVIDER_ENABLED=false
TITLELAB_AI_OPENAI_DRYRUN_ENABLED=false
TITLELAB_AI_LIVE_SMOKE_ENABLED=false
TITLELAB_AI_LIVE_SMOKE_KILL_SWITCH=true
OPENAI_API_KEY=
```

## 7. Logging, Redaction, requestId, Audit

后续真实 smoke 只允许记录：

- requestId。
- provider request id 摘要。
- model。
- prompt version。
- schema version。
- latency。
- usage estimate。
- cost estimate。
- error code。

禁止记录完整 token、cookie、password、AppSecret、DB password、API key、原始敏感输入或完整上游响应。

## 8. Runner Behavior

本阶段 runner：

```bash
python3 scripts/titlelab_phase5d_live_openai_smoke_runner.py
```

默认只输出 safe refusal plan，并返回非零退出码。即使传入 `--manual-approval` 或 `--api-key-present`，Phase 5D runner 也只表达 readiness 结果，不执行真实请求；真实执行留给 Phase 5E。

## 9. Preflight

从仓库根目录运行：

```bash
python3 scripts/titlelab_phase5d_live_openai_smoke_readiness_check.py
```

preflight 检查：

- Phase 5B preflight 仍通过。
- Phase 5C preflight 仍通过。
- mock provider 仍默认启用。
- real provider gate 默认关闭。
- live smoke enabled 默认关闭。
- kill switch 默认开启。
- `.env.example` 只有安全占位。
- runner 默认拒绝真实执行。
- 不新增 OpenAI SDK 依赖。
- 不出现真实 OpenAI endpoint 运行时代码直连。
- 小程序没有 OpenAI marker 或 key name。
- 只允许 auth POST 和 AI title-suggestions POST。
- 未修改 miniprogram、migration、DB 层或依赖文件。

## 10. Explicit Non-Goals

Phase 5D 不做：

- 真实 OpenAI 调用。
- 读取真实 API key。
- 小程序 AI UI。
- 小程序直连 OpenAI。
- 内容创建、编辑、删除或导入。
- migration。
- 真实数据库连接或真实数据库 migration。
- 部署、上传体验版、提交审核。

## 11. Phase 5E Checklist

进入 Phase 5E 前必须确认：

- 用户明确授权真实 live smoke。
- 非生产环境已确认。
- managed secret 已注入，但不会被打印。
- 请求数为 1。
- 预算上限明确且极小。
- expected model 明确。
- kill switch 可立即恢复为 true。
- rollback 已确认回到 mock provider。
- 日志脱敏已确认。
- requestId / audit 路径可追踪。
- miniprogram 仍不直连 OpenAI。
