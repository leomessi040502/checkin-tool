-- ============================================================
-- goals 表：target_count 改为可空（目标次数和截止日期至少填一个）
-- ============================================================

ALTER TABLE goals ALTER COLUMN target_count DROP NOT NULL;

-- 保留 CHECK 约束：若填写则必须 > 0（PostgreSQL 中 NULL 不触发 CHECK）
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_target_count_check;
ALTER TABLE goals ADD CONSTRAINT goals_target_count_check CHECK (target_count IS NULL OR target_count > 0);
