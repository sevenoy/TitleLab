console.log('[ContentApp] app-content.js loaded');

const supabase = window.supabaseClient || null;

const DEFAULT_CATEGORIES = ['全部', '亲子', '情侣', '闺蜜', '单人', '烟花', '夜景'];

// 获取带用户名的 localStorage key（每个账号单独存储）
function getCategoryLSKey() {
  const user = getCurrentUser();
  const username = user ? user.username : 'default';
  return `content_categories_v1_${username}`;
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

const state = {
  contents: [],
  categories: [...DEFAULT_CATEGORIES],
  currentCategory: '全部',
  renamingCategory: null, // 正在重命名的分类名称
  filters: { search: '', scene: '' },
  editingId: null,
  isSortingCategories: true, // 分类是否处在"排序模式"（默认开启）
  expandedCopyId: null,
  activeCopyAiId: null
};

let toastTimer = null;

function dispatchDataChanged(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent('dataChanged', { detail }));
  } catch (e) {
    console.warn('[ContentApp] dispatchDataChanged failed', e);
  }
}

// 允许登录的用户列表（与 login.html 保持一致）
const ALLOWED_USERS = ['sevenoy', 'olina'];

function validateUser(user) {
  if (!user || !user.username) return false;
  return ALLOWED_USERS.includes(user.username);
}

