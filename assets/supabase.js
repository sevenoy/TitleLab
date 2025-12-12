// assets/supabase.js

// 这里直接写死你的 Supabase 项目信息
// （这是 anon 公钥，只能做前端允许的操作，注意不要用 service_role）
const SUPABASE_URL = 'https://ukinuavvsjnqmrbtmwtq.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVraW51YXZ2c2pucW1yYnRtd3RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNDgwNzUsImV4cCI6MjA3ODYyNDA3NX0.e4Y9sw_apIhln146rSExKadRAzzO3RoCGqgRh7eIGnI';

// 防御：如果 Supabase SDK 没加载，会在控制台给出提示
if (!window.supabase) {
  console.error('❌ Supabase JS SDK 未加载，请检查 <script> 引用顺序');
}

const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ✅ 关键：挂到 window 上，给 app-title.js 使用
window.supabaseClient = supabaseClient;

// 状态检查：右上角的小 pill 提示 Supabase 在线/错误
async function pingSupabase() {
  try {
    const el = document.getElementById('supabaseStatus');
    if (!el || !supabaseClient) return;

    const { error } = await supabaseClient.from('titles').select('id').limit(1);

    if (error) {
      console.error('Supabase error:', error);
      el.textContent = '不在线';
      el.classList.add('pill-muted');
      el.classList.remove('pill');
      el.removeAttribute('style');
    } else {
      el.textContent = '在线';
      el.classList.add('pill-muted');
      el.classList.remove('pill');
      el.removeAttribute('style');
    }
  } catch (e) {
    console.error(e);
  }
}

document.addEventListener('DOMContentLoaded', pingSupabase);

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch (_) {
    return '';
  }
}

async function fetchTableAll(table) {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from(table)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) return [];
  try {
    const raw = localStorage.getItem('current_user_v1');
    const user = raw ? JSON.parse(raw) : null;
    const tag = user ? `user:${user.username}` : null;
    if (!tag) return data || [];
    return (data || []).filter((it) => Array.isArray(it.scene_tags) && it.scene_tags.includes(tag));
  } catch (_) {
    return data || [];
  }
}

async function upsertSnapshot(row) {
  const { error } = await supabaseClient
    .from('snapshots')
    .upsert([row], { onConflict: 'key' });
  if (error) throw error;
}

async function tryListUnifiedSnapshots(limit = 5) {
  if (!supabaseClient) return { rows: [], source: 'none' };
  
  // 获取当前用户，只查询当前用户的快照
  let user = null;
  try { const raw = localStorage.getItem('current_user_v1'); user = raw ? JSON.parse(raw) : null; } catch (_) {}
  const userPrefix = user ? `user_${user.username}_` : '';
  
  const { data, error } = await supabaseClient
    .from('snapshots')
    .select('key, payload, updated_at')
    .order('updated_at', { ascending: false })
    .limit(limit * 2); // 获取更多记录以便过滤后仍有足够的快照
  if (error) return { rows: [], source: 'error' };
  
  // 过滤：只返回当前用户的快照，排除用户配置文件记录
  const filtered = (data || []).filter((r) => {
    if (!r.key) return false;
    // 排除所有用户配置文件（user_profile_ 开头）
    if (r.key.startsWith('user_profile_')) return false;
    // 只返回当前用户的快照（user_${username}_ 开头，且必须是 manual_ 格式）
    if (userPrefix) {
      // 必须同时满足：1) 以当前用户前缀开头 2) 包含 manual_（真正的快照）
      return r.key.startsWith(userPrefix) && r.key.includes('manual_');
    } else {
      // 如果没有用户，只返回没有 user_ 前缀的快照（旧数据，但排除 user_profile_）
      return !r.key.startsWith('user_');
    }
  });
  
  return { rows: filtered.slice(0, limit), source: 'snapshots' };
}

async function tryListTitleSnapshots(limit = 5) {
  if (!supabaseClient) return { rows: [], source: 'none' };
  const { data, error } = await supabaseClient
    .from('title_snapshots')
    .select('key, payload, updated_at')
    .neq('key', 'default')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) return { rows: [], source: 'error' };
  return { rows: data || [], source: 'title_snapshots' };
}

async function clearAndInsert(table, rows) {
  let user = null;
  try { const raw = localStorage.getItem('current_user_v1'); user = raw ? JSON.parse(raw) : null; } catch (_) {}
  const tag = user ? `user:${user.username}` : null;
  if (tag) {
    const { data: existing } = await supabaseClient
      .from(table)
      .select('id, scene_tags');
    const ids = (existing || [])
      .filter((r) => Array.isArray(r.scene_tags) && r.scene_tags.includes(tag))
      .map((r) => r.id);
    if (ids.length) {
      const { error: delError } = await supabaseClient.from(table).delete().in('id', ids);
      if (delError) throw delError;
    }
  } else {
    const { error: delError } = await supabaseClient
      .from(table)
      .delete()
      .not('id', 'is', null);
    if (delError) throw delError;
  }
  if (!rows || rows.length === 0) return;
  // 如果已经有 tag，确保每行都包含当前用户的 tag（如果还没有的话）
  const rowsWithTag = tag ? rows.map((r) => {
    const existingTags = Array.isArray(r.scene_tags) ? r.scene_tags : [];
    // 如果已经包含当前用户的 tag，就不重复添加
    const hasUserTag = existingTags.includes(tag);
    return { ...r, scene_tags: hasUserTag ? existingTags : Array.from(new Set([...existingTags, tag])) };
  }) : rows;
  const { error: insError } = await supabaseClient.from(table).insert(rowsWithTag);
  if (insError) throw insError;
}

