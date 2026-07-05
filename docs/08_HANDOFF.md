# TitleLab Phase 0 Handoff

当前阶段：TITLELAB-MINIPROGRAM-PHASE-0-PRD-AND-DATABASE-DESIGN

## 1. 本轮完成内容

本轮为 TitleLab 小程序化重建建立 Phase 0 前期需求和技术规划文档。只做文档，不做业务代码。

新增文档：

- `docs/00_PROJECT_BRIEF.md`
- `docs/01_PRD_V0_2.md`
- `docs/02_DATABASE_DESIGN_V0_2.md`
- `docs/03_MINIPROGRAM_ARCHITECTURE.md`
- `docs/04_BACKEND_ARCHITECTURE.md`
- `docs/05_DEPLOYMENT_PLAN_TENCENT_LIGHTHOUSE.md`
- `docs/06_PHASE_ROADMAP.md`
- `docs/07_ACCEPTANCE_CHECKLIST.md`
- `docs/08_HANDOFF.md`

## 2. 已读上下文

- `README.md`
- `CHANGELOG.md`
- `USER_ISOLATION_CHECK.md`
- `index.html`
- `login.html`
- `title.html`
- `content.html`
- `admin-center.html`
- `settings.html`
- `manifest.webmanifest`
- `sw.js`

未读取 `assets` 文件内容，因为根目录页面和现有 Markdown 已足够判断本轮需求规划。

## 3. 当前功能理解

现有 Web 版包含：

- 登录页。
- 标题管理页。
- 文案管理页。
- 分类、账号分类、场景标签。
- 搜索、批量导入、新增、编辑、删除、清空。
- 星标/收藏式高亮排序。
- 云端同步和快照。
- 管理中心：账号管理、导出、去重、归一化、分类复制、危险操作。
- 主题设置：主题、颜色、标题显示、设置导入导出。
- PWA 缓存与更新。
- AI 标题扩写弹窗。

## 4. 关键规划结论

- 小程序端先做只读 MVP，不急着做完整编辑和管理能力。
- 后端必须替代前端硬编码登录、localStorage key 隔离和快照式主数据。
- 数据库核心应围绕 `users`、`workspaces`、`workspace_members`、`content_items`、`categories`、`account_categories`、`tags`、`favorites`、`usage_events`、`ai_generation_records`、`snapshots`、`audit_logs`。
- AI Key、微信 AppSecret、数据库连接串、腾讯云密钥不得进入小程序或前端代码。
- 腾讯轻量服务器部署留到后续 Phase；本轮只记录规划。

## 5. 下一步最小建议

必须先完成 Phase 0.6：Domain & Compliance Lock。

Phase 0.6 只允许纳入 NumHub 经验基线、锁定 TitleLab 域名与合规门禁、补充 Branch & Worktree Strategy，不得进入代码开发。

Phase 0.6 完成并经用户审核后，下一步才允许进入 Phase 1：

后端骨架 + 数据库基础 migration + `/healthz` + `/api/meta`。

Phase 1 不应实现完整业务 CRUD，不应创建小程序页面，不应部署生产。

## 7. Phase 1 当前进度

Phase 1 已在独立 worktree `phase1-backend-foundation` 中开始，范围限定为后端骨架、基础 schema migration、`GET /healthz`、`GET /api/meta` 和最小测试。

本阶段仍禁止连接任何数据库、执行 `alembic upgrade`、部署、push、merge、上传体验版或进入 Phase 2/3 功能开发。

## 8. Phase 1B 本地 migration dry-run 验证

Phase 1B 已使用本机临时 SQLite 空库 `titlelab_phase1b_migration_test.db` 完成 Alembic `upgrade head -> downgrade base -> upgrade head` 验证。验证后已删除临时数据库文件，未连接生产、远程或测试共享数据库。

已确认 Phase 1 核心表可创建，`workspace_members`、`content_items`、`categories`、`account_categories`、`tags`、`content_tags`、`favorites`、`usage_events`、`ai_generation_records`、`snapshots`、`audit_logs` 均包含 `workspace_id` 边界字段。

## 9. Phase 2A 只读 API 最小闭环

Phase 2A 在独立 worktree `phase2-readonly-api` 中完成最小只读 API：`GET /api/v1/workspaces/{workspace_id}/contents`、`GET /api/v1/workspaces/{workspace_id}/contents/{content_id}`、`GET /api/v1/workspaces/{workspace_id}/categories`、`GET /api/v1/workspaces/{workspace_id}/tags`。

本阶段测试使用本地内存 SQLite 和 FastAPI dependency override 构造测试数据，未连接生产、远程或共享测试数据库。已覆盖列表读取、详情读取、workspace 隔离、`content_type` 过滤、分类/标签读取、不存在资源 404，并确认未新增 `POST`、`PUT`、`PATCH`、`DELETE` 写接口。

## 10. Phase 2B 契约验证与本地空库 smoke

Phase 2B 在独立 worktree `phase2-readonly-api` 中补齐只读 API 契约测试和本地临时 SQLite 空库 migration smoke。OpenAPI 契约验证确认只暴露 Phase 2A 已允许的四个 workspace `GET` 路由，不包含 `POST`、`PUT`、`PATCH`、`DELETE`，并锁定 `ContentItemOut`、`CategoryOut`、`TagOut` 的核心响应字段。

本轮仅使用本机临时库 `backend/titlelab_phase2b_smoke_test.db` 执行 Alembic `upgrade head -> downgrade base`，验证后已删除临时库文件。未连接生产、远程、腾讯云、Supabase 或任何真实业务数据库；未部署、未 push、未进入 Phase 3。

## 11. Phase 3A 小程序只读 MVP 最小骨架

Phase 3A 在独立 worktree `phase3-miniprogram-readonly-mvp` 中新增 `miniprogram/` 小程序骨架。当前实现只使用本地 mock 只读数据，不连接真实后端 API，不连接数据库，不部署，不上传体验版。

新增文件：

- `miniprogram/app.json`
- `miniprogram/app.js`
- `miniprogram/app.wxss`
- `miniprogram/project.config.json`
- `miniprogram/sitemap.json`
- `miniprogram/pages/index/index.json`
- `miniprogram/pages/index/index.wxml`
- `miniprogram/pages/index/index.wxss`
- `miniprogram/pages/index/index.js`
- `miniprogram/pages/detail/detail.json`
- `miniprogram/pages/detail/detail.wxml`
- `miniprogram/pages/detail/detail.wxss`
- `miniprogram/pages/detail/detail.js`
- `miniprogram/services/contentMock.js`
- `miniprogram/README.md`

当前能力：

- 首页展示标题/文案本地样例列表。
- 首页支持关键词搜索、`content_type` 筛选、分类筛选和标签筛选。
- 详情页展示标题、正文、类型、分类、标签、使用建议和备注。
- 详情页支持复制标题或正文到剪贴板。

边界确认：

- 未调用真实后端 API。
- 未连接生产、远程、腾讯云、Supabase 或任何真实业务数据库。
- 未修改 `backend/**`。
- 未修改现有 Web/PWA HTML/CSS/JS。
- 未修改 `assets/**` 或 `icon/**`。
- 未新增登录、收藏、历史、AI、导入、快照执行、后台页面或写入能力。
- 未处理仓库顶层 `._*` AppleDouble 文件；该风险保留给后续单独授权处理。

## 12. Phase 3A 小程序 Preview QA

Phase 3A Preview QA 在独立 worktree `phase3-miniprogram-readonly-mvp` 中完成。QA 仅检查本地小程序骨架、页面结构、mock 数据、页面跳转、复制绑定和微信开发者工具打开准备；未连接真实后端 API，未连接数据库，未部署，未上传体验版。

QA 结果：

- `app.json` 页面路径与 `pages/index/index`、`pages/detail/detail` 文件结构一致。
- `project.config.json` 仍使用 `touristappid` 占位，未写入真实应用标识或密钥。
- JSON 解析检查通过。
- 小程序 JS 语法检查通过。
- WXML 标签闭合检查通过。
- 首页 mock 列表、搜索、类型筛选、分类筛选、标签筛选和空状态逻辑通过本地脚本验证。
- 详情页 `id` 查询、缺失内容 fallback、复制标题和复制正文绑定通过静态检查。
- `services/contentMock.js` 只返回本地 mock 数据，不包含真实网络请求。
- 已确认 `miniprogram/` 内没有真实网络调用入口。
- 已确认 `miniprogram/` 内没有新增写方法关键字。
- 已确认未修改 `backend/**`、现有 Web/PWA HTML/CSS/JS、`assets/**` 或 `icon/**`。

本轮最小修复：

- 将详情页按钮布局从 grid 收紧为 flex，降低微信开发者工具样式兼容风险。
- 调整 `miniprogram/README.md` 的边界说明，避免 QA 敏感词扫描误报。

## 13. Num 小程序全流程经验深度学习

