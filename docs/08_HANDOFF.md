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

## 11. Phase 2C API response contract

Phase 2C 在独立 worktree `phase2c-api-response-contract` 中完成后端只读 API response contract。目标是为后续 Phase 3C 小程序真实只读 API 接入提供稳定响应包；本阶段不新增写接口、不做登录、不修改数据库模型或 migration、不连接真实数据库、不部署、不 push。

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
- 未连接任何真实数据库。
- 未执行 Alembic migration。

下一步建议：

Phase 3C 小程序真实只读 API 接入应以本契约为准，统一从 `data.items` / `data` 读取业务数据，并保留 `requestId` 作为排障锚点。

## 6. 风险与注意

- 现有登录形态是静态网页时代的实现，重建时必须迁移到服务端认证。
- 现有用户隔离依赖本地 key 和快照命名规则，重建时必须转为数据库权限模型。
- 快照恢复、清空和导出属于高风险后台能力，必须有权限控制、二次确认和审计日志。
- AI 生成能力必须通过后端代理并记录生成历史，避免前端暴露密钥。
- 小程序上线前必须完成 HTTPS、合法域名、备案、隐私政策和内容安全检查。
- 后续所有 Phase 开始前必须先读取 `docs/09_PHASE_EXECUTION_PLAN.md`、`docs/10_NUMHUB_LESSONS_FOR_TITLELAB.md`、`docs/11_DOMAIN_AND_COMPLIANCE_LOCK.md`。
- Phase 1+ 禁止直接在 main 开发，必须使用独立 branch 和独立 worktree。
