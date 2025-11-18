console.log('[ContentModule] module-contents.js loaded');

(function () {
  const client = window.supabaseClient || null;
  const state = {
    contents: [],
    categories: ['全部'],
    currentCategory: '全部',
    filters: { search: '', scene: '' }
  };

  function applyFilters(list) {
    const cat = state.currentCategory;
    const q = state.filters.search.toLowerCase();
    const scene = state.filters.scene;
    return list.filter((item) => {
      if (cat !== '全部' && item.main_category !== cat) return false;
      if (q && !((item.title || '') + (item.body || '')).toLowerCase().includes(q)) return false;
      if (scene) {
        const tags = Array.isArray(item.scene_tags) ? item.scene_tags : [];
        if (!tags.includes(scene)) return false;
      }
      return true;
    });
  }

  function render() {
    const pane = document.getElementById('contentPane');
    if (!pane) return;
    pane.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel';
    const header = document.createElement('div');
    header.className = 'panel-header';
    const title = document.createElement('div');
    title.className = 'panel-title';
    title.textContent = '文案库';
    header.appendChild(title);
    panel.appendChild(header);
    const body = document.createElement('div');
    body.className = 'panel-body';
    const list = document.createElement('div');
    const rows = applyFilters(state.contents);
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'text-xs text-gray-500';
      empty.textContent = '暂无文案';
      list.appendChild(empty);
    } else {
      rows.forEach((c, i) => {
        const row = document.createElement('div');
        row.className = 'panel mb-2';
        const t = document.createElement('div');
        t.className = 'text-sm font-medium';
        t.textContent = (i + 1) + '. ' + (c.title || '未命名');
        const b = document.createElement('div');
        b.className = 'text-xs text-muted';
        b.textContent = (c.body || '').slice(0, 120);
        row.appendChild(t);
        row.appendChild(b);
        list.appendChild(row);
      });
    }
    body.appendChild(list);
    panel.appendChild(body);
    pane.appendChild(panel);
  }

  async function loadFromCloud() {
    if (!client) return;
    const { data, error } = await client
      .from('contents')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) return;
    state.contents = data || [];
    render();
  }

  window.ContentModule = {
    init() {
      loadFromCloud();
    },
    getContents() {
      return Array.isArray(state.contents) ? state.contents : [];
    },
    getCategories() {
      return Array.isArray(state.categories) ? state.categories : ['全部'];
    },
    setContents(arr) {
      state.contents = Array.isArray(arr) ? arr : [];
    },
    setCategories(arr) {
      const cats = Array.isArray(arr) && arr.length ? arr : ['全部'];
      const set = new Set(cats);
      if (!set.has('全部')) set.add('全部');
      state.categories = ['全部', ...Array.from(set).filter((c) => c !== '全部')];
    },
    refreshUI() {
      render();
    }
  };
})();