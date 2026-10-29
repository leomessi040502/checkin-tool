import { AlertTriangle, CheckCircle2, Pencil, Pin, Target, Trash2, XCircle } from 'lucide-react'
import { formatChineseDate, getDaysRemaining } from '../utils/date'

const TYPE_LABELS = {
  periodic: '周期目标',
  lifelong: '长期累计',
}

const STATUS_STYLES = {
  active: { label: '进行中', bg: 'bg-primary-100', text: 'text-primary-600' },
  completed: { label: '已完成', bg: 'bg-gold-100', text: 'text-gold-700' },
  expired: { label: '已过期', bg: 'bg-red-50', text: 'text-red-500' },
}

function GoalCard({ goal, currentCount, onEdit, onDelete, isOwner, creatorUsername, todayCompleted = 0, todayTotal = 0, relatedCategories = [] }) {
  const typeLabel = TYPE_LABELS[goal.type] || goal.type
  const statusStyle = STATUS_STYLES[goal.status] || STATUS_STYLES.active
  const isDimmed = goal.status === 'completed' || goal.status === 'expired'

  const hasTarget = !!goal.target_count
  const target = goal.target_count || 1
  const percent = hasTarget ? Math.min(100, Math.round((currentCount / target) * 100)) : 0

  const daysLeft = goal.end_date ? getDaysRemaining(goal.end_date) : null

  // 当日完成状态
  let todayStatus = null
  if (todayTotal > 0) {
    if (todayCompleted === todayTotal) {
      todayStatus = { icon: <CheckCircle2 size={14} className="text-gold-500" />, label: `完成(${todayCompleted}/${todayTotal})` }
    } else if (todayCompleted === 0) {
      todayStatus = { icon: <XCircle size={14} className="text-ink-400" />, label: `未开始(0/${todayTotal})` }
    } else {
      todayStatus = { icon: <AlertTriangle size={14} className="text-gold-500" />, label: `部分完成(${todayCompleted}/${todayTotal})` }
    }
  } else {
    todayStatus = { icon: <Pin size={14} className="text-ink-400" />, label: '未关联分类' }
  }

  // 分类标签：最多显示3个，超出显示 +N
  const maxVisible = 3
  const visibleCats = relatedCategories.slice(0, maxVisible)
  const overflowCount = relatedCategories.length - maxVisible

  return (
    <div className={`card p-4 transition-colors ${isDimmed ? 'opacity-60' : ''}`}>
      {/* 头像 + 标题 + 标签 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xl">
            <Target size={20} className="text-primary-600" />
          </span>
          <div className="min-w-0 flex-1">
            <h3
              className={`truncate text-base font-medium ${
                isDimmed ? 'text-ink-400' : 'text-ink-900'
              }`}
            >
              {goal.title}
            </h3>
            {creatorUsername && (
              <p className="mt-0.5 text-xs text-ink-400">
                由 {creatorUsername} 创建
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {visibleCats.map((cat) => (
            <span
              key={cat.id}
              className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-600"
            >
              {cat.icon} {cat.name}
            </span>
          ))}
          {overflowCount > 0 && (
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-ink-600">
              +{overflowCount}
            </span>
          )}
          <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs text-ink-600">
            {typeLabel}
          </span>
        </div>
      </div>

      {/* 进度条 */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-xs text-ink-400">进度</span>
          <span
            className={`font-bold ${
              isDimmed ? 'text-ink-400' : 'text-primary-800'
            }`}
          >
            {hasTarget ? `${currentCount}/${target}` : `${currentCount}次`}
            {hasTarget && (
              <span className="ml-1 text-xs font-normal text-ink-400">
                {percent}%
              </span>
            )}
          </span>
        </div>
        <div className={`h-2 w-full overflow-hidden rounded-full ${hasTarget ? 'bg-primary-100' : 'bg-transparent'}`}>
          {hasTarget && (
            <div
              className={`h-full rounded-full transition-all ${
                isDimmed
                  ? 'bg-primary-200'
                  : percent >= 100
                    ? 'bg-gold-500'
                    : 'bg-primary-600'
              }`}
              style={{ width: `${percent}%` }}
            />
          )}
        </div>
      </div>

      {/* 当日完成状态 */}
      <div className="mt-2 flex items-center gap-1 text-xs">
        <span
          className={`flex items-center gap-1 ${
            isDimmed ? 'text-ink-400' : 'text-ink-600'
          }`}
        >
          {todayStatus.icon} {todayStatus.label}
        </span>
      </div>

      {/* 底部：日期 + 状态 + 操作 */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {goal.end_date && (
            <span className="text-xs text-ink-400">
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
            className={`rounded-full px-2 py-0.5 text-xs ${statusStyle.bg} ${statusStyle.text}`}
          >
            {statusStyle.label}
          </span>
        </div>
        {isOwner && (
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(goal)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-400 transition-colors hover:bg-primary-50 hover:text-primary-600"
            >
              <Pencil size={12} />
              编辑
            </button>
            <button
              onClick={() => onDelete(goal)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-400 transition-colors hover:bg-primary-50 hover:text-red-500"
            >
              <Trash2 size={12} />
              删除
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default GoalCard
