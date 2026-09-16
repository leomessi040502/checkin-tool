-- ============================================================
-- 修复 checkins 表：移除旧的 category CHECK 约束
-- 旧的 category 字段有 CHECK (category IN ('study', 'life', 'sport'))
-- 改为允许任意值，因为现在用 category_id 关联 categories 表
-- ============================================================

-- 移除旧的 CHECK 约束
ALTER TABLE checkins DROP CONSTRAINT IF EXISTS checkins_category_check;

-- 移除旧的联合唯一索引（基于 category 字符串）
DROP INDEX IF EXISTS checkins_user_category_date_unique;

-- 创建新的联合唯一索引（基于 category_id）
CREATE UNIQUE INDEX IF NOT EXISTS checkins_user_categoryid_date_unique
  ON checkins(user_id, category_id, checkin_date);

-- 同样修复 goals 表的 category CHECK 约束
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_category_check;
