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

    registration.update().then(() => {
      // 检查是否有新的 Service Worker 等待激活
      if (registration.waiting) {
        console.info('[PWA] 发现新版本，自动刷新');
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
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.info('[PWA] 新版本已安装，自动刷新');
              showUpdateToastAndReload();
              // 停止定期检查
              if (updateCheckInterval) {
                clearTimeout(updateCheckInterval);
                updateCheckInterval = null;
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

        // 立即检查一次更新
        checkForUpdate();

        // 优化更新检查策略，减少对电池的影响：
        // 1. 只在页面可见时检查（使用 Page Visibility API）
        // 2. 增加检查间隔到3分钟（180秒），减少网络请求频率
        // 3. 当页面从后台切换到前台时检查一次
        let lastCheckTime = Date.now();
        const CHECK_INTERVAL = 180000; // 3分钟，减少检查频率

        function scheduleNextCheck() {
          // 清除之前的定时器
          if (updateCheckInterval) {
            clearTimeout(updateCheckInterval);
          }
          
          // 只在页面可见时设置定时器
          if (!document.hidden) {
            const timeSinceLastCheck = Date.now() - lastCheckTime;
            const delay = Math.max(0, CHECK_INTERVAL - timeSinceLastCheck);
            
            updateCheckInterval = setTimeout(() => {
              if (!document.hidden) {
                checkForUpdate();
                lastCheckTime = Date.now();
              }
              scheduleNextCheck(); // 递归调度下一次检查
            }, delay);
          }
        }

        // 初始调度
        scheduleNextCheck();

        // 当页面可见性变化时
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            // 页面变为可见时，如果距离上次检查超过1分钟，立即检查一次
            const timeSinceLastCheck = Date.now() - lastCheckTime;
            if (timeSinceLastCheck > 60000) {
              checkForUpdate();
              lastCheckTime = Date.now();
            }
            // 重新调度定时检查
            scheduleNextCheck();
          } else {
            // 页面隐藏时，清除定时器，停止检查
            if (updateCheckInterval) {
              clearTimeout(updateCheckInterval);
              updateCheckInterval = null;
            }
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
