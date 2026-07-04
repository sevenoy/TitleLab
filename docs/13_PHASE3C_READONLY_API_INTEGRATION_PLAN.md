# TitleLab Phase 3C Readonly API Integration Plan

当前阶段：TITLELAB-PHASE-3C-READONLY-API-INTEGRATION-PLAN

本文只为小程序真实只读 API 接入做计划和文件清单确认。本轮不开发接入代码，不配置真实 API 域名，不打开 real API gate，不连接后端 API，不连接数据库，不部署，不上传体验版，不 push。

## 1. 当前红线

- Phase 3C 仍必须在独立 worktree `phase3-miniprogram-readonly-mvp` 中进行，不得在 main 主仓库直接开发。
- 真实 API 只能使用 `https://api.title.mirroroo.top`，生产 API base 只能是 `https://api.title.mirroroo.top/api/v1`。
- 禁止使用 `api.mirroroo.top`、NumHub 域名、主站域名或历史 GitHub Pages 入口作为 TitleLab API。
- 页面不得直接 wx.request；真实请求必须统一走 `miniprogram/services/request.js`。
- 小程序不得直连 OpenAI；AI Key、AppSecret、API key、DB 密码、token、cookie 不得进入小程序或 docs。
- Phase 3C 只允许只读内容 API 和公开 meta 接口，不得新增写接口，不得新增登录、收藏、历史、AI、导入、快照执行或后台页面。
- 上传体验版、提审、发布、部署、DNS、Nginx、服务器、生产环境变量和数据库操作仍属于后续 RELEASE_GATE，必须单独授权。

## 2. 当前后端只读 API 清单

后端 Phase 2A / Phase 2B 当前只允许以下 workspace 级 `GET` 路由：

| 接口 | 当前用途 | 当前响应 |
| --- | --- | --- |
| `GET /api/v1/workspaces/{workspace_id}/contents` | 内容列表 | `ContentItemOut[]` |
| `GET /api/v1/workspaces/{workspace_id}/contents/{content_id}` | 内容详情 | `ContentItemOut` |
| `GET /api/v1/workspaces/{workspace_id}/categories` | 分类列表 | `CategoryOut[]` |
| `GET /api/v1/workspaces/{workspace_id}/tags` | 标签列表 | `TagOut[]` |

内容列表当前查询参数：

- `content_type`
- `category_id`
- `tag_id`
- `q`
- `limit`
- `offset`

当前契约已通过 `backend/tests/test_phase2b_contract.py` 锁定：OpenAPI 只暴露上述四个 workspace `GET` 路由，不暴露 `POST`、`PUT`、`PATCH`、`DELETE`。

## 3. 当前响应模型

`ContentItemOut` 当前字段：

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
- `created_at`
- `updated_at`

`CategoryOut` 当前字段：

- `id`
- `workspace_id`
- `category_type`
- `name`
- `slug`
- `sort_order`
- `status`
- `created_at`
- `updated_at`

`TagOut` 当前字段：

- `id`
- `workspace_id`
- `name`
- `tag_type`
- `status`
- `created_at`
- `updated_at`

## 4. 小程序 service / adapter / repository 现状

当前小程序已经完成 Phase 3B 分层：

- `miniprogram/config/env.js` 默认 `mock` 模式，`realApiGateEnabled` 为 `false`，`apiBaseUrl` 为空。
- `miniprogram/adapters/wechat.js` 封装导航、剪贴板、toast、网络状态和本地 storage。
- `miniprogram/services/request.js` 只保留只读请求边界；当前 real API gate 关闭，不发起真实网络访问。
- `miniprogram/services/contentApi.js` 预留后续只读内容接口映射。
- `miniprogram/services/contentRepository.js` 是页面内容读取入口，当前默认委托 `contentMock.js`。
- `miniprogram/services/contentMock.js` 提供 4 条本地 mock 内容和本地搜索、类型、分类、标签筛选。
- `pages/index/index.js` 和 `pages/detail/detail.js` 已通过 repository 读取内容；页面不直接依赖后端 API。

## 5. mock 到 real API 的切换方案

Phase 3C 实现时建议按最小步骤推进：

