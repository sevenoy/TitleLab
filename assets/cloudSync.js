// assets/cloudSync.js
// 云端同步统一协议（对齐 XHSPHONE 白皮书思路）
// Version: 2.0.0 - Batch delete fix

const CLOUDSYNC_VERSION = '2.2.3';
console.log(`[cloudSync] 加载版本: ${CLOUDSYNC_VERSION} (添加password_hash必填字段)`);

const DEFAULT_SNAPSHOT_KEY = 'default';
const DEVICE_ID_STORAGE_KEY = 'cloudsync_device_id';
const DEFAULT_AUTOSYNC_INTERVAL = 30000; // 30秒自动同步一次
const AUTO_SYNC_STATUS_MAP = {
  initial: { text: '自动同步准备中…', className: 'text-gray-500' },
  syncing: { text: '自动同步中…', className: 'text-blue-500' },
  idle: { text: '自动同步完成', className: 'text-gray-500' },
  listening: { text: '自动同步已开启', className: 'text-blue-500' },
  stopped: { text: '自动同步已停止', className: 'text-gray-500' },
  error: {
    className: 'text-red-500',
    text: (payload) => '自动同步失败：' + (payload && payload.error && payload.error.message ? payload.error.message : '未知错误')
  },
  noAuth: { text: '未登录，自动同步已停用', className: 'text-red-500' },
  fallback: { text: '自动同步状态未知', className: 'text-gray-500' }
};
const AUTO_SYNC_STATUS_CLASSES = Array.from(new Set(
  Object.values(AUTO_SYNC_STATUS_MAP)
    .map((item) => item && item.className)
    .filter(Boolean)
));

function createAutoSyncStatusSetter(statusEl, statusSelector) {
  let missingStatusWarned = false;
  return (statusKey, payload) => {
    const statusConfig = AUTO_SYNC_STATUS_MAP[statusKey] || AUTO_SYNC_STATUS_MAP.fallback;
    const text = typeof statusConfig.text === 'function'
      ? statusConfig.text(payload)
      : statusConfig.text;
    if (!statusEl) {
      if (!missingStatusWarned) {
        console.warn(`[cloudSync] 未找到自动同步状态元素：${statusSelector}`);
        missingStatusWarned = true;
      }
      return;
    }
    if (AUTO_SYNC_STATUS_CLASSES.length) {
      statusEl.classList.remove(...AUTO_SYNC_STATUS_CLASSES);
    }
    if (statusConfig.className) {
      statusEl.classList.add(statusConfig.className);
    }
    statusEl.textContent = text;
  };
}

/**
 * 确保设备ID存在，如果不存在则生成一个
 */
function ensureDeviceId() {
  const cached = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (cached) return cached;
  const newId = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `device-${Date.now()}`;
  localStorage.setItem(DEVICE_ID_STORAGE_KEY, newId);
  return newId;
}

function getDeviceId() {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!deviceId) {
      const rand = Math.random().toString(16).slice(2);
      const uuid = (window.crypto && window.crypto.randomUUID)
        ? window.crypto.randomUUID()
        : `dev_${Date.now()}_${rand}`;
      deviceId = uuid;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
    }
    return deviceId;
  } catch (e) {
    console.warn('[cloudSync] 获取 device_id 失败，使用 fallback', e);
    return 'unknown_device';
  }
}

function debounce(fn, wait = 1000) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

function getUserLiveKey() {
  const sessionUser = window.supabaseApi && window.supabaseApi.getSessionUser
    ? window.supabaseApi.getSessionUser()
    : null;
  const username = sessionUser && sessionUser.username ? sessionUser.username : 'default';
  return `user_${username}_live`;
}

function isOffline() {
  return typeof navigator !== 'undefined' && 'onLine' in navigator && navigator.onLine === false;
}

