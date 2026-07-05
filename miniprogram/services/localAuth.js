const wechat = require("../adapters/wechat");

const OWNER_USERNAME = "olina";
const AUDIT_USERNAME = "test";
const AUDIT_PASSWORD = "test";
const OWNER_PASSWORD_KEY = "titlelab.local.owner.password";
const SESSION_KEY = "titlelab.local.login.session";
const LEGACY_LOGIN_FLAG_KEY = "titlelab.localAccountSignedIn";

function normalize(value) {
  return String(value || "").trim();
}

function saveSession(username) {
  wechat.setStorage(SESSION_KEY, {
    username,
    signedIn: true,
    createdAt: Date.now()
  });
  wechat.setStorage(LEGACY_LOGIN_FLAG_KEY, true);
}

function login(options) {
  const username = normalize(options && options.username);
  const password = normalize(options && options.password);

  if (!password) {
    return {
      ok: false,
      code: "EMPTY_PASSWORD",
      message: "请输入产品密码。"
    };
  }

  if (username === AUDIT_USERNAME && password === AUDIT_PASSWORD) {
    saveSession(AUDIT_USERNAME);
    return {
      ok: true,
      accountType: "audit"
    };
  }

  if (username === OWNER_USERNAME) {
    const savedPassword = wechat.getStorage(OWNER_PASSWORD_KEY);

    if (!savedPassword) {
      wechat.setStorage(OWNER_PASSWORD_KEY, password);
      saveSession(OWNER_USERNAME);
      return {
        ok: true,
        accountType: "owner",
        createdPassword: true
      };
    }

    if (savedPassword === password) {
      saveSession(OWNER_USERNAME);
      return {
        ok: true,
        accountType: "owner"
      };
    }
  }

  return {
    ok: false,
    code: "INVALID_CREDENTIALS",
    message: "账号或密码不正确。"
  };
}

function hasLocalSession() {
  return Boolean(wechat.getStorage(SESSION_KEY) || wechat.getStorage(LEGACY_LOGIN_FLAG_KEY));
}

function clearLocalSession() {
  wechat.removeStorage(SESSION_KEY);
  wechat.removeStorage(LEGACY_LOGIN_FLAG_KEY);
}

function resetOwnerPassword() {
  wechat.removeStorage(OWNER_PASSWORD_KEY);
}

module.exports = {
  OWNER_USERNAME,
  AUDIT_USERNAME,
  AUDIT_PASSWORD,
  OWNER_PASSWORD_KEY,
  SESSION_KEY,
  login,
  hasLocalSession,
  clearLocalSession,
  resetOwnerPassword
};
