-- ============================================================
-- 012: 目标-待办关联与状态同步触发器
-- 设计文档：docs/plans/2026-11-26-goal-todo-sync-design.md
--
-- 1. todos.goal_id 关联目标（删除目标时自动解除关联，待办保留）
-- 2. goals.status 变更时自动同步关联待办的完成状态：
--    completed / expired（手动提前结束）→ 待办完成
--    active（重新开始）→ 待办恢复未完成
-- 幂等，可重复执行
-- ============================================================

ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS todos_goal_id_idx
  ON public.todos(goal_id) WHERE goal_id IS NOT NULL;

-- ------------------------------------------------------------
-- 状态同步触发器（SECURITY DEFINER：触发时以函数所有者身份更新 todos，绕过 todos 的 RLS）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_goal_todos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('completed', 'expired') THEN
    UPDATE public.todos
    SET completed_at = now(), updated_at = now()
    WHERE goal_id = NEW.id AND completed_at IS NULL;
  ELSIF NEW.status = 'active' THEN
    UPDATE public.todos
    SET completed_at = NULL, updated_at = now()
    WHERE goal_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_goal_todos ON public.goals;

CREATE TRIGGER trg_sync_goal_todos
AFTER UPDATE OF status ON public.goals
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_goal_todos();

-- 验证（执行后单独运行）：
--   SELECT tgname FROM pg_trigger WHERE tgname = 'trg_sync_goal_todos';  -- 应返回 1 行
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'todos' AND column_name = 'goal_id';            -- 应返回 1 行
