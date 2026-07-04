# TitleLab Phase 4E Controlled Real Gate Readiness

当前阶段：TITLELAB-PHASE4E-CONTROLLED-REAL-GATE-READINESS

本文固化真实 API / Auth gate 的打开条件。本阶段不打开真实 gate，不默认真实请求，不部署、不上传体验版、不提审、不真实调用微信、不连接真实数据库、不接 OpenAI。

## 1. Controlled real gate 设计

Phase 4E 在小程序端增加 `realGateGuard`：

- `validateRealApiReadiness(config)`
- `assertRealApiReadiness(config)`
- `isPlaceholderWorkspaceId(workspaceId)`
- `normalizeGateError(error)`

真实请求只能在 guard 通过后由 `miniprogram/services/request.js` 发起。guard 不通过时 fail-fast，返回稳定错误，不触发网络请求。

## 2. workspaceId 要求

`workspaceId` 不得为：

- 空字符串
- `default`
- `placeholder`
- `demo`
- `test`
- `workspace-placeholder`
- `workspace_id`

当前默认值仍可保持 `default`，因为默认 gate 关闭；但只要 `realApiGateEnabled` 开启，`default` 必须失败为 `REAL_WORKSPACE_REQUIRED`。真实 gate 前必须替换为已授权 workspace，并确认后端 `workspace_members` 有对应测试成员。

## 3. realApiGateEnabled 开启条件

开启前必须同时满足：

- `apiMode=real`
- `realApiGateEnabled=true`
- `apiBaseUrl=https://api.title.mirroroo.top/api/v1`
- `workspaceId` 为非 placeholder 的真实 workspace
- 页面无直接 `wx.request`
- 真实请求仍统一走 `services/request.js`
- 不新增业务 `POST`、`PUT`、`PATCH`、`DELETE`

## 4. authRealApiGateEnabled 开启条件

开启前必须同时满足：

- real API gate 已满足全部条件
- `authRealApiGateEnabled=true`
- 后端测试环境已准备 auth endpoints
- 微信 code exchange 只在服务端执行，小程序端不包含 AppSecret
- `POST /api/v1/auth/wechat-login`、`GET /api/v1/auth/me`、`POST /api/v1/auth/logout` 均通过测试环境验收
- 需要 session 的 auth 请求必须有 session token，否则 fail-fast 为 `REAL_AUTH_SESSION_REQUIRED`

## 5. 合法域名要求

唯一允许：

- `https://api.title.mirroroo.top`
- `https://api.title.mirroroo.top/api/v1`

禁止使用：

- `api.mirroroo.top`
- `num.mirroroo.top`
- `api.num.mirroroo.top`
- `mirroroo.top`
- `www.mirroroo.top`
- `admin.mirroroo.top`
- `title-api.mirroroo.top`
- Cloudflare preview / workers / pages 临时域名

## 6. AppID / 微信后台 / 隐私指引 / 测试成员人工 gate

打开真实 gate 前必须人工确认：

- 正式 AppID 已经由用户授权使用。
- `project.private.config.json` 未被提交。
- 微信后台 request 合法域名包含 `https://api.title.mirroroo.top`。
- `urlCheck=true`。
- 隐私保护指引覆盖 `wx.login`、用户标识和后端 session 用途。
- 测试成员已配置，并可在异常时撤销。
- 体验版上传、提交审核、发布均需后续单独授权。

## 7. 后端测试环境要求

- `/healthz` 保持 public raw。
- `/api/meta` 保持 public envelope。
- Auth endpoints 不返回敏感配置。
- session token 明文只在登录响应返回一次；后端只保存 hash。
- 测试环境必须使用非生产数据库。
- Phase 4E 不连接任何真实数据库，不执行真实数据库 migration。

## 8. 回滚方式

最小回滚：

- `apiMode` 恢复或保持 `mock`。
- `realApiGateEnabled=false`。
- `authRealApiGateEnabled=false`。
- 小程序继续展示本地 mock 内容。
- 若已存在本地 session，可清理本地 session storage，但不得清理远端真实数据。

## 9. 禁止项

Phase 4E 禁止：

- 部署、发布、上传体验版、提交审核。
- 真实调用微信 `jscode2session` 或微信线上接口。
- 连接生产、远程、腾讯云、Supabase 或任何真实数据库。
- 对真实数据库执行 migration。
- 小程序直连 OpenAI 或调用 `api.openai.com`。
- 写入真实 AppSecret、API key、DB 密码、token、cookie。
- 修改服务器、Nginx、DNS、Cloudflare、腾讯云控制台配置。
- 把 `realApiGateEnabled` 或 `authRealApiGateEnabled` 默认改成 true。
- 把 `workspaceId=default` 用于真实请求。

## 10. 自动检查命令

```bash
python3 scripts/titlelab_phase4d_preflight_check.py
python3 scripts/titlelab_phase4e_real_gate_check.py
```

Phase 4E preflight 必须确认：

- gate 关闭 + `workspaceId=default` 是 PASS with risk。
- gate 开启 + `workspaceId=default` 是 FAIL。
- gate 开启 + 非允许 base URL 是 FAIL。
- auth gate 开启 + 缺 session readiness 是 FAIL。
- 页面不直接调用 `wx.request` 或 `wx.login`。
- `project.private.config.json` 未被 git 跟踪。

## 11. 下一阶段建议

Phase 4F 或 Phase 4E-REAL-TEST 可在用户单独授权后，只针对非生产测试环境、测试成员和真实 workspace 做 controlled real gate enable。若优先推进 AI，则进入 Phase 5 AI Facade，并继续禁止小程序直连 OpenAI。
