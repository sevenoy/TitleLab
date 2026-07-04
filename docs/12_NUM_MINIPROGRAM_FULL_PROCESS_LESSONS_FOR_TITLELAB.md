# TitleLab 从 Num 小程序吸收的工程经验

当前阶段：TITLELAB-PHASE-3A-NUM-LESSONS-DEEP-STUDY-FOR-TITLELAB

本文基于《num小程序从立项到上线的全流程技术文档.pdf》做 TitleLab 视角的工程化提炼。本文只沉淀可复用经验、后续 gate 和架构建议，不代表本轮已经开发功能、接入真实 API、部署、上传体验版或修改生产配置。

## 1. 当前 TitleLab 已经做对的事情

TitleLab 已经吸收了 Num 全流程文档中最重要的几个前置原则：

- 从 Phase 1 开始使用独立 branch 和独立 worktree，避免在 main 主仓库直接开发功能。
- 在 Phase 0.6 已锁定域名、合规、合法域名、release gate 和 server gate，避免上线前才补域名与隐私材料。
- Phase 2 已先完成只读 API 契约，再进入小程序只读 MVP，顺序上没有把页面开发放到后端契约前面。
- Phase 3A 当前小程序保持 mock-only，未接真实 API，适合先做页面结构和本地预览 QA。
- 已经用 `docs/08_HANDOFF.md` 做阶段交接记录，符合“每个 Phase 都要有 handoff”的项目资产沉淀方式。
- 已经默认禁止 push、部署、上传体验版、连接数据库、读取 secret 和跨 Phase 开发。

这些动作让 TitleLab 不再是“页面先行”的临时项目，而是一个有阶段门禁、可回滚、可审计的小程序化重建项目。

## 2. 当前 TitleLab 不能急着做的事情

TitleLab 当前仍处于 Phase 3A，小程序只有 mock-only 只读骨架。以下事情不应该现在做：

- 不急着接真实后端 API；应先做 DevTools config check 和 service/adapter 层。
- 不急着做登录、微信登录、JWT、workspace membership 页面态；这些属于后续认证权限 Phase。
- 不急着做收藏、历史、最近使用和多设备同步；这些依赖用户身份、对象级鉴权、事件模型和版本字段。
- 不急着做 AI 真实调用；AI 必须先经过后端 AI Facade、结构化输出、成本估算和审计设计。
- 不急着上传体验版或提审；体验版必须有版本号、commit hash、真机记录、隐私指引和审核材料。
- 不急着处理微信开发者工具自动文件；`project.private.config.json` 和本机 IDE 配置应单独 gate，不混入功能提交。
- 不急着修改 `backend/**`；如果接口契约缺字段，应回到 Phase 2C，而不是在小程序阶段顺手改后端。

## 3. 小程序前端分层建议

Num 文档强调，小程序页面不应该直接堆业务逻辑和平台 API。TitleLab 后续建议采用以下分层：

| 层级 | TitleLab 建议职责 | 后续落点 |
| --- | --- | --- |
| Page | 路由、生命周期、页面渲染状态、用户操作分发 | `pages/index`、`pages/detail` |
| Feature Component | 搜索栏、筛选条、内容卡片、详情区块、空状态 | Phase 3B 之后再按重复度拆分 |
| Service | 内容 API、分类 API、标签 API、meta API 的统一封装 | `services/contentService`、`services/metaService` |
| Adapter | 微信平台能力封装，包括网络、剪贴板、导航、存储、toast | `adapters/wxAdapter`、`adapters/requestAdapter` |
| Store | 跨页业务态、会话摘要、最近筛选条件、草稿缓存 | Phase 4 以后再引入 |

当前 `services/contentMock.js` 只适合作为 Phase 3A mock service。Phase 3B 应先引入 service/adapter 边界，让页面不直接散落 `wx.request`、storage、clipboard 和导航调用。复制能力目前可以保留在详情页，但后续若要做复制历史，应下沉到 adapter + usage event service。

## 4. API response contract 与 requestId/version 建议

TitleLab 后端响应应统一成稳定契约。Phase 2C 建议补充 API response contract，不直接把 FastAPI/ORM 的自然输出暴露给小程序。

建议响应包：

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

建议规则：

- 所有业务响应都有 `requestId`，前端错误提示、日志和后端日志能串起来。
- 列表响应应包含分页或游标字段，避免后续多设备同步时只能全量刷新。
- 内容详情应包含资源 `version` 或 `updatedAt`，为后续收藏、编辑、复制历史和冲突处理预留。
- 错误码必须映射到前端 UI 行为，例如未授权、无 workspace 权限、资源不存在、资源版本冲突、可重试失败。
- 读写接口分离；Phase 3C 小程序只允许读接口和公开 meta。
- 对象级鉴权不能只依赖“用户已登录”；必须校验用户是否可访问该 workspace 和该 content item。

