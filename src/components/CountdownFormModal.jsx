import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import { getTodayStr } from '../utils/date'

function CountdownFormModal({
  open,
  onClose,
  onSuccess,
  initialData,
  currentUserId,
}) {
  const isEdit = !!initialData
  const [title, setTitle] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const today = getTodayStr()

  useEffect(() => {
    if (open) {
      setTitle(initialData?.title || '')
      setTargetDate(initialData?.target_date || '')
      setError('')
    }
  }, [open, initialData])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    if (!title.trim()) {
      setError('请输入事项名称')
      return
    }
    if (!targetDate) {
      setError('请选择目标日期')
      return
    }
    if (targetDate < today) {
      setError('目标日期不能早于今天')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      if (isEdit) {
        const { error: updateError } = await withTimeoutToast(supabase
          .from('countdowns')
          .update({
            title: title.trim(),
            target_date: targetDate,
          })
          .eq('id', initialData.id))
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await withTimeoutToast(supabase
          .from('countdowns')
          .insert({
            title: title.trim(),
            target_date: targetDate,
            type: 'shared',
            creator_id: currentUserId,
          }))
        if (insertError) throw insertError
      }
      onSuccess()
    } catch {
      setError('操作失败，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 w-full max-w-mobile rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold text-gray-900">
          {isEdit ? '编辑倒计时' : '新增倒计时'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 事项名称 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              事项名称
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={30}
              placeholder="请输入事项名称"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-500"
            />
            <p className="mt-1 text-right text-xs text-gray-400">
              {title.length}/30
            </p>
          </div>

          {/* 目标日期 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              目标日期
            </label>
            <input
              type="date"
              value={targetDate}
              min={today}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-500"
            />
          </div>

          {/* 错误提示 */}
          {error && <p className="text-center text-sm text-red-500">{error}</p>}

          {/* 按钮组 */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                submitting
                  ? 'cursor-not-allowed bg-primary-300 text-white'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {submitting ? '提交中…' : isEdit ? '保存' : '确认'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CountdownFormModal
