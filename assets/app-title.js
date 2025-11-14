// assets/app-title.js

// 默认分类
const DEFAULT_CATEGORIES = [
  '全部',
  '亲子',
  '情侣',
  '闺蜜',
  '单人',
  '烟花',
  '夜景'
];

// 分类持久化 key（沿用之前的 titleCategories）
const CATEGORY_LS_KEY = 'titleCategories';

// 全局状态
let state = {
  categories: [...DEFAULT_CATEGORIES],
  currentCategory: '全部',
  titles: [],
  filters: {
    search: '',
    contentType: '',
    scene: ''
  },
  editingId: null
};

let toastTimer = null;

// 入口
document.addEventListener('DOMContentLoaded', () => {
  loadCategoriesFromStorage();
  initCategoryList();

  bindToolbarEvents();
  bindExtraActions();
  bindCategoryButton();
  bindCategoryDeleteButton();
  bindModalEvents();
  bindImportEvents();

  loadTitles();
});

/* ========== 工具：统一获取 supabaseClient ========== */

function getDb() {
  if (typeof supabaseClient === 'undefined' || !supabaseClient) {
    console.error('supabaseClient 未定义，请检查 supabase.js');
    showToast('Supabase 未初始化', 'error');
    return null;
  }
  return supabaseClient;
}

/* ========== 分类持久化 ========== */

function loadCategoriesFromStorage() {
  try {
    const raw = localStorage.getItem(CATEGORY_LS_KEY);
    if (!raw) {
      state.categories = [...DEFAULT_CATEGORIES];
      return;
    }
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) {
      state.categories = [...DEFAULT_CATEGORIES];
      return;
    }
    // 确保「全部」一直在第一个
    const set = new Set(arr);
    set.delete('全部');
    state.categories = ['全部', ...Array.from(set)];
  } catch (e) {
    console.error('读取分类失败，使用默认分类:', e);
    state.categories = [...DEFAULT_CATEGORIES];
  }
}

function saveCategoriesToStorage() {
  try {
    localStorage.setItem(CATEGORY_LS_KEY, JSON.stringify(state.categories));
  } catch (e) {
    console.error('保存分类失败:', e);
  }
}

/* ========== 分类列表渲染 ========== */

function initCategoryList() {
  const list = document.getElementById('categoryList');
  if (!list) {
    console.error('找不到 #categoryList');
    return;
  }
  list.innerHTML = '';

  state.categories.forEach((name) => {
    const li = document.createElement('li');
    li.className =
      'category-item' + (name === state.currentCategory ? ' active' : '');
    li.textContent = name;
    li.dataset.cat = name;
    li.addEventListener('click', () => {
      state.currentCategory = name;
      document
        .querySelectorAll('.category-item')
        .forEach((el) => el.classList.remove('active'));
      li.classList.add('active');
      renderTitles();
    });
    list.appendChild(li);
  });
}

/* ========== 新增 / 删除分类按钮 ========== */

function bindCategoryButton() {
  const btnAddCategory = document.getElementById('btnAddCategory');
  if (!btnAddCategory) return;

  btnAddCategory.addEventListener('click', () => {
    const name = prompt('请输入新分类名称（例如：港迪城堡 / 烟花 / 夜景）：');
    if (!name) return;

    const trimmed = name.trim();
    if (!trimmed) return;

    if (trimmed === '全部') {
      showToast('不能使用“全部”作为分类名', 'error');
      return;
    }
    if (state.categories.includes(trimmed)) {
      showToast('该分类已存在', 'error');
      return;
    }

    state.categories.push(trimmed);
    saveCategoriesToStorage();
    initCategoryList();
    showToast('已新增分类：' + trimmed);
  });
}

