import { useAuth } from '../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Scale, LayoutDashboard, Building2, Users, BookOpen,
  Landmark, ShoppingBag, FileText, Settings, LogOut,
  ChevronDown, Wallet, Receipt, UserCheck, Mail
} from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin','cashier','management'] },
  { path: '/members', label: 'Members', icon: Users, roles: ['admin','cashier','management'] },
  { path: '/rent', label: 'Rent Tracker', icon: Building2, roles: ['admin','cashier','management'] },
  { path: '/cash-bank', label: 'Cash & Bank', icon: Landmark, roles: ['admin','cashier','management'] },
  { path: '/income', label: 'Income Register', icon: Receipt, roles: ['admin','cashier','management'] },
  { path: '/expenditure', label: 'Expenditure', icon: Wallet, roles: ['admin','cashier','management'] },
  { path: '/payroll', label: 'Payroll', icon: UserCheck, roles: ['admin','cashier','management'] },
  { path: '/reports', label: 'Reports', icon: FileText, roles: ['admin','cashier','management'] },
  { path: '/experience-letter', label: 'Experience Letter', icon: Mail, roles: ['admin','cashier'] },
  { path: '/chart-of-accounts', label: 'Chart of Accounts', icon: BookOpen, roles: ['admin'] },
  { path: '/users', label: 'User Management', icon: Users, roles: ['admin'] },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
]

export default function Sidebar() {
  const { userRole, currentOrg, userOrgs, switchOrg, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [orgDropdown, setOrgDropdown] = useState(false)

  const role = userRole?.role

  const visibleItems = navItems.filter(item => item.roles.includes(role))

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out successfully')
  }

  return (
    <div className="w-64 min-h-screen bg-blue-900 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-blue-700">
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

      {/* Org Switcher (Admin only) */}
      {role === 'admin' && userOrgs.length > 1 && (
        <div className="px-3 pt-3">
          <div className="relative">
            <button
              onClick={() => setOrgDropdown(!orgDropdown)}
              className="w-full flex items-center justify-between bg-blue-800 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded-lg transition-colors"
            >
              <span className="font-medium">{currentOrg?.short_name}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            {orgDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl z-50 overflow-hidden">
                {userOrgs.map(r => (
                  <button
                    key={r.org_id}
                    onClick={() => { switchOrg(r.org_id); setOrgDropdown(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors ${
                      r.org_id === currentOrg?.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                    }`}
                  >
                    {r.organisations.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Single org display */}
      {(role !== 'admin' || userOrgs.length === 1) && (
        <div className="px-3 pt-3">
          <div className="bg-blue-800 text-blue-100 text-xs px-3 py-2 rounded-lg font-medium">
            {currentOrg?.name}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map(item => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`sidebar-link w-full text-left ${isActive ? 'active' : ''}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* User info & Sign out */}
      <div className="p-3 border-t border-blue-700">
        <div className="px-3 py-2 mb-2">
          <p className="text-white text-sm font-medium truncate">{userRole?.name}</p>
          <p className="text-blue-300 text-xs capitalize">{role}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="sidebar-link w-full text-left text-red-300 hover:text-red-200 hover:bg-red-900/30"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
