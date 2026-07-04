const API_MODES = {
  MOCK: "mock",
  REAL: "real"
};

const ALLOWED_API_ORIGIN = "https://api.title.mirroroo.top";
const API_BASE_URL = `${ALLOWED_API_ORIGIN}/api/v1`;
const DEFAULT_WORKSPACE_ID = "default";

const runtimeEnv = {
  apiMode: API_MODES.MOCK,
  realApiGateEnabled: false,
  apiBaseUrl: API_BASE_URL,
  workspaceId: DEFAULT_WORKSPACE_ID,
  appVersion: "phase3c-readonly-api-envelope"
};

function getRuntimeEnv() {
  return { ...runtimeEnv };
}

function isMockMode() {
  return runtimeEnv.apiMode === API_MODES.MOCK;
}

function assertAllowedApiBaseUrl(apiBaseUrl) {
  if (apiBaseUrl !== API_BASE_URL) {
    throw new Error("INVALID_API_BASE");
  }
}

function assertRealApiEnabled() {
  if (runtimeEnv.apiMode !== API_MODES.REAL || !runtimeEnv.realApiGateEnabled || !runtimeEnv.apiBaseUrl) {
    throw new Error("REAL_API_GATE_CLOSED");
  }

  assertAllowedApiBaseUrl(runtimeEnv.apiBaseUrl);
}

function getWorkspaceId() {
  return runtimeEnv.workspaceId;
}

module.exports = {
  API_MODES,
  ALLOWED_API_ORIGIN,
  API_BASE_URL,
  getRuntimeEnv,
  isMockMode,
  assertRealApiEnabled,
  getWorkspaceId
};
