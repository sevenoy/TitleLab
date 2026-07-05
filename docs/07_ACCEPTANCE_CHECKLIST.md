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

## Phase 6D Mini Program AI Mock DevTools/manual Acceptance

- [x] DevTools 导入路径明确为 `miniprogram/`。
- [x] `project.config.json` 保持 `compileType=miniprogram` 和 `urlCheck=true`。
- [x] AI 页面仍默认 mock-only。
- [x] 真实 API、auth 和 AI 请求开关保持默认关闭。
- [x] 手动测试用例覆盖首页入口、空输入、短输入、正常输入、示例输入、选项组合、复制、清空、重试、过长输入、疑似敏感输入、不登录和网络关闭 mock 可用性。
- [x] 截图清单覆盖首页入口、AI 初始态、示例输入、loading、结果列表、warning、空输入错误、复制成功 toast、清空和重试状态。
- [x] bug report template 覆盖设备/模拟器、微信开发者工具版本、基础库版本、复现步骤、预期结果、实际结果、截图路径、控制台错误、是否阻塞和建议优先级。
- [x] Phase 6D preflight 已新增：`python3 scripts/titlelab_phase6d_miniprogram_devtools_acceptance_check.py`。
- [x] 不上传体验版。
- [x] 不提交审核。
- [x] 不真实调用 OpenAI。
- [x] 不真实请求后端 AI。
- [x] 不连接真实数据库。
- [x] 不新增 migration。
- [x] 不新增依赖。

## Phase 6E Direct Original Web/PWA UI AI Inline Fix

- [x] 真实 UI 文件已定位为 Web/PWA：`index.html`、`title.html`、`content.html`、`assets/app-title.js`、`assets/app-content.js`、`assets/styles.css`。
- [x] 保留 `THE` logo、标题/文案双 Tab、S 用户按钮、退出按钮。
- [x] 保留分类管理、搜索区、账号分类、设为本机默认、主题设置、管理页面入口。
- [x] 标题列表仍保留复制 / `✨AI` / 修改 / 删除。
- [x] 标题 AI 使用 `activeAiTitleId` 行内展开，不跳转独立页面。
- [x] 标题 AI 面板显示 `AI 标题灵感`、`本地示例`、模式 chips 和 3 条港迪旅拍标题示例。
- [x] 文案列表仍保留折叠/展开、复制 / `✨AI` / 修改 / 删除。
- [x] 文案展开使用 `expandedCopyId`，展开内容留在当前行/卡片。
- [x] 文案 AI 使用 `activeCopyAiId` 行内展开，显示 `AI 文案助手` 与本地示例。
- [x] 分类列表没有插入 AI 入口，排序/改名结构不被 Phase 6E 改写。
- [x] 不使用 Stitch 代码。
- [x] 不新增底部 Tab。
- [x] 不新增浮动 +。
- [x] 不新增外部图片、Google Fonts、Material Symbols 或 Tailwind CDN。
- [x] 不真实调用 OpenAI。
- [x] 不读取或写入真实 AI key。
- [x] 不真实请求后端 AI。
- [x] 不连接真实数据库。
- [x] 不执行真实数据库 migration。
- [x] 不新增 migration。
- [x] 不新增依赖。
- [x] Phase 6E preflight 已新增：`python3 scripts/titlelab_phase6e_original_ui_ai_inline_check.py`。

## Phase 6F Mini Program Original UI Inline AI Sync

