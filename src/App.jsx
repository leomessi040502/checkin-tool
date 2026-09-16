import { Routes, Route, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import CheckinPage from './pages/CheckinPage'
import CountdownPage from './pages/CountdownPage'
import GoalsPage from './pages/GoalsPage'
import StatsPage from './pages/StatsPage'
import ProfilePage from './pages/ProfilePage'
import BottomNav from './components/BottomNav'
import NetworkStatus from './components/NetworkStatus'
import Toast from './components/Toast'

function App() {
  const location = useLocation()
  const showBottomNav = location.pathname !== '/login'

  return (
    <AuthProvider>
      <NetworkStatus />
      <Toast />
      <div className="flex min-h-screen flex-col bg-gray-50">
        <div className="flex-1">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedRoute><CheckinPage /></ProtectedRoute>} />
            <Route path="/countdown" element={<ProtectedRoute><CountdownPage /></ProtectedRoute>} />
            <Route path="/goals" element={<ProtectedRoute><GoalsPage /></ProtectedRoute>} />
            <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          </Routes>
        </div>
        {showBottomNav && <BottomNav />}
      </div>
    </AuthProvider>
  )
}

export default App
