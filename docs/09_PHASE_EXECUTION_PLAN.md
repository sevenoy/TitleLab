# TitleLab Phase Execution Plan v0.1

当前阶段：TITLELAB-PHASE-PLAN-LOCK-V0-1

## 1. 项目总目标

TitleLab 将从现有 GitHub 静态网页/PWA 项目，逐步重建为“微信小程序 + 后端 API + 管理后台 + 数据库”的内容运营工具。最终系统服务于标题、文案、模板、分类、标签、收藏、历史、导入、快照、AI 仿写和审计管理。

本文件是后续开发总控文档。任何开发轮次必须先确认当前 Phase，并严格按对应 Phase 的允许范围、禁止范围、测试命令和验收标准执行。

## 2. 阶段执行总原则

- 任何 Phase 不得提前开发下一 Phase 功能。
- 任何 Phase 不得为了方便跳过验收。
- 每个 Phase 开始前必须读取本文件、`docs/08_HANDOFF.md` 和本 Phase 相关 docs。
- 每个 Phase 结束后必须更新 handoff 或阶段报告。
- 同一问题连续失败 2 次必须停止并输出 handoff，不得继续试错。
- 默认禁止连接生产数据库、执行生产 migration、修改服务器配置、修改 Nginx、修改域名解析。
- 默认禁止上传体验版、提交审核、生产部署；只有 Phase 9 RELEASE_GATE 才允许考虑。
- 默认禁止打印 secret、token、cookie、password、AppSecret、API key、DB 密码。
- 默认禁止 reset、checkout、clean、rebase、stash，除非用户单独授权。
- Ponytail 原则：每个 Phase 只做达成验收所需的最小实现。

## 3. Phase 0：需求与规划，已完成

目标：完成 PRD、数据库设计、小程序架构、后端架构、部署方向和验收基准。

允许范围：读取少量现有页面和根目录文档；新增 Phase 0 docs。

禁止范围：业务代码、后端、小程序、migration、依赖、部署、服务器、数据库。

可读文件范围：根目录 Markdown、指定根目录 HTML、PWA 文件、少量必要 assets。

可改文件范围：`docs/00_PROJECT_BRIEF.md` 到 `docs/08_HANDOFF.md`。

数据库变更范围：只写设计，不创建 migration。

API 范围：只写 API 模块规划。

小程序范围：只写小程序架构规划。

后台范围：只写管理后台功能规划。

测试命令：`pwd`、`git status --short`、`git remote -v`、`git branch --show-current`、`find docs -maxdepth 1 -type f | sort`、`git diff --check`。

验收标准：9 个 Phase 0 文档完成；无业务代码修改；文档级检查通过。

停止条件：Phase 0 文档落库完成后停止，等待审核。

交付报告格式：结论、阶段、路径、remote、分支、文件、核心 PRD、数据库摘要、测试结果、风险、下一步。

允许 commit：否，除非用户单独授权。

允许部署：否。

允许连接测试数据库：否。

禁止连接生产数据库：是。

## 4. Phase 0.5：Phase 步骤锁定，当前轮

目标：生成本总控文档，锁定 Phase 0 到 Phase 9 的开发顺序、范围和门禁。

允许范围：读取现有 Phase 0 docs；新增 `docs/09_PHASE_EXECUTION_PLAN.md`；小幅追加 `docs/08_HANDOFF.md`。

禁止范围：业务代码、配置、依赖、后端、小程序、数据库、服务器、Git commit、push。

可读文件范围：`docs/00_PROJECT_BRIEF.md` 到 `docs/08_HANDOFF.md`。

可改文件范围：`docs/09_PHASE_EXECUTION_PLAN.md`；`docs/08_HANDOFF.md` 仅追加 Phase Plan Lock 说明。

数据库变更范围：无。

API 范围：无实现，只锁定后续 Phase API 边界。

小程序范围：无实现，只锁定后续 Phase 小程序边界。

后台范围：无实现，只锁定后续 Phase 后台边界。

测试命令：`pwd`、`git status --short`、`git remote -v`、`git branch --show-current`、`find docs -maxdepth 1 -type f | sort`、`git diff --check`。

验收标准：本文件完整覆盖 Phase 0 到 Phase 9；每个 Phase 均明确目标、范围、测试、验收、停止条件和部署/数据库/commit 边界。

停止条件：总控文档完成且 `git diff --check` 通过后停止。

交付报告格式：结论、阶段、路径、remote、分支、是否改业务代码、文件、Phase 总数、Phase 摘要、测试结果、风险、下一步。

允许 commit：否。

允许部署：否。

允许连接测试数据库：否。

禁止连接生产数据库：是。

## 5. Phase 1：后端骨架 + 基础数据库 migration + health/meta

目标：建立最小后端项目骨架、基础数据库 migration、健康检查和公开 meta 接口。

