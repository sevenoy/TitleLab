const contentService = require("../../services/contentMock");

Page({
  data: {
    item: null
  },

  onLoad(options) {
    const item = contentService.getContentItemById(options.id);
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
    wx.setClipboardData({
      data,
      success: () => {
        wx.showToast({
          title,
          icon: "success"
        });
      }
    });
  }
});
