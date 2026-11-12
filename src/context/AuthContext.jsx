import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'

const AuthContext = createContext(null)

/** 圈子人数上限（与数据库 enforce_profile_limit() 中的 max_users 保持一致） */
const MAX_USERS = 2

/**
 * 获取真实注册人数
 * 注意：profiles 表的 RLS 只对 authenticated 开放，未登录状态下直接查询会被拦截返回 0，
 * 因此必须走 SECURITY DEFINER 的 get_profile_count() RPC（见迁移 008_signup_limit.sql）。
 *
 * RPC 调用失败（含未执行迁移时的 PGRST202 / 42883）一律返回 null，不阻塞注册；
 * 真正的人数硬保障由数据库触发器 enforce_profile_limit() 提供。
 */
async function fetchProfileCount() {
  const { data, error } = await withTimeoutToast(supabase.rpc('get_profile_count'))
  if (error) {
    console.warn('[AuthContext] 人数查询失败:', error.code, error.message)
    return null
  }
  return typeof data === 'number' ? data : null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const getCurrentUser = useCallback(async (authUser = null) => {
    try {
      const currentUser = authUser || (await withTimeoutToast(supabase.auth.getUser())).data.user
      if (!currentUser) return null

      const { data: profile } = await withTimeoutToast(supabase
        .from('profiles')
        .select('username')
        .eq('id', currentUser.id)
        .single())

      return {
        id: currentUser.id,
        email: currentUser.email,
        username: profile?.username || null,
      }
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    let active = true

    getCurrentUser()
      .then((u) => {
        if (active) setUser(u)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    let subscription
    try {
      const result = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!active) return
        if (session?.user) {
          const u = await getCurrentUser(session.user)
          if (active) setUser(u)
        } else {
          setUser(null)
        }
        setLoading(false)
      })
      subscription = result.data.subscription
    } catch {
      setLoading(false)
    }

    return () => {
      active = false
      subscription?.unsubscribe()
    }
  }, [getCurrentUser])

  const signIn = async (username, password) => {
    const email = `${username}@checkin.local`
    const { data, error } = await withTimeoutToast(supabase.auth.signInWithPassword({ email, password }))
    if (error) throw error
    if (data.user) {
      const u = await getCurrentUser(data.user)
      setUser(u)
    }
  }

  const signUp = async (username, password) => {
    // 1. 匿名查询 profiles 会被 RLS 拦截（返回 0 行），查重不可靠。
    //    真实查重由 auth.users.email 唯一性保证（登录邮箱 = <username>@checkin.local），
    //    下面的错误码映射负责给出准确的「用户名已被使用」提示。

    // 2. 检查注册人数是否达到上限（走 RPC，绕过 RLS）
    const count = await fetchProfileCount()
    if (count !== null && count >= MAX_USERS) {
      throw new Error('USER_LIMIT_REACHED')
    }

    // 3. 调用 Supabase Auth 注册
    const email = `${username}@checkin.local`
    const { data, error } = await withTimeoutToast(supabase.auth.signUp({ email, password }))
    if (error) {
      const msg = String(error.message || '')
      if (/already registered|already exists|user_already_exists|duplicate key|23505/i.test(msg) || error.status === 422) {
        throw new Error('USERNAME_EXISTS')
      }
      throw error
    }
    if (!data?.user) {
      // 邮箱已被占用但项目开启防枚举时可能不返回用户，按重名处理
      throw new Error('USERNAME_EXISTS')
    }

    // 4. 写入 profiles。失败时必须清理刚创建的 auth 用户，否则会留下
    //    「能登录但没有昵称、且永久占用该假邮箱」的孤儿账号。
    const { error: profileError } = await withTimeoutToast(supabase
      .from('profiles')
      .insert({ id: data.user.id, username }))
    if (profileError) {
      try {
        await withTimeoutToast(supabase.rpc('delete_own_account'))
        try {
          await supabase.auth.signOut()
        } catch {
          // 账号已删除，session 清理失败可忽略
        }
      } catch (cleanupErr) {
        console.warn('[AuthContext] 注册回滚清理失败:', cleanupErr)
      }
      // 数据库触发器兜底拒绝（绕过前端直接注册）
      if (String(profileError.message || '').includes('USER_LIMIT_REACHED')) {
        throw new Error('USER_LIMIT_REACHED')
      }
      throw new Error('PROFILE_CREATE_FAILED')
    }

    setUser({ id: data.user.id, email: data.user.email, username })
  }

  const signOut = async () => {
    await withTimeoutToast(supabase.auth.signOut())
    setUser(null)
  }

  /**
   * 修改用户名
   *
   * 注意：用户名同时是登录凭据的一部分（登录邮箱 = `<username>@checkin.local`）。
   * 因此必须走 update_own_username() RPC 同步更新 profiles.username 与 auth.users.email，
   * 否则改名后新名字在别的设备上登不上（历史 bug）。
   * 若迁移 009 尚未执行（RPC 不存在，PGRST202 / 42883），降级为旧的"仅改显示名"逻辑。
   */
  const updateUsername = async (newUsername) => {
    if (!user) throw new Error('未登录')

    // 校验用户名格式
    if (!newUsername || newUsername.length < 2 || newUsername.length > 20) {
      throw new Error('用户名需2-20字符')
    }

    // 1. 优先：走 RPC 同步昵称与登录邮箱
    const { error: rpcError } = await withTimeoutToast(
      supabase.rpc('update_own_username', { p_username: newUsername }),
    )

    if (!rpcError) {
      setUser({ ...user, username: newUsername })
      return
    }

    // 2. 重名等明确错误：直接抛给页面提示
    if (String(rpcError.message || '').includes('USERNAME_EXISTS')) {
      throw new Error('USERNAME_EXISTS')
    }

    // 3. RPC 不存在（迁移未执行）→ 降级为旧逻辑：仅更新 profiles 显示名
    const fnMissing = rpcError.code === 'PGRST202' || rpcError.code === '42883'
    if (!fnMissing) {
      throw rpcError
    }

    // 检查用户名是否已被使用（排除自己）
    const { data: existing } = await withTimeoutToast(supabase
      .from('profiles')
      .select('id')
      .eq('username', newUsername)
      .neq('id', user.id)
      .maybeSingle())

    if (existing) {
      throw new Error('USERNAME_EXISTS')
    }

    // 更新 profiles 表
    const { error } = await withTimeoutToast(supabase
      .from('profiles')
      .update({ username: newUsername })
      .eq('id', user.id))

    if (error) throw error

    // 更新本地 user 状态
    setUser({ ...user, username: newUsername })
  }

  /** 修改密码 */
  const updatePassword = async (newPassword) => {
    if (!user) throw new Error('未登录')

    // 校验密码格式
    if (!newPassword || newPassword.length < 6 || newPassword.length > 20) {
      throw new Error('密码需6-20字符')
    }

    const { error } = await withTimeoutToast(supabase.auth.updateUser({ password: newPassword }))
    if (error) throw error
  }

  /** 注销账号（需要密码验证）
   *  1. 用 signInWithPassword 验证密码
   *  2. 调用 RPC delete_own_account 删除 auth.users 记录（级联清理所有数据）
   *  3. signOut 清理本地状态
   */
  const deleteAccount = async (password) => {
    if (!user) throw new Error('未登录')
    if (!password) throw new Error('PASSWORD_REQUIRED')

    // 1. 验证密码（通过重新登录）
    const { error: signInError } = await withTimeoutToast(
      supabase.auth.signInWithPassword({
        email: user.email,
        password,
      })
    )
    if (signInError) throw new Error('PASSWORD_INCORRECT')

    // 2. 调用 RPC 删除账号（级联清理所有数据）
    const { error: deleteError } = await withTimeoutToast(
      supabase.rpc('delete_own_account')
    )
    if (deleteError) throw deleteError

    // 3. 清理本地状态
    try {
      await supabase.auth.signOut()
    } catch {
      // 账号已删除，signOut 失败可忽略
    }
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, getCurrentUser, updateUsername, updatePassword, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return context
}
