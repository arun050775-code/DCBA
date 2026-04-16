import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './components/Login'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import Members from './components/Members'
import ChartOfAccounts from './components/ChartOfAccounts'
import UserManagement from './components/UserManagement'
import RentTracker from './components/RentTracker'
import CashBank from './components/CashBank'
import IncomeRegister from './components/IncomeRegister'
import ExpenditureRegister from './components/ExpenditureRegister'
import Reports from './components/Reports'
import Payroll from './components/Payroll'
import ExperienceLetter from './components/ExperienceLetter'
import ComingSoon from './components/ComingSoon'

function PrivateLayout() {
  const { user, loading, userRole } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (!userRole) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card text-center max-w-sm">
        <p className="text-red-600 font-semibold mb-2">Access Not Configured</p>
        <p className="text-gray-500 text-sm">Your account has not been assigned to any organisation. Please contact the administrator.</p>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/members" element={<Members />} />
          <Route path="/rent" element={<RentTracker />} />
          <Route path="/cash-bank" element={<CashBank />} />
          <Route path="/income" element={<IncomeRegister />} />
          <Route path="/expenditure" element={<ExpenditureRegister />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/experience-letter" element={<ExperienceLetter />} />
          <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/settings" element={<ComingSoon title="Settings" />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-700 border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/*" element={<PrivateLayout />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
