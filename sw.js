const CACHE_NAME = 'titlelab-pwa-v5';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/title.html',
  '/content.html',
  '/login.html',
  '/settings.html',
  '/admin-center.html',
  '/assets/styles.css',
  '/assets/app-title.js',
  '/assets/app-content.js',
  '/assets/supabase.js',
  '/assets/classifier.js',
  '/manifest.webmanifest',
  '/icon/icon-192.png',
  '/icon/icon-512.png'
];

self.addEventListener('install', event => {
  // 立即激活新的 Service Worker，不等待旧版本关闭
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 先删除旧缓存，再添加新缓存
      return cache.addAll(OFFLINE_ASSETS).catch(err => {
        console.warn('[SW] 缓存资源失败:', err);
      });
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return undefined;
        })
      )
    ).then(() => {
      // 立即激活新的 Service Worker，控制所有客户端
      return self.clients.claim();
    })
  );
});

// 监听来自客户端的消息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // 跳过等待，立即激活
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // 网络优先策略：优先从网络获取，失败后使用缓存
  // 这样可以确保用户总是获取最新版本
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 网络请求成功，更新缓存
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });
        return response;
      })
      .catch(() => {
        // 网络请求失败，使用缓存
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // 如果缓存也没有，返回 index.html（用于 SPA 路由）
          return caches.match('/index.html');
        });
      })
  );
});