本轮已读取用户提供的《num小程序从立项到上线的全流程技术文档.pdf》，并将其中对 TitleLab 后续小程序、后端、AI、多设备同步、部署、审核、域名、隐私合规和 Codex 协作有复用价值的经验沉淀为 TitleLab 专属工程文档：

- `docs/12_NUM_MINIPROGRAM_FULL_PROCESS_LESSONS_FOR_TITLELAB.md`

本轮只做知识沉淀和后续 gate 建议，没有开发功能，没有修改小程序页面业务代码，没有接入真实 API，没有连接数据库，没有部署，没有上传体验版。

本轮没有处理微信开发者工具自动文件，包括 `miniprogram/project.config.json` 的本机改动和 `miniprogram/project.private.config.json` 的未跟踪文件。后续建议先单独执行 Phase 3A DevTools config check，确认导入路径、占位 AppID、urlCheck、私有配置和忽略规则，再继续 Phase 3B 小程序 service/adapter 层。

## 14. Phase 3A DevTools Config Check

本轮快速处理微信开发者工具导入 `miniprogram/` 后产生的自动配置状态，目标是解除 Phase 3A dirty status 阻塞，不开发功能，不接真实 API，不上传体验版，不 push。

检查结论：

- `miniprogram/project.config.json` 由微信开发者工具自动修改，主要变化是 `appid` 从占位值变为非占位 AppID，并补充 DevTools setting 字段。
- `miniprogram/project.config.json` 未发现敏感字段名；JSON 解析通过。
- `miniprogram/project.config.json` 本轮按 DevTools 本地预览/导入所需配置保留。
- `miniprogram/project.private.config.json` 是微信开发者工具生成的本机私有配置；JSON 解析通过。
- `miniprogram/project.private.config.json` 未发现敏感字段名或敏感值模式。
- 已新增 `miniprogram/.gitignore`，忽略 `project.private.config.json`。
- 本轮没有 stage 或 commit `miniprogram/project.private.config.json` 内容。
- 本轮没有修改 `backend/**`、小程序页面业务代码、服务代码、真实 API、数据库或部署配置。

下一步建议：在继续 Phase 3B 前，使用当前 DevTools 配置做一次本地可视预览确认；如需替换正式 AppID、上传体验版或配置合法域名，必须另起 RELEASE_GATE。

## 15. Phase 3B 小程序 Service / Adapter 层

Phase 3B 在独立 worktree `phase3-miniprogram-readonly-mvp` 中新增小程序 service / adapter / config 分层，为后续真实只读 API 接入做准备。本轮不做 UI 改版，不新增页面，不连接真实后端 API，不连接数据库，不部署，不上传体验版。

新增文件：

- `miniprogram/config/env.js`
- `miniprogram/adapters/wechat.js`
- `miniprogram/services/request.js`
- `miniprogram/services/contentApi.js`
- `miniprogram/services/contentRepository.js`

当前分层结果：

- `config/env.js` 默认 `mock` 模式，real API gate 关闭，未配置真实 API 域名。
- `adapters/wechat.js` 封装导航、剪贴板、toast、网络状态和 storage。
- `services/request.js` 只保留只读请求边界；当前 gate 关闭，不发起真实网络访问。
- `services/contentApi.js` 预留后续只读内容 API 映射，不在当前 mock 模式调用。
- `services/contentRepository.js` 成为页面内容读取入口，当前默认委托本地 `contentMock.js`。
- 首页和详情页已从直接依赖 `contentMock.js` 改为依赖 `contentRepository.js`；详情页复制和首页跳转改为经 `adapters/wechat.js`。

边界确认：

- 未修改 `backend/**`。
- 未修改现有 Web/PWA HTML/CSS/JS、`assets/**` 或 `icon/**`。
- 未新增真实 API 域名。
- 未新增 OpenAI 直连。
- 未新增登录、收藏、历史、AI 真实调用、导入、快照执行或后台页面。
- 未提交 `miniprogram/project.private.config.json`。

## 16. Phase 3C 真实只读 API 接入计划

Phase 3C 计划轮已在独立 worktree `phase3-miniprogram-readonly-mvp` 中完成，只新增接入计划文档，不开发接入代码，不修改小程序业务代码，不修改后端，不配置真实 API 域名，不打开 real API gate，不连接后端 API，不连接数据库，不部署，不上传体验版，不 push。

新增文档：

- `docs/13_PHASE3C_READONLY_API_INTEGRATION_PLAN.md`

计划结论：

- 当前后端只读 API 仍是四个 workspace `GET` 路由：内容列表、内容详情、分类列表、标签列表。
- 当前小程序已具备 `config/env.js`、`adapters/wechat.js`、`services/request.js`、`services/contentApi.js`、`services/contentRepository.js` 分层。
- 当前后端响应是裸数组或裸对象，不是统一 `ApiResponse<T>` 包装；建议先做 Phase 2C API response contract，再做 Phase 3C 真实 API 接入。
- 真实 API 只能使用 `https://api.title.mirroroo.top` / `https://api.title.mirroroo.top/api/v1`，不得使用禁用域名。
- 页面不得直接 wx.request，真实请求必须统一走 `miniprogram/services/request.js`。
- 小程序不得直连 OpenAI，不得新增写接口，不得新增登录、收藏、历史、AI、导入、快照执行或后台页面。

下一步最小建议：

先开独立 Phase 2C 后端契约 worktree，补齐统一响应包、requestId、serverTime、错误码、分页元信息和版本字段契约；验收后再回到 Phase 3C 实现小程序真实只读 API 接入。

## 17. Phase 2C API response contract

Phase 2C 在独立 worktree `phase2c-api-response-contract` 中完成后端只读 API response contract。目标是为后续 Phase 3C 小程序真实只读 API 接入提供稳定响应包；本阶段不新增写接口、不做登录、不修改数据库模型或 migration、不连接真实数据库、不部署。Phase 2C commit `c2babc0` 已本地 fast-forward 合并到 `main`，并已 push 到 `origin/main`。

实现结果：

- `GET /api/meta` 返回统一 `ApiResponse<MetaOut>`。
- `GET /api/v1/workspaces/{workspace_id}/contents` 返回 `ApiResponse<ListPayload<ContentItemOut>>`。
- `GET /api/v1/workspaces/{workspace_id}/contents/{content_id}` 返回 `ApiResponse<ContentItemOut>`。
- `GET /api/v1/workspaces/{workspace_id}/categories` 返回 `ApiResponse<ListPayload<CategoryOut>>`。
- `GET /api/v1/workspaces/{workspace_id}/tags` 返回 `ApiResponse<ListPayload<TagOut>>`。
- 成功响应统一包含 `code`、`message`、`data`、`requestId`、`serverTime`、`version`。
- 列表响应的 `data` 统一包含 `items`、`limit`、`offset`、`hasMore`；本阶段暂不引入 `total`，避免增加额外计数查询。
- 错误响应稳定到 `NOT_FOUND`、`INVALID_PARAM`、`INTERNAL_ERROR`，并继续返回 `requestId`、`serverTime`、`version`。
- `X-Request-Id` 请求头会优先进入响应体和响应头；未提供时由服务端生成。
- `GET /healthz` 保持 raw health probe，是 Phase 2C response envelope 的唯一例外。

边界确认：

- 未新增 `POST`、`PUT`、`PATCH`、`DELETE`。
- 未修改 `backend/alembic/**`。
- 未修改 `backend/app/models/**`。
- 未修改 `backend/app/db/**`。
- 未修改 `miniprogram/**`。

## 18. Phase 5A AI Facade Foundation

Phase 5A 在独立 worktree `phase5a-ai-facade-foundation` 中新增后端 AI Facade 基础。本阶段只实现 mock-only 后端生成入口、结构化 schema、安全/成本门禁和最小审计记录，不接真实 OpenAI，不读取真实 API key，不接小程序 AI UI，不连接真实数据库，不新增 migration，不部署。

新增 endpoint：

- `POST /api/v1/workspaces/{workspace_id}/ai/title-suggestions`

实现结果：

- AI endpoint 要求 `Authorization: Bearer <session>`，并保留 Phase 4A local/dev/test `X-TitleLab-User-Id` fallback。
- AI endpoint 调用 `workspace_members` 校验，保持对象级 workspace 鉴权。
- AI endpoint 返回 Phase 2C envelope，包含 `requestId`、`serverTime` 和 `version`。
- 新增 `AITitleSuggestionRequest`、`AITitleSuggestionOut`、`AITitleSuggestionsData`、`AIUsageEstimate`、`AIWarning` schema。
- 默认 provider 为 `mock`，模型名为 `titlelab-mock-title-v1`，输出稳定、可测试的结构化标题建议。
- real provider gate 默认关闭：`TITLELAB_AI_REAL_PROVIDER_ENABLED=false`。
- 空输入返回 `AI_EMPTY_INPUT`，超长输入返回 `AI_INPUT_TOO_LONG`，非 mock provider 在 gate 关闭时返回 `AI_PROVIDER_DISABLED`。
- 复用既有 `ai_generation_records` 表保存最小审计记录；本轮未新增或修改 migration。

边界确认：

