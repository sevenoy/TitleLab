const env = require("../../config/env");
const wechat = require("../../adapters/wechat");

const LOGIN_FLAG_KEY = "titlelab.localAccountSignedIn";

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

  onLogout() {
    wechat.removeStorage(LOGIN_FLAG_KEY);
    wechat.reLaunch("/pages/login/index");
  }
});
