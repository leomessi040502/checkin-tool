import { formatChineseDate, getDaysRemaining } from '../utils/date'

const TYPE_LABELS = {
  periodic: '周期目标',
  lifelong: '长期累计',
}

const STATUS_STYLES = {
  active: { label: '进行中', bg: 'bg-green-100', text: 'text-green-700' },
  completed: { label: '已完成', bg: 'bg-blue-100', text: 'text-blue-700' },
  expired: { label: '已过期', bg: 'bg-gray-100', text: 'text-gray-500' },
}

function GoalCard({ goal, currentCount, onEdit, onDelete, isOwner, creatorUsername, categoryName, categoryIcon }) {
  const typeLabel = TYPE_LABELS[goal.type] || goal.type
  const statusStyle = STATUS_STYLES[goal.status] || STATUS_STYLES.active
  const isDimmed = goal.status === 'completed' || goal.status === 'expired'

  const target = goal.target_count || 1
  const percent = Math.min(100, Math.round((currentCount / target) * 100))

  const daysLeft = goal.end_date ? getDaysRemaining(goal.end_date) : null

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        isDimmed
          ? 'border-gray-200 bg-gray-50 opacity-60'
          : 'border-gray-200 bg-white'
      }`}
    >
      {/* 标题 + 标签 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3
            className={`truncate text-base font-medium ${
              isDimmed ? 'text-gray-400' : 'text-gray-900'
            }`}
          >
            {goal.title}
          </h3>
          {creatorUsername && (
            <p className="mt-0.5 text-xs text-gray-400">
              由 {creatorUsername} 创建
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          {categoryName && (
            <span className="rounded bg-primary-50 px-1.5 py-0.5 text-xs text-primary-600">
              {categoryIcon} {categoryName}
            </span>
          )}
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
            {typeLabel}
          </span>
        </div>
      </div>

      {/* 进度条 */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className={isDimmed ? 'text-gray-400' : 'text-gray-500'}>
            进度
          </span>
          <span
            className={`font-medium ${
              isDimmed ? 'text-gray-400' : 'text-gray-700'
            }`}
          >
            {currentCount}/{target}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full transition-all ${
              isDimmed
                ? 'bg-gray-300'
                : percent >= 100
                  ? 'bg-green-500'
                  : 'bg-primary-500'
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* 底部：日期 + 状态 + 操作 */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {goal.end_date && (
            <span className="text-xs text-gray-400">
              截止：{formatChineseDate(goal.end_date)}
              {goal.status === 'active' && daysLeft !== null && (
                <span className="ml-1">
                  {daysLeft >= 0
                    ? `(剩${daysLeft}天)`
                    : `(已过期${Math.abs(daysLeft)}天)`}
                </span>
              )}
            </span>
          )}
          <span
            className={`rounded px-1.5 py-0.5 text-xs ${statusStyle.bg} ${statusStyle.text}`}
          >
            {statusStyle.label}
          </span>
        </div>
        {isOwner && (
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(goal)}
              className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-primary-600"
            >
              编辑
            </button>
            <button
              onClick={() => onDelete(goal)}
              className="rounded-md px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-500"
            >
              删除
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default GoalCard
