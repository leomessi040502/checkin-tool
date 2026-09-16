import { useState, useEffect } from 'react'
import { showToast } from './Toast'

/**
 * 全局网络状态监听组件
 * - 网络断开时在顶部显示红色 banner
 * - 网络恢复时显示简短 toast 提示
 */
export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      showToast('网络已恢复', 'success')
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className="fixed left-0 right-0 top-0 z-[100] bg-red-500 px-4 py-2 text-center text-sm font-medium text-white shadow-md">
      网络已断开，请检查网络连接
    </div>
  )
}
