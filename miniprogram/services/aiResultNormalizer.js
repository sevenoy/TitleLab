function normalizeSuggestion(item = {}) {
  return {
    title: String(item.title || ""),
    rationale: String(item.rationale || ""),
    tags: Array.isArray(item.tags) ? item.tags.map((tag) => String(tag)).filter(Boolean).slice(0, 6) : [],
    riskLevel: ["low", "medium", "high"].includes(item.riskLevel) ? item.riskLevel : "medium",
    score: Number.isFinite(Number(item.score)) ? Number(item.score) : 0
  };
}

function normalizeAIResult(payload = {}) {
  const data = payload.data || payload;
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions.map(normalizeSuggestion) : [];
  return {
    suggestions,
    provider: data.provider || "mock",
    model: data.model || "titlelab-miniprogram-mock-title-v1",
    mock: data.mock !== false,
    usageEstimate: data.usageEstimate || {
      inputCharacters: 0,
      requestedCount: 0,
      returnedCount: suggestions.length,
      estimatedTokens: 0,
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      promptCachedTokens: 0,
      estimatedCostCents: 0
    },
    warnings: Array.isArray(data.warnings) ? data.warnings : [],
    requestId: payload.requestId || ""
  };
}

module.exports = {
  normalizeAIResult,
  normalizeSuggestion
};
