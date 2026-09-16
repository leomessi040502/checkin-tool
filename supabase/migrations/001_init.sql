-- ============================================================
-- 多人打卡工具 数据库初始化脚本
-- 包含：profiles、checkins、countdowns、goals 四张表
-- 以及 RLS 行级安全策略和唯一约束
-- ============================================================

-- ============================================================
-- profiles 表：扩展用户名信息
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(20) NOT NULL CHECK (char_length(username) >= 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- username 唯一约束
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON profiles(username);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- 所有认证用户可查询（全员可见）
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT TO authenticated USING (true);
-- 用户只能插入自己的 profile
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
-- 用户只能更新自己的 profile
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ============================================================
-- checkins 表：打卡记录
-- ============================================================
CREATE TABLE IF NOT EXISTS checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category VARCHAR(10) NOT NULL CHECK (category IN ('study', 'life', 'sport')),
  checkin_date DATE NOT NULL,
  note VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 联合唯一约束：同人同分类同日期仅一条记录
CREATE UNIQUE INDEX IF NOT EXISTS checkins_user_category_date_unique
  ON checkins(user_id, category, checkin_date);

-- RLS
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
-- 所有认证用户可查询（全员可见打卡记录）
CREATE POLICY "checkins_select_all" ON checkins FOR SELECT TO authenticated USING (true);
-- 用户只能插入自己的打卡
CREATE POLICY "checkins_insert_own" ON checkins FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- 用户只能更新自己的打卡
CREATE POLICY "checkins_update_own" ON checkins FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- 用户只能删除自己的打卡
CREATE POLICY "checkins_delete_own" ON checkins FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- countdowns 表：倒计时事项
-- ============================================================
CREATE TABLE IF NOT EXISTS countdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(30) NOT NULL,
  target_date DATE NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('shared', 'personal')),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE countdowns ENABLE ROW LEVEL SECURITY;
-- 所有认证用户可查询
CREATE POLICY "countdowns_select_all" ON countdowns FOR SELECT TO authenticated USING (true);
-- 所有认证用户可插入
CREATE POLICY "countdowns_insert_all" ON countdowns FOR INSERT TO authenticated WITH CHECK (true);
-- 共享倒计时所有人可更新；个人倒计时仅创建者可更新
CREATE POLICY "countdowns_update_all" ON countdowns FOR UPDATE TO authenticated
  USING (type = 'shared' OR creator_id = auth.uid())
  WITH CHECK (type = 'shared' OR creator_id = auth.uid());
-- 共享倒计时所有人可删除；个人倒计时仅创建者可删除
CREATE POLICY "countdowns_delete_all" ON countdowns FOR DELETE TO authenticated
  USING (type = 'shared' OR creator_id = auth.uid());

-- ============================================================
-- goals 表：目标
-- ============================================================
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(30) NOT NULL,
  category VARCHAR(10) NOT NULL CHECK (category IN ('study', 'life', 'sport')),
  type VARCHAR(10) NOT NULL CHECK (type IN ('periodic', 'lifelong')),
  target_count INTEGER NOT NULL CHECK (target_count > 0),
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
-- 所有认证用户可查询（个人目标全员可见）
CREATE POLICY "goals_select_all" ON goals FOR SELECT TO authenticated USING (true);
-- 仅创建者可插入
CREATE POLICY "goals_insert_own" ON goals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- 仅创建者可更新
CREATE POLICY "goals_update_own" ON goals FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- 仅创建者可删除
CREATE POLICY "goals_delete_own" ON goals FOR DELETE TO authenticated USING (user_id = auth.uid());
