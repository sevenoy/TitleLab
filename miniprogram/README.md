# TitleLab Mini Program

当前目录是 Phase 3A 小程序只读 MVP 骨架。

## 当前范围

- 首页展示本地样例标题和文案。
- 支持关键词搜索、类型筛选、分类筛选和标签筛选。
- 详情页展示正文、分类、标签、使用建议和备注。
- 详情页支持复制标题或正文。

## 当前边界

- 数据来自 `services/contentMock.js`。
- 页面通过 `services/contentRepository.js` 读取内容；当前 repository 默认走本地 mock 数据。
- 微信平台能力统一通过 `adapters/wechat.js` 封装，页面不直接散落请求能力。
- 当前不访问网络。
- 当前不连接数据库。
- 当前不包含登录、收藏、历史、导入、快照、AI 或后台能力。
- 当前不包含真实应用标识、前端密钥、令牌或数据库配置。

## Phase 3B 分层

- `config/env.js`：声明当前为 `mock` 模式，real API gate 默认关闭。
- `adapters/wechat.js`：封装导航、剪贴板、提示、网络状态和本地存储适配。
- `services/request.js`：保留只读请求边界，但当前不配置真实域名，也不会发起真实网络访问。
- `services/contentApi.js`：预留后续只读内容接口映射。
- `services/contentRepository.js`：统一内容读取入口，当前默认委托 `contentMock.js`。

## 后续接入规则

后续接入真实只读接口必须单独开启 gate，并继续限制在 Phase 2 已验收的只读内容接口和公开 meta 接口内。
