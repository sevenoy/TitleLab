function navigateTo(url) {
  return new Promise((resolve, reject) => {
    wx.navigateTo({
      url,
      success: resolve,
      fail: reject
    });
  });
}

function setClipboardData(data) {
  return new Promise((resolve, reject) => {
    wx.setClipboardData({
      data,
      success: resolve,
      fail: reject
    });
  });
}

function showToast(options) {
  return new Promise((resolve, reject) => {
    wx.showToast({
      icon: "none",
      ...options,
      success: resolve,
      fail: reject
    });
  });
}

function getNetworkType() {
  return new Promise((resolve, reject) => {
    wx.getNetworkType({
      success: resolve,
      fail: reject
    });
  });
}

function setStorage(key, data) {
  wx.setStorageSync(key, data);
}

function getStorage(key) {
  return wx.getStorageSync(key);
}

function removeStorage(key) {
  wx.removeStorageSync(key);
}

module.exports = {
  navigateTo,
  setClipboardData,
  showToast,
  getNetworkType,
  setStorage,
  getStorage,
  removeStorage
};
