const authRepository = require("./services/authRepository");

App({
  globalData: {
    appName: "TitleLab",
    apiMode: "local-mock",
    authSession: null
  },

  onLaunch() {
    authRepository
      .restoreSession()
      .then((result) => {
        this.globalData.authSession = result.session || null;
      })
      .catch(() => {
        this.globalData.authSession = null;
      });
  }
});
