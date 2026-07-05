const wechat = require("../../adapters/wechat");

const CATEGORY_ROWS = [
  { id: "all", name: "全部", count: 63, locked: true },
  { id: "family", name: "亲子", count: 20 },
  { id: "mood", name: "氛围", count: 0 },
  { id: "couple", name: "情侣", count: 1 },
  { id: "friends", name: "闺蜜", count: 0 },
  { id: "solo", name: "单人", count: 10 },
  { id: "street", name: "街拍", count: 17 },
  { id: "recommend", name: "口碑推荐", count: 5 },
  { id: "festival", name: "节日", count: 9 }
];

const ACCOUNT_OPTIONS = [
  "账号分类",
  "香港街拍摄影师",
  "女生单人写真",
  "情侣跟拍",
  "旅拍文案",
  "小红书标题"
];

const TITLE_ITEMS = [
  {
    id: "title-hk-disney-cover",
    categoryId: "family",
    category: "亲子",
    text: "港迪拍照技巧，轻松拍出封面级照片💕"
  },
  {
    id: "title-hk-disney-magic",
    categoryId: "mood",
    category: "氛围",
    text: "港迪摄影师带你走进魔法，拍出属于你的童话时刻💖"
  },
  {
    id: "title-hk-disney-family",
    categoryId: "family",
    category: "亲子",
    text: "宝妈必看！香港迪士尼亲子照怎么拍才出片💕"
  },
  {
    id: "title-hk-disney-relaxed",
    categoryId: "street",
    category: "街拍",
    text: "半小时也能拍出松弛感港迪旅拍📸"
  }
];

const COPY_ITEMS = [
  {
    id: "copy-hk-disney-local",
    categoryId: "family",
    category: "亲子",
    summary: "香港本地女摄｜合法持证，安心拍梦幻故事✨",
    lines: [
      "香港本地女摄｜合法持证，安心拍梦幻故事✨",
      "📍只拍一对一，每天最多2～3组，用心守护每场光。",
      "💗亲子、姐妹、情侣最擅长捕捉自然笑容",
      "🌇熟悉园区每个时间段的梦幻光",
      "✨让回忆不止是照片，而是童话一幕",
      "#港迪跟拍 #香港迪士尼拍照 #亲子摄影 #香港女摄影师"
    ]
  },
  {
    id: "copy-hk-disney-street",
    categoryId: "street",
    category: "街拍",
    summary: "香港街拍摄影师｜半日路线也能拍出轻松故事感",
    lines: [
      "香港街拍摄影师｜半日路线也能拍出轻松故事感",
      "从港迪城堡到海边光影，帮你保留自然又漂亮的瞬间。",
      "适合女生单人写真、情侣跟拍、姐妹纪念和旅拍文案。",
      "#香港街拍摄影师 #女生单人写真 #情侣跟拍 #小红书标题"
    ]
  }
];

const TITLE_AI_SETS = {
  similar: [
    "港迪拍照技巧，轻松拍出封面级照片💕",
    "港迪摄影师带你走进魔法，拍出属于你的童话时刻💖",
    "宝妈必看！香港迪士尼亲子照怎么拍才出片💕"
  ],
  stronger: [
    "半小时也能拍出松弛感港迪旅拍📸",
    "香港迪士尼旅拍这样拍，亲子照也能像童话封面",
    "港迪跟拍不尴尬攻略，轻松留下自然笑容"
  ],
  xhs: [
    "小红书标题灵感：港迪亲子照这样写更想收藏",
    "香港迪士尼拍照路线，半日也能收获梦幻光",
    "女生单人写真在港迪，轻松拍出故事感"
  ],
  natural: [
    "在香港迪士尼，把亲子照拍得自然又有光",
    "港迪旅拍不赶场，慢慢记录每个漂亮瞬间",
    "香港本地女摄带路，拍一组安心又松弛的照片"
  ]
};

const COPY_AI_SETS = {
  extract: [
    "香港本地女摄，带你拍一组安心港迪童话感",
    "港迪亲子跟拍这样安排，轻松保留自然笑容",
    "一对一港迪旅拍，把回忆拍成童话一幕"
  ],
  rewrite: [
    "香港本地女摄一对一跟拍，每天只接少量拍摄，用熟悉园区光线的经验，帮亲子、姐妹和情侣留下自然笑容。",
    "从城堡到黄昏光线，帮你把港迪旅拍安排得轻松一点，让照片更像一段可以反复回看的故事。",
    "合法持证、熟悉路线、温柔引导，把梦幻感和真实表情一起留在照片里。"
  ],
  topic: [
    "#港迪跟拍 #香港迪士尼拍照 #亲子摄影 #香港女摄影师",
    "#香港街拍摄影师 #女生单人写真 #情侣跟拍 #旅拍文案",
    "#小红书标题 #香港迪士尼旅拍 #港迪亲子照 #童话感照片"
  ],
  concise: [
    "香港本地女摄，一对一港迪跟拍，安心记录童话感瞬间。",
    "每天少量拍摄，熟悉园区光线，适合亲子、姐妹和情侣。",
    "让回忆不止是照片，而是可以反复回看的梦幻故事。"
  ]
};

function copyTextFromItem(item) {
  return item.lines ? item.lines.join("\n") : item.text;
}

