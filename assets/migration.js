/**
 * 数据迁移模块
 * 用途：将 localStorage 中的分类数据迁移到 Supabase 数据库
 * 执行时机：页面加载时自动检查并执行一次
 */

console.log('[Migration] 数据迁移模块已加载');

// 迁移状态标记（v2：合并 title 和 content 为 shared）
const MIGRATION_FLAG_KEY = 'categories_migration_completed_v2';

/**
 * 检查是否已完成迁移
 */
function isMigrationCompleted() {
  return localStorage.getItem(MIGRATION_FLAG_KEY) === 'true';
}

/**
 * 标记迁移已完成
 */
function markMigrationCompleted() {
  localStorage.setItem(MIGRATION_FLAG_KEY, 'true');
  console.log('[Migration] ✅ 迁移标记已设置');
}

/**
 * 迁移分类到数据库（合并标题和文案分类为共享分类）
 */
async function migrateSharedCategories(username, userTag) {
  const supabase = window.supabaseClient;
  if (!supabase) {
    console.warn('[Migration] Supabase 客户端未初始化，跳过分类迁移');
    return { success: false, count: 0 };
  }

  const titleCatsKey = `title_categories_v1_${username}`;
  const contentCatsKey = `content_categories_v1_${username}`;
  const titleCatsStr = localStorage.getItem(titleCatsKey);
  const contentCatsStr = localStorage.getItem(contentCatsKey);
  
  // 合并标题和文案分类
  const allCategories = new Set();
  
  if (titleCatsStr) {
    try {
      const titleCats = JSON.parse(titleCatsStr);
      titleCats.filter(c => c !== '全部').forEach(c => allCategories.add(c));
    } catch (e) {
      console.warn('[Migration] 解析标题分类失败:', e);
    }
  }
  
  if (contentCatsStr) {
    try {
      const contentCats = JSON.parse(contentCatsStr);
      contentCats.filter(c => c !== '全部').forEach(c => allCategories.add(c));
    } catch (e) {
      console.warn('[Migration] 解析文案分类失败:', e);
    }
  }
  
  const categoriesToSave = Array.from(allCategories);
  
  if (categoriesToSave.length === 0) {
    console.log('[Migration] 未找到需要迁移的分类数据');
    return { success: true, count: 0 };
  }

  try {
    // 构建要插入的数据（使用 shared 类型）
    const rows = categoriesToSave.map((name, index) => ({
      user_tag: userTag,
      category_type: 'shared',
      category_name: name,
      display_order: index
    }));

    console.log(`[Migration] 准备迁移 ${rows.length} 个共享分类:`, rows);

    // 先删除该用户的旧分类（title 和 content 类型）
    await supabase
      .from('user_categories')
      .delete()
      .eq('user_tag', userTag)
      .in('category_type', ['title', 'content', 'shared']);

    // 插入新的共享分类
    const { error: insertError } = await supabase
      .from('user_categories')
      .insert(rows);

    if (insertError) {
      throw insertError;
    }

    console.log(`[Migration] ✅ 共享分类迁移成功: ${rows.length} 条`);
    return { success: true, count: rows.length };

  } catch (error) {
    console.error('[Migration] ❌ 共享分类迁移失败:', error);
    return { success: false, count: 0, error };
  }
}

/**
 * 迁移账号分类到数据库
 */
async function migrateAccountCategories(username, userTag) {
  const supabase = window.supabaseClient;
  if (!supabase) {
    console.warn('[Migration] Supabase 客户端未初始化，跳过账号分类迁移');
    return { success: false, count: 0 };
  }

  const settingsKey = `display_settings_v1_${username}`;
  const settingsStr = localStorage.getItem(settingsKey);
  
  if (!settingsStr) {
    console.log('[Migration] 未找到账号分类数据，跳过迁移');
    return { success: true, count: 0 };
  }

  try {
    const settings = JSON.parse(settingsStr);
    const scenes = settings.scenes || [];
    
    if (scenes.length === 0) {
      console.log('[Migration] 账号分类为空，跳过迁移');
      return { success: true, count: 0 };
    }

    // 构建要插入的数据
    const rows = scenes.map((name, index) => ({
      user_tag: userTag,
      account_category_name: name,
      display_order: index
    }));

    console.log(`[Migration] 准备迁移 ${rows.length} 个账号分类:`, rows);

    // 先删除该用户的旧账号分类（如果有）
    const { error: deleteError } = await supabase
      .from('user_account_categories')
      .delete()
      .eq('user_tag', userTag);

    if (deleteError) {
      console.warn('[Migration] 删除旧账号分类时出错（可能是首次迁移）:', deleteError);
    }

    // 插入新账号分类
    const { error: insertError } = await supabase
      .from('user_account_categories')
      .insert(rows);

    if (insertError) {
      throw insertError;
    }

    console.log(`[Migration] ✅ 账号分类迁移成功: ${rows.length} 条`);
    return { success: true, count: rows.length };

  } catch (error) {
    console.error('[Migration] ❌ 账号分类迁移失败:', error);
    return { success: false, count: 0, error };
  }
}

