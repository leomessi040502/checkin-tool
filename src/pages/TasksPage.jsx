import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import TodoSection from '../components/TodoSection'
import CountdownSection from '../components/CountdownSection'

const SUB_TABS = [
  { key: 'todo', label: '待办' },
  { key: 'countdown', label: '倒计时' },
]

/**
 * 事项页：页面壳 + 「待办 / 倒计时」双子 tab
 * - ?tab=countdown 直达倒计时（供 /countdown 旧路由重定向）
 * - 切换 tab 同步写回 URL（可刷新、可分享）
 * - 两区数据完全独立（todos / countdowns 两张表）
 */
function TasksPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    urlTab === 'countdown' ? 'countdown' : 'todo',
  )

  // 浏览器前进/后退（或外链带参进入）时同步 tab 状态
  useEffect(() => {
    if (urlTab === 'countdown' || urlTab === 'todo') {
      setActiveTab(urlTab)
    }
  }, [urlTab])

  const switchTab = (key) => {
    setActiveTab(key)
    setSearchParams(key === 'todo' ? { tab: 'todo' } : { tab: 'countdown' }, { replace: true })
  }

  return (
    <div className="px-4 py-6 pb-8">
      <h1 className="text-xl font-bold text-ink-900">事项</h1>

      {/* 子 tab（样式同统计页） */}
      <div className="mt-4 flex gap-2">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => switchTab(tab.key)}
            className={`relative flex-1 rounded-lg py-2 text-sm transition-colors ${
              activeTab === tab.key
                ? 'bg-white font-medium text-primary-600'
                : 'border border-primary-200 bg-white text-ink-600'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-gold-500" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === 'todo' ? <TodoSection /> : <CountdownSection />}
      </div>
    </div>
  )
}

export default TasksPage
