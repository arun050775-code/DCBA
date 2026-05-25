import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import { Building2, Users, TrendingUp, AlertCircle } from 'lucide-react'

const DCBA_LOGO = 'https://www.dwarkacourtbarassociation.com/images/logo.png'

const COMMITTEE = [
  { name: 'AVNISH RANA', designation: 'PRESIDENT' },
  { name: 'VIVEK DAGAR', designation: 'VICE PRESIDENT' },
  { name: 'KARAN VEER TYAGI', designation: 'HONY. SECRETARY' },
  { name: 'HEMANT VERMA', designation: 'ADDL. SECRETARY' },
  { name: 'AJAY SAINI', designation: 'JOINT SECRETARY' },
  { name: 'MAMTA YADAV', designation: 'TREASURER' },
  { name: 'AMIT KR. SINGH', designation: 'LIBRARY INCHARGE' },
  { name: 'ASHOK KR. JHA', designation: 'EXE. MEMBER' },
  { name: 'NISHA SETHI SUDAN', designation: 'WOMEN EXE. MEMBER' },
  { name: 'RITU GUPTA', designation: 'LADY EXE. MEMBER' },
  { name: 'LATA NAUTIYAL', designation: 'EXE. MEMBER' },
  { name: 'RAHUL TYAGI', designation: 'EXE. MEMBER' },
  { name: 'YAMANDEEP SOLANKI', designation: 'EXE. MEMBER' },
]

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2)
}

export default function Dashboard() {
  const { currentOrg, userRole } = useAuth()
  const [stats, setStats] = useState({ vendors: 0, totalRent: 0, members: 0, feeOutstanding: 0 })
  const [recentCollections, setRecentCollections] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (currentOrg) fetchStats() }, [currentOrg])

  async function fetchStats() {
    setLoading(true)
    try {
      const [{ data: vendors }, { count: memberCount }, { data: feeData }, { data: recent }] = await Promise.all([
        supabase.from('vendors').select('monthly_rent').eq('org_id', currentOrg.id).eq('status', 'active'),
        supabase.from('dcba_members').select('*', { count: 'exact', head: true }).eq('org_id', currentOrg.id).eq('status', 'active'),
        supabase.from('dcba_members').select('outstanding_fees').eq('org_id', currentOrg.id).eq('status', 'active'),
        supabase.from('rent_collections').select('*, vendors(name)').eq('org_id', currentOrg.id).order('created_at', { ascending: false }).limit(5),
      ])
      setStats({
        vendors: vendors?.length || 0,
        totalRent: vendors?.reduce((s, v) => s + (v.monthly_rent || 0), 0) || 0,
        members: memberCount || 0,
        feeOutstanding: feeData?.reduce((s, m) => s + Number(m.outstanding_fees || 0), 0) || 0,
      })
      setRecentCollections(recent || [])
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Professional Header */}
      <div className="card mb-6 p-0 overflow-hidden">
        <div className="bg-gradient-to-r from-[#1A3A5C] to-[#2E5F8A] p-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
              <img src={DCBA_LOGO} alt="DCBA Logo" className="w-16 h-16 object-contain"
                onError={e => { e.target.parentElement.innerHTML = '<span style="font-size:1.5rem;font-weight:800;color:#1a3a5c">DC</span>' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">DWARKA COURT BAR ASSOCIATION</h1>
              <p className="text-blue-200 text-sm mt-1">Dwarka Court Complex, Sector-10, New Delhi - 110075</p>
              <p className="text-blue-300 text-xs mt-0.5">Phone: 011-28041409 · dwarkacourtbarassociation@gmail.com</p>
            </div>
          </div>
        </div>
        <div className="bg-[#C8960C] px-6 py-2">
          <p className="text-white text-sm font-medium">
            Welcome, {userRole?.name} — {userRole?.role?.charAt(0).toUpperCase() + userRole?.role?.slice(1)}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Vendors', value: loading ? '...' : stats.vendors, icon: Building2, color: 'blue' },
          { label: 'Monthly Rent Roll', value: loading ? '...' : fmt(stats.totalRent), icon: TrendingUp, color: 'green' },
          { label: 'Active Members', value: loading ? '...' : stats.members, icon: Users, color: 'purple' },
          { label: 'Fee Outstanding', value: loading ? '...' : fmt(stats.feeOutstanding), icon: AlertCircle, color: 'red' },
        ].map(s => {
          const Icon = s.icon
          const colors = { blue: 'bg-blue-50 border-blue-200 text-blue-700', green: 'bg-green-50 border-green-200 text-green-700', purple: 'bg-purple-50 border-purple-200 text-purple-700', red: 'bg-red-50 border-red-200 text-red-700' }
          return (
            <div key={s.label} className={`rounded-xl border p-4 ${colors[s.color]}`}>
              <Icon className="w-5 h-5 opacity-70 mb-2" />
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs font-semibold opacity-80">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Committee */}
      <div className="card mb-6">
        <h2 className="text-lg font-bold text-[#1A3A5C] mb-4 pb-2 border-b-2 border-[#C8960C]">
          🏛️ Management Committee
        </h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 gap-4">
          {COMMITTEE.map(m => (
            <div key={m.name} className="text-center">
              <div className="w-14 h-14 mx-auto mb-2 rounded-full border-2 border-[#C8960C] flex items-center justify-center shadow-md"
                style={{ background: 'linear-gradient(135deg, #1a3a5c, #2e5f8a)' }}>
                <span className="text-yellow-400 font-bold text-sm">{getInitials(m.name)}</span>
              </div>
              <p className="text-xs font-bold text-[#1A3A5C] leading-tight">{m.name}</p>
              <p className="text-xs text-[#C8960C] font-medium leading-tight mt-0.5">{m.designation}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-3 italic">* Photographs will be updated on receipt from management</p>
      </div>

      {/* Recent Collections */}
      <div className="card">
        <h2 className="text-base font-bold text-gray-700 mb-4">Recent Rent Collections</h2>
        {recentCollections.length === 0 ? (
          <p className="text-gray-400 text-center py-6">No collections recorded yet.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr>{['Receipt No.', 'Vendor', 'Amount', 'Date', 'Mode'].map(h => <th key={h} className="table-header text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {recentCollections.map((c, i) => (
                <tr key={c.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="table-cell font-mono text-xs">{c.receipt_no}</td>
                  <td className="table-cell font-medium">{c.vendors?.name}</td>
                  <td className="table-cell font-bold text-green-700">{fmt(c.amount)}</td>
                  <td className="table-cell text-xs">{new Date(c.collection_date).toLocaleDateString('en-IN')}</td>
                  <td className="table-cell"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs uppercase">{c.payment_mode}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
