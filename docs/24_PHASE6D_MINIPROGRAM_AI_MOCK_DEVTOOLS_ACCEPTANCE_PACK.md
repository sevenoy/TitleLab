# TitleLab Phase 6D Mini Program AI Mock DevTools Acceptance Pack

当前阶段：TITLELAB-MAXPLAN-PHASE6D-MINIPROGRAM-AI-MOCK-DEVTOOLS-ACCEPTANCE-PACK

Phase 6D 只为小程序 AI 标题生成 mock-only 页面准备微信开发者工具人工验收包。本阶段不进入 Phase 5E，不真实调用 OpenAI，不真实请求后端 AI，不连接真实数据库，不新增 migration，不新增依赖，不部署、不上传体验版、不提交审核。

## 1. Phase 6D 范围

本轮交付：

- DevTools 导入方式和手工验收路线。
- AI mock 页面人工测试用例。
- 首页入口验收路线。
- 复制、清空、重试、loading、error、empty、warning、result 状态验收说明。
- 截图清单。
- 问题记录模板。
- Phase 6D 静态 preflight。
- README、handoff 和验收清单追加说明。

本轮不交付：

- 真实 AI smoke。
- 后端 AI 真实请求。
- OpenAI SDK 或模型配置。
- 小程序登录 UI。
- 上传体验版或提交审核。

## 2. DevTools 导入方式

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择仓库内 `miniprogram/`，不要选择仓库根目录。
4. AppID 使用当前 `project.config.json` 中的 AppID 或微信开发者工具测试号；如需替换正式 AppID，必须另起 RELEASE_GATE。
5. 确认 `compileType=miniprogram`。
6. 确认 `setting.urlCheck=true`。
7. 只做本地预览和人工验收记录。

禁止在本阶段点击或执行：

- 上传。
- 版本管理里的体验版上传。
- 提交审核。
- 发布。
- 打开真实后端 gate。

## 3. AppID / 测试号提醒

当前配置只服务 DevTools 手工验收。若微信开发者工具提示 AppID、权限或登录态问题，本阶段只记录为环境问题，不在本轮修改正式 AppID、不写 AppSecret、不配置微信后台、不上传体验版。

## 4. Mock-only 页面验收范围

默认运行边界：

```text
apiMode=mock
realApiGateEnabled=false
authRealApiGateEnabled=false
aiRealApiGateEnabled=false
```

验收时应确认：

- AI 页面顶部出现 Mock-only / 本地 mock 提示。
- 页面不要求登录。
- 页面可在无网络状态下完成本地 mock 生成。
- sourceText 不上传。
- 小程序不直连 OpenAI。
- 真实 AI 与后端请求仍需后续 gate。

## 5. AI 页面验收路线

1. 从首页点击“AI 标题生成”进入 `pages/ai/index`。
2. 确认初始态展示输入框、预设示例、内容/语气/平台/数量选择器和生成按钮。
3. 空输入点击生成，确认错误态和重试入口。
4. 输入少于 6 个字，确认生成按钮不可用或错误提示可见。
5. 点击一个示例输入，确认字符计数更新。
6. 调整 `contentType`、`tone`、`platform`、`count` 组合。
7. 点击生成，确认 loading 态短暂出现。
8. 确认结果列表包含标题、rationale、tags、riskLevel、score。
9. 输入疑似敏感片段，确认 warning 态出现且结果不原样扩散敏感片段。
10. 返回首页，确认首页列表仍可浏览。

## 6. 首页入口验收路线

首页验收只覆盖入口可见和导航成功：

- 首页顶部存在“AI 标题生成”按钮。
- 点击后进入 AI 页面。
- 返回后首页列表、搜索、筛选仍保持 Phase 3A/3B mock 只读能力。

## 7. 复制 / 清空 / 重试验收

- 复制单条：生成结果后点击任意“复制标题”，应出现复制成功 toast。
- 复制全部：点击“复制全部”，剪贴板内容应包含编号后的全部标题。
- 清空：点击“清空”，输入、结果、warning、错误和复制状态应复位。
- 重试：生成结果后点击“重新生成”，应沿用上一轮 payload 生成；错误态里的“重试”只应在可重试或空输入错误时出现。

## 8. 截图清单

截图记录使用：

- `docs/qa/PHASE6D_MINIPROGRAM_AI_MOCK_SCREENSHOT_CHECKLIST.md`

本仓库不要求提交截图文件；截图路径只写入本地验收记录或 bug report。

## 9. 问题记录模板

问题记录使用：

- `docs/qa/PHASE6D_MINIPROGRAM_AI_MOCK_BUG_REPORT_TEMPLATE.md`

记录应包含设备/模拟器、微信开发者工具版本、基础库版本、复现步骤、预期结果、实际结果、截图路径、控制台错误、是否阻塞和建议优先级。

## 10. 禁止项

Phase 6D 禁止：

- 进入 Phase 5E。
- 真实调用 OpenAI。
- 读取、打印或写入真实 OpenAI key。
- 小程序直连模型服务。
- 打开 `realApiGateEnabled`、`authRealApiGateEnabled` 或 `aiRealApiGateEnabled`。
- 默认真实请求后端。
- 连接真实数据库或执行真实数据库 migration。
- 新增或修改 migration。
- 修改 `backend/alembic/**`、`backend/app/db/**`、`backend/app/models/**`。
- 新增依赖。
- 新增内容 CRUD 写接口。
- 部署、上传体验版、提交审核或发布。
- 提交 `miniprogram/project.private.config.json`。

## 11. 测试命令

从仓库根目录运行：

```bash
python3 scripts/titlelab_phase6d_miniprogram_devtools_acceptance_check.py
```

配套本地检查：

```bash
python3 - <<'PY'
import json
from pathlib import Path
for p in [
    "miniprogram/app.json",
    "miniprogram/project.config.json",
    "miniprogram/sitemap.json",
    "miniprogram/pages/index/index.json",
    "miniprogram/pages/detail/detail.json",
    "miniprogram/pages/ai/index.json",
]:
    json.loads(Path(p).read_text(encoding="utf-8"))
print("json ok")
PY
find miniprogram -maxdepth 6 -name "*.js" -print -exec node --check {} \;
python3 scripts/titlelab_phase6c_miniprogram_ai_acceptance_check.py
python3 scripts/titlelab_phase6d_miniprogram_devtools_acceptance_check.py
git diff --check
```

这些命令只做本地静态检查，不请求后端、不调用微信、不调用 OpenAI、不连接数据库、不读取真实 secret。

## 12. 已知风险

- DevTools 手动验收不等同于真机发布验收。
- 当前标题质量只代表本地 mock，不代表真实模型输出。
- 网络关闭测试只验证 mock 页面可用，不代表真实 API 离线策略。
- AppID、合法域名、隐私指引、测试成员和体验版上传仍属于后续 RELEASE_GATE。

## 13. 下一步建议

下一步最小建议是用微信开发者工具导入 `miniprogram/`，按 `docs/qa/PHASE6D_MINIPROGRAM_AI_MOCK_MANUAL_TEST_CASES.md` 执行人工验收并记录截图/问题；仍不上传体验版、不提交审核、不打开真实 gate。
