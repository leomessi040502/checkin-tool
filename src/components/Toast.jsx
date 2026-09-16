import { useState, useEffect, useCallback } from 'react'

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
  success: 'bg-green-600',
  error: 'bg-red-500',
  info: 'bg-gray-800',
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
      className={`fixed left-1/2 top-4 z-[100] max-w-[90%] -translate-x-1/2 rounded-lg px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg ${TYPE_STYLES[toast.type] || TYPE_STYLES.info}`}
    >
      {toast.message}
    </div>
  )
}
