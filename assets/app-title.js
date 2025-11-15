// assets/app-title.js
// 标题管理主逻辑（桌面表格 + 手机卡片 + 云端快照）

console.log('[TitleApp] app-title.js loaded');

// =============== 0. 全局常量 & 状态 ===============

const supabase = window.supabaseClient || null;

const DEFAULT_CATEGORIES = ['全部', '亲子', '情侣', '闺蜜', '单人', '烟花', '夜景'];
const CATEGORY_LS_KEY = 'title_categories_v1';

const SNAPSHOT_TABLE = 'title_snapshots';
const SNAPSHOT_DEFAULT_KEY = 'default'; // 占位快照 key（不在列表里显示）

const state = {
  titles: [],                 // 当前所有标题记录（来自 Supabase.titles）
  categories: [...DEFAULT_CATEGORIES],
  currentCategory: '全部',
  filters: {
    search: '',
    scene: ''
  },
  editingId: null,            // 当前弹窗编辑的 id（null = 新增）
  viewSettings: {},           // 预留
  isSortingCategories: false  // 分类是否处在“排序模式”
};

let toastTimer = null;

// =============== 1. 初始化入口 ===============

document.addEventListener('DOMContentLoaded', () => {
  console.log('[TitleApp] DOMContentLoaded: init');

  // 分类
  loadCategoriesFromLocal();
  renderCategoryList();
  bindCategoryButtons();
  setupMobileCategoryDropdown();

  // 工具栏 / 弹窗 / 云端 / 全局按钮
  bindToolbar();
  bindTitleModal();
  bindImportModal();
  bindCloudButtons();
  bindGlobalNavButtons();

  if (!supabase) {
    console.warn('[TitleApp] supabaseClient 不存在，云端功能不可用');
  } else {
    console.log('[TitleApp] supabaseClient 已就绪');
  }

  // 初始从云端加载一遍 titles
  loadTitlesFromCloud();
});

// =============== 2. 分类逻辑 ===============

