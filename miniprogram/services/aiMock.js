const DEFAULT_COUNT = 3;
const MAX_COUNT = 5;
const MAX_SOURCE_CHARS = 1200;

const TONE_CONFIG = {
  clear: {
    label: "清晰",
    angle: "把卖点讲清楚",
    rationale: "优先突出对象、场景和具体收益，适合做稳定发布标题。"
  },
  warm: {
    label: "温和",
    angle: "把体验讲得更有画面",
    rationale: "保留情绪温度，降低夸张承诺，适合旅拍和写真类内容。"
  },
  sharp: {
    label: "直接",
    angle: "把结果前置",
    rationale: "用更短的开场说明内容价值，适合转化明确的服务标题。"
  },
  playful: {
    label: "轻快",
    angle: "把分享感拉出来",
    rationale: "强化轻松、可收藏和可转发的语气，适合小红书笔记。"
  }
};

const PLATFORM_CONFIG = {
  general: { label: "通用", tag: "通用标题" },
  wechat: { label: "微信", tag: "微信推文" },
  xiaohongshu: { label: "小红书", tag: "小红书" },
  douyin: { label: "短视频", tag: "短视频" }
};

const CONTENT_TYPE_CONFIG = {
  title: { label: "标题", tag: "标题" },
  copywriting: { label: "文案", tag: "文案" },
  template: { label: "模板", tag: "模板" }
};

const SCENARIOS = [
  {
    keywords: ["香港迪士尼", "迪士尼", "乐园"],
    label: "香港迪士尼旅拍",
    hook: "香港迪士尼旅拍",
    tags: ["旅拍", "迪士尼"]
  },
  {
    keywords: ["摄影师", "跟拍", "拍摄"],
    label: "摄影师跟拍",
    hook: "摄影师跟拍",
    tags: ["跟拍", "摄影服务"]
  },
  {
    keywords: ["女生", "单人", "写真"],
    label: "女生单人写真",
    hook: "女生单人写真",
    tags: ["写真", "个人照"]
  },
  {
    keywords: ["情侣", "求婚", "纪念日"],
    label: "情侣 / 求婚",
    hook: "情侣纪念旅拍",
    tags: ["情侣", "求婚"]
  },
  {
    keywords: ["街拍", "旅拍", "城市"],
    label: "街拍 / 旅拍",
    hook: "城市街拍旅拍",
    tags: ["街拍", "旅拍"]
  }
];

const SECRET_LIKE_PATTERN = new RegExp(
  ["api[_-]?key", "secret", "token", "bearer", "pass(?:word)?", "cookie", "sk-[a-z0-9]"].join("|"),
  "i"
);

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

function containsSecretLikeText(value) {
  return SECRET_LIKE_PATTERN.test(value) || /[A-Za-z0-9_-]{28,}/.test(value);
}

function redactSourceText(value) {
  return value.replace(/[A-Za-z0-9_-]{20,}/g, "已脱敏片段");
}

function createAIError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function detectScenario(sourceText) {
  return (
    SCENARIOS.find((scenario) => scenario.keywords.some((keyword) => sourceText.includes(keyword))) || {
      label: "内容灵感",
      hook: "这组内容",
      tags: ["内容灵感"]
    }
  );
}

function makeSeedText(sourceText, scenario, redacted) {
  if (redacted) {
    return scenario.hook;
  }
  if (!sourceText) {
    return scenario.hook;
  }
  return sourceText.length > 18 ? `${sourceText.slice(0, 18)}...` : sourceText;
}

function buildTitleTemplates({ seedText, scenario, tone, platform, contentType }) {
  const platformLabel = platform.label;
  const contentLabel = contentType.label;
  return [
    `${platformLabel}${contentLabel}：${scenario.hook}这样拍，画面感直接拉满`,
    `${seedText}的${tone.label}表达：3个镜头就够出片`,
    `适合收藏的${scenario.label}清单：从准备到出片`,
    `${tone.angle}：${scenario.hook}标题可以这样写`,
    `${platformLabel}发布备用：${seedText}也能写得更具体`
  ];
}

function generateTitleSuggestions(payload = {}) {
  const sourceText = normalizeSourceText(payload.sourceText);
  if (!sourceText) {
    throw createAIError("AI_EMPTY_INPUT", "请输入要生成标题的内容");
  }

  const count = clampCount(payload.count);
  const redacted = containsSecretLikeText(sourceText);
  const safeSourceText = redacted ? redactSourceText(sourceText) : sourceText;
  const scenario = detectScenario(safeSourceText);
  const seedText = makeSeedText(safeSourceText, scenario, redacted);
  const tone = TONE_CONFIG[payload.tone] || TONE_CONFIG.clear;
  const platform = PLATFORM_CONFIG[payload.platform] || PLATFORM_CONFIG.general;
  const contentType = CONTENT_TYPE_CONFIG[payload.contentType] || CONTENT_TYPE_CONFIG.title;
  const templates = buildTitleTemplates({ seedText, scenario, tone, platform, contentType });

  const suggestions = templates.slice(0, count).map((title, index) => ({
    title,
    rationale: `mock-only 建议 ${index + 1}：${tone.rationale} 本地生成，不上传内容。`,
    tags: ["mock", contentType.tag, platform.tag, ...scenario.tags].filter(Boolean).slice(0, 5),
    riskLevel: index === 0 ? "low" : "medium",
    score: Number((0.94 - index * 0.04).toFixed(2))
  }));

  const warnings = [];
  if (Number(payload.count || DEFAULT_COUNT) > MAX_COUNT) {
    warnings.push({ code: "COUNT_CLAMPED", message: "mock 生成最多返回 5 条标题" });
  }
  if (sourceText.length > MAX_SOURCE_CHARS) {
    warnings.push({ code: "INPUT_TRUNCATED_BY_PAGE_LIMIT", message: "页面最多输入 1200 字" });
  }
  if (redacted) {
    warnings.push({ code: "SECRET_LIKE_INPUT_REDACTED", message: "检测到疑似敏感片段，mock 结果已避免原样扩散" });
  }

  return {
    suggestions,
    provider: "mock",
    model: "titlelab-miniprogram-mock-title-v2",
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
    warnings
  };
}

module.exports = {
  DEFAULT_COUNT,
  MAX_COUNT,
  MAX_SOURCE_CHARS,
  generateTitleSuggestions
};
