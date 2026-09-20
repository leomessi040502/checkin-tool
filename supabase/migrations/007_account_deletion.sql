-- ============================================================
-- 007: 用户自注销账号功能
-- 通过 SECURITY DEFINER 函数删除 auth.users 记录
-- 所有相关表（profiles/checkins/categories/goals/countdowns）均通过
-- ON DELETE CASCADE 引用 auth.users，删除后自动级联清理
-- ============================================================

-- 创建用户自删除账号的函数
-- SECURITY DEFINER：以函数所有者（postgres）身份执行，可访问 auth.users 表
-- auth.uid() 限制只能删除当前登录用户，防止越权
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 删除 auth.users 记录，级联清理所有依赖数据：
  -- - profiles (ON DELETE CASCADE)
  -- - checkins (ON DELETE CASCADE)
  -- - categories (ON DELETE CASCADE)
  -- - goals (ON DELETE CASCADE)
  -- - countdowns (ON DELETE CASCADE)
  -- - goal_categories (通过 goals/categories 的 ON DELETE CASCADE 间接级联)
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- 允许所有认证用户调用
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
