// assets/app-title.js
// 标题管理主逻辑（桌面表格 + 手机卡片 + 云端快照）

console.log('[TitleApp] app-title.js loaded');

// =============== 0. 全局常量 & 状态 ===============

const supabase = window.supabaseClient || null;

const DEFAULT_CATEGORIES = ['全部', '亲子', '情侣', '闺蜜', '单人', '烟花', '夜景'];

// 获取带用户名的 localStorage key（每个账号单独存储）
function getCategoryLSKey() {
  const user = getCurrentUser();
  const username = user ? user.username : 'default';
  return `title_categories_v1_${username}`;
}

function getDisplaySettingsLSKey() {
  const user = getCurrentUser();
  const username = user ? user.username : 'default';
  return `display_settings_v1_${username}`;
}
const DEFAULT_DISPLAY_SETTINGS = {
  brandColor: '#1990ff',
  brandHover: '#1477dd',
  ghostColor: '#eef2ff',
  ghostHover: '#e2e8ff',
  stripeColor: '#E2F0FF',
  hoverColor: '#eef2ff',
  scenes: ['港迪城堡', '烟花', '夜景', '香港街拍'],
  titleText: '标题与文案管理系统',
  titleColor: '#1990ff'
};

const SNAPSHOT_TABLE = 'snapshots';
const SNAPSHOT_DEFAULT_KEY = 'default';

const state = {
  titles: [], // 当前所有标题记录（来自 Supabase.titles）
  categories: [...DEFAULT_CATEGORIES],
  currentCategory: '全部',
  renamingCategory: null, // 正在重命名的分类名称
  filters: {
    search: '',
    scene: ''
  },
  editingId: null, // 当前弹窗编辑的 id（null = 新增）
  viewSettings: {}, // 预留
  isSortingCategories: true // 分类是否处在"排序模式"（默认开启）
};

let toastTimer = null;

function dispatchDataChanged(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent('dataChanged', { detail }));
  } catch (e) {
    console.warn('[TitleApp] dispatchDataChanged failed', e);
  }
}

function getDisplaySettings() {
  const key = getDisplaySettingsLSKey();
  const raw = localStorage.getItem(key);
  
  // 根据用户获取默认场景
  const user = getCurrentUser();
  const defaultScenes = user && user.username === 'olina' 
    ? ['西瓜', '糖果', '米苏', '开心', '飞船', '女摄', '新号', '抖音']
    : DEFAULT_DISPLAY_SETTINGS.scenes;
  
  if (!raw) {
    return { 
      ...DEFAULT_DISPLAY_SETTINGS,
      scenes: defaultScenes
    };
  }
  try {
    const parsed = JSON.parse(raw);
    const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
    return {
      ...DEFAULT_DISPLAY_SETTINGS,
      ...parsed,
      scenes: scenes.length ? scenes : defaultScenes
    };
  } catch (e) {
    console.error('[TitleApp] 解析显示设置失败', e);
    return { 
      ...DEFAULT_DISPLAY_SETTINGS,
      scenes: defaultScenes
    };
  }
}

function applyDisplaySettings() {
  const settings = getDisplaySettings();
  const root = document.documentElement;
  root.style.setProperty('--brand-blue', settings.brandColor);
  root.style.setProperty('--brand-blue-hover', settings.brandHover);
  root.style.setProperty('--ghost-bg', settings.ghostColor);
  root.style.setProperty('--ghost-hover', settings.ghostHover);
  root.style.setProperty('--table-stripe', settings.stripeColor);
  root.style.setProperty('--list-hover', settings.hoverColor);
  root.style.setProperty('--topbar-title-color', settings.titleColor);

  const topbarTitle = document.querySelector('.topbar-title');
  if (topbarTitle) topbarTitle.removeAttribute('style');

  renderSceneFilterOptions(settings);
  // 同时刷新所有场景下拉菜单
  refreshSceneSelects();
}

function renderSceneFilterOptions(settings) {
  const filterScene = document.getElementById('filterScene');
  if (!filterScene) return;
  const prevValue = filterScene.value;
  filterScene.innerHTML = '<option value="">账号分类</option>';
  (settings.scenes || []).forEach((scene) => {
    const opt = document.createElement('option');
    opt.value = scene;
    // 统计该场景的标题数据条数
    const count = state.titles.filter((title) => {
      const sceneTags = Array.isArray(title.scene_tags) ? title.scene_tags : [];
      return sceneTags.includes(scene);
    }).length;
    // 账号名称置左，数据条数置右
    const sceneName = scene;
    const countText = `${count}条`;
    const maxWidth = 10;
    const spacesNeeded = Math.max(0, maxWidth - sceneName.length);
    const spaces = '\u00A0'.repeat(spacesNeeded);
    opt.textContent = `${sceneName}${spaces}${countText}`;
    filterScene.appendChild(opt);
  });

  if (settings.scenes.includes(prevValue)) {
    filterScene.value = prevValue;
  } else {
    filterScene.value = '';
    state.filters.scene = '';
  }
}

// =============== 1. 初始化入口 ===============

// 允许登录的用户列表（与 login.html 保持一致）
const ALLOWED_USERS = ['sevenoy', 'olina'];

function validateUser(user) {
  if (!user || !user.username) return false;
  return ALLOWED_USERS.includes(user.username);
}

document.addEventListener('DOMContentLoaded', () => {
  // 确保所有模态框和覆盖层在初始化时都是隐藏的
  const allModals = document.querySelectorAll('.modal-backdrop');
  allModals.forEach(modal => {
    if (!modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
    }
    // 确保样式也正确
    modal.style.display = 'none';
  });
  
  // 确保云端快照面板也是隐藏的
  const cloudPanel = document.getElementById('cloudHistoryPanel');
  if (cloudPanel) {
    cloudPanel.classList.add('hidden');
    cloudPanel.style.display = 'none';
  }

  const user = getCurrentUser();
  if (!user || !validateUser(user)) { 
    // 清除无效的用户信息
    try { localStorage.removeItem('current_user_v1'); } catch (_) {}
    window.location.href = 'login.html'; 
    return; 
  }
  console.log('[TitleApp] DOMContentLoaded: init');

  applyDisplaySettings();

  // 分类 - 从本地加载（暂时禁用自动云端同步以避免外键约束问题）
  // 用户可以通过手动点击"加载云端"按钮来同步数据
  loadCategoriesFromLocal();
  renderCategoryList();
  bindCategoryButtons();
  setupMobileCategoryDropdown();
  
  // 初始化场景下拉菜单
  refreshSceneSelects();

  // 工具栏 / 弹窗 / 云端 / 全局按钮
  try {
    bindToolbar();
    bindTitleModal();
    bindImportModal();
    bindRenameCategoryModal();
    bindCloudButtons();
    bindGlobalNavButtons();
  } catch (e) {
    console.error('[TitleApp] 初始化错误:', e);
    // 确保即使出错，模态框也是隐藏的
    const allModals = document.querySelectorAll('.modal-backdrop');
    allModals.forEach(modal => modal.classList.add('hidden'));
  }
  
  // 监听 localStorage 变化，当场景设置改变时自动更新
  window.addEventListener('storage', (e) => {
    const settingsKey = getDisplaySettingsLSKey();
    if (e.key === settingsKey) {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app-title.js:215',message:'storage event - settings changed',data:{key:e.key},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SYNC2'})}).catch(()=>{});
      // #endregion
      refreshSceneSelects();
    }
  });
  
  // 也监听同窗口内的设置变化（通过自定义事件）
  window.addEventListener('settingsUpdated', (detail) => {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app-title.js:223',message:'settingsUpdated event received',data:{detail:detail?detail.detail:null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SYNC2'})}).catch(()=>{});
    // #endregion
    refreshSceneSelects();
    // 如果是分类更新，也刷新分类列表
    if (detail && detail.detail && detail.detail.scope === 'categories') {
      loadCategoriesFromLocal();
      renderCategoryList();
    }
  });

  // 加载数据
  try {
    loadTitlesFromCloud();
  } catch (e) {
    console.error('[TitleApp] 加载数据错误:', e);
  }

  const badge = document.getElementById('currentUserName');
  if (badge) {
    // 显示用户名首字母，节省空间
    badge.textContent = getUserInitial(user.username);
    badge.className = 'user-badge text-xs';
    badge.title = user.username || ''; // 完整用户名显示在tooltip中
  }
  const btnLogout = document.getElementById('btnLogout');
  const btnLoginHeader = document.getElementById('btnLoginHeader');
  if (btnLogout) btnLogout.onclick = () => { try { localStorage.removeItem('current_user_v1'); } catch (_) {} window.location.href = 'login.html'; };
  if (btnLoginHeader) btnLoginHeader.onclick = () => { window.location.href = 'login.html'; };
  if (btnLogout) btnLogout.classList.remove('hidden');
  if (btnLoginHeader) btnLoginHeader.classList.add('hidden');

  if (!supabase) {
    console.warn('[TitleApp] supabaseClient 不存在，云端功能不可用');
  } else {
    console.log('[TitleApp] supabaseClient 已就绪');
  }

  // 云端加载完成时刷新分类与场景
  window.addEventListener('cloudSyncLoaded', () => {
    loadCategoriesFromLocal();
    renderCategoryList();
    applyDisplaySettings();
    refreshSceneSelects();
  });

  // 初始从云端加载一遍 titles
  loadTitlesFromCloud();
  initAutoSync();
});