允许范围：创建后端骨架、基础配置占位、`.env.example`、本地数据库 migration、`GET /healthz`、`GET /api/meta`、基础错误格式。

禁止范围：完整业务 CRUD、微信正式登录、小程序页面、管理后台、AI、导入、快照、生产部署。

可读文件范围：本文件、Phase 0 docs、后端相关 README/config、被创建的后端目录。

可改文件范围：后端目录、数据库 migration 目录、后端 README、`.env.example`、`docs/08_HANDOFF.md`。

数据库变更范围：只允许本地/测试空库基础 migration；不得连接生产数据库；不得迁移真实数据。

API 范围：`GET /healthz`、`GET /api/meta`。

小程序范围：无。

后台范围：无。

测试命令：后端语法检查、后端单元/启动检查、本地 migration dry run 或本地空库执行、`curl /healthz`、`curl /api/meta`、`git diff --check`。

验收标准：后端可本地启动；基础 migration 可在本地空库执行；两个健康接口返回且不含敏感配置；无真实 secret。

停止条件：Phase 1 骨架与健康接口完成后停止，更新 handoff。

交付报告格式：结论、路径、remote、分支、改动文件、数据库变更、本地启动命令、测试命令、测试结果、风险、下一步 Phase 2 输入。

允许 commit：仅用户明确要求时允许本地 commit；默认否。

允许部署：否。

允许连接测试数据库：允许，仅限本地/测试空库且用户已提供非生产配置。

禁止连接生产数据库：是。

## 6. Phase 2：核心数据模型 + 内容只读 API

目标：完成核心数据模型和只读内容 API，为小程序只读 MVP 提供稳定后端。

允许范围：实现 `users`、`workspaces`、`workspace_members`、`content_items`、`categories`、`account_categories`、`tags`、`content_tags` 基础读模型；实现内容列表、详情、分类/标签读取。

禁止范围：写入型内容 CRUD、收藏/历史、AI、导入、快照、后台 UI、小程序 UI、生产部署。

可读文件范围：Phase docs、后端目录、migration 目录、后端测试。

可改文件范围：后端 API、模型、migration、测试、API 文档、handoff。

数据库变更范围：本地/测试库新增只读 API 所需表和种子样例；禁止生产 migration。

API 范围：`GET /api/contents`、`GET /api/contents/:id`、`GET /api/categories`、`GET /api/account-categories`、`GET /api/tags`。

小程序范围：无。

后台范围：无。

测试命令：后端测试、migration 测试、只读 API smoke、权限隔离基础测试、`git diff --check`。

验收标准：只读 API 可返回标题/文案/分类/标签；所有查询限定 workspace；无未授权数据泄漏。

停止条件：只读 API 稳定后停止，输出给 Phase 3 的接口契约。

交付报告格式：结论、数据库表、API 清单、测试数据、测试命令、测试结果、权限风险、下一步。

允许 commit：仅用户明确要求时允许本地 commit；默认否。

允许部署：否。

允许连接测试数据库：允许，仅限测试库。

禁止连接生产数据库：是。

## 7. Phase 3：小程序只读 MVP

目标：实现小程序端只读使用闭环。

允许范围：小程序登录壳、首页、标题/文案列表、搜索筛选、详情、复制、只读接口接入。

禁止范围：内容新增/编辑/删除、收藏/历史、管理后台、导入、快照、AI、体验版上传、提审。

可读文件范围：Phase docs、小程序目录、后端 API 文档、项目配置。

可改文件范围：小程序目录、接口封装、页面样式、小程序 README、handoff。

数据库变更范围：无；如发现接口缺字段，回到 Phase 2 修 API，不在小程序阶段改 DB。

API 范围：只调用 Phase 2 的只读 API 和 `GET /api/meta`。

小程序范围：登录壳、首页、标题/文案列表、详情、搜索筛选、复制。

后台范围：无。

测试命令：小程序语法/构建检查、接口 mock 或测试 API smoke、开发者工具预览检查、`git diff --check`。

验收标准：小程序可展示授权数据；搜索筛选可用；详情复制可用；无敏感配置进入小程序代码。

停止条件：只读 MVP 可演示后停止。

交付报告格式：结论、小程序页面、调用 API、验证步骤、截图/手工验证说明、风险、下一步。

允许 commit：仅用户明确要求时允许本地 commit；默认否。

允许部署：否。

允许连接测试数据库：否，小程序只连测试 API。

禁止连接生产数据库：是。

## 8. Phase 4：用户体系 + 收藏/历史/最近使用

目标：补齐微信登录、RBAC、收藏/星标、复制历史、最近使用。

允许范围：后端认证、用户会话、workspace membership、favorites、usage_events；小程序收藏、取消收藏、最近使用。