- 未修改 `miniprogram/**`。
- 未修改 `backend/alembic/**`。
- 未修改 `backend/app/db/**`。
- 未新增内容 CRUD 写接口。
- 未调用真实 OpenAI、微信或任何外部 AI API。
- 未连接真实数据库，未执行真实数据库 migration。
- 未部署，未上传体验版，未提交审核。

## 19. Phase 5B Real AI Provider Gate Readiness

Phase 5B 在独立 worktree `phase5b-real-ai-provider-gate-readiness` 中新增真实 AI provider 开启前的后端 gate readiness。本阶段不是启用真实 provider；默认仍为 mock provider，real provider gate 关闭。不真实调用 OpenAI，不读取真实 API key，不修改小程序，不新增 migration，不连接真实数据库，不部署。

实现结果：

- 新增 `backend/app/services/ai_provider_gate.py`：统一 `validate_ai_provider_readiness(settings)` / `assert_ai_provider_readiness(settings)`。
- 新增 `backend/app/services/ai_openai_provider.py`：OpenAI provider disabled placeholder 和 structured output schema boundary，不执行真实调用。
- 新增 `backend/app/services/ai_budget.py`：timeout、retry、input/output 上限和 daily budget gate。
- 新增 `backend/app/services/ai_redaction.py`：secret-like input preview/hash redaction helper。
- 更新 AI Facade service：provider readiness 先行，mock 仍默认，audit record 保存脱敏 preview、hash 和 provider gate 摘要。
- 新增 `scripts/titlelab_phase5b_ai_provider_gate_check.py`：本地静态 preflight，不联网、不读 secret、不连接数据库。
- 新增 `docs/17_PHASE5B_REAL_AI_PROVIDER_GATE_READINESS.md`。

配置边界：

- `TITLELAB_AI_PROVIDER=mock`
- `TITLELAB_AI_REAL_PROVIDER_ENABLED=false`
- `TITLELAB_AI_MODEL=`
- `TITLELAB_AI_TIMEOUT_SECONDS=15`
- `TITLELAB_AI_MAX_RETRIES=1`
- `TITLELAB_AI_DAILY_BUDGET_CENTS=0`
- `TITLELAB_AI_MAX_INPUT_CHARS=2000`
- `TITLELAB_AI_MAX_OUTPUT_ITEMS=5`
- `OPENAI_API_KEY=` 仅为空占位，不写真实值。

边界确认：

- 未修改 `miniprogram/**`。
- 未修改 `backend/alembic/**`。
- 未修改 `backend/app/db/**`。
- 未新增内容 CRUD 写接口。
- 只允许 auth login/logout POST 和 AI title-suggestions POST。
- 未调用真实 OpenAI、微信或任何外部 AI API。
- 未连接真实数据库，未执行真实数据库 migration。
- 未部署，未上传体验版，未提交审核。
- 未连接任何真实数据库。
- 未执行 Alembic migration。

下一步建议：

Phase 3C 小程序真实只读 API 接入应以本契约为准，统一从 `data.items` / `data` 读取业务数据，并保留 `requestId` 作为排障锚点。

## 18. Phase 3C 小程序真实只读 API envelope 接入

Phase 3C 在独立 worktree `phase3-miniprogram-readonly-mvp` 中吸收 Phase 2C contract，并完成小程序真实只读 API envelope 接入。默认仍为本地 mock 模式，real API gate 默认关闭；本轮没有部署、没有上传体验版、没有提审、没有连接数据库、没有执行 migration、没有接入 OpenAI。

实现结果：

- `miniprogram/config/env.js` 锁定唯一允许 API base：`https://api.title.mirroroo.top/api/v1`。
- `miniprogram/services/request.js` 只封装 `GET`，统一发送 `X-Request-Id`，校验 Phase 2C envelope，并将非 `OK` 响应归一化为页面可展示错误。
- `miniprogram/services/contentApi.js` 只映射四个 workspace 只读路由：内容列表、内容详情、分类列表、标签列表。
- `miniprogram/services/contentRepository.js` 保持默认 mock，real mode 下调用 `contentApi`，并统一返回列表 `items/limit/offset/hasMore`、详情 content object 和展示用错误对象。
- `pages/index/index.js` 和 `pages/detail/detail.js` 只做 repository 返回结构、loading 和 error 的最小适配；页面没有直接调用 `wx.request`。
- `miniprogram/README.md` 已记录 Phase 3C envelope、默认 mock、real gate 关闭、真实域名限制和 OpenAI/secret 边界。

边界确认：

- 未新增小程序页面。
- 未新增 `POST`、`PUT`、`PATCH`、`DELETE`。
- 未修改 `backend/alembic/**`、`backend/app/models/**`、`backend/app/db/**`。
- 未修改 `miniprogram/project.private.config.json`，未提交本机私有配置。
- 未修改 `assets/**`、`icon/**`、现有 Web/PWA HTML/CSS/JS。
- 未连接真实后端 API；真实请求 gate 默认关闭。
- 未连接任何数据库。
- 未部署、未上传体验版、未提交审核。

## 19. Phase 4A workspace 对象级鉴权基础

Phase 4A 在独立 worktree `phase4a-workspace-authorization-foundation` 中实现后端只读 workspace API 的对象级鉴权基础。目标是让 readonly API 不再只依赖 URL 中的 `workspace_id`，而是先通过当前用户上下文和 `workspace_members` 关系校验访问权限。

实现结果：

- 新增 `backend/app/deps/auth.py`，提供最小 `AuthContext`、`X-TitleLab-User-Id` development/test header 解析和 workspace membership 校验。
- 四个 workspace readonly `GET` API 已接入 `workspace_members.workspace_id + workspace_members.user_id` 校验。
- 未提供用户身份返回 `401` / `UNAUTHORIZED`。
- 用户不存在、被禁用或不是 workspace member 返回 `403` / `FORBIDDEN`。
- workspace member 可继续读取自己 workspace 的内容、详情、分类和标签。
- 内容不存在仍返回 `404` / `NOT_FOUND`。
- `/healthz` 保持 raw public。
- `/api/meta` 保持 envelope public，不要求用户身份。
- Phase 2C response envelope 保持 `code`、`message`、`data`、`requestId`、`serverTime`、`version`。

边界确认：

- `X-TitleLab-User-Id` 只是 Phase 4A development/test auth context，不是生产正式登录方案。
- 未做微信登录、JWT、session、refresh token、注册、密码登录或手机号登录。
- 未新增 `POST`、`PUT`、`PATCH`、`DELETE`。
- 未修改数据库 schema、migration、`backend/alembic/**`、`backend/app/models/**` 或 `backend/app/db/**`。
- 未修改 `miniprogram/**`。
- 未连接真实数据库，未执行 Alembic migration。
- 未部署、未上传体验版、未提交审核。

下一步建议：

Phase 4B 可在独立 worktree 中继续做正式微信登录 / JWT 或 server-side session 方案；如要先做小程序真机合法域名与真实 API preflight，也必须保持 real API gate 受控并单独过 RELEASE_GATE。

## 20. Phase 4B auth/session 基础

Phase 4B 在独立 worktree `phase4b-auth-session-foundation` 中实现后端正式 auth/session 基础。目标是从 Phase 4A 的 `X-TitleLab-User-Id` dev/test header 过渡到后端 server-side session；本阶段没有部署、没有上传体验版、没有提交审核、没有连接真实数据库、没有对真实数据库执行 migration、没有真实调用微信接口、没有修改小程序代码。

实现结果：

- 新增 Alembic migration `backend/alembic/versions/0002_phase4b_auth_session_foundation.py`。
- 新增 `auth_identities` 表，保存 `provider`、`provider_user_id`、可选 `provider_union_id` 与 `user_id` 的绑定，并约束 `unique(provider, provider_user_id)`。
- 新增 `user_sessions` 表，保存 `token_hash`、`auth_mode`、设备/UA 元数据、过期时间和撤销时间，并约束 `token_hash` 唯一。
- 新增标准库 token 工具：明文 session token 只在登录成功时返回一次，数据库只保存 `sha256` hash。
- 新增微信登录服务抽象 `WeChatAuthService`；默认实现不请求微信线上接口，测试通过 dependency override mock code exchange。
- 新增 auth endpoints：`POST /api/v1/auth/wechat-login`、`GET /api/v1/auth/me`、`POST /api/v1/auth/logout`。
- readonly workspace API 优先支持 `Authorization: Bearer <token>`，并继续通过 `workspace_members` 校验对象级权限。
- `X-TitleLab-User-Id` 仅保留为 local/dev/test fallback，不是生产登录方案。
- `/healthz` 继续保持 public raw；`/api/meta` 继续保持 public envelope。
- OpenAPI 契约只新增允许的 auth POST：`/api/v1/auth/wechat-login` 和 `/api/v1/auth/logout`，未新增业务写接口。

验证结果：

