import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const USERNAME_REGEX = /^[\u4e00-\u9fa5a-zA-Z0-9]{2,20}$/
const PASSWORD_REGEX = /^[\u4e00-\u9fa5a-zA-Z0-9]{6,20}$/

/** 圈子人数上限（与 AuthContext / 数据库 enforce_profile_limit() 保持一致） */
const MAX_USERS = 2

function LoginPage() {
  const navigate = useNavigate()
  const { signIn, signUp, user, loading } = useAuth()

  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [userLimitReached, setUserLimitReached] = useState(false)

  // 已登录则跳转至首页
  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true })
  }, [user, loading, navigate])

  // 注册模式下预查人数上限
  // 注意：profiles 的 RLS 只对 authenticated 开放，匿名直接查询会被拦截返回 0，
  // 因此走 SECURITY DEFINER 的 get_profile_count() RPC（迁移 008_signup_limit.sql）
  useEffect(() => {
    if (mode !== 'register') return
    let active = true
    supabase
      .rpc('get_profile_count')
      .then(({ data, error }) => {
        if (!active) return
        // 查询失败（含未执行迁移）时不显示"人数已满"，避免误导
        if (error) {
          console.warn('[LoginPage] 人数查询失败:', error.code, error.message)
          return
        }
        if (typeof data === 'number' && data >= MAX_USERS) {
          setUserLimitReached(true)
          setError('圈子人数已满，联系成员获取账号')
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [mode])

  const usernameValid = USERNAME_REGEX.test(username)
  const passwordValid = PASSWORD_REGEX.test(password)
  const showUsernameError = username.length > 0 && !usernameValid
  const showPasswordError = password.length > 0 && !passwordValid

  const canSubmit =
    usernameValid && passwordValid && !submitting && !userLimitReached

  const handleModeSwitch = (newMode) => {
    setMode(newMode)
    setError('')
    setUserLimitReached(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setError('')

    try {
      if (mode === 'login') {
        await signIn(username, password)
      } else {
        await signUp(username, password)
      }
      navigate('/')
    } catch (err) {
      if (err.message === 'USERNAME_EXISTS') {
        setError('用户名已被使用，请换一个')
      } else if (err.message === 'USER_LIMIT_REACHED') {
        setError('圈子人数已满，联系成员获取账号')
        setUserLimitReached(true)
      } else if (mode === 'login') {
        setError('用户名或密码错误')
      } else {
        setError('注册失败，请重试')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-6 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900">打卡工具</h1>
        <p className="mt-1 text-sm text-gray-500">每日打卡，共同成长</p>
      </div>

      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        {/* 模式切换 */}
        <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => handleModeSwitch('login')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              mode === 'login'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('register')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              mode === 'register'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-500'
            }`}
          >
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 用户名 */}
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
              autoComplete="username"
              className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors ${
                showUsernameError
                  ? 'border-red-400 focus:border-red-400'
                  : 'border-gray-200 focus:border-primary-500'
              }`}
            />
            <p
              className={`mt-1 text-xs ${
                showUsernameError ? 'text-red-500' : 'text-gray-400'
              }`}
            >
              {showUsernameError
                ? '用户名需2-20字符，支持中英文数字'
                : '2-20字符，支持中英文数字'}
            </p>
          </div>

          {/* 密码 */}
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors ${
                showPasswordError
                  ? 'border-red-400 focus:border-red-400'
                  : 'border-gray-200 focus:border-primary-500'
              }`}
            />
            <p
              className={`mt-1 text-xs ${
                showPasswordError ? 'text-red-500' : 'text-gray-400'
              }`}
            >
              {showPasswordError
                ? '密码需6-20字符，支持中英文数字'
                : '6-20字符，支持中英文数字'}
            </p>
          </div>

          {/* 错误提示 */}
          {error && (
            <p className="text-center text-sm text-red-500">{error}</p>
          )}

          {/* 提交按钮 */}
          <button
            type="submit"
            disabled={!canSubmit}
            className={`w-full rounded-lg py-2.5 text-sm font-medium transition-colors ${
              canSubmit
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'cursor-not-allowed bg-gray-200 text-gray-400'
            }`}
          >
            {submitting
              ? mode === 'login'
                ? '登录中…'
                : '注册中…'
              : mode === 'login'
                ? '登 录'
                : '注 册'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginPage
