import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import BottomNav from './components/BottomNav'
import NetworkStatus from './components/NetworkStatus'
import Toast from './components/Toast'

// 路由级代码分割：各页面按需加载，只命中首屏用到的 chunk
const LoginPage = lazy(() => import('./pages/LoginPage'))
const CheckinPage = lazy(() => import('./pages/CheckinPage'))
const TasksPage = lazy(() => import('./pages/TasksPage'))
const GoalsPage = lazy(() => import('./pages/GoalsPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))

function PageLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-sm text-ink-400">
      加载中…
    </div>
  )
}

function App() {
  const location = useLocation()
  const showBottomNav = location.pathname !== '/login'

  return (
    <AuthProvider>
      <NetworkStatus />
      <Toast />
      <div className="flex min-h-screen flex-col bg-surface">
        <div className="flex-1">
          <Suspense fallback={<PageLoading />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<ProtectedRoute><CheckinPage /></ProtectedRoute>} />
              <Route path="/tasks" element={<ProtectedRoute><TasksPage /></ProtectedRoute>} />
              {/* 旧倒计时路由重定向（兼容历史收藏/缓存页面） */}
              <Route path="/countdown" element={<Navigate to="/tasks?tab=countdown" replace />} />
              <Route path="/goals" element={<ProtectedRoute><GoalsPage /></ProtectedRoute>} />
              <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            </Routes>
          </Suspense>
        </div>
        {showBottomNav && <BottomNav />}
      </div>
    </AuthProvider>
  )
}

export default App