禁止范围：管理后台、导入、快照、AI、生产部署、体验版上传。

可读文件范围：Phase docs、后端 Auth/Content/Favorite/History、小程序相关页面。

可改文件范围：后端 Auth/Favorite/History、数据库 migration、测试、小程序收藏/历史相关文件、handoff。

数据库变更范围：测试库新增/调整 `favorites`、`usage_events`、认证相关字段；禁止生产 migration。

API 范围：`POST /api/auth/wechat-login`、`GET /api/auth/me`、`POST /api/auth/logout`、`GET/POST/DELETE /api/favorites`、`POST/GET /api/usage-events`。

小程序范围：登录、用户信息、收藏/星标、最近使用。

后台范围：无。

测试命令：认证测试、权限测试、收藏/历史 API 测试、小程序登录和收藏 smoke、`git diff --check`。

验收标准：不同用户收藏和历史隔离；未登录不可访问业务 API；小程序最近使用可展示。

停止条件：用户体系和个人行为闭环完成后停止。

交付报告格式：结论、认证方式、权限模型、数据库变更、API、测试结果、风险、下一步。

允许 commit：仅用户明确要求时允许本地 commit；默认否。

允许部署：否。

允许连接测试数据库：允许，仅限测试库。

禁止连接生产数据库：是。

## 9. Phase 5：管理后台最小版

目标：实现管理员最小后台，用于内容、分类、标签和审核管理。

允许范围：后台登录、内容列表、内容编辑、分类/账号分类/标签管理、审核状态、审计日志查询。

禁止范围：危险清空、快照恢复、批量迁移、AI 配置上线、生产部署。

可读文件范围：Phase docs、后端 Admin/Content/Taxonomy、后台目录、测试。

可改文件范围：后台目录、后端 Admin/Content/Taxonomy、数据库 migration、测试、handoff。

数据库变更范围：测试库补充审核、审计、后台配置所需字段；禁止生产 migration。

API 范围：后台内容管理、分类管理、审核状态、审计查询 API。

小程序范围：无，除非修复 Phase 4 遗留接口兼容问题。

后台范围：登录、内容管理、分类标签管理、审核、只读审计。

测试命令：后台构建/语法检查、后端 Admin API 测试、权限测试、`git diff --check`。

验收标准：管理员可管理内容和分类；非管理员被拒绝；审核变更和关键操作进入审计。

停止条件：后台最小管理闭环完成后停止。

交付报告格式：结论、后台页面、Admin API、权限测试、审计覆盖、风险、下一步。

允许 commit：仅用户明确要求时允许本地 commit；默认否。

允许部署：否。

允许连接测试数据库：允许，仅限测试库。

禁止连接生产数据库：是。

## 10. Phase 6：导入/快照/数据迁移工具

目标：实现批量导入、快照、导出和旧数据迁移工具的测试版。

允许范围：导入预览、确认导入、去重、CSV/JSON 导出、快照保存/列表/恢复预览、旧 Web 数据迁移脚本。

禁止范围：直接操作生产数据、无预览恢复、无备份清空、AI、体验版上传、生产部署。

可读文件范围：Phase docs、后端 Import/Snapshot、后台相关页面、迁移样例数据。

可改文件范围：后端 Import/Snapshot、后台导入/快照页面、迁移工具、测试、handoff。

数据库变更范围：测试库新增 `import_batches`、`snapshots` 或迁移辅助表；禁止生产 migration。

API 范围：`POST /api/imports/preview`、`POST /api/imports/confirm`、`GET/POST /api/snapshots`、`POST /api/snapshots/:id/restore-preview`、导出 API。

小程序范围：无。

后台范围：导入、导出、快照、恢复预览、去重。

测试命令：导入样例测试、快照保存/恢复预览测试、权限测试、导出文件检查、`git diff --check`。

验收标准：导入可预览再确认；快照恢复默认只预览；导出和危险操作有权限与审计。

停止条件：数据工具测试版完成后停止，真实迁移需单独授权。

交付报告格式：结论、迁移范围、导入/快照流程、测试数据、测试结果、回滚建议、风险。

允许 commit：仅用户明确要求时允许本地 commit；默认否。

允许部署：否。

允许连接测试数据库：允许，仅限测试库和样例数据。

禁止连接生产数据库：是。

## 11. Phase 7：AI 仿写/生成记录

目标：通过后端代理实现 AI 标题/文案仿写，并保存生成记录。

允许范围：AI 后端代理、模型配置占位、生成请求、生成记录、成本/耗时记录、后台配置只读或测试配置。

禁止范围：前端保存 API Key、日志打印密钥、绕过内容安全、生产部署、提审。

可读文件范围：Phase docs、后端 AI 模块、后台/小程序 AI 入口、测试。

可改文件范围：后端 AI、数据库 migration、后台/小程序 AI 入口、测试、handoff。

