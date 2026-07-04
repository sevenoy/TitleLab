const request = require("./request");
const REQUEST_METHODS = {
  post: request.post
};

function workspaceRoute(workspaceId) {
  return `/workspaces/${encodeURIComponent(workspaceId)}/ai`;
}

function generateTitleSuggestions(workspaceId, payload = {}) {
  return REQUEST_METHODS.post(`${workspaceRoute(workspaceId)}/title-suggestions`, {
    body: payload,
    requiresAuthGate: true
  });
}

module.exports = {
  generateTitleSuggestions
};
