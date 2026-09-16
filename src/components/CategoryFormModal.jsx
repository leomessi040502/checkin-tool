import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'

const PRESET_ICONS = [
  '📚', '🌱', '🏃', '💰', '🍔', '🎵', '🧘', '🎨',
  '💻', '☕', '📖', '💪', '🎯', '✏️', '🎮', '🎸',
  '🛒', '🍳', '🚴', '⚽', '🏀', '🏔️', '✈️', '📷',
  '💡', '📌',
]

/**
 * 分类新增/编辑弹窗
 *
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {() => void} onSuccess - 操作成功回调
 * @param {object|null} category - 编辑模式时传入分类对象 {id, name, icon}，null 为新增
 * @param {string} userId - 当前用户 id
 */
export default function CategoryFormModal({ isOpen, onClose, onSuccess, category, userId }) {
  const isEdit = !!category
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📌')
  const [customIcon, setCustomIcon] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (category) {
        setName(category.name || '')
        setIcon(category.icon || '📌')
      } else {
        setName('')
        setIcon('📌')
      }
      setCustomIcon('')
      setError('')
      setSubmitting(false)
    }
  }, [isOpen, category])

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

  const currentIcon = customIcon || icon

  const handleConfirm = async () => {
    if (submitting) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('请输入分类名称')
      return
    }
    if (trimmed.length > 20) {
      setError('分类名称最多20字')
      return
    }

    setSubmitting(true)
    setError('')
    const startTime = Date.now()

    try {
      if (isEdit) {
        const { error: updateError } = await withTimeoutToast(supabase
          .from('categories')
          .update({ name: trimmed, icon: currentIcon })
          .eq('id', category.id))
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await withTimeoutToast(supabase
          .from('categories')
          .insert({
            name: trimmed,
            icon: currentIcon,
            creator_id: userId,
          }))
        if (insertError) throw insertError
      }

      onSuccess()
      onClose()
    } catch (err) {
      if (err?.code === '23505') {
        setError('分类名称已存在')
      } else {
        setError('操作失败，请重试')
      }
      // 防抖：确保按钮至少禁用 2 秒
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 2000 - elapsed)
      setTimeout(() => setSubmitting(false), remaining)
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !submitting) {
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
        <h2 className="mb-4 text-lg font-bold text-gray-900">
          {isEdit ? '编辑分类' : '添加分类'}
        </h2>

        {/* 分类名称 */}
        <div className="mb-4">
          <label className="mb-1 block text-sm text-gray-600">分类名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            maxLength={20}
            placeholder="请输入分类名称（最多20字）"
            className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-500"
          />
          <p className="mt-1 text-right text-xs text-gray-400">{name.length}/20</p>
        </div>

        {/* 选择图标 */}
        <div className="mb-4">
          <label className="mb-2 block text-sm text-gray-600">选择图标</label>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                onClick={() => { setIcon(ic); setCustomIcon('') }}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors ${
                  !customIcon && icon === ic
                    ? 'bg-primary-200 ring-2 ring-primary-500'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {ic}
              </button>
            ))}
          </div>
          {/* 自定义图标输入 */}
          <div className="mt-2">
            <label className="mb-1 block text-xs text-gray-400">或自定义输入 emoji</label>
            <input
              type="text"
              value={customIcon}
              onChange={(e) => setCustomIcon(e.target.value.slice(0, 4))}
              placeholder="粘贴或输入 emoji"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
          {/* 预览 */}
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
            <span>预览：</span>
            <span className="text-2xl">{currentIcon}</span>
            <span className="font-medium text-gray-600">{name || '分类名称'}</span>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <p className="mb-3 text-center text-sm text-red-500">{error}</p>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors ${
              submitting
                ? 'bg-primary-400'
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {submitting ? '提交中…' : isEdit ? '保存' : '确认添加'}
          </button>
        </div>
      </div>
    </div>
  )
}
