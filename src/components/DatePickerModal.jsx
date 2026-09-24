import { useState, useEffect } from 'react'

/**
 * 日期选择弹窗
 * 手机端原生日期选择器不可靠（会用空值触发 onChange、选完值被弹回），
 * 改为在弹窗内先选日期、再点"确定"确认，由调用方决定是否切换。
 *
 * @param {boolean} isOpen - 是否打开
 * @param {string} value - 当前已选日期 YYYY-MM-DD
 * @param {string} max - 可选的最大日期（一般是今天）
 * @param {() => void} onClose - 关闭（取消）
 * @param {(date: string) => void} onConfirm - 点确定时回调，传入选中的日期
 */
export default function DatePickerModal({ isOpen, value, max, onClose, onConfirm }) {
  const [draft, setDraft] = useState(value)

  // 每次打开时以当前日期为起点
  useEffect(() => {
    if (isOpen) setDraft(value)
  }, [isOpen, value])

  // 阻止滚动穿透
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  // 只允许合法且不晚于 max 的日期
  const isValid = /^\d{4}-\d{2}-\d{2}$/.test(draft) && draft <= max

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
        <h2 className="mb-4 text-center text-base font-bold text-gray-900">
          选择日期
        </h2>

        <input
          type="date"
          value={draft}
          max={max}
          onChange={(e) => {
            const v = e.target.value
            if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v <= max) {
              setDraft(v)
            }
          }}
          className="h-12 w-full rounded-lg border border-gray-200 px-3 text-base text-gray-700 outline-none transition-colors focus:border-primary-500"
        />
        <p className="mt-2 text-center text-xs text-gray-400">
          只能选择今天及以前的日期
        </p>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              if (isValid) onConfirm(draft)
            }}
            disabled={!isValid}
            className={`flex-1 rounded-lg py-2.5 text-sm font-medium text-white transition-colors ${
              isValid
                ? 'bg-primary-600 active:bg-primary-700'
                : 'cursor-not-allowed bg-primary-300'
            }`}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
