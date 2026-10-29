import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

// 全局 toast 控制器，允许非 React 代码（如 apiWrapper）触发提示
let _setToastFn = null

/**
 * 全局显示 toast 提示
 * @param {string} message - 提示内容
 * @param {'success' | 'error' | 'info'} type - 提示类型
 */
export function showToast(message, type = 'error') {
  if (_setToastFn) {
    _setToastFn({ message, type, id: Date.now() })
  }
}

const TYPE_STYLES = {
  success: 'bg-primary-800 text-white',
  error: 'bg-red-500 text-white',
  info: 'bg-primary-800 text-white',
}

/**
 * 全局 Toast 提示组件
 * 固定在屏幕顶部，3秒后自动消失
 */
export default function Toast() {
  const [toast, setToast] = useState(null)

  const handleSet = useCallback((t) => {
    setToast(t)
    if (t) {
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    _setToastFn = handleSet
    return () => {
      _setToastFn = null
    }
  }, [handleSet])

  if (!toast) return null

  return (
    <div
      className={`fixed left-1/2 top-4 z-[100] flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-lg px-4 py-2.5 text-center text-sm font-medium shadow-lg ${TYPE_STYLES[toast.type] || TYPE_STYLES.info}`}
    >
      {toast.type === 'error' ? (
        <XCircle size={16} className="shrink-0" />
      ) : (
        <CheckCircle2 size={16} className="shrink-0" />
      )}
      {toast.message}
    </div>
  )
}
