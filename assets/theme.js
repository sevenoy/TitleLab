/**
 * 主题管理模块
 * 负责在所有页面加载时应用用户选择的主题
 */

(function() {
  'use strict';

  // 获取当前用户
  function getCurrentUser() {
    try {
      const raw = localStorage.getItem('current_user_v1');
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  // 获取显示设置的 localStorage key
  function getDisplaySettingsLSKey() {
    const user = getCurrentUser();
    const username = user ? user.username : 'default';
    return `display_settings_v1_${username}`;
  }

  // 加载并应用主题
  function loadAndApplyTheme() {
    const key = getDisplaySettingsLSKey();
    const raw = localStorage.getItem(key);
    
    let theme = 'default';
    
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        theme = parsed.theme || 'default';
      } catch (e) {
        console.error('[Theme] 解析主题设置失败', e);
      }
    }
    
    // 应用主题到 documentElement
    if (theme === 'minimalist') {
      document.documentElement.setAttribute('data-theme', 'minimalist');
      console.log('[Theme] 已应用简约现代主题');
    } else {
      document.documentElement.removeAttribute('data-theme');
      console.log('[Theme] 已应用默认主题');
    }
    
    // 应用自定义颜色（如果存在）
    applyCustomColors(raw ? JSON.parse(raw) : {});
  }

  // 应用自定义颜色
  function applyCustomColors(settings) {
    const root = document.documentElement;
    
    if (settings.brandColor) {
      root.style.setProperty('--brand-blue', settings.brandColor);
    }
    if (settings.brandHover) {
      root.style.setProperty('--brand-blue-hover', settings.brandHover);
    }
    if (settings.ghostColor) {
      root.style.setProperty('--ghost-bg', settings.ghostColor);
    }
    if (settings.ghostHover) {
      root.style.setProperty('--ghost-hover', settings.ghostHover);
    }
    if (settings.stripeColor) {
      root.style.setProperty('--table-stripe', settings.stripeColor);
    }
    if (settings.hoverColor) {
      root.style.setProperty('--list-hover', settings.hoverColor);
    }
    if (settings.titleColor) {
      root.style.setProperty('--topbar-title-color', settings.titleColor);
    }
  }

  // 监听主题变更事件
  window.addEventListener('settingsUpdated', (e) => {
    if (e.detail && e.detail.scope === 'display_settings') {
      loadAndApplyTheme();
      console.log('[Theme] 检测到设置更新，已重新应用主题');
    }
  });

  // 立即执行主题应用（在 DOM 加载前，避免闪烁）
  loadAndApplyTheme();

  console.log('[Theme] 主题管理模块已加载');
})();