1. 在 `env.js` 中新增受控 real 配置，但默认仍保持 mock；只有明确实施轮次才允许设置 `apiMode`、`realApiGateEnabled` 和 `apiBaseUrl`。
2. `request.js` 负责所有真实请求、只读方法、URL 拼接、超时、响应解包、错误归一化和 requestId 提取。
3. `contentApi.js` 只映射 Phase 2 / Phase 2C 已验收的只读路由，不新增写方法。
4. `contentRepository.js` 继续保留 mock/real 双通道，页面只依赖 repository，不直接关心网络层。
5. 首页和详情页仅在必要时处理 `loading`、`error`、`empty` 状态，不做 UI 大改版。
6. 若后端响应仍是裸数组或裸对象，Phase 3C 不应在页面层硬绕；应先完成 Phase 2C API response contract，或在 `request.js` 中明确兼容策略并写入文档。

## 6. API response contract 差距

当前后端实际响应与 `docs/12` 建议的统一响应包存在差距：

```ts
type ApiResponse<T> = {
  code: string;
  message: string;
  data?: T;
  requestId: string;
  serverTime: string;
  version?: string;
};
```

当前差距：

- 列表接口当前直接返回数组，不包含 `code`、`message`、`data`、`requestId`、`serverTime`。
- 详情接口当前直接返回对象，不包含统一响应包。
- 列表接口有 `limit` 和 `offset`，但响应体没有分页元信息、下一页游标或总数。
- 内容对象有 `updated_at`，但没有单独的资源 `version` 字段。
- 分类和标签对象没有面向小程序筛选控件的统一 label/value 映射。
- 错误响应虽然测试中期望 `message`，但尚未形成完整的前端错误码到 UI 状态契约。

因此建议先做 Phase 2C API response contract，再进入真实 API 接入。若用户明确要求跳过 Phase 2C，则 Phase 3C 实现必须在 `request.js` 明确支持当前裸响应，并把该兼容作为临时方案记录在 README 和 handoff。

## 7. requestId / serverTime / version 处理建议

- `requestId`：每个成功和失败响应都应携带；小程序错误态只显示简短提示，不展示敏感详情，可在本地调试日志中保留 requestId。
- `serverTime`：用于判断服务端响应时间、排查缓存和后续同步问题。
- `version`：内容详情建议有资源版本；若 Phase 2C 暂时不新增字段，Phase 3C 可先使用 `updated_at` 作为只读展示层的临时版本依据。
- 分页：列表响应建议补充 `limit`、`offset`、`nextOffset` 或 `cursor`，避免后续列表数据增长后只能全量拉取。

## 8. 错误码到 UI 状态映射建议

| 错误码 / 状态 | 小程序 UI 建议 | 备注 |
| --- | --- | --- |
| `NETWORK_ERROR` | 展示网络异常和重试入口 | 由 `request.js` 归一化 |
| `REAL_API_GATE_CLOSED` | 进入本地 mock 或阻断真实请求 | 不应进入生产包 |
| `UNAUTHORIZED` | 展示未登录或未开通访问权限 | 登录属于后续 Phase |
| `FORBIDDEN_WORKSPACE` | 展示 workspace 无权限 | 不暴露其他 workspace 信息 |
| `CONTENT_NOT_FOUND` | 详情页展示内容不存在 | 对应当前 `content_not_found` |
| `VALIDATION_ERROR` | 保持当前筛选条件并提示参数异常 | 不在页面拼接复杂错误 |
| `SERVER_ERROR` | 展示服务暂不可用 | 保留 requestId 便于排查 |

页面状态建议只做最小 `loading`、`error`、`empty`，不做视觉改版。

## 9. 合法域名和 AppID 风险

- 当前真实 API 域名规划为 `https://api.title.mirroroo.top`，但本轮不配置真实域名，不验证公网连通性。
- 微信后台 request 合法域名必须包含 `https://api.title.mirroroo.top`，体验版前必须确认 `urlCheck=true`。
- `miniprogram/project.config.json` 由 DevTools 管理，Phase 3C 不应顺手修改 AppID 或上传配置。
- `miniprogram/project.private.config.json` 是本机私有配置，必须继续忽略，不得提交。
- 若 AppID、合法域名、隐私指引或体验版上传进入任务范围，应升级为 RELEASE_GATE。

## 10. Phase 3C 允许修改文件清单

下一轮 Phase 3C-IMPLEMENT 建议仅允许修改：