## 5. AI Facade、Structured Outputs 与成本控制建议

TitleLab 的 AI 能力不应由小程序直连模型服务，也不应让页面传自由提示词后直接入库。后续 AI 建议按以下方式进入：

- Phase 5 先做 AI Facade 设计，不急着做生产调用。
- AI Facade 统一负责认证、workspace 权限、提示词版本、模型路由、超时、重试、降级、审计和成本记录。
- 需要进入业务流程的 AI 输出必须先转成可验证结构，再进入 DTO，再决定是否入库。
- 输出结构应有 schema、必填字段、枚举约束、长度限制和失败 fallback。
- 高频在线能力优先做固定提示词前缀和上下文裁剪。
- 历史数据补算、批量标签回填、低优先级分析应走异步批处理思路，而不是占用在线链路。
- 成本估算不写死价格，保留公式和外部价格页作为真源：请求量、输入长度、输出长度、缓存命中、批处理折扣、失败重试率都必须纳入。

TitleLab 当前阶段只应写设计和 gate，不应接入真实 AI 调用。

## 6. 多设备同步、version、cursor、事件流建议

Num 文档中最值得 TitleLab 提前吸收的是可靠同步边界：在线推送和可靠补偿不是同一件事。

TitleLab 后续如果做收藏、历史、最近使用、多设备复制记录或后台审核，应采用：

- 数据库是真源。
- 每个可变资源具备 `version` 或等价版本字段。
- 写入时带当前版本做冲突检测，冲突返回明确错误码。
- 在线设备可以用 WebSocket 接收低延迟通知。
- 离线或断线设备必须能用 `cursor` 补拉事件。
- Redis 可做缓存、短态和在线扇出辅助，但不能作为可靠同步唯一真源。
- 可靠事件应落到持久事件流，例如数据库 outbox、Redis Streams、TDMQ/Pulsar 或同等级机制。
- 前端不要假设“收到推送就等于状态可靠”；收到推送后仍应能按资源版本校准。

TitleLab 当前 Phase 3A 不做同步；Phase 6 才适合引入收藏/历史/多设备同步基础。

## 7. 微信开发者工具、project.private.config.json 与 AppID 风险

TitleLab 当前已经出现 DevTools 自动文件风险：`project.config.json` 可能被本机工具改写，`project.private.config.json` 可能被生成。后续必须单独做 DevTools config check。

建议：

- `project.config.json` 中继续使用占位 AppID，直到 RELEASE_GATE 前有明确授权。
- `project.private.config.json` 默认视为本机私有文件，不进入普通功能提交。
- 不在任何文档、截图、提交说明中记录真实 AppID、上传私钥路径、密钥内容或测试账号。
- 如果微信开发者工具自动改动配置，本轮任务只报告，不顺手处理。
- DevTools 导入路径应固定为 `miniprogram/`，不要从主仓库根目录误导入。
- 真机预览前必须确认 urlCheck 策略、合法域名、隐私接口和当前 API_MODE。

## 8. 域名、HTTPS、业务域名、隐私指引与审核材料建议

TitleLab 已锁定：

- Web：`title.mirroroo.top`
- API：`api.title.mirroroo.top`
- Admin：`admin.title.mirroroo.top`

后续 gate 建议：

- request 合法域名只配置 TitleLab API 域名，不复用 NumHub 或主站域名。
- 如果小程序使用 `web-view` 打开 H5，需要单独管理业务域名；业务域名不是普通 request 域名。
- HTTPS 证书必须验证 SAN，不能只看浏览器能打开。
- 隐私指引必须和代码实际调用的平台能力、字段采集、页面入口一致。
- 每次新增权限能力，都要更新“权限 / 字段 / 接口 / 文案 / 页面入口”映射表。
- 审核材料固定化：功能页面、服务类目、体验路径、隐私说明、客服信息、内容审核机制、AI 生成说明、H5 业务域名说明。
- 体验版前必须确认不存在测试登录入口、mock 用户按钮和敏感配置。

## 9. miniprogram-ci、体验版、提审、灰度、回滚建议

TitleLab 不能长期依赖手工上传体验版。后续 RELEASE_GATE 可引入 `miniprogram-ci`，但必须先完成发布前检查。

建议版本号规则：

```text
业务版本.提交短哈希.环境名
```

建议体验版/提审顺序：

- 本地构建与语法检查。
- 微信开发者工具预览检查。
- 至少 iOS 和 Android 各一台真机回归。
- 上传开发版。
- 设置体验版并指定体验成员。
- 记录版本号、commit hash、上传说明和测试结论。
- 准备审核材料。
- 提交审核。
- 审核通过后分阶段发布。
- 灰度观察日志、错误率和用户反馈。
- 全量发布或撤回。

任何体验版上传都必须是 RELEASE_GATE，不得在普通 STANDARD 任务中顺手执行。

