const env = require("../config/env");
const aiApi = require("./aiApi");
const aiMock = require("./aiMock");
const { normalizeAIResult } = require("./aiResultNormalizer");
const realGateGuard = require("./realGateGuard");
const request = require("./request");
const sessionStore = require("./sessionStore");

function asPromise(value) {
  return value && typeof value.then === "function" ? value : Promise.resolve(value);
}

function getWorkspaceId(workspaceId) {
  return workspaceId || env.getWorkspaceId();
}

function toDisplayError(error) {
  const code = error && error.code ? error.code : "AI_PROVIDER_ERROR";
  return {
    code,
    message: error && error.message ? error.message : "AI 标题生成失败",
    requestId: error && error.requestId ? error.requestId : "",
    isEmptyInput: code === "AI_EMPTY_INPUT",
    isRealGateNotReady: code === "REAL_API_GATE_CLOSED" || code === "REAL_GATE_NOT_READY",
    isAuthRequired: code === "UNAUTHORIZED" || code === "REAL_AUTH_SESSION_REQUIRED",
    isRetryable: code === "NETWORK_ERROR" || code === "AI_PROVIDER_TIMEOUT"
  };
}

function assertAIRealReadiness(workspaceId) {
  const runtimeEnv = {
    ...env.getRuntimeEnv(),
    workspaceId: getWorkspaceId(workspaceId)
  };

  if (!env.isAiRealApiEnabled()) {
    const error = new Error("AI_REAL_API_GATE_CLOSED");
    error.code = "REAL_API_GATE_CLOSED";
    throw error;
  }

  realGateGuard.assertRealApiReadiness(runtimeEnv, {
    requiresAuthGate: true,
    requiresSessionToken: true,
    sessionToken: sessionStore.getAccessToken()
  });
}

function generateTitleSuggestions(payload = {}, workspaceId) {
  if (env.isMockMode()) {
    return asPromise(normalizeAIResult(aiMock.generateTitleSuggestions(payload)));
  }

  try {
    assertAIRealReadiness(workspaceId);
  } catch (error) {
    return Promise.reject(error.isGateError ? request.createApiErrorFromGate(error) : error);
  }

  return aiApi.generateTitleSuggestions(getWorkspaceId(workspaceId), payload).then(normalizeAIResult);
}

module.exports = {
  generateTitleSuggestions,
  toDisplayError
};
