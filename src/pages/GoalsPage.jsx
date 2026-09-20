import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import { useAuth } from '../context/AuthContext'
import { getTodayStr, getDaysRemaining } from '../utils/date'
import GoalCard from '../components/GoalCard'
import GoalFormModal from '../components/GoalFormModal'

/** 计算有效状态（用于显示） */
function getEffectiveStatus(goal, currentCount) {
  if (goal.status !== 'active') return goal.status
  if (goal.target_count && currentCount >= goal.target_count) return 'completed'
  if (goal.type === 'periodic' && goal.end_date && getDaysRemaining(goal.end_date) < 0) {
    return 'expired'
  }
  return 'active'
}

function GoalsPage() {
  const { user } = useAuth()
  const [goals, setGoals] = useState([])
  const [usernameMap, setUsernameMap] = useState({})
  const [categoryMap, setCategoryMap] = useState({})
  const [goalCategoriesMap, setGoalCategoriesMap] = useState({})
  const [progressMap, setProgressMap] = useState({})
  const [todayStatusMap, setTodayStatusMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [goalsRes, profilesRes, categoriesRes, goalCategoriesRes] = await Promise.all([
        withTimeoutToast(supabase.from('goals').select('*').order('created_at', { ascending: false })),
        withTimeoutToast(supabase.from('profiles').select('id, username')),
        withTimeoutToast(supabase.from('categories').select('id, name, icon')),
        withTimeoutToast(supabase.from('goal_categories').select('goal_id, category_id')),
      ])

      const uMap = {}
      if (profilesRes.data) {
        profilesRes.data.forEach((p) => {
          uMap[p.id] = p.username
        })
      }
      setUsernameMap(uMap)

      const cMap = {}
      if (categoriesRes.data) {
        categoriesRes.data.forEach((c) => {
          cMap[c.id] = { name: c.name, icon: c.icon }
        })
      }
      setCategoryMap(cMap)

      // goal_id -> [category_id, ...]
      const gcMap = {}
      if (goalCategoriesRes.data) {
        goalCategoriesRes.data.forEach((gc) => {
          if (!gcMap[gc.goal_id]) gcMap[gc.goal_id] = []
          gcMap[gc.goal_id].push(gc.category_id)
        })
      }
      setGoalCategoriesMap(gcMap)

      const goalsData = goalsRes.data || []
      setGoals(goalsData)

      // 计算每个目标的累计打卡数和当日完成状态
      const todayStr = getTodayStr()

      // 取所有目标中最早的 start_date，减少 checkins 查询量
      const earliestStart = goalsData.reduce((min, g) => {
        if (!g.start_date) return min
        return !min || g.start_date < min ? g.start_date : min
      }, null)

      let checkins = []
      if (earliestStart && goalsData.length > 0) {
        const checkinsRes = await withTimeoutToast(
          supabase
            .from('checkins')
            .select('user_id, category_id, checkin_date')
            .gte('checkin_date', earliestStart),
        )
        checkins = checkinsRes.data || []
      }

      // 今日打卡：user_id -> Set(category_id)
      const todayCheckinByUser = {}
      checkins.forEach((c) => {
        if (c.checkin_date === todayStr) {
          if (!todayCheckinByUser[c.user_id]) todayCheckinByUser[c.user_id] = new Set()
          todayCheckinByUser[c.user_id].add(c.category_id)
        }
      })

      const pMap = {}
      const tMap = {}
      for (const goal of goalsData) {
        const catIds = gcMap[goal.id] || []
        const endDate = goal.end_date || todayStr

        // 累计打卡数：关联分类在 start_date ~ endDate 范围内的打卡数
        const catIdSet = new Set(catIds)
        const count = checkins.filter(
          (c) =>
            c.user_id === goal.user_id &&
            catIdSet.has(c.category_id) &&
            c.checkin_date >= goal.start_date &&
            c.checkin_date <= endDate,
        ).length
        pMap[goal.id] = count

        // 当日完成状态
        const todaySet = todayCheckinByUser[goal.user_id]
        const completed =
          catIds.length > 0 && todaySet
            ? catIds.filter((cid) => todaySet.has(cid)).length
            : 0
        tMap[goal.id] = { completed, total: catIds.length }
      }
      setProgressMap(pMap)
      setTodayStatusMap(tMap)

      // 自动更新状态：仅当前用户的目标（RLS 限制）
      if (user) {
        const updates = []
        for (const goal of goalsData) {
          if (goal.status !== 'active') continue
          if (goal.user_id !== user.id) continue

          const currentCount = pMap[goal.id] || 0
          const effectiveStatus = getEffectiveStatus(goal, currentCount)
          if (effectiveStatus !== goal.status) {
            updates.push(
              withTimeoutToast(supabase.from('goals').update({ status: effectiveStatus }).eq('id', goal.id)),
            )
          }
        }
        if (updates.length > 0) {
          await Promise.all(updates)
          setGoals((prev) =>
            prev.map((goal) => {
              if (goal.status !== 'active' || goal.user_id !== user.id) return goal
              return { ...goal, status: getEffectiveStatus(goal, pMap[goal.id] || 0) }
            }),
          )
        }
      }
    } catch {
      // 网络或 Supabase 错误，保持空列表不崩溃
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleAdd = () => {
    setEditingGoal(null)
    setModalOpen(true)
  }

  const handleEdit = (goal) => {
    if (user?.id !== goal.user_id) {
      showToast('仅创建者可编辑目标')
      return
    }
    setEditingGoal(goal)
    setModalOpen(true)
  }

  const handleDelete = (goal) => {
    if (user?.id !== goal.user_id) {
      showToast('仅创建者可删除目标')
      return
    }
    setDeleteTarget(goal)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const { error } = await withTimeoutToast(supabase
        .from('goals')
        .delete()
        .eq('id', deleteTarget.id))
      if (error) throw error
      setDeleteTarget(null)
      fetchData()
    } catch {
      showToast('删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  const handleModalSuccess = () => {
    setModalOpen(false)
    setEditingGoal(null)
    fetchData()
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setEditingGoal(null)
  }

  // 按 user_id 分组，保持目标按 created_at 降序的顺序
  const userIdsInOrder = []
  goals.forEach((g) => {
    if (!userIdsInOrder.includes(g.user_id)) userIdsInOrder.push(g.user_id)
  })
  // 当前用户排第一，其余保持原顺序
  const sortedUserIds = (() => {
    if (!user || !userIdsInOrder.includes(user.id)) return userIdsInOrder
    const others = userIdsInOrder.filter((id) => id !== user.id)
    return [user.id, ...others]
  })()

  const renderGoalCard = (goal) => {
    const currentCount = progressMap[goal.id] || 0
    const effectiveStatus = getEffectiveStatus(goal, currentCount)
    const catIds = goalCategoriesMap[goal.id] || []
    const relatedCategories = catIds
      .map((cid) => {
        const cat = categoryMap[cid]
        if (!cat) return null
        return { id: cid, name: cat.name, icon: cat.icon }
      })
      .filter(Boolean)
    const todayStatus = todayStatusMap[goal.id] || { completed: 0, total: 0 }

    return (
      <GoalCard
        key={goal.id}
        goal={{ ...goal, status: effectiveStatus }}
        currentCount={currentCount}
        todayCompleted={todayStatus.completed}
        todayTotal={todayStatus.total}
        relatedCategories={relatedCategories}
        onEdit={handleEdit}
        onDelete={handleDelete}
        isOwner={user?.id === goal.user_id}
        creatorUsername={usernameMap[goal.user_id] || '未知用户'}
      />
    )
  }

  return (
    <div className="px-4 py-6 pb-8">
      <h1 className="text-xl font-bold text-gray-900">目标</h1>

      {loading ? (
        <div className="mt-12 flex items-center justify-center">
          <span className="text-sm text-gray-400">加载中…</span>
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-800">全员目标</h2>
            <button
              onClick={handleAdd}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700"
            >
              + 新增
            </button>
          </div>

          {goals.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              暂无目标，点击新增创建吧
            </p>
          ) : (
            <div className="space-y-6">
              {sortedUserIds.map((userId) => {
                const userGoals = goals.filter((g) => g.user_id === userId)
                const periodicGoals = userGoals.filter((g) => g.type === 'periodic')
                const lifelongGoals = userGoals.filter((g) => g.type === 'lifelong')
                const username = usernameMap[userId] || '未知用户'
                const isCurrentUser = user?.id === userId

                return (
                  <section key={userId} className="rounded-xl border border-gray-200 bg-gray-50/50 p-3">
                    <h3 className="mb-3 text-sm font-semibold text-gray-800">
                      {username}
                      {isCurrentUser && (
                        <span className="ml-1.5 rounded bg-primary-100 px-1.5 py-0.5 text-xs text-primary-600">
                          我
                        </span>
                      )}
                    </h3>

                    {periodicGoals.length > 0 && (
                      <div className="mb-3">
                        <h4 className="mb-2 text-xs font-medium text-gray-500">周期目标</h4>
                        <div className="space-y-2.5">
                          {periodicGoals.map(renderGoalCard)}
                        </div>
                      </div>
                    )}

                    {lifelongGoals.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-xs font-medium text-gray-500">长期目标</h4>
                        <div className="space-y-2.5">
                          {lifelongGoals.map(renderGoalCard)}
                        </div>
                      </div>
                    )}

                    {periodicGoals.length === 0 && lifelongGoals.length === 0 && (
                      <p className="py-3 text-center text-xs text-gray-400">暂无目标</p>
                    )}
                  </section>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      <GoalFormModal
        isOpen={modalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        initialData={editingGoal}
        currentUserId={user?.id}
      />

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-10 mx-6 w-full max-w-xs rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-sm text-gray-700">确认删除该目标？</p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  deleting
                    ? 'cursor-not-allowed bg-red-300 text-white'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                {deleting ? '删除中…' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 提示 */}
      {toast && (
        <div className="fixed left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-black/75 px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}
    </div>
  )
}

export default GoalsPage