function bindCategoryDeleteButton() {
  const btnDeleteCategory = document.getElementById('btnDeleteCategory');
  if (!btnDeleteCategory) return;

  btnDeleteCategory.addEventListener('click', async () => {
    const current = state.currentCategory;
    if (current === '全部') {
      showToast('不能删除“全部”分类', 'error');
      return;
    }
    if (!state.categories.includes(current)) {
      showToast('当前分类不存在', 'error');
      return;
    }

    const ok = confirm(
      `确定要删除分类「${current}」吗？\n该分类下的标题主分类将被清空，但标题本身不会删除。`
    );
    if (!ok) return;

    // 先本地删分类
    state.categories = state.categories.filter((c) => c !== current);
    saveCategoriesToStorage();
    state.currentCategory = '全部';
    initCategoryList();

    // 同步到 Supabase：把这个分类的 main_category 清空
    const db = getDb();
    if (!db) return;

    try {
      const { error } = await db
        .from('titles')
        .update({ main_category: null })
        .eq('main_category', current);

      if (error) {
        console.error('清空 main_category 失败:', error);
        showToast('删除分类成功，但云端更新失败', 'error');
      } else {
        showToast('分类已删除');
        await loadTitles();
      }
    } catch (e) {
      console.error(e);
      showToast('删除分类时发生异常', 'error');
    }
  });
}

/* ========== 顶部工具栏（搜索、筛选、按钮） ========== */

function bindToolbarEvents() {
  const searchInput = document.getElementById('searchInput');
  const filterContentType = document.getElementById('filterContentType');
  const filterScene = document.getElementById('filterScene');
  const btnNewTitle = document.getElementById('btnNewTitle');
  const btnBatchImport = document.getElementById('btnBatchImport');

  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.filters.search = e.target.value.trim();
        renderTitles();
      }, 250);
    });
  }

  if (filterContentType) {
    filterContentType.addEventListener('change', (e) => {
      state.filters.contentType = e.target.value;
      renderTitles();
    });
  }

  if (filterScene) {
    filterScene.addEventListener('change', (e) => {
      state.filters.scene = e.target.value;
      renderTitles();
    });
  }

  if (btnNewTitle) {
    btnNewTitle.addEventListener('click', () => openTitleModal());
  }

  if (btnBatchImport) {
    btnBatchImport.addEventListener('click', openImportModal);
  }
}

/* 顶部五个按钮 */

function bindExtraActions() {
  const btnClearAll = document.getElementById('btnClearAll');
  const btnSettings = document.getElementById('btnSettings');
  const btnSaveCloud = document.getElementById('btnSaveCloud');
  const btnLoadCloud = document.getElementById('btnLoadCloud');
  const btnManagePage = document.getElementById('btnManagePage');

  if (btnClearAll) {
    btnClearAll.addEventListener('click', async () => {
      const db = getDb();
      if (!db) return;

      const ok = confirm('确定要清空所有标题吗？此操作会删除 Supabase 中的全部记录。');
      if (!ok) return;

      try {
        const { error } = await db.from('titles').delete().neq('id', null);
        if (error) {
          console.error(error);
          showToast('清空失败：' + error.message, 'error');
          return;
        }
        state.titles = [];
        renderTitles();
        showToast('已清空全部标题');
      } catch (e) {
        console.error(e);
        showToast('清空失败（前端异常）', 'error');
      }
    });
  }

  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      // 设置中心占位页面
      window.location.href = 'settings.html';
    });
  }

  if (btnSaveCloud) {
    btnSaveCloud.addEventListener('click', () => {
      // 当前架构本身就是实时写 Supabase，这里给一个明确提示
      showToast('当前所有修改已实时保存到 Supabase');
    });
  }

  if (btnLoadCloud) {
    btnLoadCloud.addEventListener('click', () => {
      loadTitles(true);
    });
  }

  if (btnManagePage) {
    btnManagePage.addEventListener('click', () => {
      // 管理中心占位页面
      window.location.href = 'admin-center.html';
    });
  }
}

/* ========== 从 Supabase 加载标题 ========== */

async function loadTitles(showToastAfter = false) {
  const db = getDb();
  if (!db) return;

  try {
    const { data, error } = await db
      .from('titles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('加载 titles 失败:', error);
      showToast('加载标题失败：' + error.message, 'error');
      return;
    }

    state.titles = data || [];
    renderTitles();

    if (showToastAfter) {
      showToast('已从云端加载最新数据');
    }
  } catch (e) {
    console.error('loadTitles 异常:', e);
    showToast('加载标题异常', 'error');
  }
}

