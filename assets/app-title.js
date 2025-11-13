// assets/app-title.js

let state = {
  categories: ['全部', '亲子', '情侣', '闺蜜', '单人', '家庭', '街拍', '烟花', '夜景'],
  currentCategory: '全部',
  titles: [],
  filters: {
    search: '',
    contentType: '',
    scene: '',
  },
  editingId: null,
};

document.addEventListener('DOMContentLoaded', () => {
  initCategoryList();
  bindToolbarEvents();
  bindModalEvents();
  bindImportEvents();
  loadTitles();
});

/* 分类 */

function initCategoryList() {
  const list = document.getElementById('categoryList');
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

/* 工具栏事件 */

function bindToolbarEvents() {
  const searchInput = document.getElementById('searchInput');
  const filterContentType = document.getElementById('filterContentType');
  const filterScene = document.getElementById('filterScene');

  let timer;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      state.filters.search = e.target.value.trim();
      renderTitles();
    }, 250);
  });

  filterContentType.addEventListener('change', (e) => {
    state.filters.contentType = e.target.value;
    renderTitles();
  });

  filterScene.addEventListener('change', (e) => {
    state.filters.scene = e.target.value;
    renderTitles();
  });

  document.getElementById('btnNewTitle').addEventListener('click', () => {
    openTitleModal();
  });

  document
    .getElementById('btnBatchImport')
    .addEventListener('click', openImportModal);
}

/* Supabase 数据加载 */

async function loadTitles() {
  const { data, error } = await supabaseClient
    .from('titles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    showToast('加载标题失败');
    return;
  }

  state.titles = data || [];
  renderTitles();
}

/* 渲染列表 */

function applyFilters(items) {
  return items.filter((item) => {
    const {
      currentCategory,
      filters: { search, contentType, scene },
    } = state;

    if (currentCategory !== '全部' && item.main_category !== currentCategory) {
      return false;
    }

    if (contentType && item.content_type !== contentType) {
      return false;
    }

    if (scene) {
      const tags = item.scene_tags || [];
      if (!tags.includes(scene)) return false;
    }

    if (search) {
      const lc = search.toLowerCase();
      const text = (item.text || '').toLowerCase();
      const kw = JSON.stringify(item.keywords || []).toLowerCase();
      if (!text.includes(lc) && !kw.includes(lc)) return false;
    }

    return true;
  });
}

