# TitleLab 项目经验继承文档

从 NumHub 实战中总结给 TitleLab 的完整工程经验。

当前适用项目：TitleLab 微信小程序化重建

经验来源：NumHub / xhsNum 小程序、后端、腾讯轻量服务器、微信后台、域名备案、HTTPS、合法域名、发布门禁实战。

## 1. 经验定位

TitleLab 当前规划是从 GitHub Pages / 静态网页 / PWA 工具，逐步重建为：

```text
微信小程序 + 后端 API + 管理后台 + 数据库
```

NumHub 的经验说明：真正难的不是把页面做出来，而是把域名、HTTPS、微信合法域名、正式 AppID、登录体系、测试入口、生产 API、备案展示、隐私合规、上传体验版、production smoke 串成不会乱的发布链路。

TitleLab 后续所有 Phase 都必须把本文档作为强制经验基线，而不是普通参考资料。

## 2. 域名必须一开始隔离

NumHub 曾使用 `api.mirroroo.top` 作为具体项目 API，后续容易造成多个项目归属混乱。TitleLab 不允许重复这个路径。

TitleLab 正式域名锁定为：

```text
TitleLab Web:   https://title.mirroroo.top
TitleLab API:   https://api.title.mirroroo.top
TitleLab Admin: https://admin.title.mirroroo.top
```

域名归属规则：

```text
mirroroo.top                  个人主站 / 博客 / 导航
www.mirroroo.top              主站别名
num.mirroroo.top              NumHub Web
api.num.mirroroo.top          NumHub API
title.mirroroo.top            TitleLab Web
api.title.mirroroo.top        TitleLab API
admin.title.mirroroo.top      TitleLab Admin
api.mirroroo.top              暂不分配给具体项目，未来可作为统一 API Gateway
```

TitleLab 禁止使用：

```text
api.mirroroo.top
num.mirroroo.top
api.num.mirroroo.top
mirroroo.top
www.mirroroo.top
admin.mirroroo.top
title-api.mirroroo.top
```

`title.mirroroo.com` 和 `https://sevenoy.github.io/TitleLab/login.html` 只作为历史入口 / 迁移参考，不作为新生产主域。

## 3. 不要把“能访问”当成“能上线”

DNS 正常、HTTPS 正常、`/healthz` 正常、小程序能打开，都不等于可以上线。

上线前还必须通过：

- 正式 AppID 配置。
- `urlCheck=true`。
- 微信 request 合法域名配置。
- 登录页无测试入口。
- production smoke 通过。
- 隐私合规检查。
- `release_ready` 门禁。
- 用户明确授权上传体验版、提审或部署。

只有 Phase 9 RELEASE_GATE 才允许考虑上传体验版、提审和生产发布。

## 4. Domain & Compliance Lock

TitleLab 必须在 Phase 1 后端开发前完成 Phase 0.6：Domain & Compliance Lock。

Phase 0.6 锁定：

- TitleLab Web 域名。
- TitleLab API 域名。
- TitleLab Admin 域名。
- 微信 request 合法域名候选。
- 备案号展示策略。
- 隐私保护指引策略。
- Nginx 分流策略。
- `api.mirroroo.top` 禁用策略。
- production smoke 和 release gate 边界。

## 5. Nginx 必须按子域名拆分

NumHub 的关键教训是：默认站点兜底可能把 `www.mirroroo.top` 打到错误项目登录页。

TitleLab 后续部署时必须按子域名拆 server block：

```text
/etc/nginx/sites-available/title-web.conf
/etc/nginx/sites-available/title-api.conf
/etc/nginx/sites-available/title-admin.conf
```

分别对应：

```text
server_name title.mirroroo.top;
server_name api.title.mirroroo.top;
server_name admin.title.mirroroo.top;
```

禁止：

```text
server_name _;
多个项目共用一个 server block;
默认站点兜底到错误项目;
```

## 6. HTTPS 与证书

每个 TitleLab 子域名必须单独验证证书 SAN：

