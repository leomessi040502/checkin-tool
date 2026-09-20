-- ============================================================
-- 006: 分类改为按用户独立 + 目标多分类关联
-- ============================================================

-- ============================================================
-- 1. categories 表添加 user_id 列
-- ============================================================

ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 将现有分类的 user_id 设为 creator_id（分配给创建者）
UPDATE categories SET user_id = creator_id WHERE user_id IS NULL;

-- 添加 NOT NULL 约束
ALTER TABLE categories ALTER COLUMN user_id SET NOT NULL;

-- 删除旧的名称唯一约束（全局唯一），改为按用户唯一
DROP INDEX IF EXISTS categories_name_unique;
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name_unique ON categories(user_id, name);

-- ============================================================
-- 2. 更新 categories RLS 策略
-- ============================================================

-- 删除旧的策略
DROP POLICY IF EXISTS "categories_insert_all" ON categories;
DROP POLICY IF EXISTS "categories_update_all" ON categories;
DROP POLICY IF EXISTS "categories_delete_all" ON categories;

-- 新策略：仅自己可增删改自己的分类
CREATE POLICY "categories_insert_own" ON categories FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "categories_update_own" ON categories FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "categories_delete_own" ON categories FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 3. 新建 goal_categories 中间表
-- ============================================================

CREATE TABLE IF NOT EXISTS goal_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(goal_id, category_id)
);

-- RLS
ALTER TABLE goal_categories ENABLE ROW LEVEL SECURITY;
-- 所有认证用户可查询（全员可见目标关联）
CREATE POLICY "goal_categories_select_all" ON goal_categories FOR SELECT TO authenticated USING (true);
-- 仅目标创建者可增删（通过子查询验证）
CREATE POLICY "goal_categories_insert_own" ON goal_categories FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM goals WHERE goals.id = goal_categories.goal_id AND goals.user_id = auth.uid()));
CREATE POLICY "goal_categories_delete_own" ON goal_categories FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM goals WHERE goals.id = goal_categories.goal_id AND goals.user_id = auth.uid()));

-- ============================================================
-- 4. 迁移 goals.category_id 到 goal_categories，删除旧列
-- ============================================================

INSERT INTO goal_categories (goal_id, category_id)
  SELECT id, category_id FROM goals WHERE category_id IS NOT NULL
  ON CONFLICT DO NOTHING;

ALTER TABLE goals DROP COLUMN IF EXISTS category_id;
ALTER TABLE goals DROP COLUMN IF EXISTS category;

-- ============================================================
-- 5. 更新 checkins RLS：打卡时验证分类属于自己
-- ============================================================

DROP POLICY IF EXISTS "checkins_insert_own" ON checkins;
DROP POLICY IF EXISTS "checkins_update_own" ON checkins;

CREATE POLICY "checkins_insert_own" ON checkins FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM categories WHERE categories.id = checkins.category_id AND categories.user_id = auth.uid()
  ));
CREATE POLICY "checkins_update_own" ON checkins FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM categories WHERE categories.id = checkins.category_id AND categories.user_id = auth.uid()
    )
  );