function filterByKeywordAndCategory(items, keyword, categoryId) {
  const normalized = String(keyword || "").trim().toLowerCase();
  return items.filter((item) => {
    const categoryMatched = !categoryId || categoryId === "all" || item.categoryId === categoryId;
    const text = copyTextFromItem(item).toLowerCase();
    return categoryMatched && (!normalized || text.includes(normalized) || item.category.includes(normalized));
  });
}

Page({
  data: {
    activeTab: "title",
    keyword: "",
    accountIndex: 0,
    accountOptions: ACCOUNT_OPTIONS,
    categoryRows: CATEGORY_ROWS,
    selectedCategoryId: "all",
    titleItems: TITLE_ITEMS,
    copyItems: COPY_ITEMS,
    activeAiTitleId: null,
    activeTitleAiMode: "similar",
    titleAiResults: TITLE_AI_SETS.similar,
    titleAiModes: [
      { id: "similar", label: "相似标题" },
      { id: "stronger", label: "更吸引人" },
      { id: "xhs", label: "更小红书" },
      { id: "natural", label: "更自然" }
    ],
    expandedCopyId: null,
    activeCopyAiId: null,
    activeCopyAiMode: "extract",
    copyAiResults: COPY_AI_SETS.extract,
    copyAiModes: [
      { id: "extract", label: "提取标题" },
      { id: "rewrite", label: "改写文案" },
      { id: "topic", label: "生成话题" },
      { id: "concise", label: "精简文案" }
    ]
  },

  onSwitchTab(event) {
    const tab = event.currentTarget.dataset.tab;
    if (!tab || tab === this.data.activeTab) {
      return;
    }

    this.setData(
      {
        activeTab: tab,
        keyword: "",
        activeAiTitleId: null,
        activeCopyAiId: null
      },
      () => this.refreshVisibleItems()
    );
  },

  onSearchInput(event) {
    this.setData({ keyword: event.detail.value || "" }, () => this.refreshVisibleItems());
  },

  onAccountChange(event) {
    this.setData({ accountIndex: Number(event.detail.value) });
  },

  onSelectCategory(event) {
    this.setData({ selectedCategoryId: event.currentTarget.dataset.id || "all" }, () => this.refreshVisibleItems());
  },

  onCategoryTool() {
    wechat.showToast({ title: "本地示例" });
  },

  onLocalAction() {
    wechat.showToast({ title: "本地示例" });
  },

  onCopyTitle(event) {
    const item = TITLE_ITEMS.find((entry) => entry.id === event.currentTarget.dataset.id);
    if (item) {
      this.copyToClipboard(item.text);
    }
  },

  onToggleTitleAi(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({
      activeAiTitleId: this.data.activeAiTitleId === id ? null : id
    });
  },

  onSetTitleAiMode(event) {
    const mode = event.currentTarget.dataset.mode || "similar";
    this.setData({
      activeTitleAiMode: mode,
      titleAiResults: TITLE_AI_SETS[mode] || TITLE_AI_SETS.similar
    });
  },

  onRefreshTitleAi() {
    const current = this.data.titleAiResults;
    this.setData({
      titleAiResults: current.slice(1).concat(current[0])
    });
  },

  onCloseTitleAi() {
    this.setData({ activeAiTitleId: null });
  },

  onCopyTitleAiResult(event) {
    const text = this.data.titleAiResults[Number(event.currentTarget.dataset.index)];
    if (text) {
      this.copyToClipboard(text);
    }
  },

  onAddTitleAiResult() {
    wechat.showToast({ title: "已加入标题库", icon: "success" });
  },

  onToggleCopyExpand(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({
      expandedCopyId: this.data.expandedCopyId === id ? null : id
    });
  },

  onToggleCopyAi(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({
      expandedCopyId: id,
      activeCopyAiId: this.data.activeCopyAiId === id ? null : id
    });
  },

  onSetCopyAiMode(event) {
    const mode = event.currentTarget.dataset.mode || "extract";
    this.setData({
      activeCopyAiMode: mode,
      copyAiResults: COPY_AI_SETS[mode] || COPY_AI_SETS.extract
    });
  },

  onRefreshCopyAi() {
    const current = this.data.copyAiResults;
    this.setData({
      copyAiResults: current.slice(1).concat(current[0])
    });
  },

  onCloseCopyAi() {
    this.setData({ activeCopyAiId: null });
  },

  onCopyCopy(event) {
    const item = COPY_ITEMS.find((entry) => entry.id === event.currentTarget.dataset.id);
    if (item) {
      this.copyToClipboard(copyTextFromItem(item));
    }
  },

  onCopyCopyAiResult(event) {
    const text = this.data.copyAiResults[Number(event.currentTarget.dataset.index)];
    if (text) {
      this.copyToClipboard(text);
    }
  },

  onAddCopyAiTitle() {
    wechat.showToast({ title: "已加入标题库", icon: "success" });
  },

  refreshVisibleItems() {
    const keyword = this.data.keyword;
    const categoryId = this.data.selectedCategoryId;
    this.setData({
      titleItems: filterByKeywordAndCategory(TITLE_ITEMS, keyword, categoryId),
      copyItems: filterByKeywordAndCategory(COPY_ITEMS, keyword, categoryId)
    });
  },

  copyToClipboard(text) {
    wechat.setClipboardData(text)
      .then(() => wechat.showToast({ title: "已复制", icon: "success" }))
      .catch(() => wechat.showToast({ title: "本地示例" }));
  }
});