function getCurrentUser() {
  try { const raw = localStorage.getItem('current_user_v1'); return raw ? JSON.parse(raw) : null; } catch (_) { return null; }
}

// 获取用户名简写
function getUserInitial(username) {
  if (!username) return '';
  const userInitials = {
    'sevenoy': 'S',
    'olina': 'O'
  };
  return userInitials[username.toLowerCase()] || username.charAt(0).toUpperCase();
}

function userTag(u) { return `user:${u}`; }

function stripLeadingIndex(s) {
  return (s || '').replace(/^\s*\d+(?:\.\d+)*(?:[\.)、．])?\s*/, '');
}

// =============== 2. 分类逻辑 ===============

function loadCategoriesFromLocal() {
  const key = getCategoryLSKey();
  const raw = localStorage.getItem(key);
  if (!raw) {
    state.categories = [...DEFAULT_CATEGORIES];
    return;
  }
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) {
      state.categories = [...DEFAULT_CATEGORIES];
    } else {
      const set = new Set(arr);
      set.delete('全部');
      state.categories = ['全部', ...set];
    }
  } catch (e) {
    console.error('[TitleApp] loadCategoriesFromLocal error', e);
    state.categories = [...DEFAULT_CATEGORIES];
  }
}

function saveCategoriesToLocal() {
  const key = getCategoryLSKey();
  localStorage.setItem(key, JSON.stringify(state.categories));
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app-title.js:324',message:'saveCategoriesToLocal',data:{categories:state.categories,categoriesCount:state.categories.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SYNC1'})}).catch(()=>{});
  // #endregion
  dispatchDataChanged({ scope: 'categories', target: 'title' });
  // 触发settingsUpdated事件，让同页面内的其他组件知道分类已更新
  window.dispatchEvent(new CustomEvent('settingsUpdated', { detail: { scope: 'categories' } }));
}

function renderCategoryList() {
  const list = document.getElementById('categoryList');
  if (!list) return;

  list.innerHTML = '';

  state.categories.forEach((cat, index) => {
    const li = document.createElement('li');
    li.className =
      'category-item' + (cat === state.currentCategory ? ' active' : '');
    li.dataset.cat = cat;

    // 左侧：分类名（排序模式下可编辑）
    const nameSpan = document.createElement('span');
    nameSpan.className = 'category-name';
    
    nameSpan.textContent = cat;

    // 右侧：数量 + （可选的排序按钮）
    const rightSpan = document.createElement('span');
    rightSpan.className = 'category-right';

    let count = 0;
    if (cat === '全部') {
      count = state.titles.length;
    } else {
      count = state.titles.filter((t) => t.main_category === cat).length;
    }
    const countSpan = document.createElement('span');
    countSpan.className = 'category-count';
    countSpan.textContent = `${count}条`;
    rightSpan.appendChild(countSpan);

    // 排序模式：给非“全部”增加 ↑↓ 按钮
    if (state.isSortingCategories && cat !== '全部') {
      const controls = document.createElement('span');
      controls.className = 'category-sort-controls';

      const btnUp = document.createElement('button');
      btnUp.type = 'button';
      btnUp.innerHTML = '▲';
      btnUp.className = 'function-btn ghost text-xs btn-inline';
      btnUp.style.marginLeft = '4px';
      btnUp.addEventListener('click', (e) => {
        e.stopPropagation();
        reorderCategory(index, -1);
      });

      const btnDown = document.createElement('button');
      btnDown.type = 'button';
      btnDown.innerHTML = '▼';
      btnDown.className = 'function-btn ghost text-xs btn-inline';
      btnDown.style.marginLeft = '4px';
      btnDown.addEventListener('click', (e) => {
        e.stopPropagation();
        reorderCategory(index, 1);
      });

      const btnRename = document.createElement('button');
      btnRename.type = 'button';
      btnRename.textContent = '改';
      btnRename.className = 'function-btn ghost text-xs btn-inline';
      btnRename.style.marginLeft = '4px';
      btnRename.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log('[TitleApp] 点击改按钮，分类名称：', cat);
        openRenameCategoryModal(cat);
      });

      controls.appendChild(btnUp);
      controls.appendChild(btnDown);
      controls.appendChild(btnRename);
      rightSpan.appendChild(controls);
    }

    // 普通点击：切换当前分类
    // 排序模式下：只有点击分类名称时才切换，点击其他区域不切换（避免误触按钮）
    // 非排序模式下：点击整个列表项都可以切换
    li.addEventListener('click', (e) => {
      // 如果点击的是按钮，不处理
      if (e.target.closest('button')) return;
      
      // 排序模式下：只有点击分类名称时才允许切换
      if (state.isSortingCategories) {
        // 如果点击的是分类名称，允许切换
        if (e.target.classList.contains('category-name') || e.target === nameSpan) {
          state.currentCategory = cat;
          renderCategoryList();
          renderTitles();
          const panel = document.getElementById('cloudHistoryPanel');
          if (panel) {
            panel.classList.add('hidden');
            panel.style.display = 'none';
          }
          const wrapper = document.getElementById('mobileCategoryWrapper');
          const dl = document.getElementById('categoryList');
          if (wrapper && dl) {
            wrapper.setAttribute('data-open', '0');
            if (window.innerWidth < 768) dl.style.display = 'none';
          }
        }
        return;
      }
      
      // 非排序模式下：正常切换
      state.currentCategory = cat;
      renderCategoryList();
      renderTitles();
      const panel = document.getElementById('cloudHistoryPanel');
      if (panel) {
        panel.classList.add('hidden');
        panel.style.display = 'none';
      }
      const wrapper = document.getElementById('mobileCategoryWrapper');
      const dl = document.getElementById('categoryList');
      if (wrapper && dl) {
        wrapper.setAttribute('data-open', '0');
        if (window.innerWidth < 768) dl.style.display = 'none';
      }
    });

    li.appendChild(nameSpan);
    li.appendChild(rightSpan);
    list.appendChild(li);
  });

  updateMobileCategoryLabel();
}

// index 当前下标，delta = -1 上移 / +1 下移
function reorderCategory(index, delta) {
  const newIndex = index + delta;

  // 0 是“全部”，不能动；其它从 1 开始
  if (index <= 0) return;
  if (newIndex <= 0) return;
  if (newIndex >= state.categories.length) return;

  const arr = [...state.categories];
  const item = arr[index];
  arr.splice(index, 1);
  arr.splice(newIndex, 0, item);
  state.categories = arr;

  saveCategoriesToLocal();
  renderCategoryList();
}

// 修改分类名称 - 打开模态框
function openRenameCategoryModal(oldName) {
  if (!oldName || oldName === '全部') {
    showToast('不能修改"全部"分类', 'error');
    return;
  }
  
  const modal = document.getElementById('renameCategoryModal');
  const input = document.getElementById('renameCategoryInput');
  if (!modal || !input) return;
  
  input.value = oldName;
  state.renamingCategory = oldName;
  modal.classList.remove('hidden');
  // 确保移除hidden类后，样式正确应用
  modal.style.display = '';
  modal.style.visibility = '';
  modal.style.opacity = '';
  modal.style.pointerEvents = '';
  modal.style.zIndex = '';
  input.focus();
  input.select();
}

