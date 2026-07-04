const env = require("../config/env");
const wechat = require("../adapters/wechat");
const authApi = require("./authApi");
const realGateGuard = require("./realGateGuard");
const request = require("./request");
const sessionStore = require("./sessionStore");

function gateClosedResult() {
  return {
    authenticated: sessionStore.hasSession(),
    session: sessionStore.getSession(),
    skipped: true,
    reason: "AUTH_REAL_API_GATE_CLOSED"
  };
}

function normalizeAuthPayload(payload = {}) {
  const data = payload.data || {};
  return {
    accessToken: data.accessToken || "",
    user: data.user || null,
    memberships: data.memberships || [],
    expiresAt: data.expiresAt || ""
  };
}

function sessionResult(session, extra = {}) {
  return {
    authenticated: Boolean(session && session.accessToken),
    session,
    user: session ? session.user : null,
    memberships: session ? session.memberships || [] : [],
    ...extra
  };
}

function loginWithWechat() {
  if (!env.isAuthRealApiEnabled()) {
    return Promise.resolve(gateClosedResult());
  }

  try {
    realGateGuard.assertRealApiReadiness(env.getRuntimeEnv(), { requiresAuthGate: true });
  } catch (error) {
    return Promise.reject(request.createApiErrorFromGate(error));
  }

  return wechat.login().then((code) => {
    return authApi.wechatLogin(code, { deviceLabel: wechat.getDeviceLabel() }).then((payload) => {
      const session = sessionStore.setSession(normalizeAuthPayload(payload));
      return sessionResult(session);
    });
  });
}

function restoreSession() {
  const session = sessionStore.getSession();

  if (!session) {
    return Promise.resolve(sessionResult(null));
  }

  if (!env.isAuthRealApiEnabled()) {
    return Promise.resolve(sessionResult(session, { skipped: true, reason: "AUTH_REAL_API_GATE_CLOSED" }));
  }

  try {
    realGateGuard.assertRealApiReadiness(env.getRuntimeEnv(), {
      requiresAuthGate: true,
      requiresSessionToken: true,
      sessionToken: session.accessToken
    });
  } catch (error) {
    return Promise.reject(request.createApiErrorFromGate(error));
  }

  return authApi.getMe().then((payload) => {
    const data = payload.data || {};
    const refreshedSession = sessionStore.setSession({
      accessToken: session.accessToken,
      user: data.user || session.user,
      memberships: data.memberships || session.memberships,
      expiresAt: data.sessionExpiresAt || session.expiresAt
    });
    return sessionResult(refreshedSession);
  });
}

function getCurrentUser() {
  if (!env.isAuthRealApiEnabled()) {
    return Promise.resolve(sessionResult(sessionStore.getSession(), { skipped: true, reason: "AUTH_REAL_API_GATE_CLOSED" }));
  }

  try {
    realGateGuard.assertRealApiReadiness(env.getRuntimeEnv(), {
      requiresAuthGate: true,
      requiresSessionToken: true,
      sessionToken: sessionStore.getAccessToken()
    });
  } catch (error) {
    return Promise.reject(request.createApiErrorFromGate(error));
  }

  return authApi.getMe().then((payload) => {
    const session = sessionStore.getSession();
    const data = payload.data || {};
    const refreshedSession = sessionStore.setSession({
      accessToken: session ? session.accessToken : "",
      user: data.user || null,
      memberships: data.memberships || [],
      expiresAt: data.sessionExpiresAt || (session ? session.expiresAt : "")
    });
    return sessionResult(refreshedSession);
  });
}

function logout() {
  const hasSession = sessionStore.hasSession();

  if (!env.isAuthRealApiEnabled() || !hasSession) {
    sessionStore.clearSession();
    return Promise.resolve({ revoked: false, localOnly: true });
  }

  try {
    realGateGuard.assertRealApiReadiness(env.getRuntimeEnv(), {
      requiresAuthGate: true,
      requiresSessionToken: true,
      sessionToken: sessionStore.getAccessToken()
    });
  } catch (error) {
    return Promise.reject(request.createApiErrorFromGate(error));
  }

  return authApi
    .logout()
    .then((payload) => payload.data || { revoked: true })
    .finally(() => {
      sessionStore.clearSession();
    });
}

function isAuthenticated() {
  return sessionStore.hasSession();
}

module.exports = {
  loginWithWechat,
  restoreSession,
  getCurrentUser,
  logout,
  isAuthenticated
};
