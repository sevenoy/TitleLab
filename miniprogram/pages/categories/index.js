const wechat = require("../../adapters/wechat");

const CATEGORY_ROWS = [
  { id: "all", name: "全部", count: 6, locked: true },
  { id: "family", name: "亲子", count: 2 },
  { id: "mood", name: "氛围", count: 1 },
  { id: "couple", name: "情侣", count: 1 },
  { id: "solo", name: "单人", count: 1 },
  { id: "street", name: "街拍", count: 1 }
];

Page({
  data: {
    categoryRows: CATEGORY_ROWS
  },

  onCategoryAction(event) {
    const action = event.currentTarget.dataset.action || "操作";
    wechat.showToast({ title: `${action}已记录` });
  }
});
