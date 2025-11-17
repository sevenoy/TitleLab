// assets/app-settings.js
// 显示设置页面：按钮颜色 / 隔行色 / hover 色 / 场景管理 / 标题文字

console.log('[SettingsApp] app-settings.js loaded');

// =============== 0. 常量 & 默认值 ===============

const DISPLAY_SETTINGS_KEY = 'display_settings_v1';

const DEFAULT_DISPLAY_SETTINGS = {
  brandColor: '#1990ff',
  brandHover: '#1477dd',
  ghostColor: '#eef2ff',
  ghostHover: '#e2e8ff',
  stripeColor: '#f9fafb',
  hoverColor: '#eef2ff',
  scenes: ['港迪城堡', '烟花', '夜景', '香港街拍'],
  titleText: '标题与文案管理系统',
  titleColor: '#1990ff'
};

const settingsState = {
  current: { ...DEFAULT_DISPLAY_SETTINGS }
};

let settingsToastTimer = null;

// =============== 1. 工具函数：读 / 写显示设置 ===============

function loadDisplaySettings() {
  // 优先走 TitleApp 提供的统一函数（如果存在）
  if (window.TitleApp && typeof window.TitleApp.getDisplaySettings === 'function') {
    try {
      const s = window.TitleApp.getDisplaySettings();
      settingsState.current = { ...DEFAULT_DISPLAY_SETTINGS, ...s };
      return settingsState.current;
    } catch (e) {
      console.warn('[SettingsApp] 从 TitleApp 获取显示设置失败，回退到 localStorage', e);
    }
  }

  const raw = localStorage.getItem(DISPLAY_SETTINGS_KEY);
  if (!raw) {
    settingsState.current = { ...DEFAULT_DISPLAY_SETTINGS };
    return settingsState.current;
  }

  try {
    const parsed = JSON.parse(raw);
    const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
    settingsState.current = {
      ...DEFAULT_DISPLAY_SETTINGS,
      ...parsed,
      scenes: scenes.length ? scenes : [...DEFAULT_DISPLAY_SETTINGS.scenes]
    };
    return settingsState.current;
  } catch (e) {
    console.error('[SettingsApp] 解析显示设置失败，使用默认值', e);
    settingsState.current = { ...DEFAULT_DISPLAY_SETTINGS };
    return settingsState.current;
  }
}

function saveDisplaySettings(newSettings) {
  const merged = {
    ...DEFAULT_DISPLAY_SETTINGS,
    ...settingsState.current,
    ...newSettings
  };

  // 写入内存
  settingsState.current = merged;

  // 写入 localStorage
  try {
    localStorage.setItem(DISPLAY_SETTINGS_KEY, JSON.stringify(merged));
  } catch (e) {
    console.error('[SettingsApp] 写入显示设置失败', e);
  }

  // 尝试通知标题页 / 文案页刷新显示
  try {
    if (
      window.TitleApp &&
      typeof window.TitleApp.applyDisplaySettings === 'function'
    ) {
      window.TitleApp.applyDisplaySettings();
    }
  } catch (e) {
    console.warn('[SettingsApp] 调用 TitleApp.applyDisplaySettings 失败', e);
  }

  try {
    if (
      window.CopyApp &&
      typeof window.CopyApp.applyDisplaySettings === 'function'
    ) {
      window.CopyApp.applyDisplaySettings();
    }
  } catch (e) {
    console.warn('[SettingsApp] 调用 CopyApp.applyDisplaySettings 失败', e);
  }

  // 本页预览也立即生效（CSS 变量）
  applyPreviewToDocument(merged);
}

// 把设置映射到 CSS 变量，保证本页预览
function applyPreviewToDocument(settings) {
  const s = settings || settingsState.current;
  const root = document.documentElement;

  root.style.setProperty('--brand-blue', s.brandColor);
  root.style.setProperty('--brand-blue-hover', s.brandHover);
  root.style.setProperty('--ghost-bg', s.ghostColor);
  root.style.setProperty('--ghost-hover', s.ghostHover);
  root.style.setProperty('--table-stripe', s.stripeColor);
  root.style.setProperty('--list-hover', s.hoverColor);
  root.style.setProperty('--topbar-title-color', s.titleColor);

  const topbarTitle = document.querySelector('.topbar-title');
  if (topbarTitle) {
    topbarTitle.textContent = s.titleText || DEFAULT_DISPLAY_SETTINGS.titleText;
    topbarTitle.style.color = s.titleColor || DEFAULT_DISPLAY_SETTINGS.titleColor;
  }
}

// =============== 2. 初始化表单 ===============

