const env = require("../config/env");

const OK_CODE = "OK";

function createRequestId() {
  return `tl-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function createApiError(code, message, meta = {}) {
  const error = new Error(message || "请求失败");
  error.code = code || "INTERNAL_ERROR";
  error.message = message || "请求失败";
  error.requestId = meta.requestId || "";
  error.serverTime = meta.serverTime || "";
  error.version = meta.version || "";
  error.statusCode = meta.statusCode || 0;
  error.isApiError = true;
  return error;
}

function buildReadOnlyUrl(path, query = {}) {
  env.assertRealApiEnabled();

  const search = Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== null && query[key] !== "")
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join("&");

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${env.getRuntimeEnv().apiBaseUrl}${normalizedPath}${search ? `?${search}` : ""}`;
}

function assertEnvelope(body, statusCode) {
  if (!body || typeof body !== "object") {
    throw createApiError("INTERNAL_ERROR", "响应格式异常", { statusCode });
  }

  const hasEnvelope =
    typeof body.code === "string" &&
    Object.prototype.hasOwnProperty.call(body, "message") &&
    Object.prototype.hasOwnProperty.call(body, "requestId") &&
    Object.prototype.hasOwnProperty.call(body, "serverTime");

  if (!hasEnvelope) {
    throw createApiError("INTERNAL_ERROR", "响应缺少统一 envelope", { statusCode });
  }

  if (body.code !== OK_CODE) {
    throw createApiError(body.code, body.message, {
      requestId: body.requestId,
      serverTime: body.serverTime,
      version: body.version,
      statusCode
    });
  }

  return body;
}

function get(path, options = {}) {
  const requestId = options.requestId || createRequestId();
  const url = buildReadOnlyUrl(path, options.query || {});

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: "GET",
      timeout: options.timeout || 10000,
      header: {
        "X-Request-Id": requestId,
        ...(options.header || {})
      },
      success(response) {
        const statusCode = response.statusCode || 0;

        try {
          const envelope = assertEnvelope(response.data, statusCode);
          resolve({
            data: envelope.data,
            code: envelope.code,
            message: envelope.message,
            requestId: envelope.requestId,
            serverTime: envelope.serverTime,
            version: envelope.version || ""
          });
        } catch (error) {
          reject(error);
        }
      },
      fail(error) {
        reject(
          createApiError("NETWORK_ERROR", error && error.errMsg ? error.errMsg : "网络请求失败", {
            requestId
          })
        );
      }
    });
  });
}

module.exports = {
  get,
  buildReadOnlyUrl,
  createApiError
};
