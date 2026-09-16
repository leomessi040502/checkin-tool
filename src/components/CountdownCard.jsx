import { getDaysRemaining, formatChineseDate } from '../utils/date'

function CountdownCard({ item, onEdit, onDelete }) {
  const days = getDaysRemaining(item.target_date)
  const isExpired = days < 0
  const isToday = days === 0

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isExpired
          ? 'border-gray-200 bg-gray-50 opacity-60'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3
            className={`truncate text-base font-medium ${
              isExpired ? 'text-gray-400' : 'text-gray-900'
            }`}
          >
            {item.title}
          </h3>
          <p
            className={`mt-1 text-xs ${
              isExpired ? 'text-gray-400' : 'text-gray-500'
            }`}
          >
            {formatChineseDate(item.target_date)}
          </p>
          {item.creator_username && (
            <p className="mt-0.5 text-xs text-gray-400">
              由 {item.creator_username} 创建
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className={`whitespace-nowrap text-sm font-semibold ${
              isExpired
                ? 'text-gray-400'
                : isToday
                  ? 'text-orange-500'
                  : 'text-green-600'
            }`}
          >
            {isExpired
              ? `已过期 ${Math.abs(days)} 天`
              : isToday
                ? '今天'
                : `还剩 ${days} 天`}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(item)}
              className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary-600"
            >
              编辑
            </button>
            <button
              onClick={() => onDelete(item)}
              className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-500"
            >
              删除
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CountdownCard
