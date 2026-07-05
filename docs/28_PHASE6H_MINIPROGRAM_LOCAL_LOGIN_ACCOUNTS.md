# TitleLab Phase 6H Mini Program Local Login Accounts

当前阶段：TITLELAB-PHASE6H-MINIPROGRAM-LOCAL-LOGIN-ACCOUNTS

Phase 6H 在独立 worktree 中完成小程序本地登录账号配置修复。本阶段不接真实后端、不连接数据库、不执行 migration、不部署、不上传体验版、不提交审核。

## 1. 本轮目标

- 将本地登录从旧审核账号调整为自用账号和审核检查账号。
- 自用账号为 `olina`，密码由用户首次在本机登录时自行设置。
- 审核检查账号为 `test / test`。
- 保持协议勾选、隐私政策、用户服务协议和设置页退出登录链路。
- 设置页新增重置本机账号密码入口，仅清除本机保存的 `olina` 密码。

## 2. 本地账号规则

自用账号：

- 用户名：`olina`
- 密码：用户首次在本机登录时输入任意非空密码并保存到本机。
- 后续登录必须输入同一个本机密码。
- 设置页可清除本机保存的 `olina` 密码，清除后下次登录可重新设置。

审核检查账号：

- 用户名：`test`
- 密码：`test`
- 仅用于本地和审核检查。
- 不连接后端，不影响 `olina` 本机密码。

错误处理：

- 密码为空时提示：`请输入产品密码。`
- 账号或密码不匹配时提示：`账号或密码不正确。`
- 未勾选协议时提示：`请先阅读并勾选《用户服务协议》《隐私政策》后再继续。`

## 3. 存储边界

本阶段通过 `miniprogram/services/localAuth.js` 统一封装本地账号态：

- `titlelab.local.owner.password`：仅保存本机 `olina` 密码。
- `titlelab.local.login.session`：仅保存本地登录态。

本阶段不保存真实 token，不命名为 Token 或 Gate，不写入用户真实密码，不要求用户把真实密码发给 Codex。

## 4. 合规边界

- 登录页继续显示 `本产品账号登录`。
- 登录页继续说明不要求填写微信账号、微信密码或微信验证码。
- 输入框 label 保持为产品账号和产品密码。
- 协议复选框默认未勾选。
- 不在登录页直接展示 `test / test`。
- 不调用 `wx.login`、`getPhoneNumber`、`wx.getUserProfile`、`wx.getUserInfo` 或 `getClipboardData`。
- 页面不直接调用 `wx.request`。

## 5. 上线前提醒

当前为本地演示登录，不是生产账号体系。真实上线前必须另起独立 Phase 接入后端账号系统，完成后端认证、会话、权限、隐私合规、合法域名、生产 smoke 和 RELEASE_GATE。

本阶段未上传体验版、未提交审核、未部署。

## 6. 检查命令

```bash
python3 scripts/titlelab_phase6g_miniprogram_compliance_check.py
python3 scripts/titlelab_phase6h_miniprogram_login_accounts_check.py
find miniprogram -maxdepth 6 -name "*.js" -print -exec node --check {} \;
git diff --check
```