- `python3 -m compileall backend/app backend/tests` 通过。
- 后端 pytest 通过，覆盖 auth API、auth service、readonly Bearer session、dev/test header fallback、revoked/expired session、health/meta 和 OpenAPI 写方法限制。
- 本地临时 SQLite `backend/titlelab_phase4b_migration_test.db` 完成 `alembic upgrade head -> 表存在检查 -> downgrade base -> upgrade head`，验证后已删除临时库。

边界确认：

- 未修改 `miniprogram/**`。
- 未调用真实微信 `jscode2session` 或任何微信线上接口。
- 未读取、打印或写入真实 AppSecret、API key、DB 密码、token、cookie。
- 未连接生产、远程、腾讯云、Supabase 或任何真实业务数据库。
- 未部署、未上传体验版、未提交审核。
- 未接入 OpenAI。

下一步最小建议：

Phase 4C 可另起独立 worktree 做小程序登录接入规划/实现，仍需保持 real API gate、合法域名、AppID、隐私指引和体验版上传为单独 RELEASE_GATE；如果先做真实 API preflight，也必须只走明确授权的测试环境和只读 smoke。

## 21. Phase 4C 小程序 auth/session 接入层

Phase 4C 在独立 worktree `phase4c-miniprogram-auth-session-integration` 中实现小程序侧 auth/session 接入层。目标是让小程序具备受控的 `wx.login -> POST /api/v1/auth/wechat-login` 调用能力、session token 本地存储、`request.js` 自动注入 `Authorization: Bearer <token>`、`/auth/me` 与 `/auth/logout` service 封装。本阶段默认仍为 mock，real API gate 和 auth real gate 均默认关闭；没有部署、没有上传体验版、没有提交审核、没有连接真实数据库、没有真实调用微信接口、没有接入 OpenAI。

实现结果：

- `miniprogram/config/env.js` 保持 `apiMode=mock`、`realApiGateEnabled=false`，并新增 `authRealApiGateEnabled=false`。
- `miniprogram/adapters/wechat.js` 封装 `wx.login`、设备标签和 storage 能力，页面不直接调用 `wx.login`。
- 新增 `miniprogram/services/sessionStore.js`，使用 `titlelab.*` 命名空间保存 access token、用户摘要、workspace 摘要和过期时间。
- 新增 `miniprogram/services/authApi.js`，只映射 `wechatLogin(code)`、`getMe()`、`logout()`。
- 新增 `miniprogram/services/authRepository.js`，封装 `loginWithWechat()`、`restoreSession()`、`getCurrentUser()`、`logout()` 和 `isAuthenticated()`；gate 关闭时不真实请求。
- `miniprogram/services/request.js` 支持 `GET` 和允许的 auth `POST`，默认仍受 gate 阻断，并在有 session token 时自动注入 Bearer header。
- `miniprogram/app.js` 启动时尝试 `restoreSession()`，不强制登录，不阻断 mock 内容展示。
- `miniprogram/services/contentRepository.js` 补充 auth/session 错误标记，方便后续页面最小处理。
- `miniprogram/README.md` 记录 Phase 4C 接入层、默认 mock、真实 gate 默认关闭、只允许 auth POST 和 release gate 边界。

边界确认：

- 未新增登录页面，未做 UI 大改版。
- 未修改 `backend/alembic/**`、`backend/app/models/**` 或 `backend/app/db/**`。
- 未新增业务 `POST`、`PUT`、`PATCH`、`DELETE`。
- 未调用真实微信 `jscode2session` 或任何微信线上接口。
- 未读取、打印或写入真实 AppSecret、API key、DB 密码、token、cookie。
- 未连接生产、远程、腾讯云、Supabase 或任何真实业务数据库。
- 未部署、未上传体验版、未提交审核。

下一步最小建议：

Phase 4D 可单独做受控真机/测试环境登录 preflight 规划，先明确 AppID、合法域名、隐私指引、测试账号/成员、后端环境和回滚策略；任何体验版上传、真实微信后台配置或生产 API smoke 都必须另起 RELEASE_GATE。

## 22. Phase 4D real auth preflight harness

Phase 4D 在独立 worktree `phase4d-real-auth-preflight-harness` 中新增真实 API / 登录 gate 打开前的本地静态 preflight harness 和人工检查清单。本阶段没有部署、没有上传体验版、没有提交审核、没有连接真实数据库、没有对真实数据库执行 migration、没有真实调用微信接口、没有接入 OpenAI，也没有打开真实 API gate。

新增 / 更新文件：

- `scripts/titlelab_phase4d_preflight_check.py`
- `docs/14_PHASE4D_REAL_AUTH_PREFLIGHT_CHECKLIST.md`
- `miniprogram/README.md`
- `backend/README.md`
- `docs/08_HANDOFF.md`

preflight 脚本检查：

- `realApiGateEnabled=false` 和 `authRealApiGateEnabled=false` 仍为默认值。
- 唯一允许 API base 为 `https://api.title.mirroroo.top/api/v1`。
- 小程序运行时代码不引用禁用域名、Cloudflare 临时域名或 `api.openai.com`。
- 页面不直接调用 `wx.request` 或 `wx.login`。
- `wx.request` 只允许在 `miniprogram/services/request.js`。
- `wx.login` 只允许在 `miniprogram/adapters/wechat.js`。
- `POST` 调用只允许 `miniprogram/services/authApi.js` 中的 `wechat-login` 和 `logout`。
- 不允许新增 `PUT`、`PATCH` 或 `DELETE`。
- `miniprogram/project.private.config.json` 未被 git 跟踪。
- session storage key 使用 `titlelab.*` 命名空间。
- `workspaceId=default` 作为风险项输出，不作为脚本失败。
- README 和 handoff 明确 real gate 未开启。

边界确认：

- 未修改 backend auth 实现代码。
- 未修改 `backend/alembic/**`、`backend/app/models/**` 或 `backend/app/db/**`。
- 未新增业务 `POST`、`PUT`、`PATCH`、`DELETE`。
- 未上传体验版、未提审、未部署、未改服务器 / Nginx / DNS / Cloudflare / 腾讯云配置。
- 未读取、打印或写入真实 AppSecret、API key、DB 密码、token、cookie。

下一步最小建议：

Phase 4E 可在单独授权的 RELEASE_GATE 中做 controlled real API gate enable：先替换真实 workspaceId、核对微信后台合法域名 / 隐私指引 / 测试成员和非生产后端测试环境，再只对测试成员打开真实登录；如优先推进 AI，则另起 Phase 5 AI Facade，继续禁止小程序直连 OpenAI。

## 23. Phase 4E controlled real gate readiness

Phase 4E 在独立 worktree `phase4e-controlled-real-gate-readiness` 中实现 controlled real API gate readiness。本阶段没有打开真实 gate，没有默认真实请求，没有部署、上传体验版、提交审核，没有连接真实数据库，没有真实调用微信接口，也没有接入 OpenAI。

新增 / 更新文件：

- `miniprogram/services/realGateGuard.js`
- `scripts/titlelab_phase4e_real_gate_check.py`
- `docs/15_PHASE4E_CONTROLLED_REAL_GATE_READINESS.md`
- `miniprogram/config/env.js`
- `miniprogram/services/request.js`
- `miniprogram/services/authRepository.js`
- `miniprogram/services/contentRepository.js`
- `miniprogram/README.md`
- `backend/README.md`
- `docs/08_HANDOFF.md`

实现结果：

- `realApiGateEnabled=false` 和 `authRealApiGateEnabled=false` 继续保持默认关闭。
- `realGateGuard` 提供 `validateRealApiReadiness`、`assertRealApiReadiness`、`isPlaceholderWorkspaceId`、`normalizeGateError`。
- 真实请求前统一校验 API base、workspaceId、auth gate 和 session readiness。
- `workspaceId=default` 在 gate 关闭时仍只作为风险；gate 开启后必须失败为 `REAL_WORKSPACE_REQUIRED`。
- auth gate 开启但需要 session 的请求缺少 token 时必须失败为 `REAL_AUTH_SESSION_REQUIRED`。
- `request.js` 保持 envelope 校验和 Bearer 注入逻辑。
- `authRepository.loginWithWechat()` 在 readiness 不满足时先 fail-fast，不触发 `wx.login`。
- `contentRepository` 在 real mode 下调用内容 API 前先校验 workspace readiness。

边界确认：

- 未修改 backend auth 实现。
- 未修改 `backend/alembic/**`、`backend/app/models/**` 或 `backend/app/db/**`。
- 未新增业务 `POST`、`PUT`、`PATCH`、`DELETE`。
- 未上传体验版、未提审、未部署、未改服务器 / Nginx / DNS / Cloudflare / 腾讯云配置。
- 未读取、打印或写入真实 AppSecret、API key、DB 密码、token、cookie。

下一步最小建议：

在用户单独授权后，可做 Phase 4F controlled real test：先准备非生产后端测试环境、真实 workspaceId、微信后台合法域名、隐私指引和测试成员，再只对测试成员短时打开真实 gate；也可以转入 Phase 5 AI Facade，继续禁止小程序直连 OpenAI。

## 24. Phase 5C OpenAI provider dry-run contract