/* ========== 渲染 & 过滤 ========== */

function applyFilters(items) {
  const { currentCategory, filters } = state;
  const { search, contentType, scene } = filters;
  const q = (search || '').toLowerCase();

  return items.filter((item) => {
    if (currentCategory !== '全部' && item.main_category !== currentCategory) {
      return false;
    }

    if (contentType && item.content_type !== contentType) {
      return false;
    }

    if (scene) {
      const tags = item.scene_tags || [];
      if (!Array.isArray(tags) || !tags.includes(scene)) return false;
    }

    if (q) {
      const text = (item.text || '').toLowerCase();
      const kw = JSON.stringify(item.keywords || []).toLowerCase();
      if (!text.includes(q) && !kw.includes(q)) return false;
    }

    return true;
  });
}

function renderTitles() {
  const tbody = document.getElementById('titleTableBody');
  const mobileList = document.getElementById('mobileList');

  if (!tbody || !mobileList) {
    console.error('找不到 #titleTableBody 或 #mobileList');
    return;
  }

  tbody.innerHTML = '';
  mobileList.innerHTML = '';

  const items = applyFilters(state.titles);

  items.forEach((item, idx) => {
    // 桌面表格
    const tr = document.createElement('tr');

    const tdIndex = document.createElement('td');
    tdIndex.textContent = idx + 1;
    tr.appendChild(tdIndex);

    const tdText = document.createElement('td');
    tdText.textContent = item.text;
    tr.appendChild(tdText);

    const tdMain = document.createElement('td');
    tdMain.textContent = item.main_category || '';
    tr.appendChild(tdMain);

    const tdScene = document.createElement('td');
    tdScene.textContent = Array.isArray(item.scene_tags)
      ? item.scene_tags.join(', ')
      : '';
    tr.appendChild(tdScene);

    const tdType = document.createElement('td');
    tdType.textContent = item.content_type || '';
    tr.appendChild(tdType);

    const tdUsage = document.createElement('td');
    tdUsage.textContent = item.usage_count || 0;
    tr.appendChild(tdUsage);

    const tdActions = document.createElement('td');
    tdActions.className = 'actions-cell';

    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'action-group';

    const btnCopy = document.createElement('button');
    btnCopy.className = 'function-btn ghost text-xs';
    btnCopy.textContent = '复制';
    btnCopy.addEventListener('click', () => copyTitle(item));

    const btnEdit = document.createElement('button');
    btnEdit.className = 'function-btn ghost text-xs';
    btnEdit.textContent = '修改';
    btnEdit.addEventListener('click', () => openTitleModal(item));

    const btnDel = document.createElement('button');
    btnDel.className = 'function-btn ghost text-xs';
    btnDel.textContent = '删除';
    btnDel.addEventListener('click', () => deleteTitleRow(item));

    actionsWrap.append(btnCopy, btnEdit, btnDel);
    tdActions.appendChild(actionsWrap);
    tr.appendChild(tdActions);

    tbody.appendChild(tr);

    // 移动端卡片
    const card = document.createElement('div');
    card.className = 'panel mobile-card';

    const t = document.createElement('div');
    t.className = 'text-sm font-medium mb-1';
    t.textContent = item.text;
    card.appendChild(t);

    const meta = document.createElement('div');
    meta.className = 'text-xs text-gray-500 flex flex-wrap gap-2';
    meta.innerHTML = `
      <span>[${item.main_category || '未分类'}]</span>
      <span>${Array.isArray(item.scene_tags) ? item.scene_tags.join(', ') : ''}</span>
      <span>${item.content_type || ''}</span>
      <span>使用 ${item.usage_count || 0}</span>
    `;
    card.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'mt-2 flex gap-2';

    const mCopy = document.createElement('button');
    mCopy.className = 'function-btn ghost text-xs';
    mCopy.textContent = '复制';
    mCopy.addEventListener('click', () => copyTitle(item));

    const mEdit = document.createElement('button');
    mEdit.className = 'function-btn ghost text-xs';
    mEdit.textContent = '修改';
    mEdit.addEventListener('click', () => openTitleModal(item));

    const mDel = document.createElement('button');
    mDel.className = 'function-btn ghost text-xs';
    mDel.textContent = '删除';
    mDel.addEventListener('click', () => deleteTitleRow(item));

    actions.append(mCopy, mEdit, mDel);
    card.appendChild(actions);

    mobileList.appendChild(card);
  });
}

