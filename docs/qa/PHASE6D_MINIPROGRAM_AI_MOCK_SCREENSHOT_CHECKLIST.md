# Phase 6D Mini Program AI Mock Screenshot Checklist

本清单用于 DevTools/manual acceptance 截图记录。本仓库不要求提交截图文件；如需保存截图，请记录本地截图路径并避免包含真实 secret、token、cookie、用户隐私或生产数据。

## 截图项

- [ ] 首页入口截图：显示首页和“AI 标题生成”入口。
- [ ] AI 页面初始态：显示 Mock-only、本地 mock 提示、输入框和选项。
- [ ] 示例输入态：点击示例后输入框已填充，字符计数更新。
- [ ] loading 态：点击生成后短暂显示“正在生成 mock 标题”，如手动可捕捉。
- [ ] 结果列表态：显示 provider/model、结果条数、标题卡片、tags、riskLevel、score。
- [ ] warning 态：使用假敏感片段输入后显示 warning。
- [ ] 空输入错误态：空输入生成后显示错误文案和重试入口。
- [ ] 复制成功 toast：复制单条标题后出现成功 toast。
- [ ] 清空后状态：输入和结果复位。
- [ ] 重试后状态：重新生成后仍展示 mock 结果。

## 截图命名建议

```text
phase6d_home_ai_entry.png
phase6d_ai_initial.png
phase6d_ai_example_input.png
phase6d_ai_loading.png
phase6d_ai_results.png
phase6d_ai_warning.png
phase6d_ai_empty_error.png
phase6d_ai_copy_toast.png
phase6d_ai_after_clear.png
phase6d_ai_after_retry.png
```

## 验收记录

- DevTools 版本：
- 基础库版本：
- 模拟器设备：
- 截图保存目录：
- 未能截图项及原因：

## 边界

- 不上传体验版。
- 不提交审核。
- 不使用真实 secret 或真实用户隐私内容做截图。
- 不把截图产物提交到本仓库。
