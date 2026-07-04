const wechat = require("../../adapters/wechat");
const contentRepository = require("../../services/contentRepository");

Page({
  data: {
    item: null,
    loading: false,
    error: null
  },

  onLoad(options) {
    this.loadDetail(options.id);
  },

  loadDetail(id) {
    this.setData({
      loading: true,
      error: null
    });

    contentRepository
      .getContentItemById(id)
      .then((item) => {
        this.setData({
          item,
          loading: false,
          error: item ? null : contentRepository.toDisplayError({ code: "NOT_FOUND", message: "内容不存在" })
        });
      })
      .catch((error) => {
        const displayError = contentRepository.toDisplayError(error);
        this.setData({
          item: null,
          loading: false,
          error: displayError
        });

        if (!displayError.isNotFound) {
          wechat.showToast({ title: displayError.message || "内容加载失败" });
        }
      });
  },

  onCopyTitle() {
    if (!this.data.item) {
      return;
    }

    this.copyText(this.data.item.title, "标题已复制");
  },

  onCopyBody() {
    if (!this.data.item) {
      return;
    }

    const item = this.data.item;
    this.copyText(`${item.title}\n\n${item.body}`, "正文已复制");
  },

  copyText(data, title) {
    wechat
      .setClipboardData(data)
      .then(() => wechat.showToast({ title, icon: "success" }))
      .catch(() => wechat.showToast({ title: "复制失败" }));
  }
});
