-- ============================================================
-- 010: 待办（todos）表
-- 设计文档：docs/plans/2026-11-12-todo-page-design.md
-- 每条待办可选公开/私密（is_public，默认私密）
-- 公开条对方可见但不可改（RLS 层强制）
-- ============================================================

CREATE TABLE IF NOT EXISTS todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  note TEXT,
  due_date DATE,
  priority SMALLINT NOT NULL DEFAULT 2 CHECK (priority IN (1, 2, 3)),  -- 1=低 2=中 3=高
  is_public BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,  -- 空=未完成；非空=完成时间（状态与时间同源）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

-- 查询：公开条全员可见；私密条仅本人可见（RLS 直接不下发数据）
CREATE POLICY "todos_select" ON todos FOR SELECT TO authenticated
  USING (is_public = true OR user_id = auth.uid());

-- 增删改仅限本人
CREATE POLICY "todos_insert_own" ON todos FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "todos_update_own" ON todos FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "todos_delete_own" ON todos FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 验证（跑完看输出）：
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename = 'todos';
-- 预期 4 行：todos_select / todos_insert_own / todos_update_own / todos_delete_own
