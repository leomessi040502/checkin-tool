import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'

const AuthContext = createContext(null)

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
    // 1. 检查用户名是否已存在
    const { data: existing } = await withTimeoutToast(supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle())

    if (existing) {
      throw new Error('USERNAME_EXISTS')
    }

    // 2. 检查注册人数是否达到2人上限
    const { count } = await withTimeoutToast(supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }))

    if (count >= 2) {
      throw new Error('USER_LIMIT_REACHED')
    }

    // 3. 调用 Supabase Auth 注册
    const email = `${username}@checkin.local`
    const { data, error } = await withTimeoutToast(supabase.auth.signUp({ email, password }))
    if (error) throw error

    // 4. 在 profiles 表插入记录
    if (data.user) {
      const { error: profileError } = await withTimeoutToast(supabase
        .from('profiles')
        .insert({ id: data.user.id, username }))
      if (profileError) throw profileError

      setUser({ id: data.user.id, email: data.user.email, username })
    }
  }

  const signOut = async () => {
    await withTimeoutToast(supabase.auth.signOut())
    setUser(null)
  }

  /** 修改用户名 */
  const updateUsername = async (newUsername) => {
    if (!user) throw new Error('未登录')

    // 校验用户名格式
    if (!newUsername || newUsername.length < 2 || newUsername.length > 20) {
      throw new Error('用户名需2-20字符')
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

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, getCurrentUser, updateUsername, updatePassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth 必须在 AuthProvider 内使用')
  return context
}