function parseTimestampToMs(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function getLastSyncTime(key) {
  const keySpecific = localStorage.getItem(`last_sync_time_${key}`);
  if (keySpecific) return keySpecific;
  const fallback = localStorage.getItem('last_sync_time');
  return fallback || null;
}

function buildBackupLabel() {
  const now = new Date();
  const datePart = formatYYYYMMDDLocal(now);
  const timePart = now.toTimeString().split(' ')[0] || now.toLocaleTimeString();
  return `自动备份 ${datePart} ${timePart}`;
}

async function createBackupSnapshot(label, key) {
  const client = window.supabaseApi && window.supabaseApi.getClient
    ? window.supabaseApi.getClient()
    : null;
  if (!client) {
    throw new Error('Supabase 客户端未初始化');
  }
  const user = window.supabaseApi && window.supabaseApi.getAuthedUser
    ? await window.supabaseApi.getAuthedUser()
    : null;
  if (!user) {
    throw new Error('未登录，无法创建备份');
  }

  const localData = await aggregateLocalData();
  const username = user.username || (user.email ? user.email.split('@')[0] : 'default');
  const snapshotKeyPrefix = username ? `user_${username}_` : '';
  const backupKey = `${snapshotKeyPrefix}manual_backup_${Date.now()}`;
  const payload = {
    ver: 2,
    snapshot_label: label,
    updated_at: Date.now(),
    titles: localData.titles || [],
    contents: localData.contents || [],
    categories: localData.cats || { title: [], content: [] },
    viewSettings: localData.view || {}
  };

  const { error } = await client
    .from('snapshots')
    .upsert([{ key: backupKey, payload, updated_at: new Date().toISOString() }], { onConflict: 'key' });
  if (error) {
    throw error;
  }

  return { key: backupKey, label };
}

async function backupIfCloudNewer(key, cloudUpdatedAt) {
  const lastSync = getLastSyncTime(key);
  const cloudMs = parseTimestampToMs(cloudUpdatedAt);
  const localMs = parseTimestampToMs(lastSync);
  if (cloudMs === null || localMs === null || cloudMs <= localMs) {
    return { created: false, reason: 'not_newer' };
  }

  const label = buildBackupLabel();
  try {
    const result = await createBackupSnapshot(label, key);
    return { created: true, label: result.label, key: result.key };
  } catch (error) {
    console.warn('[cloudSync] 创建备份快照失败', error);
    return { created: false, error };
  }
}

async function push(options = {}) {
  const { onOffline } = options || {};
  if (isOffline()) {
    if (typeof onOffline === 'function') {
      try { onOffline(); } catch (_) {}
    }
    return {
      skipped: true,
      reason: 'offline',
      message: '当前离线，已跳过推送'
    };
  }
  const key = getUserLiveKey();
  return cloudSave(key);
}

async function pull(source = 'manual', options = {}) {
  const { onOffline } = options || {};
  const key = getUserLiveKey();
  if (isOffline()) {
    if (typeof onOffline === 'function') {
      try { onOffline(); } catch (_) {}
    }
    return {
      skipped: true,
      reason: 'offline',
      message: '当前离线，已跳过拉取'
    };
  }
  console.log(`[cloudSync] pull triggered by ${source}, key=${key}`);
  return cloudLoadLatest(key);
}

/**
 * 将字符串转换为稳定的UUID（基于简单哈希）
 * 用于为本地用户名生成一个稳定的UUID作为owner_id
 */
function stringToUUID(str) {
  // 使用简单的哈希算法将字符串转换为128位（32个十六进制字符）
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  
  // 生成一个看起来像UUID的字符串（符合UUID v4格式）
  // 基于用户名的哈希值生成稳定的UUID
  const hashStr = Math.abs(hash).toString(16).padStart(8, '0');
  const username_hash = str.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const part1 = hashStr.substring(0, 8);
  const part2 = (username_hash & 0xFFFF).toString(16).padStart(4, '0');
  const part3 = '4' + (username_hash >> 16 & 0xFFF).toString(16).padStart(3, '0'); // UUID v4
  const part4 = ((username_hash >> 8 & 0x3F) | 0x80).toString(16).padStart(2, '0') + (username_hash & 0xFF).toString(16).padStart(2, '0');
  const part5 = (str.length.toString(16).padStart(2, '0') + str.charCodeAt(0).toString(16).padStart(2, '0') + hashStr.substring(0, 8)).padStart(12, '0').substring(0, 12);
  
  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
}

/**
 * 获取客户端版本号
 */
function getClientVersion() {
  return window.APP_VERSION || 'dev';
}

/**
 * 格式化日期为 YYYYMMDD（本地时间）
 */
function formatYYYYMMDDLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 构建快照标签：用户名 + 当天日期
 * 格式：${username} ${YYYYMMDD}
 * 例： "Jasper 20251218"
 */
function buildSnapshotLabel(user) {
  // 获取 username（优先级：sessionUser.username > user.username > email前缀 > 'user'）
  let username = 'user';
  
  const sessionUser = window.supabaseApi ? window.supabaseApi.getSessionUser() : null;
  if (sessionUser && sessionUser.username) {
    username = sessionUser.username;
  } else if (user && user.username) {
    username = user.username;
  } else if (user && user.email) {
    // 从 email 提取前缀（test@gmail.com => test）
    const emailPrefix = user.email.split('@')[0];
    if (emailPrefix) {
      username = emailPrefix;
    }
  }
  
  // 使用本地时间生成日期
  const today = new Date();
  const dateStr = formatYYYYMMDDLocal(today);
  
  return `${username} ${dateStr}`;
}

/**
 * 构建本地 payload（包含 snapshot_label 等完整信息）
 */
function buildLocalPayload(snapshotLabel, localData) {
  const deviceId = ensureDeviceId();
  return {
    ver: 1,
    snapshot_label: snapshotLabel,
    meta: {
      client_version: getClientVersion(),
      device_id: getDeviceId()
    },
    titles: localData.titles,
    contents: localData.contents,
    cats: localData.cats,
    view: localData.view
  };
}

/**
 * 聚合本地数据（从 Supabase 表读取）
 */
async function aggregateLocalData() {
  const client = window.supabaseApi ? window.supabaseApi.getClient() : null;
  if (!client) {
    throw new Error('Supabase 客户端未初始化');
  }

  // 获取当前用户信息
  const sessionUser = window.supabaseApi ? window.supabaseApi.getSessionUser() : null;
  const username = sessionUser ? sessionUser.username : 'default';
  const tag = sessionUser ? `user:${username}` : null;

  // 从 Supabase 读取 titles
  const { data: titlesData, error: titlesError } = await client
    .from('titles')
    .select('*')
    .order('created_at', { ascending: true });
  if (titlesError) throw titlesError;
  const titles = tag
    ? (titlesData || []).filter((it) => Array.isArray(it.scene_tags) && it.scene_tags.includes(tag))
    : (titlesData || []);

  // 从 Supabase 读取 contents
  const { data: contentsData, error: contentsError } = await client
    .from('contents')
    .select('*')
    .order('created_at', { ascending: true });
  if (contentsError) throw contentsError;
  const contents = tag
    ? (contentsData || []).filter((it) => Array.isArray(it.scene_tags) && it.scene_tags.includes(tag))
    : (contentsData || []);

  // 从 localStorage 读取分类和视图设置
  const titleCatsKey = `title_categories_v1_${username}`;
  const contentCatsKey = `content_categories_v1_${username}`;
  const viewSettingsKey = `display_settings_v1_${username}`;

  let titleCats = [];
  let contentCats = [];
  let viewSettings = {};

  try {
    const titleCatsRaw = localStorage.getItem(titleCatsKey);
    titleCats = titleCatsRaw ? JSON.parse(titleCatsRaw) : [];
  } catch (_) {}

  try {
    const contentCatsRaw = localStorage.getItem(contentCatsKey);
    contentCats = contentCatsRaw ? JSON.parse(contentCatsRaw) : [];
  } catch (_) {}

  try {
    const viewSettingsRaw = localStorage.getItem(viewSettingsKey);
    viewSettings = viewSettingsRaw ? JSON.parse(viewSettingsRaw) : {};
  } catch (_) {}

  return {
    titles,
    contents,
    cats: {
      title: titleCats,
      content: contentCats
    },
    view: viewSettings
  };
}

/**
 * 标准化 payload（排序并移除波动字段）
 * 返回只包含业务数据的对象，用于内容比较
 */
function normalizePayload(payload) {
  const normalized = JSON.parse(JSON.stringify(payload));

  // 移除波动字段
  delete normalized.snapshot_label;
  delete normalized.updated_at;  // 移除 updated_at（如果有的话）
  
  if (normalized.meta) {
    delete normalized.meta.client_version;
    delete normalized.meta.device_id;
    delete normalized.meta.generated_at;
    delete normalized.meta.created_at;  // 移除时间戳字段
    delete normalized.meta.device_id;   // 不参与哈希
    // 删除任何其他 meta 中的临时字段
    if (Object.keys(normalized.meta).length === 0) {
      delete normalized.meta;
    }
  }

  // 统一字段名：处理旧格式（categories/viewSettings）和新格式（cats/view）
  // 将 categories 转换为 cats（兼容旧数据）
  if (normalized.categories && !normalized.cats) {
    normalized.cats = normalized.categories;
    delete normalized.categories;
  }
  // 将 viewSettings 转换为 view（兼容旧数据）
  if (normalized.viewSettings !== undefined && normalized.view === undefined) {
    normalized.view = normalized.viewSettings;
    delete normalized.viewSettings;
  }
  
  // 统一 ver 为 1（确保版本一致性，避免 ver 差异导致 hash 不同）
  normalized.ver = 1;

  // 对 titles 按 id 排序（稳定排序）
  if (Array.isArray(normalized.titles)) {
    normalized.titles.sort((a, b) => {
      if (a.id && b.id) {
        // 按 id 字符串比较
        return String(a.id).localeCompare(String(b.id));
      }
      if (a.id) return -1;
      if (b.id) return 1;
      // 如果都没有 id，按 name+index 组合比较
      const aKey = (a.name || a.text || '') + '_' + (a.index || 0);
      const bKey = (b.name || b.text || '') + '_' + (b.index || 0);
      return aKey.localeCompare(bKey);
    });
  }

  // 对 contents 按 id 排序（稳定排序）
  if (Array.isArray(normalized.contents)) {
    normalized.contents.sort((a, b) => {
      if (a.id && b.id) {
        // 按 id 字符串比较
        return String(a.id).localeCompare(String(b.id));
      }
      if (a.id) return -1;
      if (b.id) return 1;
      // 如果都没有 id，按 name+index 组合比较
      const aKey = (a.name || a.text || '') + '_' + (a.index || 0);
      const bKey = (b.name || b.text || '') + '_' + (b.index || 0);
      return aKey.localeCompare(bKey);
    });
  }

  // 对 cats.title 和 cats.content 排序（如果有的话）
  if (normalized.cats) {
    if (Array.isArray(normalized.cats.title)) {
      normalized.cats.title.sort((a, b) => {
        const aName = (a.name || a || '');
        const bName = (b.name || b || '');
        return aName.localeCompare(bName);
      });
    }
    if (Array.isArray(normalized.cats.content)) {
      normalized.cats.content.sort((a, b) => {
        const aName = (a.name || a || '');
        const bName = (b.name || b || '');
        return aName.localeCompare(bName);
      });
    }
  }

  // 递归删除任何波动字段：时间戳字段、"last_*"、"ui_*"、"temp_*" 等
  function removeVolatileFields(obj) {
    if (typeof obj !== 'object' || obj === null) return;
    if (Array.isArray(obj)) {
      obj.forEach(item => removeVolatileFields(item));
      return;
    }
    Object.keys(obj).forEach(key => {
      const lowerKey = key.toLowerCase();
      // 删除时间戳字段
      if (lowerKey === 'created_at' || 
          lowerKey === 'updated_at' || 
          lowerKey === 'deleted_at' ||
          lowerKey === 'timestamp' ||
          lowerKey === 'last_modified' ||
          lowerKey.endsWith('_at') ||
          // 删除临时字段
          lowerKey.startsWith('last_') || 
          lowerKey.startsWith('ui_') || 
          lowerKey.startsWith('temp_') ||
          lowerKey.startsWith('_')) {
        delete obj[key];
      } else {
        removeVolatileFields(obj[key]);
      }
    });
  }
  removeVolatileFields(normalized);

  return normalized;
}

/**
 * 规范化 JSON 对象（确保对象键顺序一致，用于稳定的 hash 计算）
 */
function normalizeJSON(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeJSON(item));
  }
  // 对对象的键进行排序，确保顺序一致
  const sortedKeys = Object.keys(obj).sort();
  const normalized = {};
  for (const key of sortedKeys) {
    normalized[key] = normalizeJSON(obj[key]);
  }
  return normalized;
}

