import { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import { useAuth } from '../context/AuthContext'
import { splitAndSortTodos } from '../utils/todoSort'
import TodoCard from './TodoCard'
import TodoFormModal from './TodoFormModal'
import TodoDetailModal from './TodoDetailModal'

const DONE_COLLAPSED_KEY = 'todo_done_collapsed'

/**
 * 待办区：列表（未完成 + 折叠已完成）、新增/编辑、详情、删除
 * todos 表尚未迁移时：查询报错 → toast + 空列表，不白屏
 */
function TodoSection() {
  const { user } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [toast, setToast] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [detailItem, setDetailItem] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [doneCollapsed, setDoneCollapsed] = useState(() => {
    try {
      return localStorage.getItem(DONE_COLLAPSED_KEY) !== '0'
    } catch {
      return true
    }
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [todosRes, profilesRes] = await Promise.all([
        withTimeoutToast(supabase.from('todos').select('*')),
        withTimeoutToast(supabase.from('profiles').select('id, username')),
      ])

      // 表不存在（未跑 010 迁移）等错误：降级空列表
      if (todosRes.error) {
        setLoadError(true)
        setList([])
        return
      }

      const usernameMap = {}
      if (profilesRes.data) {
        profilesRes.data.forEach((p) => {
          usernameMap[p.id] = p.username
        })
      }

      setLoadError(false)
      setList(
        (todosRes.data || []).map((t) => ({
          ...t,
          creator_username: usernameMap[t.user_id] || '未知用户',
        })),
      )
    } catch {
      setLoadError(true)
      setList([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const { pending, done } = splitAndSortTodos(list)

  const handleToggle = async (item) => {
    const isDone = item.completed_at != null
    try {
      const { error } = await withTimeoutToast(supabase
        .from('todos')
        .update({
          completed_at: isDone ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', item.id))
      if (error) throw error
      fetchData()
    } catch {
      showToast('操作失败，请重试')
    }
  }

  const handleAdd = () => {
    setEditingItem(null)
    setFormOpen(true)
  }

  const handleEdit = (item) => {
    setDetailItem(null)
    setEditingItem(item)
    setFormOpen(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const { error } = await withTimeoutToast(supabase
        .from('todos')
        .delete()
        .eq('id', deleteTarget.id))
      if (error) throw error
      setDeleteTarget(null)
      setDetailItem(null)
      fetchData()
    } catch {
      showToast('删除失败，请重试')
    } finally {
      setDeleting(false)
    }
  }

  const toggleDoneCollapsed = () => {
    setDoneCollapsed((v) => {
      const next = !v
      try {
        localStorage.setItem(DONE_COLLAPSED_KEY, next ? '1' : '0')
      } catch {
        /* localStorage 不可用时静默降级 */
      }
      return next
    })
  }

  return (
    <div>
      {/* 新增入口 */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-title">全部待办</h2>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-600"
        >
          <Plus size={14} />
          新增
        </button>
      </div>

      {loading ? (
        <div className="mt-12 flex items-center justify-center">
          <span className="text-sm text-ink-400">加载中…</span>
        </div>
      ) : loadError ? (
        <div className="py-6 text-center text-sm text-ink-400">
          <p>待办数据加载失败</p>
          <p className="mt-1 text-xs">若持续出现，请确认数据库已执行 010 迁移</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* 未完成 */}
          {pending.length === 0 && done.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">
              暂无待办，点「新增」创建第一条
            </p>
          ) : (
            pending.map((item) => (
              <TodoCard
                key={item.id}
                item={item}
                currentUserId={user?.id}
                onToggle={handleToggle}
                onOpen={setDetailItem}
              />
            ))
          )}

          {/* 已完成（折叠区） */}
          {done.length > 0 && (
            <div className="pt-2">
              <button
                type="button"
                onClick={toggleDoneCollapsed}
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-sm font-medium text-ink-400 transition-colors hover:bg-primary-50"
              >
                <ChevronDown
                  size={16}
                  className={`transition-transform ${doneCollapsed ? '-rotate-90' : ''}`}
                />
                已完成（{done.length}）
              </button>
              {!doneCollapsed && (
                <div className="mt-1 space-y-2.5">
                  {done.map((item) => (
                    <TodoCard
                      key={item.id}
                      item={item}
                      currentUserId={user?.id}
                      onToggle={handleToggle}
                      onOpen={setDetailItem}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      <TodoFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingItem(null)
        }}
        onSuccess={() => {
          setFormOpen(false)
          setEditingItem(null)
          fetchData()
        }}
        initialData={editingItem}
        currentUserId={user?.id}
      />

      {/* 详情弹层 */}
      <TodoDetailModal
        open={!!detailItem}
        todo={detailItem}
        currentUserId={user?.id}
        onClose={() => setDetailItem(null)}
        onChanged={() => {
          setDetailItem(null)
          fetchData()
        }}
        onEdit={handleEdit}
        onDelete={setDeleteTarget}
      />

      {/* 删除确认弹窗 */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-10 mx-6 w-full max-w-xs rounded-2xl bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-center text-sm font-medium text-ink-900">
              确认删除该待办？
            </p>
            <p className="mt-1 truncate text-center text-xs text-ink-400">
              {deleteTarget.title}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-primary-200 bg-white py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-primary-50"
              >
                取消
              </button>
              <button
                type="button"
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
        <div className="fixed left-1/2 top-1/2 z-[80] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-black/75 px-4 py-2 text-sm text-white">
          {toast}
        </div>
      )}
    </div>
  )
}

export default TodoSection
