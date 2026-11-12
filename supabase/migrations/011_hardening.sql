-- ============================================================
-- 011: 加固与迁移链补齐（2026-11-12 全项目审计）
-- 全部语句幂等，重复执行无害，可整段粘贴到 Supabase SQL Editor 执行
-- ============================================================

-- ------------------------------------------------------------
-- 1. 补齐迁移链：checkins.category 是历史遗留列，前端已统一改用 category_id
--    001 建表时为 NOT NULL，线上库已手动放宽为可空，但迁移文件从未记录这一步，
--    导致重建数据库时「打卡失败」。此处显式 DROP NOT NULL（线上再跑一次也无变化）。
-- ------------------------------------------------------------
ALTER TABLE checkins ALTER COLUMN category DROP NOT NULL;

-- ------------------------------------------------------------
-- 2. SECURITY DEFINER 函数统一加 SET search_path（与 008/009 一致，防 search_path 劫持）
--    同时补上 007 注释里遗漏的 todos 表（它同样是 ON DELETE CASCADE）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

-- ------------------------------------------------------------
-- 3. 倒计时新增权限收紧：只能以自己名义创建（防伪造 creator_id）
--    注意：编辑/删除保持「两人共同维护」规则不变（用户 2026-11-12 拍板），
--    因此 countdowns_update_all / countdowns_delete_all 两条策略不动。
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "countdowns_insert_all" ON countdowns;
DROP POLICY IF EXISTS "countdowns_insert_own" ON countdowns;
CREATE POLICY "countdowns_insert_own" ON countdowns FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

-- ------------------------------------------------------------
-- 4. 目标关联原子化：删旧 + 插新放在同一个事务里
--    原前端「先 DELETE 全部、再 INSERT」，中间失败会让目标进度归零。
--    函数内校验目标归属 + 只关联本人分类，避免越权。
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.replace_goal_categories(p_goal_id uuid, p_category_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.goals WHERE id = p_goal_id AND user_id = v_uid) THEN
    RAISE EXCEPTION 'NOT_ALLOWED';
  END IF;

  DELETE FROM public.goal_categories WHERE goal_id = p_goal_id;

  IF p_category_ids IS NOT NULL AND cardinality(p_category_ids) > 0 THEN
    INSERT INTO public.goal_categories (goal_id, category_id)
      SELECT p_goal_id, c.id
        FROM public.categories c
       WHERE c.id = ANY(p_category_ids)
         AND c.user_id = v_uid;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_goal_categories(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_goal_categories(uuid, uuid[]) TO authenticated;

-- ------------------------------------------------------------
-- 验证（执行后单独跑，预期见每条注释）
-- ------------------------------------------------------------
-- SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name='checkins' AND column_name='category';  -- YES
-- SELECT policyname FROM pg_policies WHERE tablename='countdowns' ORDER BY policyname;  -- 含 countdowns_insert_own，且仍含 update_all/delete_all
-- SELECT proname FROM pg_proc WHERE proname IN ('delete_own_account','replace_goal_categories');  -- 2 行