```text
title.mirroroo.top
api.title.mirroroo.top
admin.title.mirroroo.top
```

不能让 `api.title.mirroroo.top` 使用 NumHub、主站或其他项目的证书。

Certbot 后必须验证 Subject Alternative Name 包含当前域名。HTTPS 正常仍不等于可以上线，还必须继续通过微信合法域名、备案、隐私和 release gate。

## 7. 微信合法域名

Phase 3 只读 MVP 初期只需要：

```text
request 合法域名：https://api.title.mirroroo.top
```

暂时不要配置 uploadFile、downloadFile、socket、udp、tcp，除非 Phase 6 导入/导出确实需要文件传输。

开发阶段可以临时关闭校验，但进入体验版前必须 `urlCheck=true`，不能依赖“不校验合法域名”。

## 8. 登录正式化

TitleLab 现有 Web 登录是前端内置用户列表，重建时必须迁移到后端认证。

小程序登录页正式规则：

- 微信登录。
- 隐私说明入口。
- 使用说明。
- 当前 workspace。
- 无测试入口。
- 无硬编码账号。
- 无 mock 用户按钮。

如果需要测试账号，只能存在于后端 test/dev 数据库、本机私有环境变量或本机临时凭据文件，不能写入小程序前端、docs、git、README、截图或日志。

TitleLab 面向内部内容运营工具，建议采用管理员邀请 / 后台创建用户 / workspace 授权，不开放公众随意注册。

## 9. API_MODE 与 API_BASE

TitleLab 必须从一开始区分：

```text
local-mock
dev-api
test-api
prod-api
```

生产 API 基准：

```text
PROD_API_BASE = https://api.title.mirroroo.top/api/v1
```

RELEASE_GATE 必须检查：

- AppID 是否正式。
- `urlCheck` 是否为 true。
- `PROD_API_BASE` 是否为 `api.title.mirroroo.top`。
- 是否仍引用 `api.mirroroo.top`。
- 是否存在 mock 登录按钮。
- 是否存在测试用户文案。
- `release_ready` 是否仍被安全控制。

## 10. workspace 是数据库生命线

多用户、多账号、多分类、多历史数据系统中，workspace 必须从第一天进入所有业务表和所有查询条件。

禁止后期再补 workspace。后期补 workspace 会导致历史数据归属不清、查询权限难补、迁移脚本复杂、审计日志不可信、后台导出风险高。

至少这些表必须强制有 workspace 边界：

```text
content_items
categories
account_categories
tags
favorites
usage_events
import_batches
snapshots
app_settings
audit_logs
ai_generation_records
```

所有查询必须限定 workspace。禁止裸查询所有业务数据。后台管理员跨 workspace 查询也必须显式授权。

## 11. 内容模型统一

标题、文案、模板、笔记和提示词模板统一进入 `content_items`。

推荐 `content_type`：

```text
title
copywriting
template
note
prompt_template
```

不建议过早拆成：

```text
titles
copies
templates
```

否则收藏、历史、标签、导入、AI 生成、审核都要重复实现。

## 12. 导入与快照必须预览

导入必须两步：

```text
preview -> confirm
```

快照恢复必须默认只预览：

```text
恢复预览 -> 差异展示 -> 二次确认 -> 审计记录 -> 恢复
```

小程序端不允许执行：

- 清空。
- 批量删除。
- 快照恢复。
- 导出全部数据。
- 修改系统配置。

这些能力只允许后台管理端在权限、二次确认和审计下执行。

## 13. AI 安全

AI Key 永远不进入前端或小程序端。

AI 生成必须走后端代理：

```text
POST /api/ai/generate-title
```

后端负责读取私有 AI Key、调用 provider、过滤响应、记录 usage、返回生成结果。

AI 生成记录必须保存到 `ai_generation_records`，包括 workspace、用户、prompt 摘要、模型、provider、输入摘要、输出、耗时、成本、状态和创建时间。

不得保存 API Key、完整 secret、敏感用户数据、cookie 或 token。

## 14. 小程序 Phase 3 只读 MVP