/**
 * 生成 payload 的内容指纹（hash）
 * 使用 crypto.subtle.digest 如果可用，否则 fallback 到简单的字符串 hash
 */
async function getPayloadHash(payload) {
  const norm = normalizePayload(payload);
  // 规范化 JSON 以确保键顺序一致（重要：确保相同内容的 payload 产生相同的 hash）
  const normalizedObj = normalizeJSON(norm);
  const json = JSON.stringify(normalizedObj);

  // 优先使用 crypto.subtle.digest
  if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(json);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (e) {
      console.warn('[cloudSync] crypto.subtle.digest 失败，使用 fallback:', e);
      // 继续使用 fallback
    }
  }

  // Fallback: 使用简单的 DJB2 hash 算法
  let hash = 5381;
  for (let i = 0; i < json.length; i++) {
    hash = ((hash << 5) + hash) + json.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  // 转换为正数并转为 hex
  const hex = Math.abs(hash).toString(16);
  return hex;
}

// 别名：hashPayload（保持向后兼容）
const hashPayload = getPayloadHash;

/**
 * 保存到云端
 * 在"无改动"时不重复写入（不触发 upsert，不改变 updated_at）
 */
async function cloudSave(key = DEFAULT_SNAPSHOT_KEY) {
  // 统一 key 为 DEFAULT_SNAPSHOT_KEY（如果为空）
  if (!key || key === undefined || key === null) {
    key = DEFAULT_SNAPSHOT_KEY;
  }

  console.log('[cloudSave] key=', key);

  const client = window.supabaseApi ? window.supabaseApi.getClient() : null;
  if (!client) {
    throw new Error('Supabase 客户端未初始化');
  }

  // 【A2-1】检查认证（必须登录）
  let user = null;
  if (window.supabaseApi && window.supabaseApi.getAuthedUser) {
    user = await window.supabaseApi.getAuthedUser();
  }
  // #region agent log
  console.log('[DEBUG] User from getAuthedUser:', {user, hasUser: !!user, userKeys: user ? Object.keys(user) : []});
  // #endregion
  if (!user) {
    const msg = '请先登录';
    console.log('[cloudSave] SKIP (not logged in)');
    throw new Error(msg);
  }

  // 聚合本地数据
  const localData = await aggregateLocalData();

  // 构建快照标签（使用新的命名规则：用户名 + 当天日期）
  const snapshotLabel = buildSnapshotLabel(user);

  // 构建本地 payload
  const localPayload = buildLocalPayload(snapshotLabel, localData);

  // 【A2-2】计算 localHash（基于 normalize 后的业务数据）
  const localHash = await getPayloadHash(localPayload);
  console.log('[cloudSave] localHash=', localHash);

  // 【A2-3】判断本地 dirty（方式1：基于稳定 hash 自动判断）
  const lastSavedHashKey = `last_saved_hash_${key}`;
  const lastSavedHash = localStorage.getItem(lastSavedHashKey);
  // 如果 lastSavedHash 为 null 或 undefined，说明从未保存过，视为 dirty=true
  const isDirty = !lastSavedHash || (lastSavedHash !== localHash);
  console.log('[cloudSave] dirty=', isDirty, '(lastSavedHash:', lastSavedHash || 'null', 'localHash:', localHash, ')');

  // 如果本地无改动（dirty=false），直接跳过保存
  if (!isDirty) {
    console.log('[cloudSave] SKIP (reason: local_no_change)');
    return {
      skipped: true,
      reason: 'local_no_change',
      message: '本地无改动，已跳过保存'
    };
  }

  // 【A2-4】本地有改动（dirty=true），继续判断云端
  // 查询云端现有快照
  const { data: existingData, error: queryError } = await client
    .from('titlelab_snapshot')
    .select('payload, updated_at')
    .eq('key', key)
    .limit(1)
    .maybeSingle();

  if (queryError && queryError.code !== 'PGRST116') {
    throw queryError;
  }

  // 若云端存在，计算 cloudHash 并比较
  if (existingData && existingData.payload) {
    const cloudHash = await getPayloadHash(existingData.payload);
    console.log('[cloudSave] cloudHash=', cloudHash);

    // 如果 localHash == cloudHash，云端已是最新，跳过保存
    if (localHash === cloudHash) {
      console.log('[cloudSave] SKIP (reason: cloud_same)');
      
      // 【A3】更新本地缓存 hash（保持同步）
      localStorage.setItem(lastSavedHashKey, localHash);
      // 更新 last_sync_time 为云端的 updated_at
      const lastSyncTimeKey = `last_sync_time_${key}`;
      if (existingData.updated_at) {
        localStorage.setItem(lastSyncTimeKey, existingData.updated_at);
      }
      
      return {
        skipped: true,
        reason: 'cloud_same',
        message: '云端已是最新（无改动），已跳过保存'
      };
    }
    
    // hash 不同，需要执行 upsert
    console.log('[cloudSave] UPSERT (hash different, localHash:', localHash, 'cloudHash:', cloudHash, ')');
  } else {
    // 云端不存在，首次创建
    console.log('[cloudSave] UPSERT (first save)');
  }

  // 获取 updated_by_name（优先 username，其次 email，本地没有就 'unknown'）
  const sessionUser = window.supabaseApi ? window.supabaseApi.getSessionUser() : null;
  let updatedByName = 'unknown';
  if (sessionUser && sessionUser.username) {
    updatedByName = sessionUser.username;
  } else if (user && user.username) {
    updatedByName = user.username;
  } else if (user && user.email) {
    updatedByName = user.email;
  }

  // 构建 upsert 对象（使用 localPayload，包含完整的 snapshot_label）
  const upsertData = {
    key: key,
    payload: localPayload,
    updated_by_name: updatedByName,
    updated_at: new Date().toISOString()
  };

  // 设置 owner_id：必须是UUID格式
  // 优先使用真实的user.id，否则基于username生成稳定的UUID
  // #region agent log
  console.log('[DEBUG] User objects before owner_id generation:', {user, sessionUser});
  // #endregion
  
  let generatedUsername = '';
  if (user && user.id) {
    // Supabase Auth用户有真实的UUID
    upsertData.owner_id = user.id;
    generatedUsername = user.username || user.email || 'unknown';
  } else if (sessionUser && sessionUser.username) {
    // 本地用户：将username转换为稳定的UUID
    upsertData.owner_id = stringToUUID(sessionUser.username);
    generatedUsername = sessionUser.username;
  } else if (user && user.username) {
    // 使用username生成UUID
    upsertData.owner_id = stringToUUID(user.username);
    generatedUsername = user.username;
  } else {
    // 最后的fallback：生成默认UUID
    upsertData.owner_id = stringToUUID('default_user');
    generatedUsername = 'default_user';
  }
  // #region agent log
  console.log('[DEBUG] Generated owner_id:', upsertData.owner_id, 'for username:', generatedUsername);
  // #endregion

  // 【重要】确保用户记录存在于 users 表中（避免外键约束错误）
  try {
    const { data: existingUser, error: checkError } = await client
      .from('users')
      .select('id')
      .eq('id', upsertData.owner_id)
      .maybeSingle();
    
    if (!existingUser && !checkError) {
      // 用户不存在，创建用户记录
      console.log('[cloudSave] User not found in users table, creating...', upsertData.owner_id);
      const userEmail = user?.email || `${generatedUsername}@local.user`;
      const { error: insertError } = await client
        .from('users')
        .insert([{
          id: upsertData.owner_id,
          email: userEmail,
          password_hash: 'LOCAL_USER_NO_PASSWORD'
        }]);
      
      if (insertError) {
        console.error('[cloudSave] ❌ Failed to create user record:', insertError);
        console.error('[cloudSave] 💡 解决方案：请在 Supabase 数据库中手动执行以下 SQL:');
        console.error(`INSERT INTO users (id, email, password_hash) VALUES ('${upsertData.owner_id}', '${userEmail}', 'LOCAL_USER_NO_PASSWORD') ON CONFLICT (id) DO NOTHING;`);
        // 如果插入失败（可能是并发创建或权限问题），继续尝试 upsert snapshot
      } else {
        console.log('[cloudSave] ✅ User record created successfully');
      }
    }
  } catch (userCheckError) {
    console.warn('[cloudSave] Error checking/creating user:', userCheckError);
    // 继续尝试 upsert，让数据库处理错误
  }

  // 执行 upsert
  console.log('[cloudSave] UPSERT executing...');
  // #region agent log
  console.log('[DEBUG] Full upsertData before UPSERT:', upsertData);
  // #endregion
  const { data: upsertResult, error: upsertError } = await client
    .from('titlelab_snapshot')
    .upsert(upsertData, {
      onConflict: 'key'
    })
    .select('updated_at')
    .maybeSingle();

  // #region agent log
  console.log('[DEBUG] UPSERT result:', {hasError: !!upsertError, error: upsertError, result: upsertResult});
  // #endregion

  if (upsertError) {
    // #region agent log
    console.error('[DEBUG] UPSERT ERROR DETAILS:', {
      code: upsertError.code,
      message: upsertError.message,
      details: upsertError.details,
      hint: upsertError.hint
    });
    // #endregion
    throw upsertError;
  }

  // 【A3】保存成功后必须做的收尾
  const lastSyncTimeKey = `last_sync_time_${key}`;
  // 使用云端的 updated_at（如果存在），否则使用当前时间
  const finalUpdatedAt = (upsertResult && upsertResult.updated_at) 
    ? upsertResult.updated_at 
    : new Date().toISOString();
  
  localStorage.setItem(lastSavedHashKey, localHash);
  localStorage.setItem(lastSyncTimeKey, finalUpdatedAt);
  localStorage.setItem('last_snapshot_name', snapshotLabel);

  console.log('[cloudSave] UPSERT success, saved hash:', localHash);

  return {
    saved: true,
    message: `已保存快照：${snapshotLabel}`
  };
}

