-- ============================================================
-- 008: 修复注册人数上限失效（原逻辑被 RLS 拦截导致永久放行）
--
-- 问题：注册预检在未登录（anon）状态下查询 profiles 的 count，
--       而 profiles 的 RLS 策略只对 authenticated 开放，
--       匿名查询被拦截返回 0/null，导致 `count >= 2` 永远为 false。
--
-- 方案：
--   1. get_profile_count()  SECURITY DEFINER 函数，绕过 RLS 返回真实人数
--   2. profiles 表 BEFORE INSERT 触发器，数据库层硬兜底，
--      绕过前端直接调用 API 注册也会被拒绝
-- ============================================================

-- ------------------------------------------------------------
-- 1. 获取真实用户数（供未登录的注册页预检使用）
--    SECURITY DEFINER：以函数所有者身份执行，绕过 RLS
--    仅返回数量，不泄露任何用户数据
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profile_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.profiles;
$$;

-- 允许匿名（注册页）和已登录用户调用
GRANT EXECUTE ON FUNCTION public.get_profile_count() TO anon, authenticated;

-- ------------------------------------------------------------
-- 2. 数据库层硬兜底：插入 profile 前校验人数上限
--    上限在此调整（当前：2 人）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profile_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_users CONSTANT integer := 2;
  current_count integer;
BEGIN
  SELECT COUNT(*) INTO current_count FROM public.profiles;

  IF current_count >= max_users THEN
    RAISE EXCEPTION 'USER_LIMIT_REACHED'
      USING HINT = '圈子人数已满（上限 ' || max_users || ' 人）';
  END IF;

  RETURN NEW;
END;
$$;

-- 建触发器（重复执行本脚本时先删后建，避免重复触发）
DROP TRIGGER IF EXISTS trg_enforce_profile_limit ON public.profiles;

CREATE TRIGGER trg_enforce_profile_limit
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_limit();

-- ------------------------------------------------------------
-- 验证语句（执行后可在 SQL Editor 单独运行确认）
--   SELECT public.get_profile_count();          -- 应返回真实人数
--   SELECT public.enforce_profile_limit();      -- 无需手动调用，仅确认函数存在
-- ------------------------------------------------------------
