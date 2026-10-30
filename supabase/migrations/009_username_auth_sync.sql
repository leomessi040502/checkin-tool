-- ============================================================
-- 009: 修改用户名时同步登录邮箱（auth.users.email）
-- ============================================================
-- 背景（bug）：
--   注册时登录凭据 = `${username}@checkin.local` 写入 auth.users.email；
--   但旧的「修改用户名」只更新 profiles.username（显示昵称），
--   不同步 auth.users.email，导致改名后：
--     - 已登录的电脑端仍正常（session 有效，界面读 profiles.username）
--     - 手机端用新名字登录失败（拼出的 email 在 auth.users 中不存在）
-- 修复：
--   1. 新增 SECURITY DEFINER 函数 update_own_username()，
--      在一次原子操作中同时更新 profiles.username 与 auth.users.email；
--      auth.uid() 限定只能改自己，防止越权。
--      （前端无权限直接改 auth.users；而 supabase.auth.updateUser({email})
--        需要重新认证并向真实邮箱发确认邮件，本项目为假邮箱，不可用）
--   2. 一次性修复历史数据：把已改名但邮箱未跟上的账号同步回来。
-- ============================================================

-- 1. 改名函数（同步 profiles.username 与 auth.users.email）
CREATE OR REPLACE FUNCTION public.update_own_username(p_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := p_username || '@checkin.local';
BEGIN
  -- 未登录
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- 格式校验：2-20 位中英文数字（与前端一致）
  IF p_username IS NULL OR char_length(p_username) < 2 OR char_length(p_username) > 20
     OR p_username !~ '^[一-龥a-zA-Z0-9]{2,20}$' THEN
    RAISE EXCEPTION 'INVALID_USERNAME';
  END IF;

  -- 昵称重名校验
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = p_username AND id <> v_uid) THEN
    RAISE EXCEPTION 'USERNAME_EXISTS';
  END IF;

  -- 登录邮箱冲突（别人当初注册用的就是这个名字）
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email AND id <> v_uid) THEN
    RAISE EXCEPTION 'USERNAME_EXISTS';
  END IF;

  UPDATE public.profiles
     SET username = p_username
   WHERE id = v_uid;

  UPDATE auth.users
     SET email = v_email,
         updated_at = now()
   WHERE id = v_uid;

EXCEPTION
  WHEN unique_violation THEN
    -- 兜底：邮箱唯一约束冲突时统一按重名处理（上面的更新会整体回滚）
    RAISE EXCEPTION 'USERNAME_EXISTS';
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_username(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_own_username(text) TO authenticated;

-- 2. 一次性修复历史数据：已改名但邮箱未同步的账号
DO $$
DECLARE
  v_count int := 0;
BEGIN
  UPDATE auth.users u
     SET email = p.username || '@checkin.local',
         updated_at = now()
    FROM public.profiles p
   WHERE p.id = u.id
     AND p.username IS NOT NULL
     AND u.email <> p.username || '@checkin.local'
     -- 跳过会造成邮箱冲突的账号，避免整段迁移失败
     AND NOT EXISTS (
       SELECT 1 FROM auth.users u2
        WHERE u2.email = p.username || '@checkin.local'
          AND u2.id <> u.id
     );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '[009] 已同步 % 个账号的登录邮箱', v_count;
END;
$$;