/**
 * 检查本地是否有未保存的改动
 */
async function hasLocalDirty() {
  // 这里可以实现检查逻辑
  // 暂时返回 false，表示总是可以加载
  return false;
}

/**
 * 从云端加载最新快照
 */
async function cloudLoadLatest(key = DEFAULT_SNAPSHOT_KEY) {
  // 统一 key 为 DEFAULT_SNAPSHOT_KEY（如果为空）
  if (!key || key === undefined || key === null) {
    key = DEFAULT_SNAPSHOT_KEY;
  }

  const client = window.supabaseApi ? window.supabaseApi.getClient() : null;
  const lastSyncTimeKey = `last_sync_time_${key}`;
  if (!client) {
    throw new Error('Supabase 客户端未初始化');
  }

  // 检查认证
  if (window.supabaseApi && window.supabaseApi.requireAuth) {
    const isAuthed = await window.supabaseApi.requireAuth();
    if (!isAuthed) {
      throw new Error('未登录，无法加载云端');
    }
  }

  console.log('[cloudSync] cloudLoadLatest', {
    action: 'load',
    keyParam: key,
    actualKey: key
  });

  const sessionUser = window.supabaseApi ? window.supabaseApi.getSessionUser() : null;

  // 查询云端快照
  const { data, error } = await client
    .from('titlelab_snapshot')
    .select('payload, updated_at')
    .eq('key', key)
    .maybeSingle();
  
  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  // 如果查询不到记录，自动保存创建（不弹确认框）
  if (!data || !data.payload) {
    // 自动保存，然后自动再加载一次
    try {
      const saveResult = await cloudSave(key);
      if (saveResult.saved) {
        // 保存成功后，递归调用自身加载
        return await cloudLoadLatest(key);
      } else {
        throw new Error('保存失败：' + (saveResult.message || '未知错误'));
      }
    } catch (saveError) {
      throw saveError;
    }
  }

  const payload = data.payload;
  const backupInfo = await backupIfCloudNewer(key, data.updated_at);

  // 获取用户标签
  const username = sessionUser ? sessionUser.username : 'default';
  const tag = username ? `user:${username}` : null;

  // 删除现有的 titles（当前用户的）
  if (Array.isArray(payload.titles) && payload.titles.length > 0) {
    const { data: existingTitles } = await client
      .from('titles')
      .select('id, scene_tags');
    const idsToDelete = (existingTitles || [])
      .filter((r) => Array.isArray(r.scene_tags) && r.scene_tags.includes(tag))
      .map((r) => r.id);

    if (idsToDelete.length > 0) {
      // 分批删除，避免URL过长（每批最多50个ID）
      const BATCH_SIZE = 50;
      for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
        const batch = idsToDelete.slice(i, i + BATCH_SIZE);
        const { error: delError } = await client
          .from('titles')
          .delete()
          .in('id', batch);
        if (delError) throw delError;
      }
    }

    // 插入新的 titles（移除 is_starred 和 starred_at 字段，避免 schema 不匹配）
    const titlesWithTag = payload.titles.map((t) => {
      const existingTags = Array.isArray(t.scene_tags) ? t.scene_tags : [];
      const hasUserTag = existingTags.includes(tag);
      const { is_starred, starred_at, ...rest } = t;
      return {
        ...rest,
        scene_tags: hasUserTag ? existingTags : [...existingTags, tag]
      };
    });

    const { error: insError } = await client.from('titles').insert(titlesWithTag);
    if (insError) throw insError;
  }

  // 删除现有的 contents（当前用户的）
  if (Array.isArray(payload.contents) && payload.contents.length > 0) {
    const { data: existingContents } = await client
      .from('contents')
      .select('id, scene_tags');
    const idsToDelete = (existingContents || [])
      .filter((r) => Array.isArray(r.scene_tags) && r.scene_tags.includes(tag))
      .map((r) => r.id);

    if (idsToDelete.length > 0) {
      // 分批删除，避免URL过长（每批最多50个ID）
      const BATCH_SIZE = 50;
      for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
        const batch = idsToDelete.slice(i, i + BATCH_SIZE);
        const { error: delError } = await client
          .from('contents')
          .delete()
          .in('id', batch);
        if (delError) throw delError;
      }
    }

    // 插入新的 contents（移除 is_starred 和 starred_at 字段，避免 schema 不匹配）
    const contentsWithTag = payload.contents.map((c) => {
      const existingTags = Array.isArray(c.scene_tags) ? c.scene_tags : [];
      const hasUserTag = existingTags.includes(tag);
      const { is_starred, starred_at, ...rest } = c;
      return {
        ...rest,
        scene_tags: hasUserTag ? existingTags : [...existingTags, tag]
      };
    });

    const { error: insError } = await client.from('contents').insert(contentsWithTag);
    if (insError) throw insError;
  }

  // 恢复分类和视图设置到 localStorage
  const titleCatsKey = `title_categories_v1_${username}`;
  const contentCatsKey = `content_categories_v1_${username}`;
  const viewSettingsKey = `display_settings_v1_${username}`;

  if (payload.cats && payload.cats.title) {
    localStorage.setItem(titleCatsKey, JSON.stringify(payload.cats.title));
  }
  if (payload.cats && payload.cats.content) {
    localStorage.setItem(contentCatsKey, JSON.stringify(payload.cats.content));
  }
  if (payload.view) {
    localStorage.setItem(viewSettingsKey, JSON.stringify(payload.view));
  }

  // 通知页面更新本地分类与显示设置
  try {
    if (typeof window.loadCategoriesFromLocal === 'function') {
      window.loadCategoriesFromLocal();
    } else if (typeof window.loadCategoriesFromLocalContent === 'function') {
      window.loadCategoriesFromLocalContent();
    }
    if (typeof window.renderCategoryList === 'function') {
      window.renderCategoryList();
    }
    if (typeof window.applyDisplaySettings === 'function') {
      window.applyDisplaySettings();
    }
  } catch (_) {}

  // 更新本地同步时间
  const lastSyncTime = data.updated_at || new Date().toISOString();
  const lastSnapshotName = payload.snapshot_label || key;
  localStorage.setItem('last_sync_time', lastSyncTime);
  localStorage.setItem(lastSyncTimeKey, lastSyncTime);
  localStorage.setItem('last_snapshot_name', lastSnapshotName);

  // 触发页面刷新（通过重新加载页面数据）
  try {
    // 触发自定义事件，让页面自己刷新数据
    window.dispatchEvent(new CustomEvent('cloudSyncLoaded'));
    
    // 如果在 title 页面，尝试直接调用 loadTitlesFromCloud
    if (window.location.pathname.includes('title.html')) {
      // 尝试多种方式调用刷新函数
      if (typeof loadTitlesFromCloud === 'function') {
        await loadTitlesFromCloud();
      } else if (window.loadTitlesFromCloud && typeof window.loadTitlesFromCloud === 'function') {
        await window.loadTitlesFromCloud();
      }
    }
    
    // 如果在 content 页面，尝试直接调用 loadContentsFromCloud
    if (window.location.pathname.includes('content.html')) {
      if (typeof loadContentsFromCloud === 'function') {
        await loadContentsFromCloud();
      } else if (window.loadContentsFromCloud && typeof window.loadContentsFromCloud === 'function') {
        await window.loadContentsFromCloud();
      }
    }
  } catch (e) {
    console.warn('[cloudSync] 刷新页面数据时出错:', e);
  }

  const messageParts = [];
  if (backupInfo && backupInfo.created) {
    messageParts.push(`检测到云端版本较新，已创建备份快照：${backupInfo.label}`);
  }
  messageParts.push(`已加载快照：${lastSnapshotName}`);

  return {
    loaded: true,
    message: messageParts.join('；'),
    snapshot_label: lastSnapshotName,
    backup: backupInfo
  };
}