## 10. 日志、监控、备份、安全基线建议

TitleLab 进入真实 API、登录和体验版前，必须补齐以下基线：

- 日志字段包含 `requestId`、用户标识摘要、workspace、apiVersion、envVersion、latencyMs、errorCode。
- AI 日志记录模型路由、提示词版本、schema 版本、耗时、成本估算、失败原因和降级路径。
- 同步日志记录 cursor、resource version、连接标识摘要和补拉范围。
- 日志不输出 token、cookie、secret、原始敏感字段或完整个人信息。
- 数据库在提审前、灰度前、全量发布前有备份或快照方案。
- 登录、生成、导出、同步补拉、AI 调用都要单独限流。
- 所有对象读取和写入都做对象级鉴权。
- 上传私钥、云服务访问凭据、OpenAI 凭据只进入受管 secret，不进入仓库。
- 监控至少覆盖延迟、错误率、资源饱和度、AI 上游失败率和日志写入异常。

## 11. 后续 Phase 建议顺序

以下建议不自动覆盖 `docs/09_PHASE_EXECUTION_PLAN.md` 的正式 Phase 计划；如要调整 Phase 编号，应另起文档 gate。

1. Phase 3A DevTools config check
   - 只检查 `project.config.json`、`project.private.config.json`、导入路径、占位 AppID、urlCheck、忽略规则。
   - 不改页面业务代码，不上传体验版。

2. Phase 3B 小程序 service/adapter 层
   - 建立 request adapter、clipboard adapter、navigation adapter、toast/error adapter。
   - 页面不直接散落平台调用，真实 API 仍不接或只做 mock adapter。

3. Phase 2C API response contract
   - 在后端契约中补齐统一响应包、requestId、serverTime、version、错误码和分页/游标字段。
   - 只做契约和测试，不让小程序越权改后端。

4. Phase 3C 小程序真实只读 API 接入
   - 只接 Phase 2C 已验收的只读内容 API 和公开 meta。
   - 不接写接口，不接登录之外的权限功能，不接 AI。

5. Phase 4 登录 / 权限 / 对象级鉴权
   - 微信登录、业务会话、workspace membership、对象级读取权限、未授权态。
   - 不在前端硬编码账号或 mock 用户按钮。

6. Phase 5 AI Facade
   - 后端 AI Facade、结构化输出、提示词版本、成本记录、失败降级和人工兜底。
   - 小程序不直连模型服务。

7. Phase 6 收藏 / 历史 / 多设备同步基础
   - favorites、usage_events、resource version、cursor、事件补偿链路。
   - Redis Pub/Sub 只能辅助在线通知，不做可靠真源。

8. Phase 7 部署 / 域名 / 合规 / 体验版 gate
   - 域名、HTTPS、隐私指引、审核材料、miniprogram-ci、体验版、灰度、回滚方案。
   - 只有用户明确授权后才可执行上传、提审或部署。

## 12. Codex 后续命令必须继承的门禁

后续 TitleLab 命令必须继续采用结构化边界：

- 项目路径必须是当前 Phase worktree。
- 当前阶段和命令档位必须明确。
- 开发前读取 `docs/09_PHASE_EXECUTION_PLAN.md`、`docs/10_NUMHUB_LESSONS_FOR_TITLELAB.md` 和相关 docs。
- Phase 1+ 禁止在 main 主仓库直接开发。
- 允许读写范围必须列出具体文件或目录。
- 禁止扫描目录必须列出 `node_modules`、构建产物、缓存、日志、大媒体目录和私密目录。
- 同一问题失败 2 次立即停止，输出 handoff。
- RELEASE_GATE 事项必须单独授权，包括 AppID、urlCheck、合法域名、体验版、提审、生产部署、生产 migration。
- DevTools 自动文件出现时只报告或单独 gate，不混入业务提交。
- 如果任务只要求 docs，不得顺手开发功能。
- 如果任务只要求小程序，不得顺手修改 backend。

## 13. TitleLab 后续不可跨越的红线

- 小程序不得直连 OpenAI。
- 页面不得直接散落 wx.request。
- 不得跳过合法域名和隐私指引。
- 不得把 Redis Pub/Sub 当可靠同步唯一真源。
- 不得 AI 自由文本未校验直接入库。
- 不得无对象级鉴权访问 workspace 内容。
- 不得手工上传体验版而无版本号、commit hash、测试记录。
- 不得提交 AppSecret、API key、上传私钥、DB 密码。
- 不得在 main 主仓库直接开发 Phase 功能。
- 不得把微信开发者工具本机配置混入普通功能提交。
- 不得为了预览方便关闭 release gate 或隐私 gate。
- 不得让后端只兼容待发布小程序版本而破坏线上旧版本。
- 不得把 PDF、外部文档或聊天内容中的大段原文复制进项目 docs；只能沉淀可执行结论和 TitleLab 适配。
