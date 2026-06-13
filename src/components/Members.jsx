import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { Users, Plus, Search, Eye, IndianRupee, CreditCard, AlertCircle, CheckCircle, Printer, Edit } from 'lucide-react'
import MemberReceiptPrint from './members/MemberReceiptPrint'

const ADMISSION_FEE = 600
const ANNUAL_FEE = 600
const ICARD_FEE = 50

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function numberToWords(num) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
  if (num === 0) return 'Zero'
  if (num < 20) return ones[num]
  if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? ' ' + ones[num%10] : '')
  if (num < 1000) return ones[Math.floor(num/100)] + ' Hundred' + (num%100 ? ' ' + numberToWords(num%100) : '')
  if (num < 100000) return numberToWords(Math.floor(num/1000)) + ' Thousand' + (num%1000 ? ' ' + numberToWords(num%1000) : '')
  if (num < 10000000) return numberToWords(Math.floor(num/100000)) + ' Lakh' + (num%100000 ? ' ' + numberToWords(num%100000) : '')
  return numberToWords(Math.floor(num/10000000)) + ' Crore' + (num%10000000 ? ' ' + numberToWords(num%10000000) : '')
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`
}

function generateMemberNo(name, serial) {
  const firstLetter = name.trim().charAt(0).toUpperCase()
  return `${firstLetter}-${String(serial).padStart(3, '0')}`
}

function getAnniversaryStatus(membershipDate) {
  if (!membershipDate) return { status: 'unknown', daysLeft: null }
  const today = new Date()
  const joined = new Date(membershipDate)
  const thisYearAnniv = new Date(today.getFullYear(), joined.getMonth(), joined.getDate())
  if (thisYearAnniv < today) thisYearAnniv.setFullYear(today.getFullYear() + 1)
  const daysLeft = Math.ceil((thisYearAnniv - today) / (1000 * 60 * 60 * 24))
  if (daysLeft <= 30) return { status: 'due_soon', daysLeft }
  if (daysLeft <= 0) return { status: 'overdue', daysLeft }
  return { status: 'ok', daysLeft }
}

export default function Members() {
  const { currentOrg, userRole } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(null)
  const [stats, setStats] = useState({ total: 0, active: 0, feeDue: 0, newThisMonth: 0 })
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const isAdmin = userRole?.role === 'admin'
  const isCashier = ['admin', 'cashier'].includes(userRole?.role)

  useEffect(() => { if (currentOrg) { setPage(0); fetchMembers(0) } }, [currentOrg, filterStatus])
  useEffect(() => { if (currentOrg) fetchMembers(page) }, [page])
  useEffect(() => {
    function handleCollectFeeEvent(e) { setShowPayModal(e.detail) }
    document.addEventListener('collectFee', handleCollectFeeEvent)
    return () => document.removeEventListener('collectFee', handleCollectFeeEvent)
  }, [])

  async function fetchMembers(pageNum = 0) {
    setLoading(true)
    
    // Get accurate counts using count queries
    const [
      { count: totalCount },
      { count: activeCount },
      { count: feeDueCount },
    ] = await Promise.all([
      supabase.from('dcba_members').select('*', { count: 'exact', head: true }).eq('org_id', currentOrg.id),
      supabase.from('dcba_members').select('*', { count: 'exact', head: true }).eq('org_id', currentOrg.id).eq('status', 'active'),
      supabase.from('dcba_members').select('*', { count: 'exact', head: true }).eq('org_id', currentOrg.id).gt('outstanding_fees', 0),
    ])

    // Fetch paginated data
    let query = supabase.from('dcba_members')
      .select('*')
      .eq('org_id', currentOrg.id)
      .order('member_no')
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

    if (filterStatus === 'active') query = query.eq('status', 'active')
    if (filterStatus === 'inactive') query = query.eq('status', 'inactive')
    if (filterStatus === 'fee_due') query = query.eq('status', 'active').gt('outstanding_fees', 0)

    const { data } = await query
    setMembers(data || [])

    const thisMonth = new Date()
    setStats({
      total: totalCount || 0,
      active: activeCount || 0,
      feeDue: feeDueCount || 0,
      newThisMonth: 0,
    })
    setLoading(false)
  }

  const filtered = members.filter(m =>
    !search ||
    m.member_name?.toLowerCase().includes(search.toLowerCase()) ||
    m.member_no?.toLowerCase().includes(search.toLowerCase()) ||
    m.enrollment_no?.toLowerCase().includes(search.toLowerCase()) ||
    m.mobile?.includes(search)
  )

  async function handleSearch(q) {
    setSearch(q)
    if (q.length < 2) { fetchMembers(0); return }
    setLoading(true)
    const { data } = await supabase.from('dcba_members')
      .select('*')
      .eq('org_id', currentOrg.id)
      .or(`member_name.ilike.%${q}%,member_no.ilike.%${q}%,enrollment_no.ilike.%${q}%,mobile.ilike.%${q}%`)
      .order('member_no')
      .limit(100)
    setMembers(data || [])
    setLoading(false)
  }

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-700" /> Members
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
        </div>
        {isCashier && (
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Member
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Members', value: stats.total, color: 'blue', icon: Users },
          { label: 'Active Members', value: stats.active, color: 'green', icon: CheckCircle },
          { label: 'Fee Due', value: stats.feeDue, color: 'red', icon: AlertCircle },
          { label: 'New This Month', value: stats.newThisMonth, color: 'purple', icon: Plus },
        ].map(s => {
          const Icon = s.icon
          const colors = { blue: 'bg-blue-50 border-blue-200 text-blue-700', green: 'bg-green-50 border-green-200 text-green-700', red: 'bg-red-50 border-red-200 text-red-700', purple: 'bg-purple-50 border-purple-200 text-purple-700' }
          return (
            <div key={s.label} className={`rounded-xl border p-4 ${colors[s.color]}`}>
              <div className="flex items-center justify-between mb-1">
                <Icon className="w-5 h-5 opacity-60" />
              </div>
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
            <input className="input pl-9" placeholder="Search by name, member no, enrollment no, mobile..."
              value={search} onChange={e => handleSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'inactive', label: 'Inactive' },
              { id: 'fee_due', label: '⚠️ Fee Due' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilterStatus(f.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${filterStatus === f.id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-sm text-gray-500">{stats.total.toLocaleString('en-IN')} members</span>
        </div>
      </div>

      {/* Members Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Member No.', 'Name', 'Enrollment No.', 'Mobile', 'Membership Date', 'Annual Due Date', 'Outstanding', 'Status', 'Actions'].map(h => (
                  <th key={h} className="table-header text-left whitespace-nowrap text-xs">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="table-cell text-center py-8 text-gray-400">Loading...</td></tr>
              ) : members.length === 0 ? (
                <tr><td colSpan={9} className="table-cell text-center py-8 text-gray-400">No members found</td></tr>
              ) : members.map((m, i) => {
                const anniv = getAnniversaryStatus(m.membership_date)
                const hasOutstanding = Number(m.outstanding_fees) > 0
                const memberNoOld = m.member_no?.replace(/^([A-Z])-0*(\d+)$/, (_, l, n) => `${l}-${parseInt(n)}`)
                const photoUrl = `https://xalbjrmridjgdpguobdx.supabase.co/storage/v1/object/public/member-photos/${m.member_no}.png`
                return (
                  <tr key={m.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${hasOutstanding ? 'border-l-4 border-l-red-400' : ''}`}>
                    <td className="table-cell font-mono font-bold text-blue-700 text-sm">{m.member_no}</td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                          <img src={photoUrl} alt={m.member_name}
                            className="w-full h-full object-cover"
                            onError={e => {
                              const oldUrl = `https://xalbjrmridjgdpguobdx.supabase.co/storage/v1/object/public/member-photos/${memberNoOld}.png`
                              if (!e.target.src.includes(memberNoOld)) { e.target.src = oldUrl; return }
                              e.target.style.display = 'none'
                              e.target.parentElement.innerHTML = `<div style="width:100%;height:100%;background:#1a3a5c;display:flex;align-items:center;justify-content:center;color:#f5c842;font-weight:700;font-size:0.7rem">${m.member_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>`
                            }}
                          />
                        </div>
                        <div>
                          <div className="font-medium text-sm">{m.member_name}</div>
                          <div className="text-xs text-gray-400">{m.father_name ? `S/W/D of ${m.father_name}` : ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell font-mono text-xs">{m.enrollment_no || '—'}</td>
                    <td className="table-cell text-sm">{m.mobile || '—'}</td>
                    <td className="table-cell text-xs">{formatDate(m.membership_date)}</td>
                    <td className="table-cell text-xs">
                      <div className={`font-medium ${anniv.status === 'due_soon' ? 'text-orange-600' : anniv.status === 'overdue' ? 'text-red-600' : 'text-gray-600'}`}>
                        {m.membership_date ? (() => {
                          const d = new Date(m.membership_date)
                          return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}`
                        })() : '—'}
                      </div>
                      {anniv.status === 'due_soon' && <div className="text-xs text-orange-500">Due in {anniv.daysLeft} days</div>}
                    </td>
                    <td className={`table-cell text-right font-bold ${hasOutstanding ? 'text-red-600' : 'text-green-600'}`}>
                      {hasOutstanding ? fmt(m.outstanding_fees) : '✓ Clear'}
                    </td>
                    <td className="table-cell">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {m.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1">
                        <button onClick={() => setShowDetailModal(m)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="View Details">
                          <Eye className="w-4 h-4" />
                        </button>
                        {isCashier && hasOutstanding && (
                          <button onClick={() => setShowPayModal(m)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Collect Fee">
                            <IndianRupee className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!search && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <p className="text-sm text-gray-500">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, stats.total)} of <strong>{stats.total.toLocaleString('en-IN')}</strong> members
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-100">
                ← Prev
              </button>
              <span className="px-3 py-1.5 text-sm font-medium bg-blue-700 text-white rounded-lg">
                {page + 1} / {Math.ceil(stats.total / PAGE_SIZE)}
              </span>
              <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= stats.total}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 hover:bg-gray-100">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
      {showAddModal && (
        <AddMemberModal
          org={currentOrg}
          onClose={() => setShowAddModal(false)}
          onSuccess={(newMember) => { 
            setShowAddModal(false)
            fetchMembers()
            if (newMember) setShowPayModal(newMember)
          }}
          members={members}
        />
      )}

      {/* PAYMENT MODAL */}
      {showPayModal && (
        <CollectFeeModal
          member={showPayModal}
          org={currentOrg}
          onClose={() => setShowPayModal(null)}
          onSuccess={() => { setShowPayModal(null); fetchMembers() }}
        />
      )}

      {/* DETAIL MODAL */}
      {showDetailModal && (
        <MemberDetailModal
          member={showDetailModal}
          onClose={() => setShowDetailModal(null)}
          org={currentOrg}
          userRole={userRole}
        />
      )}
    </div>
  )
}

// ---- ADD MEMBER MODAL ----
function AddMemberModal({ org, onClose, onSuccess, members }) {
  const [form, setForm] = useState({
    member_name: '', father_name: '', enrollment_no: '', membership_no: '',
    mobile: '', email: '', address: '', membership_date: new Date().toISOString().split('T')[0],
    icard_issued: false,
  })
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState('')

  function handleNameChange(name) {
    setForm(f => ({ ...f, member_name: name }))
    if (name.trim()) {
      const letter = name.trim().charAt(0).toUpperCase()
      setPreview(`${letter}-XXXX (auto-assigned on save)`)
    }
  }

  async function handleSave() {
    if (!form.member_name) return toast.error('Name is required')
    if (!form.membership_date) return toast.error('Membership date required')

    setSaving(true)
    try {
      const letter = form.member_name.trim().charAt(0).toUpperCase()

      // Get last member no for this letter — find max serial
      const { data: existing } = await supabase
        .from('dcba_members')
        .select('member_no')
        .eq('org_id', org.id)
        .ilike('member_no', `${letter}-%`)
        .order('member_no', { ascending: false })

      let nextSerial = 1
      if (existing && existing.length > 0) {
        const serials = existing
          .map(m => parseInt(m.member_no.split('-')[1]))
          .filter(n => !isNaN(n))
        if (serials.length > 0) nextSerial = Math.max(...serials) + 1
      }

      const memberNo = `${letter}-${String(nextSerial).padStart(4, '0')}`

      // Calculate initial outstanding
      const outstanding = ADMISSION_FEE + ANNUAL_FEE + (form.icard_issued ? ICARD_FEE : 0)

      const { error } = await supabase.from('dcba_members').insert({
        org_id: org.id,
        member_no: memberNo,
        member_name: form.member_name.toUpperCase(),
        father_name: form.father_name.toUpperCase(),
        enrollment_no: form.enrollment_no,
        membership_no: form.membership_no,
        mobile: form.mobile,
        email: form.email,
        address: form.address,
        membership_date: form.membership_date,
        status: 'active',
        icard_issued: form.icard_issued,
        outstanding_fees: outstanding,
        admission_fee_paid: false,
        annual_fee_paid: false,
      })
      if (error) throw error
      toast.success(`Member ${memberNo} created!`)

      // Auto-create I-Card request for new member
      const fy = new Date().getMonth() >= 3
        ? `${new Date().getFullYear()}-${String(new Date().getFullYear()+1).slice(2)}`
        : `${new Date().getFullYear()-1}-${String(new Date().getFullYear()).slice(2)}`
      const { count: reqCount } = await supabase.from('dcba_member_requests')
        .select('*', { count: 'exact', head: true }).eq('org_id', org.id)
      const requestNo = `DCBA/REQ/${fy}/${String((reqCount||0)+1).padStart(4,'0')}`
      await supabase.from('dcba_member_requests').insert({
        org_id: org.id,
        request_no: requestNo,
        request_type: 'icard',
        request_date: new Date().toISOString().split('T')[0],
        status: 'approved',
        icard_status: 'pending',
        icard_fee_amount: 50,
        icard_fee_paid: form.icard_issued,
        remarks: 'Auto-created at admission',
      })

      // Return new member for fee collection
      const { data: newMember } = await supabase.from('dcba_members')
        .select('*').eq('org_id', org.id).eq('member_no', memberNo).single()
      onSuccess(newMember)
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
          <h3 className="text-lg font-semibold">New Member Admission</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Fee summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 mb-2">Fee Structure at Admission:</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-blue-700">₹{ADMISSION_FEE}</p>
                <p className="text-xs text-gray-500">Admission Fee (One-time)</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-green-700">₹{ANNUAL_FEE}</p>
                <p className="text-xs text-gray-500">Annual Subscription</p>
              </div>
              <div className="bg-white rounded-lg p-2">
                <p className="text-lg font-bold text-purple-700">₹{ICARD_FEE}</p>
                <p className="text-xs text-gray-500">I-Card Fee (if applicable)</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Full Name * (Member No. auto-generates)</label>
              <input className="input" value={form.member_name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="ADVOCATE NAME" />
              {preview && (
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  Member No. will be: <strong>{preview}</strong>
                </p>
              )}
            </div>
            <div>
              <label className="label">Father/Husband Name</label>
              <input className="input" value={form.father_name}
                onChange={e => setForm({ ...form, father_name: e.target.value })}
                placeholder="S/W/D of" />
            </div>
            <div>
              <label className="label">Enrollment No. (Bar Council)</label>
              <input className="input" value={form.enrollment_no}
                onChange={e => setForm({ ...form, enrollment_no: e.target.value })}
                placeholder="D/XXXX/XXXX" />
            </div>
            <div>
              <label className="label">Mobile No.</label>
              <input className="input" value={form.mobile}
                onChange={e => setForm({ ...form, mobile: e.target.value })}
                placeholder="10 digit mobile" maxLength={10} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="email@example.com" />
            </div>
            <div>
              <label className="label">Membership Date *</label>
              <input type="date" className="input" value={form.membership_date}
                onChange={e => setForm({ ...form, membership_date: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <input className="input" value={form.address}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Residential / Chamber address" />
            </div>
          </div>

          {/* I-Card */}
          <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl p-4">
            <input type="checkbox" id="icard" checked={form.icard_issued}
              onChange={e => setForm({ ...form, icard_issued: e.target.checked })}
              className="w-4 h-4 text-purple-600" />
            <label htmlFor="icard" className="text-sm font-medium text-purple-800 cursor-pointer">
              I-Card issued at admission (+₹{ICARD_FEE})
            </label>
          </div>

          {/* Total */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex justify-between items-center">
            <span className="font-semibold text-gray-700">Total Outstanding at Admission:</span>
            <span className="text-xl font-bold text-red-600">
              ₹{ADMISSION_FEE + ANNUAL_FEE + (form.icard_issued ? ICARD_FEE : 0)}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Create Member'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- COLLECT FEE MODAL ----
function CollectFeeModal({ member, org, onClose, onSuccess }) {
  const [cashAccounts, setCashAccounts] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [collectMode, setCollectMode] = useState('outstanding') // 'outstanding' | 'advance'
  const [advanceAmount, setAdvanceAmount] = useState('')
  const [form, setForm] = useState({
    payment_mode: 'cash',
    cash_account_id: '',
    bank_account_id: '',
    pay_annual: false,
    pay_icard: false,
    date: new Date().toISOString().split('T')[0],
    cheque_no: '',
    cheque_date: new Date().toISOString().split('T')[0],
    bank_name: '',
    transaction_id: '',
    remarks: '',
  })
  const [saving, setSaving] = useState(false)
  const [receipt, setReceipt] = useState(null)

  useEffect(() => { fetchAccounts() }, [])

  async function fetchAccounts() {
    const [{ data: cash }, { data: bank }] = await Promise.all([
      supabase.from('cash_accounts').select('*').eq('org_id', org.id).eq('is_active', true),
      supabase.from('bank_accounts').select('*').eq('org_id', org.id).eq('is_active', true),
    ])
    setCashAccounts(cash || [])
    setBankAccounts(bank || [])
    if (cash?.[0]) setForm(f => ({ ...f, cash_account_id: cash[0].id }))
  }

  const baseOutstanding = Number(member.outstanding_fees) || 0

  const outstandingTotal =
    baseOutstanding +
    (form.pay_annual ? ANNUAL_FEE : 0) +
    (form.pay_icard ? ICARD_FEE : 0)

  const totalToPay = collectMode === 'advance'
    ? Number(advanceAmount) || 0
    : outstandingTotal

  function toWords(n) {
    const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
    const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
    if (n === 0) return 'Zero'
    if (n < 20) return a[n]
    if (n < 100) return b[Math.floor(n/10)] + (n%10 ? ' ' + a[n%10] : '')
    if (n < 1000) return a[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' ' + toWords(n%100) : '')
    if (n < 100000) return toWords(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + toWords(n%1000) : '')
    return toWords(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + toWords(n%100000) : '')
  }

  async function handleCollect() {
    if (totalToPay <= 0) return toast.error('Enter amount to collect')
    setSaving(true)
    try {
      const cashId = form.payment_mode === 'cash' && form.cash_account_id ? form.cash_account_id : null
      const bankId = form.payment_mode !== 'cash' && form.bank_account_id ? form.bank_account_id : null

      // Generate receipt number
      const { count } = await supabase.from('income_entries')
        .select('*', { count: 'exact', head: true }).eq('org_id', org.id)
      const fy = new Date().getMonth() >= 3
        ? `${new Date().getFullYear()}-${String(new Date().getFullYear()+1).slice(2)}`
        : `${new Date().getFullYear()-1}-${String(new Date().getFullYear()).slice(2)}`
      const receiptNo = `DCBA/RCP/${fy}/${String((count||0)+1).padStart(4,'0')}`

      // Build description
      const items = []
      if (collectMode === 'outstanding') {
        // New member = admission not paid AND membership created within last 30 days
        const membershipDate = member.membership_date ? new Date(member.membership_date) : null
        const daysSinceMembership = membershipDate ? (new Date() - membershipDate) / (1000 * 60 * 60 * 24) : 999
        const isNewMember = member.admission_fee_paid !== true && daysSinceMembership <= 30

        if (isNewMember && baseOutstanding > 0) {
          items.push(`Admission Fee ₹${ADMISSION_FEE}`)
          const remainingAfterAdmi = baseOutstanding - ADMISSION_FEE
          if (remainingAfterAdmi === ANNUAL_FEE + ICARD_FEE) {
            items.push(`Annual Subscription ₹${ANNUAL_FEE}`)
            items.push(`I-Card Fee ₹${ICARD_FEE}`)
          } else if (remainingAfterAdmi === ANNUAL_FEE) {
            items.push(`Annual Subscription ₹${ANNUAL_FEE}`)
          } else if (remainingAfterAdmi > 0) {
            items.push(`Annual Subscription ₹${remainingAfterAdmi}`)
          }
        } else if (baseOutstanding > 0) {
          items.push(`Accrued Dues ₹${baseOutstanding}`)
        }
        if (form.pay_annual) items.push(`Annual Subscription ₹${ANNUAL_FEE}`)
        if (form.pay_icard) items.push(`I-Card Fee ₹${ICARD_FEE}`)
      } else {
        items.push(`Advance Payment ₹${totalToPay}`)
      }

      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id

      const { error: incErr } = await supabase.from('income_entries').insert({
        org_id: org.id,
        entry_date: form.date,
        description: `${items.join(', ')} — ${member.member_name} (${member.member_no}) | Rcpt: ${receiptNo}`,
        amount: totalToPay,
        payment_mode: form.payment_mode,
        cash_account_id: cashId,
        bank_account_id: bankId,
        receipt_no: receiptNo,
        member_id: member.id,
        items_collected: items.join(', '),
        created_by: userId,
        cheque_no: form.payment_mode === 'cheque' ? form.cheque_no : null,
        cheque_date: form.payment_mode === 'cheque' ? form.cheque_date : null,
        transaction_id: ['upi','neft'].includes(form.payment_mode) ? form.transaction_id : null,
        cheque_status: form.payment_mode === 'cheque' ? 'pending' : null,
      })
      if (incErr) throw incErr

      // Compute new outstanding after collection
      const newOutstanding = collectMode === 'advance'
        ? Math.max(0, baseOutstanding - totalToPay)
        : 0  // full O/S collected

      // If annual subscription paid, push membership_date anniversary by 1 year
      const memberUpdates = {
        outstanding_fees: newOutstanding,
        last_fee_paid_date: form.date,
        admission_fee_paid: (collectMode === 'outstanding' && form.pay_admission) ? true : member.admission_fee_paid,
        annual_fee_paid: (collectMode === 'outstanding' && form.pay_annual) ? true : member.annual_fee_paid,
        icard_issued: (collectMode === 'outstanding' && form.pay_icard) ? true : member.icard_issued,
      }

      // Push membership date by 1 year if annual subscription collected
      if (collectMode === 'outstanding' && form.pay_annual && member.membership_date) {
        const d = new Date(member.membership_date)
        d.setFullYear(d.getFullYear() + 1)
        memberUpdates.membership_date = d.toISOString().split('T')[0]
      }

      await supabase.from('dcba_members').update(memberUpdates).eq('id', member.id)

      // Show receipt
      setReceipt({
        receiptNo,
        date: form.date,
        member,
        items,
        amount: totalToPay,
        paymentMode: form.payment_mode.toUpperCase(),
        amountInWords: toWords(totalToPay) + ' Only',
        cheque_no: form.cheque_no,
        cheque_date: form.cheque_date,
        bank_name: form.bank_name,
        transaction_id: form.transaction_id,
        remarks: form.remarks,
      })
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  // Receipt view — use pre-printed format
  if (receipt) {
    return (
      <MemberReceiptPrint
        receipt={receipt}
        onClose={() => { onSuccess(); onClose() }}
      />
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-green-50">
          <h3 className="text-lg font-semibold">Collect Membership Fee</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="font-bold text-blue-800">{member.member_name}</p>
            <p className="text-xs text-blue-600">{member.member_no} · Outstanding: <strong className="text-red-600">₹{Number(member.outstanding_fees).toLocaleString('en-IN')}</strong></p>
          </div>

          {/* Collection mode */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setCollectMode('outstanding')}
              className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${collectMode === 'outstanding' ? 'border-blue-700 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}>
              💳 Collect O/S<br />
              <span className="text-xs font-normal">₹{outstandingTotal}</span>
            </button>
            <button onClick={() => setCollectMode('advance')}
              className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${collectMode === 'advance' ? 'border-green-700 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>
              ➕ Advance<br />
              <span className="text-xs font-normal">Custom amount</span>
            </button>
          </div>

          {/* Outstanding items */}
          {collectMode === 'outstanding' && (
            <div className="space-y-2">
              {/* Base outstanding */}
              {baseOutstanding > 0 && (
                <div className="flex items-center justify-between bg-orange-50 rounded-lg p-3">
                  <span className="text-sm text-orange-700">Accrued dues till date</span>
                  <span className="font-bold text-orange-700">₹{baseOutstanding}</span>
                </div>
              )}
              {/* Annual Subscription — always shown, unchecked by default */}
              <label className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 cursor-pointer">
                <input type="checkbox" checked={form.pay_annual}
                  onChange={e => setForm({ ...form, pay_annual: e.target.checked })}
                  className="w-4 h-4 text-green-600" />
                <div className="flex-1">
                  <span className="text-sm font-medium">Annual Subscription</span>
                  <p className="text-xs text-green-600">Tick to collect next year's subscription — pushes due date by 1 year</p>
                </div>
                <span className="font-bold text-green-700">₹{ANNUAL_FEE}</span>
              </label>
              {/* I-Card — always shown, optional */}
              <label className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 cursor-pointer">
                <input type="checkbox" checked={form.pay_icard}
                  onChange={e => setForm({ ...form, pay_icard: e.target.checked })}
                  className="w-4 h-4 text-purple-600" />
                <div className="flex-1">
                  <span className="text-sm font-medium">I-Card Fee</span>
                  <p className="text-xs text-purple-500">Tick if member is requesting I-Card</p>
                </div>
                <span className="font-bold text-purple-700">₹{ICARD_FEE}</span>
              </label>
            </div>
          )}

          {/* Advance amount */}
          {collectMode === 'advance' && (
            <div>
              <label className="label">Advance Amount (₹)</label>
              <input type="number" className="input text-lg font-bold" value={advanceAmount}
                onChange={e => setAdvanceAmount(e.target.value)}
                placeholder="Enter amount" min="1" />
              <p className="text-xs text-gray-400 mt-1">This will be adjusted against future dues</p>
            </div>
          )}

          {/* Payment mode */}
          <div>
            <label className="label">Payment Mode</label>
            <div className="flex gap-2 flex-wrap">
              {['cash','cheque','upi','neft'].map(mode => (
                <button key={mode} onClick={() => setForm({ ...form, payment_mode: mode })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${form.payment_mode === mode ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {form.payment_mode === 'cash' && cashAccounts.length > 0 && (
            <div>
              <label className="label">Cash Account</label>
              <select className="input" value={form.cash_account_id}
                onChange={e => setForm({ ...form, cash_account_id: e.target.value })}>
                {cashAccounts.map(c => <option key={c.id} value={c.id}>{c.cashier_name}</option>)}
              </select>
            </div>
          )}

          {form.payment_mode !== 'cash' && bankAccounts.length > 0 && (
            <div>
              <label className="label">Bank Account</label>
              <select className="input" value={form.bank_account_id}
                onChange={e => setForm({ ...form, bank_account_id: e.target.value })}>
                {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.account_name} — {b.bank_name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>

          {form.payment_mode === 'cheque' && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Cheque Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cheque No. *</label>
                  <input className="input" value={form.cheque_no} onChange={e => setForm({...form, cheque_no: e.target.value})} placeholder="e.g. 012345" />
                </div>
                <div>
                  <label className="label">Cheque Date</label>
                  <input type="date" className="input" value={form.cheque_date} onChange={e => setForm({...form, cheque_date: e.target.value})} />
                </div>
              </div>
              <p className="text-xs text-blue-600">⚠ Cheque will appear in Cheques in Hand until deposited.</p>
            </div>
          )}

          {['upi','neft'].includes(form.payment_mode) && (
            <div>
              <label className="label">Transaction ID *</label>
              <input className="input font-mono" value={form.transaction_id}
                onChange={e => setForm({...form, transaction_id: e.target.value})}
                placeholder={form.payment_mode === 'upi' ? 'UPI Ref No.' : 'NEFT/IMPS Ref No.'} />
            </div>
          )}

          <div>
            <label className="label">Remarks</label>
            <input className="input" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} placeholder="Optional" />
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex justify-between items-center">
            <span className="font-semibold text-green-800">Total Collecting:</span>
            <span className="text-2xl font-bold text-green-700">₹{totalToPay.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleCollect} disabled={saving || totalToPay <= 0}
            className="btn-primary flex items-center gap-2">
            <IndianRupee className="w-4 h-4" />
            {saving ? 'Processing...' : `Collect ₹${totalToPay.toLocaleString('en-IN')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- MEMBER DETAIL MODAL ----
function MemberDetailModal({ member, onClose, org, userRole }) {
  const isAdmin = ['admin', 'supervisor', 'cashier'].includes(userRole?.role)
  const anniv = getAnniversaryStatus(member.membership_date)
  const [activeTab, setActiveTab] = useState('details')
  const [feeHistory, setFeeHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [reprintReceipt, setReprintReceipt] = useState(null)
  const [editAllotments, setEditAllotments] = useState(false)
  const [allotments, setAllotments] = useState({
    chamber: member.chamber || '',
    locker_no: member.locker_no || '',
    seat_no: member.seat_no || '',
    hall_no: member.hall_no || '',
    dob: member.dob || '',
  })
  const [savingAllotments, setSavingAllotments] = useState(false)

  async function saveAllotments() {
    setSavingAllotments(true)
    try {
      const { error } = await supabase.from('dcba_members').update({
        chamber: allotments.chamber || null,
        locker_no: allotments.locker_no || null,
        seat_no: allotments.seat_no || null,
        hall_no: allotments.hall_no || null,
        dob: allotments.dob || null,
      }).eq('id', member.id)
      if (error) throw error
      toast.success('Details updated!')
      setEditAllotments(false)
      Object.assign(member, allotments)
    } catch (err) {
      toast.error(err.message)
    }
    setSavingAllotments(false)
  }

  useEffect(() => {
    if (activeTab === 'history') fetchFeeHistory()
  }, [activeTab])

  async function fetchFeeHistory() {
    setLoadingHistory(true)
    const { data } = await supabase.from('income_entries')
      .select('*')
      .eq('member_id', member.id)
      .eq('is_cancelled', false)
      .order('entry_date', { ascending: false })
    setFeeHistory(data || [])
    setLoadingHistory(false)
  }

  function handleReprint(entry) {
    setReprintReceipt({
      receiptNo: entry.receipt_no,
      date: entry.entry_date,
      member,
      amount: Number(entry.amount),
      amountInWords: numberToWords(Number(entry.amount)) + ' Only',
      items: entry.items_collected ? entry.items_collected.split(', ') : [entry.description],
      paymentMode: (entry.payment_mode || 'cash').toUpperCase(),
      cheque_no: entry.cheque_no,
      cheque_date: entry.cheque_date,
      transaction_id: entry.transaction_id,
      remarks: entry.remarks,
      isReprint: true,
    })
  }

  function formatDate(d) {
    if (!d) return '—'
    const dt = new Date(d)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${String(dt.getDate()).padStart(2,'0')}-${months[dt.getMonth()]}-${dt.getFullYear()}`
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-yellow-500 flex-shrink-0">
              <img
                src={`https://xalbjrmridjgdpguobdx.supabase.co/storage/v1/object/public/member-photos/${member.member_no}.png`}
                alt={member.member_name}
                className="w-full h-full object-cover"
                onError={e => {
                  e.target.style.display = 'none'
                  e.target.parentElement.innerHTML = `<div style="width:100%;height:100%;background:#1a3a5c;display:flex;align-items:center;justify-content:center;color:#f5c842;font-weight:700;font-size:1rem">${member.member_name.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>`
                }}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{member.member_no}</h3>
              <p className="text-sm text-gray-600">{member.member_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6 flex-shrink-0">
          {[{id:'details',label:'Details'},{id:'history',label:'Fee History 🖨'}].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

      {activeTab === 'details' && (
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ['Member No.', member.member_no],
              ['Name', member.member_name],
              ['S/W/D of', member.father_name || '—'],
              ['Enrollment No.', member.enrollment_no || '—'],
              ['Mobile', member.mobile || '—'],
              ['Email', member.email || '—'],
              ['Membership Date', formatDate(member.membership_date)],
              ['Status', member.status === 'active' ? '✅ Active' : '❌ Inactive'],
              ['I-Card Issued', member.icard_issued ? '✅ Yes' : '❌ No'],
              ['Last Fee Paid', formatDate(member.last_fee_paid_date)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-400 font-medium">{label}</p>
                <p className="font-semibold text-gray-800">{value}</p>
              </div>
            ))}
          </div>

          {/* Fee status */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm font-bold text-gray-700 mb-3">Fee Status:</p>
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className={`rounded-lg p-2 ${member.admission_fee_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                <p className="text-lg">{member.admission_fee_paid ? '✅' : '❌'}</p>
                <p className="font-bold">Admission ₹600</p>
                <p>{member.admission_fee_paid ? 'Paid' : 'Pending'}</p>
              </div>
              <div className={`rounded-lg p-2 ${member.annual_fee_paid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                <p className="text-lg">{member.annual_fee_paid ? '✅' : '❌'}</p>
                <p className="font-bold">Annual ₹600</p>
                <p>{member.annual_fee_paid ? 'Paid' : 'Pending'}</p>
              </div>
              <div className={`rounded-lg p-2 ${member.icard_issued ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                <p className="text-lg">{member.icard_issued ? '✅' : '—'}</p>
                <p className="font-bold">I-Card ₹50</p>
                <p>{member.icard_issued ? 'Issued' : 'Not Issued'}</p>
              </div>
            </div>
            {Number(member.outstanding_fees) > 0 && (
              <div className="mt-3 text-center bg-red-50 border border-red-200 rounded-lg p-2">
                <p className="text-red-700 font-bold">Outstanding: ₹{member.outstanding_fees}</p>
              </div>
            )}
          </div>

          {/* Anniversary alert */}
          {anniv.status === 'due_soon' && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-sm text-orange-700">
              ⚠️ Annual subscription renewal due in <strong>{anniv.daysLeft} days</strong>
            </div>
          )}

          {member.address && (
            <div>
              <p className="text-xs text-gray-400 font-medium">Address</p>
              <p className="text-sm text-gray-700">{member.address}</p>
            </div>
          )}

          {/* Chamber / Locker / Seat section */}
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-700">Court & DCBA Allotments</p>
              {isAdmin && (
                <button onClick={() => setEditAllotments(!editAllotments)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50">
                  {editAllotments ? 'Cancel' : '✏️ Edit'}
                </button>
              )}
            </div>

            {editAllotments ? (
              <div className="space-y-3">
                <div>
                  <label className="label text-xs">Chamber No.</label>
                  <input className="input text-sm" value={allotments.chamber}
                    onChange={e => setAllotments({ ...allotments, chamber: e.target.value })}
                    placeholder="e.g. 12A, Block B" />
                </div>
                <div>
                  <label className="label text-xs">Locker No.</label>
                  <input className="input text-sm" value={allotments.locker_no}
                    onChange={e => setAllotments({ ...allotments, locker_no: e.target.value })}
                    placeholder="e.g. L-001" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label text-xs">Hall No.</label>
                    <input className="input text-sm" value={allotments.hall_no}
                      onChange={e => setAllotments({ ...allotments, hall_no: e.target.value })}
                      placeholder="e.g. Hall 1" />
                  </div>
                  <div>
                    <label className="label text-xs">Seat No.</label>
                    <input className="input text-sm" value={allotments.seat_no}
                      onChange={e => setAllotments({ ...allotments, seat_no: e.target.value })}
                      placeholder="e.g. 15" />
                  </div>
                </div>
                <div>
                  <label className="label text-xs">Date of Birth</label>
                  <input type="date" className="input text-sm" value={allotments.dob}
                    onChange={e => setAllotments({ ...allotments, dob: e.target.value })} />
                </div>
                <button onClick={saveAllotments} disabled={savingAllotments}
                  className="btn-primary w-full text-sm py-2">
                  {savingAllotments ? 'Saving...' : '💾 Save'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  ['🏛️ Chamber', member.chamber || allotments.chamber || '—'],
                  ['🔒 Locker', member.locker_no || allotments.locker_no || 'Not allotted'],
                  ['🪑 Seat', (member.seat_no || allotments.seat_no)
                    ? `${member.hall_no || allotments.hall_no || ''} · Seat ${member.seat_no || allotments.seat_no}`.trim()
                    : 'Not allotted'],
                  ['🎂 DOB', member.dob || allotments.dob ? formatDate(member.dob || allotments.dob) : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className={`text-xs font-semibold ${value === '—' || value === 'Not allotted' ? 'text-gray-400' : 'text-gray-800'}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fee History Tab */}
      {activeTab === 'history' && (
        <div className="overflow-y-auto flex-1">
          {loadingHistory ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : feeHistory.length === 0 ? (
            <div className="p-8 text-center text-gray-400">No fee receipts found</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Receipt No.</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Items</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Amount</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500">Reprint</th>
                </tr>
              </thead>
              <tbody>
                {feeHistory.map((entry, i) => (
                  <tr key={entry.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2 text-xs font-mono text-gray-500">{entry.receipt_no}</td>
                    <td className="px-4 py-2 text-xs whitespace-nowrap">{formatDate(entry.entry_date)}</td>
                    <td className="px-4 py-2 text-xs text-gray-600 max-w-[150px] truncate">{entry.items_collected || entry.description}</td>
                    <td className="px-4 py-2 text-right text-sm font-semibold text-green-700">₹{Number(entry.amount).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2 text-center">
                      <button onClick={() => handleReprint(entry)}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded font-medium">
                        🖨 Reprint
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

        <div className="px-6 py-4 border-t flex justify-between items-center flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Close</button>
          {Number(member.outstanding_fees) > 0 && (
            <button onClick={() => { onClose(); setTimeout(() => document.dispatchEvent(new CustomEvent('collectFee', { detail: member })), 100) }}
              className="btn-primary flex items-center gap-2">
              💰 Collect Fee ₹{Number(member.outstanding_fees).toLocaleString('en-IN')}
            </button>
          )}
        </div>
      </div>

      {/* Reprint modal */}
      {reprintReceipt && (
        <MemberReceiptPrint
          receipt={reprintReceipt}
          onClose={() => setReprintReceipt(null)}
        />
      )}
    </div>
  )
}
