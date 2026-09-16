-- ============================================================
-- goals 表：添加 category_id 列，关联 categories 表
-- ============================================================

-- 添加 category_id 列
ALTER TABLE goals ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- 移除旧的 category CHECK 约束（如果还存在于 004 迁移之前）
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_category_check;

-- 移除 category NOT NULL 约束（让旧字段可空）
ALTER TABLE goals ALTER COLUMN category DROP NOT NULL;
