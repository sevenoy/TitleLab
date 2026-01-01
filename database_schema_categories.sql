-- ============================================================
-- 分类和账号分类即时同步数据库表
-- 创建日期: 2026-01-01
-- 用途: 将分类从 localStorage 迁移到数据库，实现 Realtime 即时同步
-- ============================================================

-- 1. 用户分类表（标题分类和文案分类）
CREATE TABLE IF NOT EXISTS user_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_tag TEXT NOT NULL,  -- 用户标签，例如: "user:olina"
  category_type TEXT NOT NULL CHECK (category_type IN ('title', 'content')),  -- 分类类型: title 或 content
  category_name TEXT NOT NULL,  -- 分类名称
  display_order INTEGER DEFAULT 0,  -- 显示顺序
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_category UNIQUE(user_tag, category_type, category_name)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_categories_user_tag ON user_categories(user_tag);
CREATE INDEX IF NOT EXISTS idx_user_categories_type ON user_categories(category_type);
CREATE INDEX IF NOT EXISTS idx_user_categories_composite ON user_categories(user_tag, category_type, display_order);

-- 添加注释
COMMENT ON TABLE user_categories IS '用户分类表，存储标题分类和文案分类';
COMMENT ON COLUMN user_categories.user_tag IS '用户标签，格式: user:{username}';
COMMENT ON COLUMN user_categories.category_type IS '分类类型: title 表示标题分类, content 表示文案分类';
COMMENT ON COLUMN user_categories.category_name IS '分类名称，不包括"全部"';
COMMENT ON COLUMN user_categories.display_order IS '显示顺序，数字越小越靠前';

-- 2. 用户账号分类表（场景分类）
CREATE TABLE IF NOT EXISTS user_account_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_tag TEXT NOT NULL,  -- 用户标签，例如: "user:olina"
  account_category_name TEXT NOT NULL,  -- 账号分类名称
  display_order INTEGER DEFAULT 0,  -- 显示顺序
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_account_category UNIQUE(user_tag, account_category_name)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_user_account_categories_user_tag ON user_account_categories(user_tag);
CREATE INDEX IF NOT EXISTS idx_user_account_categories_order ON user_account_categories(user_tag, display_order);

-- 添加注释
COMMENT ON TABLE user_account_categories IS '用户账号分类表，存储场景分类（账号管理）';
COMMENT ON COLUMN user_account_categories.user_tag IS '用户标签，格式: user:{username}';
COMMENT ON COLUMN user_account_categories.account_category_name IS '账号分类名称';
COMMENT ON COLUMN user_account_categories.display_order IS '显示顺序，数字越小越靠前';

-- 3. 创建触发器，自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为 user_categories 表创建触发器
DROP TRIGGER IF EXISTS update_user_categories_updated_at ON user_categories;
CREATE TRIGGER update_user_categories_updated_at
  BEFORE UPDATE ON user_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 为 user_account_categories 表创建触发器
DROP TRIGGER IF EXISTS update_user_account_categories_updated_at ON user_account_categories;
CREATE TRIGGER update_user_account_categories_updated_at
  BEFORE UPDATE ON user_account_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 4. 启用 Row Level Security (RLS) - 可选，根据需要启用
-- ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE user_account_categories ENABLE ROW LEVEL SECURITY;

-- 5. 授予公共访问权限（如果禁用了 RLS）
-- 注意：生产环境建议启用 RLS 并配置适当的策略
GRANT ALL ON user_categories TO anon, authenticated;
GRANT ALL ON user_account_categories TO anon, authenticated;

-- ============================================================
-- 执行说明：
-- 1. 在 Supabase Dashboard 的 SQL Editor 中执行此脚本
-- 2. 执行成功后，在前端代码中运行数据迁移函数
-- 3. 验证数据迁移成功后，即可享受即时同步功能
-- ============================================================

