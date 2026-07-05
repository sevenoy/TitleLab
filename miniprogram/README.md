# TitleLab Mini Program

当前目录是 TitleLab Phase 6F 小程序本地示例源码。请在微信开发者工具中导入本目录，而不是仓库根目录或旧 Phase 3 worktree。

## 当前范围

- 首页为蓝白工具风格的标题/文案库。
- 顶部包含 THE、标题 / 文案、S 用户按钮和退出按钮。
- 分类管理保留计数、上移、下移、改。
- 标题 Tab 支持搜索标题关键词、账号分类和标题列表。
- 文案 Tab 支持搜索文案关键词、账号分类和文案列表。
- 标题行内支持 `AI 标题灵感` 本地示例面板。
- 文案支持当前卡片展开，并显示 `AI 文案助手` 本地示例面板。
- 复制统一通过 `adapters/wechat.js` 封装。

## 当前边界

- 默认数据是页面内本地示例。
- `config/env.js` 仍保持 mock 模式，真实请求开关关闭。
- 页面不得直接调用 `wx.request` 或 `wx.login`。
- `wx.request` 只保留在 `services/request.js`。
- `wx.login` 只保留在 `adapters/wechat.js`。
- 不连接真实数据库。
- 不执行真实 migration。
- 不上传体验版。
- 不提交审核。
- 不修改微信开发者工具缓存目录。

## DevTools 导入

导入路径：

```text
/Users/lorenmac/Claude/Projects/TitleLab/miniprogram
```

`project.config.json` 当前保持：

- `projectname=TitleLab`
- `appid=wx5d7766982eebe9fc`
- `compileType=miniprogram`
- `urlCheck=true`

## Phase 6F 本地检查

```bash
python3 scripts/titlelab_phase6f_miniprogram_original_ui_sync_check.py
find miniprogram -maxdepth 6 -name "*.js" -print -exec node --check {} \;
git diff --check
```

## 后续接入规则

后续接真实后端、真实登录、真实 AI 服务、体验版上传或提审，都必须另起独立 Phase 和 RELEASE_GATE。本目录不得保存真实密钥或前端直连外部 AI 服务。
