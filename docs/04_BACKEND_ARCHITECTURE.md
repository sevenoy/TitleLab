# TitleLab Backend Architecture

当前阶段：Phase 0 - 后端架构规划，不创建后端代码。

## 1. 后端职责

后端是小程序、管理后台和数据库之间的唯一业务入口。它负责认证、授权、内容 API、导入、快照、AI 生成、审计和健康检查。

## 2. 模块划分

- Auth：微信登录、后台账号登录、会话校验、退出。
- Users / Workspaces：用户资料、workspace、成员角色。
- Contents：标题、文案、模板统一内容模型。
- Taxonomy：主分类、账号分类、标签、排序。
- Favorites：收藏/星标。
- Usage Events：浏览、复制、导入、生成、导出历史。
- Import：批量导入预览、确认导入、去重。
- Snapshots：快照保存、列表、恢复、删除、导出。
- Admin：审核、危险操作、配置管理、审计查询。
- AI：标题仿写、模型配置、生成记录。
- Health：`/healthz`、`/meta`。

## 3. API 设计基准

### 3.1 健康检查

- `GET /healthz`：返回服务是否存活，不返回敏感配置。
- `GET /api/meta`：返回公开版本、构建时间、环境名和功能开关。

### 3.2 认证

- `POST /api/auth/wechat-login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

认证返回内容：

- 用户基础资料。
- 当前 workspace。
- 角色和权限摘要。
- 会话过期时间。

### 3.3 内容

- `GET /api/contents`
- `POST /api/contents`
- `GET /api/contents/:id`
- `PATCH /api/contents/:id`
- `DELETE /api/contents/:id`

查询参数：

- `content_type`
- `keyword`
- `primary_category_id`
- `account_category_id`
- `tag_ids`
- `favorite_only`
- `status`
- `page`
- `page_size`

### 3.4 分类与标签

- `GET /api/categories`
- `POST /api/categories`
- `PATCH /api/categories/:id`
- `DELETE /api/categories/:id`
- `GET /api/account-categories`
- `GET /api/tags`

### 3.5 收藏与历史

- `GET /api/favorites`
- `POST /api/favorites`
- `DELETE /api/favorites/:id`
- `POST /api/usage-events`
- `GET /api/usage-events`

### 3.6 导入、快照、AI

- `POST /api/imports/preview`
- `POST /api/imports/confirm`
- `GET /api/snapshots`
- `POST /api/snapshots`
- `POST /api/snapshots/:id/restore`
- `POST /api/ai/generate-title`
- `GET /api/ai/generation-records`

## 4. 权限规则

- 所有业务接口默认需要登录。
- 所有数据查询必须限定 `workspace_id`。
- `viewer` 可读、收藏、复制。
- `editor` 可新增/编辑内容和导入。
- `admin` 可审核、导出、快照和配置。
- `owner` 可管理 workspace 和成员。

## 5. 错误与审计

统一错误格式建议：

- `code`
- `message`
- `request_id`
- `details`

所有危险操作写入 `audit_logs`：

- 删除内容。
- 批量清空。
- 快照恢复。
- 导出数据。
- 修改系统配置。
- 修改用户角色。

## 6. 密钥与配置

- 微信 AppSecret、AI API Key、数据库连接串、腾讯云 SecretId/SecretKey 只允许在服务端私有配置中保存。
- 不在接口响应、日志、小程序代码、前端错误提示中暴露敏感值。
- Phase 1 只准备配置读取骨架和 `.env.example` 方向，不提交真实 `.env`。

## 7. Phase 1 最小后端目标

Phase 1 只建议实现：

- 后端项目骨架。
- 数据库连接配置占位。
- 基础 migration。
- `GET /healthz`。
- `GET /api/meta`。
- 统一错误格式。
- README 运行说明。

不建议在 Phase 1 直接实现完整业务 CRUD。

