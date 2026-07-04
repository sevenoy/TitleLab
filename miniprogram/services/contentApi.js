const request = require("./request");

const CONTENT_TYPE_LABELS = {
  title: "标题",
  copywriting: "文案",
  template: "模板",
  note: "笔记",
  prompt_template: "提示词"
};

function workspaceRoute(workspaceId) {
  return `/workspaces/${encodeURIComponent(workspaceId)}`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return String(value).slice(0, 10);
}

function firstLine(text) {
  return String(text || "").split("\n").find((line) => line.trim()) || "未命名内容";
}

function mapContentItem(item, lookups = {}) {
  const contentType = item.content_type || "title";
  const categoryName =
    lookups.categoriesById && item.primary_category_id
      ? lookups.categoriesById[item.primary_category_id]
      : item.primary_category_id || "未分类";

  return {
    id: item.id,
    workspaceId: item.workspace_id,
    contentType,
    typeLabel: CONTENT_TYPE_LABELS[contentType] || contentType,
    title: item.summary || firstLine(item.text),
    body: item.text || "",
    category: categoryName,
    categoryId: item.primary_category_id || "",
    accountCategoryId: item.account_category_id || "",
    tags: [],
    usageTip: item.source || "可复制后按当前发布场景微调。",
    notes: item.status ? `状态：${item.status}` : "",
    updatedAt: formatDate(item.updated_at || item.created_at),
    sortOrder: item.sort_order,
    requestVersion: item.updated_at || ""
  };
}

function normalizeListPayload(payload) {
  const data = payload.data || {};

  return {
    items: Array.isArray(data.items) ? data.items : [],
    limit: data.limit || 0,
    offset: data.offset || 0,
    hasMore: Boolean(data.hasMore),
    requestId: payload.requestId,
    serverTime: payload.serverTime,
    version: payload.version
  };
}

function listContents(workspaceId, filters = {}, lookups = {}) {
  const query = {
    content_type: filters.contentType && filters.contentType !== "all" ? filters.contentType : undefined,
    category_id: filters.categoryId && filters.categoryId !== "all" ? filters.categoryId : undefined,
    tag_id: filters.tagId && filters.tagId !== "all" ? filters.tagId : undefined,
    q: filters.keyword || filters.q,
    limit: filters.limit || 20,
    offset: filters.offset || 0
  };

  return request.get(`${workspaceRoute(workspaceId)}/contents`, { query }).then((payload) => {
    const listPayload = normalizeListPayload(payload);
    return {
      ...listPayload,
      items: listPayload.items.map((item) => mapContentItem(item, lookups))
    };
  });
}

function getContentDetail(workspaceId, contentId, lookups = {}) {
  return request.get(`${workspaceRoute(workspaceId)}/contents/${encodeURIComponent(contentId)}`).then((payload) => {
    return mapContentItem(payload.data || {}, lookups);
  });
}

function listCategories(workspaceId) {
  return request.get(`${workspaceRoute(workspaceId)}/categories`).then((payload) => {
    const listPayload = normalizeListPayload(payload);
    return {
      ...listPayload,
      items: listPayload.items.map((item) => ({
        value: item.id,
        label: item.name,
        slug: item.slug,
        categoryType: item.category_type
      }))
    };
  });
}

function listTags(workspaceId) {
  return request.get(`${workspaceRoute(workspaceId)}/tags`).then((payload) => {
    const listPayload = normalizeListPayload(payload);
    return {
      ...listPayload,
      items: listPayload.items.map((item) => ({
        value: item.id,
        label: item.name,
        tagType: item.tag_type
      }))
    };
  });
}

module.exports = {
  listContents,
  getContentDetail,
  listCategories,
  listTags
};
