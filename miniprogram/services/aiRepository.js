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
  const fallbackMessages = {
    AI_EMPTY_INPUT: "请输入素材后再生成标题",
    REAL_API_GATE_CLOSED: "真实 AI gate 未开启，当前仅允许本地 mock",
    REAL_GATE_NOT_READY: "真实请求条件未就绪",
    REAL_AUTH_SESSION_REQUIRED: "真实请求需要有效登录会话",
    UNAUTHORIZED: "请先登录后再试",
    NETWORK_ERROR: "连接暂不可用，请稍后重试",
    AI_PROVIDER_TIMEOUT: "生成超时，请稍后重试"
  };
  return {
    code,
    message: (error && error.message) || fallbackMessages[code] || "AI 标题生成失败",
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
    try {
      return asPromise(normalizeAIResult(aiMock.generateTitleSuggestions(payload)));
    } catch (error) {
      return Promise.reject(error);
    }
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
