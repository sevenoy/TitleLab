const request = require("./request");

function wechatLogin(code, options = {}) {
  return request.post("/auth/wechat-login", {
    body: {
      code,
      deviceLabel: options.deviceLabel || ""
    },
    requiresAuthGate: true
  });
}

function getMe() {
  return request.get("/auth/me", { requiresAuthGate: true });
}

function logout() {
  return request.post("/auth/logout", { requiresAuthGate: true });
}

module.exports = {
  wechatLogin,
  getMe,
  logout
};