function renderTitles() {
  const tbody = document.getElementById('titleTableBody');
  const mobileList = document.getElementById('mobileList');
  tbody.innerHTML = '';
  mobileList.innerHTML = '';

  const items = applyFilters(state.titles);

  items.forEach((item, idx) => {
    // 桌面端
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
    tdScene.textContent = (item.scene_tags || []).join(', ');
    tr.appendChild(tdScene);

    const tdType = document.createElement('td');
    tdType.textContent = item.content_type || '';
    tr.appendChild(tdType);

    const tdUsage = document.createElement('td');
    tdUsage.textContent = item.usage_count || 0;
    tr.appendChild(tdUsage);

    const tdActions = document.createElement('td');
    const btnCopy = document.createElement('button');
    btnCopy.className = 'function-btn ghost text-xs';
    btnCopy.textContent = '复制';
    btnCopy.addEventListener('click', () => copyTitle(item));

    const btnEdit = document.createElement('button');
    btnEdit.className = 'function-btn ghost text-xs ml-1';
    btnEdit.textContent = '修改';
    btnEdit.addEventListener('click', () => openTitleModal(item));

    const btnDel = document.createElement('button');
    btnDel.className = 'function-btn ghost text-xs ml-1';
    btnDel.textContent = '删除';
    btnDel.addEventListener('click', () => deleteTitle(item));

    tdActions.append(btnCopy, btnEdit, btnDel);
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
      <span>${(item.scene_tags || []).join(', ')}</span>
      <span>${item.content_type || ''}</span>
      <span>使用 ${item.usage_count || 0}</span>
    `;
    card.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'mt-2 flex gap-2';
    const mCopy = btnCopy.cloneNode(true);
    mCopy.addEventListener('click', () => copyTitle(item));
    const mEdit = btnEdit.cloneNode(true);
    mEdit.addEventListener('click', () => openTitleModal(item));
    const mDel = btnDel.cloneNode(true);
    mDel.addEventListener('click', () => deleteTitle(item));

    actions.append(mCopy, mEdit, mDel);
    card.appendChild(actions);

    mobileList.appendChild(card);
  });
}

/* 复制 */

async function copyTitle(item) {
  try {
    await navigator.clipboard.writeText(item.text || '');
    showToast('标题已复制');
    // 使用次数 +1
    await supabaseClient
      .from('titles')
      .update({ usage_count: (item.usage_count || 0) + 1 })
      .eq('id', item.id);
    await loadTitles();
  } catch (e) {
    console.error(e);
    showToast('复制失败');
  }
}

/* 删除 */

async function deleteTitle(item) {
  if (!confirm('确认删除这条标题？')) return;
  const { error } = await supabaseClient.from('titles').delete().eq('id', item.id);
  if (error) {
    console.error(error);
    showToast('删除失败');
    return;
  }
  showToast('已删除');
  state.titles = state.titles.filter((x) => x.id !== item.id);
  renderTitles();
}

/* 新增 / 编辑弹窗 */

function bindModalEvents() {
  document
    .getElementById('btnCloseModal')
    .addEventListener('click', closeTitleModal);
  document
    .getElementById('btnCancelModal')
    .addEventListener('click', closeTitleModal);
  document
    .getElementById('btnSaveTitle')
    .addEventListener('click', saveTitleFromModal);
}

function openTitleModal(item) {
  const modal = document.getElementById('titleModal');
  const title = document.getElementById('titleModalTitle');
  const fieldText = document.getElementById('fieldText');
  const fieldCat = document.getElementById('fieldMainCategory');
  const fieldType = document.getElementById('fieldContentType');
  const fieldScene = document.getElementById('fieldSceneTags');

  // 填充分类下拉
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
    fieldScene.value = (item.scene_tags || []).join(', ');
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
  gsap && gsap.fromTo('.modal', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.2 });
}

function closeTitleModal() {
  const modal = document.getElementById('titleModal');
  modal.classList.add('hidden');
}

async function saveTitleFromModal() {
  const text = document.getElementById('fieldText').value.trim();
  const mainCategory = document.getElementById('fieldMainCategory').value || null;
  const contentType = document.getElementById('fieldContentType').value || null;
  const sceneRaw = document.getElementById('fieldSceneTags').value.trim();

  if (!text) {
    showToast('标题不能为空');
    return;
  }

  // 自动识别
  const auto = classifyTitleText(text);
  const sceneTags =
    sceneRaw.length > 0
      ? sceneRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : auto.scene_tags;

  const payload = {
    text,
    main_category: mainCategory || auto.main_category,
    content_type: contentType || auto.content_type,
    scene_tags: sceneTags,
    keywords: [],
  };

  let error;
  if (state.editingId) {
    const res = await supabaseClient
      .from('titles')
      .update(payload)
      .eq('id', state.editingId)
      .select('*')
      .single();
    error = res.error;
  } else {
    const res = await supabaseClient.from('titles').insert(payload);
    error = res.error;
  }

  if (error) {
    console.error(error);
    showToast('保存失败');
    return;
  }

  showToast('已保存');
  closeTitleModal();
  await loadTitles();
}

/* 批量导入 */

function bindImportEvents() {
  document
    .getElementById('btnCloseImport')
    .addEventListener('click', closeImportModal);
  document
    .getElementById('btnCancelImport')
    .addEventListener('click', closeImportModal);
  document
    .getElementById('btnRunImport')
    .addEventListener('click', runImport);
}

function openImportModal() {
  document.getElementById('importRawInput').value = '';
  document.getElementById('importPreview').innerHTML = '';
  document.getElementById('importModal').classList.remove('hidden');
}

function closeImportModal() {
  document.getElementById('importModal').classList.add('hidden');
}

function buildImportPreview(lines) {
  const container = document.getElementById('importPreview');
  container.innerHTML = '';
  lines.forEach((line, idx) => {
    const auto = classifyTitleText(line);
    const row = document.createElement('div');
    row.className = 'import-row';
    row.innerHTML = `
      <div class="truncate">${idx + 1}. ${line}</div>
      <div class="text-gray-500 text-xs">${
        auto.main_category || '未识别'
      }</div>
      <div class="text-gray-500 text-xs">${
        auto.content_type || '未识别'
      }</div>
    `;
    container.appendChild(row);
  });
}

async function runImport() {
  const raw = document.getElementById('importRawInput').value.trim();
  if (!raw) {
    showToast('请先粘贴标题');
    return;
  }
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    showToast('没有有效行');
    return;
  }

  buildImportPreview(lines);

  if (!confirm(`共 ${lines.length} 条标题，确认导入？`)) return;

  const payloads = lines.map((text) => {
    const auto = classifyTitleText(text);
    return {
      text,
      main_category: auto.main_category,
      content_type: auto.content_type,
      scene_tags: auto.scene_tags,
      keywords: [],
    };
  });

  const { error } = await supabaseClient.from('titles').insert(payloads);
  if (error) {
    console.error(error);
    showToast('导入失败');
    return;
  }

  showToast('导入完成');
  closeImportModal();
  await loadTitles();
}

/* Toast */

let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.add('hidden');
  }, 1800);
}