function loadCategoriesFromLocal() {
  const raw = localStorage.getItem(CATEGORY_LS_KEY);
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
  localStorage.setItem(CATEGORY_LS_KEY, JSON.stringify(state.categories));
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

    const nameSpan = document.createElement('span');
    // 计算该分类下的条数（“全部”=所有条数）
    const count =
      cat === '全部'
        ? state.titles.length
        : state.titles.filter((t) => t.main_category === cat).length;
    nameSpan.textContent = `${cat} ${count}条`;
    li.appendChild(nameSpan);

    // 排序模式：给非“全部”增加 ↑↓ 按钮
    if (state.isSortingCategories && cat !== '全部') {
      const controls = document.createElement('span');
      controls.style.marginLeft = '8px';

      const btnUp = document.createElement('button');
      btnUp.type = 'button';
      btnUp.textContent = '↑';
      btnUp.className = 'function-btn ghost text-xs btn-inline';
      btnUp.style.paddingInline = '6px';
      btnUp.addEventListener('click', (e) => {
        e.stopPropagation();
        reorderCategory(index, -1);
      });

      const btnDown = document.createElement('button');
      btnDown.type = 'button';
      btnDown.textContent = '↓';
      btnDown.className = 'function-btn ghost text-xs btn-inline';
      btnDown.style.marginLeft = '4px';
      btnDown.style.paddingInline = '6px';
      btnDown.addEventListener('click', (e) => {
        e.stopPropagation();
        reorderCategory(index, 1);
      });

      controls.appendChild(btnUp);
      controls.appendChild(btnDown);
      li.appendChild(controls);
    }

    // 普通点击：切换当前分类
    li.addEventListener('click', () => {
      state.currentCategory = cat;
      renderCategoryList();
      renderTitles();
    });

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

  // 🔍 搜索 + 「清除」按钮
  if (searchInput) {
    const syncClearBtn = () => {
      if (!btnClearSearch) return;
      btnClearSearch.style.display = searchInput.value ? 'inline-flex' : 'none';
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

  // 🗑 清空全部：先云端删，成功才清本地
  if (btnClearAll) {
    btnClearAll.addEventListener('click', async () => {
      if (!confirm('确定清空全部标题？此操作不可恢复')) return;
      if (!supabase) {
        showToast('Supabase 未配置，无法清空云端', 'error');
        return;
      }
      try {
        // 用 not('id','is',null) 避免 uuid 比较 "null" 报错
        const { error } = await supabase
          .from('titles')
          .delete()
          .not('id', 'is', null);

        if (error) throw error;

        state.titles = [];
        renderTitles();
        showToast('已清空全部标题');
      } catch (e) {
        console.error('[TitleApp] 清空全部失败', e);
        showToast('清空失败： ' + (e.message || ''), 'error');
      }
    });
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
      // 按 created_at 正序：旧的在上，新插入在后面，保持“1、2、3…”顺序不变
      .order('created_at', { ascending: true });

    if (error) throw error;
    state.titles = data || [];
    console.log('[TitleApp] 从云端加载标题条数：', state.titles.length);
    // 更新分类统计数量
    renderCategoryList();
    renderTitles();
  } catch (e) {
    console.error('[TitleApp] loadTitlesFromCloud error', e);
    showToast('加载标题失败', 'error');
  }
}

function applyFilters(list) {
  const cat = state.currentCategory;
  const q = state.filters.search.toLowerCase();
  const scene = state.filters.scene;

  return list.filter((item) => {
    if (cat !== '全部' && item.main_category !== cat) return false;

    if (q && !(item.text || '').toLowerCase().includes(q)) return false;

    if (scene) {
      const tags = Array.isArray(item.scene_tags) ? item.scene_tags : [];
      if (!tags.includes(scene)) return false;
    }

    return true;
  });
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
    tdIndex.textContent = index + 1;
    tr.appendChild(tdIndex);

    const tdText = document.createElement('td');
    tdText.textContent = item.text || '';
    tr.appendChild(tdText);

    const tdCat = document.createElement('td');
    tdCat.textContent = item.main_category || '';
    tr.appendChild(tdCat);

    const tdActions = document.createElement('td');
    tdActions.className = 'actions-cell';

    const group = document.createElement('div');
    group.className = 'action-group';

    const btnCopy = document.createElement('button');
    btnCopy.className = 'function-btn ghost text-xs btn-inline';
    btnCopy.textContent = '复制';
    btnCopy.addEventListener('click', () => copyTitle(item));

    const btnEdit = document.createElement('button');
    btnEdit.className = 'function-btn ghost text-xs btn-inline';
    btnEdit.textContent = '修改';
    btnEdit.addEventListener('click', () => openTitleModal(item));

    const btnDel = document.createElement('button');
    btnDel.className = 'function-btn ghost text-xs btn-inline';
    btnDel.textContent = '删除';
    btnDel.addEventListener('click', () => deleteTitle(item));

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
    cTitle.className = 'text-sm font-medium flex-1 min-w-0';
    cTitle.textContent = item.text || '';

    const actions = document.createElement('div');
    actions.className = 'flex gap-2 flex-shrink-0';

    const mCopy = document.createElement('button');
    mCopy.className = 'function-btn ghost text-xs btn-inline';
    mCopy.textContent = '复制';
    mCopy.addEventListener('click', () => copyTitle(item));

    const mEdit = document.createElement('button');
    mEdit.className = 'function-btn ghost text-xs btn-inline';
    mEdit.textContent = '修改';
    mEdit.addEventListener('click', () => openTitleModal(item));

    const mDel = document.createElement('button');
    mDel.className = 'function-btn ghost text-xs btn-inline';
    mDel.textContent = '删除';
    mDel.addEventListener('click', () => deleteTitle(item));

    actions.append(mCopy, mEdit, mDel);
    headerRow.append(cTitle, actions);

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
  try {
    await navigator.clipboard.writeText(item.text || '');
    showToast('已复制');
  } catch (e) {
    console.error('[TitleApp] 复制失败', e);
    showToast('复制失败', 'error');
  }

  if (!supabase || !item.id) return;

  try {
    await supabase
      .from('titles')
      .update({ usage_count: (item.usage_count || 0) + 1 })
      .eq('id', item.id);
    await loadTitlesFromCloud();
  } catch (e) {
    console.error('[TitleApp] 更新 usage_count 失败', e);
  }
}

async function deleteTitle(item) {
  if (!confirm('确定删除该标题？')) return;

  state.titles = state.titles.filter((t) => t.id !== item.id);
  renderTitles();

  if (!supabase || !item.id) return;

  try {
    await supabase.from('titles').delete().eq('id', item.id);
    showToast('已删除');
  } catch (e) {
    console.error('[TitleApp] 删除失败', e);
    showToast('删除失败（云端）', 'error');
  }
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

  // 初始化弹窗下拉分类选项
  refreshModalCategoryOptions(mainCatEl);

  if (item && item.id) {
    state.editingId = item.id;
    if (titleEl) titleEl.textContent = '修改标题';
    if (textEl) textEl.value = item.text || '';
    if (mainCatEl) mainCatEl.value = item.main_category || '';
    if (typeEl) typeEl.value = item.content_type || '';
    if (sceneEl)
      sceneEl.value = Array.isArray(item.scene_tags)
        ? item.scene_tags.join(', ')
        : '';
  } else {
    state.editingId = null;
    if (titleEl) titleEl.textContent = '新增标题';
    if (textEl) textEl.value = '';
    if (mainCatEl) mainCatEl.value = state.currentCategory === '全部' ? '' : state.currentCategory;
    if (typeEl) typeEl.value = '';
    if (sceneEl) sceneEl.value = '';
  }

  modal.classList.remove('hidden');
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
  emptyOpt.textContent = '未选择';
  selectEl.appendChild(emptyOpt);

  cats.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    selectEl.appendChild(opt);
  });
}