function startAutoSync(onStatusChange, options = {}) {
  const user = window.supabaseApi && window.supabaseApi.getSessionUser
    ? window.supabaseApi.getSessionUser()
    : null;
  const client = window.supabaseApi && window.supabaseApi.getClient
    ? window.supabaseApi.getClient()
    : null;
  const username = user && user.username ? user.username : (user && user.email ? user.email : 'default');
  const userTag = username ? `user:${username}` : null;
  const deviceId = getDeviceId();
  const cleanupFns = [];
  const notifyOffline = (action) => {
    if (typeof onStatusChange === 'function') {
      onStatusChange({ status: 'error', error: new Error(`离线，已跳过${action}`), reason: 'offline' });
    }
  };

  if (!user) {
    if (typeof onStatusChange === 'function') {
      onStatusChange({ status: 'noAuth', reason: 'not_logged_in' });
    }
    return;
  }

  const debounceMs = options.debounceMs || 1200;
  const handler = debounce(async () => {
    const offlineHandler = () => notifyOffline('自动同步');
    if (isOffline()) {
      offlineHandler();
      return;
    }
    if (typeof onStatusChange === 'function') {
      onStatusChange({ status: 'syncing' });
    }
    try {
      const result = await push({ onOffline: offlineHandler });
      if (result && result.skipped && result.reason === 'offline') {
        return;
      }
      if (typeof onStatusChange === 'function') {
        onStatusChange({ status: 'idle', result });
      }
    } catch (error) {
      console.error('[cloudSync] push failed', error);
      if (typeof onStatusChange === 'function') {
        onStatusChange({ status: 'error', error });
      }
    }
  }, debounceMs);

  window.addEventListener('dataChanged', handler);
  cleanupFns.push(() => window.removeEventListener('dataChanged', handler));
  if (typeof onStatusChange === 'function') {
    onStatusChange({ status: 'listening' });
  }

  const handleRealtimeChange = async (payload) => {
    const tagsNew = payload && payload.new && Array.isArray(payload.new.scene_tags) ? payload.new.scene_tags : [];
    const tagsOld = payload && payload.old && Array.isArray(payload.old.scene_tags) ? payload.old.scene_tags : [];
    const hasUserTag = !userTag || tagsNew.includes(userTag) || tagsOld.includes(userTag);
    if (!hasUserTag) return;

    const payloadDeviceId = payload && payload.new && payload.new.payload && payload.new.payload.meta
      ? payload.new.payload.meta.device_id
      : null;
    if (payloadDeviceId && payloadDeviceId === deviceId) {
      return;
    }

    const offlineHandler = () => notifyOffline('实时同步');
    if (isOffline()) {
      offlineHandler();
      return;
    }
    if (typeof onStatusChange === 'function') {
      onStatusChange({ status: 'syncing' });
    }
    try {
      const result = await pull('realtime', { onOffline: offlineHandler });
      if (result && result.skipped && result.reason === 'offline') {
        return;
      }
      if (typeof onStatusChange === 'function') {
        onStatusChange({ status: 'idle' });
      }
    } catch (error) {
      console.error('[cloudSync] realtime pull failed', error);
      if (typeof onStatusChange === 'function') {
        onStatusChange({ status: 'error', error });
      }
    }
  };

  const subscribeRealtime = () => {
    if (!client || !client.channel || !userTag) return null;
    const tables = ['titles', 'contents'];
    const channels = tables.map((table) => {
      const filter = `scene_tags.cs.{${userTag}}`;
      const channel = client.channel(`realtime-${table}-${userTag}`);
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter },
        handleRealtimeChange
      );
      channel.subscribe();
      return channel;
    });

    return () => {
      channels.forEach((channel) => {
        if (!channel) return;
        if (typeof client.removeChannel === 'function') {
          client.removeChannel(channel);
        } else if (typeof channel.unsubscribe === 'function') {
          channel.unsubscribe();
        }
      });
    };
  };

  const stopRealtime = subscribeRealtime();
  if (stopRealtime) {
    cleanupFns.push(stopRealtime);
  }

  return () => {
    cleanupFns.forEach((fn) => {
      try { fn(); } catch (_) {}
    });
    if (typeof onStatusChange === 'function') {
      onStatusChange({ status: 'stopped' });
    }
  };
}


