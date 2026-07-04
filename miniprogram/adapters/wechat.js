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

function login() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (result && result.code) {
          resolve(result.code);
          return;
        }

        reject(new Error("WECHAT_LOGIN_NO_CODE"));
      },
      fail: reject
    });
  });
}

function getDeviceLabel() {
  try {
    if (typeof wx.getDeviceInfo === "function") {
      const info = wx.getDeviceInfo();
      return [info.brand, info.model].filter(Boolean).join(" ") || "WeChat Mini Program";
    }

    if (typeof wx.getSystemInfoSync === "function") {
      const info = wx.getSystemInfoSync();
      return [info.brand, info.model].filter(Boolean).join(" ") || "WeChat Mini Program";
    }
  } catch (error) {
    return "WeChat Mini Program";
  }

  return "WeChat Mini Program";
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
  login,
  getDeviceLabel,
  setStorage,
  getStorage,
  removeStorage
};