function initSettingsForm() {
  const s = loadDisplaySettings();

  // 颜色输入
  const brandColorInput = document.getElementById('brandColorInput');
  const brandHoverInput = document.getElementById('brandHoverInput');
  const ghostColorInput = document.getElementById('ghostColorInput');
  const ghostHoverInput = document.getElementById('ghostHoverInput');
  const stripeColorInput = document.getElementById('stripeColorInput');
  const hoverColorInput = document.getElementById('hoverColorInput');

  if (brandColorInput) brandColorInput.value = s.brandColor;
  if (brandHoverInput) brandHoverInput.value = s.brandHover;
  if (ghostColorInput) ghostColorInput.value = s.ghostColor;
  if (ghostHoverInput) ghostHoverInput.value = s.ghostHover;
  if (stripeColorInput) stripeColorInput.value = s.stripeColor;
  if (hoverColorInput) hoverColorInput.value = s.hoverColor;

  // 标题文字
  const titleTextInput = document.getElementById('titleTextInput');
  const titleColorInput = document.getElementById('titleColorInput');

  if (titleTextInput) titleTextInput.value = s.titleText;
  if (titleColorInput) titleColorInput.value = s.titleColor;

  // 场景列表
  renderSceneList(s.scenes || []);

  // 首次加载时也同步一次预览
  applyPreviewToDocument(s);

  // 实时预览（用户改颜色时，仅更新 CSS，不立即写 localStorage）
  bindLivePreviewInputs();
}

// =============== 3. 场景管理（增 / 删 / 改） ===============

function renderSceneList(scenes) {
  const list = document.getElementById('sceneList');
  if (!list) return;

  list.innerHTML = '';

  const arr = Array.isArray(scenes) ? scenes : [];
  settingsState.current.scenes = [...arr];

  if (!arr.length) {
    const li = document.createElement('li');
    li.className = 'scene-item empty';
    li.textContent = '暂无场景，请先新增。';
    list.appendChild(li);
    return;
  }

  arr.forEach((scene, index) => {
    const li = document.createElement('li');
    li.className = 'scene-item';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'scene-name';
    nameSpan.textContent = scene;

    // 点击名称：修改
    nameSpan.addEventListener('click', () => {
      const newName = prompt('修改场景名称：', scene);
      if (newName === null) return;
      const trimmed = newName.trim();
      if (!trimmed) return;

      // 去重
      if (
        settingsState.current.scenes.some(
          (s, i) => i !== index && s === trimmed
        )
      ) {
        alert('已存在同名场景');
        return;
      }

      settingsState.current.scenes[index] = trimmed;
      renderSceneList(settingsState.current.scenes);
    });

    const btnDelete = document.createElement('button');
    btnDelete.type = 'button';
    btnDelete.className = 'function-btn ghost text-xs btn-inline';
    btnDelete.textContent = '删除';
    btnDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(`确定删除场景「${scene}」？`)) return;
      settingsState.current.scenes.splice(index, 1);
      renderSceneList(settingsState.current.scenes);
    });

    li.appendChild(nameSpan);
    li.appendChild(btnDelete);
    list.appendChild(li);
  });
}

function bindSceneControls() {
  const input = document.getElementById('newSceneInput');
  const btnAdd = document.getElementById('btnAddScene');

  if (!input || !btnAdd) return;

  btnAdd.addEventListener('click', () => {
    const raw = input.value || '';
    const name = raw.trim();
    if (!name) return;

    if ((settingsState.current.scenes || []).includes(name)) {
      alert('已存在同名场景');
      return;
    }

    const scenes = settingsState.current.scenes || [];
    scenes.push(name);
    renderSceneList(scenes);
    input.value = '';
  });

  // 回车快速新增
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnAdd.click();
    }
  });
}

// =============== 4. 实时预览绑定 ===============

function bindLivePreviewInputs() {
  const brandColorInput = document.getElementById('brandColorInput');
  const brandHoverInput = document.getElementById('brandHoverInput');
  const ghostColorInput = document.getElementById('ghostColorInput');
  const ghostHoverInput = document.getElementById('ghostHoverInput');
  const stripeColorInput = document.getElementById('stripeColorInput');
  const hoverColorInput = document.getElementById('hoverColorInput');
  const titleTextInput = document.getElementById('titleTextInput');
  const titleColorInput = document.getElementById('titleColorInput');

  function updateFromInputs() {
    const s = settingsState.current;

    if (brandColorInput && brandColorInput.value) s.brandColor = brandColorInput.value;
    if (brandHoverInput && brandHoverInput.value) s.brandHover = brandHoverInput.value;
    if (ghostColorInput && ghostColorInput.value) s.ghostColor = ghostColorInput.value;
    if (ghostHoverInput && ghostHoverInput.value) s.ghostHover = ghostHoverInput.value;
    if (stripeColorInput && stripeColorInput.value) s.stripeColor = stripeColorInput.value;
    if (hoverColorInput && hoverColorInput.value) s.hoverColor = hoverColorInput.value;
    if (titleTextInput && titleTextInput.value) s.titleText = titleTextInput.value;
    if (titleColorInput && titleColorInput.value) s.titleColor = titleColorInput.value;

    applyPreviewToDocument(s);
  }

  const inputs = [
    brandColorInput,
    brandHoverInput,
    ghostColorInput,
    ghostHoverInput,
    stripeColorInput,
    hoverColorInput,
    titleTextInput,
    titleColorInput
  ].filter(Boolean);

  inputs.forEach((el) => {
    el.addEventListener('input', updateFromInputs);
    el.addEventListener('change', updateFromInputs);
  });
}

