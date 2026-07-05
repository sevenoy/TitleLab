# TitleLab Phase 6G Mini Program Compliance UI Login Privacy Fix

当前阶段：TITLELAB-MAXPLAN-PHASE6G-MINIPROGRAM-COMPLIANCE-UI-LOGIN-PRIVACY-FIX

Phase 6G 在独立 worktree 中完成微信小程序合规前端整改。本阶段不真实请求后端、不连接数据库、不执行 migration、不部署、不上传体验版、不提交审核。

## 1. 本轮目标

- 修复小程序窄屏 UI：分类文字不竖排、按钮不横向溢出、标题/文案列表操作完整显示、展开文案不遮挡、顶部 Tab 不变形、页面不横向滚动。
- 删除用户可见高风险词和历史演示语境。
- 新增产品账号登录页、协议勾选、隐私政策、用户服务协议、设置页和退出登录。
- 保留标题/文案库、搜索、分类、复制、新增、修改、删除等个人主体提审更安全的产品能力。

## 2. 修改范围

新增：

- `miniprogram/pages/login/index.*`
- `miniprogram/pages/settings/index.*`
- `miniprogram/pages/legal/privacy.*`
- `miniprogram/pages/legal/terms.*`
- `scripts/titlelab_phase6g_miniprogram_compliance_check.py`
- `docs/27_PHASE6G_MINIPROGRAM_COMPLIANCE_UI_LOGIN_PRIVACY_FIX.md`

更新：

- `miniprogram/app.json`
- `miniprogram/adapters/wechat.js`
- `miniprogram/config/env.js`
- `miniprogram/app.js`
- `miniprogram/services/request.js`
- `miniprogram/pages/index/index.js`
- `miniprogram/pages/index/index.wxml`
- `miniprogram/pages/index/index.wxss`
- `miniprogram/README.md`
- `docs/08_HANDOFF.md`
- `docs/07_ACCEPTANCE_CHECKLIST.md`

删除：

- `miniprogram/pages/ai/**`
- `miniprogram/services/aiApi.js`
- `miniprogram/services/aiMock.js`
- `miniprogram/services/aiRepository.js`
- `miniprogram/services/aiResultNormalizer.js`

## 3. 登录链路

默认入口为 `pages/login/index`。登录页展示 `TitleLab` 和 `本产品账号登录`，说明不要求微信账号、微信密码或微信验证码。

协议复选框默认未勾选。未勾选点击登录时提示：

```text
请先阅读并勾选《用户服务协议》《隐私政策》后再继续。
```

当前仅使用本地产品账号态。Phase 6H 已将本地登录账号调整为 `olina` 首次本机设置密码，以及审核检查账号 `test / test`；本阶段不调用 `wx.login`、不使用手机号能力、不读取微信头像或昵称。

## 4. 首页 UI

首页保留蓝白工具风格，并改为更稳的移动端布局：

- 顶部 `THE`、标题/文案 Tab、设置入口同一行，Tab 使用弹性宽度。
- 分类列表使用横向名称加计数，操作按钮可换行，避免分类名竖排。
- 工具区按钮使用两列网格，避免窄屏横向溢出。
- 标题/文案列表操作按钮使用两列网格，完整显示复制、展开、修改、删除。
- 文案展开内容留在当前卡片内，使用块级文本和自动换行。

## 5. 隐私政策

隐私政策覆盖：

- 信息处理原则。
- 可能处理的信息类型。
- 授权与同意。
- 账号注销与数据删除。
- 对外提供。
- 微信头像、昵称、手机号、通讯录、位置、相册、相机、麦克风等说明。
- 剪贴板写入规则。
- 联系邮箱占位：`example@example.com`，发布前必须替换。

当前小程序不主动获取或展示微信头像、昵称、手机号、通讯录、位置、相册、相机、麦克风等信息或设备能力；如后续新增，必须更新说明并请求授权。

## 6. 用户服务协议

协议覆盖：

- 服务内容。
- 用户责任。
- 禁止行为。
- 不得收集、出售、转让、泄露他人个人信息。
- 内容来源合法和必要授权。
- 账号限制、停用、注销和联系路径。

## 7. 剪贴板合规

当前仅在用户点击标题或文案的复制按钮后调用 `setClipboardData`。不使用 `getClipboardData`，不在 `onLoad` 或 `onShow` 默认读写剪贴板。

## 8. AI 残留清理

Phase 6G 面向个人主体提审安全版，已移除历史 AI 页面、未引用 AI service 和 AI 写请求白名单。当前 `app.json` 不再路由 `pages/ai/index`，当前小程序用户可见源码不保留 AI、生成式、深度合成、mock 或本地示例文案。

若未来恢复 AI 能力，必须在企业主体、服务类目、算法备案、隐私说明、内容安全和后端代理均齐全后另起独立 Phase，不得在 Phase 6G 或个人主体安全版中直接恢复。

## 9. 禁止项确认

本阶段禁止并保持：

- 不真实请求后端。
- 不真实调用外部模型服务。
- 不保留用户可见 AI 能力。
- 不调用 `api.openai.com`。
- 不读取或写入真实密钥。
- 不连接真实数据库。
- 不执行 migration。
- 不新增依赖。
- 不修改微信开发者工具缓存。
- 不修改旧 Phase 3 worktree。
- 不部署、不上传体验版、不提交审核。
- 不提交 `miniprogram/project.private.config.json`。

## 10. 检查命令

```bash
python3 scripts/titlelab_phase6g_miniprogram_compliance_check.py
find miniprogram -maxdepth 6 -name "*.js" -print -exec node --check {} \;
python3 -m compileall backend/app backend/tests
cd backend && uv run --no-project --with fastapi --with uvicorn --with sqlalchemy --with alembic --with pydantic-settings --with pytest --with httpx python -m pytest
git diff --check
```

## 11. 下一步

下一步最小建议是在微信开发者工具中导入当前主仓库 `miniprogram/`，只做本地手动视觉验收和协议链路检查；仍不上传体验版、不提交审核、不打开真实请求。
