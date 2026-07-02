# TitleLab Domain & Compliance Lock

当前阶段：TITLELAB-PHASE-0-6-NUMHUB-LESSONS-DOMAIN-COMPLIANCE-WORKTREE-LOCK

## 1. 目标

Phase 0.6 必须在 Phase 1 后端开发前完成。本文件锁定 TitleLab 的域名隔离、微信合法域名、HTTPS、备案、隐私、服务器分流、API_BASE、release gate 和危险操作边界。

本文件只做规划与门禁，不执行 DNS、Nginx、Certbot、服务器、数据库、部署、体验版上传或提审。

## 2. 正式域名表

| 用途 | 正式域名 |
| --- | --- |
| TitleLab Web | `https://title.mirroroo.top` |
| TitleLab API | `https://api.title.mirroroo.top` |
| TitleLab Admin | `https://admin.title.mirroroo.top` |

历史入口：

- `https://title.mirroroo.com/` 只作为历史入口 / 迁移参考。
- `https://sevenoy.github.io/TitleLab/login.html` 只作为历史入口 / 迁移参考。

## 3. 禁止使用域名表

TitleLab 禁止使用：

- `api.mirroroo.top`
- `num.mirroroo.top`
- `api.num.mirroroo.top`
- `mirroroo.top`
- `www.mirroroo.top`
- `admin.mirroroo.top`
- `title-api.mirroroo.top`

归属说明：

- `mirroroo.top` / `www.mirroroo.top` 保留给个人主站、博客、导航。
- `num.mirroroo.top` / `api.num.mirroroo.top` 属于 NumHub。
- `api.mirroroo.top` 暂不分配给具体项目，未来可作为统一 API Gateway。
- 不允许多个项目共用一个具体项目 API 域名。

## 4. DNS 与 API_BASE Gate

TitleLab API 只能使用：

```text
https://api.title.mirroroo.top
```

生产 API_BASE 只能使用：

```text
https://api.title.mirroroo.top/api/v1
```

RELEASE_GATE 前必须确认：

- 小程序不引用 `api.mirroroo.top`。
- 小程序不引用 NumHub 域名。
- 小程序不引用历史 GitHub Pages 入口作为生产 API。
- `urlCheck=true`。
- API_MODE 不停留在 `local-mock`。

## 5. Nginx 与 Server Gate

后续部署时必须按子域名拆 server block：

- `title-web.conf` -> `title.mirroroo.top`
- `title-api.conf` -> `api.title.mirroroo.top`
- `title-admin.conf` -> `admin.title.mirroroo.top`

禁止：

- 默认站点兜底到 TitleLab。
- 默认站点兜底到其他项目。
- 多个项目共用一个 server block。
- `server_name _;` 承接项目生产流量。

## 6. HTTPS Gate

每个正式域名必须分别验证 HTTPS 和证书 SAN：

- `title.mirroroo.top`
- `api.title.mirroroo.top`
- `admin.title.mirroroo.top`

HTTPS 正常不等于可以上线。还必须通过微信合法域名、备案、隐私、production smoke 和 release gate。

## 7. WeChat Release Gate

上线前必须确认：

- 使用正式 AppID。
- `urlCheck=true`。
- request 合法域名为 `https://api.title.mirroroo.top`。
- 小程序无测试登录入口。
- 小程序无 mock 用户按钮。
- 小程序无 AppSecret、AI Key、DB 密码、token、cookie。
- 有隐私说明入口。
- 有备案/合规展示策略。
- production smoke 通过。
- 用户明确授权上传体验版。

Phase 8 只能做 release-prep，禁止上传体验版、提审、部署。Phase 9 才是 RELEASE_GATE，但仍需用户明确授权才允许上传、提审或部署。

## 8. Login Formalization Gate

TitleLab 小程序登录必须走正式后端认证和 workspace 授权。

禁止：

- 前端硬编码账号。
- 测试登录按钮。
- mock 用户按钮。
- 把测试账号写入小程序、docs、git、README、截图或日志。

未授权用户应看到：

```text
当前微信暂未开通访问权限，请联系管理员开通。
```

## 9. Workspace Isolation Gate

workspace 是数据库生命线。

必须遵守：

- 所有业务表必须有 workspace 边界。
- 所有业务查询必须限定 workspace。
- 后台跨 workspace 查询必须显式授权。
- 禁止后期再补 workspace。

## 10. Import Preview Gate

导入必须：

```text
preview -> confirm
```

快照恢复默认只预览。小程序端不允许清空、批量删除、快照恢复、导出全部数据或修改系统配置。

## 11. AI Secret Safety Gate

AI Key 永远不进入前端或小程序端。

AI 生成必须：

- 走后端代理。
- 保存到 `ai_generation_records`。
- release gate 检查小程序端没有任何 secret。
- production smoke 不打印 token、password、key。

## 12. Release Boundary

默认禁止：

- 上传体验版。
- 提审。
- 部署。
- 修改 DNS。
- 修改 Nginx。
- 申请证书。
- 连接生产数据库。
- production migration。

只有 Phase 9 RELEASE_GATE 且用户明确授权，才允许逐项执行。

