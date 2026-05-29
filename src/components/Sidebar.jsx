import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Scale, LayoutDashboard, Building2, Users, BookOpen,
  IndianRupee, FileText, Settings, LogOut, UserCheck,
  BarChart3, Mail, AlertCircle, UserPlus, CreditCard, Bell, Landmark, ClipboardList, Lock
} from 'lucide-react'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin','cashier','supervisor','accountant','management'] },
  { path: '/members', label: 'Members', icon: Users, roles: ['admin','cashier','supervisor','accountant'] },
  { path: '/applications', label: 'Applications', icon: UserPlus, roles: ['admin','cashier','supervisor'] },
  { path: '/grievances', label: 'Grievances', icon: AlertCircle, roles: ['admin','cashier','supervisor','management'] },
  { path: '/notices', label: 'Notice Board', icon: Bell, roles: ['admin','cashier','supervisor','accountant','management'] },
  { path: '/rent', label: 'Rent Tracker', icon: Building2, roles: ['admin','cashier','supervisor','accountant'] },
  { path: '/cash-bank', label: 'Cash & Bank', icon: IndianRupee, roles: ['admin','supervisor','accountant'] },
  { path: '/income', label: 'Income Register', icon: CreditCard, roles: ['admin','supervisor','accountant'] },
  { path: '/day-end-report', label: 'Day End Report', icon: FileText, roles: ['admin','cashier','supervisor'] },
  { path: '/cheques-in-hand', label: 'Cheques in Hand', icon: Landmark, roles: ['admin','cashier','supervisor','accountant'] },
  { path: '/locker-seats', label: 'Locker & Seats', icon: Lock, roles: ['admin','cashier','supervisor','accountant'] },
  { path: '/expenditure', label: 'Expenditure', icon: FileText, roles: ['admin','supervisor','accountant'] },
  { path: '/payroll', label: 'Payroll', icon: UserCheck, roles: ['admin','accountant'] },
  { path: '/reports', label: 'Reports', icon: BarChart3, roles: ['admin','supervisor','accountant','management'] },
  { path: '/experience-letter', label: 'Experience Letter', icon: Mail, roles: ['admin','cashier','supervisor'] },
  { path: '/audit-log', label: 'Audit Trail', icon: ClipboardList, roles: ['admin','accountant'] },
  { path: '/chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen, roles: ['admin','accountant'] },
  { path: '/users', label: 'User Management', icon: Users, roles: ['admin'] },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
]

export default function Sidebar() {
  const { userRole, signOut } = useAuth()
  const navigate = useNavigate()

  const role = userRole?.role || 'cashier'
  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(role))

  return (
    <div className="w-64 min-h-screen bg-[#1A3A5C] flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <Scale className="w-5 h-5 text-blue-800" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Bar Association</p>
            <p className="text-blue-300 text-xs">Accounting Suite</p>
          </div>
        </div>
      </div>

      {/* Org name */}
      {userRole?.org_name && (
        <div className="px-4 py-2 bg-[#C8960C]/20 border-b border-white/10">
          <p className="text-[#C8960C] text-xs font-semibold truncate">{userRole.org_name}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {visibleItems.map(item => {
          const Icon = item.icon
          return (
            <NavLink key={item.path} to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white font-medium border-r-2 border-[#C8960C]'
                    : 'text-blue-200 hover:bg-white/10 hover:text-white'
                }`
              }>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-medium">{userRole?.name}</p>
            <p className="text-blue-300 text-xs capitalize">{userRole?.role}</p>
          </div>
          <button onClick={() => { signOut(); navigate('/login') }}
            className="p-2 text-blue-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
