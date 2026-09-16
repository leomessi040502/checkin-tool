import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import { useAuth } from '../context/AuthContext'
import { getLast7Days } from '../utils/date'

/**
 * 补卡弹窗
 *
 * @param {boolean} isOpen
 * @param {() => void} onClose
 * @param {Array} categories - 从父组件传入的分类列表
 * @param {() => void} onSuccess - 补卡成功回调
 */
export default function MakeupCheckinModal({ isOpen, onClose, categories, onSuccess }) {
  const { user } = useAuth()
  const [selectedCategoryId, setSelectedCategoryId] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [existingMap, setExistingMap] = useState({})

  const last7Days = getLast7Days()

  const fetchExisting = useCallback(async () => {
    if (!user) return
    try {
      const dates = last7Days.map((d) => d.dateStr)
      const { data, error: queryError } = await withTimeoutToast(supabase
        .from('checkins')
        .select('category_id, checkin_date')
        .eq('user_id', user.id)
        .in('checkin_date', dates))

      if (queryError) throw queryError

      const map = {}
      data?.forEach((c) => {
        if (c.category_id) {
          map[`${c.checkin_date}-${c.category_id}`] = true
        }
      })
      setExistingMap(map)
    } catch {
      // 查询失败时静默处理，允许补卡（后端唯一约束会兜底）
    }
  }, [user])

  useEffect(() => {
    if (isOpen) {
      setSelectedCategoryId(categories[0]?.id || null)
      setSelectedDate('')
      setNote('')
      setError('')
      setSubmitting(false)
      fetchExisting()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // 切换分类时如果当前选中的日期已被打卡，则清空选中
  useEffect(() => {
    if (selectedDate && selectedCategoryId && existingMap[`${selectedDate}-${selectedCategoryId}`]) {
      setSelectedDate('')
    }
  }, [selectedCategoryId, selectedDate, existingMap])

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

  const isDateDisabled = (dateStr) => {
    if (!selectedCategoryId) return false
    return !!existingMap[`${dateStr}-${selectedCategoryId}`]
  }

  const handleConfirm = async () => {
    if (submitting || !user || !selectedDate || !selectedCategoryId) return
    setSubmitting(true)
    setError('')
    const startTime = Date.now()

    try {
      const trimmedNote = note.trim() || null
      const selectedCat = categories.find((c) => c.id === selectedCategoryId)
      const { error: insertError } = await withTimeoutToast(supabase
        .from('checkins')
        .insert({
          user_id: user.id,
          category_id: selectedCategoryId,
          category: selectedCat?.name,
          checkin_date: selectedDate,
          note: trimmedNote,
        }))

      if (insertError) throw insertError

      onSuccess()
      onClose()
    } catch {
      setError('补卡失败，请检查网络后重试')
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
      <div className="mx-4 max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-center text-lg font-bold text-gray-900">补卡</h2>

        {/* 选择分类 */}
        <div className="mb-4">
          <label className="mb-2 block text-sm text-gray-600">选择分类</label>
          {categories.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">暂无分类</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`flex min-w-[72px] flex-col items-center gap-1 rounded-lg border py-2.5 text-sm transition-colors ${
                    selectedCategoryId === cat.id
                      ? 'border-primary-500 bg-primary-50 text-primary-600'
                      : 'border-gray-200 text-gray-500'
                  }`}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <span className="truncate">{cat.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 选择日期 */}
        <div className="mb-4">
          <label className="mb-2 block text-sm text-gray-600">选择日期（近7天）</label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {last7Days.map((d) => {
              const disabled = isDateDisabled(d.dateStr)
              const selected = selectedDate === d.dateStr
              return (
                <button
                  key={d.dateStr}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSelectedDate(d.dateStr)}
                  className={`flex min-w-[72px] flex-col items-center gap-0.5 rounded-lg border py-2 px-2 text-xs transition-colors ${
                    selected
                      ? 'border-primary-500 bg-primary-50 text-primary-600'
                      : disabled
                        ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
                        : 'border-gray-200 text-gray-600 hover:border-primary-300'
                  }`}
                >
                  <span className="font-medium">{d.weekday}</span>
                  <span>{d.label.replace(/年|月/g, '/').replace(/日$/, '')}</span>
                  {disabled && <span className="text-[10px]">已打卡</span>}
                </button>
              )
            })}
          </div>
        </div>

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
            disabled={submitting || !selectedDate || !selectedCategoryId}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors ${
              submitting || !selectedDate || !selectedCategoryId
                ? 'cursor-not-allowed bg-primary-400'
                : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {submitting ? '提交中…' : '确认补卡'}
          </button>
        </div>
      </div>
    </div>
  )
}
