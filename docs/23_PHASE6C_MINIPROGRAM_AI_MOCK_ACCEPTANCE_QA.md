# TitleLab Phase 6C Mini Program AI Mock Acceptance QA

当前阶段：TITLELAB-MAXPLAN-PHASE6C-MINIPROGRAM-AI-MOCK-ACCEPTANCE-QA

Phase 6C 只做小程序 AI 标题生成 mock-only 页面验收收口、DevTools 导入前检查和本地静态 preflight。本阶段不进入 Phase 5E，不真实调用 OpenAI，不真实请求后端 AI，不连接真实数据库，不新增 migration，不新增依赖，不部署、不上传体验版、不提交审核。

## 1. Scope

Phase 6C 覆盖：

- AI 页面输入、示例、字符计数、生成按钮禁用态和本地校验。
- loading、error、empty、no-result、warning、result cards 的验收覆盖。
- copy single、copy all、clear、retry 的验收覆盖。
- 清空后页面状态复位，重试沿用上一次输入。
- 输入上限提示和 mock-only 提示保持可见。
- DevTools 导入前本地检查脚本。
- Phase 6C 人工验收清单和 handoff 更新。

## 2. Mock-only Behavior

当前默认仍为：

```text
apiMode=mock
realApiGateEnabled=false
authRealApiGateEnabled=false
aiRealApiGateEnabled=false
```

AI 页面行为：

- 不强制登录。
- 不调用 `wx.login`。
- 不调用后端 AI。
- 不上传 `sourceText`。
- 不直连 OpenAI。
- 不读取、写入或打印真实 `OPENAI_API_KEY`。
- 复制能力继续通过 `adapters/wechat.js` 封装。

## 3. DevTools Import Precheck

导入微信开发者工具前确认：

- 导入路径是仓库内 `miniprogram/`，不是主仓库根目录。
- `miniprogram/project.config.json` 可解析。
- `compileType=miniprogram`。
- `setting.urlCheck=true`。
- `pages/index/index`、`pages/detail/detail`、`pages/ai/index` 已注册。
- `miniprogram/project.private.config.json` 未被 git 跟踪。
- 小程序文件不包含 AppSecret、OpenAI key、DB password、token、cookie。

## 4. Acceptance Checklist

- [x] AI 页面四件套存在：`index.js`、`index.json`、`index.wxml`、`index.wxss`。
- [x] 首页存在 AI 标题生成入口。
- [x] `aiMock`、`aiRepository`、`aiApi`、`aiResultNormalizer` 存在。
- [x] mock-only 文案可见。
- [x] sourceText 字符计数存在。
- [x] 输入过短会阻止生成。
- [x] 输入过长会被页面上限截断并提示。
- [x] 生成按钮在 loading 或输入不足时禁用。
- [x] copy single / copy all 存在。
- [x] clear / retry 存在。
- [x] loading / error / empty / no-result / warning 状态存在。
- [x] 页面不直接 `wx.request`。
- [x] 页面不直接 `wx.login`。
- [x] `wx.request` 只在 `services/request.js`。
- [x] `wx.login` 只在 `adapters/wechat.js`。
- [x] 小程序无 OpenAI 直连 marker。
- [x] 小程序无真实 secret marker。
- [x] 未修改 backend migration / models / db。
- [x] 未新增依赖。

## 5. Preflight

从仓库根目录运行：

```bash
python3 scripts/titlelab_phase6c_miniprogram_ai_acceptance_check.py
```

该脚本只做本地静态检查，不请求后端、不调用微信、不调用 OpenAI、不连接数据库、不读取 secret value。

检查覆盖：

- Phase 4D / 4E / 5B / 5C / 5D / 6 / 6B preflight 仍通过或仅因当前 Phase 6C 小程序 diff 被允许。
- 小程序 JSON 可解析。
- AI 页面路由、四件套和 service/repository/mock/api 文件存在。
- DevTools 导入前检查项存在。
- 默认 mock，真实 gate 默认关闭。
- 页面状态、复制、清空、重试和 mock-only 文案存在。
- 页面不直接调用 `wx.request` 或 `wx.login`。
- 小程序无 OpenAI direct marker 或 secret marker。
- 未修改 backend migration/db/models。
- 未新增依赖。
- `project.private.config.json` 未被跟踪。

## 6. Non-goals

Phase 6C 不做：

- Phase 5E live smoke。
- 真实 OpenAI 调用。
- 小程序真实后端 AI 请求。
- 新增 OpenAI SDK 或依赖。
- 打开 `realApiGateEnabled`、`authRealApiGateEnabled` 或 `aiRealApiGateEnabled`。
- 后端 migration、models、db 变更。
- 内容创建、编辑、删除、导入或快照执行。
- 部署、上传体验版或提交审核。

## 7. Risks And Next Step

风险：

- 当前标题质量只代表本地 mock 体验，不代表真实模型输出。
- DevTools 导入前检查是静态检查，不等同于真机视觉验收。
- 真实 AI 接入仍必须单独 gate，并继续保持小程序不直连模型服务。

下一步最小建议：

如需真实 AI smoke，另起 Phase 5E RELEASE_GATE；如需真机视觉验收，先只做 DevTools 手工验收记录，不上传体验版、不提交审核、不打开真实 gate。
