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
  const [goalId, setGoalId] = useState('') // 关联目标（可选）
  const [goalOptions, setGoalOptions] = useState([]) // 自己的进行中目标 + 编辑时已关联的目标
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
      setGoalId(initialData?.goal_id || '')
      setError('')
      setDatePickerOpen(false)
      // 加载自己「进行中」的目标供关联；012 未执行（无 goal_id 列）时静默降级为不显示
      if (currentUserId) {
        withTimeoutToast(supabase
          .from('goals')
          .select('id, title')
          .eq('user_id', currentUserId)
          .eq('status', 'active')
          .order('created_at', { ascending: false }))
          .then(({ data, error: goalErr }) => {
            if (goalErr) {
              setGoalOptions(initialData?.goal ? [initialData.goal] : [])
              return
            }
            const opts = data || []
            // 编辑时若已关联的目标已不在进行中列表，补充进去避免关联被静默清掉
            const linked = initialData?.goal
            if (linked && !opts.some((g) => g.id === linked.id)) opts.unshift(linked)
            setGoalOptions(opts)
          })
          .catch(() => setGoalOptions(initialData?.goal ? [initialData.goal] : []))
      }
    }
  }, [open, initialData, currentUserId])

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
      goal_id: goalId || null,
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

            {/* 关联目标（可选）：目标完成/结束时待办自动同步状态 */}
            {goalOptions.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-ink-600">
                  关联目标 <span className="font-normal text-ink-400">（可选）</span>
                </label>
                <select
                  value={goalId}
                  onChange={(e) => setGoalId(e.target.value)}
                  className="w-full rounded-lg border border-primary-200 bg-white px-3 py-2.5 text-sm text-ink-600 outline-none transition-colors focus:border-primary-500"
                >
                  <option value="">不关联</option>
                  {goalOptions.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-ink-400">
                  仅可关联自己创建的进行中目标
                </p>
              </div>
            )}

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
