# TitleLab Database Design v0.2

当前阶段：Phase 0 - 只做数据库重设计文档，不创建 migration。

## 1. 设计目标

现有 Web 版依赖浏览器本地状态、Supabase 快照和用户前缀 key 来隔离数据。小程序化重建应改为后端统一读写关系型数据库，通过 workspace、角色和审计日志实现长期维护。

建议数据库方向：PostgreSQL 或 MySQL/MariaDB 均可，Phase 1 只需确定一种并创建基础 migration。本文件先描述逻辑模型，不绑定具体 SQL 方言。

## 2. 核心实体

### users

保存系统用户。

建议字段：

- `id`
- `openid`
- `unionid`
- `username`
- `display_name`
- `avatar_url`
- `status`
- `last_login_at`
- `created_at`
- `updated_at`

约束：

- `openid` 可为空以支持后台账号；微信小程序用户必须唯一。
- `status` 至少包含 `active`、`disabled`。

### workspaces

保存数据空间，用于用户隔离和后续多项目扩展。

建议字段：

- `id`
- `name`
- `slug`
- `owner_user_id`
- `status`
- `created_at`
- `updated_at`

### workspace_members

保存用户在 workspace 内的角色。

建议字段：

- `id`
- `workspace_id`
- `user_id`
- `role`
- `created_at`
- `updated_at`

角色建议：

- `viewer`
- `editor`
- `admin`
- `owner`

## 3. 内容模型

### content_items

统一保存标题、文案和后续模板。

建议字段：

- `id`
- `workspace_id`
- `content_type`
- `text`
- `summary`
- `status`
- `primary_category_id`
- `account_category_id`
- `source`
- `sort_order`
- `is_deleted`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

说明：

- `content_type`：`title`、`copy`、`template`。
- `status`：`draft`、`pending_review`、`published`、`archived`、`rejected`。
- 星标不建议放在内容主表，因为星标是用户行为；应放在 `favorites`。

### categories

保存主分类。

建议字段：

- `id`
- `workspace_id`
- `category_type`
- `name`
- `slug`
- `sort_order`
- `status`
- `created_at`
- `updated_at`

说明：

- `category_type` 可区分 `title`、`copy`、`template`、`shared`。
- 现有标题分类和文案分类可通过该字段迁移。

### account_categories

保存现有网页中的“账号分类”。

建议字段：

- `id`
- `workspace_id`
- `name`
- `description`
- `sort_order`
- `status`
- `created_at`
- `updated_at`

### tags

保存场景标签。

建议字段：

- `id`
- `workspace_id`
- `name`
- `tag_type`
- `status`
- `created_at`
- `updated_at`

### content_tags

保存内容与标签的多对多关系。

建议字段：

- `id`
- `content_item_id`
- `tag_id`
- `created_at`

## 4. 收藏、历史与生成记录

### favorites

保存用户收藏/星标。

建议字段：

- `id`
- `workspace_id`
- `user_id`
- `content_item_id`
- `favorite_type`
- `created_at`

说明：

- `favorite_type` 初期可用 `star`，后续可扩展收藏夹。
- 列表排序可按 `favorites.created_at desc` 实现“最新星标置顶”。

### usage_events

保存用户行为历史。

建议字段：

- `id`
- `workspace_id`
- `user_id`
- `content_item_id`
- `event_type`
- `event_payload`
- `created_at`

事件类型建议：

- `view`
- `copy`
- `favorite`
- `unfavorite`
- `import`
- `generate`
- `export`

### ai_generation_records

保存 AI 标题/文案生成记录。

建议字段：

- `id`
- `workspace_id`
- `user_id`
- `reference_content_id`
- `prompt`
- `model`
- `provider`
- `input_payload`
- `output_text`
- `status`
- `latency_ms`
- `cost_amount`
- `created_at`

说明：

- API Key、代理地址等敏感配置不进入小程序端，不进入该表明文字段。
- `input_payload` 和 `output_text` 应避免保存隐私或密钥。

## 5. 导入、快照与配置

### import_batches

保存批量导入批次。

建议字段：

- `id`
- `workspace_id`
- `user_id`
- `content_type`
- `raw_count`
- `inserted_count`
- `duplicate_count`
- `status`
- `created_at`

### snapshots

保存管理员快照或系统导出快照。

建议字段：

- `id`
- `workspace_id`
- `snapshot_type`
- `label`
- `payload_ref`
- `created_by`
- `created_at`

说明：

- 大 payload 可存对象存储或服务器文件，数据库只存引用。
- 恢复快照必须走后台确认与审计，不在小程序端开放。

### app_settings

保存 workspace 级系统配置。

建议字段：

- `id`
- `workspace_id`
- `setting_key`
- `setting_value`
- `updated_by`
- `updated_at`

示例配置：

- 默认分类
- 主题/显示配置
- AI 模型开关
- 内容审核开关

## 6. 管理与审计

### audit_logs

保存关键操作审计。

建议字段：

- `id`
- `workspace_id`
- `actor_user_id`
- `action`
- `target_type`
- `target_id`
- `before_data`
- `after_data`
- `ip_hash`
- `user_agent`
- `created_at`

必须记录：

- 登录失败/成功
- 批量导入
- 删除/清空
- 导出
- 快照保存/恢复/删除
- 审核状态变更
- 系统配置变更

## 7. 迁移基准

从当前 Web 版迁移时，需映射：

- `title_categories_v1_${username}` -> `categories`
- `content_categories_v1_${username}` -> `categories`
- `display_settings_v1_${username}` -> `app_settings` 或用户偏好表
- 快照 key `user_${username}_manual_${timestamp}` -> `snapshots`
- 标题/文案本地数据 -> `content_items`
- 星标字段 -> `favorites`
- 场景标签字符串 -> `tags` + `content_tags`

Phase 1 只创建基础表结构和健康检查，不迁移真实数据。

