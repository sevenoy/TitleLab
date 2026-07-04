const wechat = require("../../adapters/wechat");
const contentRepository = require("../../services/contentRepository");

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
    total: 0,
    loading: false,
    error: null
  },

  onLoad() {
    this.loadOptions();
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
    wechat.navigateTo(`/pages/detail/detail?id=${id}`);
  },

  loadOptions() {
    Promise.all([
      contentRepository.getTypeOptions(),
      contentRepository.getCategoryOptions(),
      contentRepository.getTagOptions()
    ])
      .then(([typeOptions, categoryOptions, tagOptions]) => {
        this.setData(
          {
            typeOptions,
            categoryOptions,
            tagOptions
          },
          () => this.refreshList()
        );
      })
      .catch((error) => this.handleLoadError(error));
  },

  refreshList() {
    const requestToken = Date.now();
    this.listRequestToken = requestToken;

    const type = this.data.typeOptions[this.data.typeIndex] || { value: "all" };
    const category = this.data.categoryOptions[this.data.categoryIndex] || { value: "all" };
    const tag = this.data.tagOptions[this.data.tagIndex] || { value: "all" };

    this.setData({
      loading: true,
      error: null,
      typeLabel: type.label,
      categoryLabel: category.label,
      tagLabel: tag.label
    });

    contentRepository
      .getContentItems({
        keyword: this.data.keyword,
        contentType: type.value,
        category: category.value,
        categoryId: category.value,
        tag: tag.value,
        tagId: tag.value
      })
      .then((result) => {
        if (this.listRequestToken !== requestToken) {
          return;
        }

        const items = result.items || [];
        this.setData({
          items,
          total: items.length,
          loading: false,
          error: null
        });
      })
      .catch((error) => this.handleLoadError(error));
  },

  handleLoadError(error) {
    const displayError = contentRepository.toDisplayError(error);
    this.setData({
      items: [],
      total: 0,
      loading: false,
      error: displayError
    });
    wechat.showToast({ title: displayError.message || "内容加载失败" });
  }
});
