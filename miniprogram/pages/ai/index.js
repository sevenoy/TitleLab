const wechat = require("../../adapters/wechat");
const aiRepository = require("../../services/aiRepository");

const MAX_SOURCE_LENGTH = 1200;
const MIN_SOURCE_LENGTH = 6;
const MOCK_EXAMPLES = [
  {
    label: "香港迪士尼旅拍",
    text: "香港迪士尼旅拍，适合女生单人写真和情侣纪念日，想突出轻松、出片、梦幻感。"
  },
  {
    label: "摄影师跟拍",
    text: "摄影师跟拍服务，主打不尴尬引导、自然街拍、半日旅拍路线规划。"
  },
  {
    label: "求婚记录",
    text: "情侣求婚跟拍，想表达惊喜、纪念感和真实情绪，标题不要太夸张。"
  }
];

Page({
  data: {
    sourceText: "",
    sourceLength: 0,
    sourceLimit: MAX_SOURCE_LENGTH,
    minSourceLength: MIN_SOURCE_LENGTH,
    helperText: "输入 6-1200 字素材，mock 会本地生成标题建议。",
    sourceLimitReached: false,
    mockExamples: MOCK_EXAMPLES,
    selectedExampleIndex: -1,
    contentTypeIndex: 0,
    toneIndex: 1,
    platformIndex: 2,
    countIndex: 2,
    contentTypeOptions: [
      { value: "title", label: "标题" },
      { value: "copywriting", label: "文案" },
      { value: "template", label: "模板" }
    ],
    toneOptions: [
      { value: "clear", label: "清晰" },
      { value: "warm", label: "温和" },
      { value: "sharp", label: "直接" },
      { value: "playful", label: "轻快" }
    ],
    platformOptions: [
      { value: "general", label: "通用" },
      { value: "wechat", label: "微信" },
      { value: "xiaohongshu", label: "小红书" },
      { value: "douyin", label: "短视频" }
    ],
    countOptions: [
      { value: 1, label: "1 条" },
      { value: 2, label: "2 条" },
      { value: 3, label: "3 条" },
      { value: 4, label: "4 条" },
      { value: 5, label: "5 条" }
    ],
    loading: false,
    error: null,
    result: null,
    suggestions: [],
    warnings: [],
    hasGenerated: false,
    canGenerate: false,
    canCopyAll: false,
    lastGeneratedAt: ""
  },

  onSourceInput(event) {
    this.updateSourceText(event.detail.value || "", -1);
  },

  onContentTypeChange(event) {
    this.setData({ contentTypeIndex: Number(event.detail.value) });
  },

  onToneChange(event) {
    this.setData({ toneIndex: Number(event.detail.value) });
  },

  onPlatformChange(event) {
    this.setData({ platformIndex: Number(event.detail.value) });
  },

  onCountChange(event) {
    this.setData({ countIndex: Number(event.detail.value) });
  },

  onUseExample(event) {
    const index = Number(event.currentTarget.dataset.index);
    const item = this.data.mockExamples[index];
    if (!item) {
      return;
    }

    this.updateSourceText(item.text, index);
  },

  onGenerate() {
    const validation = this.validateSourceText();
    if (!validation.ok) {
      const error = {
        code: validation.code,
        message: validation.message,
        isEmptyInput: validation.code === "AI_EMPTY_INPUT",
        isRetryable: false
      };
      this.setData({
        error,
        result: null,
        suggestions: [],
        warnings: [],
        canCopyAll: false,
        hasGenerated: false
      });
      wechat.showToast({ title: validation.message });
      return;
    }

    const payload = this.buildPayload();
    this.generateWithPayload(payload);
  },

  generateWithPayload(payload) {
    const requestToken = Date.now();
    this.aiRequestToken = requestToken;
    this.lastPayload = { ...payload };
    this.setData({
      loading: true,
      error: null,
      result: null,
      suggestions: [],
      warnings: [],
      hasGenerated: false,
      canCopyAll: false
    });

    aiRepository
      .generateTitleSuggestions(payload)
      .then((result) => {
        if (this.aiRequestToken !== requestToken) {
          return;
        }
        const suggestions = result.suggestions || [];
        this.setData({
          result,
          suggestions,
          warnings: result.warnings || [],
          loading: false,
          error: null,
          hasGenerated: true,
          canCopyAll: suggestions.length > 0,
          lastGeneratedAt: "刚刚生成"
        });
      })
      .catch((error) => {
        if (this.aiRequestToken !== requestToken) {
          return;
        }
        const displayError = aiRepository.toDisplayError(error);
        this.setData({
          result: null,
          suggestions: [],
          warnings: [],
          loading: false,
          error: displayError,
          hasGenerated: false,
          canCopyAll: false
        });
        wechat.showToast({ title: displayError.message || "生成失败" });
      });
  },

  onRetry() {
    if (this.data.loading) {
      return;
    }

    if (this.lastPayload) {
      this.updateSourceText(this.lastPayload.sourceText || "", -1, () => {
        this.generateWithPayload({ ...this.lastPayload });
      });
      return;
    }

    this.onGenerate();
  },

  onCopyTitle(event) {
    const index = Number(event.currentTarget.dataset.index);
    const item = this.data.suggestions[index];
    if (!item || !item.title) {
      return;
    }

    wechat.setClipboardData(item.title)
      .then(() => wechat.showToast({ title: "标题已复制", icon: "success" }))
      .catch(() => wechat.showToast({ title: "复制失败" }));
  },

  onCopyAll() {
    if (!this.data.suggestions.length) {
      return;
    }

    const text = this.data.suggestions.map((item, index) => `${index + 1}. ${item.title}`).join("\n");
    wechat.setClipboardData(text)
      .then(() => wechat.showToast({ title: "已复制全部标题", icon: "success" }))
      .catch(() => wechat.showToast({ title: "复制失败" }));
  },

  onClear() {
    this.aiRequestToken = 0;
    this.lastPayload = null;
    this.setData({
      sourceText: "",
      sourceLength: 0,
      helperText: "输入 6-1200 字素材，mock 会本地生成标题建议。",
      sourceLimitReached: false,
      selectedExampleIndex: -1,
      contentTypeIndex: 0,
      toneIndex: 1,
      platformIndex: 2,
      countIndex: 2,
      loading: false,
      error: null,
      result: null,
      suggestions: [],
      warnings: [],
      hasGenerated: false,
      canGenerate: false,
      canCopyAll: false,
      lastGeneratedAt: ""
    });
  },

  updateSourceText(value, selectedExampleIndex, callback) {
    const rawText = String(value || "");
    const sourceText = rawText.slice(0, MAX_SOURCE_LENGTH);
    const sourceLength = sourceText.trim().length;
    const canGenerate = sourceLength >= MIN_SOURCE_LENGTH && sourceLength <= MAX_SOURCE_LENGTH;
    const sourceLimitReached = rawText.length > MAX_SOURCE_LENGTH || sourceText.length >= MAX_SOURCE_LENGTH;
    let helperText = "输入 6-1200 字素材，mock 会本地生成标题建议。";
    if (sourceLength > 0 && sourceLength < MIN_SOURCE_LENGTH) {
      helperText = `还差 ${MIN_SOURCE_LENGTH - sourceLength} 个字，素材更完整时 mock 更稳。`;
    } else if (sourceLimitReached) {
      helperText = `${sourceLength}/${MAX_SOURCE_LENGTH} 字，已到本地输入上限，不上传内容。`;
    } else if (sourceLength) {
      helperText = `${sourceLength}/${MAX_SOURCE_LENGTH} 字，当前为本地 mock，不上传内容。`;
    }

    this.setData({
      sourceText,
      sourceLength,
      helperText,
      sourceLimitReached,
      selectedExampleIndex,
      canGenerate,
      error: null
    }, callback);
  },

  validateSourceText() {
    const sourceLength = String(this.data.sourceText || "").trim().length;
    if (!sourceLength) {
      return { ok: false, code: "AI_EMPTY_INPUT", message: "先输入一段素材，再生成标题" };
    }
    if (sourceLength < MIN_SOURCE_LENGTH) {
      return { ok: false, code: "AI_INPUT_TOO_SHORT", message: "素材至少 6 个字，标题会更稳" };
    }
    return { ok: true };
  },

  buildPayload() {
    const contentType = this.data.contentTypeOptions[this.data.contentTypeIndex] || this.data.contentTypeOptions[0];
    const tone = this.data.toneOptions[this.data.toneIndex] || this.data.toneOptions[0];
    const platform = this.data.platformOptions[this.data.platformIndex] || this.data.platformOptions[0];
    const count = this.data.countOptions[this.data.countIndex] || this.data.countOptions[2];

    return {
      sourceText: this.data.sourceText,
      contentType: contentType.value,
      tone: tone.value,
      platform: platform.value,
      count: count.value,
      constraints: ["mock-only", "不上传数据"],
      referenceTitles: [],
      locale: "zh-CN"
    };
  }
});
