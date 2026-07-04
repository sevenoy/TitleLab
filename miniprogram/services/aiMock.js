const DEFAULT_COUNT = 3;
const MAX_COUNT = 5;

const TONE_LABELS = {
  clear: "清晰",
  warm: "温和",
  sharp: "直接",
  playful: "轻快"
};

const PLATFORM_LABELS = {
  wechat: "微信",
  xiaohongshu: "小红书",
  douyin: "短视频",
  general: "通用"
};

function clampCount(count) {
  const value = Number(count || DEFAULT_COUNT);
  if (Number.isNaN(value) || value < 1) {
    return DEFAULT_COUNT;
  }
  return Math.min(Math.floor(value), MAX_COUNT);
}

function normalizeSourceText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function createAIError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function makeSeedText(sourceText) {
  if (!sourceText) {
    return "内容灵感";
  }
  return sourceText.length > 18 ? `${sourceText.slice(0, 18)}...` : sourceText;
}

function generateTitleSuggestions(payload = {}) {
  const sourceText = normalizeSourceText(payload.sourceText);
  if (!sourceText) {
    throw createAIError("AI_EMPTY_INPUT", "请输入要生成标题的内容");
  }

  const count = clampCount(payload.count);
  const seedText = makeSeedText(sourceText);
  const toneLabel = TONE_LABELS[payload.tone] || "清晰";
  const platformLabel = PLATFORM_LABELS[payload.platform] || "通用";
  const templates = [
    `把「${seedText}」讲成一个可收藏的方法`,
    `${platformLabel}标题：${seedText}的3个稳定表达`,
    `${toneLabel}版：让${seedText}更容易被看见`,
    `从${seedText}切入，写出更具体的标题`,
    `适合复盘收藏的${platformLabel}标题：${seedText}`
  ];

  const suggestions = templates.slice(0, count).map((title, index) => ({
    title,
    rationale: `mock-only 建议 ${index + 1}，根据输入主题、语气和平台生成，不上传任何数据。`,
    tags: ["mock", payload.contentType || "title", payload.platform || "general"].filter(Boolean),
    riskLevel: index === 0 ? "low" : "medium",
    score: Number((0.92 - index * 0.04).toFixed(2))
  }));

  return {
    suggestions,
    provider: "mock",
    model: "titlelab-miniprogram-mock-title-v1",
    mock: true,
    usageEstimate: {
      inputCharacters: sourceText.length,
      requestedCount: Number(payload.count || DEFAULT_COUNT),
      returnedCount: suggestions.length,
      estimatedTokens: Math.max(1, Math.ceil(sourceText.length / 4) + suggestions.length * 18),
      estimatedInputTokens: Math.max(1, Math.ceil(sourceText.length / 4)),
      estimatedOutputTokens: suggestions.length * 18,
      promptCachedTokens: 0,
      estimatedCostCents: 0
    },
    warnings:
      Number(payload.count || DEFAULT_COUNT) > MAX_COUNT
        ? [{ code: "COUNT_CLAMPED", message: "mock 生成最多返回 5 条标题" }]
        : []
  };
}

module.exports = {
  MAX_COUNT,
  generateTitleSuggestions
};