Phase 5C 在独立 worktree `phase5c-openai-provider-dryrun-contract` 中实现后端 OpenAI provider dry-run contract。本阶段没有启用真实 provider，没有读取真实 `OPENAI_API_KEY`，没有触网，没有新增 OpenAI SDK 依赖，没有修改小程序，没有新增 migration，没有连接真实数据库，没有部署、上传体验版或提交审核。

新增 / 更新文件：

- `backend/app/services/ai_openai_contract.py`
- `backend/app/services/ai_usage_estimator.py`
- `backend/app/services/ai_openai_provider.py`
- `backend/app/services/ai_providers.py`
- `backend/app/services/ai_facade_service.py`
- `backend/app/schemas.py`
- `backend/app/config.py`
- `backend/.env.example`
- `backend/tests/test_ai_openai_dryrun_contract.py`
- `backend/tests/test_ai_structured_output_contract.py`
- `backend/tests/test_ai_openai_provider_disabled.py`
- `scripts/titlelab_phase5c_openai_dryrun_contract_check.py`
- `docs/18_PHASE5C_OPENAI_PROVIDER_DRYRUN_CONTRACT.md`
- `backend/README.md`
- `docs/08_HANDOFF.md`

实现结果：

- 新增 OpenAI request builder，输出 model、messages、response schema、timeout、retry、requestId 和 prompt cache metadata。
- 新增 Structured Outputs schema contract：`suggestions[]` 固定，每条 suggestion 只允许 `title`、`rationale`、`tags`、`riskLevel`、`score`。
- 新增 prompt caching-friendly builder：稳定 system prefix 在前，动态 source / reference / constraints 在后，稳定前缀不包含 secret-like 用户输入。
- 新增 `FakeOpenAITransport`，覆盖 success、malformed JSON、schema mismatch、rate limit、timeout、provider error 和 fake usage tokens。
- 新增 response normalizer，禁止自由文本直接透传给客户端。
- 新增 provider 错误映射：`AI_PROVIDER_RATE_LIMITED`、`AI_PROVIDER_TIMEOUT`、`AI_PROVIDER_SCHEMA_MISMATCH`、`AI_PROVIDER_BAD_RESPONSE`。
- 新增 usage estimate 占位：input/output/total/cached tokens 和 0 cost cents。
- 新增 redacted audit payload：request/response hash、provider request id、prompt preview、stable/dynamic hash 和 usage 摘要。
- OpenAI provider placeholder 仍默认 disabled；只有测试显式注入 fake transport 且 dry-run enabled 时才执行 contract。
- `TITLELAB_AI_PROVIDER=mock`、`TITLELAB_AI_REAL_PROVIDER_ENABLED=false`、`TITLELAB_AI_OPENAI_DRYRUN_ENABLED=false` 仍是安全默认值。
- 新增 Phase 5C preflight：`python3 scripts/titlelab_phase5c_openai_dryrun_contract_check.py`。

边界确认：

- 未修改 `miniprogram/**`。
- 未修改 `backend/alembic/**`。
- 未修改 `backend/app/db/**`。
- 未新增内容 CRUD 写接口。
- 只允许 auth login/logout POST 和 AI title-suggestions POST。
- 未调用真实 OpenAI、微信或任何外部 AI API。
- 未连接真实数据库，未执行真实数据库 migration。
- 未部署，未上传体验版，未提交审核。

下一步最小建议：

Phase 5D 如需 controlled live OpenAI smoke，必须另起 RELEASE_GATE，先确认非生产环境、受管 server-side secret、预算/限流/超时/回滚、脱敏日志和用户明确授权；继续禁止小程序直连 OpenAI。

## 25. Phase 5D Live OpenAI smoke readiness harness

Phase 5D 在独立 worktree `phase5d-live-openai-smoke-readiness-harness` 中实现后端 live smoke readiness harness。本阶段没有执行真实 OpenAI 调用，没有读取真实 `OPENAI_API_KEY`，没有触网，没有新增 OpenAI SDK 依赖，没有修改小程序，没有新增 migration，没有连接真实数据库，没有部署、上传体验版或提交审核。

新增 / 更新文件：

- `backend/app/services/ai_live_smoke_guard.py`
- `backend/app/config.py`
- `backend/.env.example`
- `backend/tests/test_ai_live_smoke_guard.py`
- `scripts/titlelab_phase5d_live_openai_smoke_readiness_check.py`
- `scripts/titlelab_phase5d_live_openai_smoke_runner.py`
- `docs/19_PHASE5D_LIVE_OPENAI_SMOKE_READINESS_HARNESS.md`
- `backend/README.md`
- `docs/08_HANDOFF.md`

实现结果：

- 新增 live smoke guard：校验 live smoke enabled、kill switch、manual approval、最大请求数、预算上限、expected model、provider gate 和 managed secret presence 布尔事实。
- 新增 runner：默认只输出 safe refusal plan，返回非零退出码，不执行真实请求，不读取 secret value，不触网。
- 新增 Phase 5D preflight：串联 Phase 5B / Phase 5C preflight，并检查 Phase 5D 默认值、runner 默认拒绝、无新增 SDK、无 miniprogram/migration/db/dependency diff、无 runtime OpenAI endpoint marker。
- `.env.example` 只新增安全占位：live smoke 默认关闭，kill switch 默认开启，预算和 expected model 默认空。
- `TITLELAB_AI_PROVIDER=mock`、`TITLELAB_AI_REAL_PROVIDER_ENABLED=false`、`TITLELAB_AI_OPENAI_DRYRUN_ENABLED=false`、`TITLELAB_AI_LIVE_SMOKE_ENABLED=false`、`TITLELAB_AI_LIVE_SMOKE_KILL_SWITCH=true` 仍是安全默认值。

边界确认：

- 未修改 `miniprogram/**`。
- 未修改 `backend/alembic/**`。
- 未修改 `backend/app/db/**`。
- 未新增内容 CRUD 写接口。
- 只允许 auth login/logout POST 和 AI title-suggestions POST。
- 未调用真实 OpenAI、微信或任何外部 AI API。
- 未连接真实数据库，未执行真实数据库 migration。
- 未部署，未上传体验版，未提交审核。

下一步最小建议：

Phase 5E 如需 controlled live OpenAI smoke，必须另起 RELEASE_GATE，并由用户在当轮明确授权真实外部调用；执行前确认非生产环境、受管 server-side secret、一次请求上限、极小预算、expected model、kill switch rollback、脱敏日志和 requestId / audit 追踪。

## 26. Phase 6 Mini Program AI title mock-only

Phase 6 在独立 worktree `phase6-miniprogram-ai-title-mock-only-full` 中实现小程序 AI 标题生成 mock-only 使用闭环。本阶段没有进入 Phase 5E，没有真实调用 OpenAI，没有读取真实 OpenAI key，没有请求真实后端 AI，没有连接真实数据库，没有新增 migration，没有部署、上传体验版或提交审核。

新增 / 更新文件：

- `miniprogram/app.json`
- `miniprogram/config/env.js`
- `miniprogram/services/request.js`
- `miniprogram/services/aiMock.js`
- `miniprogram/services/aiApi.js`
- `miniprogram/services/aiRepository.js`
- `miniprogram/services/aiResultNormalizer.js`
- `miniprogram/pages/ai/index.js`
- `miniprogram/pages/ai/index.json`
- `miniprogram/pages/ai/index.wxml`
- `miniprogram/pages/ai/index.wxss`
- `miniprogram/pages/index/index.js`
- `miniprogram/pages/index/index.wxml`
- `miniprogram/pages/index/index.wxss`
- `scripts/titlelab_phase6_miniprogram_ai_mock_check.py`
- `docs/21_PHASE6_MINIPROGRAM_AI_TITLE_MOCK_ONLY.md`
- `miniprogram/README.md`
- `docs/08_HANDOFF.md`

实现结果：

- 新增 AI 页面：输入内容、选择内容类型/语气/平台/数量、生成标题、loading、错误态、空态、结果列表和复制标题。
- 新增 mock AI service：本地生成结构化 `title`、`rationale`、`tags`、`riskLevel`、`score`，不触网。
- 新增 AI repository：默认 mock；真实 gate 未满足时 fail-fast。
- 新增 AI API 映射：只预留 `/api/v1/workspaces/{workspace_id}/ai/title-suggestions`。
- 首页新增“AI 标题生成”入口，不改内容库主流程。
- 真实 API、auth 和 AI 请求开关仍为默认关闭。
- 新增 Phase 6 preflight：`python3 scripts/titlelab_phase6_miniprogram_ai_mock_check.py`。

边界确认：

- 未修改 `backend/alembic/**`。
- 未修改 `backend/app/db/**`。
- 未修改 `backend/app/models/**`。
- 未新增依赖。
- 未新增内容 CRUD 写接口。
- 未调用真实 OpenAI、微信或任何外部 API。
- 未连接真实数据库，未执行真实数据库 migration。
- 未部署，未上传体验版，未提交审核。
- 未提交 `miniprogram/project.private.config.json`。

