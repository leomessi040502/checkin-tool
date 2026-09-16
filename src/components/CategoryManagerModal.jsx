import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'

const PRESET_ICONS = [
  '📚', '🌱', '🏃', '💪', '🎯', '✏️', '☕', '🎮',
  '🎸', '🏊', '🧘', '🛒', '🎨', '💻', '🍳', '🎵',
  '📖', '🚴', '⚽', '🏀', '🏔️', '✈️', '📷', '💡',
]

/**
 * 分类管理弹窗
 *
 * @param {boolean} isOpen
 * @param {Array} categories - 当前分类列表
 * @param {string} userId - 当前用户 id
 * @param {() => void} onClose
 * @param {() => void} onSuccess - 操作成功后回调（刷新数据）
 */
export default function CategoryManagerModal({ isOpen, categories, userId, onClose, onSuccess }) {
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('📚')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 编辑状态：正在编辑的分类 id
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editIcon, setEditIcon] = useState('📚')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [editError, setEditError] = useState('')

  // 删除确认
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setShowAdd(false)
      setNewName('')
      setNewIcon('📚')
      setError('')
      setSubmitting(false)
      setEditingId(null)
      setEditName('')
      setEditIcon('📚')
      setEditError('')
      setEditSubmitting(false)
      setDeleteTarget(null)
      setDeleting(false)
    }
  }, [isOpen])

  // 阻止滚动穿透
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  /** 添加分类 */
  const handleAdd = async () => {
    if (submitting) return
    const trimmed = newName.trim()
    if (!trimmed || trimmed.length < 2 || trimmed.length > 20) {
      setError('分类名称需2-20字符')
      return
    }
    // 检查重名
    if (categories.some((c) => c.name === trimmed)) {
      setError('分类名称已存在')
      return
    }

    setSubmitting(true)
    setError('')
    const startTime = Date.now()

    try {
      const { error: insertError } = await withTimeoutToast(supabase
        .from('categories')
        .insert({
          name: trimmed,
          icon: newIcon,
          creator_id: userId,
        }))
      if (insertError) throw insertError

      onSuccess()
      setNewName('')
      setNewIcon('📚')
      setShowAdd(false)
    } catch {
      setError('添加失败，请重试')
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 2000 - elapsed)
      setTimeout(() => setSubmitting(false), remaining)
      return
    }
    setSubmitting(false)
  }

  /** 开始编辑分类 */
  const startEdit = (cat) => {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditIcon(cat.icon)
    setEditError('')
    setEditSubmitting(false)
  }

  /** 确认编辑分类 */
  const handleEditConfirm = async () => {
    if (editSubmitting || !editingId) return
    const trimmed = editName.trim()
    if (!trimmed || trimmed.length < 2 || trimmed.length > 20) {
      setEditError('分类名称需2-20字符')
      return
    }
    // 检查重名（排除自身）
    if (categories.some((c) => c.name === trimmed && c.id !== editingId)) {
      setEditError('分类名称已存在')
      return
    }

    setEditSubmitting(true)
    setEditError('')
    const startTime = Date.now()

    try {
      const { error: updateError } = await withTimeoutToast(supabase
        .from('categories')
        .update({ name: trimmed, icon: editIcon })
        .eq('id', editingId))
      if (updateError) throw updateError

      // 如果名称变了，同步更新 checkins 和 goals 中的旧名称
      const oldCat = categories.find((c) => c.id === editingId)
      if (oldCat && oldCat.name !== trimmed) {
        await Promise.all([
          withTimeoutToast(supabase
            .from('checkins')
            .update({ category: trimmed })
            .eq('category', oldCat.name)),
          withTimeoutToast(supabase
            .from('goals')
            .update({ category: trimmed })
            .eq('category', oldCat.name)),
        ])
      }

      onSuccess()
      setEditingId(null)
    } catch {
      setEditError('修改失败，请重试')
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 2000 - elapsed)
      setTimeout(() => setEditSubmitting(false), remaining)
      return
    }
    setEditSubmitting(false)
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

      onSuccess()
      setDeleteTarget(null)
    } catch {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 2000 - elapsed)
      setTimeout(() => setDeleting(false), remaining)
      return
    }
    setDeleting(false)
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !submitting && !editSubmitting && !deleting) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
      onClick={handleOverlayClick}
    >
      <div
        className="relative z-10 max-h-[90vh] w-full max-w-mobile overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-gray-900">管理分类</h2>

        {/* 分类列表 */}
        <div className="mb-4 space-y-2">
          {categories.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              暂无分类，点击下方添加
            </p>
          ) : (
            categories.map((cat) => (
              <div key={cat.id}>
                {editingId === cat.id ? (
                  <div className="rounded-xl border border-primary-200 bg-primary-50 p-3">
                    <div className="mb-2">
                      <label className="mb-1 block text-xs text-gray-500">分类名称</label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => { setEditName(e.target.value); setEditError('') }}
                        maxLength={20}
                        placeholder="2-20字符"
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
                      />
                    </div>
                    <div className="mb-2">
                      <label className="mb-1 block text-xs text-gray-500">选择图标</label>
                      <div className="flex flex-wrap gap-1.5">
                        {PRESET_ICONS.map((icon) => (
                          <button
                            key={icon}
                            type="button"
                            onClick={() => setEditIcon(icon)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors ${
                              editIcon === icon
                                ? 'bg-primary-200 ring-2 ring-primary-500'
                                : 'bg-gray-100 hover:bg-gray-200'
                            }`}
                          >
                            {icon}
                          </button>
                        ))}
                      </div>
                    </div>
                    {editError && (
                      <p className="mb-2 text-xs text-red-500">{editError}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        disabled={editSubmitting}
                        className="flex-1 rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleEditConfirm}
                        disabled={editSubmitting}
                        className={`flex-1 rounded-lg py-2 text-xs font-medium text-white transition-colors ${
                          editSubmitting ? 'bg-primary-300' : 'bg-primary-600 hover:bg-primary-700'
                        }`}
                      >
                        {editSubmitting ? '保存中…' : '保存'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* 展示模式 */
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="flex-1 text-sm font-medium text-gray-800">
                      {cat.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary-600"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(cat)}
                      className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-500"
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 添加分类区域 */}
        {showAdd ? (
          <div className="rounded-xl border border-primary-200 bg-primary-50 p-3">
            <div className="mb-2">
              <label className="mb-1 block text-xs text-gray-500">分类名称</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setError('') }}
                maxLength={20}
                placeholder="2-20字符"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
              <p className="mt-1 text-right text-xs text-gray-400">{newName.length}/20</p>
            </div>
            <div className="mb-2">
              <label className="mb-1 block text-xs text-gray-500">选择图标</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setNewIcon(icon)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors ${
                      newIcon === icon
                        ? 'bg-primary-200 ring-2 ring-primary-500'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            {error && (
              <p className="mb-2 text-xs text-red-500">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowAdd(false); setNewName(''); setNewIcon('📚'); setError('') }}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAdd}
                disabled={submitting}
                className={`flex-1 rounded-lg py-2 text-xs font-medium text-white transition-colors ${
                  submitting ? 'bg-primary-300' : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {submitting ? '添加中…' : '确认添加'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="w-full rounded-lg border border-dashed border-gray-300 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:border-primary-400 hover:text-primary-600"
          >
            + 添加分类
          </button>
        )}

        {/* 底部关闭按钮 */}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-gray-100 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-200"
        >
          关闭
        </button>

        {/* 删除确认弹窗 */}
        {deleteTarget && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-6"
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
                删除分类不会删除已有打卡记录
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
    </div>
  )
}