async function saveTitleFromModal() {
  const textEl = document.getElementById('fieldText');
  const mainCatEl = document.getElementById('fieldMainCategory');
  const typeEl = document.getElementById('fieldContentType');
  const sceneEl = document.getElementById('fieldSceneTags');

  const text = (textEl?.value || '').trim();
  if (!text) {
    showToast('标题内容不能为空', 'error');
    return;
  }

  const main_category = mainCatEl?.value || '';
  const content_type = typeEl?.value || '';
  const sceneTagsStr = sceneEl?.value || '';
  const scene_tags = sceneTagsStr
    ? sceneTagsStr
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  if (!supabase) {
    showToast('Supabase 未配置，无法保存', 'error');
    return;
  }

  try {
    if (state.editingId) {
      const { error } = await supabase
        .from('titles')
        .update({
          text,
          main_category,
          content_type,
          scene_tags
        })
        .eq('id', state.editingId);
      if (error) throw error;
      showToast('已更新标题');
    } else {
      const { error } = await supabase.from('titles').insert([
        {
          text,
          main_category,
          content_type,
          scene_tags,
          usage_count: 0
        }
      ]);
      if (error) throw error;
      showToast('已新增标题');
    }

    closeTitleModal();
    await loadTitlesFromCloud();
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

  modal.classList.remove('hidden');
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
    .map((s) => s.trim())
    .filter(Boolean);

  if (!lines.length) {
    showToast('没有可导入的内容', 'error');
    return;
  }

  if (!supabase) {
    showToast('Supabase 未配置，无法导入', 'error');
    return;
  }

  try {
    const rows = lines.map((text) => ({
      text,
      main_category: state.currentCategory === '全部' ? '' : state.currentCategory,
      content_type: '',
      scene_tags: [],
      usage_count: 0
    }));

    const { error } = await supabase.from('titles').insert(rows);
    if (error) throw error;

    showToast(`已导入 ${rows.length} 条标题`);
    closeImportModal();
    await loadTitlesFromCloud();
  } catch (e) {
    console.error('[TitleApp] 批量导入失败', e);
    showToast('导入失败：' + (e.message || ''), 'error');
  }
}

// =============== 8. 云端快照按钮（占位，可按需扩展） ===============

function bindCloudButtons() {
  const btnSaveCloud = document.getElementById('btnSaveCloud');
  const btnLoadCloud = document.getElementById('btnLoadCloud');

  if (btnSaveCloud) {
    btnSaveCloud.addEventListener('click', () => {
      showToast('当前版本仅提供标题保存 / 加载（titles 表），快照功能待扩展');
    });
  }

  if (btnLoadCloud) {
    btnLoadCloud.addEventListener('click', async () => {
      await loadTitlesFromCloud();
      showToast('已从云端刷新标题列表');
    });
  }
}

// =============== 9. 顶部「管理页面」等跳转 ===============

function bindGlobalNavButtons() {
  const btnManagePage = document.getElementById('btnManagePage');
  const btnSettings = document.getElementById('btnSettings');

  if (btnManagePage) {
    btnManagePage.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      window.location.href = 'index.html#settings';
    });
  }
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