下一步最小建议：

如需真实 AI smoke，另起 Phase 5E RELEASE_GATE；如需让小程序接后端 AI mock/test API，另起 Phase 6B/6C，并继续保持小程序不直连 OpenAI、不保存 API key、不默认打开真实 gate。

## 27. Phase 6B Mini Program AI mock UX QA hardening

Phase 6B 在独立 worktree `phase6b-miniprogram-ai-mock-ux-qa-hardening` 中完成小程序 AI 标题生成 mock-only UX QA hardening。本阶段没有进入 Phase 5E，没有真实调用 OpenAI，没有请求真实后端 AI，没有连接真实数据库，没有新增 migration，没有新增依赖，没有部署、上传体验版或提交审核。

新增 / 更新文件：

- `miniprogram/config/env.js`
- `miniprogram/pages/ai/index.js`
- `miniprogram/pages/ai/index.wxml`
- `miniprogram/pages/ai/index.wxss`
- `miniprogram/pages/index/index.wxml`
- `miniprogram/pages/index/index.wxss`
- `miniprogram/services/aiMock.js`
- `miniprogram/services/aiRepository.js`
- `scripts/titlelab_phase6b_miniprogram_ai_mock_ux_check.py`
- `docs/22_PHASE6B_MINIPROGRAM_AI_MOCK_UX_QA_HARDENING.md`
- `miniprogram/README.md`
- `docs/08_HANDOFF.md`

实现结果：

- AI 页面新增字符计数、输入校验、mock-only notice、预设示例、loading、错误态、空态、暂无结果态和 warnings 展示。
- 新增 copy all / 复制全部、复制单个标题、清空和重新生成。
- `aiMock.js` 增强为更稳定的小红书/旅拍场景 mock 输出，并保持 `title`、`rationale`、`tags`、`riskLevel`、`score` schema。
- 疑似敏感输入不原样扩散到 mock 标题，并返回 `SECRET_LIKE_INPUT_REDACTED` warning。
- `realApiGateEnabled=false`、`authRealApiGateEnabled=false`、`aiRealApiGateEnabled=false` 仍为默认关闭。
- 新增 Phase 6B preflight：`python3 scripts/titlelab_phase6b_miniprogram_ai_mock_ux_check.py`。

边界确认：

- 未修改 `backend/alembic/**`。
- 未修改 `backend/app/db/**`。
- 未修改 `backend/app/models/**`。
- 未新增依赖。
- 未新增内容 CRUD 写接口。
- 未真实请求后端 AI。
- 未调用真实 OpenAI、微信或任何外部 API。
- 未连接真实数据库，未执行真实数据库 migration。
- 未部署，未上传体验版，未提交审核。
- 未提交 `miniprogram/project.private.config.json`。

下一步最小建议：

如需真实 AI smoke，另起 Phase 5E RELEASE_GATE；如需小程序接后端 AI mock/test API，另起 Phase 6C，并继续保持小程序不直连 OpenAI、不保存 API key、不默认打开真实 gate。

## 28. Phase 6C Mini Program AI mock acceptance QA

Phase 6C 在独立 worktree `phase6c-miniprogram-ai-mock-acceptance-qa` 中完成小程序 AI 标题生成 mock-only 页面验收 QA、DevTools 导入前检查和静态 preflight。本阶段没有进入 Phase 5E，没有真实调用 OpenAI，没有请求真实后端 AI，没有连接真实数据库，没有新增 migration，没有新增依赖，没有部署、上传体验版或提交审核。

新增 / 更新文件：

- `miniprogram/pages/ai/index.js`
- `miniprogram/pages/ai/index.wxml`
- `miniprogram/pages/ai/index.wxss`
- `scripts/titlelab_phase6c_miniprogram_ai_acceptance_check.py`
- `docs/23_PHASE6C_MINIPROGRAM_AI_MOCK_ACCEPTANCE_QA.md`
- `miniprogram/README.md`
- `docs/08_HANDOFF.md`

实现结果：

- AI 页面生成时先清理旧结果，避免 loading 中显示陈旧结果。
- 清空会重置 source、选项、结果、warnings、复制状态和上一次 payload。
- 重新生成沿用上一次 payload，保持 retry 行为可验收。
- sourceText 输入上限状态有明确提示，生成按钮继续在 loading 或输入不足时禁用。
- DevTools 导入前检查固化到 Phase 6C preflight，导入路径仍为 `miniprogram/`，`project.private.config.json` 不进入 git。
- `realApiGateEnabled=false`、`authRealApiGateEnabled=false`、`aiRealApiGateEnabled=false` 仍为默认关闭。
- 新增 Phase 6C preflight：`python3 scripts/titlelab_phase6c_miniprogram_ai_acceptance_check.py`。

边界确认：

- 未修改 `backend/alembic/**`。
- 未修改 `backend/app/db/**`。
- 未修改 `backend/app/models/**`。
- 未新增依赖。
- 未新增内容 CRUD 写接口。
- 未真实请求后端 AI。
- 未调用真实 OpenAI、微信或任何外部 API。
- 未连接真实数据库，未执行真实数据库 migration。
- 未部署，未上传体验版，未提交审核。
- 未提交 `miniprogram/project.private.config.json`。

下一步最小建议：

如需真实 AI smoke，另起 Phase 5E RELEASE_GATE；如需真机视觉验收，先只做 DevTools 手工验收记录，不上传体验版、不提交审核、不打开真实 gate。

## 29. Phase 6D Mini Program AI mock DevTools/manual acceptance pack

Phase 6D 在独立 worktree `phase6d-miniprogram-ai-mock-devtools-acceptance-pack` 中完成小程序 AI 标题生成 mock-only DevTools/manual acceptance pack。本阶段没有进入 Phase 5E，没有真实调用 OpenAI，没有请求真实后端 AI，没有连接真实数据库，没有新增 migration，没有新增依赖，没有部署、上传体验版或提交审核。

新增 / 更新文件：

- `scripts/titlelab_phase6d_miniprogram_devtools_acceptance_check.py`
- `docs/24_PHASE6D_MINIPROGRAM_AI_MOCK_DEVTOOLS_ACCEPTANCE_PACK.md`
- `docs/qa/PHASE6D_MINIPROGRAM_AI_MOCK_MANUAL_TEST_CASES.md`
- `docs/qa/PHASE6D_MINIPROGRAM_AI_MOCK_SCREENSHOT_CHECKLIST.md`
- `docs/qa/PHASE6D_MINIPROGRAM_AI_MOCK_BUG_REPORT_TEMPLATE.md`
- `miniprogram/README.md`
- `docs/08_HANDOFF.md`
- `docs/07_ACCEPTANCE_CHECKLIST.md`

实现结果：

- 固化 DevTools 导入路径：只导入 `miniprogram/`，不导入仓库根目录。
- 新增 manual acceptance 用例，覆盖首页入口、空输入、短输入、正常输入、示例输入、选项组合、复制单条、复制全部、清空、重试、过长输入、疑似敏感输入、不登录和网络关闭 mock 可用性。
- 新增截图清单，覆盖首页入口、AI 初始态、示例输入、loading、结果列表、warning、空输入错误、复制成功 toast、清空和重试状态。
- 新增 bug report template，覆盖设备/模拟器、微信开发者工具版本、基础库版本、复现步骤、预期结果、实际结果、截图路径、控制台错误、是否阻塞和建议优先级。
- 新增 Phase 6D preflight：`python3 scripts/titlelab_phase6d_miniprogram_devtools_acceptance_check.py`。

边界确认：

- `realApiGateEnabled=false`、`authRealApiGateEnabled=false`、`aiRealApiGateEnabled=false` 仍为默认关闭。
- 未修改小程序页面逻辑。
- 未修改 `backend/alembic/**`。
- 未修改 `backend/app/db/**`。
- 未修改 `backend/app/models/**`。
- 未新增依赖。
- 未新增内容 CRUD 写接口。
- 未真实请求后端 AI。
- 未调用真实 OpenAI、微信或任何外部 API。
- 未连接真实数据库，未执行真实数据库 migration。
- 未部署，未上传体验版，未提交审核。
- 未提交 `miniprogram/project.private.config.json`。

下一步最小建议：

使用微信开发者工具导入 `miniprogram/`，按 `docs/qa/PHASE6D_MINIPROGRAM_AI_MOCK_MANUAL_TEST_CASES.md` 执行手动验收并记录截图/问题；仍不上传体验版、不提交审核、不打开真实 gate。

## 30. Phase 6E Direct original Web/PWA UI AI inline fix

Phase 6E 在独立 worktree `phase6e-direct-original-ui-ai-inline-fix` 中停止 Stitch 方案，直接基于现有真实 TitleLab Web/PWA UI 做原 UI 锁定式 AI 行内修复。本阶段没有使用 Stitch 代码，没有真实调用 OpenAI，没有读取或写入真实 AI key，没有请求后端 AI，没有连接真实数据库，没有新增 migration，没有新增依赖，没有部署、上传体验版或提交审核。

