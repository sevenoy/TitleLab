# TitleLab Mini Program

当前目录是 Phase 3A 小程序只读 MVP 骨架。

## 当前范围

- 首页展示本地样例标题和文案。
- 支持关键词搜索、类型筛选、分类筛选和标签筛选。
- 详情页展示正文、分类、标签、使用建议和备注。
- 详情页支持复制标题或正文。

## 当前边界

- 数据来自 `services/contentMock.js`。
- 页面通过 `services/contentRepository.js` 读取内容；当前 repository 默认走本地 mock 数据。
- 微信平台能力统一通过 `adapters/wechat.js` 封装，页面不直接散落请求能力。
- 当前不访问网络。
- 当前不连接数据库。
- 当前不包含登录、收藏、历史、导入、快照、AI 或后台能力。
- 当前不包含真实应用标识、前端密钥、令牌或数据库配置。

## Phase 3B 分层

- `config/env.js`：声明当前为 `mock` 模式，real API gate 默认关闭。
- `adapters/wechat.js`：封装导航、剪贴板、提示、网络状态和本地存储适配。
- `services/request.js`：保留只读请求边界，但当前不配置真实域名，也不会发起真实网络访问。
- `services/contentApi.js`：预留后续只读内容接口映射。
- `services/contentRepository.js`：统一内容读取入口，当前默认委托 `contentMock.js`。

## Phase 3C 只读 API envelope 接入

- 当前默认仍为 `mock` 模式，`realApiGateEnabled` 默认关闭。
- 唯一允许的真实 API base 为 `https://api.title.mirroroo.top/api/v1`。
- 真实请求只能通过 `services/request.js` 发起，页面不得直接调用 `wx.request`。
- `services/request.js` 只封装 `GET`，会发送 `X-Request-Id` 并校验 Phase 2C envelope。
- 成功响应只在 `code=OK` 时进入页面渲染；列表读取 `data.items`、`data.limit`、`data.offset`、`data.hasMore`。
- 错误响应统一保留 `code`、`message`、`requestId`、`serverTime`、`version`，由 repository 转为页面可展示错误。
- `services/contentApi.js` 只映射内容列表、内容详情、分类列表和标签列表四个只读 workspace `GET` 路由。
- 小程序端不包含 OpenAI 直连、AppSecret、API key、DB 密码、token 或 cookie。

## Phase 4C auth/session 接入层

- 当前默认仍为 `mock` 模式，`realApiGateEnabled=false`，`authRealApiGateEnabled=false`。
- `services/sessionStore.js` 使用 `titlelab.*` 命名空间保存 session token、用户摘要、workspace 摘要和过期时间。
- `services/authApi.js` 只映射 `POST /api/v1/auth/wechat-login`、`GET /api/v1/auth/me`、`POST /api/v1/auth/logout`。
- `services/authRepository.js` 封装 `loginWithWechat`、`restoreSession`、`getCurrentUser`、`logout` 和 `isAuthenticated`。
- `adapters/wechat.js` 封装 `wx.login`、设备标签和 storage；页面不得直接调用 `wx.login` 或 `wx.request`。
- `services/request.js` 在 gate 显式开启后自动从 `sessionStore` 读取 token 并注入 `Authorization: Bearer <token>`。
- 默认 gate 关闭时不会调用 `wx.login`，不会请求后端，也不会阻断 mock 内容展示。
- 只允许 auth POST；业务内容仍不得新增 `POST`、`PUT`、`PATCH` 或 `DELETE`。
- 真机登录、真实 AppID、合法域名、隐私指引、体验版上传和提审仍必须另起 RELEASE_GATE。

## Phase 4D real auth preflight

Phase 4D 新增本地静态检查脚本：

```bash
python3 scripts/titlelab_phase4d_preflight_check.py
```

该脚本只检查本地文件，不请求后端、不调用微信、不连接数据库、不读取 secret。当前默认 gate 必须保持 `realApiGateEnabled=false` 和 `authRealApiGateEnabled=false`。

真实登录前必须另外完成：

- 微信后台正式 AppID、request 合法域名、隐私保护指引和测试成员检查。
- 后端测试环境、非生产测试数据库、workspace membership 和回滚策略检查。
- `workspaceId` 从 `default` placeholder 替换为已授权 workspace。
- 用户单独授权后才允许上传体验版、提交审核或部署。

## Phase 4E controlled real gate readiness

Phase 4E 新增 `services/realGateGuard.js` 和检查脚本：

```bash
python3 scripts/titlelab_phase4e_real_gate_check.py
```

当前默认仍是 `apiMode=mock`、`realApiGateEnabled=false`、`authRealApiGateEnabled=false`。`workspaceId=default` 在 gate 关闭时仅作为风险项；一旦 real gate 被开启，guard 会要求真实 workspaceId、唯一合法 API base 和 auth readiness，否则 fail-fast，不发起真实请求。

运行时规则：

- 真实请求前必须通过 `realGateGuard.assertRealApiReadiness`。
- `workspaceId=default`、`placeholder`、`demo` 或 `test` 不得用于真实请求。
- auth gate 开启但缺 session readiness 时返回 `REAL_AUTH_SESSION_REQUIRED`。
- 默认 mock 模式不调用 `wx.login`，不访问后端，不阻断本地内容展示。

## 后续接入规则

后续接入真实只读接口必须单独开启 gate，并继续限制在 Phase 2 已验收的只读内容接口和公开 meta 接口内。
