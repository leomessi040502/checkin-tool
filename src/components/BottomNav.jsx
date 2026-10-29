import { NavLink } from 'react-router-dom'
import { CheckCircle2, Clock3, Target, BarChart3, User } from 'lucide-react'

const tabs = [
  { to: '/', label: '打卡', icon: CheckCircle2 },
  { to: '/countdown', label: '倒计时', icon: Clock3 },
  { to: '/goals', label: '目标', icon: Target },
  { to: '/stats', label: '统计', icon: BarChart3 },
  { to: '/profile', label: '我的', icon: User },
]

function BottomNav() {
  return (
    <nav
      className="sticky bottom-0 left-0 right-0 z-50 flex border-t border-primary-50 bg-white"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `relative flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-xs transition-colors ${
                isActive ? 'text-primary-600' : 'text-ink-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-1/2 top-0 h-[3px] w-5 -translate-x-1/2 rounded-full bg-gold-500" />
                )}
                <Icon size={22} strokeWidth={1.8} />
                <span className={isActive ? 'font-medium' : ''}>{tab.label}</span>
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

export default BottomNav
