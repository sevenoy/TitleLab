const env = require("../config/env");
const contentApi = require("./contentApi");
const contentMock = require("./contentMock");

const FALLBACK_TYPE_OPTIONS = [
  { value: "all", label: "全部类型" },
  { value: "title", label: "标题" },
  { value: "copywriting", label: "文案" }
];

function asPromise(value) {
  return value && typeof value.then === "function" ? value : Promise.resolve(value);
}

function toDisplayError(error) {
  const code = error && error.code ? error.code : "INTERNAL_ERROR";
  const message = error && error.message ? error.message : "内容加载失败";

  return {
    code,
    message,
    requestId: error && error.requestId ? error.requestId : "",
    serverTime: error && error.serverTime ? error.serverTime : "",
    version: error && error.version ? error.version : "",
    isNotFound: code === "NOT_FOUND",
    isInvalidParam: code === "INVALID_PARAM",
    isAuthRequired: code === "UNAUTHORIZED",
    isForbidden: code === "FORBIDDEN",
    isSessionExpired: code === "SESSION_EXPIRED",
    isSessionRevoked: code === "SESSION_REVOKED",
    isRetryable: code === "NETWORK_ERROR" || code === "INTERNAL_ERROR"
  };
}

function withDisplayError(promise) {
  return asPromise(promise).catch((error) => {
    throw toDisplayError(error);
  });
}

function getWorkspaceId(workspaceId) {
  return workspaceId || env.getWorkspaceId();
}

function getContentItems(filters = {}, workspaceId) {
  if (env.isMockMode()) {
    return asPromise({
      items: contentMock.getContentItems(filters),
      limit: filters.limit || 20,
      offset: filters.offset || 0,
      hasMore: false
    });
  }

  return withDisplayError(contentApi.listContents(getWorkspaceId(workspaceId), filters));
}

function getContentItemById(id, workspaceId) {
  if (env.isMockMode()) {
    return asPromise(contentMock.getContentItemById(id));
  }

  return withDisplayError(contentApi.getContentDetail(getWorkspaceId(workspaceId), id));
}

function getTypeOptions() {
  if (env.isMockMode()) {
    return asPromise(contentMock.getTypeOptions());
  }

  return asPromise(FALLBACK_TYPE_OPTIONS.map((item) => ({ ...item })));
}

function getCategoryOptions(workspaceId) {
  if (env.isMockMode()) {
    return asPromise(contentMock.getCategoryOptions());
  }

  return withDisplayError(contentApi.listCategories(getWorkspaceId(workspaceId))).then((payload) => [
    { value: "all", label: "全部分类" },
    ...payload.items
  ]);
}

function getTagOptions(workspaceId) {
  if (env.isMockMode()) {
    return asPromise(contentMock.getTagOptions());
  }

  return withDisplayError(contentApi.listTags(getWorkspaceId(workspaceId))).then((payload) => [
    { value: "all", label: "全部标签" },
    ...payload.items
  ]);
}

module.exports = {
  getContentItems,
  getContentItemById,
  getTypeOptions,
  getCategoryOptions,
  getTagOptions,
  toDisplayError
};
