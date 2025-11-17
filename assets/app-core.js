// assets/app-core.js
// 整个内容管理应用的入口（后续会管 标题 + 文案）
// 当前阶段：只负责启动“标题模块”

console.log('[AppCore] app-core.js loaded');

(function () {
  // 预留一个全局 appCore 对象，后面可以挂更多方法
  const appCore = {
    activeTab: 'title', // 目前默认就是标题，后续会接入文案 tab
  };

  window.appCore = appCore;

  document.addEventListener('DOMContentLoaded', () => {
    console.log('[AppCore] DOMContentLoaded');

    // 当前阶段，只初始化标题模块
    if (typeof window.initTitleModule === 'function') {
      try {
        window.initTitleModule();
      } catch (e) {
        console.error('[AppCore] initTitleModule 出错：', e);
      }
    } else {
      console.warn(
        '[AppCore] 未找到 window.initTitleModule，检查 app-title.js 是否正确加载'
      );
    }
  });
})();
