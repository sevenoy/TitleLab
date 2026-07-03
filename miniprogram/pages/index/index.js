const contentService = require("../../services/contentMock");

Page({
  data: {
    keyword: "",
    typeIndex: 0,
    categoryIndex: 0,
    tagIndex: 0,
    typeOptions: [],
    categoryOptions: [],
    tagOptions: [],
    typeLabel: "全部类型",
    categoryLabel: "全部分类",
    tagLabel: "全部标签",
    items: [],
    total: 0
  },

  onLoad() {
    this.setData({
      typeOptions: contentService.getTypeOptions(),
      categoryOptions: contentService.getCategoryOptions(),
      tagOptions: contentService.getTagOptions()
    });
    this.refreshList();
  },

  onSearchInput(event) {
    this.setData(
      {
        keyword: event.detail.value || ""
      },
      () => this.refreshList()
    );
  },

  onTypeChange(event) {
    this.setData(
      {
        typeIndex: Number(event.detail.value)
      },
      () => this.refreshList()
    );
  },

  onCategoryChange(event) {
    this.setData(
      {
        categoryIndex: Number(event.detail.value)
      },
      () => this.refreshList()
    );
  },

  onTagChange(event) {
    this.setData(
      {
        tagIndex: Number(event.detail.value)
      },
      () => this.refreshList()
    );
  },

  onClearFilters() {
    this.setData(
      {
        keyword: "",
        typeIndex: 0,
        categoryIndex: 0,
        tagIndex: 0
      },
      () => this.refreshList()
    );
  },

  onOpenDetail(event) {
    const id = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  },

  refreshList() {
    const type = this.data.typeOptions[this.data.typeIndex] || { value: "all" };
    const category = this.data.categoryOptions[this.data.categoryIndex] || { value: "all" };
    const tag = this.data.tagOptions[this.data.tagIndex] || { value: "all" };
    const items = contentService.getContentItems({
      keyword: this.data.keyword,
      contentType: type.value,
      category: category.value,
      tag: tag.value
    });

    this.setData({
      items,
      total: items.length,
      typeLabel: type.label,
      categoryLabel: category.label,
      tagLabel: tag.label
    });
  }
});