新增 / 更新文件：

- `index.html`
- `title.html`
- `assets/app-title.js`
- `assets/app-content.js`
- `assets/styles.css`
- `scripts/titlelab_phase6e_original_ui_ai_inline_check.py`
- `docs/25_PHASE6E_DIRECT_ORIGINAL_UI_AI_INLINE_FIX.md`
- `docs/08_HANDOFF.md`
- `docs/07_ACCEPTANCE_CHECKLIST.md`

定位 / 检查但未修改：

- `content.html`

实现结果：

- 保留现有 `THE` logo、标题/文案双 Tab、S 用户按钮、退出按钮、分类管理、搜索/筛选、账号分类、设为本机默认、主题设置、管理页面和列表操作按钮。
- 标题页新增 `activeAiTitleId` 行内状态；点击标题行/卡片 `✨AI` 后，在当前标题下方打开 `AI 标题灵感` 本地示例面板。
- 标题本地示例结果为港迪旅拍/摄影业务标题，支持复制、加入标题库、换一批和关闭；不请求后端，不调用外部 AI。
- 文案页新增 `expandedCopyId` 与 `activeCopyAiId`；文案支持当前卡片/行内展开，`✨AI` 会展开当前文案并显示 `AI 文案助手`。
- 文案助手支持提取标题、改写文案、生成话题、精简文案的本地示例展示，结果只用于本地 UI 验收。
- 删除了旧标题 AI 弹窗中的外部接口地址、模型和 key 输入，避免前端保留真实 AI 接入入口。
- 清理了真实 UI 文件中既存的本机诊断 `127.0.0.1` fetch 探针，避免 UI 加载时发本机调试请求。
- 新增 Phase 6E preflight：`python3 scripts/titlelab_phase6e_original_ui_ai_inline_check.py`。

边界确认：

- 未修改 `backend/alembic/**`。
- 未修改 `backend/app/db/**`。
- 未修改 `backend/app/models/**`。
- 未新增依赖。
- 未新增内容 CRUD 写接口。
- 未真实请求后端 AI。
- 未调用真实 OpenAI、微信或任何外部 API。
- 未连接真实数据库，未执行真实数据库 migration。
- 未部署，未上传体验版，未提交审核。
- 未提交 `miniprogram/project.private.config.json`。

下一步最小建议：

在本地浏览器/PWA 预览真实 `title.html` 和 `content.html`，按 Phase 6E 验收项确认标题 AI 行内面板、文案展开、文案 AI 面板和分类下拉均保持原 UI；仍不部署、不接真实 AI、不打开真实 gate。

## 31. Phase 6F Mini Program original UI inline AI sync

Phase 6F 在独立 worktree `phase6f-miniprogram-original-ui-ai-inline-sync` 中，将 Phase 6E 的原 UI 行内 AI 结构同步到当前主仓库小程序源码 `miniprogram/`。本阶段没有修改微信开发者工具缓存，没有修改旧 Phase 3 worktree，没有真实请求后端，没有连接真实数据库，没有新增 migration，没有新增依赖，没有部署、上传体验版或提交审核。

新增 / 更新文件：

- `miniprogram/app.json`
- `miniprogram/config/env.js`
- `miniprogram/pages/index/index.js`
- `miniprogram/pages/index/index.wxml`
- `miniprogram/pages/index/index.wxss`
- `miniprogram/services/aiRepository.js`
- `scripts/titlelab_phase6f_miniprogram_original_ui_sync_check.py`
- `docs/26_PHASE6F_MINIPROGRAM_ORIGINAL_UI_AI_INLINE_SYNC.md`
- `miniprogram/README.md`
- `docs/08_HANDOFF.md`
- `docs/07_ACCEPTANCE_CHECKLIST.md`

实现结果：

- 小程序首页从旧绿色只读列表替换为蓝白工具风格的标题/文案库。
- 顶部包含 `THE`、标题 / 文案双 Tab、S 用户按钮和退出按钮。
- 分类管理卡片保留全部、亲子、氛围、情侣、闺蜜、单人、街拍、口碑推荐、节日及计数，并保留上移、下移、改。
- 标题 Tab 包含搜索标题关键词、账号分类、操作按钮和标题列表。
- 标题列表每行包含 `⭐ 序号`、标题正文、复制、`✨AI`、修改、删除。
- 标题 `✨AI` 使用 `activeAiTitleId` 在当前标题下方展开 `AI 标题灵感` 本地示例面板。
- 文案 Tab 包含搜索文案关键词、账号分类、操作按钮和文案列表。
- 文案列表使用 `expandedCopyId` 展开完整多行文案，使用 `activeCopyAiId` 展开 `AI 文案助手` 本地示例面板。
- AI 入口不插入分类列表内部。
- `project.config.json` 确认为 `projectname=TitleLab`、`compileType=miniprogram`、`urlCheck=true`、`appid=wx5d7766982eebe9fc`。
- 新增 Phase 6F preflight：`python3 scripts/titlelab_phase6f_miniprogram_original_ui_sync_check.py`。

边界确认：

- 未修改 `/Users/lorenmac/Library/Application Support/微信开发者工具/**`。
- 未修改 `/Users/lorenmac/Claude/Projects/TitleLab-worktrees/phase3-miniprogram-readonly-mvp/**`。
- `realApiGateEnabled=false`、`authRealApiGateEnabled=false`、`aiRealApiGateEnabled=false` 仍为默认关闭。
- 页面不直接调用 `wx.request` 或 `wx.login`。
- 复制仍通过 `adapters/wechat.js` 封装。
- 未修改 `backend/alembic/**`、`backend/app/db/**`、`backend/app/models/**`。
- 未新增业务内容写接口。
- 未提交 `miniprogram/project.private.config.json`。

## 32. Phase 6G Mini Program compliance UI login privacy fix

Phase 6G 在独立 worktree `phase6g-miniprogram-compliance-ui-login-privacy-fix` 中完成微信小程序合规前端整改。本阶段从 `17a4927` 开始，AppID 配置已固化为 `wx2f9db77f2383b42e`。本阶段没有修改微信开发者工具缓存，没有修改旧 Phase 3 worktree，没有真实请求后端，没有连接真实数据库，没有新增 migration，没有新增依赖，没有部署、上传体验版或提交审核。

新增 / 更新文件：

- `miniprogram/app.json`
- `miniprogram/app.js`
- `miniprogram/adapters/wechat.js`
- `miniprogram/config/env.js`
- `miniprogram/services/request.js`
- `miniprogram/pages/index/index.js`
- `miniprogram/pages/index/index.wxml`
- `miniprogram/pages/index/index.wxss`
- `miniprogram/pages/login/index.js`
- `miniprogram/pages/login/index.json`
- `miniprogram/pages/login/index.wxml`
- `miniprogram/pages/login/index.wxss`
- `miniprogram/pages/settings/index.js`
- `miniprogram/pages/settings/index.json`
- `miniprogram/pages/settings/index.wxml`
- `miniprogram/pages/settings/index.wxss`
- `miniprogram/pages/legal/privacy.js`
- `miniprogram/pages/legal/privacy.json`
- `miniprogram/pages/legal/privacy.wxml`
- `miniprogram/pages/legal/privacy.wxss`
- `miniprogram/pages/legal/terms.js`
- `miniprogram/pages/legal/terms.json`
- `miniprogram/pages/legal/terms.wxml`
- `miniprogram/pages/legal/terms.wxss`
- `scripts/titlelab_phase6g_miniprogram_compliance_check.py`
- `docs/27_PHASE6G_MINIPROGRAM_COMPLIANCE_UI_LOGIN_PRIVACY_FIX.md`
- `miniprogram/README.md`
- `docs/08_HANDOFF.md`
- `docs/07_ACCEPTANCE_CHECKLIST.md`

删除文件：

- `miniprogram/pages/ai/index.js`
- `miniprogram/pages/ai/index.json`
- `miniprogram/pages/ai/index.wxml`
- `miniprogram/pages/ai/index.wxss`
- `miniprogram/services/aiApi.js`
- `miniprogram/services/aiMock.js`
- `miniprogram/services/aiRepository.js`
- `miniprogram/services/aiResultNormalizer.js`

实现结果：

- `app.json` 默认入口改为 `pages/login/index`，并纳入首页、设置页、隐私政策和用户服务协议。
- 登录页展示 `TitleLab` 与 `本产品账号登录`，说明不要求微信账号、微信密码或微信验证码。
- 协议复选框默认未勾选；未勾选登录会拦截并提示 `请先阅读并勾选《用户服务协议》《隐私政策》后再继续。`
- 当前仅使用本地产品账号态，不调用微信登录能力，不使用手机号、头像、昵称等微信用户信息能力。
- 首页保留标题/文案库、搜索、分类、复制、新增、修改、删除入口，并移除当前路由页面的用户可见高风险词。
- 首页使用弹性 Tab、分类横向名称、按钮两列网格、列表操作两列网格和块级展开文案，避免分类竖排、按钮横向溢出、顶部 Tab 变形和展开遮挡。
- 已删除未路由历史 AI 页面和未引用 AI service，并从 request 封装移除 AI 写请求白名单。
- 隐私政策覆盖信息处理、信息类型、授权同意、账号注销、数据删除、对外提供、微信用户信息、设备能力和剪贴板。
- 用户服务协议覆盖用户责任、禁止行为、不得收集/出售/转让/泄露他人个人信息、来源合法、必要授权、停用和注销。
- 设置页提供协议、隐私政策、账号注销与数据删除说明、版本信息和退出登录。
- 新增 Phase 6G preflight：`python3 scripts/titlelab_phase6g_miniprogram_compliance_check.py`。