function bindCloudButtons(options = {}) {
  const {
    saveBtnSelector = '#btnSaveCloud',
    loadBtnSelector = '#btnLoadCloud',
    statusSelector = '#autoSyncStatus'
  } = options;

  const btnSave = typeof saveBtnSelector === 'string'
    ? document.querySelector(saveBtnSelector)
    : saveBtnSelector;
  const btnLoad = typeof loadBtnSelector === 'string'
    ? document.querySelector(loadBtnSelector)
    : loadBtnSelector;
  const statusEl = typeof statusSelector === 'string'
    ? document.querySelector(statusSelector)
    : statusSelector;
  const setAutoSyncStatus = createAutoSyncStatusSetter(statusEl, statusSelector);

  const setStatus = (text) => {
    if (statusEl) {
      statusEl.textContent = text;
    }
  };

  const setButtonsEnabled = (enabled) => {
    [btnSave, btnLoad].forEach((btn) => {
      if (btn) {
        btn.disabled = !enabled;
        btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
        btn.classList.toggle('btn-disabled', !enabled);
      }
    });
  };

  const getLiveKey = () => getUserLiveKey();
  const getUser = () => (window.supabaseApi && window.supabaseApi.getSessionUser
    ? window.supabaseApi.getSessionUser()
    : null);
  const getSyncKey = () => getLiveKey();

  const refreshPageData = async () => {
    const tasks = [];
    const isTitlePage = window.location.pathname.includes('title.html');
    const isContentPage = window.location.pathname.includes('content.html');
    if (isTitlePage) {
      if (typeof loadTitlesFromCloud === 'function') {
        tasks.push(loadTitlesFromCloud());
      } else if (window.loadTitlesFromCloud && typeof window.loadTitlesFromCloud === 'function') {
        tasks.push(window.loadTitlesFromCloud());
      }
    }
    if (isContentPage) {
      if (typeof loadContentsFromCloud === 'function') {
        tasks.push(loadContentsFromCloud());
      } else if (window.loadContentsFromCloud && typeof window.loadContentsFromCloud === 'function') {
        tasks.push(window.loadContentsFromCloud());
      }
    }
    if (!tasks.length) return;
    try {
      await Promise.all(tasks);
    } catch (e) {
      console.warn('[cloudSync] 刷新页面数据失败', e);
    }
  };

  const handleSave = async (event) => {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
      event.preventDefault();
    }
    const user = getUser();
    if (!user) {
      setStatus('未登录，无法保存到云端');
      setAutoSyncStatus('noAuth');
      return;
    }
    setStatus('保存中…');
    setAutoSyncStatus('syncing');
    try {
      const syncKey = getSyncKey();
      const result = await cloudSave(syncKey);
      const message = (result && result.message) || '已保存到云端';
      setStatus(message);
      setAutoSyncStatus('idle', { result });
    } catch (error) {
      console.error('[cloudSync] 手动保存失败', error);
      setStatus('保存失败：' + (error && error.message ? error.message : '未知错误'));
      setAutoSyncStatus('error', { error });
    }
  };

  const handleLoad = async (event) => {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
      event.preventDefault();
    }
    const user = getUser();
    if (!user) {
      setStatus('未登录，无法加载云端');
      setAutoSyncStatus('noAuth');
      return;
    }
    setStatus('加载中…');
    setAutoSyncStatus('syncing');
    try {
      const syncKey = getSyncKey();
      const result = await cloudLoadLatest(syncKey);
      const message = (result && result.message) || '已加载云端数据';
      setStatus(message);
      await refreshPageData();
      setAutoSyncStatus('idle', { result });
    } catch (error) {
      console.error('[cloudSync] 加载云端失败', error);
      setStatus('加载失败：' + (error && error.message ? error.message : '未知错误'));
      setAutoSyncStatus('error', { error });
    }
  };

  if (btnSave) {
    btnSave.addEventListener('click', handleSave);
  }
  if (btnLoad) {
    btnLoad.addEventListener('click', handleLoad);
  }

  const refreshAuthState = () => {
    const user = getUser();
    const enabled = !!user;
    setButtonsEnabled(enabled);
    if (!enabled) {
      setStatus('未登录，云端功能已禁用');
    }
  };

  const storageHandler = (event) => {
    if (event && event.key === 'current_user_v1') {
      refreshAuthState();
    }
  };

  refreshAuthState();
  window.addEventListener('storage', storageHandler);

  return () => {
    if (btnSave) {
      btnSave.removeEventListener('click', handleSave);
    }
    if (btnLoad) {
      btnLoad.removeEventListener('click', handleLoad);
    }
    window.removeEventListener('storage', storageHandler);
  };
}