/* ========== 复制 / 删除 ========== */

async function copyTitle(item) {
  try {
    await navigator.clipboard.writeText(item.text || '');
    showToast('标题已复制');
  } catch (e) {
    console.error(e);
    showToast('复制失败', 'error');
  }

  const db = getDb();
  if (!db) return;

  try {
    const { error } = await db
      .from('titles')
      .update({ usage_count: (item.usage_count || 0) + 1 })
      .eq('id', item.id);

    if (error) {
      console.error('更新 usage_count 失败:', error);
    } else {
      await loadTitles();
    }
  } catch (e) {
    console.error(e);
  }
}

async function deleteTitleRow(item) {
  if (!confirm('确认删除这条标题？')) return;

  const db = getDb();
  if (!db) return;

  try {
    const { error } = await db.from('titles').delete().eq('id', item.id);
    if (error) {
      console.error('删除失败:', error);
      showToast('删除失败：' + error.message, 'error');
      return;
    }
    showToast('已删除');
    state.titles = state.titles.filter((x) => x.id !== item.id);
    renderTitles();
  } catch (e) {
    console.error(e);
    showToast('删除失败', 'error');
  }
}

/* ========== 弹窗：新增 / 修改 ========== */

function bindModalEvents() {
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnCancelModal = document.getElementById('btnCancelModal');
  const btnSaveTitle = document.getElementById('btnSaveTitle');

  if (btnCloseModal) btnCloseModal.addEventListener('click', closeTitleModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeTitleModal);
  if (btnSaveTitle) btnSaveTitle.addEventListener('click', saveTitleFromModal);
}

function openTitleModal(item) {
  const modal = document.getElementById('titleModal');
  const title = document.getElementById('titleModalTitle');
  const fieldText = document.getElementById('fieldText');
  const fieldCat = document.getElementById('fieldMainCategory');
  const fieldType = document.getElementById('fieldContentType');
  const fieldScene = document.getElementById('fieldSceneTags');

  if (!modal || !title || !fieldText || !fieldCat || !fieldType || !fieldScene) {
    console.error('标题弹窗相关元素缺失');
    return;
  }

  // 填充分类下拉（不含“全部”）
  fieldCat.innerHTML = '';
  state.categories
    .filter((c) => c !== '全部')
    .forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      fieldCat.appendChild(opt);
    });

  if (item) {
    state.editingId = item.id;
    title.textContent = '修改标题';
    fieldText.value = item.text || '';
    fieldCat.value = item.main_category || '';
    fieldType.value = item.content_type || '';
    fieldScene.value = Array.isArray(item.scene_tags)
      ? item.scene_tags.join(', ')
      : '';
  } else {
    state.editingId = null;
    title.textContent = '新增标题';
    fieldText.value = '';
    fieldCat.value =
      state.currentCategory !== '全部' ? state.currentCategory : '';
    fieldType.value = '';
    fieldScene.value = '';
  }

  modal.classList.remove('hidden');
  modal.style.display = 'flex';

  if (window.gsap) {
    const box = modal.querySelector('.modal');
    if (box) {
      gsap.fromTo(
        box,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.2 }
      );
    }
  }
}