// 关闭修改分类名称模态框
function closeRenameCategoryModal() {
  const modal = document.getElementById('renameCategoryModal');
  const input = document.getElementById('renameCategoryInput');
  if (modal) modal.classList.add('hidden');
  if (input) input.value = '';
  state.renamingCategory = null;
}

// 修改分类名称 - 执行修改
async function renameCategory() {
  const oldName = state.renamingCategory;
  const input = document.getElementById('renameCategoryInput');
  
  if (!oldName || !input) return;
  
  const newName = input.value.trim();
  
  if (!newName || newName === oldName) {
    closeRenameCategoryModal();
    return;
  }
  
  if (newName === '全部') {
    showToast('不能使用"全部"作为分类名称', 'error');
    return;
  }
  
  // 检查新名称是否已存在
  if (state.categories.includes(newName)) {
    showToast('分类名称已存在', 'error');
    return;
  }
  
  // 更新 state.categories
  const catIndex = state.categories.indexOf(oldName);
  if (catIndex === -1) {
    closeRenameCategoryModal();
    return;
  }
  
  state.categories[catIndex] = newName;
  
  // 更新 localStorage
  saveCategoriesToLocal();
  
  // 如果当前分类是被修改的分类，也要更新
  if (state.currentCategory === oldName) {
    state.currentCategory = newName;
  }
  
  // 更新数据库中的所有相关记录
  if (supabase) {
    try {
      const { error } = await supabase
        .from('titles')
        .update({ main_category: newName })
        .eq('main_category', oldName);
      
      if (error) throw error;
      
      // 更新本地 state.titles
      state.titles.forEach((title) => {
        if (title.main_category === oldName) {
          title.main_category = newName;
        }
      });
      
      showToast('分类名称已更新');
    } catch (e) {
      console.error('[TitleApp] 更新分类名称失败', e);
      showToast('更新分类名称失败：' + (e.message || ''), 'error');
      // 回滚
      state.categories[catIndex] = oldName;
      saveCategoriesToLocal();
      if (state.currentCategory === newName) {
        state.currentCategory = oldName;
      }
      closeRenameCategoryModal();
      return;
    }
  }
  
  closeRenameCategoryModal();
  
  // 重新渲染
  renderCategoryList();
  renderTitles();
}

// 绑定修改分类名称模态框
function bindRenameCategoryModal() {
  const modal = document.getElementById('renameCategoryModal');
  const btnClose = document.getElementById('btnCloseRenameCategory');
  const btnCancel = document.getElementById('btnCancelRenameCategory');
  const btnConfirm = document.getElementById('btnConfirmRenameCategory');
  const input = document.getElementById('renameCategoryInput');
  
  if (btnClose) btnClose.addEventListener('click', closeRenameCategoryModal);
  if (btnCancel) btnCancel.addEventListener('click', closeRenameCategoryModal);
  if (btnConfirm) btnConfirm.addEventListener('click', renameCategory);
  
  // 点击背景关闭
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeRenameCategoryModal();
      }
    });
  }
  
  // 按 Enter 键确认
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        renameCategory();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeRenameCategoryModal();
      }
    });
  }
}

// =============== 2.5 手机端分类下拉 ===============

function setupMobileCategoryDropdown() {
  const wrapper = document.getElementById('mobileCategoryWrapper');
  const toggleBtn = document.getElementById('mobileCategoryToggle');
  const list = document.getElementById('categoryList');

  if (!wrapper || !toggleBtn || !list) return;

  function isMobile() {
    return window.innerWidth < 768;
  }

  function applyVisibility() {
    if (isMobile()) {
      wrapper.style.display = 'block';
      const isOpen = wrapper.getAttribute('data-open') === '1';
      list.style.display = isOpen ? 'block' : 'none';
    } else {
      wrapper.style.display = 'none';
      list.style.display = 'block';
    }
  }

  toggleBtn.addEventListener('click', () => {
    const isOpen = wrapper.getAttribute('data-open') === '1';
    wrapper.setAttribute('data-open', isOpen ? '0' : '1');
    applyVisibility();
  });

  window.addEventListener('resize', applyVisibility);
  applyVisibility();
}

function updateMobileCategoryLabel() {
  const labelEl = document.getElementById('mobileCategoryLabel');
  if (!labelEl) return;
  labelEl.textContent = state.currentCategory || '全部';
}

// =============== 3. 工具栏：搜索 / 场景筛选 / 按钮 ===============

function bindToolbar() {
  const searchInput = document.getElementById('searchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const filterScene = document.getElementById('filterScene');

  const btnNewTitle = document.getElementById('btnNewTitle');
  const btnBatchImport = document.getElementById('btnBatchImport');
  const btnClearAll = document.getElementById('btnClearAll');

  // 🔍 搜索 + 清除按钮
  if (searchInput) {
    const syncClearBtn = () => {
      if (!btnClearSearch) return;
      btnClearSearch.style.display = searchInput.value ? 'flex' : 'none';
    };

    searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value.trim();
      renderTitles();
      syncClearBtn();
    });

    syncClearBtn();

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        state.filters.search = '';
        renderTitles();
        syncClearBtn();
      });
    }
  }

  if (filterScene) {
    filterScene.addEventListener('change', (e) => {
      state.filters.scene = e.target.value;
      renderTitles();
    });
  }

  if (btnNewTitle) {
    btnNewTitle.addEventListener('click', () => {
      console.log('[TitleApp] 点击 新增标题');
      openTitleModal();
    });
  }

  if (btnBatchImport) {
    btnBatchImport.addEventListener('click', () => {
      console.log('[TitleApp] 点击 批量导入');
      openImportModal();
    });
  }

  if (btnClearAll) {
    btnClearAll.addEventListener('click', openClearConfirmModal);
  }
}

// =============== 4. 加载 & 过滤 & 渲染列表 ===============

async function loadTitlesFromCloud() {
  if (!supabase) {
    console.warn('[TitleApp] supabaseClient 不存在，跳过云端加载');
    return;
  }
  try {
    const { data, error } = await supabase
      .from('titles')
      .select('*')
      // 改为按 created_at 倒序：最新在最上
      .order('created_at', { ascending: false });

    if (error) throw error;
    const user = getCurrentUser();
    const tag = user ? userTag(user.username) : null;
    const filtered = tag
      ? (data || []).filter((it) => Array.isArray(it.scene_tags) && it.scene_tags.includes(tag))
      : (data || []);
    state.titles = filtered;
    console.log('[TitleApp] 从云端加载标题条数：', state.titles.length);
    // 云端数据变化后，需要同步刷新分类数量
    renderCategoryList();
    renderTitles();
    // 刷新场景下拉列表，更新数据条数
    refreshSceneSelects();
  } catch (e) {
    console.error('[TitleApp] loadTitlesFromCloud error', e);
    showToast('加载标题失败', 'error');
  }
}

function applyFilters(list) {
  const cat = state.currentCategory;
  const q = state.filters.search.toLowerCase();
  const scene = state.filters.scene;

  const filtered = list.filter((item) => {
    if (cat !== '全部' && item.main_category !== cat) return false;

    if (q && !(item.text || '').toLowerCase().includes(q)) return false;

    if (scene) {
      const tags = Array.isArray(item.scene_tags) ? item.scene_tags : [];
      if (!tags.includes(scene)) return false;
    }

    return true;
  });
  
  // 排序：星标数据永远置顶，按星标时间倒序，然后按创建时间倒序
  const sorted = filtered.sort((a, b) => {
    const aStarred = a.is_starred === true;
    const bStarred = b.is_starred === true;
    
    // 如果都是星标，按星标时间倒序（最新星标的在最前）
    if (aStarred && bStarred) {
      const aTime = a.starred_at ? new Date(a.starred_at).getTime() : 0;
      const bTime = b.starred_at ? new Date(b.starred_at).getTime() : 0;
      return bTime - aTime;
    }
    
    // 如果只有一个是星标，星标的永远在前
    if (aStarred && !bStarred) return -1;
    if (!aStarred && bStarred) return 1;
    
    // 都不是星标，按创建时间倒序
    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bCreated - aCreated;
  });
  
  return sorted;
}

