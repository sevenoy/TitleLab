# TitleLab Acceptance Checklist

当前阶段：Phase 0 - 文档验收清单。

## Phase 0 文档验收

- [x] 已确认项目路径为 `/Users/lorenmac/Claude/Projects/TitleLab`。
- [x] 已确认 Git remote 指向 `sevenoy/TitleLab`。
- [x] 已只读检查现有根目录页面与 PWA 文件。
- [x] 已新增 Phase 0 文档。
- [x] 已记录现有 Web 功能盘点。
- [x] 已记录小程序端功能规划。
- [x] 已记录后台管理端功能规划。
- [x] 已记录用户体系和权限原则。
- [x] 已记录标题/文案/内容数据模型。
- [x] 已记录分类/标签/模板体系。
- [x] 已记录收藏/历史/生成记录。
- [x] 已记录数据库表设计。
- [x] 已记录 API 模块设计。
- [x] 已记录腾讯轻量服务器部署方向。
- [x] 已记录 mirroroo.top / title.mirroroo.com / 小程序合法域名规划。
- [x] 已记录备案、隐私、微信小程序合规注意事项。
- [x] 已记录 Phase 0 到 Phase 4 路线和验收标准。

## Phase 0.6：Domain & Compliance Lock

- [ ] `docs/10_NUMHUB_LESSONS_FOR_TITLELAB.md` 已纳入强制经验基线。
- [ ] `docs/11_DOMAIN_AND_COMPLIANCE_LOCK.md` 已锁定域名、合法域名、server gate 和 release gate。
- [ ] `docs/09_PHASE_EXECUTION_PLAN.md` 已补充 Phase 0.6。
- [ ] 后续所有 Phase 开始前必须读取 `docs/09_PHASE_EXECUTION_PLAN.md`、`docs/10_NUMHUB_LESSONS_FOR_TITLELAB.md`、`docs/11_DOMAIN_AND_COMPLIANCE_LOCK.md`。

## Domain Isolation Gate

- [ ] `title.mirroroo.top` 已锁定为 TitleLab Web。
- [ ] `api.title.mirroroo.top` 已锁定为 TitleLab API。
- [ ] `admin.title.mirroroo.top` 已锁定为 TitleLab Admin。
- [ ] 禁止使用 `api.mirroroo.top` 作为 TitleLab API。
- [ ] 禁止复用 NumHub 域名。
- [ ] `mirroroo.top` / `www.mirroroo.top` 保留给主站。

## WeChat Release Gate

- [ ] 正式 AppID 已配置。
- [ ] `urlCheck=true`。
- [ ] request 合法域名为 `https://api.title.mirroroo.top`。
- [ ] 小程序无测试登录入口。
- [ ] 小程序无 AppSecret、API Key、DB 密码、token、cookie。
- [ ] 隐私说明入口已准备。
- [ ] 备案/合规展示策略已准备。
- [ ] production smoke 通过。
- [ ] 用户明确授权上传体验版。

## Server Gate

- [ ] `title.mirroroo.top` HTTPS 正常。
- [ ] `api.title.mirroroo.top` HTTPS 正常。
- [ ] `admin.title.mirroroo.top` HTTPS 正常。
- [ ] `/healthz` 返回正常。
- [ ] `/api/meta` 不暴露敏感信息。
- [ ] Nginx server block 不混用。
- [ ] Certbot SAN 正确。

## API_BASE Gate

- [ ] `PROD_API_BASE` 为 `https://api.title.mirroroo.top/api/v1`。
- [ ] 不引用 `api.mirroroo.top`。
- [ ] 不引用 NumHub 域名。
- [ ] 不引用历史 GitHub Pages 入口作为生产 API。
- [ ] API_MODE 不停留在 `local-mock`。

## Workspace Isolation Gate

- [ ] workspace 是数据库生命线。
- [ ] 所有业务表有 workspace 边界。
- [ ] 所有业务查询限定 workspace。
- [ ] 后台跨 workspace 查询必须显式授权。
- [ ] 禁止后期再补 workspace。

## AI Secret Safety Gate

- [ ] AI Key 不进入前端或小程序端。
- [ ] AI 生成走后端代理。
- [ ] AI 生成记录保存到 `ai_generation_records`。
- [ ] production smoke 不打印 token、password、key。

## Import Preview Gate

- [ ] 导入必须 `preview -> confirm`。
- [ ] 快照恢复默认只预览。
- [ ] 小程序端不做清空、批量删除、快照恢复、导出全部数据、系统配置修改。

## Branch & Worktree Gate

- [ ] Phase 0 / 0.5 / 0.6 只允许在 main 修改 docs。
- [ ] Phase 1+ 禁止直接在 main 开发。
- [ ] Phase 1+ 必须使用独立 branch 和独立 worktree。
- [ ] 不允许多个 Phase 共用一个 worktree。
- [ ] 不允许自动 merge。
- [ ] 不允许自动 push。

## Phase 1 验收标准

- [ ] 后端骨架可本地启动。
- [ ] `/healthz` 返回服务存活状态。
- [ ] `/api/meta` 返回公开版本与环境信息，不含 secret。
- [ ] 基础 migration 可在本地空库执行。
- [ ] `.env.example` 只含占位符，不含真实密钥。
- [ ] README 或 handoff 写明本地启动命令。

## Phase 2 验收标准

- [ ] 用户认证可用。
- [ ] workspace 和成员角色可用。
- [ ] 标题/文案基础 API 可读写。
- [ ] 分类、账号分类、标签 API 可读。
- [ ] 不同用户无法读取未授权 workspace 数据。
- [ ] 权限失败返回统一错误格式。

## Phase 2.5 验收标准

- [ ] 测试 API 可通过 HTTPS 访问。
- [ ] 合法域名候选明确。
- [ ] 微信公众平台配置清单明确。
- [ ] `/healthz` 和 `/api/meta` 公网 smoke 通过。
- [ ] 响应和日志不暴露敏感配置。

## Phase 3 验收标准

- [ ] 小程序可登录。
- [ ] 标题列表、详情、搜索、筛选可用。
- [ ] 文案列表、详情、搜索、筛选可用。
- [ ] 复制记录可写入使用历史。
- [ ] 收藏/星标可用并按用户隔离。
- [ ] 小程序代码不包含 AppSecret、API Key、数据库连接串。

## Phase 4 验收标准

- [ ] 内容新增、编辑、删除可用。
- [ ] 批量导入预览和确认可用。
- [ ] 后台管理分类、标签、账号分类可用。
- [ ] 审核状态流转可用。
- [ ] 导出、快照、恢复有权限控制和审计。
- [ ] AI 生成通过后端代理，生成记录可追踪。

## 本轮禁止项确认

- [x] 未修改业务代码。
- [x] 未新增依赖。
- [x] 未连接服务器。
- [x] 未连接数据库。
- [x] 未部署。
- [x] 未 push。
- [x] 未 commit。
