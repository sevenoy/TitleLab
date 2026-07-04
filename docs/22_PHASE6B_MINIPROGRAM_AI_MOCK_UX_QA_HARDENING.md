# TitleLab Phase 6B Mini Program AI Mock UX QA Hardening

当前阶段：TITLELAB-MAXPLAN-PHASE6B-MINIPROGRAM-AI-MOCK-UX-QA-HARDENING

Phase 6B 只打磨小程序 AI 标题生成 mock-only 页面体验。本阶段不进入 Phase 5E，不执行真实 OpenAI 调用，不请求真实后端 AI，不连接真实数据库，不新增 migration，不部署、不上传体验版、不提交审核。

## 1. Scope

Phase 6B 覆盖：

- AI 页面 sourceText 字符计数、输入校验和本地 helper text。
- 香港迪士尼旅拍、摄影师跟拍、求婚记录等本地预设示例。
- 生成 loading、错误态、空态、暂无结果态和 warnings 展示。
- 结果卡片视觉层级、风险等级、匹配度和标签展示。
- 复制单个标题、copy all / 复制全部、清空和重新生成。
- `services/aiMock.js` 场景化稳定 mock 输出和疑似敏感片段脱敏。
- Phase 6B 本地静态 preflight。

## 2. Mock-only UX Boundary

本轮默认仍为：

```text
apiMode=mock
realApiGateEnabled=false
authRealApiGateEnabled=false
aiRealApiGateEnabled=false
```

AI 页面不强制登录，不调用后端 AI，不上传 sourceText，不直连 OpenAI，不保存或传入客户端 key。复制仍通过 `adapters/wechat.js` 的 clipboard 封装，页面不直接调用 `wx.request` 或 `wx.login`。

## 3. AI Mock Enhancements

`services/aiMock.js` 保持后端 Phase 5A schema 对齐：

```text
title
rationale
tags
riskLevel
score
```

增强点：

- `count` 继续裁剪到 5 条。
- `contentType`、`tone`、`platform` 会影响 mock 文案和标签。
- 本地场景覆盖香港迪士尼旅拍、摄影师跟拍、女生单人写真、情侣 / 求婚、街拍 / 旅拍。
- 疑似敏感输入不原样扩散到标题，返回 `SECRET_LIKE_INPUT_REDACTED` warning。
- 空输入稳定返回 `AI_EMPTY_INPUT`。

## 4. UX QA Checks

新增检查命令：

```bash
python3 scripts/titlelab_phase6b_miniprogram_ai_mock_ux_check.py
```

检查覆盖：

- Phase 4D / 4E / 5B / 5C / 5D / 6 preflight 仍通过。
- 小程序 JSON 可解析。
- 真实 gate 默认关闭。
- AI 页面具备预设示例、字符计数、copy all、retry、warnings 和 mock-only notice。
- AI mock 保持 schema 字段、场景化输出、count clamp 和脱敏 warning。
- 页面不直接调用 `wx.request` 或 `wx.login`。
- 小程序无 OpenAI direct marker 或 secret marker。
- 未修改 backend migration/db/models。
- 未新增依赖。
- `project.private.config.json` 未被跟踪。

## 5. Non-goals

Phase 6B 不做：

- Phase 5E live smoke。
- 真实 OpenAI 调用。
- 小程序真实后端 AI 请求。
- 新增 OpenAI SDK 或依赖。
- 后端 migration、models、db 变更。
- 内容创建、编辑、删除、导入或快照执行。
- 部署、上传体验版或提交审核。

## 6. Risks And Next Step

风险：

- 当前标题质量只代表本地 mock 体验，不代表真实模型输出。
- 页面预设是少量本地样例，不是外部数据集。
- 真实 AI 接入仍必须单独 gate，并继续保持小程序不直连模型服务。

下一步最小建议：

如需真实 AI smoke，另起 Phase 5E RELEASE_GATE；如需小程序接后端 AI mock/test API，另起 Phase 6C，并继续保持真实 gate 默认关闭。