function renderTitles() {
  const tbody = document.getElementById('titleTableBody');
  const mobileList = document.getElementById('mobileList');
  if (!tbody || !mobileList) return;

  tbody.innerHTML = '';
  mobileList.innerHTML = '';

  const list = applyFilters(state.titles);

  list.forEach((item, index) => {
    // ---------- 桌面端行 ----------
    const tr = document.createElement('tr');

    const tdIndex = document.createElement('td');
    // 如果被星标，在序号位置显示星标+数字
    if (item.is_starred === true) {
      const starIndex = document.createElement('span');
      starIndex.className = 'star-index';
      starIndex.innerHTML = `<span class="item-star-icon">⭐</span><span class="star-index-number">${index + 1}</span>`;
      tdIndex.appendChild(starIndex);
    } else {
      tdIndex.textContent = index + 1;
    }
    tr.appendChild(tdIndex);

    const tdText = document.createElement('td');
    tdText.textContent = item.text || '';
    tr.appendChild(tdText);

    const tdCat = document.createElement('td');
    tdCat.textContent = item.main_category || '';
    tr.appendChild(tdCat);

    // ⚠️ 不再显示 usage_count 列
    const tdActions = document.createElement('td');
    tdActions.className = 'actions-cell';

    const group = document.createElement('div');
    group.className = 'action-group';

    const btnCopy = document.createElement('button');
    btnCopy.className = 'function-btn text-xs btn-inline btn-rect';
    btnCopy.textContent = '复制';
    btnCopy.addEventListener('click', () => copyTitle(item));

    const btnEdit = document.createElement('button');
    btnEdit.className = 'function-btn ghost text-xs btn-inline btn-rect';
    btnEdit.textContent = '修改';
    btnEdit.addEventListener('click', () => openTitleModal(item));

    const btnDel = document.createElement('button');
    btnDel.className = 'function-btn ghost text-xs btn-inline btn-rect';
    btnDel.textContent = '删除';
    btnDel.addEventListener('click', () => openDeleteTitleModal(item));

    group.append(btnCopy, btnEdit, btnDel);
    tdActions.appendChild(group);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);

    // ---------- 移动端卡片 ----------
    const card = document.createElement('div');
    card.className = 'panel mobile-card';

    const headerRow = document.createElement('div');
    headerRow.className = 'flex items-start justify-between gap-2';

    const cTitle = document.createElement('div');
    cTitle.className = 'text-sm font-medium flex-1 min-w-0 line-clamp-2 break-anywhere';
    {
      const full = (item.text || '').trim();
      const lines = full.split(/\r?\n/).filter(Boolean);
      let preview = '';
      if (lines.length >= 2) {
        preview = `${lines[0]} ${lines[1]}`;
      } else {
        preview = full;
      }
      const truncated = lines.length > 2 || (full.length > preview.length);
      if (truncated) preview = `${preview} …▼`;
      cTitle.textContent = preview;
    }

    const leftWrap = document.createElement('div');
    leftWrap.className = 'flex items-center gap-2 flex-1 min-w-0';
    const idxBadge = document.createElement('span');
    idxBadge.className = 'pill-muted';
    // 如果被星标，在序号位置显示星标+数字
    if (item.is_starred === true) {
      const starIndex = document.createElement('span');
      starIndex.className = 'star-index-mobile';
      starIndex.innerHTML = `<span class="item-star-icon">⭐</span><span class="star-index-number">${index + 1}</span>`;
      idxBadge.appendChild(starIndex);
    } else {
      idxBadge.textContent = String(index + 1);
    }
    if (((index + 1) % 2) === 0) {
      idxBadge.classList.add('alt');
    }
    leftWrap.append(idxBadge, cTitle);

    const actions = document.createElement('div');
    actions.className = 'flex gap-2 flex-shrink-0';

    const mCopy = document.createElement('button');
    mCopy.className = 'function-btn text-xs btn-inline';
    mCopy.textContent = '复制';
    mCopy.addEventListener('click', () => copyTitle(item));

    const mEdit = document.createElement('button');
    mEdit.className = 'function-btn ghost text-xs btn-inline';
    mEdit.textContent = '修改';
    mEdit.addEventListener('click', () => openTitleModal(item));

    const mDel = document.createElement('button');
    mDel.className = 'function-btn ghost text-xs btn-inline';
    mDel.textContent = '删除';
    mDel.addEventListener('click', () => openDeleteTitleModal(item));

    actions.append(mCopy, mEdit, mDel);
    headerRow.append(leftWrap, actions);

    card.append(headerRow);
    mobileList.appendChild(card);
  });

  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-xs text-gray-500 py-2';
    empty.textContent = '暂无标题，请先新增。';
    mobileList.appendChild(empty);
  }
}

// =============== 5. 标题操作：复制 / 删除 ===============

async function copyTitle(item) {
  // 1. 先复制到剪贴板
  try {
    await navigator.clipboard.writeText(item.text || '');
    showToast('已复制');
  } catch (e) {
    console.error('[TitleApp] 复制失败', e);
    showToast('复制失败', 'error');
  }

  // 2. 没有云端或没有 id，就不记 usage_count 了
  if (!supabase || !item.id) return;

  // 3. 只更新这一条记录的 usage_count，本地顺序不动
  try {
    const newCount = (item.usage_count || 0) + 1;

    await supabase
      .from('titles')
      .update({ usage_count: newCount })
      .eq('id', item.id);

    // 本地 state.titles 也同步一下 usage_count，但不重新排序
    const idx = state.titles.findIndex((t) => t.id === item.id);
    if (idx !== -1) {
      state.titles[idx] = {
        ...state.titles[idx],
        usage_count: newCount
      };
    }
    dispatchDataChanged({ scope: 'titles', target: 'title', action: 'usage_increment' });
  } catch (e) {
    console.error('[TitleApp] 更新 usage_count 失败', e);
  }
}

async function deleteTitle(item) {
  state.titles = state.titles.filter((t) => t.id !== item.id);
  renderTitles();
  // 刷新场景下拉列表，更新数据条数
  refreshSceneSelects();
  dispatchDataChanged('titles');

  if (!supabase || !item.id) return;

  try {
    await supabase.from('titles').delete().eq('id', item.id);
    showToast('已删除');
  } catch (e) {
    console.error('[TitleApp] 删除失败', e);
    showToast('删除失败（云端）', 'error');
  }
  dispatchDataChanged({ scope: 'titles', target: 'title', action: 'delete' });
}

let pendingDeleteTitle = null;
function openDeleteTitleModal(item) {
  const modal = document.getElementById('deleteTitleModal');
  const btnClose = document.getElementById('btnCloseDeleteTitle');
  const btnCancel = document.getElementById('btnCancelDeleteTitle');
  const btnConfirm = document.getElementById('btnConfirmDeleteTitle');
  const previewEl = document.getElementById('deleteTitlePreview');
  if (!modal || !btnClose || !btnCancel || !btnConfirm) return;
  pendingDeleteTitle = item;
  if (previewEl) previewEl.textContent = (item.text || '').slice(0, 40);
  modal.classList.remove('hidden');
  // 确保移除hidden类后，样式正确应用
  modal.style.display = '';
  modal.style.visibility = '';
  modal.style.opacity = '';
  modal.style.pointerEvents = '';
  modal.style.zIndex = '';
  const close = () => { modal.classList.add('hidden'); pendingDeleteTitle = null; };
  btnClose.onclick = close;
  btnCancel.onclick = close;
  btnConfirm.onclick = () => {
    if (pendingDeleteTitle) deleteTitle(pendingDeleteTitle);
    close();
  };
}