边界确认：

- 页面不直接调用 `wx.request` 或 `wx.login`。
- `wx.request` 只保留在 `services/request.js`。
- `wx.login` 只保留在 `adapters/wechat.js`。
- 未使用 `getPhoneNumber`、`wx.getUserProfile`、`wx.getUserInfo` 或 `getClipboardData`。
- 复制仍通过 `adapters/wechat.js` 封装，只在用户点击复制时写入剪贴板。
- `realApiGateEnabled=false`、`authRealApiGateEnabled=false` 仍为默认关闭。
- 当前个人主体安全版不保留用户可见 AI 能力；未来恢复 AI 必须另起独立 Phase。
- 未修改 `backend/alembic/**`、`backend/app/db/**`、`backend/app/models/**`。
- 未新增业务内容写接口。
- 未提交 `miniprogram/project.private.config.json`。

下一步最小建议：

在微信开发者工具中重新导入当前主仓库 `miniprogram/`，只做本地视觉和协议链路验收：登录协议拦截、登录后首页、分类横向、按钮不溢出、文案展开、设置页、协议页、隐私页和退出登录；仍不上传体验版、不提交审核、不打开真实请求。

## 33. Phase 6H Mini Program local login accounts

Phase 6H 在独立 worktree `phase6h-miniprogram-local-login-accounts` 中完成小程序本地登录账号配置修复。本阶段没有修改微信开发者工具缓存，没有修改旧 Phase 3 worktree，没有真实请求后端，没有连接真实数据库，没有新增 migration，没有新增依赖，没有部署、上传体验版或提交审核。

新增 / 更新文件：

- `miniprogram/services/localAuth.js`
- `miniprogram/pages/login/index.js`
- `miniprogram/pages/login/index.wxml`
- `miniprogram/pages/settings/index.js`
- `miniprogram/pages/settings/index.wxml`
- `scripts/titlelab_phase6h_miniprogram_login_accounts_check.py`
- `scripts/titlelab_phase6g_miniprogram_compliance_check.py`
- `docs/28_PHASE6H_MINIPROGRAM_LOCAL_LOGIN_ACCOUNTS.md`
- `docs/27_PHASE6G_MINIPROGRAM_COMPLIANCE_UI_LOGIN_PRIVACY_FIX.md`
- `miniprogram/README.md`
- `docs/07_ACCEPTANCE_CHECKLIST.md`
- `docs/08_HANDOFF.md`

实现结果：

- 新增 `localAuth` 本地账号封装，统一处理本机登录态和本机 `olina` 密码。
- 自用账号为 `olina`，密码由用户首次在本机登录时输入并保存到本机，后续登录必须匹配。
- 审核检查账号为 `test / test`，只用于本地和审核检查，不连接后端。
- 登录页不展示 `test / test`。
- 密码为空提示 `请输入产品密码。`
- 账号或密码不匹配提示 `账号或密码不正确。`
- 协议复选框保持默认未勾选，未勾选仍拦截登录。
- 登录页保留 `本产品账号登录` 和不要求微信账号、微信密码或微信验证码说明。
- 设置页新增 `重置本机账号密码`，确认后只清除本机保存的 `olina` 密码，不影响 `test / test`。
- 新增 Phase 6H preflight：`python3 scripts/titlelab_phase6h_miniprogram_login_accounts_check.py`。

边界确认：

- 当前仍为本地演示登录，不是生产账号体系。
- 未把用户真实密码写入代码、文档、配置或测试。
- 未调用真实后端 API。
- 未调用 `wx.login`。
- 未使用 `getPhoneNumber`、`wx.getUserProfile`、`wx.getUserInfo` 或 `getClipboardData`。
- 页面不直接调用 `wx.request`。
- 未修改 `backend/alembic/**`、`backend/app/db/**`、`backend/app/models/**`。
- 未新增依赖。
- 未提交 `miniprogram/project.private.config.json`。

下一步最小建议：

在微信开发者工具中只做本地手工验证：未勾选协议拦截、`olina` 首次设置密码、`olina` 后续密码校验、`test / test` 登录、设置页重置本机账号密码和退出登录；仍不上传体验版、不提交审核、不打开真实请求。

## 34. Phase 6I Mini Program mature product UI redesign

Phase 6I 在独立 worktree `phase6i-miniprogram-mature-product-ui-redesign` 中完成小程序成熟产品 UI 重构。本阶段没有修改微信开发者工具缓存，没有修改旧 Phase worktree，没有真实请求后端，没有连接真实数据库，没有新增 migration，没有新增依赖，没有部署、上传体验版或提交审核。

新增 / 更新文件：

- `miniprogram/app.json`
- `miniprogram/pages/index/index.js`
- `miniprogram/pages/index/index.wxml`
- `miniprogram/pages/index/index.wxss`
- `miniprogram/pages/categories/index.js`
- `miniprogram/pages/categories/index.json`
- `miniprogram/pages/categories/index.wxml`
- `miniprogram/pages/categories/index.wxss`
- `miniprogram/pages/settings/index.js`
- `miniprogram/pages/settings/index.wxml`
- `miniprogram/pages/settings/index.wxss`
- `miniprogram/pages/login/index.wxss`
- `scripts/titlelab_phase6g_miniprogram_compliance_check.py`
- `scripts/titlelab_phase6i_miniprogram_ui_check.py`
- `docs/29_PHASE6I_MINIPROGRAM_MATURE_PRODUCT_UI_REDESIGN.md`
- `miniprogram/README.md`
- `docs/07_ACCEPTANCE_CHECKLIST.md`
- `docs/08_HANDOFF.md`

实现结果：

- 首页信息架构改为品牌账号行、标题/文案 segmented control、搜索与新增、账号筛选、分类 chips 和列表卡片。
- 首页分类管理不再默认展开，上移、下移、改名移入 `pages/categories/index`。
- 首页分类筛选改为横向 chips，当前选中使用蓝底白字。
- 新增标题 / 新增文案放在搜索区右侧，不使用底部固定栏。
- 标题/文案卡片改为紧凑布局，操作按钮改为小型胶囊按钮。
- 设置页保留协议、隐私政策、重置本机账号密码和退出登录，并承接批量导入、主题设置、页面配置等低频入口。
- 登录页仅轻微统一视觉，未修改登录业务逻辑。
- 页面底部使用 `env(safe-area-inset-bottom)`，降低 home indicator 遮挡风险。
- 新增 Phase 6I UI preflight：`python3 scripts/titlelab_phase6i_miniprogram_ui_check.py`。

边界确认：

- `test / test` 审核检查账号保持不变。
- `olina` 首次本机设置密码与复登校验保持不变。
- 协议默认未勾选和未勾选拦截保持不变。
- 未恢复用户可见 AI、智能、生成式、mock、本地示例等高风险词。
- 未使用 `getPhoneNumber`、`wx.getUserProfile`、`wx.getUserInfo` 或 `getClipboardData`。
- 页面不直接调用 `wx.request` 或 `wx.login`。
- 未修改 `backend/alembic/**`、`backend/app/db/**`、`backend/app/models/**`。
- 未提交 `miniprogram/project.private.config.json`。

下一步最小建议：

在微信开发者工具中只做本地视觉验收：登录后首页首屏是否优先展示搜索、分类 chips、列表和新增按钮；分类管理页是否可进入；标题/文案卡片和按钮是否不溢出；设置页低频入口是否收纳合理。仍不上传体验版、不提交审核、不打开真实请求。

## 6. 风险与注意

- 现有登录形态是静态网页时代的实现，重建时必须迁移到服务端认证。
- 现有用户隔离依赖本地 key 和快照命名规则，重建时必须转为数据库权限模型。
- 快照恢复、清空和导出属于高风险后台能力，必须有权限控制、二次确认和审计日志。
- AI 生成能力必须通过后端代理并记录生成历史，避免前端暴露密钥。
- 小程序上线前必须完成 HTTPS、合法域名、备案、隐私政策和内容安全检查。
- 后续所有 Phase 开始前必须先读取 `docs/09_PHASE_EXECUTION_PLAN.md`、`docs/10_NUMHUB_LESSONS_FOR_TITLELAB.md`、`docs/11_DOMAIN_AND_COMPLIANCE_LOCK.md`。
- Phase 1+ 禁止直接在 main 开发，必须使用独立 branch 和独立 worktree。