function closeTitleModal() {
  const modal = document.getElementById('titleModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.style.display = 'none';
}

async function saveTitleFromModal() {
  const fieldText = document.getElementById('fieldText');
  const fieldCat = document.getElementById('fieldMainCategory');
  const fieldType = document.getElementById('fieldContentType');
  const fieldScene = document.getElementById('fieldSceneTags');

  if (!fieldText || !fieldCat || !fieldType || !fieldScene) {
    showToast('保存失败：表单元素缺失', 'error');
    return;
  }

  const text = fieldText.value.trim();
  const mainCategory = fieldCat.value || null;
  const contentType = fieldType.value || null;
  const sceneRaw = fieldScene.value.trim();

  if (!text) {
    showToast('标题不能为空', 'error');
    return;
  }

  // 场景标签处理
  const sceneTags =
    sceneRaw.length > 0
      ? sceneRaw
          .split(/[，,、]/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const payload = {
    text,
    main_category: mainCategory,
    content_type: contentType,
    scene_tags: sceneTags,
    keywords: [],
  };

  const db = getDb();
  if (!db) return;

  try {
    let error;
    if (state.editingId) {
      const res = await db
        .from('titles')
        .update(payload)
        .eq('id', state.editingId);
      error = res.error;
    } else {
      const res = await db.from('titles').insert(payload);
      error = res.error;
    }

    if (error) {
      console.error('保存标题失败:', error);
      showToast('保存失败：' + error.message, 'error');
      return;
    }

    showToast('已保存');
    closeTitleModal();
    await loadTitles();
  } catch (err) {
    console.error('saveTitleFromModal 异常:', err);
    showToast('保存异常', 'error');
  }
}

/* ========== 批量导入 ========== */

function bindImportEvents() {
  const btnCloseImport = document.getElementById('btnCloseImport');
  const btnCancelImport = document.getElementById('btnCancelImport');
  const btnRunImport = document.getElementById('btnRunImport');

  if (btnCloseImport)
    btnCloseImport.addEventListener('click', closeImportModal);
  if (btnCancelImport)
    btnCancelImport.addEventListener('click', closeImportModal);
  if (btnRunImport) btnRunImport.addEventListener('click', runImport);
}

function openImportModal() {
  const modal = document.getElementById('importModal');
  const rawInput = document.getElementById('importRawInput');
  const preview = document.getElementById('importPreview');

  if (!modal) return;

  if (rawInput) rawInput.value = '';
  if (preview) preview.innerHTML = '';

  modal.classList.remove('hidden');
  modal.style.display = 'flex';

  if (window.gsap) {
    const box = modal.querySelector('.modal');
    if (box) {
      gsap.fromTo(
        box,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.2 }
      );
    }
  }
}

function closeImportModal() {
  const modal = document.getElementById('importModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.style.display = 'none';
}

function buildImportPreview(lines) {
  const container = document.getElementById('importPreview');
  if (!container) return;

  container.innerHTML = '';

  lines.forEach((line, idx) => {
    const row = document.createElement('div');
    row.className = 'import-row';
    row.innerHTML = `
      <div class="truncate">${idx + 1}. ${line}</div>
      <div class="text-gray-500 text-xs">主分类: 自动识别</div>
      <div class="text-gray-500 text-xs">类型: 自动识别</div>
    `;
    container.appendChild(row);
  });
}

async function runImport() {
  try {
    const rawEl = document.getElementById('importRawInput');
    if (!rawEl) {
      showToast('导入失败：找不到输入框', 'error');
      return;
    }

    const raw = rawEl.value.trim();
    if (!raw) {
      showToast('请先粘贴标题', 'error');
      return;
    }

    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      showToast('没有有效行', 'error');
      return;
    }

    buildImportPreview(lines);

    if (!confirm(`共 ${lines.length} 条标题，确认导入 Supabase 吗？`)) {
      return;
    }

    const payloads = lines.map((text) => ({
      text,
      main_category:
        state.currentCategory !== '全部' ? state.currentCategory : null,
      content_type: null,
      scene_tags: [],
      keywords: [],
    }));

    const db = getDb();
    if (!db) return;

    const { error } = await db.from('titles').insert(payloads);

    if (error) {
      console.error('Supabase insert error:', error);
      showToast('导入失败：' + error.message, 'error');
      return;
    }

    showToast('导入完成');
    closeImportModal();
    await loadTitles();
  } catch (err) {
    console.error('runImport 异常:', err);
    showToast('导入失败', 'error');
  }
}

/* ========== Toast ========== */

function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) {
    console.warn('Toast 元素缺失，消息：', msg);
    return;
  }
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.background =
    type === 'error' ? 'rgba(220, 38, 38, 0.9)' : 'rgba(17, 24, 39, 0.9)';

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('hidden');
  }, 1800);
}
