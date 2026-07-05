const wechat = require("../../adapters/wechat");
const localAuth = require("../../services/localAuth");

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

    const result = localAuth.login({
      username: this.data.account,
      password: this.data.password
    });

    if (!result.ok) {
      wechat.showToast({ title: result.message });
      return;
    }

    wechat.reLaunch("/pages/index/index");
  }
});