window.snapshotService = {
  async saveUnifiedSnapshotFromCloud(label, opts = {}) {
    if (!supabaseClient) throw new Error('supabase offline');
    
    // 防止自动保存空白快照：如果标签为空且不是用户主动保存，则拒绝保存
    const labelTrimmed = (label || '').trim();
    if (!labelTrimmed && !opts.allowEmptyLabel) {
      console.warn('[SnapshotService] 拒绝保存空标签快照（防止自动保存）');
      throw new Error('快照标签不能为空');
    }
    
    // 优先使用传入的本地状态（包含星标信息），否则从数据库获取
    let titles, contents;
    if (opts.localTitles && opts.localContents) {
      // 使用本地状态，确保星标信息被保存
      titles = opts.localTitles;
      contents = opts.localContents;
      console.log('[SnapshotService] 使用本地状态保存快照（包含星标信息）');
    } else {
      // 向后兼容：从数据库获取
      titles = await fetchTableAll('titles');
      contents = await fetchTableAll('contents');
      console.log('[SnapshotService] 从数据库获取数据保存快照');
    }
    
    // 获取当前用户的设置 key
    let user = null;
    try { const raw = localStorage.getItem('current_user_v1'); user = raw ? JSON.parse(raw) : null; } catch (_) {}
    const username = user ? user.username : 'default';
    const titleCatsKey = `title_categories_v1_${username}`;
    const contentCatsKey = `content_categories_v1_${username}`;
    const viewSettingsKey = `display_settings_v1_${username}`;
    
    const titleCatsRaw = localStorage.getItem(titleCatsKey);
    const contentCatsRaw = localStorage.getItem(contentCatsKey);
    let titleCats = [];
    let contentCats = [];
    try {
      titleCats = JSON.parse(titleCatsRaw || '[]');
    } catch (_) {}
    try {
      contentCats = JSON.parse(contentCatsRaw || '[]');
    } catch (_) {}
    const viewSettingsRaw = localStorage.getItem(viewSettingsKey);
    let viewSettings = {};
    try {
      viewSettings = JSON.parse(viewSettingsRaw || '{}');
    } catch (_) {}
    const payload = {
      ver: 2,
      snapshot_label: labelTrimmed || '',
      updated_at: Date.now(),
      titles,
      contents,
      categories: { title: titleCats, content: contentCats },
      viewSettings
    };
    const row = {
      key: `${user ? 'user_'+user.username+'_' : ''}manual_${Date.now()}`,
      payload,
      updated_at: new Date().toISOString()
    };
    await upsertSnapshot(row);
    return {
      titleCount: Array.isArray(titles) ? titles.length : 0,
      contentCount: Array.isArray(contents) ? contents.length : 0,
      updatedText: formatTime(row.updated_at)
    };
  },
  async listUnified(limit = 5) {
    const first = await tryListUnifiedSnapshots(limit);
    if (first.source === 'snapshots' && first.rows.length) {
      // 再次过滤，确保只返回真正的快照（有 snapshot_label 或 titles/contents 的记录）
      const validSnapshots = first.rows.filter((r) => {
        if (!r.payload) return false;
        if (!r.key) return false;
        // 严格排除用户配置文件（user_profile_ 开头）
        if (r.key.startsWith('user_profile_')) return false;
        // 确保是当前用户的快照（如果 key 有 user_ 前缀，必须包含 manual_）
        if (r.key.startsWith('user_') && !r.key.includes('manual_')) return false;
        // 只返回有 snapshot_label 或 titles/contents 的记录（真正的快照）
        const hasLabel = r.payload.snapshot_label !== undefined && r.payload.snapshot_label !== null;
        const hasTitles = Array.isArray(r.payload.titles) && r.payload.titles.length > 0;
        const hasContents = Array.isArray(r.payload.contents) && r.payload.contents.length > 0;
        return hasLabel || hasTitles || hasContents;
      });
      return validSnapshots.map((r) => ({
        key: r.key,
        label: (r.payload && r.payload.snapshot_label) || '(未命名)',
        titleCount: Array.isArray(r.payload && r.payload.titles)
          ? r.payload.titles.length
          : 0,
        contentCount: Array.isArray(r.payload && r.payload.contents)
          ? r.payload.contents.length
          : 0,
        updatedText: formatTime(r.updated_at),
        source: 'snapshots'
      }));
    }
    const fallback = await tryListTitleSnapshots(limit);
    return fallback.rows.map((r) => ({
      key: r.key,
      label: (r.payload && r.payload.snapshot_label) || '(未命名)',
      titleCount: Array.isArray(r.payload && r.payload.titles)
        ? r.payload.titles.length
        : 0,
      contentCount: 0,
      updatedText: formatTime(r.updated_at),
      source: 'title_snapshots'
    }));
  },
  async loadUnifiedSnapshot(key, apply = 'both') {
    if (!supabaseClient) throw new Error('supabase offline');
    
    // 获取当前用户信息
    let user = null;
    try { const raw = localStorage.getItem('current_user_v1'); user = raw ? JSON.parse(raw) : null; } catch (_) {}
    const userPrefix = user ? `user_${user.username}_` : '';
    const userTag = user ? `user:${user.username}` : null;
    
    // 严格验证快照权限：拒绝用户配置文件，只允许当前用户的快照
    if (key.startsWith('user_profile_')) {
      throw new Error('无权访问此快照');
    }
    // 如果快照 key 有用户前缀，验证是否匹配当前用户
    if (userPrefix && key.startsWith('user_')) {
      if (!key.startsWith(userPrefix)) {
        throw new Error('无权访问此快照');
      }
      // 确保是真正的快照（包含 manual_），而不是其他类型的记录
      if (!key.includes('manual_')) {
        throw new Error('无权访问此快照');
      }
    }
    
    let payload = null;
    try {
      const { data, error } = await supabaseClient
        .from('snapshots')
        .select('payload')
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      payload = data && data.payload;
    } catch (e) {
      console.error('[Supabase] loadUnifiedSnapshot error:', e);
      throw new Error('Bad Request');
    }
    if (!payload) {
      try {
        const { data, error } = await supabaseClient
          .from('title_snapshots')
          .select('payload')
          .eq('key', key)
          .maybeSingle();
        if (error) throw error;
        payload = data && data.payload;
      } catch (e) {
        console.error('[Supabase] loadUnifiedSnapshot error:', e);
        throw new Error('Bad Request');
      }
    }
    if (!payload) throw new Error('snapshot not found');
    
    const titles = Array.isArray(payload.titles) ? payload.titles : [];
    const contents = Array.isArray(payload.contents) ? payload.contents : [];
    
    // 清理 scene_tags，只保留非用户标签（账号分类等），移除所有用户标签，然后添加当前用户的标签
    const cleanSceneTags = (tags) => {
      if (!Array.isArray(tags)) return [];
      // 移除所有用户标签（user:xxx 格式）
      const nonUserTags = tags.filter(t => !String(t).startsWith('user:'));
      // 添加当前用户的标签
      return userTag ? [...nonUserTags, userTag] : nonUserTags;
    };
    
    if (apply === 'both' || apply === 'title') {
      await clearAndInsert(
        'titles',
        titles.map((t) => {
          const base = {
            text: t.text,
            main_category: t.main_category || null,
            content_type: t.content_type || null,
            scene_tags: cleanSceneTags(t.scene_tags),
            usage_count: t.usage_count || 0,
            created_at: t.created_at || new Date().toISOString()
          };
          // 如果原数据有星标字段，尝试保留（如果数据库支持）
          if (t.is_starred !== undefined) {
            base.is_starred = t.is_starred || false;
          }
          if (t.starred_at) {
            base.starred_at = t.starred_at;
          }
          return base;
        })
      );
    }
    if (apply === 'both' || apply === 'content') {
      await clearAndInsert(
        'contents',
        contents.map((c) => {
          const base = {
            text: c.text,
            main_category: c.main_category || null,
            content_type: c.content_type || null,
            scene_tags: cleanSceneTags(c.scene_tags),
            usage_count: c.usage_count || 0,
            created_at: c.created_at || new Date().toISOString()
          };
          // 如果原数据有星标字段，尝试保留（如果数据库支持）
          if (c.is_starred !== undefined) {
            base.is_starred = c.is_starred || false;
          }
          if (c.starred_at) {
            base.starred_at = c.starred_at;
          }
          return base;
        })
      );
    }
    
    // 恢复用户特定的设置
    const username = user ? user.username : 'default';
    const titleCatsKey = `title_categories_v1_${username}`;
    const contentCatsKey = `content_categories_v1_${username}`;
    const viewSettingsKey = `display_settings_v1_${username}`;
    
    if (payload.categories && payload.categories.title) {
      localStorage.setItem(
        titleCatsKey,
        JSON.stringify(payload.categories.title)
      );
    }
    if (payload.categories && payload.categories.content) {
      localStorage.setItem(
        contentCatsKey,
        JSON.stringify(payload.categories.content)
      );
    }
    // 恢复场景设置（账号分类）
    if (payload.viewSettings) {
      localStorage.setItem(
        viewSettingsKey,
        JSON.stringify(payload.viewSettings)
      );
    }
    return {
      titleCount: titles.length,
      contentCount: contents.length,
      updatedText: formatTime(payload.updated_at || Date.now())
    };
  }
};
