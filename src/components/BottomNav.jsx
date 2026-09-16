import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: '打卡', icon: '✅' },
  { to: '/countdown', label: '倒计时', icon: '⏰' },
  { to: '/goals', label: '目标', icon: '🎯' },
  { to: '/stats', label: '统计', icon: '📊' },
  { to: '/profile', label: '我的', icon: '👤' },
]

function BottomNav() {
  return (
    <nav className="sticky bottom-0 left-0 right-0 z-50 flex border-t border-gray-200 bg-white">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              isActive ? 'text-primary-600' : 'text-gray-400'
            }`
          }
        >
          <span className="text-xl leading-none">{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

export default BottomNav