function initAutoSync(options = {}) {
  const {
    statusSelector = '#autoSyncStatus',
    saveBtnSelector = '#btnSaveCloud',
    loadBtnSelector = '#btnLoadCloud',
    debounceMs
  } = options;

  const statusEl = typeof statusSelector === 'string'
    ? document.querySelector(statusSelector)
    : statusSelector;
  const btnSave = typeof saveBtnSelector === 'string'
    ? document.querySelector(saveBtnSelector)
    : saveBtnSelector;
  const btnLoad = typeof loadBtnSelector === 'string'
    ? document.querySelector(loadBtnSelector)
    : loadBtnSelector;
  const setAutoSyncStatus = createAutoSyncStatusSetter(statusEl, statusSelector);

  const setButtonsEnabled = (enabled) => {
    [btnSave, btnLoad].forEach((btn) => {
      if (btn) {
        btn.disabled = !enabled;
        btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
        btn.classList.toggle('btn-disabled', !enabled);
      }
    });
  };

  const getUser = () => (window.supabaseApi && window.supabaseApi.getSessionUser
    ? window.supabaseApi.getSessionUser()
    : null);

  let stopListening = null;

  const handleStatusChange = (payload) => {
    if (!payload || typeof payload !== 'object') return;
    switch (payload.status) {
      case 'noAuth':
        setButtonsEnabled(false);
        setAutoSyncStatus('noAuth');
        return;
      case 'syncing':
      case 'idle':
      case 'listening':
      case 'stopped':
      case 'error':
        setAutoSyncStatus(payload.status, payload);
        break;
      default:
        setAutoSyncStatus('fallback', payload);
        break;
    }
  };

  const restartAutoSync = () => {
    if (stopListening) {
      stopListening();
    }
    stopListening = startAutoSync(handleStatusChange, { debounceMs });
  };

  const refreshAuthState = () => {
    const user = getUser();
    if (!user) {
      if (stopListening) {
        stopListening();
        stopListening = null;
      }
      setButtonsEnabled(false);
      setAutoSyncStatus('noAuth');
      return;
    }
    setButtonsEnabled(true);
    setAutoSyncStatus('initial');
    restartAutoSync();
  };

  const storageHandler = (event) => {
    if (event && event.key === 'current_user_v1') {
      refreshAuthState();
    }
  };

  setAutoSyncStatus('initial');
  refreshAuthState();
  window.addEventListener('storage', storageHandler);

  return () => {
    if (stopListening) {
      stopListening();
    }
    window.removeEventListener('storage', storageHandler);
  };
}

