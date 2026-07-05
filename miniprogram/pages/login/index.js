const wechat = require("../../adapters/wechat");

const LOGIN_FLAG_KEY = "titlelab.localAccountSignedIn";
const ALLOWED_ACCOUNT = "audit_test";
const ALLOWED_PASSWORD = "audit_test";

Page({
  data: {
    account: "",
    password: "",
    agreed: false
  },

  onAccountInput(event) {
    this.setData({ account: event.detail.value || "" });
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value || "" });
  },

  onAgreementChange(event) {
    const values = event.detail.value || [];
    this.setData({ agreed: values.includes("agree") });
  },

  onOpenTerms() {
    wechat.navigateTo("/pages/legal/terms");
  },

  onOpenPrivacy() {
    wechat.navigateTo("/pages/legal/privacy");
  },

  onLogin() {
    if (!this.data.agreed) {
      wechat.showToast({ title: "请先阅读并勾选《用户服务协议》《隐私政策》后再继续。" });
      return;
    }

    if (this.data.account !== ALLOWED_ACCOUNT || this.data.password !== ALLOWED_PASSWORD) {
      wechat.showToast({ title: "账号或密码不正确" });
      return;
    }

    wechat.setStorage(LOGIN_FLAG_KEY, true);
    wechat.reLaunch("/pages/index/index");
  }
});
