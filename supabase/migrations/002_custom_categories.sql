-- ============================================================
-- categories 表：打卡分类（全局共享）
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(20) NOT NULL,
  icon VARCHAR(10) NOT NULL DEFAULT '📌',
  sort_order INTEGER NOT NULL DEFAULT 0,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 名称唯一约束（防止重名）
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique ON categories(name);

-- RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- 所有认证用户可查询
CREATE POLICY "categories_select_all" ON categories FOR SELECT TO authenticated USING (true);
-- 所有认证用户可插入
CREATE POLICY "categories_insert_all" ON categories FOR INSERT TO authenticated WITH CHECK (true);
-- 所有认证用户可更新（重命名、改图标）
CREATE POLICY "categories_update_all" ON categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
-- 所有认证用户可删除
CREATE POLICY "categories_delete_all" ON categories FOR DELETE TO authenticated USING (true);

-- 修改 checkins 表的 category 字段：从枚举改为自由字符串（引用分类名称）
-- 由于原 category 是 VARCHAR(10) CHECK 枚举，需要先删除约束再改为 VARCHAR(20)
ALTER TABLE checkins DROP CONSTRAINT IF EXISTS checkins_category_check;
ALTER TABLE checkins ALTER COLUMN category TYPE VARCHAR(20);

-- 同样修改 goals 表
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_category_check;
ALTER TABLE goals ALTER COLUMN category TYPE VARCHAR(20);
