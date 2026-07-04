# TitleLab Phase 4D Real Auth Preflight Checklist

当前阶段：TITLELAB-PHASE4D-REAL-AUTH-PREFLIGHT-HARNESS

本文是打开真实 API / 微信登录 gate 前的自动检查和人工清单。本阶段不部署、不上传体验版、不提审、不真实调用微信、不连接真实数据库、不执行真实数据库 migration、不接 OpenAI。

## 1. 本阶段目标

- 建立本地静态 preflight harness：`python3 scripts/titlelab_phase4d_preflight_check.py`。
- 确认小程序默认仍为 mock，`realApiGateEnabled=false`，`authRealApiGateEnabled=false`。
- 确认真实 API base 只能是 `https://api.title.mirroroo.top/api/v1`。
- 确认页面不直接调用 `wx.request` 或 `wx.login`。
- 确认只允许 auth login/logout POST，不新增业务写接口。
- 把 workspaceId、AppID、合法域名、隐私指引和测试成员作为下一阶段手工 gate。

## 2. 真实登录前置条件

真实登录只能在后续单独授权的 RELEASE_GATE 中打开，并且必须先确认：

- 后端测试环境已经部署到 TitleLab 专属 API 域名。
- 后端使用非生产、可回滚、可清理的测试数据库。
- 微信 code exchange 已使用受管服务端配置，不在小程序端保存 AppSecret。
- `workspaceId` 已从 `default` placeholder 替换为真实授权 workspace。
- 测试用户已经在后端 workspace membership 中授权。
- 回滚方式已经明确，可以关闭 `authRealApiGateEnabled` 并恢复 mock 入口。

## 3. 微信公众平台检查项

- 使用正式小程序 AppID；不得在代码、docs 或日志中记录 AppSecret。
- 微信后台 request 合法域名包含且仅使用 TitleLab API 域名：`https://api.title.mirroroo.top`。
- 体验版前确认 `urlCheck=true`。
- 测试成员名单已配置并可撤销。
- 客服、服务类目、隐私保护指引和用户协议入口满足审核要求。
- 不配置无关 uploadFile、downloadFile、socket、udp 或 tcp 域名，除非后续 Phase 明确需要。

## 4. 合法域名检查项

允许：

- `https://api.title.mirroroo.top`
- `https://api.title.mirroroo.top/api/v1`

禁止：

- `api.mirroroo.top`
- `num.mirroroo.top`
- `api.num.mirroroo.top`
- `mirroroo.top`
- `www.mirroroo.top`
- `admin.mirroroo.top`
- `title-api.mirroroo.top`
- Cloudflare preview / workers / pages 临时域名

## 5. AppID 与 project.config.json 风险

- `miniprogram/project.config.json` 可由微信开发者工具维护，但 AppID 变更必须单独 gate。
- `miniprogram/project.private.config.json` 是本机私有文件，不得提交。
- 上传私钥路径、测试账号、真实 AppSecret 和密钥材料不得写入仓库。
- DevTools 导入路径应固定为 `miniprogram/`。

## 6. 隐私保护指引检查项

真实登录前必须核对小程序实际调用能力与隐私指引一致：

- `wx.login` 用途说明。
- 用户标识、头像/昵称字段是否采集。
- 后端保存 session token hash，不保存明文 token。
- 日志不打印 token、cookie、AppSecret、API key 或 DB 密码。
- 页面有可访问的隐私说明入口。

## 7. 测试成员 / 体验版检查项

- Phase 4D 不上传体验版。
- 后续如上传体验版，必须记录版本号、commit hash、测试成员、真机型号、测试结论和回滚策略。
- 体验版必须先通过小程序 JSON/JS 检查、preflight 脚本、后端 pytest 和合法域名核对。
- 上传体验版、提交审核和发布必须分别获得用户明确授权。

## 8. 后端测试环境检查项

- `/healthz` 保持 public raw，不包含敏感配置。
- `/api/meta` 保持 public envelope，不包含敏感配置。
- Auth endpoints 仅允许：
  - `POST /api/v1/auth/wechat-login`
  - `GET /api/v1/auth/me`
  - `POST /api/v1/auth/logout`
- Readonly workspace APIs 优先支持 `Authorization: Bearer <token>`。
- `X-TitleLab-User-Id` 仅可作为 local/dev/test fallback，不能作为生产认证。
- 后端测试数据库必须是本地或明确授权的非生产测试库；Phase 4D 不连接任何真实数据库。

## 9. workspaceId 替换策略

当前 `miniprogram/config/env.js` 中的 `workspaceId` 仍是 `default` placeholder。preflight 会把它报告为风险，但不作为失败。

后续打开真实 gate 前必须：

- 由后端或配置提供真实 workspace id。
- 确认该 workspace 已绑定测试用户 membership。
- 避免把 workspace id 写死到多个页面。
- 若需要临时配置，应只进入受控测试配置，不进入公开文档或截图。

## 10. 回滚策略

最小回滚方式：

- 将 `apiMode` 保持或恢复为 `mock`。
- 保持 `realApiGateEnabled=false`。
- 保持 `authRealApiGateEnabled=false`。
- 保留 mock 内容展示，避免登录失败阻断只读演示。
- 如真实测试环境异常，先关闭 gate，再分析后端日志和 requestId。

## 11. 禁止项

Phase 4D 明确禁止：

- 部署、发布、上传体验版、提交审核。
- 真实调用微信 `jscode2session` 或微信线上接口。
- 连接生产、远程、腾讯云、Supabase 或任何真实数据库。
- 对真实数据库执行 migration。
- 小程序直连 OpenAI 或调用 `api.openai.com`。
- 读取、打印或写入真实 AppSecret、API key、DB 密码、token、cookie。
- 修改服务器、Nginx、DNS、Cloudflare、腾讯云控制台配置。
- 打开 `realApiGateEnabled` 或 `authRealApiGateEnabled` 的默认值。

## 12. 自动检查命令

```bash
python3 scripts/titlelab_phase4d_preflight_check.py
```

该脚本只做本地静态检查，不发起外部网络请求，不读取 secret 值，不连接数据库。

## 13. 下一阶段建议

- Phase 4E：controlled real API gate enable，只在明确授权的测试环境中打开真实登录和真实只读 API gate。
- Phase 5：AI Facade 设计与后端代理，继续禁止小程序直连 OpenAI。
