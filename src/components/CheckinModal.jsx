import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import { useAuth } from '../context/AuthContext'
import { getTodayStr, formatChineseDate } from '../utils/date'

/**
 * 打卡弹窗（新增 / 编辑共用）
 *
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {object} category - 分类对象 { id, name, icon }
 * @param {'create' | 'edit'} mode
 * @param {string} existingNote - 编辑模式时预填的备注
 * @param {string} recordId - 编辑模式时记录 id
 * @param {() => void} onSuccess - 操作成功回调
 */
export default function CheckinModal({ isOpen, onClose, category, mode, existingNote, recordId, onSuccess }) {
  const { user } = useAuth()
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const todayStr = getTodayStr()
  const catName = category?.name || '打卡'
  const catIcon = category?.icon || '📝'

  useEffect(() => {
    if (isOpen) {
      setNote(existingNote || '')
      setError('')
      setSubmitting(false)
    }
  }, [isOpen, existingNote])

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

  const handleConfirm = async () => {
    if (submitting || !user) return
    setSubmitting(true)
    setError('')
    const startTime = Date.now()

    try {
      const trimmedNote = note.trim() || null

      if (mode === 'create') {
        const { error: insertError } = await withTimeoutToast(supabase
          .from('checkins')
          .insert({
            user_id: user.id,
            category_id: category.id,
            category: category.name,
            checkin_date: todayStr,
            note: trimmedNote,
          }))
        if (insertError) throw insertError
      } else {
        const { error: updateError } = await withTimeoutToast(supabase
          .from('checkins')
          .update({ note: trimmedNote })
          .eq('id', recordId))
        if (updateError) throw updateError
      }

      onSuccess()
      onClose()
    } catch {
      setError('打卡失败，请检查网络后重试')
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={handleOverlayClick}
    >
      <div className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        {/* 分类标题 */}
        <div className="mb-1 text-center">
          <span className="text-4xl">{catIcon}</span>
        </div>
        <h2 className="mb-1 text-center text-lg font-bold text-gray-900">
          {catName}打卡
        </h2>
        <p className="mb-4 text-center text-xs text-gray-400">
          {formatChineseDate(todayStr)}
        </p>

        {/* 备注输入 */}
        <div className="mb-4">
          <label className="mb-1 block text-sm text-gray-600">备注（选填）</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={50}
            rows={3}
            placeholder="写点什么…（最多50字）"
            className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-primary-500"
          />
          <p className="mt-1 text-right text-xs text-gray-400">{note.length}/50</p>
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
            {submitting ? '提交中…' : mode === 'create' ? '确认打卡' : '确认修改'}
          </button>
        </div>
      </div>
    </div>
  )
}
