# TitleLab Phase 6 Mini Program AI Title Mock-only

当前阶段：TITLELAB-MAXPLAN-PHASE6-MINIPROGRAM-AI-TITLE-MOCK-ONLY-FULL

Phase 6 只在小程序侧新增 AI 标题生成 mock-only 使用闭环。本阶段不进入 Phase 5E，不执行真实 OpenAI 调用，不读取真实 API key，不请求真实后端 AI，不连接真实数据库，不新增 migration，不部署、不上传体验版、不提交审核。

## 1. Scope

Phase 6 覆盖：

- 小程序 AI 标题生成入口。
- `services/aiMock.js` 本地 mock 结构化标题建议。
- `services/aiApi.js` 后端 AI endpoint 映射占位。
- `services/aiRepository.js` mock-first repository 和真实 gate fail-fast。
- `services/aiResultNormalizer.js` 结果归一。
- `pages/ai/index` 输入、选项、生成、loading、错误态、空态、结果展示和复制标题。
- Phase 6 本地静态 preflight。

## 2. Mock-only UI

AI 页面默认使用本地 mock：

- 不强制登录。
- 不调用 `wx.login`。
- 不调用后端 AI。
- 不上传 sourceText。
- 不直连 OpenAI。
- 支持 sourceText、contentType、tone、platform、count。
- 输出 `title`、`rationale`、`tags`、`riskLevel`、`score`。

复制标题继续走 `adapters/wechat.js` 的 `setClipboardData` 封装。

## 3. Service / Repository Boundary

小程序分层：

- `aiMock.js`：生成稳定 mock suggestions，不触网。
- `aiResultNormalizer.js`：将 mock 或后端 envelope data 归一成页面结构。
- `aiApi.js`：只封装 `/api/v1/workspaces/{workspace_id}/ai/title-suggestions`。
- `aiRepository.js`：默认 mock；只有 real gate、AI real gate、workspaceId、session readiness 全部满足时才允许走 `aiApi`。

本轮默认：

```text
apiMode=mock
realApiGateEnabled=false
authRealApiGateEnabled=false
aiRealApiGateEnabled=false
```

## 4. Backend AI Facade Contract Mapping

后端 Phase 5A AI Facade endpoint：

```text
POST /api/v1/workspaces/{workspace_id}/ai/title-suggestions
```

请求字段：

```text
sourceText
contentType
tone
platform
count
constraints
referenceTitles
locale
```

响应字段：

```text
suggestions[]
provider
model
mock
usageEstimate
warnings
```

每条 suggestion：

```text
title
rationale
tags
riskLevel
score
```

Phase 6 仅做小程序 mock 契约对齐，不真实请求后端。

## 5. Forbidden In Phase 6

禁止：

- 进入 Phase 5E。
- 真实 OpenAI 调用。
- 小程序直连 OpenAI。
- 读取、打印或写入真实 OpenAI key。
- 从客户端传入 API key。
- 打开 `realApiGateEnabled`、`authRealApiGateEnabled` 或 `aiRealApiGateEnabled` 默认值。
- 连接真实数据库或执行真实 migration。
- 新增 backend migration、models 或 db 层改动。
- 新增内容 CRUD 写接口。
- 部署、上传体验版、提交审核。

## 6. Preflight

从仓库根目录运行：

```bash
python3 scripts/titlelab_phase6_miniprogram_ai_mock_check.py
```

preflight 检查：

- Phase 4D / 4E / 5B / 5C / 5D preflight 仍通过。
- 小程序 JSON 可解析。
- `pages/ai/index` 已注册。
- AI service/repository/mock/normalizer 文件存在。
- 默认 mock，真实 gate 默认关闭。
- 页面不直接调用 `wx.request` 或 `wx.login`。
- `wx.request` 仍只在 `services/request.js`。
- `wx.login` 仍只在 `adapters/wechat.js`。
- 小程序无 OpenAI endpoint、API key、AppSecret、DB password。
- 未修改 backend migration/db/models。
- 未新增依赖。
- `project.private.config.json` 未被跟踪。

## 7. Risks And Next Phase

风险：

- 当前 AI 结果是本地 mock，不代表真实模型质量。
- 后端真实 AI 仍受 Phase 5B/5C/5D gate 保护。
- 小程序真实 AI 请求需要后续单独 gate，且必须确认 workspaceId、session、非生产环境、预算和回滚。

下一步最小建议：

如要真实 AI smoke，另起 Phase 5E RELEASE_GATE；如要小程序接后端 AI mock/test API，另起 Phase 6B/6C，并继续保持小程序不直连 OpenAI。