function getLocalDefaults() {
  const user = getCurrentUser();
  if (!user) return {};
  const key = `local_device_default_v1_${user.username}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch(e) { return {}; }
}

window.saveLocalDefaults = function() {
  const user = getCurrentUser();
  if (!user) return;
  const key = `local_device_default_v1_${user.username}`;
  const filterSceneEl = document.getElementById('filterScene');
  const data = {
    defaultCategory: state.currentCategory,
    defaultScene: state.filters.scene || (filterSceneEl ? filterSceneEl.value : '')
  };
  localStorage.setItem(key, JSON.stringify(data));
  if (typeof showToast !== 'undefined') {
    showToast('已保存当前筛选为本机默认配置');
  } else {
    alert('已保存当前筛选为本机默认配置');
  }
};

document.addEventListener('DOMContentLoaded', async () => {
  
  const user = getCurrentUser();
  
  if (!user || !validateUser(user)) { 
    // 清除无效的用户信息
    try { localStorage.removeItem('current_user_v1'); } catch (_) {}
    window.location.href = 'login.html'; 
    return; 
  }
  applyDisplaySettings();
  
  // 读取并应用本机默认预设（账号与分类）
  const localDefs = getLocalDefaults();
  if (localDefs.defaultCategory) {
    state.currentCategory = localDefs.defaultCategory;
  }
  if (localDefs.defaultScene) {
    state.filters.scene = localDefs.defaultScene;
    const filterScene = document.getElementById('filterScene');
    if (filterScene) filterScene.value = localDefs.defaultScene;
  }
  
  // 分类 - 优先从数据库加载，失败则从本地加载
  await loadCategoriesFromDatabase();
  
  renderCategoryList();
  bindCategoryButtons();
  setupMobileCategoryDropdown();
  
  // 初始化场景下拉菜单
  refreshSceneSelects();
  
  bindToolbar();
  bindContentModal();
  bindImportModal();
  bindRenameCategoryModal();
  bindCloudButtons();
  bindGlobalNavButtons();
  
  // 监听 localStorage 变化，当场景设置改变时自动更新
  window.addEventListener('storage', (e) => {
    const settingsKey = getDisplaySettingsLSKey();
    if (e.key === settingsKey) {
      refreshSceneSelects();
    }
  });
  
  // 也监听同窗口内的设置变化（通过自定义事件）
  window.addEventListener('settingsUpdated', () => {
    refreshSceneSelects();
  });
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
  
  await loadContentsFromCloud();
  
  initAutoSync();
});

let pendingSnapshotKeyContent = null;
function openCloudLoadConfirmContent(key) {
  const modal = document.getElementById('cloudLoadConfirmModalContent');
  const btnClose = document.getElementById('btnCloseCloudLoadConfirmContent');
  const btnCancel = document.getElementById('btnCancelCloudLoadContent');
  const btnConfirm = document.getElementById('btnConfirmCloudLoadContent');
  if (!modal || !btnClose || !btnCancel || !btnConfirm) return;
  pendingSnapshotKeyContent = key;
  modal.classList.remove('hidden');
  const close = () => { modal.classList.add('hidden'); pendingSnapshotKeyContent = null; };
  btnClose.onclick = close;
  btnCancel.onclick = close;
  btnConfirm.onclick = async () => {
    if (pendingSnapshotKeyContent) {
      try {
        const info = await window.snapshotService.loadUnifiedSnapshot(pendingSnapshotKeyContent, 'both');
        // 重新加载分类（优先从数据库恢复）
        await loadCategoriesFromDatabase();
        renderCategoryList();
        // 重新应用显示设置（包括场景设置/账号分类）
        applyDisplaySettings();
        await loadContentsFromCloud();
        showToast(`已加载：标题 ${info.titleCount} 条 文案 ${info.contentCount} 条 ${info.updatedText}`);
      } catch (e) {
        alert('加载快照失败：' + (e.message || 'Unknown error'));
      }
    }
    close();
  };
}

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

function stripLeadingIndex(s) {
  return (s || '').replace(/^\s*\d+(?:\.\d+)*(?:[\.)、．])?\s*/, '');
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
    // 允许 scenes 为空数组，只有当 parsed.scenes 为 undefined 时才使用默认值
    const scenes = parsed.hasOwnProperty('scenes') && Array.isArray(parsed.scenes) 
      ? parsed.scenes 
      : defaultScenes;
    return {
      ...DEFAULT_DISPLAY_SETTINGS,
      ...parsed,
      scenes
    };
  } catch (_) {
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
  if (topbarTitle) topbarTitle.style.color = settings.titleColor;
  renderSceneFilterOptions(settings);
  // 同时刷新所有场景下拉菜单
  refreshSceneSelects();
}

/**
 * 从数据库读取文案分类（优先）
 * 如果数据库读取失败，则降级到 localStorage
 */
async function loadCategoriesFromDatabase() {
  
  const user = getCurrentUser();
  if (!user || !supabase) {
    console.warn('[ContentApp] 无法从数据库读取分类，降级到 localStorage');
    loadCategoriesFromLocal();
    return;
  }
  
  const userTag = `user:${user.username}`;
  
  try {
    
    const { data, error } = await supabase
      .from('user_categories')
      .select('*')
      .eq('user_tag', userTag)
      .eq('category_type', 'shared')
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    
    // 转换为数组格式，始终包含"全部"
    const categories = ['全部', ...(data || []).map(c => c.category_name)];
    state.categories = categories;
    
    console.log('[ContentApp] ✅ 从数据库加载文案分类:', categories);
    renderCategoryList();
  } catch (e) {
    console.error('[ContentApp] ❌ 从数据库加载分类失败，降级到 localStorage:', e);
    loadCategoriesFromLocal();
  }
}

/**
 * 从数据库读取账号分类（优先）
 * 如果数据库读取失败，则降级到 localStorage
 */
async function loadAccountCategoriesFromDatabase() {
  const user = getCurrentUser();
  if (!user || !supabase) {
    console.warn('[ContentApp] 无法从数据库读取账号分类，降级到 localStorage');
    return getDisplaySettings().scenes || [];
  }
  
  const userTag = `user:${user.username}`;
  
  try {
    const { data, error } = await supabase
      .from('user_account_categories')
      .select('*')
      .eq('user_tag', userTag)
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    
    // 转换为数组格式
    const scenes = (data || []).map(c => c.account_category_name);
    
    console.log('[ContentApp] ✅ 从数据库加载账号分类:', scenes);
    return scenes;
  } catch (e) {
    console.error('[ContentApp] ❌ 从数据库加载账号分类失败，降级到 localStorage:', e);
    return getDisplaySettings().scenes || [];
  }
}

function loadCategoriesFromLocal() {
  const key = getCategoryLSKey();
  const raw = localStorage.getItem(key);
  if (!raw) { state.categories = [...DEFAULT_CATEGORIES]; return; }
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) {
      state.categories = [...DEFAULT_CATEGORIES];
    } else {
      const set = new Set(arr);
      set.delete('全部');
      state.categories = ['全部', ...set];
    }
  } catch (_) {
    state.categories = [...DEFAULT_CATEGORIES];
  }
}

/**
 * 保存文案分类到数据库（优先）
 * 同时也保存到 localStorage 作为备份
 */
async function saveCategoriesToDatabase() {
  const user = getCurrentUser();
  if (!user || !supabase) {
    console.warn('[ContentApp] 无法保存到数据库，仅保存到 localStorage');
    saveCategoriesToLocal();
    return;
  }
  
  const userTag = `user:${user.username}`;
  const categoriesToSave = state.categories.filter(c => c !== '全部');
  
  try {
    // 先删除该用户的所有共享分类
    const { error: deleteError } = await supabase
      .from('user_categories')
      .delete()
      .eq('user_tag', userTag)
      .eq('category_type', 'shared');
    
    if (deleteError) throw deleteError;
    
    // 批量插入新分类
    if (categoriesToSave.length > 0) {
      const rows = categoriesToSave.map((name, index) => ({
        user_tag: userTag,
        category_type: 'shared',
        category_name: name,
        display_order: index
      }));
      
      const { error: insertError } = await supabase
        .from('user_categories')
        .insert(rows);
      
      if (insertError) throw insertError;
    }
    
    console.log('[ContentApp] ✅ 文案分类已保存到数据库:', categoriesToSave);
    
    // 同时保存到 localStorage 作为备份
    saveCategoriesToLocal();
    
    // 触发数据变更事件
    dispatchDataChanged({ scope: 'categories', target: 'content' });
    
  } catch (e) {
    console.error('[ContentApp] ❌ 保存分类到数据库失败，降级到 localStorage:', e);
    saveCategoriesToLocal();
  }
}

function saveCategoriesToLocal() {
  const key = getCategoryLSKey();
  localStorage.setItem(key, JSON.stringify(state.categories));
  dispatchDataChanged({ scope: 'categories', target: 'content' });
}

function renderCategoryList() {
  const list = document.getElementById('categoryList');
  if (!list) return;
  list.innerHTML = '';
  state.categories.forEach((cat, index) => {
    const li = document.createElement('li');
    li.className = 'category-item' + (cat === state.currentCategory ? ' active' : '');
    li.dataset.cat = cat;
    // 左侧：分类名（排序模式下可编辑）
    const nameSpan = document.createElement('span');
    nameSpan.className = 'category-name';
    
    nameSpan.textContent = cat;
    const rightSpan = document.createElement('span');
    rightSpan.className = 'category-right';
    const count = cat === '全部'
      ? state.contents.length
      : state.contents.filter((t) => t.main_category === cat).length;
    const countSpan = document.createElement('span');
    countSpan.className = 'category-count';
    countSpan.textContent = `${count}条`;
    rightSpan.appendChild(countSpan);

    if (state.isSortingCategories && cat !== '全部') {
      const controls = document.createElement('span');
      controls.className = 'category-sort-controls';
      const btnUp = document.createElement('button');
      btnUp.type = 'button';
      btnUp.innerHTML = '▲';
      btnUp.className = 'function-btn ghost text-xs btn-inline';
      btnUp.style.marginLeft = '4px';
      btnUp.addEventListener('click', (e) => { e.stopPropagation(); reorderCategory(index, -1); });
      const btnDown = document.createElement('button');
      btnDown.type = 'button';
      btnDown.innerHTML = '▼';
      btnDown.className = 'function-btn ghost text-xs btn-inline';
      btnDown.style.marginLeft = '4px';
      btnDown.addEventListener('click', (e) => { e.stopPropagation(); reorderCategory(index, 1); });
      
      const btnRename = document.createElement('button');
      btnRename.type = 'button';
      btnRename.textContent = '改';
      btnRename.className = 'function-btn ghost text-xs btn-inline';
      btnRename.style.marginLeft = '4px';
      btnRename.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        console.log('[ContentApp] 点击改按钮，分类名称：', cat);
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
          renderContents();
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
      renderContents();
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

async function reorderCategory(index, delta) {
  const newIndex = index + delta;
  if (index <= 0) return;
  if (newIndex <= 0) return;
  if (newIndex >= state.categories.length) return;
  const arr = [...state.categories];
  const item = arr[index];
  arr.splice(index, 1);
  arr.splice(newIndex, 0, item);
  state.categories = arr;
  await saveCategoriesToDatabase();
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
  await saveCategoriesToDatabase();
  
  // 如果当前分类是被修改的分类，也要更新
  if (state.currentCategory === oldName) {
    state.currentCategory = newName;
  }
  
  // 更新数据库中的所有相关记录
  if (supabase) {
    try {
      const { error } = await supabase
        .from('contents')
        .update({ main_category: newName })
        .eq('main_category', oldName);
      
      if (error) throw error;
      
      // 更新本地 state.contents
      state.contents.forEach((content) => {
        if (content.main_category === oldName) {
          content.main_category = newName;
        }
      });
      
      showToast('分类名称已更新');
    } catch (e) {
      console.error('[ContentApp] 更新分类名称失败', e);
      showToast('更新分类名称失败：' + (e.message || ''), 'error');
      // 回滚
      state.categories[catIndex] = oldName;
      await saveCategoriesToDatabase();
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
  renderContents();
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

function bindToolbar() {
  const searchInput = document.getElementById('searchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const filterScene = document.getElementById('filterScene');
  const btnNew = document.getElementById('btnNewTitle');
  const btnBatchImport = document.getElementById('btnBatchImport');
  const btnClearAll = document.getElementById('btnClearAll');
  if (searchInput) {
    const syncClearBtn = () => {
      if (!btnClearSearch) return;
      btnClearSearch.style.display = searchInput.value ? 'flex' : 'none';
    };
    searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value.trim();
      renderContents();
      syncClearBtn();
    });
    syncClearBtn();
    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        state.filters.search = '';
        renderContents();
        syncClearBtn();
      });
    }
  }
  if (btnBatchImport) {
    btnBatchImport.addEventListener('click', () => {
      openImportModal();
    });
  }
  if (filterScene) {
    filterScene.addEventListener('change', (e) => {
      state.filters.scene = e.target.value;
      renderContents();
    });
  }
  if (btnNew) {
    btnNew.addEventListener('click', () => {
      openContentModal();
    });
  }
  if (btnClearAll) {
    btnClearAll.addEventListener('click', openClearConfirmModal);
  }
}

async function loadContentsFromCloud() {
  
  if (!supabase) return;
  try {
    
    const { data, error } = await supabase
      .from('contents')
      .select('*')
      // 按 created_at 升序：最早创建的在前，新添加的在后
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    const user = getCurrentUser();
    const tag = user ? userTag(user.username) : null;
    const filtered = tag
      ? (data || []).filter((it) => Array.isArray(it.scene_tags) && it.scene_tags.includes(tag))
      : (data || []);
    state.contents = filtered;
    renderCategoryList();
    renderContents();
    // 刷新场景下拉列表，更新数据条数
    refreshSceneSelects();
  } catch (e) {
    state.contents = [];
    renderCategoryList();
    renderContents();
  }
}

function userTag(u) { return `user:${u}`; }

function applyFilters(list) {
  const cat = state.currentCategory;
  const scene = state.filters.scene;
  const q = state.filters.search.toLowerCase();
  const filtered = list.filter((item) => {
    // 主分类筛选
    if (cat !== '全部' && item.main_category !== cat) return false;
    
    // 账号分类筛选（通过 scene_tags）
    if (scene) {
      const tags = Array.isArray(item.scene_tags) ? item.scene_tags : [];
      if (!tags.includes(scene)) return false;
    }
    
    // 搜索筛选
    if (q && !(item.text || '').toLowerCase().includes(q)) return false;
    
    return true;
  });
  
  // 排序：星标数据永远置顶，按星标时间升序（先标记的在前），然后按创建时间升序（先创建的在前）
  const sorted = filtered.sort((a, b) => {
    const aStarred = a.is_starred === true;
    const bStarred = b.is_starred === true;
    
    // 如果都是星标，按星标时间升序（先标记的在前，后标记的在后）
    if (aStarred && bStarred) {
      const aTime = a.starred_at ? new Date(a.starred_at).getTime() : 0;
      const bTime = b.starred_at ? new Date(b.starred_at).getTime() : 0;
      return aTime - bTime; // 升序：先标记的在前
    }
    
    // 如果只有一个是星标，星标的永远在前
    if (aStarred && !bStarred) return -1;
    if (!aStarred && bStarred) return 1;
    
    // 都不是星标，按创建时间升序（先创建的在前，后创建的在后）
    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aCreated - bCreated; // 升序：先创建的在前
  });
  
  console.log('[ContentApp] 筛选结果:', {
    total: list.length,
    filtered: sorted.length,
    filters: { category: cat, scene: scene, search: q }
  });
  return sorted;
}

function renderContents() {
  const tbody = document.getElementById('contentTableBody');
  const mobileList = document.getElementById('contentMobileList');
  if (!tbody || !mobileList) return;
  tbody.innerHTML = '';
  mobileList.innerHTML = '';
  const list = applyFilters(state.contents);
  list.forEach((item, index) => {
    const copyId = getStableCopyId(item, index);
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
    
    const tdTitle = document.createElement('td');
    const titleWrap = document.createElement('div');
    titleWrap.className = 'copy-row-title';
    const summary = document.createElement('span');
    summary.className = 'copy-row-summary';
    summary.textContent = getCopySummary(item);
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'copy-toggle-btn';
    toggleBtn.textContent = state.expandedCopyId === copyId ? '▲' : '▼';
    toggleBtn.setAttribute('aria-label', state.expandedCopyId === copyId ? '收起文案' : '展开文案');
    toggleBtn.addEventListener('click', () => toggleCopyExpand(copyId));
    titleWrap.append(summary, toggleBtn);
    tdTitle.appendChild(titleWrap);
    tr.appendChild(tdTitle);
    const tdCat = document.createElement('td');
    tdCat.textContent = item.main_category || '';
    tr.appendChild(tdCat);
    const tdActions = document.createElement('td');
    const btnEdit = document.createElement('button');
    btnEdit.className = 'function-btn ghost text-xs btn-inline btn-rect';
    btnEdit.textContent = '修改';
    btnEdit.addEventListener('click', () => openContentModal(item));
    const btnDel = document.createElement('button');
    btnDel.className = 'function-btn ghost text-xs btn-inline btn-rect';
    btnDel.textContent = '删除';
    btnDel.addEventListener('click', () => openDeleteContentModal(item));
    const btnCopy = document.createElement('button');
    btnCopy.className = 'function-btn text-xs btn-inline btn-rect';
    btnCopy.textContent = '复制';
    btnCopy.addEventListener('click', () => copyContent(item));
    const btnAi = document.createElement('button');
    btnAi.className = 'function-btn ghost text-xs btn-inline btn-rect';
    btnAi.textContent = '✨AI';
    btnAi.title = '展开本地示例';
    btnAi.addEventListener('click', () => toggleCopyAi(copyId));
    const group = document.createElement('div');
    group.className = 'action-group';
    group.append(btnCopy, btnAi, btnEdit, btnDel);
    tdActions.appendChild(group);
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
    if (state.expandedCopyId === copyId) {
      const detailRow = document.createElement('tr');
      detailRow.className = 'ai-inline-table-row';
      const detailCell = document.createElement('td');
      detailCell.colSpan = 4;
      detailCell.appendChild(createCopyExpandedBlock(item, copyId));
      detailRow.appendChild(detailCell);
      tbody.appendChild(detailRow);
    }
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
      const arrow = state.expandedCopyId === copyId ? '▲' : '▼';
      if (truncated) preview = `${preview} …${arrow}`;
      else preview = `${preview} ${arrow}`;
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
    actions.className = 'flex gap-2 flex-shrink-0 mobile-actions';
    const mCopy = document.createElement('button');
    mCopy.className = 'function-btn text-xs btn-inline';
    mCopy.textContent = '复制';
    mCopy.addEventListener('click', () => copyContent(item));
    const mAi = document.createElement('button');
    mAi.className = 'function-btn ghost text-xs btn-inline';
    mAi.textContent = '✨AI';
    mAi.addEventListener('click', () => toggleCopyAi(copyId));
    const mEdit = document.createElement('button');
    mEdit.className = 'function-btn ghost text-xs btn-inline';
    mEdit.textContent = '修改';
    mEdit.addEventListener('click', () => openContentModal(item));
    const mDel = document.createElement('button');
    mDel.className = 'function-btn ghost text-xs btn-inline';
    mDel.textContent = '删除';
    mDel.addEventListener('click', () => openDeleteContentModal(item));
    actions.append(mCopy, mAi, mEdit, mDel);
    headerRow.append(leftWrap, actions);
    headerRow.addEventListener('click', (e) => {
      if (e.target && e.target.closest('button')) return;
      toggleCopyExpand(copyId);
    });
    if (state.expandedCopyId === copyId) {
      card.classList.add('open');
      card.append(headerRow, createCopyExpandedBlock(item, copyId));
    } else {
      card.append(headerRow);
    }
    mobileList.appendChild(card);
  });
  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-xs text-gray-500 py-2';
    empty.textContent = '暂无文案，请先新增。';
    mobileList.appendChild(empty);
  }
}

function getStableCopyId(item, index) {
  return String(item && item.id ? item.id : `local-copy-${index}`);
}

function getCopySummary(item) {
  const full = getCopyText(item);
  const lines = full.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const firstLine = lines[0] || '';
  return lines.length > 1 ? `${firstLine} ...` : firstLine;
}

function getCopyText(item) {
  const text = (item && item.text ? item.text : '').trim();
  return text || SAMPLE_COPY_TEXT;
}

const SAMPLE_COPY_TEXT = [
  '香港本地女摄｜合法持证，安心拍梦幻故事✨',
  '📍只拍一对一，每天最多2～3组，用心守护每场光。',
  '💗亲子、姐妹、情侣最擅长捕捉自然笑容',
  '🌇熟悉园区每个时间段的梦幻光',
  '✨让回忆不止是照片，而是童话一幕',
  '#港迪跟拍 #香港迪士尼拍照 #亲子摄影 #香港女摄影师'
].join('\n');

const COPY_TITLE_MOCK_RESULTS = [
  '港迪拍照技巧，轻松拍出封面级照片💕',
  '在香港迪士尼，把亲子照拍成童话感✨',
  '半小时也能拍出松弛感港迪旅拍📸'
];

function toggleCopyExpand(copyId) {
  state.expandedCopyId = state.expandedCopyId === copyId ? null : copyId;
  if (state.expandedCopyId !== copyId && state.activeCopyAiId === copyId) {
    state.activeCopyAiId = null;
  }
  renderContents();
}

function toggleCopyAi(copyId) {
  state.expandedCopyId = copyId;
  state.activeCopyAiId = state.activeCopyAiId === copyId ? null : copyId;
  renderContents();
}

function createCopyExpandedBlock(item, copyId) {
  const wrap = document.createElement('div');
  wrap.className = 'copy-expanded-wrap';

  const textBox = document.createElement('div');
  textBox.className = 'copy-expanded-text';
  getCopyText(item).split(/\r?\n/).forEach((line) => {
    const p = document.createElement('p');
    p.textContent = line;
    textBox.appendChild(p);
  });
  wrap.appendChild(textBox);

  if (state.activeCopyAiId === copyId) {
    wrap.appendChild(createCopyAiPanel(copyId));
  }

  return wrap;
}

function createCopyAiPanel(copyId) {
  const panel = document.createElement('div');
  panel.className = 'ai-inline-panel copy-ai-panel';

  const header = document.createElement('div');
  header.className = 'ai-inline-header';

  const title = document.createElement('div');
  title.className = 'ai-inline-title';
  title.textContent = 'AI 文案助手';

  const badge = document.createElement('span');
  badge.className = 'ai-local-badge';
  badge.textContent = '本地示例';

  header.append(title, badge);

  const chips = document.createElement('div');
  chips.className = 'ai-chip-row';
  ['提取标题', '改写文案', '生成话题', '精简文案'].forEach((label) => {
    const chip = document.createElement('span');
    chip.className = 'ai-chip';
    chip.textContent = label;
    chips.appendChild(chip);
  });

  const results = document.createElement('div');
  results.className = 'ai-result-list';
  COPY_TITLE_MOCK_RESULTS.forEach((text, idx) => {
    results.appendChild(createCopyAiTitleResult(text, idx));
  });

  const rewrite = document.createElement('div');
  rewrite.className = 'copy-ai-mode-block';
  rewrite.textContent = '改写文案：港迪亲子跟拍一对一服务，熟悉园区光线与动线，把自然笑容拍成童话感回忆。';

  const topics = document.createElement('div');
  topics.className = 'ai-chip-row';
  ['#港迪跟拍', '#香港迪士尼拍照', '#亲子摄影', '#香港女摄影师'].forEach((label) => {
    const chip = document.createElement('span');
    chip.className = 'ai-chip';
    chip.textContent = label;
    topics.appendChild(chip);
  });

  const shortCopy = document.createElement('div');
  shortCopy.className = 'copy-ai-mode-block';
  shortCopy.textContent = '精简文案：香港本地女摄一对一港迪跟拍，捕捉亲子、姐妹、情侣的自然童话感。';

  const footer = document.createElement('div');
  footer.className = 'ai-inline-footer';

  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'function-btn ghost text-xs btn-inline';
  refreshBtn.textContent = '换一批';
  refreshBtn.addEventListener('click', () => showToast('正在整理本地示例…'));

  const closeBtn = document.createElement('button');
  closeBtn.className = 'function-btn ghost text-xs btn-inline';
  closeBtn.textContent = '关闭';
  closeBtn.addEventListener('click', () => {
    if (state.activeCopyAiId === copyId) {
      state.activeCopyAiId = null;
      renderContents();
    }
  });

  footer.append(refreshBtn, closeBtn);
  panel.append(header, chips, results, rewrite, topics, shortCopy, footer);
  return panel;
}

function createCopyAiTitleResult(text, index) {
  const row = document.createElement('div');
  row.className = 'ai-result-item';

  const number = document.createElement('span');
  number.className = 'ai-result-number';
  number.textContent = String(index + 1);

  const body = document.createElement('div');
  body.className = 'ai-result-text';
  body.textContent = text;

  const copyBtn = document.createElement('button');
  copyBtn.className = 'function-btn ghost text-xs btn-inline';
  copyBtn.textContent = '复制';
  copyBtn.addEventListener('click', () => copyInlineText(text));

  const addBtn = document.createElement('button');
  addBtn.className = 'function-btn text-xs btn-inline';
  addBtn.textContent = '加入标题库';
  addBtn.addEventListener('click', () => showToast('已加入标题库'));

  const actions = document.createElement('div');
  actions.className = 'ai-result-actions';
  actions.append(copyBtn, addBtn);

  row.append(number, body, actions);
  return row;
}

async function copyInlineText(text) {
  try {
    await navigator.clipboard.writeText(text || '');
    showToast('已复制');
  } catch (_) {
    showToast('已复制');
  }
}

async function copyContent(item) {
  try {
    await navigator.clipboard.writeText(item.text || '');
    showToast('已复制');
  } catch (_) {
    showToast('复制失败', 'error');
  }
  if (!supabase || !item.id) return;
  try {
    const newCount = (item.usage_count || 0) + 1;
    await supabase.from('contents').update({ usage_count: newCount }).eq('id', item.id);
    const idx = state.contents.findIndex((t) => t.id === item.id);
    if (idx !== -1) state.contents[idx] = { ...state.contents[idx], usage_count: newCount };
    dispatchDataChanged({ scope: 'contents', target: 'content', action: 'usage_increment' });
  } catch (_) {}
}

function setupMobileCategoryDropdown() {
  const wrapper = document.getElementById('mobileCategoryWrapper');
  const toggleBtn = document.getElementById('mobileCategoryToggle');
  const list = document.getElementById('categoryList');
  if (!wrapper || !toggleBtn || !list) return;
  function isMobile() { return window.innerWidth < 768; }
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

function bindCategoryButtons() {
  const btnAdd = document.getElementById('btnAddCategory');
  const btnDel = document.getElementById('btnDeleteCategory');
  const btnSort = document.getElementById('btnSortCategory');
  if (btnAdd) {
    btnAdd.addEventListener('click', openAddCategoryModalContent);
  }
  if (btnDel) {
    btnDel.addEventListener('click', openDeleteCategoryModalContent);
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
      showToast(state.isSortingCategories ? '分类排序模式已开启（点击↑↓调整顺序，点击"改"按钮可修改分类名称）' : '已退出分类排序模式');
    });
  }
}

function openAddCategoryModalContent() {
  const modal = document.getElementById('addCategoryModalContent');
  const input = document.getElementById('addCategoryInputContent');
  const btnClose = document.getElementById('btnCloseAddCategoryContent');
  const btnCancel = document.getElementById('btnCancelAddCategoryContent');
  const btnConfirm = document.getElementById('btnConfirmAddCategoryContent');
  if (!modal || !input || !btnClose || !btnCancel || !btnConfirm) return;
  modal.classList.remove('hidden');
  input.value = '';
  input.focus();
  const close = () => { modal.classList.add('hidden'); };
  btnClose.onclick = close;
  btnCancel.onclick = close;
  btnConfirm.onclick = async () => {
    const trimmed = input.value.trim();
    if (!trimmed) { showToast('分类名不能为空', 'error'); return; }
    if (state.categories.includes(trimmed)) { showToast('已存在同名分类', 'error'); return; }
    state.categories.push(trimmed);
    await saveCategoriesToDatabase();
    renderCategoryList();
    showToast('分类已新增');
    close();
  };
}

function openDeleteCategoryModalContent() {
  const modal = document.getElementById('deleteCategoryModalContent');
  const btnClose = document.getElementById('btnCloseDeleteCategoryContent');
  const btnCancel = document.getElementById('btnCancelDeleteCategoryContent');
  const btnConfirm = document.getElementById('btnConfirmDeleteCategoryContent');
  if (!modal || !btnClose || !btnCancel || !btnConfirm) return;
  const cat = state.currentCategory;
  if (!cat || cat === '全部') { showToast('不能删除「全部」分类', 'error'); return; }
  modal.classList.remove('hidden');
  const nameEl = document.getElementById('deleteCategoryNameContent');
  if (nameEl) nameEl.textContent = cat;
  const close = () => { modal.classList.add('hidden'); };
  btnClose.onclick = close;
  btnCancel.onclick = close;
  btnConfirm.onclick = async () => {
    const target = state.currentCategory;
    state.categories = state.categories.filter((c) => c !== target);
    // 不清空条目的 main_category 标签，便于后续重新新增分类时正确统计
    state.currentCategory = '全部';
    await saveCategoriesToDatabase();
    renderCategoryList();
    renderContents();
    showToast('分类已删除');
    close();
  };
}

function bindContentModal() {
  const btnClose = document.getElementById('btnCloseModalContent');
  const btnCancel = document.getElementById('btnCancelModalContent');
  const btnSave = document.getElementById('btnSaveContent');
  if (btnClose) btnClose.addEventListener('click', closeContentModal);
  if (btnCancel) btnCancel.addEventListener('click', closeContentModal);
  if (btnSave) btnSave.addEventListener('click', saveContentFromModal);
}

function openContentModal(item) {
  const modal = document.getElementById('contentModal');
  if (!modal) return;
  const titleEl = document.getElementById('contentModalTitle');
  const textEl = document.getElementById('fieldTextContent');
  const mainCatEl = document.getElementById('fieldMainCategoryContent');
  const typeEl = document.getElementById('fieldContentTypeContent');
  const sceneEl = document.getElementById('fieldSceneTagsContent');
  const btnStar = document.getElementById('btnStarContent');
  
  refreshModalCategoryOptions(mainCatEl);
  // 刷新场景下拉菜单
  refreshSceneSelects();
  if (item && item.id) {
    state.editingId = item.id;
    if (titleEl) titleEl.textContent = '修改文案';
    if (textEl) textEl.value = item.text || '';
    if (mainCatEl) mainCatEl.value = item.main_category || '';
    
    // 从 scene_tags 中提取账号分类（场景管理中的值）
    const settings = getDisplaySettings();
    const scenes = settings.scenes || [];
    const sceneTags = Array.isArray(item.scene_tags) ? item.scene_tags : [];
    const accountCategory = sceneTags.find(tag => scenes.includes(tag));
    if (typeEl) typeEl.value = accountCategory || item.content_type || '';
    
    // 场景标签（排除账号分类和用户标签）
    const user = getCurrentUser();
    const userTagValue = user ? userTag(user.username) : '';
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
    if (titleEl) titleEl.textContent = '新增文案';
    if (textEl) textEl.value = '';
    const localDefs = getLocalDefaults();
    if (mainCatEl) {
      if (state.currentCategory !== '全部') {
        mainCatEl.value = state.currentCategory;
      } else if (localDefs.defaultCategory && localDefs.defaultCategory !== '全部') {
        mainCatEl.value = localDefs.defaultCategory;
      } else {
        mainCatEl.value = '';
      }
    }
    if (typeEl) typeEl.value = state.filters.scene || localDefs.defaultScene || '';
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
}

function closeContentModal() {
  const modal = document.getElementById('contentModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

function refreshModalCategoryOptions(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  const cats = state.categories.filter((c) => c !== '全部');
  const emptyOpt = document.createElement('option');
  emptyOpt.value = '';
  emptyOpt.textContent = '未选择';
  selectEl.appendChild(emptyOpt);
  cats.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    selectEl.appendChild(opt);
  });
}

async function saveContentFromModal() {
  const fieldText = document.getElementById('fieldTextContent');
  const fieldCat = document.getElementById('fieldMainCategoryContent');
  const fieldType = document.getElementById('fieldContentTypeContent');
  const fieldScene = document.getElementById('fieldSceneTagsContent');
  if (!fieldText || !fieldCat || !fieldType || !fieldScene) return;
  const text = fieldText.value.trim();
  const cat = fieldCat.value || null;
  const type = fieldType.value || null;
  const sceneRaw = fieldScene.value.trim();
  if (!text) { showToast('文案不能为空', 'error'); return; }
  const sceneTags = sceneRaw ? sceneRaw.split(/[，,、]/).map((s) => s.trim()).filter(Boolean) : [];
  const user = getCurrentUser(); if (!user) { showToast('请先登录', 'error'); return; }
  
  // 账号分类（fieldContentTypeContent）应该添加到 scene_tags 中
  const allSceneTags = [...(sceneTags || [])];
  if (type) {
    allSceneTags.push(type);
  }
  allSceneTags.push(userTag(user.username));
  
  // 获取星标状态
  const btnStar = document.getElementById('btnStarContent');
  const isStarred = btnStar && btnStar.classList.contains('active');
  
  // 如果是编辑已有文案，需要判断星标状态是否改变
  let starredAt = null;
  if (state.editingId) {
    const existingItem = state.contents.find(t => t.id === state.editingId);
    if (isStarred) {
      // 如果新设为星标，使用当前时间；如果已经是星标，保持原时间
      starredAt = existingItem && existingItem.is_starred ? existingItem.starred_at : new Date().toISOString();
    } else {
      // 取消星标，设为null
      starredAt = null;
    }
  } else {
    // 新增文案
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
  console.log('[ContentApp] 保存文案 payload =', payload, 'editingId =', state.editingId);
  if (!supabase) { showToast('未配置 Supabase，无法保存到云端', 'error'); return; }
  const prevCategory = state.currentCategory;
  try {
    if (state.editingId) {
      // 尝试保存，如果字段不存在则移除星标字段重试
      let updatePayload = payload;
      let { error } = await supabase.from('contents').update(updatePayload).eq('id', state.editingId);
      
      // 如果错误是因为字段不存在，移除星标字段重试
      if (error && (error.message.includes('is_starred') || error.message.includes('starred_at'))) {
        console.warn('[ContentApp] 数据库表缺少星标字段，移除星标数据后重试');
        const { is_starred, starred_at, ...payloadWithoutStar } = payload;
        updatePayload = payloadWithoutStar;
        const retryResult = await supabase.from('contents').update(updatePayload).eq('id', state.editingId);
        error = retryResult.error;
        if (error) throw error;
      } else if (error) {
        throw error;
      }
      
      // 即使数据库不支持星标字段，本地状态也要更新（用于显示）
      const idx = state.contents.findIndex((t) => t.id === state.editingId);
      if (idx !== -1) state.contents[idx] = { ...state.contents[idx], ...payload };
      showToast('文案已更新');
  } else {
      const insertPayload = { ...payload, usage_count: 0 };
      let { data, error } = await supabase.from('contents').insert([insertPayload]).select().single();
      
      // 如果错误是因为字段不存在，移除星标字段重试
      if (error && (error.message.includes('is_starred') || error.message.includes('starred_at'))) {
        console.warn('[ContentApp] 数据库表缺少星标字段，移除星标数据后重试');
        const { is_starred, starred_at, ...payloadWithoutStar } = insertPayload;
        const retryResult = await supabase.from('contents').insert([payloadWithoutStar]).select().single();
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
      
      if (data) state.contents.unshift(data);
      showToast('文案已新增');
    }
    state.currentCategory = prevCategory;
    renderCategoryList();
    renderContents();
    // 刷新场景下拉列表，更新数据条数
    refreshSceneSelects();
    closeContentModal();
    dispatchDataChanged({ scope: 'contents', target: 'content' });
  } catch (e) {
    showToast('保存失败：' + (e.message || ''), 'error');
  }
}

function renderSceneFilterOptions(settings) {
  const filterScene = document.getElementById('filterScene');
  if (!filterScene) return;
  const prevValue = filterScene.value;
  filterScene.innerHTML = '<option value="">账号分类</option>';
  (settings.scenes || []).forEach((scene) => {
    const opt = document.createElement('option');
    opt.value = scene;
    // 统计该场景的文案数据条数
    const count = state.contents.filter((content) => {
      const sceneTags = Array.isArray(content.scene_tags) ? content.scene_tags : [];
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
  if ((settings.scenes || []).includes(prevValue)) filterScene.value = prevValue; else filterScene.value = ''; 
  state.filters.scene = filterScene.value || '';
}

// 刷新场景下拉菜单（从数据库获取最新账号分类）
async function refreshSceneSelects() {
  // 从数据库加载最新账号分类
  const scenes = await loadAccountCategoriesFromDatabase();
  
  // 更新 filterScene（场景筛选）
  const filterScene = document.getElementById('filterScene');
  if (filterScene) {
    const prevValue = filterScene.value;
    filterScene.innerHTML = '<option value="">账号分类</option>';
    scenes.forEach((scene) => {
      const opt = document.createElement('option');
      opt.value = scene;
      // 统计该场景的文案数据条数
      const count = state.contents.filter((content) => {
        const sceneTags = Array.isArray(content.scene_tags) ? content.scene_tags : [];
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
  
  // 更新 fieldContentTypeContent（新增文案模态框中的账号分类）
  const fieldContentTypeContent = document.getElementById('fieldContentTypeContent');
  if (fieldContentTypeContent) {
    const prevValue = fieldContentTypeContent.value;
    fieldContentTypeContent.innerHTML = '<option value="">账号分类</option>';
    scenes.forEach((scene) => {
      const opt = document.createElement('option');
      opt.value = scene;
      opt.textContent = scene;
      fieldContentTypeContent.appendChild(opt);
    });
    // 如果之前选中的值仍然存在，保持选中
    if (scenes.includes(prevValue)) {
      fieldContentTypeContent.value = prevValue;
    } else {
      fieldContentTypeContent.value = '';
    }
  }
  
  // 更新 importAccountCategorySelectContent（批量导入模态框中的账号分类）
  const importAccountCategorySelectContent = document.getElementById('importAccountCategorySelectContent');
  if (importAccountCategorySelectContent) {
    const prevValue = importAccountCategorySelectContent.value;
    importAccountCategorySelectContent.innerHTML = '<option value="">账号分类</option>';
    scenes.forEach((scene) => {
      const opt = document.createElement('option');
      opt.value = scene;
      opt.textContent = scene;
      importAccountCategorySelectContent.appendChild(opt);
    });
    // 如果之前选中的值仍然存在，保持选中
    if (scenes.includes(prevValue)) {
      importAccountCategorySelectContent.value = prevValue;
    } else {
      importAccountCategorySelectContent.value = '';
    }
  }
}

function bindImportModal() {
  const btnClose = document.getElementById('btnCloseImportContent');
  const btnCancel = document.getElementById('btnCancelImportContent');
  const btnRun = document.getElementById('btnRunImportContent');
  if (btnClose) btnClose.addEventListener('click', closeImportModal);
  if (btnCancel) btnCancel.addEventListener('click', closeImportModal);
  if (btnRun) btnRun.addEventListener('click', runImport);
}

function openImportModal() {
  const modal = document.getElementById('importModalContent');
  if (!modal) return;
  const rawInput = document.getElementById('importRawInputContent');
  if (rawInput) rawInput.value = '';
  const sel = document.getElementById('importCategorySelectContent');
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
  
  // 刷新账号分类下拉菜单
  refreshSceneSelects();
  
  modal.classList.remove('hidden');
}

function closeImportModal() {
  const modal = document.getElementById('importModalContent');
  if (!modal) return;
  modal.classList.add('hidden');
}

async function runImport() {
  const rawInput = document.getElementById('importRawInputContent');
  if (!rawInput) return;
  const raw = rawInput.value || '';
  const lines = raw.split('\n').map((s) => stripLeadingIndex(s).trim()).filter(Boolean);
  if (!lines.length) { showToast('没有可导入的内容', 'error'); return; }
  if (!supabase) { showToast('未配置 Supabase，无法导入云端', 'error'); return; }
  const importCategorySelectContent = document.getElementById('importCategorySelectContent');
  const importAccountCategorySelectContent = document.getElementById('importAccountCategorySelectContent');
  const mainCategory = importCategorySelectContent && importCategorySelectContent.value ? importCategorySelectContent.value : null;
  const accountCategory = importAccountCategorySelectContent && importAccountCategorySelectContent.value ? importAccountCategorySelectContent.value : null;
  
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
  console.log('[ContentApp] 批量导入 rows =', rows, 'mainCategory =', mainCategory, 'accountCategory =', accountCategory);
  try {
    const { error } = await supabase.from('contents').insert(rows);
    if (error) throw error;
    showToast(`批量导入成功，共 ${rows.length} 条`);
    closeImportModal();
    await loadContentsFromCloud();
    dispatchDataChanged({ scope: 'contents', target: 'content', action: 'import' });
  } catch (e) {
    showToast('云端导入失败', 'error');
  }
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
        console.error('[ContentApp] 立即同步失败', err);
        setAutoSyncStatus({ status: 'error', message: err.message });
        showToast('同步失败，请稍后再试', 'error');
      }
    });
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
        await loadContentsFromCloud();
        showToast('已从云端刷新');
        setAutoSyncStatus({ status: 'synced' });
      } catch (err) {
        console.error('[ContentApp] 立即拉取失败', err);
        setAutoSyncStatus({ status: 'error', message: err.message });
        showToast('拉取失败，请稍后重试', 'error');
      }
    });
  }
}

function bindGlobalNavButtons() {
  const btnSettings = document.getElementById('btnSettings');
  const btnManage = document.getElementById('btnManagePage');
  if (btnSettings) btnSettings.addEventListener('click', () => { window.location.href = 'settings.html'; });
  if (btnManage) btnManage.addEventListener('click', () => { window.location.href = 'admin-center.html'; });
}

async function renderCloudHistoryList(anchorBtn) {
  if (!window.snapshotService) { alert('未配置 Supabase'); return; }
  const panel = document.getElementById('cloudHistoryPanel');
  if (!panel) return;
  panel.classList.remove('hidden');
  panel.style.display = 'block';
  panel.innerHTML = '<div style="padding:8px 10px;font-size:12px;color:#6b7280;">加载中…</div>';
  const rect = anchorBtn.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  let left = rect.left + scrollLeft;
  const top = rect.bottom + scrollTop + 8;
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
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
      panel.innerHTML = '<div style="padding:8px 10px;font-size:12px;color:#6b7280;">暂无快照</div>';
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
        openCloudLoadConfirmContent(key);
        panel.classList.add('hidden');
        panel.style.display = 'none';
      });
    });
  } catch (e) {
    panel.innerHTML = '<div style="padding:8px 10px;color:#f43f5e;">加载云端快照失败</div>';
  }
}

function toggleCloudHistoryPanel() {
  const panel = document.getElementById('cloudHistoryPanel');
  const btn = document.getElementById('btnLoadCloud');
  if (!panel || !btn) return;
  if (!panel.classList.contains('hidden')) {
    panel.classList.add('hidden');
    panel.style.display = 'none';
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
  if (btn && (btn === target || btn.contains(target))) return;
  if (panel.contains(target)) return;
  panel.classList.add('hidden');
  panel.style.display = 'none';
});

window.openContentModal = openContentModal;
window.openImportModal = openImportModal;
window.bindContentModal = bindContentModal;
window.bindImportModal = bindImportModal;

function openCloudLabelModal() {
  const modal = document.getElementById('cloudLabelModal');
  const input = document.getElementById('cloudLabelInput');
  const btnClose = document.getElementById('btnCloseCloudLabel');
  const btnCancel = document.getElementById('btnCancelCloudLabel');
  const btnSave = document.getElementById('btnSaveCloudLabel');
  if (!modal || !input || !btnClose || !btnCancel || !btnSave) return;
  modal.classList.remove('hidden');
  
  // 生成默认值：用户名+年月日时间
  const user = getCurrentUser();
  const username = user ? user.username : 'user';
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const defaultLabel = `${username}${year}${month}${day}`;
  input.value = defaultLabel;
  
  // 选中所有文本以便用户直接输入
  setTimeout(() => {
    input.focus();
    input.select();
  }, 100);
  const close = () => { modal.classList.add('hidden'); };
  btnClose.onclick = close;
  btnCancel.onclick = close;
  btnSave.onclick = async () => {
    if (!window.snapshotService) { alert('未配置 Supabase'); return; }
    const label = input.value.trim();
    try {
      const info = await window.snapshotService.saveUnifiedSnapshotFromCloud(label);
      close();
      showToast(`已保存：标题 ${info.titleCount} 条 文案 ${info.contentCount} 条 ${info.updatedText}`);
    } catch (e) {
      alert('保存快照失败：' + (e.message || 'Unknown error'));
    }
  };
}

function openClearConfirmModal() {
  const modal = document.getElementById('clearConfirmModal');
  const btnClose = document.getElementById('btnCloseClearConfirm');
  const btnCancel = document.getElementById('btnCancelClear');
  const btnConfirm = document.getElementById('btnConfirmClear');
  if (!modal || !btnClose || !btnCancel || !btnConfirm) return;
  modal.classList.remove('hidden');
  const close = () => { modal.classList.add('hidden'); };
  btnClose.onclick = close;
  btnCancel.onclick = close;
  btnConfirm.onclick = async () => {
    if (!supabase) { showToast('Supabase 未配置，无法清空云端', 'error'); return; }
    try {
      const { error } = await supabase.from('contents').delete().not('id', 'is', null);
      if (error) throw error;
      state.contents = [];
      renderContents();
      showToast('已清空全部文案');
      dispatchDataChanged({ scope: 'contents', target: 'content', action: 'clear_all' });
    } catch (e) {
      showToast('清空失败：' + (e.message || ''), 'error');
    } finally {
      close();
    }
  };
}

async function deleteContent(item) {
  state.contents = state.contents.filter((t) => t.id !== item.id);
  renderContents();
  // 刷新场景下拉列表，更新数据条数
  refreshSceneSelects();
  dispatchDataChanged('contents');
  if (!supabase || !item.id) return;
  try {
    await supabase.from('contents').delete().eq('id', item.id);
    showToast('已删除');
  } catch (_) {
    showToast('删除失败（云端）', 'error');
  }
  dispatchDataChanged({ scope: 'contents', target: 'content', action: 'delete' });
}

let pendingDeleteContent = null;
function openDeleteContentModal(item) {
  const modal = document.getElementById('deleteContentModal');
  const btnClose = document.getElementById('btnCloseDeleteContent');
  const btnCancel = document.getElementById('btnCancelDeleteContent');
  const btnConfirm = document.getElementById('btnConfirmDeleteContent');
  const previewEl = document.getElementById('deleteContentPreview');
  if (!modal || !btnClose || !btnCancel || !btnConfirm) return;
  pendingDeleteContent = item;
  if (previewEl) previewEl.textContent = (item.text || '').slice(0, 80);
  modal.classList.remove('hidden');
  const close = () => { modal.classList.add('hidden'); pendingDeleteContent = null; };
  btnClose.onclick = close;
  btnCancel.onclick = close;
  btnConfirm.onclick = () => {
    if (pendingDeleteContent) deleteContent(pendingDeleteContent);
    close();
  };
}

function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.background = type === 'error' ? 'rgba(220,38,38,0.92)' : 'rgba(17,24,39,0.92)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.add('hidden'); }, 1800);
}

// =============== 暴露给 Realtime 回调使用 ===============
window.loadCategoriesFromDatabase = loadCategoriesFromDatabase;
window.loadAccountCategoriesFromDatabase = loadAccountCategoriesFromDatabase;
window.refreshSceneSelects = refreshSceneSelects;