let pendingSnapshotKeyTitle = null;
function openCloudLoadConfirmTitle(key) {
  const modal = document.getElementById('cloudLoadConfirmModalTitle');
  const btnClose = document.getElementById('btnCloseCloudLoadConfirmTitle');
  const btnCancel = document.getElementById('btnCancelCloudLoadTitle');
  const btnConfirm = document.getElementById('btnConfirmCloudLoadTitle');
  if (!modal || !btnClose || !btnCancel || !btnConfirm) { return; }
  pendingSnapshotKeyTitle = key;
  modal.classList.remove('hidden');
  // 确保移除hidden类后，样式正确应用
  modal.style.display = '';
  modal.style.visibility = '';
  modal.style.opacity = '';
  modal.style.pointerEvents = '';
  modal.style.zIndex = '';
  const panel = document.getElementById('cloudHistoryPanel');
  if (panel) { panel.classList.add('hidden'); panel.style.display = 'none'; }
  const close = () => { modal.classList.add('hidden'); pendingSnapshotKeyTitle = null; };
  btnClose.onclick = close;
  btnCancel.onclick = close;
  btnConfirm.onclick = async () => {
    if (pendingSnapshotKeyTitle) {
      try {
        const info = await window.snapshotService.loadUnifiedSnapshot(pendingSnapshotKeyTitle, 'both');
        // 重新加载分类（从 localStorage 恢复）
        loadCategoriesFromLocal();
        renderCategoryList();
        // 重新应用显示设置（包括场景设置/账号分类）
        applyDisplaySettings();
        await loadTitlesFromCloud();
        // loadTitlesFromCloud 内部已经会调用 refreshSceneSelects，这里不需要重复调用
        showToast(`已加载：标题 ${info.titleCount} 条 文案 ${info.contentCount} 条 ${info.updatedText}`);
      } catch (e) {
        console.error('[TitleApp] 加载快照失败:', e);
        alert('加载快照失败：' + (e.message || 'Unknown error'));
      }
    }
    close();
  };
}

// =============== 6. 标题弹窗 ===============

function bindTitleModal() {
  const btnClose = document.getElementById('btnCloseModal');
  const btnCancel = document.getElementById('btnCancelModal');
  const btnSave = document.getElementById('btnSaveTitle');

  if (btnClose) btnClose.addEventListener('click', closeTitleModal);
  if (btnCancel) btnCancel.addEventListener('click', closeTitleModal);
  if (btnSave) btnSave.addEventListener('click', saveTitleFromModal);
}

function openTitleModal(item) {
  const modal = document.getElementById('titleModal');
  if (!modal) return;

  const titleEl = document.getElementById('titleModalTitle');
  const textEl = document.getElementById('fieldText');
  const mainCatEl = document.getElementById('fieldMainCategory');
  const typeEl = document.getElementById('fieldContentType');
  const sceneEl = document.getElementById('fieldSceneTags');
  const btnStar = document.getElementById('btnStarTitle');

  // 初始化弹窗下拉分类选项
  refreshModalCategoryOptions(mainCatEl);
  // 刷新场景下拉菜单
  refreshSceneSelects();

  if (item && item.id) {
    state.editingId = item.id;
    if (titleEl) titleEl.textContent = '修改标题';
    if (textEl) textEl.value = item.text || '';
    if (mainCatEl) mainCatEl.value = item.main_category || '';
    
    // 从 scene_tags 中提取账号分类（场景管理中的值）
    const settings = getDisplaySettings();
    const scenes = settings.scenes || [];
    const sceneTags = Array.isArray(item.scene_tags) ? item.scene_tags : [];
    const accountCategory = sceneTags.find(tag => scenes.includes(tag));
    if (typeEl) typeEl.value = accountCategory || item.content_type || '';
    
    // 场景标签（排除账号分类和用户标签）
    const userTagValue = userTag(getCurrentUser().username);
    const sceneTagsOnly = sceneTags.filter(tag => 
      !scenes.includes(tag) && tag !== userTagValue
    );
    if (sceneEl) sceneEl.value = sceneTagsOnly.join(', ');
    
    // 设置星标按钮状态
    if (btnStar) {
      const isStarred = item.is_starred === true;
      btnStar.classList.toggle('active', isStarred);
    }
  } else {
    state.editingId = null;
    if (titleEl) titleEl.textContent = '新增标题';
    if (textEl) textEl.value = '';
    if (mainCatEl)
      mainCatEl.value = state.currentCategory === '全部' ? '' : state.currentCategory;
    if (typeEl) typeEl.value = '';
    if (sceneEl) sceneEl.value = '';
    
    // 新增时星标按钮默认不激活
    if (btnStar) {
      btnStar.classList.remove('active');
    }
  }
  
  // 绑定星标按钮点击事件
  if (btnStar) {
    btnStar.onclick = () => {
      btnStar.classList.toggle('active');
    };
  }

  modal.classList.remove('hidden');
  // 确保移除hidden类后，样式正确应用
  modal.style.display = '';
  modal.style.visibility = '';
  modal.style.opacity = '';
  modal.style.pointerEvents = '';
  modal.style.zIndex = '';
}

function closeTitleModal() {
  const modal = document.getElementById('titleModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function refreshModalCategoryOptions(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = '';

  const cats = state.categories.filter((c) => c !== '全部');
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = '请选择';
  selectEl.appendChild(emptyOpt);

  cats.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    selectEl.appendChild(opt);
  });
}

// 刷新场景下拉菜单（从场景管理设置获取）
function refreshSceneSelects() {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app-title.js:1173',message:'refreshSceneSelects ENTRY',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SYNC3'})}).catch(()=>{});
  // #endregion
  const settings = getDisplaySettings();
  const scenes = settings.scenes || [];
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app-title.js:1179',message:'refreshSceneSelects scenes loaded',data:{scenes:scenes,scenesCount:scenes.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SYNC3'})}).catch(()=>{});
  // #endregion
  
  // 更新 filterScene（场景筛选）
  const filterScene = document.getElementById('filterScene');
  if (filterScene) {
    const prevValue = filterScene.value;
    filterScene.innerHTML = '<option value="">账号分类</option>';
    scenes.forEach((scene) => {
      const opt = document.createElement('option');
      opt.value = scene;
      // 统计该场景的标题数据条数
      const count = state.titles.filter((title) => {
        const sceneTags = Array.isArray(title.scene_tags) ? title.scene_tags : [];
        return sceneTags.includes(scene);
      }).length;
      // 账号名称置左，数据条数置右（使用HTML实体空格实现对齐）
      const sceneName = scene;
      const countText = `${count}条`;
      // 使用HTML实体空格（&nbsp;）和固定宽度实现对齐
      // 计算需要的空格数（假设最大宽度为10个字符）
      const maxWidth = 10;
      const spacesNeeded = Math.max(0, maxWidth - sceneName.length);
      const spaces = '\u00A0'.repeat(spacesNeeded);
      opt.textContent = `${sceneName}${spaces}${countText}`;
      filterScene.appendChild(opt);
    });
    // 如果之前选中的值仍然存在，保持选中
    if (scenes.includes(prevValue)) {
      filterScene.value = prevValue;
    } else {
      filterScene.value = '';
      state.filters.scene = '';
    }
  }
  
  // 更新 fieldContentType（新增标题模态框中的账号分类）
  const fieldContentType = document.getElementById('fieldContentType');
  if (fieldContentType) {
    const prevValue = fieldContentType.value;
    fieldContentType.innerHTML = '<option value="">账号分类</option>';
    scenes.forEach((scene) => {
      const opt = document.createElement('option');
      opt.value = scene;
      opt.textContent = scene;
      fieldContentType.appendChild(opt);
    });
    // 如果之前选中的值仍然存在，保持选中
    if (scenes.includes(prevValue)) {
      fieldContentType.value = prevValue;
    } else {
      fieldContentType.value = '';
    }
  }
  
  // 更新 importAccountCategorySelect（批量导入模态框中的账号分类）
  const importAccountCategorySelect = document.getElementById('importAccountCategorySelect');
  if (importAccountCategorySelect) {
    const prevValue = importAccountCategorySelect.value;
    importAccountCategorySelect.innerHTML = '<option value="">账号分类</option>';
    scenes.forEach((scene) => {
      const opt = document.createElement('option');
      opt.value = scene;
      opt.textContent = scene;
      importAccountCategorySelect.appendChild(opt);
    });
    // 如果之前选中的值仍然存在，保持选中
    if (scenes.includes(prevValue)) {
      importAccountCategorySelect.value = prevValue;
    } else {
      importAccountCategorySelect.value = '';
    }
  }
}

