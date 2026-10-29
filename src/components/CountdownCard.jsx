import { Clock3, Pencil, Trash2 } from 'lucide-react'
import { getDaysRemaining, formatChineseDate } from '../utils/date'

function CountdownCard({ item, onEdit, onDelete }) {
  const days = getDaysRemaining(item.target_date)
  const isExpired = days < 0
  const isToday = days === 0

  // 状态徽章：进行中（藏青）/ 今天到期（金色）/ 已到期（红系）
  const statusStyle = isExpired
    ? { label: '已到期', className: 'bg-red-50 text-red-500' }
    : isToday
      ? { label: '今天到期', className: 'bg-gold-100 text-gold-700' }
      : { label: '进行中', className: 'bg-primary-100 text-primary-600' }

  return (
    <div className={`card p-4 transition-colors ${isExpired ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xl">
            <Clock3 size={20} className="text-primary-600" />
          </span>
          <div className="min-w-0 flex-1">
            <h3
              className={`truncate text-base font-medium ${
                isExpired ? 'text-ink-400' : 'text-ink-900'
              }`}
            >
              {item.title}
            </h3>
            <p
              className={`mt-1 text-xs ${
                isExpired ? 'text-ink-400' : 'text-ink-600'
              }`}
            >
              {formatChineseDate(item.target_date)}
            </p>
            {item.creator_username && (
              <p className="mt-0.5 text-xs text-ink-400">
                由 {item.creator_username} 创建
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`whitespace-nowrap text-sm ${
              isExpired ? 'text-ink-400' : 'text-ink-600'
            }`}
          >
            {isExpired ? (
              <>
                已过期{' '}
                <span className="font-bold text-primary-800">
                  {Math.abs(days)}
                </span>{' '}
                天
              </>
            ) : isToday ? (
              <span className="font-bold text-primary-800">今天</span>
            ) : (
              <>
                还剩{' '}
                <span className="font-bold text-primary-800">{days}</span> 天
              </>
            )}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${statusStyle.className}`}
          >
            {statusStyle.label}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(item)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
            >
              <Pencil size={12} />
              编辑
            </button>
            <button
              onClick={() => onDelete(item)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-400 transition-colors hover:bg-primary-50 hover:text-red-500"
            >
              <Trash2 size={12} />
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CountdownCard
