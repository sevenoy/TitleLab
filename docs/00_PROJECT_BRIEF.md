# TitleLab Project Brief

当前阶段：TITLELAB-MINIPROGRAM-PHASE-0-PRD-AND-DATABASE-DESIGN

## 1. 本轮结论

TitleLab 当前是一个 GitHub Pages / 静态网页形态的标题与文案管理工具，线上入口包括 `https://title.mirroroo.com/` 和 `https://sevenoy.github.io/TitleLab/login.html`。现有页面已经覆盖登录、标题库、文案库、分类、账号分类、星标、批量导入、云端同步、快照、管理中心、主题设置和 AI 标题扩写等能力。

小程序化重建不应直接复制静态网页实现，而应先完成用户体系、数据模型、API 边界、后台管理和部署合规规划。本轮只建立 v0.2 需求与技术规划，不开发后端、小程序、数据库 migration 或部署脚本。

## 2. 项目定位

TitleLab 是面向小红书/内容运营场景的标题、文案、模板与生成记录管理系统。重建后的目标形态是：

- 微信小程序：给日常运营用户使用，负责标题/文案检索、收藏、复制、导入、只读或轻量编辑。
- 后台管理端：给管理员维护内容、分类、标签、模板、账号分类、审核状态、系统配置和数据运维。
- 后端 API：负责认证、用户隔离、数据读写、审计、AI 生成记录和后续部署扩展。
- 数据库：替代当前静态页面内 localStorage / Supabase 快照式数据组织，形成可迁移、可审计、可分权限的数据模型。

## 3. 目标用户

- 内容运营者：快速查找标题、文案、场景标签和账号分类，复用历史优质素材。
- 标题/文案整理者：批量导入素材，分类、去重、星标和维护模板。
- 管理员：管理用户、分类、配置、审核状态、快照/导出和危险操作。
- 项目维护者：在腾讯轻量服务器上维护后端、数据库、HTTPS、域名和小程序合法域名。

## 4. 现有网页功能盘点

基于本轮只读页面文件：

- `login.html`：用户名/密码登录、角色字段、登录后跳转标题页；现状为前端内置允许用户列表，重建时必须迁移到后端认证。
- `title.html` / `index.html`：标题管理，含分类、搜索、账号分类、批量导入、新增/编辑/删除、清空、云端同步、立即拉取、快照、星标、AI 标题扩写入口。
- `content.html`：文案管理，结构与标题管理相似，含文案内容、主分类、账号分类、场景标签、星标、批量导入和云端同步。
- `admin-center.html`：管理中心，含数据概览、账号管理、云端快照、导出 CSV/JSON、去重、归一化、分类复制、重置分类、危险清空操作、PWA 缓存清理。
- `settings.html`：主题设置，含主题风格、自定义颜色、顶部标题、导出/导入设置、恢复默认。
- `manifest.webmanifest` / `sw.js`：当前 Web 版有 PWA 离线缓存、安装图标、独立窗口和网络优先缓存策略。
- `USER_ISOLATION_CHECK.md`：现有实现强调标题分类、文案分类、显示设置、快照按用户隔离。
- `CHANGELOG.md`：近期重点包括用户隔离、云端快照、星标置顶、PWA 更新、移动端适配、管理页优化、导出和去重。

## 5. 小程序化重建目标

- 保留当前有效业务概念：标题、文案、分类、账号分类、场景标签、星标、导入、快照、主题/显示设置、AI 标题仿写。
- 用后端认证替代前端硬编码账号。
- 用关系型数据表替代浏览器 localStorage key 与快照 payload 作为主要数据源。
- 小程序端优先做高频使用闭环：登录、标题/文案浏览、搜索筛选、收藏/星标、复制、历史记录、只读 MVP。
- 管理后台保留批量导入、审核、配置、导出、去重、危险操作确认和审计。
- 部署方向保持腾讯轻量服务器，域名规划锁定为 `title.mirroroo.top`、`api.title.mirroroo.top`、`admin.title.mirroroo.top` 和微信小程序合法域名。
- `title.mirroroo.com` 和 GitHub Pages 只作为历史入口 / 迁移参考，不作为新生产主域。

## 6. Phase 0.6 经验与合规基线

TitleLab 必须在 Phase 1 后端开发前完成 Phase 0.6：Domain & Compliance Lock。

后续所有 Phase 必须先读取：

- `docs/09_PHASE_EXECUTION_PLAN.md`
- `docs/10_NUMHUB_LESSONS_FOR_TITLELAB.md`
- `docs/11_DOMAIN_AND_COMPLIANCE_LOCK.md`

强制规则：

- TitleLab API 只能使用 `api.title.mirroroo.top`。
- TitleLab Admin 只能使用 `admin.title.mirroroo.top`。
- TitleLab Web 只能使用 `title.mirroroo.top`。
- 禁止使用 `api.mirroroo.top`、NumHub 域名、主站域名或 `title-api.mirroroo.top` 作为 TitleLab 生产域名。
- 不允许把“能访问”当成“能上线”。
- 不允许在 RELEASE_GATE 前上传体验版、提审或部署。

## 7. Phase 0 边界

本轮只允许完成需求和规划文档：

- 不写业务代码。
- 不创建后端服务。
- 不创建小程序页面。
- 不创建数据库 migration。
- 不新增依赖。
- 不连接服务器、数据库或生产环境。
- 不 push，不 commit。
