const API_MODES = {
  MOCK: "mock",
  REAL: "real"
};

const ALLOWED_API_ORIGIN = "https://api.title.mirroroo.top";
const API_BASE_URL = `${ALLOWED_API_ORIGIN}/api/v1`;
const ALLOWED_API_BASE_URL = API_BASE_URL;
const DEFAULT_WORKSPACE_ID = "default";

const runtimeEnv = {
  apiMode: API_MODES.MOCK,
  realApiGateEnabled: false,
  authRealApiGateEnabled: false,
  environmentLabel: "local-mock",
  apiBaseUrl: API_BASE_URL,
  allowedApiBaseUrl: ALLOWED_API_BASE_URL,
  workspaceId: DEFAULT_WORKSPACE_ID,
  appVersion: "phase4e-controlled-real-gate-readiness"
};

function getRuntimeEnv() {
  return { ...runtimeEnv };
}

function isMockMode() {
  return runtimeEnv.apiMode === API_MODES.MOCK;
}

function isRealApiEnabled() {
  return runtimeEnv.apiMode === API_MODES.REAL && runtimeEnv.realApiGateEnabled && Boolean(runtimeEnv.apiBaseUrl);
}

function isAuthRealApiEnabled() {
  return isRealApiEnabled() && runtimeEnv.authRealApiGateEnabled;
}

function assertAllowedApiBaseUrl(apiBaseUrl) {
  if (apiBaseUrl !== ALLOWED_API_BASE_URL) {
    throw new Error("INVALID_API_BASE");
  }
}

function assertRealApiEnabled() {
  if (!isRealApiEnabled()) {
    throw new Error("REAL_API_GATE_CLOSED");
  }

  assertAllowedApiBaseUrl(runtimeEnv.apiBaseUrl);
}

function assertAuthRealApiEnabled() {
  assertRealApiEnabled();

  if (!runtimeEnv.authRealApiGateEnabled) {
    throw new Error("AUTH_REAL_API_GATE_CLOSED");
  }
}

function getWorkspaceId() {
  return runtimeEnv.workspaceId;
}

module.exports = {
  API_MODES,
  ALLOWED_API_ORIGIN,
  API_BASE_URL,
  ALLOWED_API_BASE_URL,
  getRuntimeEnv,
  isMockMode,
  isRealApiEnabled,
  isAuthRealApiEnabled,
  assertRealApiEnabled,
  assertAuthRealApiEnabled,
  getWorkspaceId
};
