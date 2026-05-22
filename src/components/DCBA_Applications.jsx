import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { UserPlus, Eye, CheckCircle, XCircle, Clock, Search } from 'lucide-react'

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  under_review: { label: 'Under Review', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Applications() {
  const { currentOrg, userRole } = useAuth()
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showDetail, setShowDetail] = useState(null)
  const [stats, setStats] = useState({ total: 0, submitted: 0, under_review: 0, approved: 0 })

  useEffect(() => { if (currentOrg) fetchApplications() }, [currentOrg, filterStatus])

  async function fetchApplications() {
    setLoading(true)
    let query = supabase.from('member_applications')
      .select('*')
      .order('created_at', { ascending: false })

    if (filterStatus !== 'all') query = query.eq('status', filterStatus)

    const { data } = await query
    setApplications(data || [])

    const all = data || []
    setStats({
      total: all.length,
      submitted: all.filter(a => a.status === 'submitted').length,
      under_review: all.filter(a => a.status === 'under_review').length,
      approved: all.filter(a => a.status === 'approved').length,
    })
    setLoading(false)
  }

  const filtered = applications.filter(a =>
    !search ||
    a.application_no?.toLowerCase().includes(search.toLowerCase()) ||
    a.member_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.enrollment_no?.toLowerCase().includes(search.toLowerCase()) ||
    a.mobile?.includes(search)
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-blue-700" /> Membership Applications
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'blue' },
          { label: 'New/Submitted', value: stats.submitted, color: 'blue' },
          { label: 'Under Review', value: stats.under_review, color: 'yellow' },
          { label: 'Approved', value: stats.approved, color: 'green' },
        ].map(s => {
          const colors = { blue: 'bg-blue-50 border-blue-200 text-blue-700', yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700', green: 'bg-green-50 border-green-200 text-green-700' }
          return (
            <div key={s.label} className={`rounded-xl border p-4 ${colors[s.color]}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs font-semibold opacity-80">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search application no, name, enrollment..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'submitted', 'under_review', 'approved', 'rejected'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${filterStatus === s ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200'}`}>
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['App. No.', 'Date', 'Name', 'Enrollment No.', 'Mobile', 'Proposers', 'Status', 'Actions'].map(h => (
                  <th key={h} className="table-header text-left text-xs whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="table-cell text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="table-cell text-center py-8 text-gray-400">No applications found</td></tr>
              ) : filtered.map((a, i) => {
                const status = STATUS_CONFIG[a.status] || STATUS_CONFIG.submitted
                return (
                  <tr key={a.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="table-cell font-mono font-bold text-blue-700 text-xs">{a.application_no}</td>
                    <td className="table-cell text-xs">{formatDate(a.applied_at)}</td>
                    <td className="table-cell">
                      <div className="font-medium text-sm">{a.member_name}</div>
                      <div className="text-xs text-gray-400">{a.father_name}</div>
                    </td>
                    <td className="table-cell font-mono text-xs">{a.enrollment_no}</td>
                    <td className="table-cell text-xs">{a.mobile}</td>
                    <td className="table-cell text-xs">
                      <div>{a.proposer1_name} ({a.proposer1_member_no})</div>
                      <div>{a.proposer2_name} ({a.proposer2_member_no})</div>
                    </td>
                    <td className="table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="table-cell">
                      <button onClick={() => setShowDetail(a)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showDetail && (
        <ApplicationDetailModal
          application={showDetail}
          org={currentOrg}
          userRole={userRole}
          onClose={() => setShowDetail(null)}
          onSuccess={() => { setShowDetail(null); fetchApplications() }}
        />
      )}
    </div>
  )
}

function ApplicationDetailModal({ application: a, org, userRole, onClose, onSuccess }) {
  const [status, setStatus] = useState(a.status)
  const [remarks, setRemarks] = useState(a.remarks || '')
  const [saving, setSaving] = useState(false)

  async function handleUpdate() {
    setSaving(true)
    try {
      const { error } = await supabase.from('member_applications').update({
        status,
        remarks,
        reviewed_by: userRole?.user_id,
        reviewed_at: new Date().toISOString(),
      }).eq('id', a.id)
      if (error) throw error

      // If approved — create member record
      if (status === 'approved' && a.status !== 'approved') {
        const letter = a.member_name.trim().charAt(0).toUpperCase()
        const { count } = await supabase.from('dcba_members')
          .select('*', { count: 'exact', head: true })
          .like('member_no', `${letter}-%`)
        
        const memberNo = `${letter}-${String((count||0)+1).padStart(3,'0')}`
        
        const { error: memberErr } = await supabase.from('dcba_members').insert({
          org_id: org.id,
          member_no: memberNo,
          member_name: a.member_name,
          father_name: a.father_name,
          enrollment_no: a.enrollment_no,
          mobile: a.mobile,
          email: a.email,
          address: a.residential_address,
          membership_date: new Date().toISOString().split('T')[0],
          status: 'active',
          outstanding_fees: 1250,
          admission_fee_paid: false,
          annual_fee_paid: false,
          icard_issued: false,
        })
        if (memberErr) throw memberErr
        toast.success(`✅ Member ${memberNo} created!`)
      }

      toast.success('Application updated!')
      onSuccess()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
          <h3 className="text-lg font-semibold">{a.application_no}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Name', a.member_name],
              ['Father Name', a.father_name],
              ['Enrollment No.', a.enrollment_no],
              ['Mobile', a.mobile],
              ['Email', a.email || '—'],
              ['Applied On', new Date(a.applied_at).toLocaleDateString('en-IN')],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-400">{label}</p>
                <p className="font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs text-gray-400">Address</p>
            <p className="text-sm">{a.residential_address}</p>
          </div>

          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-xs font-bold text-blue-700 mb-2">Proposed By:</p>
            <p className="text-sm">1. {a.proposer1_name} ({a.proposer1_member_no})</p>
            <p className="text-sm">2. {a.proposer2_name} ({a.proposer2_member_no})</p>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-semibold mb-3">Update Status:</p>
            <div className="flex gap-2 flex-wrap mb-3">
              {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                <button key={val} onClick={() => setStatus(val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${status === val ? cfg.color + ' border-current' : 'bg-white text-gray-500 border-gray-200'}`}>
                  {cfg.label}
                </button>
              ))}
            </div>
            <textarea className="input h-20 resize-none text-sm mb-3"
              value={remarks} onChange={e => setRemarks(e.target.value)}
              placeholder="Remarks (optional)" />
            {status === 'approved' && a.status !== 'approved' && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3 text-xs text-green-700">
                ✅ Approving will automatically create member record with Member No. assigned!
              </div>
            )}
            <button onClick={handleUpdate} disabled={saving} className="btn-primary w-full">
              {saving ? 'Updating...' : 'Update Application'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
