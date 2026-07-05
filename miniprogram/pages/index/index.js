const wechat = require("../../adapters/wechat");
const localAuth = require("../../services/localAuth");

const LOGIN_FLAG_KEY = "titlelab.localAccountSignedIn";

const CATEGORY_ROWS = [
  { id: "all", name: "全部", count: 6, locked: true },
  { id: "family", name: "亲子", count: 2 },
  { id: "mood", name: "氛围", count: 1 },
  { id: "couple", name: "情侣", count: 1 },
  { id: "solo", name: "单人", count: 1 },
  { id: "street", name: "街拍", count: 1 }
];

const ACCOUNT_OPTIONS = [
  "全部账号",
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
    text: "港迪拍照技巧，轻松拍出封面级照片"
  },
  {
    id: "title-hk-disney-magic",
    categoryId: "mood",
    category: "氛围",
    text: "香港迪士尼跟拍路线，留下自然童话感"
  },
  {
    id: "title-hk-disney-family",
    categoryId: "family",
    category: "亲子",
    text: "宝妈必看，亲子照这样拍更自然"
  },
  {
    id: "title-hk-disney-relaxed",
    categoryId: "street",
    category: "街拍",
    text: "半日港迪旅拍，也能保留松弛感"
  }
];

const COPY_ITEMS = [
  {
    id: "copy-hk-disney-local",
    categoryId: "family",
    category: "亲子",
    summary: "香港本地女摄，一对一记录梦幻故事",
    lines: [
      "香港本地女摄，一对一记录梦幻故事",
      "每天少量拍摄，用心保留自然笑容。",
      "适合亲子、姐妹、情侣和纪念日跟拍。",
      "熟悉园区光线与路线，减少等待和尴尬。",
      "#港迪跟拍 #香港迪士尼拍照 #亲子摄影 #香港女摄影师"
    ]
  },
  {
    id: "copy-hk-disney-street",
    categoryId: "street",
    category: "街拍",
    summary: "香港街拍摄影师，半日路线也有故事感",
    lines: [
      "香港街拍摄影师，半日路线也有故事感",
      "从城堡到海边光影，帮你保留自然又漂亮的瞬间。",
      "适合女生单人写真、情侣跟拍、姐妹纪念和旅拍文案。",
      "#香港街拍摄影师 #女生单人写真 #情侣跟拍 #小红书标题"
    ]
  }
];

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
    expandedCopyId: null,
    currentAccountLabel: "产品账号"
  },

  onShow() {
    if (!localAuth.hasLocalSession() && !wechat.getStorage(LOGIN_FLAG_KEY)) {
      wechat.reLaunch("/pages/login/index");
    }
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
        expandedCopyId: null
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
    wechat.navigateTo("/pages/categories/index");
  },

  onLocalAction(event) {
    const action = event.currentTarget.dataset.action || "操作";
    wechat.showToast({ title: `${action}已记录` });
  },

  onOpenSettings() {
    wechat.navigateTo("/pages/settings/index");
  },

  onOpenCategories() {
    wechat.navigateTo("/pages/categories/index");
  },

  onCopyTitle(event) {
    const item = TITLE_ITEMS.find((entry) => entry.id === event.currentTarget.dataset.id);
    if (item) {
      this.copyToClipboard(item.text);
    }
  },

  onToggleCopyExpand(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({
      expandedCopyId: this.data.expandedCopyId === id ? null : id
    });
  },

  onCopyCopy(event) {
    const item = COPY_ITEMS.find((entry) => entry.id === event.currentTarget.dataset.id);
    if (item) {
      this.copyToClipboard(copyTextFromItem(item));
    }
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
      .catch(() => wechat.showToast({ title: "复制失败" }));
  }
});
