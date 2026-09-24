import { useState, useEffect, useMemo } from 'react'

/**
 * 自定义日历选择弹窗（不依赖手机原生日期控件）
 *
 * 为什么不用 <input type="date">：
 * 手机端系统日历是操作系统绘制的 UI，网页无法在其上添加按钮；
 * 且 iOS Safari / 微信 X5 会在选择过程中用空值触发 onChange，导致日期被清空、选完不跳转。
 * 改为完全自绘日历：点日期只"高亮选中"，点「确定」才真正切换。
 *
 * @param {boolean} isOpen - 是否打开
 * @param {string} value - 当前已选日期 YYYY-MM-DD
 * @param {string} max - 可选的最大日期（一般是今天）
 * @param {() => void} onClose - 关闭（取消）
 * @param {(date: string) => void} onConfirm - 点确定时回调，传入选中的日期
 */

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function pad2(n) {
  return String(n).padStart(2, '0')
}

function toStr(year, month, day) {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`
}

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '')
  if (!m) return null
  return { year: Number(m[1]), month: Number(m[2]) - 1, day: Number(m[3]) }
}

export default function DatePickerModal({ isOpen, value, max, onClose, onConfirm }) {
  const [draft, setDraft] = useState(value)
  const [view, setView] = useState({ year: 2020, month: 0 })

  // 每次打开时，以当前日期为选中值，并把日历翻到该日期所在月份
  useEffect(() => {
    if (!isOpen) return
    const anchor = parseDate(value) || parseDate(max) || { year: 1970, month: 0 }
    setDraft(value || max)
    setView({ year: anchor.year, month: anchor.month })
  }, [isOpen, value, max])

  // 阻止滚动穿透
  useEffect(() => {
    if (!isOpen) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const maxInfo = useMemo(() => parseDate(max) || { year: 9999, month: 11 }, [max])

  // 当前显示月份的日期格子
  const cells = useMemo(() => {
    const firstWeekday = new Date(view.year, view.month, 1).getDay()
    const daysCount = new Date(view.year, view.month + 1, 0).getDate()
    const list = []
    for (let i = 0; i < firstWeekday; i += 1) list.push(null)
    for (let d = 1; d <= daysCount; d += 1) list.push(toStr(view.year, view.month, d))
    return list
  }, [view])

  if (!isOpen) return null

  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(draft) && draft <= max

  const canGoNext =
    view.year < maxInfo.year || (view.year === maxInfo.year && view.month < maxInfo.month)

  const shiftMonth = (delta) => {
    let y = view.year
    let m = view.month + delta
    if (m < 0) {
      y -= 1
      m = 11
    } else if (m > 11) {
      y += 1
      m = 0
    }
    setView({ year: y, month: m })
  }

  const jumpToMax = () => {
    setDraft(max)
    setView({ year: maxInfo.year, month: maxInfo.month })
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
        {/* 顶部：标题 + 今天 */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">选择日期</h2>
          <button
            type="button"
            onClick={jumpToMax}
            className="rounded-lg border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-600 transition-colors active:bg-primary-100"
          >
            今天
          </button>
        </div>

        {/* 月份切换 */}
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="上个月"
            onClick={() => shiftMonth(-1)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg text-gray-500 transition-colors active:bg-gray-100"
          >
            ‹
          </button>
          <div className="text-sm font-semibold text-gray-800">
            {view.year} 年 {view.month + 1} 月
          </div>
          {canGoNext ? (
            <button
              type="button"
              aria-label="下个月"
              onClick={() => shiftMonth(1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-lg text-gray-500 transition-colors active:bg-gray-100"
            >
              ›
            </button>
          ) : (
            <span className="flex h-10 w-10 items-center justify-center text-lg text-gray-200">
              ›
            </span>
          )}
        </div>

        {/* 星期表头 */}
        <div className="mb-1 grid grid-cols-7">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-1 text-center text-xs text-gray-400">
              {w}
            </div>
          ))}
        </div>

        {/* 日期格子 */}
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((dateStr, idx) => {
            if (!dateStr) return <div key={`empty-${idx}`} className="h-11" />

            const disabled = dateStr > max
            const selected = dateStr === draft
            const isMaxDay = dateStr === max
            const dayNum = Number(dateStr.slice(8, 10))

            return (
              <button
                key={dateStr}
                type="button"
                disabled={disabled}
                onClick={() => setDraft(dateStr)}
                className="flex h-11 items-center justify-center"
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
                    selected
                      ? 'bg-primary-600 font-semibold text-white'
                      : disabled
                        ? 'text-gray-300'
                        : isMaxDay
                          ? 'font-semibold text-primary-600 ring-1 ring-primary-300'
                          : 'text-gray-700'
                  }`}
                >
                  {dayNum}
                </span>
              </button>
            )
          })}
        </div>

        <p className="mt-2 text-center text-xs text-gray-400">
          已选：{draft || '—'}（只能选今天及以前）
        </p>

        {/* 确定 / 取消：就在这个日历界面里 */}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-500 transition-colors active:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            disabled={!isValid}
            onClick={() => {
              if (isValid) onConfirm(draft)
            }}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors ${
              isValid ? 'bg-primary-600 active:bg-primary-700' : 'cursor-not-allowed bg-primary-300'
            }`}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
