const API_MODES = {
  MOCK: "mock",
  REAL: "real"
};

const runtimeEnv = {
  apiMode: API_MODES.MOCK,
  realApiGateEnabled: false,
  apiBaseUrl: "",
  appVersion: "phase3b-service-adapter"
};

function getRuntimeEnv() {
  return { ...runtimeEnv };
}

function isMockMode() {
  return runtimeEnv.apiMode === API_MODES.MOCK;
}

function assertRealApiEnabled() {
  if (runtimeEnv.apiMode !== API_MODES.REAL || !runtimeEnv.realApiGateEnabled || !runtimeEnv.apiBaseUrl) {
    throw new Error("REAL_API_GATE_CLOSED");
  }
}

module.exports = {
  API_MODES,
  getRuntimeEnv,
  isMockMode,
  assertRealApiEnabled
};
