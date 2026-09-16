-- ============================================================
-- categories 表：全局共享的自定义打卡分类
-- 所有人共用一套分类列表，任何人可增删改
-- ============================================================

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(20) NOT NULL,
  icon VARCHAR(10) DEFAULT '📌',
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 分类名称唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique ON categories(name);

-- RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- 所有认证用户可查询（全员可见）
CREATE POLICY "categories_select_all" ON categories FOR SELECT TO authenticated USING (true);
-- 所有认证用户可插入
CREATE POLICY "categories_insert_all" ON categories FOR INSERT TO authenticated WITH CHECK (true);
-- 所有认证用户可更新（任何人可重命名/修改分类）
CREATE POLICY "categories_update_all" ON categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
-- 所有认证用户可删除（任何人可删除分类）
CREATE POLICY "categories_delete_all" ON categories FOR DELETE TO authenticated USING (true);

-- ============================================================
-- 修改 checkins 表：category 字段改为关联 categories 表的 id
-- 注意：由于已有数据可能使用 study/life/sport 字符串，这里做迁移
-- ============================================================

-- 先添加新列 category_id
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- 数据迁移：将旧的字符串 category 映射到新的 category_id（如果 categories 表中有对应记录）
-- 这一步是可选的，取决于是否已有打卡数据
-- 如果是新项目或无数据，可以跳过

-- 保留旧 category 列以兼容现有代码，后续逐步迁移