let autoSyncSessions = {};

async function startAutoSync(options = {}) {
  const key = options.key || getUserLiveKey();
  const interval = options.interval || DEFAULT_AUTOSYNC_INTERVAL;
  const onStatus = typeof options.onStatus === 'function' ? options.onStatus : () => {};

  if (autoSyncSessions[key]) {
    return autoSyncSessions[key];
  }

  const client = window.supabaseApi ? window.supabaseApi.getClient() : null;
  if (!client) {
    console.warn('[cloudSync] 自动同步跳过：Supabase 未初始化');
    onStatus({ status: 'offline', message: 'Supabase 未初始化' });
    return null;
  }

  const sessionUser = window.supabaseApi ? window.supabaseApi.getSessionUser() : null;
  if (!sessionUser) {
    console.warn('[cloudSync] 自动同步跳过：未登录用户');
    onStatus({ status: 'noAuth', message: '未登录，暂停自动同步' });
    return null;
  }

  const deviceId = ensureDeviceId();
  const session = {
    key,
    interval,
    timer: null,
    channel: null,
    running: false,
    cleanupFns: [],
    stop() {
      if (this.timer) clearInterval(this.timer);
      if (this.channel) client.removeChannel(this.channel);
      this.cleanupFns.forEach((fn) => {
        try { fn(); } catch (_) {}
      });
      autoSyncSessions[key] = null;
    }
  };

  function notify(status, extra = {}) {
    onStatus({ status, ...extra });
    window.dispatchEvent(new CustomEvent('autoSyncStatus', { detail: { status, ...extra } }));
  }

  async function push(reason = 'interval') {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      notify('offline', { reason });
      return;
    }
    if (session.running) return;
    session.running = true;
    notify('syncing', { reason });
    try {
      const result = await cloudSave(key);
      if (result && result.saved) {
        notify('synced', { message: result.message });
      } else if (result && result.skipped) {
        notify('idle', { message: result.message });
      } else {
        notify('idle');
      }
    } catch (err) {
      console.warn('[cloudSync] 自动保存失败', err);
      notify('error', { message: err.message || '自动保存失败' });
    } finally {
      session.running = false;
    }
  }

  async function pull(reason = 'remote') {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      notify('offline', { reason });
      return;
    }
    notify('pulling', { reason });
    try {
      await cloudLoadLatest(key);
      notify('synced', { reason });
    } catch (err) {
      console.warn('[cloudSync] 自动拉取失败', err);
      notify('error', { message: err.message || '自动拉取失败' });
    }
  }

  // 本地变更监听（去抖自动推送）
  const debouncedPush = debounce(() => push('local_change'), 800);
  window.addEventListener('dataChanged', debouncedPush);
  session.cleanupFns.push(() => window.removeEventListener('dataChanged', debouncedPush));

  // 立即拉取一次，确保最新
  pull('init');

  // 周期性推送
  session.timer = setInterval(push, interval);

  // Realtime 订阅：其他设备更新时自动拉取
  const userTag = sessionUser ? `user:${sessionUser.username}` : null;

  session.channel = client.channel(`titlelab_autosync_${key}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'titlelab_snapshot',
      filter: `key=eq.${key}`
    }, (payload) => {
      const remoteDevice = payload?.new?.payload?.meta?.device_id;
      if (remoteDevice && remoteDevice === deviceId) {
        return;
      }
      pull('realtime_snapshot');
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'titles'
    }, (payload) => {
      const tags = payload?.new?.scene_tags || payload?.old?.scene_tags;
      if (userTag && (!Array.isArray(tags) || !tags.includes(userTag))) return;
      pull('realtime_titles');
    })
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'contents'
    }, (payload) => {
      const tags = payload?.new?.scene_tags || payload?.old?.scene_tags;
      if (userTag && (!Array.isArray(tags) || !tags.includes(userTag))) return;
      pull('realtime_contents');
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        notify('listening');
      }
    });

  // 页面激活时的监听需要可清理
  const focusHandler = () => push('focus');
  const visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      push('visible');
    }
  };
  window.addEventListener('focus', focusHandler);
  document.addEventListener('visibilitychange', visibilityHandler);
  session.cleanupFns.push(() => window.removeEventListener('focus', focusHandler));
  session.cleanupFns.push(() => document.removeEventListener('visibilitychange', visibilityHandler));

  autoSyncSessions[key] = session;
  notify('ready', { deviceId, key, interval });
  return session;
}

// 导出 API
if (typeof window !== 'undefined') {
  window.cloudSync = {
    DEFAULT_SNAPSHOT_KEY,
    getUserLiveKey,
    cloudSave,
    cloudLoadLatest,
    hasLocalDirty,
    startAutoSync,
    aggregateLocalData,
    normalizePayload,
    getPayloadHash,
    hashPayload,  // 别名
    buildLocalPayload,
    buildSnapshotLabel,
    formatYYYYMMDDLocal,
    getClientVersion,
    push,
    pull,
    startAutoSync,
    bindCloudButtons,
    initAutoSync,
    getUserLiveKey
  };
  // 同时将 cloudLoadLatest 导出到全局，方便页面直接调用
  window.cloudLoadLatest = cloudLoadLatest;
}