async function saveTitleFromModal() {
  const fieldText = document.getElementById('fieldText');
  const fieldCat = document.getElementById('fieldMainCategory');
  const fieldType = document.getElementById('fieldContentType');
  const fieldScene = document.getElementById('fieldSceneTags');

  if (!fieldText || !fieldCat || !fieldType || !fieldScene) return;

  const text = fieldText.value.trim();
  const cat = fieldCat.value || null;
  const type = fieldType.value || null;
  const sceneRaw = fieldScene.value.trim();

  if (!text) {
    showToast('标题不能为空', 'error');
    return;
  }

  // 场景标签拆分
  const sceneTags = sceneRaw
    ? sceneRaw
        .split(/[，,、]/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // 账号分类（fieldContentType）应该添加到 scene_tags 中
  const allSceneTags = [...(sceneTags || [])];
  if (type) {
    allSceneTags.push(type);
  }
  allSceneTags.push(userTag(getCurrentUser().username));

  // 获取星标状态
  const btnStar = document.getElementById('btnStarTitle');
  const isStarred = btnStar && btnStar.classList.contains('active');
  
  // 如果是编辑已有标题，需要判断星标状态是否改变
  let starredAt = null;
  if (state.editingId) {
    const existingItem = state.titles.find(t => t.id === state.editingId);
    if (isStarred) {
      // 如果新设为星标，使用当前时间；如果已经是星标，保持原时间
      starredAt = existingItem && existingItem.is_starred ? existingItem.starred_at : new Date().toISOString();
    } else {
      // 取消星标，设为null
      starredAt = null;
    }
  } else {
    // 新增标题
    starredAt = isStarred ? new Date().toISOString() : null;
  }
  
  const payload = {
    text,
    main_category: cat,
    content_type: type,
    scene_tags: Array.from(new Set(allSceneTags)),
    is_starred: isStarred || false,
    starred_at: starredAt
  };

  console.log(
    '[TitleApp] 保存标题 payload =',
    payload,
    'editingId =',
    state.editingId,
    '账号分类 =',
    type,
    'scene_tags =',
    payload.scene_tags
  );

  if (!supabase) {
    showToast('未配置 Supabase，无法保存到云端', 'error');
    return;
  }

  // 记录当前所在的分类，用来保持筛选不变（包括“全部”）
  const prevCategory = state.currentCategory;

  try {
    if (state.editingId) {
      // ====== 情况一：编辑已有标题 ======
      
      // 尝试保存，如果字段不存在则移除星标字段重试
      let updatePayload = payload;
      let { error } = await supabase
        .from('titles')
        .update(updatePayload)
        .eq('id', state.editingId);

      // 如果错误是因为字段不存在，移除星标字段重试
      if (error && (error.message.includes('is_starred') || error.message.includes('starred_at'))) {
        console.warn('[TitleApp] 数据库表缺少星标字段，移除星标数据后重试');
        const { is_starred, starred_at, ...payloadWithoutStar } = payload;
        updatePayload = payloadWithoutStar;
        const retryResult = await supabase
          .from('titles')
          .update(updatePayload)
          .eq('id', state.editingId);
        error = retryResult.error;
        if (error) throw error;
      } else if (error) {
        throw error;
      }

      // 本地 state.titles 里就地更新，不改变原来的 index 顺序
      const idx = state.titles.findIndex((t) => t.id === state.editingId);
      if (idx !== -1) {
        // 即使数据库不支持星标字段，本地状态也要更新（用于显示）
        state.titles[idx] = {
          ...state.titles[idx],
          ...payload
        };
      }

      showToast('标题已更新');
    } else {
      // ====== 情况二：新增标题 ======

      const insertPayload = {
        ...payload,
        usage_count: 0
      };

      // 要回写新插入的那条记录，所以加上 .select().single()
      let { data, error } = await supabase
        .from('titles')
        .insert([insertPayload])
        .select()
        .single();

      // 如果错误是因为字段不存在，移除星标字段重试
      if (error && (error.message.includes('is_starred') || error.message.includes('starred_at'))) {
        console.warn('[TitleApp] 数据库表缺少星标字段，移除星标数据后重试');
        const { is_starred, starred_at, ...payloadWithoutStar } = insertPayload;
        const retryResult = await supabase
          .from('titles')
          .insert([payloadWithoutStar])
          .select()
          .single();
        error = retryResult.error;
        data = retryResult.data;
        if (error) throw error;
        // 如果数据库不支持星标字段，但在本地状态中添加星标信息（用于显示）
        if (isStarred && data) {
          data.is_starred = true;
          data.starred_at = starredAt;
        }
      } else if (error) {
        throw error;
      }

      // 新增的加到数组头部，使最新一条在最上
      if (data) {
        state.titles.unshift(data);
      }

      showToast('标题已新增');
    }

    // 保持原来的筛选分类，不自动切到其他分类
    state.currentCategory = prevCategory;

    // 分类数量重新计算
    renderCategoryList();
    renderTitles();
    // 刷新场景下拉列表，更新数据条数
    refreshSceneSelects();
    closeTitleModal();
    dispatchDataChanged({ scope: 'titles', target: 'title' });
  } catch (e) {
    console.error('[TitleApp] 保存标题失败', e);
    showToast('保存失败：' + (e.message || ''), 'error');
  }
}

// =============== 7. 批量导入弹窗 ===============

function bindImportModal() {
  const btnClose = document.getElementById('btnCloseImport');
  const btnCancel = document.getElementById('btnCancelImport');
  const btnRun = document.getElementById('btnRunImport');

  if (btnClose) btnClose.addEventListener('click', closeImportModal);
  if (btnCancel) btnCancel.addEventListener('click', closeImportModal);
  if (btnRun) btnRun.addEventListener('click', runImport);
}

function openImportModal() {
  const modal = document.getElementById('importModal');
  if (!modal) return;

  const rawInput = document.getElementById('importRawInput');
  if (rawInput) rawInput.value = '';

  const sel = document.getElementById('importCategorySelect');
  if (sel) {
    sel.innerHTML = '';
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '请选择';
    sel.appendChild(emptyOpt);
    state.categories.filter((c) => c !== '全部').forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      sel.appendChild(opt);
    });
    sel.value = state.currentCategory === '全部' ? '' : state.currentCategory;
  }
  
  // 刷新场景下拉菜单
  refreshSceneSelects();

  modal.classList.remove('hidden');
  // 确保移除hidden类后，样式正确应用
  modal.style.display = '';
  modal.style.visibility = '';
  modal.style.opacity = '';
  modal.style.pointerEvents = '';
  modal.style.zIndex = '';
}