数据库变更范围：测试库新增/调整 `ai_generation_records` 和安全配置引用；禁止生产 migration。

API 范围：`POST /api/ai/generate-title`、`GET /api/ai/generation-records`。

小程序范围：发起生成、查看生成结果、采用/复制结果。

后台范围：生成记录查看、模型配置状态查看。

测试命令：AI mock 测试、生成记录测试、密钥泄漏检查、权限测试、`git diff --check`。

验收标准：AI Key 只在服务端私有配置；生成记录可追踪；失败有可读错误；无敏感信息进入响应或日志。

停止条件：AI 测试闭环完成后停止。

交付报告格式：结论、AI provider 配置方式、API、记录字段、测试结果、成本风险、合规风险。

允许 commit：仅用户明确要求时允许本地 commit；默认否。

允许部署：否。

允许连接测试数据库：允许，仅限测试库。

禁止连接生产数据库：是。

## 12. Phase 8：测试、灰度、腾讯轻量服务器部署准备

目标：完成发布前测试、灰度方案、服务器部署准备和合法域名预检查。

允许范围：测试计划、构建检查、测试环境部署准备、HTTPS 检查、Nginx 配置草案、域名/备案只读核对、回滚方案。

禁止范围：直接改生产服务器、直接改 DNS、直接执行生产部署、上传体验版、提审。

可读文件范围：Phase docs、部署文档、后端/小程序/后台配置、测试报告；服务器或域名信息只读且不得打印 secret。

可改文件范围：部署文档、示例配置、测试报告、handoff；代码修复仅限阻塞发布的最小 bug。

数据库变更范围：只允许测试库；生产 migration 只能写计划和回滚方案，不执行。

API 范围：测试环境 smoke；不得新增业务 API，除非是发布阻塞 bug 修复。

小程序范围：构建检查、合法域名配置清单、体验版前自查，不上传。

后台范围：构建检查、测试环境访问检查。

测试命令：后端测试、前端/小程序构建检查、API smoke、合法域名清单核对、`git diff --check`。

验收标准：测试报告完成；灰度和回滚方案明确；服务器/域名/HTTPS/备案待执行项清楚；无生产改动。

停止条件：发布准备报告完成后停止，等待 RELEASE_GATE 授权。

交付报告格式：结论、测试矩阵、部署准备、域名清单、回滚方案、阻塞项、是否可进 Phase 9。

允许 commit：仅用户明确要求时允许本地 commit；默认否。

允许部署：否，只允许准备。

允许连接测试数据库：允许，仅限测试库。

禁止连接生产数据库：是。

## 13. Phase 9：微信小程序体验版/提审前 RELEASE_GATE

目标：在显式授权下完成体验版、提审前检查和生产发布门禁。

允许范围：最终测试报告、版本号、体验版上传准备、微信合规材料、生产部署计划、生产 migration 计划、回滚计划、RELEASE_GATE 审批清单。

禁止范围：未授权上传体验版、未授权提审、未授权生产部署、未授权生产 migration、未备份直接改生产数据。

可读文件范围：Phase docs、发布清单、构建产物清单、测试报告、部署配置；secret 只允许读取状态或路径，不打印内容。

可改文件范围：release 文档、版本记录、必要的发布配置；代码改动只允许修复 RELEASE_GATE 阻塞项并重新测试。

数据库变更范围：生产 migration 默认禁止；只有用户明确授权、备份完成、回滚方案通过后才可执行。

API 范围：生产 smoke 计划；执行需单独授权。

小程序范围：体验版上传和提审前检查只有在用户明确授权后允许。

后台范围：生产后台 smoke 计划；执行需单独授权。

测试命令：全量发布前测试、构建检查、体验版本地预检、API smoke、数据库备份检查、`git diff --check`。

验收标准：RELEASE_GATE 清单全部通过；备份和回滚方案明确；隐私、备案、合法域名、HTTPS、内容安全均确认。

停止条件：用户审核 RELEASE_GATE 后再决定是否上传体验版、提审或部署。

交付报告格式：结论、版本、变更范围、测试证据、备份证据、回滚方案、合规清单、授权请求项。

允许 commit：允许，但必须由用户明确要求。

允许部署：默认否；只有用户明确授权后允许。

允许连接测试数据库：允许。

禁止连接生产数据库：默认是；只有 RELEASE_GATE 明确授权、备份和回滚方案通过后才可例外。

## 14. 全局失败 2 次 handoff 格式

同一问题连续失败 2 次后，必须停止并输出：

- 已读文件
- 已改文件
- git diff
- 已执行命令
- 失败命令
- 报错摘要
- 疑似根因
- 当前 git status
- 建议 Claude 只读分析的问题

要求：Claude 不直接改文件，只做根因分析，除非用户再次明确授权实施修复。

