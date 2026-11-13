import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import {
  AUTH_UNKNOWN,
  mergeAuthUser,
  isStale,
  shouldFinishLoading,
  isMissingSessionError,
  isNoRowsError,
} from '../utils/authState'

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

  // 每开始一次 auth 解析就递增，只有最新一代的结果允许写登录态，
  // 避免慢回调回来覆盖更新的状态（onAuthStateChange 竞态）。
  const authGenRef = useRef(0)

  /** 主动写入登录态（登录/注册/退出/改名等）：同时作废旧回调 */
  const commitUser = useCallback((next) => {
    authGenRef.current += 1
    setUser(next)
  }, [])

  /**
   * 解析当前登录用户，返回三态，必须区分：
   *   object    已登录
   *   null      明确未登录（没有 session / SIGNED_OUT）
   *   undefined 状态未知（网络失败、RLS 拒绝、超时、profile 查询报错）
   *
   * 旧版把「未知」也压成 null，导致一次查询抖动就把刚登录的用户踢回登录页。
   * 另外：事件回调里会传入 session.user，因此这里不再调用 supabase.auth.getUser()，
   * 避免在 auth 事件回调内部再次调用 auth 方法造成死锁。
   */
  const getCurrentUser = useCallback(async (authUser = null) => {
    try {
      let currentUser = authUser
      if (!currentUser) {
        const { data, error } = await withTimeoutToast(supabase.auth.getUser())
        if (error) {
          // 本地没有 session 是「明确未登录」，不是网络问题，立即放行到登录页
          return isMissingSessionError(error) ? null : AUTH_UNKNOWN
        }
        currentUser = data?.user ?? null
      }
      if (!currentUser) return null

      const { data: profile, error: profileError } = await withTimeoutToast(
        supabase
          .from('profiles')
          .select('username')
          .eq('id', currentUser.id)
          .single(),
      )
      // .single() 查到 0 行是「确实没有 profile」，仍算已登录；
      // 其余（断网 / RLS 拒绝 / 超时）才是状态未知
      if (profileError && !isNoRowsError(profileError)) return AUTH_UNKNOWN

      return {
        id: currentUser.id,
        email: currentUser.email,
        username: profile?.username || null,
      }
    } catch {
      return AUTH_UNKNOWN
    }
  }, [])

  useEffect(() => {
    let active = true
    let fallback = null

    /** 只有最新一代的结果才落地；未知结果由 mergeAuthUser 保留现状 */
    const settle = (token, result) => {
      if (!active || isStale(token, authGenRef.current)) return
      setUser((current) => mergeAuthUser(current, result))
      // 状态未知：保留登录态与 loading，交给后续 auth 事件或 12 秒兜底，
      // 绝不能因为一次网络抖动就解除 loading、把用户踢回登录页
      if (!shouldFinishLoading(result)) return
      if (fallback) {
        clearTimeout(fallback)
        fallback = null
      }
      setLoading(false)
    }

    const initialToken = ++authGenRef.current
    getCurrentUser()
      .then((u) => settle(initialToken, u))
      .catch(() => settle(initialToken, AUTH_UNKNOWN))

    // 兜底：万一 auth 事件回调始终没来、或一直网络失败，也不能永远卡在「加载中…」
    fallback = setTimeout(() => {
      if (active) setLoading(false)
    }, 12000)

    let subscription
    try {
      const result = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return
        const token = ++authGenRef.current
        if (!session?.user) {
          // 明确登出无需发请求，同步落地即可
          settle(token, null)
          return
        }
        // GoTrue 的 INITIAL_SESSION 等事件可能在其内部锁内派发，
        // 回调里直接 await supabase 方法（from() 内部会取 session）有死锁风险。
        // 用宏任务让出当前调用栈再发请求，这是 Supabase 官方推荐做法。
        setTimeout(() => {
          if (!active || isStale(token, authGenRef.current)) return
          getCurrentUser(session.user)
            .then((u) => settle(token, u))
            .catch(() => settle(token, AUTH_UNKNOWN))
        }, 0)
      })
      subscription = result.data.subscription
    } catch {
      setLoading(false)
    }

    return () => {
      active = false
      if (fallback) clearTimeout(fallback)
      subscription?.unsubscribe()
    }
  }, [getCurrentUser])

  const signIn = async (username, password) => {
    const email = `${username}@checkin.local`
    const { data, error } = await withTimeoutToast(
      supabase.auth.signInWithPassword({ email, password }),
    )
    if (error) throw error
    if (!data?.user) throw new Error('SIGNIN_NO_USER')

    // 登录成功后必须能取到 profile。这一步以前走 getCurrentUser()，
    // 而它 catch 掉所有异常并返回 null，导致「账号密码都对、Auth 也登录成功，
    // 但 REST 查询断网」时 setUser(null)、页面静默弹回登录页且没有任何提示。
    // 这里显式检查 error 并让错误冒泡到 LoginPage，由 describeAuthError 给出准确提示。
    const { data: profile, error: profileError } = await withTimeoutToast(
      supabase
        .from('profiles')
        .select('username')
        .eq('id', data.user.id)
        .single(),
    )
    if (profileError) throw profileError

    commitUser({
      id: data.user.id,
      email: data.user.email,
      username: profile?.username || null,
    })
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

    commitUser({ id: data.user.id, email: data.user.email, username })
  }

  const signOut = async () => {
    await withTimeoutToast(supabase.auth.signOut())
    commitUser(null)
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
      commitUser({ ...user, username: newUsername })
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
    commitUser({ ...user, username: newUsername })
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
    commitUser(null)
  }

  // getCurrentUser 返回三态（含 undefined=状态未知），仅供应内部竞态逻辑使用，
  // 不再暴露给页面，避免被调用方当成「真假值」误判为未登录。
  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, updateUsername, updatePassword, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return context
}
