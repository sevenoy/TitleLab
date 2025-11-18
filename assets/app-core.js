console.log('[AppCore] app-core.js loaded');

(function () {
  const appCore = {
    state: {
      titles: [],
      contents: [],
      titleCategories: ['全部'],
      contentCategories: ['全部'],
      displaySettings: {},
      activeTab: 'title'
    },
    init() {
      this.bindTabs();
      this.bindCloudButtons();
      if (typeof window.initTitleModule === 'function') {
        try {
          window.initTitleModule();
        } catch (e) {}
      }
      if (typeof window.ContentModule?.init === 'function') {
        try {
          window.ContentModule.init();
        } catch (e) {}
      }
      const url = new URL(window.location.href);
      const tab = url.searchParams.get('tab');
      if (tab === 'content') this.switchTab('content');
      else this.switchTab('title');
    },
    bindTabs() {
      const titlePane = document.getElementById('titlePane');
      const contentPane = document.getElementById('contentPane');
      const tabs = document.querySelectorAll('.topbar-center .nav-tab');
      tabs.forEach((btn, idx) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          this.switchTab(idx === 0 ? 'title' : 'content');
        });
      });
      this._titlePane = titlePane;
      this._contentPane = contentPane;
    },
    switchTab(name) {
      this.state.activeTab = name;
      if (this._titlePane && this._contentPane) {
        if (name === 'title') {
          this._titlePane.classList.remove('hidden');
          this._contentPane.classList.add('hidden');
        } else {
          this._contentPane.classList.remove('hidden');
          this._titlePane.classList.add('hidden');
        }
      }
      const tabs = document.querySelectorAll('.topbar-center .nav-tab');
      tabs.forEach((el, idx) => {
        if ((name === 'title' && idx === 0) || (name === 'content' && idx === 1)) {
          el.classList.add('nav-tab-active');
        } else {
          el.classList.remove('nav-tab-active');
        }
      });
    },
    bindCloudButtons() {
      const saveBtn = document.getElementById('btnSaveToCloud');
      const loadBtn = document.getElementById('btnLoadFromCloud');
      if (saveBtn) saveBtn.addEventListener('click', () => this.saveSnapshot());
      if (loadBtn) loadBtn.addEventListener('click', () => this.openSnapshotList());
    },
    refreshFromModules() {
      if (window.TitleModule?.getTitles) this.state.titles = window.TitleModule.getTitles();
      if (window.TitleModule?.getCategories) this.state.titleCategories = window.TitleModule.getCategories();
      if (window.ContentModule?.getContents) this.state.contents = window.ContentModule.getContents();
      if (window.ContentModule?.getCategories) this.state.contentCategories = window.ContentModule.getCategories();
      const s = localStorage.getItem('display_settings_v1');
      this.state.displaySettings = s ? JSON.parse(s) : {};
    },
    collectSnapshotPayload() {
      this.refreshFromModules();
      return {
        titles: this.state.titles || [],
        contents: this.state.contents || [],
        titleCategories: this.state.titleCategories || ['全部'],
        contentCategories: this.state.contentCategories || ['全部'],
        displaySettings: this.state.displaySettings || {},
        meta: {
          titleCount: (this.state.titles || []).length,
          contentCount: (this.state.contents || []).length,
          version: 1
        }
      };
    },
    applySnapshotPayload(payload) {
      if (!payload) return;
      if (window.TitleModule?.setTitles) window.TitleModule.setTitles(Array.isArray(payload.titles) ? payload.titles : []);
      if (window.TitleModule?.setCategories && Array.isArray(payload.titleCategories)) window.TitleModule.setCategories(payload.titleCategories);
      if (window.ContentModule?.setContents) window.ContentModule.setContents(Array.isArray(payload.contents) ? payload.contents : []);
      if (window.ContentModule?.setCategories && Array.isArray(payload.contentCategories)) window.ContentModule.setCategories(payload.contentCategories);
      if (window.TitleModule?.refreshUI) window.TitleModule.refreshUI();
      if (window.ContentModule?.refreshUI) window.ContentModule.refreshUI();
    },
    async syncSnapshotToCloud(payload) {
      const client = window.supabaseClient;
      if (!client) return alert('未配置 Supabase');
      const titles = Array.isArray(payload.titles) ? payload.titles : [];
      const contents = Array.isArray(payload.contents) ? payload.contents : [];
      const delTitles = await client.from('titles').delete().not('id', 'is', null);
      if (delTitles.error) throw delTitles.error;
      if (titles.length) {
        const ins = await client.from('titles').insert(
          titles.map((t) => ({
            text: t.text,
            main_category: t.main_category || null,
            content_type: t.content_type || null,
            scene_tags: Array.isArray(t.scene_tags) ? t.scene_tags : [],
            usage_count: t.usage_count || 0
          }))
        );
        if (ins.error) throw ins.error;
      }
      try {
        const delContents = await client.from('contents').delete().not('id', 'is', null);
        if (delContents.error) throw delContents.error;
        if (contents.length) {
          const ins2 = await client.from('contents').insert(
            contents.map((c) => ({
              title: c.title || '',
              body: c.body || '',
              main_category: c.main_category || null,
              content_type: c.content_type || null,
              scene_tags: Array.isArray(c.scene_tags) ? c.scene_tags : [],
              platform: c.platform || null,
              tone: c.tone || null,
              length_hint: c.length_hint || null
            }))
          );
          if (ins2.error) throw ins2.error;
        }
      } catch (e) {}
    },
    async saveSnapshot() {
      const client = window.supabaseClient;
      if (!client) return alert('未配置 Supabase');
      const label = prompt('请输入快照备注名称', '');
      if (label === null) return;
      const payload = this.collectSnapshotPayload();
      const key = `manual_${Date.now()}`;
      const up = await client.from('library_snapshots').upsert([
        { key, payload: { ...payload, snapshot_label: (label || '').trim() }, updated_at: new Date().toISOString() }
      ], { onConflict: 'key' });
      if (up.error) return alert('保存快照失败：' + (up.error.message || ''));
      this.toast('云端快照已保存');
    },
    async openSnapshotList() {
      const client = window.supabaseClient;
      if (!client) return alert('未配置 Supabase');
      const panel = document.getElementById('cloudHistoryPanel');
      if (!panel) return alert('缺少快照面板容器');
      panel.classList.remove('hidden');
      panel.style.display = 'block';
      const res = await client
        .from('library_snapshots')
        .select('key,payload,updated_at')
        .order('updated_at', { ascending: false })
        .limit(5);
      let rows = res.data || [];
      if (!rows.length) {
        const resOld = await client
          .from('title_snapshots')
          .select('key,payload,updated_at')
          .order('updated_at', { ascending: false })
          .limit(5);
        rows = resOld.data || [];
      }
      if (!rows.length) {
        panel.innerHTML = '<div style="padding:8px 10px;font-size:12px;color:#6b7280;">暂无快照</div>';
        return;
      }
      panel.innerHTML = rows.map((row) => {
        const p = row.payload || {};
        const t = Array.isArray(p.titles) ? p.titles.length : 0;
        const c = Array.isArray(p.contents) ? p.contents.length : 0;
        const label = p.snapshot_label || '(未命名)';
        const updated = row.updated_at ? new Date(row.updated_at).toLocaleString() : '';
        return `
          <div class="cloud-item" data-key="${row.key}">
            <div class="cloud-item-main">
              <div class="cloud-item-name">${label}</div>
              <div class="cloud-item-meta">标题 ${t} 条 · 文案 ${c} 条 · ${updated}</div>
            </div>
          </div>
        `;
      }).join('');
      panel.querySelectorAll('.cloud-item').forEach((el) => {
        el.addEventListener('click', async () => {
          const key = el.getAttribute('data-key');
          if (!key) return;
          const ok = confirm('确定使用此快照覆盖当前数据？');
          if (!ok) return;
          await this.loadSnapshot(key);
          panel.classList.add('hidden');
          panel.style.display = 'none';
        });
      });
    },
    async loadSnapshot(key) {
      const client = window.supabaseClient;
      if (!client) return alert('未配置 Supabase');
      const res = await client
        .from('library_snapshots')
        .select('payload')
        .eq('key', key)
        .maybeSingle();
      let payload = res.data?.payload;
      if (!payload) {
        const old = await client
          .from('title_snapshots')
          .select('payload')
          .eq('key', key)
          .maybeSingle();
        const p = old.data?.payload;
        if (p) payload = { titles: p.titles || [], contents: [], titleCategories: p.categories || ['全部'], contentCategories: ['全部'], displaySettings: p.viewSettings || {}, meta: { titleCount: (p.titles || []).length, contentCount: 0, version: 1 } };
      }
      if (!payload) return alert('未找到该快照数据');
      this.applySnapshotPayload(payload);
      try {
        await this.syncSnapshotToCloud(payload);
        this.toast('已加载快照并覆盖云端');
      } catch (e) {
        alert('同步云端失败：' + (e.message || ''));
      }
    },
    toast(msg) {
      const el = document.getElementById('toast');
      if (!el) return;
      el.textContent = msg;
      el.classList.remove('hidden');
      clearTimeout(el._timer);
      el._timer = setTimeout(() => el.classList.add('hidden'), 1800);
    }
  };

  window.appCore = appCore;
  document.addEventListener('DOMContentLoaded', () => appCore.init());
})();
