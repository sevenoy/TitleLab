const supabase = window.supabaseClient || null;

let toastTimer = null;

// #region agent log
// 文件加载时间戳 - 验证是否加载了最新版本
fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin.js:1',message:'File loaded',data:{timestamp:Date.now(),version:'2025-01-01-v2',supabaseAvailable:!!supabase,userAgent:navigator.userAgent},timestamp:Date.now(),sessionId:'debug-session',runId:'remote-debug',hypothesisId:'CACHE'})}).catch(()=>{});
// #endregion

// 允许登录的用户列表（与 login.html 保持一致）
const ALLOWED_USERS = ['sevenoy', 'olina'];

function validateUser(user) {
  if (!user || !user.username) return false;
  return ALLOWED_USERS.includes(user.username);
}

document.addEventListener('DOMContentLoaded', () => {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin.js:DOMContentLoaded',message:'DOM ready',data:{timestamp:Date.now(),readyState:document.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'remote-debug',hypothesisId:'TIMING'})}).catch(()=>{});
  // #endregion
  
  const user = getCurrentUser();
  if (!user || !validateUser(user)) { 
    // 清除无效的用户信息
    try { localStorage.removeItem('current_user_v1'); } catch (_) {}
    window.location.href = 'login.html'; 
    return; 
  }
  const badge = document.getElementById('currentUserName');
  if (badge) {
    // 显示用户名首字母，节省空间
    badge.textContent = getUserInitial(user.username);
    badge.title = user.username || ''; // 完整用户名显示在tooltip中
    badge.className = 'user-badge text-xs';
  }
  const btnLogout = document.getElementById('btnLogout');
  const btnLoginHeader = document.getElementById('btnLoginHeader');
  if (btnLogout) btnLogout.onclick = () => { try { localStorage.removeItem('current_user_v1'); } catch (_) {} window.location.href = 'login.html'; };
  if (btnLoginHeader) btnLoginHeader.onclick = () => { window.location.href = 'login.html'; };
  if (btnLogout) btnLogout.classList.remove('hidden');
  if (btnLoginHeader) btnLoginHeader.classList.add('hidden');
  bindOverview();
  bindSnapshotControls();
  bindDataOps();
  bindCategoryOps();
  console.log('[Admin] Before bindDangerOps');
  bindDangerOps();
  console.log('[Admin] After bindDangerOps');
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

let snapshotQuery = '';
let snapshotPage = 1;
const SNAPSHOT_PAGE_SIZE = 10;
let snapshotOpen = false;

function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  el.style.background = type === 'error' ? 'rgba(220,38,38,0.92)' : 'rgba(17,24,39,0.92)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.add('hidden'); }, 1800);
}

async function fetchAll(table) {
  if (!supabase) return [];
  const { data, error } = await supabase.from(table).select('*').order('created_at', { ascending: true });
  if (error) return [];
  return data || [];
}

function bindOverview() {
  renderOverview();

  // 同步事件：云端加载完成或本地数据变更时，自动刷新统计
  window.addEventListener('cloudSyncLoaded', () => renderOverview());
  window.addEventListener('autoSyncStatus', (e) => {
    const st = e.detail && e.detail.status;
    if (st === 'synced' || st === 'pulling' || st === 'syncing') {
      // 状态进入同步/拉取后刷新一次
      renderOverview();
    }
  });
  window.addEventListener('dataChanged', debounce(() => renderOverview(), 600));
}

async function renderOverview() {
  const allTitles = await fetchAll('titles');
  const allContents = await fetchAll('contents');
  
  // 应用用户过滤：只显示当前用户的数据
  const user = getCurrentUser();
  const userTagValue = user ? `user:${user.username}` : null;
  
  const titles = userTagValue
    ? allTitles.filter((it) => Array.isArray(it.scene_tags) && it.scene_tags.includes(userTagValue))
    : allTitles;
  
  const contents = userTagValue
    ? allContents.filter((it) => Array.isArray(it.scene_tags) && it.scene_tags.includes(userTagValue))
    : allContents;
  
  const elT = document.getElementById('overviewTitleCount');
  const elC = document.getElementById('overviewContentCount');
  const elS = document.getElementById('overviewLatestSnapshot');
  if (elT) elT.textContent = Array.isArray(titles) ? titles.length : 0;
  if (elC) elC.textContent = Array.isArray(contents) ? contents.length : 0;
  let latest = '—';
  if (window.snapshotService) {
    try {
      const list = await window.snapshotService.listUnified(1);
      if (list && list.length) {
        latest = `${list[0].label} · 标题 ${list[0].titleCount} · 文案 ${list[0].contentCount} · ${list[0].updatedText}`;
      }
    } catch (_) {}
  }
  if (elS) elS.textContent = latest;
}

function bindSnapshotControls() {
  const btnSave = document.getElementById('btnSaveUnifiedSnapshot');
  const btnToggle = document.getElementById('btnToggleSnapshots');
  const inputSearch = document.getElementById('snapshotSearchInput');
  const btnPrev = document.getElementById('snapshotPrev');
  const btnNext = document.getElementById('snapshotNext');
  if (btnSave) btnSave.addEventListener('click', async () => {
    if (!window.snapshotService) { showToast('未配置 Supabase', 'error'); return; }
    const label = prompt('请输入快照备注：', '');
    if (label === null) return;
    try {
      const info = await window.snapshotService.saveUnifiedSnapshotFromCloud(label.trim());
      showToast(`已保存：标题 ${info.titleCount} 文案 ${info.contentCount} ${info.updatedText}`);
      renderOverview();
    } catch (e) {
      showToast('保存失败', 'error');
    }
  });
  if (btnToggle) btnToggle.addEventListener('click', () => {
    const box = document.getElementById('snapshotList');
    if (!snapshotOpen) {
      renderSnapshotList();
      snapshotOpen = true;
      btnToggle.classList.remove('ghost');
    } else {
      if (box) box.innerHTML = '';
      snapshotOpen = false;
      btnToggle.classList.add('ghost');
    }
  });
  if (inputSearch) inputSearch.addEventListener('input', debounce((e) => {
    snapshotQuery = (e.target.value || '').trim();
    snapshotPage = 1;
    renderSnapshotList();
  }, 300));
  if (btnPrev) btnPrev.addEventListener('click', () => { if (snapshotPage > 1) { snapshotPage--; renderSnapshotList(); } });
  if (btnNext) btnNext.addEventListener('click', () => { snapshotPage++; renderSnapshotList(); });
}

async function renderSnapshotList() {
  const box = document.getElementById('snapshotList');
  if (!box) return;
  box.innerHTML = '加载中…';
  if (!window.snapshotService) { box.textContent = '未配置 Supabase'; return; }
  try {
    const list = await window.snapshotService.listUnified(100);
    if (!list || !list.length) { box.textContent = '暂无快照'; return; }
    const filtered = snapshotQuery ? list.filter((it) => String(it.label || '').includes(snapshotQuery)) : list;
    const totalPages = Math.max(1, Math.ceil(filtered.length / SNAPSHOT_PAGE_SIZE));
    if (snapshotPage > totalPages) snapshotPage = totalPages;
    const start = (snapshotPage - 1) * SNAPSHOT_PAGE_SIZE;
    const pageItems = filtered.slice(start, start + SNAPSHOT_PAGE_SIZE);
    box.innerHTML = '';
    pageItems.forEach((it) => {
      const row = document.createElement('div');
      row.className = 'cloud-item';
      row.innerHTML = `
        <div class="cloud-item-main">
          <div class="cloud-item-name">${it.label}</div>
          <div class="cloud-item-meta">标题 ${it.titleCount} 条 · 文案 ${it.contentCount} 条 · ${it.updatedText}</div>
        </div>
        <div class="cloud-item-actions">
          <button class="function-btn ghost text-xs">加载</button>
          <button class="function-btn ghost text-xs">删除</button>
        </div>
      `;
      const btns = row.querySelectorAll('.function-btn');
      if (btns[0]) btns[0].addEventListener('click', async () => {
        const ok = confirm('确定使用此快照覆盖当前数据？');
        if (!ok) return;
        try {
          const info = await window.snapshotService.loadUnifiedSnapshot(it.key, 'both');
          showToast(`已加载：标题 ${info.titleCount} 文案 ${info.contentCount} ${info.updatedText}`);
          renderOverview();
        } catch (e) {
          showToast('加载失败', 'error');
        }
      });
      if (btns[1]) btns[1].addEventListener('click', async () => {
        if (!supabase) return;
        const ok = confirm('确定删除该快照？');
        if (!ok) return;
        try {
          await supabase.from('snapshots').delete().eq('key', it.key);
          renderSnapshotList();
          showToast('已删除');
        } catch (_) {
          showToast('删除失败', 'error');
        }
      });
      box.appendChild(row);
    });
    const pagerInfo = document.createElement('div');
    pagerInfo.className = 'text-xs text-gray-500 mt-2';
    pagerInfo.textContent = `共 ${filtered.length} 条 · 第 ${snapshotPage}/${totalPages} 页`;
    box.appendChild(pagerInfo);
    snapshotOpen = true;
  } catch (e) {
    box.textContent = '加载失败';
  }
}

function bindDataOps() {
  const btnExT = document.getElementById('btnExportTitlesCsv');
  const btnExC = document.getElementById('btnExportContentsCsv');
  const btnExTJson = document.getElementById('btnExportTitlesJson');
  const btnExCJson = document.getElementById('btnExportContentsJson');
  const btnDedupT = document.getElementById('btnDedupTitles');
  const btnDedupC = document.getElementById('btnDedupContents');
  const btnNormT = document.getElementById('btnNormalizeTitles');
  const btnNormC = document.getElementById('btnNormalizeContents');
  if (btnExT) btnExT.addEventListener('click', () => exportCsv('titles'));
  if (btnExC) btnExC.addEventListener('click', () => exportCsv('contents'));
  if (btnExTJson) btnExTJson.addEventListener('click', () => exportJson('titles'));
  if (btnExCJson) btnExCJson.addEventListener('click', () => exportJson('contents'));
  if (btnDedupT) btnDedupT.addEventListener('click', () => dedupTable('titles'));
  if (btnDedupC) btnDedupC.addEventListener('click', () => dedupTable('contents'));
  if (btnNormT) btnNormT.addEventListener('click', () => normalizeText('titles'));
  if (btnNormC) btnNormC.addEventListener('click', () => normalizeText('contents'));
}

async function exportCsv(table) {
  const rows = await fetchAll(table);
  const header = ['text','main_category','content_type','scene_tags','usage_count','created_at'];
  const csv = [header.join(',')].concat(rows.map((r) => {
    const scene = Array.isArray(r.scene_tags) ? r.scene_tags.join('|') : '';
    const vals = [r.text || '', r.main_category || '', r.content_type || '', scene, r.usage_count || 0, r.created_at || ''];
    return vals.map((v) => String(v).replace(/"/g, '""')).map((v) => `"${v}"`).join(',');
  })).join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${table}-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function exportJson(table) {
  const rows = await fetchAll(table);
  const blob = new Blob([JSON.stringify(rows || [], null, 2)], { type: 'application/json;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${table}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function norm(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

// 完全匹配去重（不归一化，不转小写）
async function dedupTable(table) {
  const rows = await fetchAll(table);
  const map = new Map();
  const deleteIds = [];
  
  rows.forEach((r) => {
    // 完全匹配：只去除首尾空白，不归一化，不转小写
    const key = (r.text || '').trim();
    if (!key) return;
    
    if (!map.has(key)) {
      map.set(key, r);
    } else {
      const keep = map.get(key);
      const curTime = new Date(r.created_at || 0).getTime();
      const keepTime = new Date(keep.created_at || 0).getTime();
      
      if (curTime < keepTime) {
        deleteIds.push(keep.id);
        map.set(key, r);
      } else {
        deleteIds.push(r.id);
      }
    }
  });
  
  if (deleteIds.length === 0) {
    showToast('未发现重复项');
    setProgress('');
    return;
  }
  
  if (!supabase) {
    showToast('未配置 Supabase', 'error');
    return;
  }
  
  const ok = confirm(`发现 ${deleteIds.length} 条重复，将保留同内容中创建时间最早的一条。\n确认一键删除所有重复项吗？`);
  if (!ok) {
    setProgress('');
    return;
  }

  const BATCH = 50;
  let count = 0;
  setProgress(`准备删除重复 ${deleteIds.length} 条…`);
  for (let i = 0; i < deleteIds.length; i += BATCH) {
    const batch = deleteIds.slice(i, i + BATCH);
    try {
      const { error } = await supabase.from(table).delete().in('id', batch);
      if (error) throw error;
      count += batch.length;
      setProgress(`已删除 ${Math.min(count, deleteIds.length)}/${deleteIds.length}`);
    } catch (e) {
      console.error('[Admin] 删除重复失败', e);
      showToast('删除部分失败，请重试', 'error');
      break;
    }
  }
  showToast(`已删除重复 ${count} 条`);
  renderOverview();
  setProgress('');
  const previewContainer = document.getElementById('dedupPreview');
  if (previewContainer) {
    previewContainer.style.display = 'none';
    previewContainer.innerHTML = '';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function normalizeText(table) {
  const rows = await fetchAll(table);
  if (!supabase) return;
  let count = 0;
  setProgress(`准备归一化 ${rows.length} 条…`);
  for (const r of rows) {
    const t = norm(r.text);
    if (t !== (r.text || '')) {
      try { await supabase.from(table).update({ text: t }).eq('id', r.id); count++; } catch (_) {}
    }
    if (count % 20 === 0) setProgress(`已归一化 ${count}/${rows.length}`);
  }
  showToast(`已归一化 ${count} 条`);
  renderOverview();
  setProgress('');
}

function bindCategoryOps() {
  const btnA = document.getElementById('btnCopyTitleCatsToContent');
  const btnB = document.getElementById('btnCopyContentCatsToTitle');
  const btnR = document.getElementById('btnResetCatsDefault');
  
  // 获取当前用户的设置 key
  const user = getCurrentUser();
  const username = user ? user.username : 'default';
  const titleCatsKey = `title_categories_v1_${username}`;
  const contentCatsKey = `content_categories_v1_${username}`;
  
  if (btnA) btnA.addEventListener('click', () => {
    const src = localStorage.getItem(titleCatsKey);
    const arr = src ? JSON.parse(src) : [];
    localStorage.setItem(contentCatsKey, JSON.stringify(arr));
    showToast('已复制到文案分类');
  });
  if (btnB) btnB.addEventListener('click', () => {
    const src = localStorage.getItem(contentCatsKey);
    const arr = src ? JSON.parse(src) : [];
    localStorage.setItem(titleCatsKey, JSON.stringify(arr));
    showToast('已复制到标题分类');
  });
  if (btnR) btnR.addEventListener('click', () => {
    const def = ['全部','亲子','情侣','闺蜜','单人','烟花','夜景'];
    localStorage.setItem(titleCatsKey, JSON.stringify(def));
    localStorage.setItem(contentCatsKey, JSON.stringify(def));
    showToast('分类已重置');
  });
}

function bindDangerOps() {
  const btnCT = document.getElementById('btnClearTitlesAdmin');
  const btnCC = document.getElementById('btnClearContentsAdmin');
  const btnClearAll = document.getElementById('btnClearAllData');
  
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin.js:bindDangerOps',message:'Function called',data:{btnCT:!!btnCT,btnCC:!!btnCC,btnClearAll:!!btnClearAll,btnClearAllId:btnClearAll?.id,supabaseAvailable:!!supabase},timestamp:Date.now(),sessionId:'debug-session',runId:'remote-debug',hypothesisId:'TIMING'})}).catch(()=>{});
  // #endregion
  
  console.log('[Admin bindDangerOps]', { btnCT: !!btnCT, btnCC: !!btnCC, btnClearAll: !!btnClearAll });
  
  if (btnCT) btnCT.addEventListener('click', async () => {
    if (!supabase) { showToast('未配置 Supabase', 'error'); return; }
    openDangerConfirm('清空标题表将不可恢复，请输入：清空', async () => {
      try {
        const { error } = await supabase.from('titles').delete().not('id', 'is', null);
        if (error) throw error;
        showToast('已清空标题表');
        renderOverview();
      } catch (_) { showToast('清空失败', 'error'); }
    });
  });
  
  if (btnCC) btnCC.addEventListener('click', async () => {
    if (!supabase) { showToast('未配置 Supabase', 'error'); return; }
    openDangerConfirm('清空文案表将不可恢复，请输入：清空', async () => {
      try {
        const { error } = await supabase.from('contents').delete().not('id', 'is', null);
        if (error) throw error;
        showToast('已清空文案表');
        renderOverview();
      } catch (_) { showToast('清空失败', 'error'); }
    });
  });
  
  if (btnClearAll) {
    console.log('[Admin] Binding btnClearAll event listener');
    
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin.js:bindClearAll',message:'Binding event listener',data:{buttonExists:true,hasClickProp:'onclick' in btnClearAll,hasAddEventListener:'addEventListener' in btnClearAll},timestamp:Date.now(),sessionId:'debug-session',runId:'remote-debug',hypothesisId:'MOBILE_EVENT'})}).catch(()=>{});
    // #endregion
    
    // 同时支持 click 和 touchend 事件（移动端兼容）
    const handleClick = async (e) => {
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin.js:handleClick',message:'Button clicked',data:{eventType:e.type,isTrusted:e.isTrusted,supabase:!!supabase,timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'remote-debug',hypothesisId:'MOBILE_EVENT'})}).catch(()=>{});
      // #endregion
      
      console.log('[Admin] btnClearAll clicked!');
      
      if (!supabase) { 
        console.log('[Admin] No supabase');
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin.js:handleClick',message:'Supabase not available',data:{supabaseClient:window.supabaseClient,supabaseType:typeof window.supabaseClient},timestamp:Date.now(),sessionId:'debug-session',runId:'remote-debug',hypothesisId:'SUPABASE_INIT'})}).catch(()=>{});
        // #endregion
        showToast('未配置 Supabase', 'error'); 
        return; 
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin.js:beforeConfirm',message:'About to show confirm dialog',data:{confirmFunction:typeof confirm},timestamp:Date.now(),sessionId:'debug-session',runId:'remote-debug',hypothesisId:'ERROR_SILENT'})}).catch(()=>{});
      // #endregion
      
      // 使用浏览器原生确认对话框
      let confirmed = false;
      try {
        confirmed = confirm(
          '⚠️ 警告：此操作将清除所有数据！\n\n' +
          '将删除：\n' +
          '• 所有标题数据\n' +
          '• 所有文案数据\n' +
          '• 所有分类设置\n' +
          '• 所有账号分类\n' +
          '• 所有显示设置\n' +
          '• 所有星标数据\n\n' +
          '此操作不可恢复！\n\n' +
          '确定要继续吗？'
        );
      } catch (err) {
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin.js:confirmError',message:'Confirm failed',data:{error:err.message,stack:err.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'remote-debug',hypothesisId:'ERROR_SILENT'})}).catch(()=>{});
        // #endregion
        console.error('[Admin] Confirm error:', err);
        return;
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin.js:afterConfirm',message:'Confirm dialog result',data:{confirmed},timestamp:Date.now(),sessionId:'debug-session',runId:'remote-debug',hypothesisId:'ERROR_SILENT'})}).catch(()=>{});
      // #endregion
      
      if (!confirmed) {
        console.log('[Admin] User cancelled');
        return;
      }
      
      try {
        console.log('[Admin] Starting to clear all data...');
        
        // 清除Supabase中的数据
        const titleResult = await supabase.from('titles').delete().not('id', 'is', null);
        if (titleResult.error) throw titleResult.error;
        console.log('[Admin] Titles cleared');
        
        const contentResult = await supabase.from('contents').delete().not('id', 'is', null);
        if (contentResult.error) throw contentResult.error;
        console.log('[Admin] Contents cleared');
        
        // 清除localStorage中的数据，但保留"全部"分类
        const user = getCurrentUser();
        if (user && user.username) {
          const username = user.username;
          
          // 标题分类：只保留"全部"
          try {
            localStorage.setItem(`title_categories_v1_${username}`, JSON.stringify(['全部']));
          } catch (_) {}
          
          // 文案分类：只保留"全部"
          try {
            localStorage.setItem(`content_categories_v1_${username}`, JSON.stringify(['全部']));
          } catch (_) {}
          
          // 显示设置：清空账号分类（scenes），保留默认颜色设置
          try {
            const defaultSettings = {
              brandColor: '#1990ff',
              brandHover: '#1477dd',
              ghostColor: '#eef2ff',
              ghostHover: '#e2e8ff',
              stripeColor: '#E2F0FF',
              hoverColor: '#eef2ff',
              scenes: [], // 清空账号分类
              titleText: '标题与文案管理系统',
              titleColor: '#1990ff'
            };
            localStorage.setItem(`display_settings_v1_${username}`, JSON.stringify(defaultSettings));
          } catch (_) {}
          
          console.log('[Admin] LocalStorage cleared - only "全部" category remains');
        }
        
        showToast('已清除所有数据，页面将刷新...');
        console.log('[Admin] All data cleared, reloading in 3 seconds...');
        
        // 3秒后刷新页面
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } catch (e) {
        console.error('[Admin] 清除所有数据失败', e);
        // #region agent log
        fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin.js:clearError',message:'Clear all data failed',data:{error:e.message,stack:e.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'remote-debug',hypothesisId:'ERROR_SILENT'})}).catch(()=>{});
        // #endregion
        showToast('清除失败：' + (e.message || ''), 'error');
      }
    };
    
    btnClearAll.addEventListener('click', handleClick);
    // 移动端兼容：同时监听 touchend 事件
    btnClearAll.addEventListener('touchend', (e) => {
      e.preventDefault(); // 防止触发click事件
      handleClick(e);
    });
    
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin.js:eventBound',message:'Event listeners attached',data:{hasClickListener:true,hasTouchListener:true},timestamp:Date.now(),sessionId:'debug-session',runId:'remote-debug',hypothesisId:'MOBILE_EVENT'})}).catch(()=>{});
    // #endregion
  } else {
    console.log('[Admin] btnClearAll element NOT FOUND!');
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'admin.js:elementNotFound',message:'btnClearAll not found',data:{allButtons:Array.from(document.querySelectorAll('button')).map(b=>b.id).filter(Boolean)},timestamp:Date.now(),sessionId:'debug-session',runId:'remote-debug',hypothesisId:'TIMING'})}).catch(()=>{});
    // #endregion
  }
}

function openDangerConfirm(text, onOk, requiredText = '清空') {
  const backdrop = document.getElementById('dangerConfirmBackdrop');
  const modal = document.getElementById('dangerConfirmModal');
  const elText = document.getElementById('dangerConfirmText');
  const input = document.getElementById('dangerConfirmInput');
  const btnClose = document.getElementById('dangerConfirmClose');
  const btnCancel = document.getElementById('dangerConfirmCancel');
  const btnOk = document.getElementById('dangerConfirmOk');
  if (!backdrop || !modal || !elText || !input || !btnClose || !btnCancel || !btnOk) return;
  elText.textContent = text;
  input.value = '';
  input.placeholder = `输入：${requiredText}`;
  backdrop.classList.remove('hidden');
  modal.classList.remove('hidden');
  const close = () => { backdrop.classList.add('hidden'); modal.classList.add('hidden'); };
  btnClose.onclick = close;
  btnCancel.onclick = close;
  btnOk.onclick = async () => {
    if ((input.value || '').trim() !== requiredText) {
      showToast(`请正确输入"${requiredText}"`, 'error');
      return;
    }
    close();
    await onOk();
  };
}

function setProgress(msg) {
  const el = document.getElementById('adminProgress');
  if (!el) return;
  el.textContent = msg || '';
}

function debounce(fn, delay) {
  let t;
  return function(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), delay);
  };
}