function closeImportModal() {
  const modal = document.getElementById('importModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

async function runImport() {
  const rawInput = document.getElementById('importRawInput');
  if (!rawInput) return;

  const raw = rawInput.value || '';
  const lines = raw
    .split('\n')
    .map((s) => stripLeadingIndex(s).trim())
    .filter(Boolean);

  if (!lines.length) {
    showToast('没有可导入的内容', 'error');
    return;
  }

  if (!supabase) {
    showToast('未配置 Supabase，无法导入云端', 'error');
    return;
  }

  const importCategorySelect = document.getElementById('importCategorySelect');
  const importAccountCategorySelect = document.getElementById('importAccountCategorySelect');
  const mainCategory = importCategorySelect && importCategorySelect.value ? importCategorySelect.value : null;
  const accountCategory = importAccountCategorySelect && importAccountCategorySelect.value ? importAccountCategorySelect.value : null;
  
  const rows = lines.map((text) => {
    const sceneTags = [userTag(getCurrentUser().username)];
    if (accountCategory) {
      sceneTags.push(accountCategory);
    }
    return {
      text,
      main_category: mainCategory,
      content_type: accountCategory,
      scene_tags: Array.from(new Set(sceneTags)),
      usage_count: 0
    };
  });
  
  console.log('[TitleApp] 批量导入 rows =', rows, 'mainCategory =', mainCategory, 'accountCategory =', accountCategory);

  try {
    const { error } = await supabase.from('titles').insert(rows);
    if (error) throw error;
    showToast(`批量导入成功，共 ${rows.length} 条`);
    closeImportModal();
    await loadTitlesFromCloud();
    dispatchDataChanged({ scope: 'titles', target: 'title', action: 'import' });
    // loadTitlesFromCloud 内部已经会调用 refreshSceneSelects，这里不需要重复调用
    dispatchDataChanged('titles');
  } catch (e) {
    console.error('[TitleApp] 批量导入云端失败', e);
    showToast('云端导入失败', 'error');
  }
}

// =============== 8. 云端快照：保存 / 加载 / 列表 ===============

async function saveCloudSnapshot() {
  if (!window.snapshotService) {
    alert('未配置 Supabase');
    return;
  }
  const label = prompt('请输入这次快照的备注名称（例如：11月中旬版本）：', '');
  if (label === null) return;
  try {
    const info = await window.snapshotService.saveUnifiedSnapshotFromCloud(
      label.trim()
    );
    showToast(
      `已保存：标题 ${info.titleCount} 条 文案 ${info.contentCount} 条 ${info.updatedText}`
    );
  } catch (e) {
    console.error('[TitleApp] saveCloudSnapshot error', e);
    alert('保存快照失败：' + (e.message || 'Unknown error'));
  }
}

async function loadCloudSnapshot(key, options = {}) {
  if (!window.snapshotService) {
    alert('未配置 Supabase');
    return;
  }
  try {
    const info = await window.snapshotService.loadUnifiedSnapshot(key, 'both');
    // 重新加载分类（从 localStorage 恢复）
    loadCategoriesFromLocal();
    renderCategoryList();
    // 重新应用显示设置（包括场景设置/账号分类）
    applyDisplaySettings();
    await loadTitlesFromCloud();
    // loadTitlesFromCloud 内部已经会调用 refreshSceneSelects，这里不需要重复调用
    showToast(
      `已加载：标题 ${info.titleCount} 条 文案 ${info.contentCount} 条 ${info.updatedText}`
    );
  } catch (e) {
    console.error('[TitleApp] loadCloudSnapshot error', e);
    alert('加载快照失败：' + (e.message || 'Unknown error'));
  }
}

async function renderCloudHistoryList(anchorBtn) {
  if (!window.snapshotService) {
    alert('未配置 Supabase');
    return;
  }
  const panel = document.getElementById('cloudHistoryPanel');
  if (!panel) {
    console.warn('[TitleApp] renderCloudHistoryList: cloudHistoryPanel 未找到');
    return;
  }
  
  // 强制显示面板
  panel.classList.remove('hidden');
  panel.style.display = 'block';
  panel.style.visibility = 'visible';
  panel.style.opacity = '1';
  panel.style.pointerEvents = 'auto';
  panel.style.zIndex = '50';
  
  panel.innerHTML =
    '<div style="padding:8px 10px;font-size:12px;color:#6b7280;">加载中…</div>';
  const rect = anchorBtn.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  let left = rect.left + scrollLeft;
  const top = rect.bottom + scrollTop + 8;
  const viewportWidth =
    document.documentElement.clientWidth || window.innerWidth;
  const panelWidth = 260;
  const margin = 8;
  const maxLeft = scrollLeft + viewportWidth - panelWidth - margin;
  const minLeft = scrollLeft + margin;
  if (left > maxLeft) left = Math.max(minLeft, maxLeft);
  if (left < minLeft) left = minLeft;
  panel.style.top = top + 'px';
  panel.style.left = left + 'px';
  try {
    const list = await window.snapshotService.listUnified(5);
    if (!list || list.length === 0) {
      panel.innerHTML =
        '<div style="padding:8px 10px;font-size:12px;color:#6b7280;">暂无快照</div>';
      return;
    }
    // 第一个是最新的快照
    const rows = list.map((it, index) => {
      const isLatest = index === 0;
      return `
      <div class="cloud-item ${isLatest ? 'cloud-item-latest' : ''}" data-key="${it.key}">
        <div class="cloud-item-main">
          <div class="cloud-item-name-wrapper">
            <div class="cloud-item-name">${it.label}</div>
            ${isLatest ? '<span class="cloud-item-latest-badge">最新</span>' : ''}
          </div>
          <div class="cloud-item-meta">标题 ${it.titleCount} 条 · 文案 ${it.contentCount} 条 · ${it.updatedText}</div>
        </div>
      </div>
    `;
    });
    panel.innerHTML = rows.join('');
    panel.querySelectorAll('.cloud-item').forEach((el) => {
      el.addEventListener('click', () => {
        const key = el.getAttribute('data-key');
        if (!key) return;
        openCloudLoadConfirmTitle(key);
      });
    });
  } catch (e) {
    console.error('[TitleApp] renderCloudHistoryList error', e);
    panel.innerHTML =
      '<div style="padding:8px 10px;color:#f43f5e;">加载云端快照失败</div>';
  }
}

function toggleCloudHistoryPanel(e) {
  // 阻止事件冒泡，防止被document的click事件处理
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  
  const panel = document.getElementById('cloudHistoryPanel');
  const btn = document.getElementById('btnLoadCloud');
  if (!panel) {
    console.warn('[TitleApp] toggleCloudHistoryPanel: cloudHistoryPanel 未找到');
    return;
  }
  if (!btn) {
    console.warn('[TitleApp] toggleCloudHistoryPanel: btnLoadCloud 未找到');
    return;
  }

  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    panel.style.display = 'none';
    panel.style.visibility = 'hidden';
    return;
  }

  renderCloudHistoryList(btn);
}
function hideCloudHistoryPanel() {
  const panel = document.getElementById('cloudHistoryPanel');
  if (!panel) return;
  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    panel.style.display = 'none';
  }
}
document.addEventListener('click', (e) => {
  const panel = document.getElementById('cloudHistoryPanel');
  const btn = document.getElementById('btnLoadCloud');
  if (!panel || panel.classList.contains('hidden')) return;
  const target = e.target;
  // 如果点击的是按钮本身或其子元素，不关闭面板
  if (btn && (btn === target || btn.contains(target))) return;
  // 如果点击的是面板内部，不关闭面板
  if (panel.contains(target)) return;
  // 否则关闭面板
  panel.classList.add('hidden');
  panel.style.display = 'none';
  panel.style.visibility = 'hidden';
});

// =============== 9. 分类按钮：新增 / 删除 / 排序 ===============

function bindCategoryButtons() {
  const btnAdd = document.getElementById('btnAddCategory');
  const btnDel = document.getElementById('btnDeleteCategory');
  const btnSort = document.getElementById('btnSortCategory');

  if (btnAdd) {
    btnAdd.addEventListener('click', openAddCategoryModal);
  }

  if (btnDel) {
    btnDel.addEventListener('click', openDeleteCategoryModal);
  }

  if (btnSort) {
    // 初始化按钮激活状态（默认开启）
    if (state.isSortingCategories) {
      btnSort.classList.add('active');
    }
    
    btnSort.addEventListener('click', () => {
      state.isSortingCategories = !state.isSortingCategories;
      // 更新按钮激活状态
      if (state.isSortingCategories) {
        btnSort.classList.add('active');
      } else {
        btnSort.classList.remove('active');
      }
      renderCategoryList();
      showToast(
        state.isSortingCategories
          ? '分类排序模式已开启（点击↑↓调整顺序，点击"改"按钮可修改分类名称）'
          : '已退出分类排序模式'
      );
    });
  }
}

function openAddCategoryModal() {
  const modal = document.getElementById('addCategoryModal');
  const input = document.getElementById('addCategoryInput');
  const btnClose = document.getElementById('btnCloseAddCategory');
  const btnCancel = document.getElementById('btnCancelAddCategory');
  const btnConfirm = document.getElementById('btnConfirmAddCategory');
  if (!modal || !input || !btnClose || !btnCancel || !btnConfirm) return;
  modal.classList.remove('hidden');
  // 确保移除hidden类后，样式正确应用
  modal.style.display = '';
  modal.style.visibility = '';
  modal.style.opacity = '';
  modal.style.pointerEvents = '';
  modal.style.zIndex = '';
  input.value = '';
  input.focus();
  const close = () => { modal.classList.add('hidden'); };
  btnClose.onclick = close;
  btnCancel.onclick = close;
  btnConfirm.onclick = () => {
    const trimmed = input.value.trim();
    if (!trimmed) { showToast('分类名不能为空', 'error'); return; }
    if (state.categories.includes(trimmed)) { showToast('已存在同名分类', 'error'); return; }
    state.categories.push(trimmed);
    saveCategoriesToLocal();
    renderCategoryList();
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app-title.js:1751',message:'Category added',data:{newCategory:trimmed,allCategories:state.categories},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'SYNC1'})}).catch(()=>{});
    // #endregion
    showToast('分类已新增');
    close();
  };
}