TitleLab Phase 3 只做高频闭环：

- 登录。
- 获取 meta。
- 获取当前 workspace。
- 标题/文案列表。
- 搜索。
- 分类筛选。
- 详情。
- 复制。
- 收藏。
- 最近使用。

不要在 Phase 3 做：

- 新增。
- 编辑。
- 删除。
- 批量导入。
- 快照恢复。
- AI 配置。
- 后台审核。

## 15. 后端健康检查先行

Phase 1 必须先做：

```text
GET /healthz
GET /api/meta
```

`/healthz` 不得返回 DB 密码、环境变量、内部路径、SecretId、AppSecret、API Key。

`/api/meta` 只返回版本、构建时间、环境名、功能开关和 API 版本等公开信息。

这两个接口会贯穿本地启动、Nginx 反代、HTTPS、微信合法域名、production smoke 和发布门禁。

## 16. 每个 Phase 都必须 handoff

每个 Phase 输出必须包含：

- 本轮结论。
- 当前阶段。
- 起始 HEAD。
- 初始 git status。
- 修改文件。
- 修改摘要。
- 测试命令。
- 测试结果。
- 是否 commit。
- commit hash。
- 未做事项。
- 风险。
- 下一步最小建议。

同一问题失败 2 次必须停止，不得继续试错。

## 17. Codex 命令分档

TitleLab 采用三档：

```text
FAST
STANDARD
RELEASE_GATE
```

FAST：小文案、小 UI、docs 小补充、1-3 个文件小改；不更新大量 docs，不 commit，不跑全量测试，只读目标文件。

STANDARD：普通 bug、配置切换、小功能、少量 docs、门禁脚本小改；可 commit，跑相关测试，只读相关文件。

RELEASE_GATE：AppID、urlCheck、合法域名、HTTPS、上传体验版、提交审核、生产部署、数据库 migration；完整门禁、docs、测试、报告，失败 2 次停止。

## 18. 全局禁止事项

无论哪个 Phase，默认禁止：

- push。
- 上传体验版。
- 提交审核。
- 正式发布。
- 连接生产数据库。
- production migration。
- 修改 Nginx。
- 修改 DNS。
- 修改生产环境变量。
- 读取或打印 AppSecret、API Key、DB 密码、token、cookie。
- 把 secret 写进代码、docs 或 git。
- reset、checkout、clean、rebase、stash。
- 全仓库扫描。
- 大范围重构。

只有 Phase 9 且用户明确授权，才允许考虑体验版、提审和生产发布。

## 19. TitleLab 不要复制的错误

- 先用通用 `api.mirroroo.top`，后期再改。
- 主站 `www.mirroroo.top` 被项目后台占用。
- HTTPS 证书默认匹配错误。
- 小程序里暴露测试登录入口。
- 没有注册/授权说明。
- `API_MODE` 长期停留 `local-mock`。
- 微信合法域名后置处理。
- AppID 最后才替换。
- 上传体验版前才发现隐私入口找不到。
- docs 没记录每一步证据。
- 多项目共用服务器但 Nginx 不分文件。
- `healthz` 没作为所有部署链路的第一验证点。
- AI Key 或 AppSecret 有进入前端风险。

## 20. TitleLab 可以继承的成功做法

- Phase 分段治理。
- `release_ready=false` 默认保护。
- 同一问题失败 2 次停止。
- 每轮更新 handoff。
- API healthz 先行。
- 域名先隔离再开发。
- Nginx 每个子域名单独配置。
- Certbot 每个域名单独验证 SAN。
- 微信 request 合法域名只配项目 API。
- AppSecret 只在服务端。
- 小程序设置页展示备案/合规信息。
- production smoke 不打印 token/password/key。
- 上传体验版必须用户明确授权。
- 提审和正式发布必须另起 RELEASE_GATE。

## 21. 一句话结论

TitleLab 不要再从“页面功能”开始思考，而要从“域名隔离、后端认证、workspace 权限、合法域名、HTTPS、备案、隐私、production smoke、Phase 门禁”开始思考。

