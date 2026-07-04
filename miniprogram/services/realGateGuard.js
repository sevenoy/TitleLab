const ALLOWED_API_BASE_URL = "https://api.title.mirroroo.top/api/v1";
const BLOCKED_DOMAIN_MARKERS = [
  "api." + "mirroroo.top",
  "api." + "num." + "mirroroo.top",
  "num." + "mirroroo.top",
  "admin." + "mirroroo.top",
  "title-api." + "mirroroo.top",
  "workers" + ".dev",
  "pages" + ".dev",
  "cloud" + "flare"
];
const PLACEHOLDER_WORKSPACE_IDS = ["", "default", "placeholder", "demo", "test", "workspace-placeholder", "workspace_id"];

function createGateError(code, message, detail = {}) {
  const error = new Error(message || code);
  error.code = code;
  error.message = message || code;
  error.detail = detail;
  error.isGateError = true;
  return error;
}

function isPlaceholderWorkspaceId(workspaceId) {
  if (workspaceId === null || workspaceId === undefined) {
    return true;
  }

  return PLACEHOLDER_WORKSPACE_IDS.includes(String(workspaceId).trim().toLowerCase());
}

function assertAllowedBaseUrl(apiBaseUrl) {
  if (apiBaseUrl !== ALLOWED_API_BASE_URL) {
    throw createGateError("INVALID_API_BASE", "invalid_api_base");
  }

  const lowered = String(apiBaseUrl || "").toLowerCase();
  if (BLOCKED_DOMAIN_MARKERS.some((marker) => lowered.includes(marker))) {
    throw createGateError("INVALID_API_BASE", "blocked_api_domain");
  }
}

function validateRealApiReadiness(config = {}, options = {}) {
  const checks = [];
  const realGateEnabled = config.apiMode === "real" && config.realApiGateEnabled === true;
  const authGateEnabled = realGateEnabled && config.authRealApiGateEnabled === true;

  checks.push({ name: "realApiGateEnabled default false", passed: config.realApiGateEnabled !== true || realGateEnabled });
  checks.push({ name: "authRealApiGateEnabled default false", passed: config.authRealApiGateEnabled !== true || authGateEnabled });
  checks.push({ name: "allowed api base", passed: config.apiBaseUrl === ALLOWED_API_BASE_URL });
  checks.push({ name: "workspace id not placeholder", passed: !isPlaceholderWorkspaceId(config.workspaceId) });

  if (!realGateEnabled) {
    return {
      ready: false,
      skipped: true,
      code: "REAL_API_GATE_CLOSED",
      checks,
      risks: isPlaceholderWorkspaceId(config.workspaceId) ? ["workspaceId placeholder blocks future real gate"] : []
    };
  }

  try {
    assertAllowedBaseUrl(config.apiBaseUrl);
  } catch (error) {
    return {
      ready: false,
      skipped: false,
      code: error.code || "REAL_GATE_NOT_READY",
      message: error.message,
      checks,
      risks: []
    };
  }

  if (isPlaceholderWorkspaceId(config.workspaceId)) {
    return {
      ready: false,
      skipped: false,
      code: "REAL_WORKSPACE_REQUIRED",
      message: "real_workspace_required",
      checks,
      risks: []
    };
  }

  if (options.requiresAuthGate && !authGateEnabled) {
    return {
      ready: false,
      skipped: false,
      code: "AUTH_REAL_API_GATE_CLOSED",
      message: "auth_real_api_gate_closed",
      checks,
      risks: []
    };
  }

  if (authGateEnabled && options.requiresSessionToken && !options.sessionToken) {
    return {
      ready: false,
      skipped: false,
      code: "REAL_AUTH_SESSION_REQUIRED",
      message: "real_auth_session_required",
      checks,
      risks: []
    };
  }

  return {
    ready: true,
    skipped: false,
    code: "OK",
    checks,
    risks: []
  };
}

function assertRealApiReadiness(config = {}, options = {}) {
  const result = validateRealApiReadiness(config, options);

  if (!result.ready) {
    throw createGateError(result.code || "REAL_GATE_NOT_READY", result.message || result.code || "real_gate_not_ready", {
      checks: result.checks,
      risks: result.risks
    });
  }

  return result;
}

function normalizeGateError(error) {
  if (!error) {
    return createGateError("REAL_GATE_NOT_READY", "real_gate_not_ready");
  }

  if (error.isGateError) {
    return error;
  }

  return createGateError(error.code || "REAL_GATE_NOT_READY", error.message || "real_gate_not_ready", {
    original: error
  });
}

module.exports = {
  ALLOWED_API_BASE_URL,
  validateRealApiReadiness,
  assertRealApiReadiness,
  isPlaceholderWorkspaceId,
  normalizeGateError
};
