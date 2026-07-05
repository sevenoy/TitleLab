# TitleLab Phase 6I Mini Program Mature Product UI Redesign

当前阶段：TITLELAB-PHASE6I-MINIPROGRAM-MATURE-PRODUCT-UI-REDESIGN

Phase 6I 在独立 worktree 中完成微信小程序首页成熟产品 UI 重构。本阶段不接真实后端、不连接数据库、不执行 migration、不部署、不上传体验版、不提交审核。

## 1. 人工验收失败点

DevTools 人工验收发现 Phase 6G/6H 后首页仍偏后台表单：

- 分类管理默认展开，占据首屏过多空间。
- 分类行过高，按钮像后台表格操作。
- 首页核心列表被挤到下方。
- 顶部同时承载品牌、切换和设置，层级混乱。
- 低频操作堆在首页首屏。
- 底部操作存在被 iPhone home indicator 遮挡的风险。

## 2. 本轮目标

- 首页首屏优先展示核心业务：品牌、账号状态、标题/文案切换、搜索、分类筛选、新增和列表。
- 分类筛选改为横向 chips。
- 分类管理动作移入单独分类管理页。
- 标题/文案卡片更紧凑，操作按钮小型化。
- 低频工具移入设置页。
- 登录、协议、隐私、`olina` 本机密码和 `test / test` 逻辑保持不变。

## 3. 首页信息架构

首页调整为四层结构：

1. 品牌与账号状态：小号 `THE` 标识、`TitleLab`、产品账号状态、设置入口。
2. 标题/文案 segmented control。
3. 搜索框与新增按钮。
4. 账号筛选、横向分类 chips 和列表卡片。

首页不再默认展示分类上移、下移、改名操作。

## 4. 分类管理

新增 `miniprogram/pages/categories/index.*`：

- 首页只保留 `全部`、`亲子`、`氛围`、`情侣`、`单人`、`街拍` chips。
- 首页右侧 `管理` 进入分类管理页。
- 分类管理页每个分类一行，包含分类名、数量、上移、下移、改名。
- 默认分类显示 `默认`，不展示管理按钮。

## 5. 操作按钮和安全区

- 新增标题 / 新增文案放在搜索区右侧。
- 列表操作按钮改为小型胶囊按钮。
- 不使用底部固定操作栏。
- 页面底部 padding 使用 `env(safe-area-inset-bottom)`，避免 home indicator 遮挡内容。

## 6. 合规边界

本阶段保持：

- 不恢复用户可见 AI、智能、生成式、mock、本地示例等高风险词。
- 不调用 `getPhoneNumber`、`wx.getUserProfile`、`wx.getUserInfo`、`getClipboardData`。
- 页面不直接调用 `wx.request` 或 `wx.login`。
- 复制仍只由用户点击复制触发。
- 不提交 `miniprogram/project.private.config.json`。
- 未修改 `backend/alembic/**`、`backend/app/db/**`、`backend/app/models/**`。

## 7. 手动验收清单

- 登录页协议默认未勾选，未勾选登录会拦截。
- `olina` 首次本机设置密码和复登校验正常。
- `test / test` 可登录。
- 首页首屏能看到搜索、分类 chips、列表和新增按钮。
- 分类 chips 可横向滑动，分类文字不竖排。
- 点击 `管理` 进入分类管理页。
- 标题列表复制、修改、删除按钮不溢出。
- 文案列表展开/收起、复制、修改、删除按钮不溢出。
- 设置页保留协议、隐私、重置本机账号密码、退出登录。

## 8. 检查命令

```bash
python3 scripts/titlelab_phase6g_miniprogram_compliance_check.py
python3 scripts/titlelab_phase6h_miniprogram_login_accounts_check.py
python3 scripts/titlelab_phase6i_miniprogram_ui_check.py
find miniprogram -maxdepth 6 -name "*.js" -print -exec node --check {} \;
git diff --check
```
