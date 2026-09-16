import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import { useAuth } from '../context/AuthContext'
import { getTodayStr, getDaysRemaining } from '../utils/date'
import GoalCard from '../components/GoalCard'
import GoalFormModal from '../components/GoalFormModal'

/** 查询单个目标的打卡进度（通过 category_id 关联 checkins 表） */
async function fetchGoalProgress(goal) {
  const todayStr = getTodayStr()
  const endDate = goal.end_date || todayStr
  const { count } = await withTimeoutToast(supabase
    .from('checkins')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', goal.user_id)
    .eq('category_id', goal.category_id)
    .gte('checkin_date', goal.start_date)
    .lte('checkin_date', endDate))
  return count || 0
}

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
  const [progressMap, setProgressMap] = useState({})
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
      const [goalsRes, profilesRes, categoriesRes] = await Promise.all([
        withTimeoutToast(supabase.from('goals').select('*').order('created_at', { ascending: false })),
        withTimeoutToast(supabase.from('profiles').select('id, username')),
        withTimeoutToast(supabase.from('categories').select('id, name, icon')),
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

      const goalsData = goalsRes.data || []
      setGoals(goalsData)

      // 并行查询每个目标的打卡进度
      const progressEntries = await Promise.all(
        goalsData.map(async (goal) => [goal.id, await fetchGoalProgress(goal)]),
      )
      const pMap = {}
      progressEntries.forEach(([id, count]) => {
        pMap[id] = count
      })
      setProgressMap(pMap)

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
          // 更新本地状态
          setGoals((prev) =>
            prev.map((goal) => {
              if (goal.status !== 'active' || goal.user_id !== user.id) return goal
              const effectiveStatus = getEffectiveStatus(goal, pMap[goal.id] || 0)
              return { ...goal, status: effectiveStatus }
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

  return (
    <div className="px-4 py-6 pb-8">
      <h1 className="text-xl font-bold text-gray-900">目标</h1>

      {loading ? (
        <div className="mt-12 flex items-center justify-center">
          <span className="text-sm text-gray-400">加载中…</span>
        </div>
      ) : (
        <div className="mt-4">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">全部目标</h2>
              <button
                onClick={handleAdd}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700"
              >
                + 新增
              </button>
            </div>
            <div className="space-y-2.5">
              {goals.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">
                  暂无目标，点击新增创建吧
                </p>
              ) : (
                goals.map((goal) => {
                  const currentCount = progressMap[goal.id] || 0
                  const effectiveStatus = getEffectiveStatus(goal, currentCount)
                  const cat = categoryMap[goal.category_id]
                  return (
                    <GoalCard
                      key={goal.id}
                      goal={{ ...goal, status: effectiveStatus }}
                      currentCount={currentCount}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      isOwner={user?.id === goal.user_id}
                      creatorUsername={usernameMap[goal.user_id] || '未知用户'}
                      categoryName={cat?.name}
                      categoryIcon={cat?.icon}
                    />
                  )
                })
              )}
            </div>
          </section>
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