- [x] Phase 6F 独立 worktree 已创建并从 Phase 6E 后的 main 开始。
- [x] 未修改微信开发者工具缓存目录。
- [x] 未修改旧 Phase 3 worktree。
- [x] 小程序首页已替换为蓝白标题/文案库结构。
- [x] 旧绿色小程序首页文案已从当前首页移除。
- [x] 顶部包含 `THE`、标题 / 文案、S 用户按钮、退出按钮。
- [x] 分类管理区包含全部、亲子、氛围、情侣、闺蜜、单人、街拍、口碑推荐、节日及计数。
- [x] 分类管理区保留上移、下移、改，未插入 AI 入口。
- [x] 标题 Tab 包含搜索标题关键词、账号分类、操作按钮和标题列表。
- [x] 标题列表包含 `⭐ 序号`、标题正文、复制、`✨AI`、修改、删除。
- [x] 标题 `✨AI` 使用 `activeAiTitleId` 行内展开 `AI 标题灵感` 本地示例。
- [x] 文案 Tab 包含搜索文案关键词、账号分类、操作按钮和文案列表。
- [x] 文案使用 `expandedCopyId` 在当前卡片展开完整内容。
- [x] 文案 `✨AI` 使用 `activeCopyAiId` 展开 `AI 文案助手` 本地示例。
- [x] `project.config.json` 保持 `projectname=TitleLab`、`compileType=miniprogram`、`urlCheck=true`。
- [x] `realApiGateEnabled=false`、`authRealApiGateEnabled=false`、`aiRealApiGateEnabled=false`。
- [x] 页面不直接调用 `wx.request`。
- [x] 页面不直接调用 `wx.login`。
- [x] 未修改 `backend/alembic/**`。
- [x] 未修改 `backend/app/db/**`。
- [x] 未修改 `backend/app/models/**`。
- [x] 未新增 migration。
- [x] 未新增依赖。
- [x] 未部署。
- [x] 未上传体验版。
- [x] 未提交审核。
- [x] Phase 6F preflight 已新增：`python3 scripts/titlelab_phase6f_miniprogram_original_ui_sync_check.py`。

## Phase 6G Mini Program Compliance UI Login Privacy Fix

- [x] Phase 6G 独立 worktree 已创建并从 `17a4927` 开始。
- [x] `project.config.json` AppID 为 `wx2f9db77f2383b42e`。
- [x] `pages/login/index` 已作为默认入口。
- [x] 登录页展示 `TitleLab` 和 `本产品账号登录`。
- [x] 登录页说明不要求微信账号、微信密码或微信验证码。
- [x] 协议复选框默认未勾选。
- [x] 未勾选协议点击登录会提示 `请先阅读并勾选《用户服务协议》《隐私政策》后再继续。`
- [x] 登录页包含《用户服务协议》《隐私政策》入口。
- [x] 小程序不使用 `getPhoneNumber`。
- [x] 小程序不使用 `wx.getUserProfile` 或 `wx.getUserInfo`。
- [x] 小程序不使用 `getClipboardData`。
- [x] 首页用户可见高风险词已从当前路由页面移除。
- [x] 未路由历史 AI 页面 `miniprogram/pages/ai/**` 已删除。
- [x] 未引用 AI service 已删除。
- [x] AI 写请求白名单已从小程序 request 封装中移除。
- [x] 当前个人主体安全版不保留用户可见 AI 能力。
- [x] 首页分类名保持横向显示，不做竖排布局。
- [x] 首页按钮使用可换行网格，避免横向溢出。
- [x] 标题/文案列表操作区完整显示复制、展开、修改、删除。
- [x] 文案展开内容留在当前卡片内，不遮挡后续内容。
- [x] 顶部 Tab 使用弹性宽度，不挤压变形。
- [x] 隐私政策覆盖信息处理、信息类型、授权同意、账号注销、数据删除、对外提供、微信用户信息、设备能力和剪贴板。
- [x] 用户服务协议覆盖用户责任、禁止行为、个人信息保护、来源合法、必要授权、停用和注销。
- [x] 设置页包含协议、隐私政策、账号注销与数据删除说明、版本信息和退出登录。
- [x] 复制只在用户点击复制时调用 `setClipboardData`。
- [x] 页面不直接调用 `wx.request` 或 `wx.login`。
- [x] `wx.request` 只保留在 `services/request.js`。
- [x] `wx.login` 只保留在 `adapters/wechat.js`。
- [x] 未修改微信开发者工具缓存目录。
- [x] 未修改旧 Phase 3 worktree。
- [x] 未连接真实数据库。
- [x] 未执行 migration。
- [x] 未真实请求后端。
- [x] 未真实调用外部模型服务。
- [x] 未部署。
- [x] 未上传体验版。
- [x] 未提交审核。
- [x] Phase 6G preflight 已新增：`python3 scripts/titlelab_phase6g_miniprogram_compliance_check.py`。

## 历史规划轮次禁止项确认

- [x] 未修改业务代码。
- [x] 未新增依赖。
- [x] 未连接服务器。
- [x] 未连接数据库。
- [x] 未部署。
- [x] 当轮未 push。
- [x] 当轮未 commit。
