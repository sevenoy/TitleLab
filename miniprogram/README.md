# TitleLab Mini Program

当前目录是 TitleLab Phase 6G 小程序合规前端源码。请在微信开发者工具中导入本目录，而不是仓库根目录或旧 Phase worktree。

## 当前范围

- 默认入口为产品账号登录页。
- 登录页包含用户服务协议、隐私政策和默认未勾选的协议复选框。
- 首页为标题/文案库，支持搜索、分类筛选、复制、新增、修改、删除入口。
- 设置页提供协议、隐私政策、账号注销与数据删除说明、版本信息和退出登录。
- 隐私政策说明信息处理、授权同意、账号注销、对外提供、微信用户信息、设备能力和剪贴板规则。
- 用户服务协议说明用户责任、禁止行为、内容来源授权、账号停用和注销联系路径。
- 已移除历史外部能力页面和未引用服务；当前个人主体安全版不保留相关用户可见能力。

## 当前边界

- 当前登录只使用本地产品账号态，不调用微信登录能力。
- 当前页面不要求微信账号、微信密码或微信验证码。
- `config/env.js` 保持真实请求开关关闭。
- 小程序源码包不保留历史外部能力页面、相关 service 或对应写请求白名单。
- 页面不得直接调用 `wx.request` 或 `wx.login`。
- `wx.request` 只保留在 `services/request.js`。
- `wx.login` 只保留在 `adapters/wechat.js`。
- 复制统一通过 `adapters/wechat.js` 封装，只在用户点击复制时写入剪贴板。
- 不读取剪贴板。
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
- `appid=wx2f9db77f2383b42e`
- `compileType=miniprogram`
- `urlCheck=true`

## Phase 6G 本地检查

```bash
python3 scripts/titlelab_phase6g_miniprogram_compliance_check.py
find miniprogram -maxdepth 6 -name "*.js" -print -exec node --check {} \;
git diff --check
```

## 后续接入规则

后续接真实后端、真实登录、外部能力、体验版上传或提审，都必须另起独立 Phase 和 RELEASE_GATE。本目录不得保存真实密钥或前端直连外部模型服务。若未来恢复外部内容能力，必须在主体、服务类目、备案和合规材料齐全后另起独立 Phase。
