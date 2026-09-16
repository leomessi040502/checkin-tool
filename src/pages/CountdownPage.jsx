import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import { useAuth } from '../context/AuthContext'
import CountdownCard from '../components/CountdownCard'
import CountdownFormModal from '../components/CountdownFormModal'

function CountdownPage() {
  const { user } = useAuth()
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [toast, setToast] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [countdownsRes, profilesRes] = await Promise.all([
        withTimeoutToast(supabase
          .from('countdowns')
          .select('*')
          .order('target_date', { ascending: true })),
        withTimeoutToast(supabase.from('profiles').select('id, username')),
      ])

      const usernameMap = {}
      if (profilesRes.data) {
        profilesRes.data.forEach((p) => {
          usernameMap[p.id] = p.username
        })
      }

      setList(
        (countdownsRes.data || []).map((item) => ({
          ...item,
          creator_username: usernameMap[item.creator_id] || '未知用户',
        })),
      )
    } catch {
      // 网络或 Supabase 错误，保持空列表不崩溃
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

  const handleAdd = () => {
    setEditingItem(null)
    setModalOpen(true)
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setModalOpen(true)
  }

  const handleDelete = (item) => {
    setDeleteTarget(item)
  }

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      const { error } = await withTimeoutToast(supabase
        .from('countdowns')
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
    setEditingItem(null)
    fetchData()
  }

  const handleModalClose = () => {
    setModalOpen(false)
    setEditingItem(null)
  }

  return (
    <div className="px-4 py-6 pb-8">
      <h1 className="text-xl font-bold text-gray-900">倒计时</h1>

      {loading ? (
        <div className="mt-12 flex items-center justify-center">
          <span className="text-sm text-gray-400">加载中…</span>
        </div>
      ) : (
        <div className="mt-4">
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800">
                全部倒计时
              </h2>
              <button
                onClick={handleAdd}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700"
              >
                + 新增
              </button>
            </div>
            <div className="space-y-2.5">
              {list.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">
                  暂无倒计时
                </p>
              ) : (
                list.map((item) => (
                  <CountdownCard
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* 新增/编辑弹窗 */}
      <CountdownFormModal
        open={modalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
        initialData={editingItem}
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
            <p className="text-center text-sm text-gray-700">
              确认删除该倒计时？
            </p>
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

export default CountdownPage
