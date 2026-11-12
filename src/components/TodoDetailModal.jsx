import { useState } from 'react'
import { Pencil, Trash2, CheckCircle2, RotateCcw, Eye, EyeOff, Flag, Clock3, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { withTimeoutToast } from '../utils/apiWrapper'
import { formatChineseDate } from '../utils/date'

const PRIORITY_LABEL = { 3: '高', 2: '中', 1: '低' }
const PRIORITY_STYLE = {
  3: 'bg-red-50 text-red-500',
  2: 'bg-gold-100 text-gold-700',
  1: 'bg-primary-100 text-primary-600',
}

/**
 * 待办详情底部弹层：查看完整信息 + 完成/取消完成 + 编辑/删除入口
 * 仅自己的待办显示操作按钮；对方的公开待办纯查看
 */
function TodoDetailModal({ open, todo, currentUserId, onClose, onChanged, onEdit, onDelete }) {
  const [busy, setBusy] = useState(false)

  if (!open || !todo) return null

  const isDone = todo.completed_at != null
  const isMine = todo.user_id === currentUserId

  const toggleComplete = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { error } = await withTimeoutToast(supabase
        .from('todos')
        .update({
          completed_at: isDone ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', todo.id))
      if (error) throw error
      onChanged()
    } catch {
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      onClick={() => !busy && onClose()}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative z-10 max-h-[85vh] w-full max-w-mobile overflow-y-auto rounded-t-2xl bg-white p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题行 */}
        <div className="flex items-start gap-2">
          <h2
            className={`min-w-0 flex-1 text-lg font-bold ${
              isDone ? 'text-ink-400 line-through' : 'text-ink-900'
            }`}
          >
            {todo.title}
          </h2>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${PRIORITY_STYLE[todo.priority] || PRIORITY_STYLE[2]}`}>
            {PRIORITY_LABEL[todo.priority] || '中'}优先级
          </span>
        </div>

        {/* 状态 */}
        <div className="mt-2 flex items-center gap-2 text-xs text-ink-400">
          {isDone ? (
            <span className="flex items-center gap-1 text-primary-600">
              <CheckCircle2 size={13} />
              已完成 · {new Date(todo.completed_at).toLocaleString('zh-CN')}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Clock3 size={13} />未完成
            </span>
          )}
        </div>

        {/* 信息区 */}
        <div className="mt-4 space-y-2.5 rounded-lg bg-surface p-3.5 text-sm">
          <div className="flex items-center gap-2 text-ink-600">
            <CalendarDays size={15} className="shrink-0 text-primary-500" />
            {todo.due_date ? `截止：${formatChineseDate(todo.due_date)}` : '无截止日期'}
          </div>
          <div className="flex items-center gap-2 text-ink-600">
            {todo.is_public ? <Eye size={15} className="shrink-0 text-primary-500" /> : <EyeOff size={15} className="shrink-0 text-primary-500" />}
            {todo.is_public ? '公开（对方可见，仅查看）' : '私密（仅自己可见）'}
          </div>
          <div className="flex items-center gap-2 text-ink-400">
            <Flag size={15} className="shrink-0" />
            创建于 {new Date(todo.created_at).toLocaleString('zh-CN')}
          </div>
        </div>

        {/* 备注 */}
        {todo.note && (
          <div className="mt-3">
            <p className="mb-1 text-xs font-medium text-ink-400">备注</p>
            <p className="whitespace-pre-wrap rounded-lg bg-surface p-3.5 text-sm text-ink-900">
              {todo.note}
            </p>
          </div>
        )}

        {/* 操作区：仅自己的待办 */}
        {isMine ? (
          <div className="mt-5 space-y-2.5">
            <button
              type="button"
              onClick={toggleComplete}
              disabled={busy}
              className={`w-full rounded-lg py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                isDone ? 'bg-primary-500 hover:bg-primary-600' : 'bg-primary-800 hover:bg-primary-900'
              }`}
            >
              {busy ? '处理中…' : isDone ? (
                <span className="flex items-center justify-center gap-1.5">
                  <RotateCcw size={15} />取消完成
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={15} />标记完成
                </span>
              )}
            </button>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => !busy && onEdit(todo)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary-200 bg-white py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-primary-50"
              >
                <Pencil size={14} />编辑
              </button>
              <button
                type="button"
                onClick={() => !busy && onDelete(todo)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-100 bg-white py-2.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
              >
                <Trash2 size={14} />删除
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-5 text-center text-xs text-ink-400">
            这是 {todo.creator_username || '对方'} 的公开待办，仅可查看
          </p>
        )}
      </div>
    </div>
  )
}

export default TodoDetailModal
