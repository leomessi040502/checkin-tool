import { Check, Eye, EyeOff, Clock3 } from 'lucide-react'
import { isOverdue, } from '../utils/todoSort'
import { getDaysRemaining, formatChineseDate } from '../utils/date'

const PRIORITY_DOT = {
  3: 'bg-red-500',
  2: 'bg-gold-500',
  1: 'bg-ink-300',
}

/**
 * 待办卡片
 * - 自己的待办：勾选圈可直接完成/取消完成，点卡片主体打开详情
 * - 对方的公开待办：只读（无勾选圈），显示「来自 xxx」
 */
function TodoCard({ item, currentUserId, onToggle, onOpen }) {
  const isDone = item.completed_at != null
  const isMine = item.user_id === currentUserId
  const overdue = isOverdue(item)
  const days = getDaysRemaining(item.due_date)
  const isToday = !isDone && item.due_date && days === 0

  return (
    <div
      className={`card flex items-start gap-3 p-4 transition-colors ${isDone ? 'opacity-70' : ''}`}
      style={overdue ? { boxShadow: 'inset 3px 0 0 0 #ef4444' } : undefined}
    >
      {/* 勾选圈（仅自己的） */}
      {isMine ? (
        <button
          type="button"
          aria-label={isDone ? '取消完成' : '标记完成'}
          onClick={(e) => {
            e.stopPropagation()
            onToggle(item)
          }}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            isDone
              ? 'border-primary-600 bg-primary-600 text-white'
              : 'border-primary-200 hover:border-primary-500'
          }`}
        >
          {isDone && <Check size={14} strokeWidth={3} />}
        </button>
      ) : (
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
          <Eye size={14} />
        </span>
      )}

      {/* 主体：点开详情 */}
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[item.priority] || PRIORITY_DOT[2]}`} />
          <h3
            className={`truncate text-sm font-medium ${
              isDone ? 'text-ink-400 line-through' : 'text-ink-900'
            }`}
          >
            {item.title}
          </h3>
          {!isMine && (
            <span className="shrink-0 text-xs text-ink-400">来自 {item.creator_username || '对方'}</span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs">
          {item.due_date && (
            <span
              className={`flex items-center gap-1 ${
                overdue
                  ? 'font-medium text-red-500'
                  : isToday
                    ? 'font-medium text-gold-600'
                    : isDone
                      ? 'text-ink-400'
                      : 'text-ink-600'
              }`}
            >
              <Clock3 size={12} />
              {overdue
                ? `已过期 ${Math.abs(days)} 天`
                : isToday
                  ? '今天到期'
                  : formatChineseDate(item.due_date)}
            </span>
          )}
          {isDone && (
            <span className="text-ink-400">
              已完成 · {new Date(item.completed_at).toLocaleDateString('zh-CN')}
            </span>
          )}
          <span className="ml-auto shrink-0 text-ink-300">
            {item.is_public ? <Eye size={13} /> : <EyeOff size={13} />}
          </span>
        </div>
      </button>
    </div>
  )
}

export default TodoCard
