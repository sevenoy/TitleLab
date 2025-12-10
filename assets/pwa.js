(function () {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported in this browser.');
    return;
  }

  let registration = null;
  let updateCheckInterval = null;

  // 显示更新提示并自动刷新
  function showUpdateToastAndReload() {
    // 检查是否有 toast 函数可用
    if (typeof showToast === 'function') {
      showToast('发现新版本，正在自动更新...', 'info', 2000);
    }
    
    // 延迟1秒后自动刷新，给用户看到提示的时间
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }

  // 检查 Service Worker 更新
  function checkForUpdate() {
    if (!registration) return;

    // 强制检查更新
    registration.update().then(() => {
      // 检查是否有新的 Service Worker 等待激活
      if (registration.waiting) {
        console.info('[PWA] 发现新版本，自动刷新');
        // 通知 Service Worker 跳过等待
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        showUpdateToastAndReload();
        // 停止定期检查，因为已经发现更新
        if (updateCheckInterval) {
          clearTimeout(updateCheckInterval);
          updateCheckInterval = null;
        }
        return;
      }
      
      // 监听新的 Service Worker 安装
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // 有旧版本在运行，新版本已安装
                console.info('[PWA] 新版本已安装，自动刷新');
                // 通知新 Service Worker 跳过等待
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                showUpdateToastAndReload();
                // 停止定期检查
                if (updateCheckInterval) {
                  clearTimeout(updateCheckInterval);
                  updateCheckInterval = null;
                }
              } else {
                // 首次安装，不需要刷新
                console.info('[PWA] Service Worker 首次安装');
              }
            }
          });
        }
      });
    }).catch(err => {
      console.error('[PWA] 检查更新失败:', err);
    });
  }

  window.addEventListener('load', () => {
    // 使用相对路径，适配 GitHub Pages 子目录部署
    const swUrl = './sw.js';
    navigator.serviceWorker
      .register(swUrl, { scope: './' })
      .then(reg => {
        registration = reg;
        console.info('[PWA] Service Worker registered:', reg.scope);

        // 立即检查一次更新（只在页面打开时）
        checkForUpdate();

        // 优化更新检查策略：只在页面打开/可见时检查，后台完全不运行
        // 1. 页面加载时检查一次
        // 2. 页面从后台切回前台时检查一次
        // 3. 不设置定期检查，避免后台运行费电

        // 当页面可见性变化时
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            // 页面变为可见时，立即检查一次更新
            // 这是唯一在后台切回前台时的检查时机
            checkForUpdate();
          } else {
            // 页面隐藏时，确保清除所有定时器，完全停止检查
            if (updateCheckInterval) {
              clearTimeout(updateCheckInterval);
              updateCheckInterval = null;
            }
          }
        });

        // 添加强制刷新机制：监听 Service Worker 消息
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'SKIP_WAITING') {
            console.info('[PWA] 收到强制更新消息，刷新页面');
            window.location.reload();
          }
        });

        // 监听 Service Worker 控制器变化（表示有新的 Service Worker 激活）
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.info('[PWA] Service Worker 已更新，刷新页面');
          // 自动刷新页面以使用新版本
          window.location.reload();
        });
      })
      .catch(err => {
        console.error('[PWA] Service Worker registration failed:', err);
      });
  });

  // 页面卸载时清理定时器
  window.addEventListener('beforeunload', () => {
    if (updateCheckInterval) {
      clearTimeout(updateCheckInterval);
    }
  });
})();
