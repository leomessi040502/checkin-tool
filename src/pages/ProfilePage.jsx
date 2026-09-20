import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import { formatChineseDate } from '../utils/date'

function ProfilePage() {
  const { user, signOut, updateUsername, updatePassword, deleteAccount } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState({ total: 0, byCategory: {} })
  const [categories, setCategories] = useState([])
  const [createdAt, setCreatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // 修改用户名状态
  const [showUsernameModal, setShowUsernameModal] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [updatingUsername, setUpdatingUsername] = useState(false)

  // 修改密码状态
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)

  // 注销账号状态
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)

  /** 查询当前用户的打卡统计（总数 + 各分类次数） */
  const fetchStats = useCallback(async () => {
    if (!user) return
    try {
      // 查询所有分类
      const { data: cats } = await withTimeoutToast(supabase.from('categories').select('id, name, icon').eq('user_id', user.id))
      setCategories(cats || [])

      // 查询总数
      const { count: total } = await withTimeoutToast(
        supabase.from('checkins').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
      )

      // 查询各分类次数
      const byCategory = {}
      if (cats && cats.length > 0) {
        const countPromises = cats.map(cat =>
          withTimeoutToast(
            supabase.from('checkins').select('*', { count: 'exact', head: true })
              .eq('user_id', user.id).eq('category_id', cat.id)
          ).then(res => ({ id: cat.id, count: res.count || 0 }))
        )
        const results = await Promise.all(countPromises)
        results.forEach(r => { byCategory[r.id] = r.count })
      }

      setStats({ total: total || 0, byCategory })
    } catch {
      // 查询失败时保持默认值，不崩溃
    }
  }, [user])

  /** 查询注册时间 */
  const fetchProfile = useCallback(async () => {
    if (!user) return
    try {
      const { data } = await withTimeoutToast(supabase
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single())
      if (data?.created_at) setCreatedAt(data.created_at)
    } catch {
      // 查询失败忽略
    }
  }, [user])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchStats(), fetchProfile()])
      setLoading(false)
    }
    load()
  }, [fetchStats, fetchProfile])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await signOut()
    } catch {
      // 忽略退出错误
    } finally {
      setLoggingOut(false)
      setShowConfirm(false)
      navigate('/login', { replace: true })
    }
  }

  /** 修改用户名 */
  const handleUpdateUsername = async () => {
    setUsernameError('')

    // 格式校验
    if (!newUsername || newUsername.length < 2 || newUsername.length > 20) {
      setUsernameError('用户名需2-20字符，支持中英文数字')
      return
    }
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9]{2,20}$/.test(newUsername)) {
      setUsernameError('用户名仅支持中英文数字')
      return
    }
    if (newUsername === user?.username) {
      setUsernameError('新用户名与当前相同')
      return
    }

    setUpdatingUsername(true)
    try {
      await updateUsername(newUsername)
      setShowUsernameModal(false)
      setNewUsername('')
    } catch (err) {
      if (err.message === 'USERNAME_EXISTS') {
        setUsernameError('用户名已被使用，请换一个')
      } else {
        setUsernameError('修改失败，请重试')
      }
    } finally {
      setUpdatingUsername(false)
    }
  }

  /** 修改密码 */
  const handleUpdatePassword = async () => {
    setPasswordError('')

    // 格式校验
    if (!newPassword || newPassword.length < 6 || newPassword.length > 20) {
      setPasswordError('密码需6-20字符，支持中英文数字')
      return
    }
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9]{6,20}$/.test(newPassword)) {
      setPasswordError('密码仅支持中英文数字')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的密码不一致')
      return
    }

    setUpdatingPassword(true)
    try {
      await updatePassword(newPassword)
      setShowPasswordModal(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setPasswordError('修改失败，请重试')
    } finally {
      setUpdatingPassword(false)
    }
  }

  /** 注销账号 */
  const handleDeleteAccount = async () => {
    setDeleteError('')

    if (!deletePassword) {
      setDeleteError('请输入密码')
      return
    }

    setDeletingAccount(true)
    try {
      await deleteAccount(deletePassword)
      // 账号已删除，跳转登录页
      setShowDeleteModal(false)
      navigate('/login', { replace: true })
    } catch (err) {
      if (err.message === 'PASSWORD_INCORRECT') {
        setDeleteError('密码错误，请重新输入')
      } else {
        setDeleteError('注销失败，请重试')
      }
    } finally {
      setDeletingAccount(false)
    }
  }

  return (
    <div className="px-4 py-6">
      {/* 用户信息卡片 */}
      <div className="mb-6 flex flex-col items-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 px-6 py-8 text-white">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-3xl">
          👤
        </div>
        <h1 className="mt-3 text-lg font-bold">{user?.username || '用户'}</h1>
        {createdAt && (
          <p className="mt-1 text-xs text-white/70">
            加入于 {formatChineseDate(createdAt)}
          </p>
        )}
      </div>

      {/* 打卡统计 */}
      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-gray-900">打卡统计</h2>
        {loading ? (
          <div className="py-6 text-center text-sm text-gray-400">加载中…</div>
        ) : (
          <>
            {/* 累计总数 */}
            <div className="mb-3 flex items-center justify-between rounded-xl bg-primary-50 px-4 py-3">
              <span className="text-sm text-gray-600">累计打卡</span>
              <span className="text-xl font-bold text-primary-600">{stats.total} 次</span>
            </div>
            {/* 分类统计 */}
            {categories.length === 0 ? (
              <div className="py-4 text-center text-xs text-gray-400">还没有分类，去打卡页添加吧</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex flex-col items-center rounded-xl bg-gray-50 py-3"
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="mt-1 text-xs text-gray-500">{cat.name}</span>
                    <span className="text-base font-bold text-gray-900">
                      {stats.byCategory[cat.id] || 0} 次
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 设置区域 */}
      <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-gray-900">账号设置</h2>
        <button
          type="button"
          onClick={() => { setNewUsername(user?.username || ''); setUsernameError(''); setShowUsernameModal(true) }}
          className="flex w-full items-center justify-between border-b border-gray-100 py-3 text-sm text-gray-700"
        >
          <span>修改用户名</span>
          <span className="text-gray-400">›</span>
        </button>
        <button
          type="button"
          onClick={() => { setNewPassword(''); setConfirmPassword(''); setPasswordError(''); setShowPasswordModal(true) }}
          className="flex w-full items-center justify-between py-3 text-sm text-gray-700"
        >
          <span>修改密码</span>
          <span className="text-gray-400">›</span>
        </button>
      </div>

      {/* 退出登录按钮 */}
      <button
        type="button"
        onClick={() => setShowConfirm(true)}
        disabled={loggingOut}
        className="w-full rounded-lg border border-red-200 bg-white py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
      >
        退出登录
      </button>

      {/* 注销账号按钮 */}
      <button
        type="button"
        onClick={() => { setDeletePassword(''); setDeleteError(''); setShowDeleteModal(true) }}
        className="mt-3 w-full py-2.5 text-center text-xs text-gray-400 underline transition-colors hover:text-red-500"
      >
        注销账号
      </button>

      {/* 退出确认弹窗 */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          onClick={() => !loggingOut && setShowConfirm(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-sm font-medium text-gray-900">
              确认退出登录？
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={loggingOut}
                className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                {loggingOut ? '退出中…' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 修改用户名弹窗 */}
      {showUsernameModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          onClick={() => !updatingUsername && setShowUsernameModal(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-center text-base font-bold text-gray-900">修改用户名</h3>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => { setNewUsername(e.target.value); setUsernameError('') }}
              maxLength={20}
              placeholder="输入新用户名"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-500"
            />
            <div className="mt-1 text-right text-xs text-gray-400">{newUsername.length}/20</div>
            {usernameError && (
              <p className="mb-2 text-xs text-red-500">{usernameError}</p>
            )}
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setShowUsernameModal(false)}
                disabled={updatingUsername}
                className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleUpdateUsername}
                disabled={updatingUsername}
                className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                {updatingUsername ? '保存中…' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 修改密码弹窗 */}
      {showPasswordModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6"
          onClick={() => !updatingPassword && setShowPasswordModal(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-center text-base font-bold text-gray-900">修改密码</h3>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPasswordError('') }}
              maxLength={20}
              placeholder="输入新密码（6-20字符）"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-500"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError('') }}
              maxLength={20}
              placeholder="再次输入新密码"
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-500"
            />
            {passwordError && (
              <p className="mb-2 mt-2 text-xs text-red-500">{passwordError}</p>
            )}
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setShowPasswordModal(false)}
                disabled={updatingPassword}
                className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleUpdatePassword}
                disabled={updatingPassword}
                className="flex-1 rounded-lg bg-primary-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
              >
                {updatingPassword ? '保存中…' : '确认'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 注销账号确认弹窗 */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6"
          onClick={() => !deletingAccount && setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-2 text-center text-base font-bold text-red-600">
              注销账号
            </h3>
            <p className="mb-3 text-center text-xs text-gray-500">
              注销后所有数据将永久删除，不可恢复
            </p>
            <p className="mb-2 text-center text-xs text-gray-400">
              打卡记录、分类、目标、倒计时都将被清除
            </p>
            <div className="mb-2">
              <label className="mb-1 block text-xs text-gray-500">
                请输入密码确认
              </label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => { setDeletePassword(e.target.value); setDeleteError('') }}
                maxLength={20}
                placeholder="输入密码"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-red-500"
              />
            </div>
            {deleteError && (
              <p className="mb-2 text-center text-xs text-red-500">{deleteError}</p>
            )}
            <div className="mt-3 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingAccount}
                className="flex-1 rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors ${
                  deletingAccount
                    ? 'cursor-not-allowed bg-red-300'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {deletingAccount ? '注销中…' : '确认注销'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfilePage
