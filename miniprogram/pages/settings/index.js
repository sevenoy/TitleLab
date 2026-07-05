const env = require("../../config/env");
const wechat = require("../../adapters/wechat");
const localAuth = require("../../services/localAuth");

Page({
  data: {
    version: env.getRuntimeEnv().appVersion
  },

  onOpenTerms() {
    wechat.navigateTo("/pages/legal/terms");
  },

  onOpenPrivacy() {
    wechat.navigateTo("/pages/legal/privacy");
  },

  onResetLocalPassword() {
    wx.showModal({
      title: "重置本机账号密码",
      content: "确认清除本机保存的 olina 密码？清除后可在下次登录时重新设置。",
      confirmText: "确认清除",
      cancelText: "取消",
      success(result) {
        if (result.confirm) {
          localAuth.resetOwnerPassword();
          wechat.showToast({ title: "已清除" });
        }
      }
    });
  },

  onLogout() {
    localAuth.clearLocalSession();
    wechat.reLaunch("/pages/login/index");
  }
});
