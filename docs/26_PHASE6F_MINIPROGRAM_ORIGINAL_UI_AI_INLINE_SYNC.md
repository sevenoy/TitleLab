# TitleLab Phase 6F Mini Program Original UI Inline AI Sync

## 1. 本轮目标

Phase 6F 将 Phase 6E 的 Web/PWA 原 UI 行内 AI 交互，同步到当前主仓库的微信小程序源码 `miniprogram/`。本轮只做小程序本地示例 UI，不接真实后端、不接外部 AI 服务、不部署、不上传体验版、不提交审核。

## 2. 为什么 Phase 6E 不影响小程序

Phase 6E 修改的是 Web/PWA 文件：`index.html`、`title.html`、`content.html`、`assets/app-title.js`、`assets/app-content.js`、`assets/styles.css`。微信开发者工具导入的是 `miniprogram/`，不会加载这些浏览器 DOM 文件，所以 Phase 6E 的行内面板不会自动出现在小程序模拟器里。

## 3. 当前 DevTools 旧 UI 原因

微信开发者工具当前看到旧 UI，根因是小程序源码仍停留在早期只读列表首页：绿色导航、旧搜索筛选区和内容卡片。Phase 6F 已在当前 Phase worktree 中替换 `miniprogram/pages/index/` 首页，而不是改开发者工具缓存。

## 4. 不能修改的位置

- 不修改 `/Users/lorenmac/Library/Application Support/微信开发者工具/**`。
- 不修改 `/Users/lorenmac/Claude/Projects/TitleLab-worktrees/phase3-miniprogram-readonly-mvp/**`。
- 不提交 `miniprogram/project.private.config.json`。

## 5. 本轮修改范围

- `miniprogram/app.json`：导航改为蓝白风格。
- `miniprogram/pages/index/index.js`：本地标题/文案库状态和交互。
- `miniprogram/pages/index/index.wxml`：THE、标题/文案、分类管理、列表与行内面板。
- `miniprogram/pages/index/index.wxss`：蓝白工具风格。
- `miniprogram/config/env.js`：版本标记更新，真实请求开关仍关闭。
- `miniprogram/services/aiRepository.js`：调整一个本地展示错误文案，避免旧禁用文案出现在扫描里。
- `scripts/titlelab_phase6f_miniprogram_original_ui_sync_check.py`：Phase 6F 静态检查。
- `docs/26_PHASE6F_MINIPROGRAM_ORIGINAL_UI_AI_INLINE_SYNC.md`、`docs/08_HANDOFF.md`、`docs/07_ACCEPTANCE_CHECKLIST.md`、`miniprogram/README.md`：交付说明。

## 6. 小程序标题/文案库结构

首页改为原 UI 同步结构：

- THE logo、标题 / 文案双 Tab、S 用户按钮、退出按钮。
- 分类管理卡片，保留全部、亲子、氛围、情侣、闺蜜、单人、街拍、口碑推荐、节日及计数。
- 搜索区根据 Tab 显示“搜索标题关键词”或“搜索文案关键词”。
- 账号分类选择器。
- 新增标题 / 新增文案、批量导入、设为本机默认、主题设置、管理页面。

## 7. 标题 AI 行内面板

标题列表每条保留 `⭐ 序号 + 标题正文 + 复制 + ✨AI + 修改 + 删除`。点击 `✨AI` 后，用 `activeAiTitleId` 在当前标题下方展示 `AI 标题灵感`，显示“本地示例”、当前标题引用、模式 chips、3 条本地结果、复制、加入标题库、换一批和关闭。

## 8. 文案下拉展开与文案 AI 面板

文案列表使用 `expandedCopyId` 控制当前文案展开，内容在卡片内显示完整多行文案和话题标签。点击文案 `✨AI` 会先展开当前文案，再用 `activeCopyAiId` 显示 `AI 文案助手`，支持提取标题、改写文案、生成话题、精简文案四组本地示例。

## 9. 分类下拉保护

AI 入口只出现在标题/文案列表行内，不插入分类列表内部。分类行仍只包含名称、计数、上移、下移、改。

## 10. project.config 结果

`miniprogram/project.config.json` 保持：

- `projectname=TitleLab`
- `appid=wx5d7766982eebe9fc`
- `compileType=miniprogram`
- `urlCheck=true`

## 11. DevTools 重新导入路径

如果微信开发者工具仍显示旧小程序 UI，请重新导入：

```text
/Users/lorenmac/Claude/Projects/TitleLab/miniprogram
```

不要导入旧 Phase 3 worktree，也不要修改开发者工具缓存目录。

## 12. 禁止项

- 不接真实后端请求。
- 不接外部 AI 服务。
- 不读取或写入真实密钥。
- 不新增依赖。
- 不新增 migration。
- 不修改 `backend/alembic/**`、`backend/app/db/**`、`backend/app/models/**`。
- 不新增业务写接口。
- 不部署、不上传体验版、不提交审核。

## 13. 测试命令

```bash
python3 scripts/titlelab_phase6f_miniprogram_original_ui_sync_check.py
find miniprogram -maxdepth 6 -name "*.js" -print -exec node --check {} \;
python3 scripts/titlelab_phase6e_original_ui_ai_inline_check.py
python3 -m compileall backend/app backend/tests
cd backend && uv run --no-project --with fastapi --with uvicorn --with sqlalchemy --with alembic --with pydantic-settings --with pytest --with httpx python -m pytest
git diff --check
```

## 14. 手动验收清单

- [ ] 导入当前主仓库 `miniprogram/`。
- [ ] 首页顶部为蓝白工具风格，能看到 THE、标题 / 文案、S、退出。
- [ ] 标题 Tab 可见分类管理、搜索标题关键词、账号分类和操作按钮。
- [ ] 标题行点击 `✨AI` 后在当前行下方显示 AI 标题灵感。
- [ ] 文案 Tab 可见搜索文案关键词和文案列表。
- [ ] 文案箭头可展开完整内容。
- [ ] 文案 `✨AI` 可显示 AI 文案助手。
- [ ] 分类区没有插入 AI 入口。
- [ ] 复制按钮只复制本地示例文本。
