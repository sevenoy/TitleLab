const wechat = require("../../adapters/wechat");
const contentRepository = require("../../services/contentRepository");

Page({
  data: {
    item: null
  },

  onLoad(options) {
    const item = contentRepository.getContentItemById(options.id);
    this.setData({
      item
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
