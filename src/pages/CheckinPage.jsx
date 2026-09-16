import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import { getTodayStr, formatChineseDate, formatTime } from '../utils/date'
import CheckinModal from '../components/CheckinModal'
import MakeupCheckinModal from '../components/MakeupCheckinModal'
import CategoryFormModal from '../components/CategoryFormModal'

function CheckinPage() {
  const { user } = useAuth()
  const todayStr = getTodayStr()

  // 分类列表（从 categories 表动态加载）
  const [categories, setCategories] = useState([])
  // 创建者用户名映射 creator_id -> username
  const [creatorMap, setCreatorMap] = useState({})
  // 今日当前用户的打卡记录：{ category_id: {id, note} }
  const [todayCheckins, setTodayCheckins] = useState({})
  // 今日全员打卡动态
  const [allTodayCheckins, setAllTodayCheckins] = useState([])
  const [loading, setLoading] = useState(true)

  // 弹窗状态
  const [modalState, setModalState] = useState(null)
  // { category, mode: 'create' | 'edit', note, id }
  const [makeupOpen, setMakeupOpen] = useState(false)
  const [categoryFormOpen, setCategoryFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  /** 查询所有分类 + 创建者用户名 */
  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await withTimeoutToast(supabase
        .from('categories')
        .select('id, name, icon, creator_id, created_at')
        .order('created_at', { ascending: true }))

      if (error) throw error
      setCategories(data || [])

      // 查询创建者用户名
      const creatorIds = [...new Set((data || []).map((c) => c.creator_id))]
      if (creatorIds.length > 0) {
        const { data: profiles, error: profilesError } = await withTimeoutToast(supabase
          .from('profiles')
          .select('id, username')
          .in('id', creatorIds))

        if (!profilesError && profiles) {
          const map = {}
          profiles.forEach((p) => {
            map[p.id] = p.username
          })
          setCreatorMap(map)
        }
      }
    } catch {
      setCategories([])
    }
  }, [])

  /** 查询当前用户今日各分类的打卡记录（按 category_id 匹配） */
  const fetchTodayCheckins = useCallback(async () => {
    if (!user) return
    try {
      const { data, error } = await withTimeoutToast(supabase
        .from('checkins')
        .select('id, category_id, note')
        .eq('user_id', user.id)
        .eq('checkin_date', todayStr))

      if (error) throw error

      const map = {}
      data?.forEach((c) => {
        if (c.category_id) {
          map[c.category_id] = { id: c.id, note: c.note }
        }
      })
      setTodayCheckins(map)
    } catch {
      // 查询失败时保持空状态，不崩溃
    }
  }, [user, todayStr])

  /** 查询今日全员打卡动态（联表 profiles 获取用户名） */
  const fetchAllTodayCheckins = useCallback(async () => {
    try {
      const { data: checkins, error: checkinsError } = await withTimeoutToast(supabase
        .from('checkins')
        .select('id, user_id, category_id, note, created_at')
        .eq('checkin_date', todayStr)
        .order('created_at', { ascending: false }))

      if (checkinsError) throw checkinsError
      if (!checkins || checkins.length === 0) {
        setAllTodayCheckins([])
        return
      }

      // 查询相关用户名
      const userIds = [...new Set(checkins.map((c) => c.user_id))]
      const { data: profiles, error: profilesError } = await withTimeoutToast(supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds))

      if (profilesError) throw profilesError

      const profileMap = {}
      profiles?.forEach((p) => {
        profileMap[p.id] = p.username
      })

      const combined = checkins.map((c) => ({
        ...c,
        username: profileMap[c.user_id] || '未知用户',
      }))

      setAllTodayCheckins(combined)
    } catch {
      setAllTodayCheckins([])
    }
  }, [todayStr])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchCategories(), fetchTodayCheckins(), fetchAllTodayCheckins()])
      setLoading(false)
    }
    load()
  }, [fetchCategories, fetchTodayCheckins, fetchAllTodayCheckins])

  const handleCardClick = (cat) => {
    const existing = todayCheckins[cat.id]
    if (existing) {
      setModalState({
        category: cat,
        mode: 'edit',
        note: existing.note,
        id: existing.id,
      })
    } else {
      setModalState({
        category: cat,
        mode: 'create',
        note: '',
        id: null,
      })
    }
  }

  const handleModalSuccess = () => {
    fetchTodayCheckins()
    fetchAllTodayCheckins()
  }

  const handleMakeupSuccess = () => {
    fetchTodayCheckins()
    fetchAllTodayCheckins()
  }

  const handleCategoryFormSuccess = () => {
    fetchCategories()
    fetchTodayCheckins()
    fetchAllTodayCheckins()
  }

  /** 确认删除分类 */
  const handleDeleteConfirm = async () => {
    if (deleting || !deleteTarget) return
    setDeleting(true)
    const startTime = Date.now()

    try {
      const { error: deleteError } = await withTimeoutToast(supabase
        .from('categories')
        .delete()
        .eq('id', deleteTarget.id))
      if (deleteError) throw deleteError

      setDeleteTarget(null)
      fetchCategories()
      fetchTodayCheckins()
      fetchAllTodayCheckins()
    } catch {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 2000 - elapsed)
      setTimeout(() => setDeleting(false), remaining)
      return
    }
    setDeleting(false)
  }

  /** 根据 category_id 获取分类信息 */
  const getCategoryById = (categoryId) => {
    return categories.find((c) => c.id === categoryId)
  }

  return (
    <div className="px-4 py-6">
      {/* 顶部：用户名 + 今日日期 */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {user?.username ? `${user.username}，打卡啦！` : '打卡'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{formatChineseDate(todayStr)}</p>
      </div>

      {/* 打卡分类卡片（动态渲染） */}
      <div className="mb-6 flex flex-wrap gap-3">
        {loading ? (
          <div className="w-full py-8 text-center text-sm text-gray-400">加载中…</div>
        ) : (
          <>
            {categories.map((cat) => {
              const checkin = todayCheckins[cat.id]
              const checked = !!checkin
              return (
                <div
                  key={cat.id}
                  onClick={() => handleCardClick(cat)}
                  className={`flex w-[calc(50%-0.375rem)] cursor-pointer flex-col items-center gap-1 rounded-2xl border py-4 transition-colors ${
                    checked
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-3xl">{cat.icon}</span>
                  <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                  {checked ? (
                    <span className="flex items-center gap-0.5 text-xs text-green-600">
                      <span>✓</span>
                      {checkin.note ? (
                        <span className="max-w-[80px] truncate">{checkin.note}</span>
                      ) : (
                        <span>已打卡</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">未打卡</span>
                  )}
                  {creatorMap[cat.creator_id] && (
                    <span className="text-[10px] text-gray-400">
                      由 {creatorMap[cat.creator_id]} 创建
                    </span>
                  )}
                  {/* 编辑/删除按钮 */}
                  <div
                    className="mt-1 flex gap-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategory(cat)
                        setCategoryFormOpen(true)
                      }}
                      className="text-xs text-gray-400 transition-colors hover:text-primary-600"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(cat)}
                      className="text-xs text-gray-400 transition-colors hover:text-red-500"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
            {/* 添加分类按钮 */}
            <button
              type="button"
              onClick={() => {
                setEditingCategory(null)
                setCategoryFormOpen(true)
              }}
              className="flex w-[calc(50%-0.375rem)] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-gray-300 py-4 text-gray-400 transition-colors hover:border-primary-400 hover:text-primary-600"
            >
              <span className="text-2xl">+</span>
              <span className="text-sm">添加分类</span>
            </button>
          </>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="mb-6 flex gap-3">
        <button
          type="button"
          onClick={() => setMakeupOpen(true)}
          className="flex-1 rounded-lg border border-primary-200 bg-primary-50 py-2.5 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-100"
        >
          📅 补卡
        </button>
      </div>

      {/* 今日全员打卡动态 */}
      <div>
        <h2 className="mb-3 text-base font-bold text-gray-900">今日全员打卡动态</h2>
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-400">加载中…</div>
        ) : allTodayCheckins.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">暂无打卡动态</div>
        ) : (
          <div className="space-y-2">
            {allTodayCheckins.map((item) => {
              const cat = getCategoryById(item.category_id)
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm"
                >
                  <span className="text-lg">{cat?.icon || '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {item.username}
                      </span>
                      <span className="rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-600">
                        {cat?.name || '未知分类'}
                      </span>
                    </div>
                    {item.note && (
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {item.note}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-gray-400">
                    {formatTime(item.created_at)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 打卡/编辑弹窗 */}
      {modalState && (
        <CheckinModal
          isOpen={!!modalState}
          category={modalState.category}
          mode={modalState.mode}
          existingNote={modalState.note}
          recordId={modalState.id}
          onClose={() => setModalState(null)}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* 补卡弹窗 */}
      <MakeupCheckinModal
        isOpen={makeupOpen}
        categories={categories}
        onClose={() => setMakeupOpen(false)}
        onSuccess={handleMakeupSuccess}
      />

      {/* 分类新增/编辑弹窗 */}
      <CategoryFormModal
        isOpen={categoryFormOpen}
        category={editingCategory}
        userId={user?.id}
        onClose={() => {
          setCategoryFormOpen(false)
          setEditingCategory(null)
        }}
        onSuccess={handleCategoryFormSuccess}
      />

      {/* 删除分类确认弹窗 */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-sm font-medium text-gray-900">
              确认删除分类「{deleteTarget.name}」？
            </p>
            <p className="mt-2 text-center text-xs text-gray-400">
              删除后该分类下的打卡记录将保留但分类信息会丢失
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors ${
                  deleting
                    ? 'cursor-not-allowed bg-red-300'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {deleting ? '删除中…' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CheckinPage