/**
 * 执行完整的数据迁移
 */
async function runMigration() {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'migration.js:runMigration',message:'Migration check START',data:{},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1',runId:'diagnose-shared'})}).catch(()=>{});
  // #endregion
  
  console.log('[Migration] 🚀 开始数据迁移检查...');

  // 检查是否已完成迁移
  if (isMigrationCompleted()) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'migration.js:runMigration',message:'Migration already completed',data:{flagKey:MIGRATION_FLAG_KEY},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1',runId:'diagnose-shared'})}).catch(()=>{});
    // #endregion
    console.log('[Migration] ℹ️ 迁移已完成，跳过');
    return { alreadyCompleted: true };
  }

  // 获取当前用户
  const user = window.getCurrentUser ? window.getCurrentUser() : null;
  if (!user || !user.username) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/adb2fd91-9ad8-4bb1-a0ba-9bef5d4d03cd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'migration.js:runMigration',message:'No user found, migration postponed',data:{hasUser:!!user},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1',runId:'diagnose-shared'})}).catch(()=>{});
    // #endregion
    console.warn('[Migration] ⚠️ 未找到当前用户，推迟迁移');
    return { success: false, reason: 'no_user' };
  }

  const username = user.username;
  const userTag = `user:${username}`;

  console.log(`[Migration] 当前用户: ${username}, 标签: ${userTag}`);

  // 等待 Supabase 客户端初始化
  let retries = 0;
  while (!window.supabaseClient && retries < 10) {
    console.log(`[Migration] 等待 Supabase 客户端初始化... (${retries + 1}/10)`);
    await new Promise(resolve => setTimeout(resolve, 500));
    retries++;
  }

  if (!window.supabaseClient) {
    console.error('[Migration] ❌ Supabase 客户端未初始化，迁移失败');
    return { success: false, reason: 'no_supabase' };
  }

  try {
    // 执行迁移任务
    const sharedCatsResult = await migrateSharedCategories(username, userTag);
    const accountResult = await migrateAccountCategories(username, userTag);

    // 汇总结果
    const totalCount = sharedCatsResult.count + accountResult.count;
    const allSuccess = sharedCatsResult.success && accountResult.success;

    if (allSuccess) {
      console.log(`[Migration] ✅ 所有数据迁移完成，共 ${totalCount} 条记录`);
      markMigrationCompleted();
      return {
        success: true,
        totalCount,
        details: {
          sharedCategories: sharedCatsResult.count,
          account: accountResult.count
        }
      };
    } else {
      console.error('[Migration] ❌ 部分迁移失败');
      return {
        success: false,
        details: {
          sharedCategories: sharedCatsResult,
          account: accountResult
        }
      };
    }

  } catch (error) {
    console.error('[Migration] ❌ 迁移过程中发生错误:', error);
    return { success: false, error };
  }
}

/**
 * 重置迁移状态（用于调试）
 */
function resetMigration() {
  localStorage.removeItem(MIGRATION_FLAG_KEY);
  console.log('[Migration] 🔄 迁移状态已重置，刷新页面后将重新迁移');
}

// 导出函数
window.categoryMigration = {
  runMigration,
  resetMigration,
  isMigrationCompleted
};

// 自动执行迁移（延迟2秒，确保其他模块已加载）
setTimeout(() => {
  runMigration();
}, 2000);

