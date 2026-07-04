const env = require("../config/env");

function buildReadOnlyUrl(path, query = {}) {
  env.assertRealApiEnabled();

  const search = Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== null && query[key] !== "")
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
    .join("&");

  return `${env.getRuntimeEnv().apiBaseUrl}${path}${search ? `?${search}` : ""}`;
}

function get(path, options = {}) {
  buildReadOnlyUrl(path, options.query || {});
  throw new Error("REAL_API_GATE_CLOSED");
}

module.exports = {
  get,
  buildReadOnlyUrl
};