function openDeleteCategoryModal() {
  const modal = document.getElementById('deleteCategoryModal');
  const btnClose = document.getElementById('btnCloseDeleteCategory');
  const btnCancel = document.getElementById('btnCancelDeleteCategory');
  const btnConfirm = document.getElementById('btnConfirmDeleteCategory');
  if (!modal || !btnClose || !btnCancel || !btnConfirm) return;
  const cat = state.currentCategory;
  if (!cat || cat === '全部') { showToast('不能删除「全部」分类', 'error'); return; }
  modal.classList.remove('hidden');
  // 确保移除hidden类后，样式正确应用
  modal.style.display = '';
  modal.style.visibility = '';
  modal.style.opacity = '';
  modal.style.pointerEvents = '';
  modal.style.zIndex = '';
  const nameEl = document.getElementById('deleteCategoryName');
  if (nameEl) nameEl.textContent = cat;
  const close = () => { modal.classList.add('hidden'); };
  btnClose.onclick = close;
  btnCancel.onclick = close;
  btnConfirm.onclick = () => {
    const target = state.currentCategory;
    state.categories = state.categories.filter((c) => c !== target);
    // 保留各条目的 main_category，不清空标签，方便后续重新新增分类时正确统计
    state.currentCategory = '全部';
    saveCategoriesToLocal();
    renderCategoryList();
    renderTitles();
    showToast('分类已删除');
    close();
  };
}

function bindCloudButtons() {
  const statusSelector = '#autoSyncStatus';
  if (window.cloudSync && typeof window.cloudSync.bindCloudButtons === 'function') {
    window.cloudSync.bindCloudButtons({ statusSelector });
    if (typeof window.cloudSync.initAutoSync === 'function') {
      window.cloudSync.initAutoSync({ statusSelector });
    }
    return;
  }

  const btnSave = document.getElementById('btnSaveCloud');
  const btnLoad = document.getElementById('btnLoadCloud');

  if (btnSave) {
    btnSave.addEventListener('click', async (e) => { 
      e.stopPropagation();
      try {
        setAutoSyncStatus({ status: 'syncing' });
        const syncKey = window.cloudSync.getUserLiveKey
          ? window.cloudSync.getUserLiveKey()
          : window.cloudSync.DEFAULT_SNAPSHOT_KEY;
        const result = await window.cloudSync.cloudSave(syncKey);
        if (result && result.saved) {
          showToast(result.message || '已同步到云端');
        } else if (result && result.skipped) {
          showToast(result.message || '云端已是最新', 'info');
        }
        setAutoSyncStatus({ status: 'synced' });
      } catch (err) {
        console.error('[TitleApp] 立即同步失败', err);
        setAutoSyncStatus({ status: 'error', message: err.message });
        showToast('同步失败，请稍后再试', 'error');
      }
    });
  } else {
    console.warn('[TitleApp] bindCloudButtons: btnSaveCloud 未找到');
  }
  if (btnLoad) {
    btnLoad.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        setAutoSyncStatus({ status: 'pulling' });
        const syncKey = window.cloudSync.getUserLiveKey
          ? window.cloudSync.getUserLiveKey()
          : window.cloudSync.DEFAULT_SNAPSHOT_KEY;
        await window.cloudSync.cloudLoadLatest(syncKey);
        await loadTitlesFromCloud();
        showToast('已从云端刷新');
        setAutoSyncStatus({ status: 'synced' });
      } catch (err) {
        console.error('[TitleApp] 立即拉取失败', err);
        setAutoSyncStatus({ status: 'error', message: err.message });
        showToast('拉取失败，请稍后重试', 'error');
      }
    });
    console.log('[TitleApp] bindCloudButtons: btnLoadCloud 事件已绑定');
  } else {
    console.warn('[TitleApp] bindCloudButtons: btnLoadCloud 未找到');
  }
}

function bindGlobalNavButtons() {
  const btnSettings = document.getElementById('btnSettings');
  const btnManage = document.getElementById('btnManagePage');

  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      window.location.href = 'settings.html';
    });
  }

  if (btnManage) {
    btnManage.addEventListener('click', () => {
      window.location.href = 'admin-center.html';
    });
  }
}

function openClearConfirmModal() {
  const modal = document.getElementById('clearConfirmModal');
  const btnClose = document.getElementById('btnCloseClearConfirm');
  const btnCancel = document.getElementById('btnCancelClear');
  const btnConfirm = document.getElementById('btnConfirmClear');
  if (!modal || !btnClose || !btnCancel || !btnConfirm) return;
  modal.classList.remove('hidden');
  // 确保移除hidden类后，样式正确应用
  modal.style.display = '';
  modal.style.visibility = '';
  modal.style.opacity = '';
  modal.style.pointerEvents = '';
  modal.style.zIndex = '';
  const close = () => { modal.classList.add('hidden'); };
  btnClose.onclick = close;
  btnCancel.onclick = close;
  btnConfirm.onclick = async () => {
    if (!supabase) { showToast('Supabase 未配置，无法清空云端', 'error'); return; }
    try {
      const { error } = await supabase.from('titles').delete().not('id', 'is', null);
      if (error) throw error;
      state.titles = [];
      renderTitles();
      showToast('已清空全部标题');
      dispatchDataChanged({ scope: 'titles', target: 'title', action: 'clear_all' });
    } catch (e) {
      showToast('清空失败： ' + (e.message || ''), 'error');
    } finally {
      close();
    }
  };
}

function openCloudLabelModal() {
  const modal = document.getElementById('cloudLabelModal');
  const input = document.getElementById('cloudLabelInput');
  const btnClose = document.getElementById('btnCloseCloudLabel');
  const btnCancel = document.getElementById('btnCancelCloudLabel');
  const btnSave = document.getElementById('btnSaveCloudLabel');
  if (!modal || !input || !btnClose || !btnCancel || !btnSave) {
    console.error('[TitleApp] openCloudLabelModal: 缺少必要的DOM元素');
    return;
  }
  modal.classList.remove('hidden');
  // 确保移除hidden类后，样式正确应用
  modal.style.display = '';
  modal.style.visibility = '';
  modal.style.opacity = '';
  modal.style.pointerEvents = '';
  modal.style.zIndex = '';
  
  // 生成默认值：用户名+年月日时间
  const user = getCurrentUser();
  const username = user ? user.username : 'user';
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const defaultLabel = `${username}${year}${month}${day}`;
  input.value = defaultLabel;
  
  // 延迟focus，确保模态框已显示，并选中所有文本以便用户直接输入
  setTimeout(() => {
    input.focus();
    input.select();
  }, 100);
  const close = () => { modal.classList.add('hidden'); };
  btnClose.onclick = close;
  btnCancel.onclick = close;
  btnSave.onclick = async () => {
    if (!window.snapshotService) { 
      alert('未配置 Supabase'); 
      return; 
    }
    const label = input.value.trim();
    if (!label) {
      alert('快照备注名称不能为空');
      input.focus();
      return;
    }
    try {
      const info = await window.snapshotService.saveUnifiedSnapshotFromCloud(label);
      close();
      showToast(`已保存：标题 ${info.titleCount} 条 文案 ${info.contentCount} 条 ${info.updatedText}`);
    } catch (e) {
      console.error('[TitleApp] 保存快照失败:', e);
      alert('保存快照失败：' + (e.message || 'Unknown error'));
    }
  };
}

// =============== 10. Toast ===============

function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;

  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.background =
    type === 'error' ? 'rgba(220,38,38,0.92)' : 'rgba(17,24,39,0.92)';

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('hidden');
  }, 1800);
}

// =============== 11. 暴露给 HTML 的全局函数 ===============

window.openTitleModal = openTitleModal;
window.openImportModal = openImportModal;
