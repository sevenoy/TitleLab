# Tencent Lighthouse Deployment Plan

当前阶段：Phase 0 - 部署规划，不连接服务器、不部署、不改域名。

## 1. 部署方向

TitleLab 小程序化重建后，后端和管理后台计划部署在腾讯轻量应用服务器。域名规划围绕 `mirroroo.top`、`title.mirroroo.com` 和微信小程序合法域名展开。

本轮仅记录规划，不执行服务器、数据库、Nginx、证书或 DNS 操作。

## 2. 推荐服务形态

- 后端 API：运行在腾讯轻量服务器，提供 HTTPS API。
- 管理后台：可与 API 同域部署，也可独立子路径/子域。
- 数据库：优先选择可备份、可恢复、可迁移的关系型数据库。
- 对象存储/文件：后续用于快照 payload、导出文件或备份，不在 Phase 1 强制引入。

## 3. 域名规划

现有：

- `https://title.mirroroo.com/`：当前线上站点入口。
- `https://sevenoy.github.io/TitleLab/login.html`：GitHub Pages 入口。

未来建议：

- `https://api.mirroroo.top` 或 `https://title-api.mirroroo.top`：小程序后端 API 合法域名候选。
- `https://admin.mirroroo.top` 或 `https://title.mirroroo.com/admin`：管理后台候选。
- `https://title.mirroroo.com`：可保留为 Web 管理或项目说明入口。

实际域名需结合备案主体、证书、Nginx 路由和微信公众平台合法域名配置决定。

## 4. 微信小程序合法域名要求

上线前必须在微信公众平台配置：

- request 合法域名：后端 API HTTPS 域名。
- uploadFile/downloadFile 合法域名：如后续有文件导入导出。
- socket 合法域名：如后续需要实时能力；当前不需要。

注意事项：

- 必须使用 HTTPS。
- 域名需完成备案并与小程序主体合规匹配。
- 不应使用 IP、临时域名或未备案域名作为正式接口域名。
- 开发阶段可以使用开发者工具“不校验合法域名”，但上线前不能依赖该设置。

## 5. 备案与合规注意事项

- 明确小程序服务类目与实际内容管理工具用途一致。
- 隐私政策需说明登录、用户资料、内容数据、使用记录、AI 生成记录的处理方式。
- 用户上传/导入内容如果可能包含个人信息，应提示用户自行确认授权。
- AI 生成能力上线前需评估生成式 AI 服务合规、内容安全审核和提示词/输出留痕。
- 管理端导出功能需限制权限并记录审计。

## 6. 部署阶段计划

Phase 1：

- 本地后端骨架。
- `/healthz` 和 `/api/meta`。
- 数据库基础 migration。
- 不部署生产。

Phase 2：

- 认证、RBAC、用户隔离、基础内容 API。
- 可部署测试环境。

Phase 2.5：

- HTTPS API 测试。
- 小程序合法域名预检查。
- Nginx/证书/备案状态只读确认。

Phase 3：

- 小程序只读 MVP 连接测试 API。

Phase 4：

- CRUD、导入、后台管理和正式部署准备。

## 7. 禁止项

- 本轮不连接服务器。
- 本轮不修改 DNS。
- 本轮不申请或更新证书。
- 本轮不配置 Nginx。
- 本轮不部署。
- 本轮不改生产环境变量。