// =============== 5. 保存 / 重置按钮 ===============

function bindSaveAndResetButtons() {
  const btnSave = document.getElementById('btnSaveSettings');
  const btnReset = document.getElementById('btnResetSettings');

  if (btnSave) {
    btnSave.addEventListener('click', () => {
      // 把当前表单里的值同步到 state，然后写入 localStorage
      const brandColorInput = document.getElementById('brandColorInput');
      const brandHoverInput = document.getElementById('brandHoverInput');
      const ghostColorInput = document.getElementById('ghostColorInput');
      const ghostHoverInput = document.getElementById('ghostHoverInput');
      const stripeColorInput = document.getElementById('stripeColorInput');
      const hoverColorInput = document.getElementById('hoverColorInput');
      const titleTextInput = document.getElementById('titleTextInput');
      const titleColorInput = document.getElementById('titleColorInput');

      const next = { ...settingsState.current };

      if (brandColorInput && brandColorInput.value) next.brandColor = brandColorInput.value;
      if (brandHoverInput && brandHoverInput.value) next.brandHover = brandHoverInput.value;
      if (ghostColorInput && ghostColorInput.value) next.ghostColor = ghostColorInput.value;
      if (ghostHoverInput && ghostHoverInput.value) next.ghostHover = ghostHoverInput.value;
      if (stripeColorInput && stripeColorInput.value) next.stripeColor = stripeColorInput.value;
      if (hoverColorInput && hoverColorInput.value) next.hoverColor = hoverColorInput.value;
      if (titleTextInput && titleTextInput.value) next.titleText = titleTextInput.value;
      if (titleColorInput && titleColorInput.value) next.titleColor = titleColorInput.value;

      // scenes 已经在 settingsState.current.scenes 里维护，这里直接带上即可
      next.scenes = [...(settingsState.current.scenes || [])];

      saveDisplaySettings(next);
      showSettingsToast('显示设置已保存');
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (!confirm('确定恢复默认显示设置？')) return;

      settingsState.current = { ...DEFAULT_DISPLAY_SETTINGS };
      // 重置表单
      initSettingsForm();
      // 写入 localStorage & 通知其他页面
      saveDisplaySettings(settingsState.current);
      showSettingsToast('已恢复默认设置');
    });
  }
}

// =============== 6. Toast ===============

function showSettingsToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;

  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.background =
    type === 'error' ? 'rgba(220,38,38,0.92)' : 'rgba(17,24,39,0.92)';

  clearTimeout(settingsToastTimer);
  settingsToastTimer = setTimeout(() => {
    el.classList.add('hidden');
  }, 1800);
}

// =============== 7. 顶部导航按钮绑定（标题 / 文案 / 设置 / 管理中心） ===============

function bindTopNav() {
  const btnTitlePage = document.getElementById('btnTitlePage');
  const btnCopyPage = document.getElementById('btnCopyPage');
  const btnSettings = document.getElementById('btnSettings');
  const btnManagePage = document.getElementById('btnManagePage');

  if (btnTitlePage) {
    btnTitlePage.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  if (btnCopyPage) {
    btnCopyPage.addEventListener('click', () => {
      window.location.href = 'copy.html';
    });
  }

  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      window.location.href = 'settings.html';
    });
  }

  if (btnManagePage) {
    btnManagePage.addEventListener('click', () => {
      window.location.href = 'admin-center.html';
    });
  }
}

// =============== 8. 初始化入口 ===============

document.addEventListener('DOMContentLoaded', () => {
  console.log('[SettingsApp] DOMContentLoaded: init settings page');

  bindTopNav();
  initSettingsForm();
  bindSceneControls();
  bindSaveAndResetButtons();
});

// =============== 9. 暴露给全局（可选） ===============

window.SettingsApp = {
  loadDisplaySettings,
  saveDisplaySettings,
  applyPreviewToDocument
};
