import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { AlertCircle, Plus, Search, Eye, CheckCircle, Clock, XCircle, MessageSquare, Wrench, Users } from 'lucide-react'

const CATEGORIES = {
  infrastructure: {
    label: 'Infrastructure',
    icon: Wrench,
    color: 'orange',
    subcategories: [
      'Fan not working',
      'AC not working',
      'Light/Electrical issue',
      'Toilet/Washroom issue',
      'Internet/WiFi issue',
      'Water supply issue',
      'Lift issue',
      'Cleanliness issue',
      'Library issue',
      'Parking issue',
      'Other infrastructure',
    ]
  },
  member: {
    label: 'Member Complaint',
    icon: Users,
    color: 'red',
    subcategories: [
      'Misconduct',
      'Misbehaviour',
      'Chamber dispute',
      'Professional misconduct',
      'Harassment',
      'Other member complaint',
    ]
  },
  admin: {
    label: 'Administrative',
    icon: MessageSquare,
    color: 'blue',
    subcategories: [
      'Fee related',
      'Receipt issue',
      'Membership issue',
      'Election related',
      'General suggestion',
      'Other administrative',
    ]
  }
}

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-600', icon: XCircle },
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Grievances() {
  const { currentOrg, userRole } = useAuth()
  const [grievances, setGrievances] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCategory, setFilterCategory] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [stats, setStats] = useState({ total: 0, open: 0, in_progress: 0, resolved: 0 })

  const isAdmin = ['admin', 'cashier'].includes(userRole?.role)

  useEffect(() => { if (currentOrg) fetchGrievances() }, [currentOrg, filterStatus, filterCategory])

  async function fetchGrievances() {
    setLoading(true)
    let query = supabase.from('grievances')
      .select('*')
      .eq('org_id', currentOrg.id)
      .order('created_at', { ascending: false })

    if (filterStatus !== 'all') query = query.eq('status', filterStatus)
    if (filterCategory !== 'all') query = query.eq('category', filterCategory)

    const { data } = await query
    setGrievances(data || [])

    // Stats
    const [
      { count: total },
      { count: open },
      { count: inprog },
      { count: resolved },
    ] = await Promise.all([
      supabase.from('grievances').select('*', { count: 'exact', head: true }).eq('org_id', currentOrg.id),
      supabase.from('grievances').select('*', { count: 'exact', head: true }).eq('org_id', currentOrg.id).eq('status', 'open'),
      supabase.from('grievances').select('*', { count: 'exact', head: true }).eq('org_id', currentOrg.id).eq('status', 'in_progress'),
      supabase.from('grievances').select('*', { count: 'exact', head: true }).eq('org_id', currentOrg.id).eq('status', 'resolved'),
    ])
    setStats({ total: total||0, open: open||0, in_progress: inprog||0, resolved: resolved||0 })
    setLoading(false)
  }

  const filtered = grievances.filter(g =>
    !search ||
    g.ticket_no?.toLowerCase().includes(search.toLowerCase()) ||
    g.complainant_name?.toLowerCase().includes(search.toLowerCase()) ||
    g.subject?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-red-600" /> Grievances
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Grievance
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'blue' },
          { label: 'Open', value: stats.open, color: 'red' },
          { label: 'In Progress', value: stats.in_progress, color: 'yellow' },
          { label: 'Resolved', value: stats.resolved, color: 'green' },
        ].map(s => {
          const colors = {
            blue: 'bg-blue-50 border-blue-200 text-blue-700',
            red: 'bg-red-50 border-red-200 text-red-700',
            yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            green: 'bg-green-50 border-green-200 text-green-700',
          }
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
            <input className="input pl-9" placeholder="Search ticket no, name, subject..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${filterStatus === s ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200'}`}>
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'infrastructure', 'member', 'admin'].map(c => (
              <button key={c} onClick={() => setFilterCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${filterCategory === c ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                {c === 'all' ? 'All Types' : CATEGORIES[c]?.label}
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
                {['Ticket No.', 'Date', 'Complainant', 'Category', 'Subject', 'Against', 'Status', 'Actions'].map(h => (
                  <th key={h} className="table-header text-left text-xs whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="table-cell text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="table-cell text-center py-8 text-gray-400">No grievances found</td></tr>
              ) : filtered.map((g, i) => {
                const status = STATUS_CONFIG[g.status] || STATUS_CONFIG.open
                const StatusIcon = status.icon
                const catColor = { infrastructure: 'bg-orange-100 text-orange-700', member: 'bg-red-100 text-red-700', admin: 'bg-blue-100 text-blue-700' }
                return (
                  <tr key={g.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="table-cell font-mono font-bold text-blue-700 text-xs">{g.ticket_no}</td>
                    <td className="table-cell text-xs">{formatDate(g.created_at)}</td>
                    <td className="table-cell">
                      <div className="font-medium text-sm">{g.complainant_name}</div>
                      <div className="text-xs text-gray-400">{g.complainant_member_no}</div>
                    </td>
                    <td className="table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${catColor[g.category] || 'bg-gray-100 text-gray-600'}`}>
                        {CATEGORIES[g.category]?.label || g.category}
                      </span>
                    </td>
                    <td className="table-cell text-sm max-w-xs">
                      <div className="truncate">{g.subject}</div>
                      <div className="text-xs text-gray-400">{g.subcategory}</div>
                    </td>
                    <td className="table-cell text-xs">{g.against_member_no || '—'}</td>
                    <td className="table-cell">
                      <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="table-cell">
                      <button onClick={() => setShowDetail(g)}
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

      {showAdd && (
        <AddGrievanceModal
          org={currentOrg}
          userRole={userRole}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); fetchGrievances() }}
        />
      )}

      {showDetail && (
        <GrievanceDetailModal
          grievance={showDetail}
          org={currentOrg}
          userRole={userRole}
          isAdmin={isAdmin}
          onClose={() => setShowDetail(null)}
          onSuccess={() => { setShowDetail(null); fetchGrievances() }}
        />
      )}
    </div>
  )
}

// ---- ADD GRIEVANCE MODAL ----
function AddGrievanceModal({ org, userRole, onClose, onSuccess }) {
  const [form, setForm] = useState({
    category: 'infrastructure',
    subcategory: '',
    subject: '',
    description: '',
    complainant_name: userRole?.name || '',
    complainant_member_no: '',
    against_member_no: '',
    against_member_name: '',
    priority: 'normal',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.subject) return toast.error('Subject required')
    if (!form.complainant_name) return toast.error('Your name required')
    if (!form.category) return toast.error('Category required')

    setSaving(true)
    try {
      // Generate ticket no
      const { count } = await supabase.from('grievances')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org.id)
      
      const fy = new Date().getMonth() >= 3
        ? `${new Date().getFullYear()}-${String(new Date().getFullYear()+1).slice(2)}`
        : `${new Date().getFullYear()-1}-${String(new Date().getFullYear()).slice(2)}`
      
      const ticketNo = `DCBA/GRV/${fy}/${String((count||0)+1).padStart(4,'0')}`

      const { error } = await supabase.from('grievances').insert({
        org_id: org.id,
        ticket_no: ticketNo,
        category: form.category,
        subcategory: form.subcategory,
        subject: form.subject,
        description: form.description,
        complainant_name: form.complainant_name,
        complainant_member_no: form.complainant_member_no,
        against_member_no: form.against_member_no || null,
        against_member_name: form.against_member_name || null,
        priority: form.priority,
        status: 'open',
        filed_by: userRole?.user_id,
      })
      if (error) throw error
      toast.success(`Grievance filed! Ticket: ${ticketNo}`)
      onSuccess()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  const subcats = CATEGORIES[form.category]?.subcategories || []

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-red-50">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" /> File Grievance
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Complainant */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Your Name *</label>
              <input className="input" value={form.complainant_name}
                onChange={e => setForm({ ...form, complainant_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Your Member No.</label>
              <input className="input" value={form.complainant_member_no}
                onChange={e => setForm({ ...form, complainant_member_no: e.target.value })}
                placeholder="A-001" />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="label">Grievance Type *</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(CATEGORIES).map(([key, cat]) => {
                const Icon = cat.icon
                const colors = { infrastructure: 'border-orange-400 bg-orange-50 text-orange-700', member: 'border-red-400 bg-red-50 text-red-700', admin: 'border-blue-400 bg-blue-50 text-blue-700' }
                return (
                  <button key={key} type="button" onClick={() => setForm({ ...form, category: key, subcategory: '' })}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${form.category === key ? colors[key] : 'border-gray-200 bg-white text-gray-500'}`}>
                    <Icon className="w-5 h-5 mx-auto mb-1" />
                    <p className="text-xs font-medium">{cat.label}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Subcategory */}
          <div>
            <label className="label">Sub-category</label>
            <select className="input" value={form.subcategory}
              onChange={e => setForm({ ...form, subcategory: e.target.value })}>
              <option value="">Select sub-category</option>
              {subcats.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Against member (only for member complaint) */}
          {form.category === 'member' && (
            <div className="grid grid-cols-2 gap-3 bg-red-50 border border-red-200 rounded-xl p-3">
              <div>
                <label className="label text-xs">Against Member No.</label>
                <input className="input" value={form.against_member_no}
                  onChange={e => setForm({ ...form, against_member_no: e.target.value })}
                  placeholder="A-001" />
              </div>
              <div>
                <label className="label text-xs">Against Member Name</label>
                <input className="input" value={form.against_member_name}
                  onChange={e => setForm({ ...form, against_member_name: e.target.value })} />
              </div>
            </div>
          )}

          {/* Priority */}
          <div>
            <label className="label">Priority</label>
            <div className="flex gap-2">
              {[['normal', 'Normal', 'bg-gray-100 text-gray-700'], ['urgent', 'Urgent', 'bg-orange-100 text-orange-700'], ['critical', 'Critical', 'bg-red-100 text-red-700']].map(([val, label, color]) => (
                <button key={val} type="button" onClick={() => setForm({ ...form, priority: val })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${form.priority === val ? color + ' border-current' : 'bg-white text-gray-500 border-gray-200'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="label">Subject *</label>
            <input className="input" value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              placeholder="Brief subject of your grievance" />
          </div>

          {/* Description */}
          <div>
            <label className="label">Description</label>
            <textarea className="input h-24 resize-none" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Detailed description of the grievance..." />
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {saving ? 'Filing...' : 'File Grievance'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- DETAIL MODAL ----
function GrievanceDetailModal({ grievance: g, org, userRole, isAdmin, onClose, onSuccess }) {
  const [status, setStatus] = useState(g.status)
  const [remark, setRemark] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleUpdate() {
    if (!status) return
    setSaving(true)
    try {
      const { error } = await supabase.from('grievances').update({
        status,
        admin_remarks: remark || g.admin_remarks,
        resolved_at: status === 'resolved' ? new Date().toISOString() : g.resolved_at,
        updated_by: userRole?.user_id,
      }).eq('id', g.id)
      if (error) throw error
      toast.success('Grievance updated!')
      onSuccess()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  const statusInfo = STATUS_CONFIG[g.status] || STATUS_CONFIG.open
  const catColor = { infrastructure: 'bg-orange-100 text-orange-700', member: 'bg-red-100 text-red-700', admin: 'bg-blue-100 text-blue-700' }
  const priorityColor = { normal: 'bg-gray-100 text-gray-700', urgent: 'bg-orange-100 text-orange-700', critical: 'bg-red-100 text-red-700' }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
          <div>
            <h3 className="text-lg font-semibold">{g.ticket_no}</h3>
            <p className="text-xs text-gray-500">{formatDate(g.created_at)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Badges */}
          <div className="flex gap-2 flex-wrap">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${catColor[g.category]}`}>
              {CATEGORIES[g.category]?.label}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${priorityColor[g.priority]}`}>
              {g.priority?.charAt(0).toUpperCase() + g.priority?.slice(1)} Priority
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>

          {/* Subject & Description */}
          <div>
            <p className="font-bold text-gray-800">{g.subject}</p>
            {g.subcategory && <p className="text-xs text-gray-500 mt-0.5">{g.subcategory}</p>}
          </div>

          {g.description && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700">
              {g.description}
            </div>
          )}

          {/* Complainant */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-blue-500 font-medium mb-1">Filed By</p>
              <p className="font-semibold text-blue-800">{g.complainant_name}</p>
              <p className="text-xs text-blue-600">{g.complainant_member_no || '—'}</p>
            </div>
            {g.against_member_name && (
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs text-red-500 font-medium mb-1">Against</p>
                <p className="font-semibold text-red-800">{g.against_member_name}</p>
                <p className="text-xs text-red-600">{g.against_member_no || '—'}</p>
              </div>
            )}
          </div>

          {/* Admin remarks */}
          {g.admin_remarks && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs font-medium text-green-700 mb-1">Admin Remarks:</p>
              <p className="text-sm text-green-800">{g.admin_remarks}</p>
            </div>
          )}

          {/* Resolution info */}
          {g.resolved_at && (
            <p className="text-xs text-gray-400">Resolved on: {formatDate(g.resolved_at)}</p>
          )}

          {/* Admin update section */}
          {isAdmin && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Update Status:</p>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(STATUS_CONFIG).map(([val, cfg]) => (
                  <button key={val} type="button" onClick={() => setStatus(val)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${status === val ? cfg.color + ' border-current' : 'bg-white text-gray-500 border-gray-200'}`}>
                    {cfg.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="label text-xs">Admin Remarks</label>
                <textarea className="input h-20 resize-none text-sm"
                  value={remark || g.admin_remarks || ''}
                  onChange={e => setRemark(e.target.value)}
                  placeholder="Add remarks for the complainant..." />
              </div>
              <button onClick={handleUpdate} disabled={saving}
                className="btn-primary w-full">
                {saving ? 'Updating...' : 'Update Grievance'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

      </div>
    </div>
  )
}
