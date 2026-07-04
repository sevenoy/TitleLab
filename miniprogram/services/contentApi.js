const request = require("./request");

const WORKSPACE_ROUTE = "/workspaces/{workspaceId}";

function getContentItems(filters = {}) {
  return request.get(`${WORKSPACE_ROUTE}/contents`, {
    query: filters
  });
}

function getContentItemById(id) {
  return request.get(`${WORKSPACE_ROUTE}/contents/${encodeURIComponent(id)}`);
}

function getTypeOptions() {
  return request.get(`${WORKSPACE_ROUTE}/content-types`);
}

function getCategoryOptions() {
  return request.get(`${WORKSPACE_ROUTE}/categories`);
}

function getTagOptions() {
  return request.get(`${WORKSPACE_ROUTE}/tags`);
}

module.exports = {
  getContentItems,
  getContentItemById,
  getTypeOptions,
  getCategoryOptions,
  getTagOptions
};
