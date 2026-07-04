const wechat = require("../adapters/wechat");

const STORAGE_KEYS = {
  accessToken: "titlelab.sessionToken",
  user: "titlelab.sessionUser",
  memberships: "titlelab.sessionMemberships",
  expiresAt: "titlelab.sessionExpiresAt"
};

function getStoredValue(key, fallback = null) {
  const value = wechat.getStorage(key);
  return value === undefined || value === "" ? fallback : value;
}

function isExpired(expiresAt) {
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return false;
  }

  return expiresAtMs <= Date.now();
}

function clearSession() {
  Object.keys(STORAGE_KEYS).forEach((key) => {
    wechat.removeStorage(STORAGE_KEYS[key]);
  });
}

function setSession(payload = {}) {
  const token = payload.accessToken || payload.access_token || "";
  const user = payload.user || null;
  const memberships = payload.memberships || payload.workspaces || [];
  const expiresAt = payload.expiresAt || payload.expires_at || "";

  if (!token) {
    clearSession();
    return getSession();
  }

  wechat.setStorage(STORAGE_KEYS.accessToken, token);
  wechat.setStorage(STORAGE_KEYS.user, user);
  wechat.setStorage(STORAGE_KEYS.memberships, memberships);
  wechat.setStorage(STORAGE_KEYS.expiresAt, expiresAt);

  return getSession();
}

function getAccessToken() {
  const token = getStoredValue(STORAGE_KEYS.accessToken, "");
  const expiresAt = getStoredValue(STORAGE_KEYS.expiresAt, "");

  if (token && isExpired(expiresAt)) {
    clearSession();
    return "";
  }

  return token;
}

function getSession() {
  const accessToken = getAccessToken();

  if (!accessToken) {
    return null;
  }

  return {
    accessToken,
    user: getStoredValue(STORAGE_KEYS.user, null),
    memberships: getStoredValue(STORAGE_KEYS.memberships, []),
    expiresAt: getStoredValue(STORAGE_KEYS.expiresAt, "")
  };
}

function hasSession() {
  return Boolean(getAccessToken());
}

module.exports = {
  STORAGE_KEYS,
  setSession,
  getAccessToken,
  getSession,
  clearSession,
  hasSession
};