- `miniprogram/config/env.js`
- `miniprogram/services/request.js`
- `miniprogram/services/contentApi.js`
- `miniprogram/services/contentRepository.js`
- `miniprogram/pages/index/index.js`，仅当必须处理 loading / error / empty
- `miniprogram/pages/detail/detail.js`，仅当必须处理 loading / error / empty
- `miniprogram/README.md`
- `docs/08_HANDOFF.md`

如果先执行 Phase 2C，则 Phase 2C 应另开独立后端 worktree，不应在本 Phase 3 worktree 中修改 backend。

## 11. Phase 3C 禁止修改文件清单

下一轮 Phase 3C-IMPLEMENT 禁止修改：

- `backend/**`
- `miniprogram/project.config.json`
- `miniprogram/project.private.config.json`
- `assets/**`
- `icon/**`
- 现有 Web/PWA HTML/CSS/JS
- 生产环境变量
- 服务器、Nginx、DNS、Cloudflare、腾讯云控制台配置
- 数据库 migration、Alembic 配置或真实数据库数据

## 12. 真实 API 接入前置条件

- 后端 API response contract 已明确，建议先完成 Phase 2C。
- 真实 API base 只能是 `https://api.title.mirroroo.top/api/v1`。
- 真实请求必须走 `miniprogram/services/request.js`。
- 页面不得直接 wx.request。
- real API gate 必须显式开启，且默认状态仍应安全。
- 只允许接入四个只读 workspace `GET` 路由和公开 `GET /api/meta`。
- 小程序不得直连 OpenAI。
- 不得新增写接口，不得新增登录、收藏、历史、AI、导入、快照执行或后台页面。
- 不得上传体验版、提交审核、部署或连接数据库。

## 13. 是否建议先做 Phase 2C

建议先做 Phase 2C API response contract。

原因：

- 当前后端只读 API 契约已经稳定，但仍是裸对象和裸数组响应。
- `requestId`、`serverTime`、统一错误码、分页元信息和资源版本对小程序真实接入、排障和后续同步很关键。
- 如果 Phase 3C 直接接裸响应，后续再切统一响应包会二次改动 `request.js`、`contentApi.js` 和页面错误态。

Phase 2C 应只做契约和测试，不做写接口、不做小程序页面、不连接生产数据库、不部署。

## 14. Phase 3C-IMPLEMENT 命令草案

```text
项目路径：
/Users/lorenmac/Claude/Projects/TitleLab-worktrees/phase3-miniprogram-readonly-mvp

当前目标：
在 Phase 3 worktree 中最小实现小程序真实只读 API 接入。只允许接入已验收的只读 GET 接口；默认 gate 仍安全，不做 UI 改版，不新增页面，不接 OpenAI，不做写接口，不上传体验版，不 push。

当前阶段：
TITLELAB-PHASE-3C-READONLY-API-INTEGRATION-IMPLEMENT

执行前必须读取：
- docs/09_PHASE_EXECUTION_PLAN.md
- docs/10_NUMHUB_LESSONS_FOR_TITLELAB.md
- docs/11_DOMAIN_AND_COMPLIANCE_LOCK.md
- docs/12_NUM_MINIPROGRAM_FULL_PROCESS_LESSONS_FOR_TITLELAB.md
- docs/13_PHASE3C_READONLY_API_INTEGRATION_PLAN.md
- docs/08_HANDOFF.md

允许修改文件：
- miniprogram/config/env.js
- miniprogram/services/request.js
- miniprogram/services/contentApi.js
- miniprogram/services/contentRepository.js
- miniprogram/pages/index/index.js，如必须处理 loading/error/empty
- miniprogram/pages/detail/detail.js，如必须处理 loading/error/empty
- miniprogram/README.md
- docs/08_HANDOFF.md

禁止：
- 修改 backend/**
- 修改 miniprogram/project.config.json 或 project.private.config.json
- 页面直接 wx.request
- 小程序直连 OpenAI
- 新增 POST/PUT/PATCH/DELETE
- 配置禁用域名
- 上传体验版、部署、push、连接数据库

停止条件：
- 页面无直接 wx.request
- 真实请求统一走 services/request.js
- API base 只允许 api.title.mirroroo.top
- git diff --check 通过
- 最终 git status 干净
```
