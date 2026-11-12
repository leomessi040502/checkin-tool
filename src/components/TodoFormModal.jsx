import { useState, useEffect } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import { getTodayStr, formatChineseDate } from '../utils/date'
import DatePickerModal from './DatePickerModal'

const PRIORITIES = [
  { value: 3, label: '高' },
  { value: 2, label: '中' },
  { value: 1, label: '低' },
]

/**
 * 待办新增/编辑弹窗
 * 编辑时不碰 completed_at（完成状态只在详情弹层里改）
 */
function TodoFormModal({ open, onClose, onSuccess, initialData, currentUserId }) {
  const isEdit = !!initialData
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState(2)
  const [isPublic, setIsPublic] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  const today = getTodayStr()

  useEffect(() => {
    if (open) {
      setTitle(initialData?.title || '')
      setNote(initialData?.note || '')
      setDueDate(initialData?.due_date || '')
      setPriority(initialData?.priority ?? 2)
      setIsPublic(initialData?.is_public ?? false)
      setError('')
      setDatePickerOpen(false)
    }
  }, [open, initialData])

  if (!open) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    if (!title.trim()) {
      setError('请输入待办标题')
      return
    }

    setSubmitting(true)
    setError('')

    const payload = {
      title: title.trim(),
      note: note.trim() || null,
      due_date: dueDate || null,
      priority,
      is_public: isPublic,
    }

    try {
      if (isEdit) {
        const { error: updateError } = await withTimeoutToast(supabase
          .from('todos')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', initialData.id))
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await withTimeoutToast(supabase
          .from('todos')
          .insert({ ...payload, user_id: currentUserId }))
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
    <>
      <div
        className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/40" />
        <div
          className="relative z-10 max-h-[88vh] w-full max-w-mobile overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="mb-4 text-lg font-bold text-ink-900">
            {isEdit ? '编辑待办' : '新增待办'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 标题 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">
                标题
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                placeholder="要做什么？"
                className="w-full rounded-lg border border-primary-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-500"
              />
              <p className="mt-1 text-right text-xs text-ink-400">
                {title.length}/100
              </p>
            </div>

            {/* 备注 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">
                备注 <span className="font-normal text-ink-400">（可选）</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="补充说明、细节…"
                className="w-full resize-none rounded-lg border border-primary-200 px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary-500"
              />
              <p className="mt-1 text-right text-xs text-ink-400">
                {note.length}/500
              </p>
            </div>

            {/* 截止日期：自绘日历（不碰原生 date 控件） */}
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">
                截止日期 <span className="font-normal text-ink-400">（可选）</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDatePickerOpen(true)}
                  className="flex flex-1 items-center gap-2 rounded-lg border border-primary-200 px-3 py-2.5 text-sm text-ink-600 transition-colors hover:border-primary-500"
                >
                  <CalendarDays size={16} className="text-primary-500" />
                  {dueDate ? formatChineseDate(dueDate) : '选择日期'}
                </button>
                {dueDate && (
                  <button
                    type="button"
                    onClick={() => setDueDate('')}
                    className="flex items-center justify-center rounded-lg border border-primary-200 px-3 py-2.5 text-ink-400 transition-colors hover:text-red-500"
                    aria-label="清除截止日期"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* 优先级 */}
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">
                优先级
              </label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={`flex-1 rounded-lg border py-2.5 text-sm font-medium transition-colors ${
                      priority === p.value
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-primary-200 bg-white text-ink-600 hover:border-primary-500'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 公开/私密 */}
            <div className="flex items-center justify-between rounded-lg border border-primary-200 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-ink-900">公开给对方</p>
                <p className="mt-0.5 text-xs text-ink-400">
                  公开后对方可见（仅查看，不能修改）
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={() => setIsPublic(!isPublic)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  isPublic ? 'bg-primary-500' : 'bg-primary-100'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    isPublic ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* 错误提示 */}
            {error && <p className="text-center text-sm text-red-500">{error}</p>}

            {/* 按钮组 */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 rounded-lg border border-primary-200 bg-white py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-primary-50"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  submitting
                    ? 'cursor-not-allowed bg-primary-300 text-white'
                    : 'bg-primary-500 text-white hover:bg-primary-600'
                }`}
              >
                {submitting ? '提交中…' : isEdit ? '保存' : '确认'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* 日期选择（自绘日历，可选今天及以后） */}
      <DatePickerModal
        isOpen={datePickerOpen}
        value={dueDate}
        min={today}
        onClose={() => setDatePickerOpen(false)}
        onConfirm={(date) => {
          setDueDate(date)
          setDatePickerOpen(false)
        }}
      />
    </>
  )
}

export default TodoFormModal
