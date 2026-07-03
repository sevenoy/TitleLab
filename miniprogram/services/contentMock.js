const contentItems = [
  {
    id: "title-onboarding-001",
    contentType: "title",
    typeLabel: "标题",
    title: "3 个动作让发布节奏更稳",
    body: "适合用于运营工具上新公告，突出低成本、可执行和稳定复盘。",
    category: "运营增长",
    tags: ["发布", "复盘", "团队"],
    usageTip: "可改写为教程标题、社群公告或版本更新摘要。",
    notes: "强调节奏和动作，适合做列表页首屏样例。",
    updatedAt: "2026-07-03"
  },
  {
    id: "copy-launch-002",
    contentType: "copywriting",
    typeLabel: "文案",
    title: "把零散标题整理成可复用素材库",
    body: "TitleLab 帮你把灵感、爆款标题和运营话术沉淀成团队可检索的内容资产。",
    category: "产品介绍",
    tags: ["素材库", "团队", "检索"],
    usageTip: "适合放在产品介绍、私域转化页或内部培训材料中。",
    notes: "正文比标题更完整，详情页复制时可直接带走。",
    updatedAt: "2026-07-03"
  },
  {
    id: "title-filter-003",
    contentType: "title",
    typeLabel: "标题",
    title: "如何用标签筛出下一篇高转化内容",
    body: "面向内容运营的教程标题，突出标签筛选和下一步行动。",
    category: "内容运营",
    tags: ["标签", "搜索", "转化"],
    usageTip: "适合知识库文章、短视频脚本或工作坊标题。",
    notes: "可用于验证 category 和 tag 本地筛选。",
    updatedAt: "2026-07-03"
  },
  {
    id: "copy-review-004",
    contentType: "copywriting",
    typeLabel: "文案",
    title: "每次复盘，都让下一次发布更轻一点",
    body: "把发布后的反馈、数据和改写记录放回素材库，团队下一次启动会更快。",
    category: "复盘沉淀",
    tags: ["复盘", "发布", "效率"],
    usageTip: "适合发布复盘、团队周报或功能更新说明。",
    notes: "用于验证搜索命中正文和备注。",
    updatedAt: "2026-07-03"
  }
];

const typeOptions = [
  { value: "all", label: "全部类型" },
  { value: "title", label: "标题" },
  { value: "copywriting", label: "文案" }
];

function cloneItem(item) {
  return {
    ...item,
    tags: item.tags.slice()
  };
}

function uniqueValues(values) {
  return Array.from(new Set(values)).sort();
}

function getContentItems(filters = {}) {
  const keyword = (filters.keyword || "").trim().toLowerCase();
  const contentType = filters.contentType || "all";
  const category = filters.category || "all";
  const tag = filters.tag || "all";

  return contentItems
    .filter((item) => contentType === "all" || item.contentType === contentType)
    .filter((item) => category === "all" || item.category === category)
    .filter((item) => tag === "all" || item.tags.includes(tag))
    .filter((item) => {
      if (!keyword) {
        return true;
      }

      const haystack = [
        item.title,
        item.body,
        item.category,
        item.usageTip,
        item.notes,
        item.tags.join(" ")
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    })
    .map(cloneItem);
}

function getContentItemById(id) {
  const item = contentItems.find((entry) => entry.id === id);
  return item ? cloneItem(item) : null;
}

function getTypeOptions() {
  return typeOptions.map((item) => ({ ...item }));
}

function getCategoryOptions() {
  return [
    { value: "all", label: "全部分类" },
    ...uniqueValues(contentItems.map((item) => item.category)).map((category) => ({
      value: category,
      label: category
    }))
  ];
}

function getTagOptions() {
  return [
    { value: "all", label: "全部标签" },
    ...uniqueValues(contentItems.flatMap((item) => item.tags)).map((tag) => ({
      value: tag,
      label: tag
    }))
  ];
}

module.exports = {
  getContentItemById,
  getContentItems,
  getTypeOptions,
  getCategoryOptions,
  getTagOptions
};
