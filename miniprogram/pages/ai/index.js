const wechat = require("../../adapters/wechat");
const aiRepository = require("../../services/aiRepository");

Page({
  data: {
    sourceText: "",
    contentTypeIndex: 0,
    toneIndex: 0,
    platformIndex: 0,
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
    suggestions: []
  },

  onSourceInput(event) {
    this.setData({ sourceText: event.detail.value || "" });
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

  onGenerate() {
    const payload = this.buildPayload();
    this.setData({ loading: true, error: null });

    aiRepository
      .generateTitleSuggestions(payload)
      .then((result) => {
        this.setData({
          result,
          suggestions: result.suggestions,
          loading: false,
          error: null
        });
      })
      .catch((error) => {
        const displayError = aiRepository.toDisplayError(error);
        this.setData({
          result: null,
          suggestions: [],
          loading: false,
          error: displayError
        });
        wechat.showToast({ title: displayError.message || "生成失败" });
      });
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

  onClear() {
    this.setData({
      sourceText: "",
      contentTypeIndex: 0,
      toneIndex: 0,
      platformIndex: 0,
      countIndex: 2,
      loading: false,
      error: null,
      result: null,
      suggestions: []
    });
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
