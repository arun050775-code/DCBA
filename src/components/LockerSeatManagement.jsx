import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import {
  Lock, Sofa, Plus, Search, Eye, IndianRupee,
  RotateCcw, CheckCircle, AlertCircle, Upload, X, Printer
} from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmt(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`
}
function fmtAmt(n) { return `₹${Number(n||0).toLocaleString('en-IN')}` }

export default function LockerSeatManagement() {
  const { currentOrg, userRole } = useAuth()
  const [tab, setTab] = useState('locker') // 'locker' | 'seat'
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [stats, setStats] = useState({ total: 0, allotted: 0, vacant: 0 })

  // Modals
  const [showAdd, setShowAdd] = useState(false)
  const [showAllot, setShowAllot] = useState(null)
  const [showDeposit, setShowDeposit] = useState(null)
  const [showRefund, setShowRefund] = useState(null)
  const [showDetail, setShowDetail] = useState(null)
  const [showRequests, setShowRequests] = useState(false)

  const isCashier = ['admin', 'cashier', 'supervisor'].includes(userRole?.role)

  useEffect(() => { if (currentOrg) fetchItems() }, [currentOrg, tab])

  async function fetchItems() {
    setLoading(true)
    let q = supabase.from('dcba_locker_seats')
      .select('*, dcba_members(member_name, member_no, mobile)')
      .eq('org_id', currentOrg.id)
      .eq('item_type', tab)
      .order('item_no')

    if (filterStatus !== 'all') q = q.eq('status', filterStatus)

    const { data, error } = await q
    if (error) { toast.error(error.message); setLoading(false); return }

    setItems(data || [])
    const all = data || []
    setStats({
      total: all.length,
      allotted: all.filter(i => i.status === 'allotted').length,
      vacant: all.filter(i => i.status === 'vacant').length,
    })
    setLoading(false)
  }

  const filtered = items.filter(i => {
    if (!search) return true
    const s = search.toLowerCase()
    return (
      i.item_no?.toLowerCase().includes(s) ||
      i.dcba_members?.member_name?.toLowerCase().includes(s) ||
      i.dcba_members?.member_no?.toLowerCase().includes(s) ||
      i.hall_no?.toLowerCase().includes(s)
    )
  })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Lock className="w-6 h-6 text-blue-700" /> Locker & Seat Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRequests(true)}
            className="btn-secondary flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4" /> Allotment Requests
          </button>
          {isCashier && (
            <button onClick={() => setShowAdd(true)}
              className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add {tab === 'locker' ? 'Locker' : 'Seat'}
            </button>
          )}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'locker', label: 'Lockers', icon: Lock },
          { id: 'seat', label: 'Seats', icon: Sofa },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); setFilterStatus('all') }}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: `Total ${tab === 'locker' ? 'Lockers' : 'Seats'}`, value: stats.total, color: 'blue' },
          { label: 'Allotted', value: stats.allotted, color: 'green' },
          { label: 'Vacant', value: stats.vacant, color: 'orange' },
        ].map(s => {
          const colors = {
            blue: 'bg-blue-50 border-blue-200 text-blue-700',
            green: 'bg-green-50 border-green-200 text-green-700',
            orange: 'bg-orange-50 border-orange-200 text-orange-700',
          }
          return (
            <div key={s.label} className={`rounded-xl border p-4 ${colors[s.color]}`}>
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-xs font-semibold opacity-80 mt-1">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder={`Search by ${tab === 'locker' ? 'locker no' : 'hall/seat no'}, member name...`}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {[
              { id: 'all', label: 'All' },
              { id: 'vacant', label: '🔓 Vacant' },
              { id: 'allotted', label: '✅ Allotted' },
              { id: 'surrendered', label: '↩ Surrendered' },
            ].map(f => (
              <button key={f.id} onClick={() => setFilterStatus(f.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${filterStatus === f.id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {f.label}
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
                {(tab === 'locker'
                  ? ['Locker No.', 'Status', 'Allotted To', 'Allotment Date', 'Security Deposit', 'Deposit Paid', 'Actions']
                  : ['Seat', 'Hall', 'Status', 'Allotted To', 'Allotment Date', 'Security Deposit', 'Actions']
                ).map(h => (
                  <th key={h} className="table-header text-left text-xs whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-cell text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center py-8 text-gray-400">
                  No {tab === 'locker' ? 'lockers' : 'seats'} found — add one using the button above
                </td></tr>
              ) : filtered.map((item, i) => (
                <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="table-cell font-mono font-bold text-blue-700">{item.item_no}</td>
                  {tab === 'seat' && <td className="table-cell text-sm">{item.hall_no || '—'}</td>}
                  <td className="table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      item.status === 'allotted' ? 'bg-green-100 text-green-700' :
                      item.status === 'vacant' ? 'bg-gray-100 text-gray-500' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {item.status === 'allotted' ? '✅ Allotted' :
                       item.status === 'vacant' ? '🔓 Vacant' : '↩ Surrendered'}
                    </span>
                  </td>
                  <td className="table-cell">
                    {item.dcba_members ? (
                      <div>
                        <p className="text-sm font-medium">{item.dcba_members.member_name}</p>
                        <p className="text-xs text-gray-400">{item.dcba_members.member_no}</p>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="table-cell text-sm">{fmt(item.allotment_date)}</td>
                  <td className="table-cell font-semibold text-blue-700">{fmtAmt(item.security_deposit)}</td>
                  <td className="table-cell">
                    <div className="flex gap-1 flex-wrap">
                      <button onClick={() => setShowDetail(item)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="View Details">
                        <Eye className="w-4 h-4" />
                      </button>
                      {isCashier && item.status === 'vacant' && (
                        <button onClick={() => setShowAllot(item)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Allot">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {isCashier && item.status === 'allotted' && (
                        <>
                          <button onClick={() => setShowDeposit(item)}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded" title="Record Deposit">
                            <IndianRupee className="w-4 h-4" />
                          </button>
                          <button onClick={() => setShowRefund(item)}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded" title="Surrender & Refund">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showAdd && (
        <AddItemModal tab={tab} org={currentOrg} onClose={() => setShowAdd(false)} onSuccess={() => { setShowAdd(false); fetchItems() }} />
      )}
      {showAllot && (
        <AllotModal item={showAllot} org={currentOrg} onClose={() => setShowAllot(null)} onSuccess={() => { setShowAllot(null); fetchItems() }} />
      )}
      {showDeposit && (
        <DepositModal item={showDeposit} org={currentOrg} onClose={() => setShowDeposit(null)} onSuccess={() => { setShowDeposit(null); fetchItems() }} />
      )}
      {showRefund && (
        <RefundModal item={showRefund} org={currentOrg} onClose={() => setShowRefund(null)} onSuccess={() => { setShowRefund(null); fetchItems() }} />
      )}
      {showDetail && (
        <DetailModal item={showDetail} org={currentOrg} onClose={() => setShowDetail(null)} />
      )}
      {showRequests && (
        <AllotmentRequestsModal org={currentOrg} onClose={() => setShowRequests(false)} onSuccess={() => { setShowRequests(false); fetchItems() }} />
      )}
    </div>
  )
}

// ---- ADD LOCKER / SEAT ----
function AddItemModal({ tab, org, onClose, onSuccess }) {
  const [form, setForm] = useState({
    item_no: '',
    hall_no: '',
    seat_no: '',
    security_deposit: tab === 'locker' ? '500' : '200',
    remarks: '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.item_no) return toast.error('Item number is required')
    if (tab === 'seat' && !form.hall_no) return toast.error('Hall number is required for seats')
    setSaving(true)
    try {
      const itemNo = tab === 'seat'
        ? `${form.hall_no.replace(/\s/g, '')}-${form.seat_no || form.item_no}`
        : form.item_no
      const { error } = await supabase.from('dcba_locker_seats').insert({
        org_id: org.id,
        item_type: tab,
        item_no: itemNo,
        hall_no: tab === 'seat' ? form.hall_no : null,
        seat_no: tab === 'seat' ? (form.seat_no || form.item_no) : null,
        status: 'vacant',
        security_deposit: Number(form.security_deposit) || 0,
        remarks: form.remarks,
      })
      if (error) throw error
      toast.success(`${tab === 'locker' ? 'Locker' : 'Seat'} ${itemNo} added!`)
      onSuccess()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
          <h3 className="text-lg font-semibold">Add {tab === 'locker' ? 'Locker' : 'Seat'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          {tab === 'locker' ? (
            <div>
              <label className="label">Locker Number *</label>
              <input className="input" value={form.item_no} onChange={e => setForm({ ...form, item_no: e.target.value })}
                placeholder="e.g. L-001 or 001" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Hall No. *</label>
                <input className="input" value={form.hall_no} onChange={e => setForm({ ...form, hall_no: e.target.value })}
                  placeholder="e.g. Hall 1" />
              </div>
              <div>
                <label className="label">Seat No. *</label>
                <input className="input" value={form.seat_no} onChange={e => setForm({ ...form, seat_no: e.target.value, item_no: `${form.hall_no.replace(/\s/g,'')}-${e.target.value}` })}
                  placeholder="e.g. 15" />
                {form.hall_no && form.seat_no && (
                  <p className="text-xs text-blue-600 mt-1">ID: <strong>{form.hall_no.replace(/\s/g, '')}-{form.seat_no}</strong></p>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="label">Security Deposit Amount (₹)</label>
            <input type="number" className="input" value={form.security_deposit}
              onChange={e => setForm({ ...form, security_deposit: e.target.value })} />
          </div>
          <div>
            <label className="label">Remarks</label>
            <input className="input" value={form.remarks}
              onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Optional" />
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- ALLOT TO MEMBER ----
function AllotModal({ item, org, onClose, onSuccess }) {
  const [members, setMembers] = useState([])
  const [search, setSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState(null)
  const [allotDate, setAllotDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [searching, setSearching] = useState(false)

  async function searchMembers(q) {
    setSearch(q)
    if (q.length < 2) { setMembers([]); return }
    setSearching(true)
    const { data } = await supabase.from('dcba_members')
      .select('id, member_name, member_no, mobile')
      .eq('org_id', org.id)
      .eq('status', 'active')
      .or(`member_name.ilike.%${q}%,member_no.ilike.%${q}%`)
      .limit(10)
    setMembers(data || [])
    setSearching(false)
  }

  async function handleAllot() {
    if (!selectedMember) return toast.error('Select a member')
    setSaving(true)
    try {
      // Update locker/seat record
      const { error } = await supabase.from('dcba_locker_seats').update({
        status: 'allotted',
        allotted_to: selectedMember.id,
        allotment_date: allotDate,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id)
      if (error) throw error

      // Update member profile with locker/seat info
      const memberUpdate = item.item_type === 'locker'
        ? { locker_no: item.item_no }
        : { seat_no: item.seat_no, hall_no: item.hall_no }

      await supabase.from('dcba_members').update(memberUpdate).eq('id', selectedMember.id)

      toast.success(`${item.item_type === 'locker' ? 'Locker' : 'Seat'} ${item.item_no} allotted to ${selectedMember.member_name}!`)
      onSuccess()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-green-50">
          <h3 className="text-lg font-semibold">Allot {item.item_type === 'locker' ? 'Locker' : 'Seat'} {item.item_no}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="label">Search Member</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input className="input pl-9" value={search}
                onChange={e => searchMembers(e.target.value)}
                placeholder="Type name or member no..." />
            </div>
            {members.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                {members.map(m => (
                  <button key={m.id} onClick={() => { setSelectedMember(m); setSearch(m.member_name); setMembers([]) }}
                    className={`w-full text-left px-4 py-2.5 hover:bg-blue-50 border-b last:border-0 ${selectedMember?.id === m.id ? 'bg-blue-50' : ''}`}>
                    <p className="text-sm font-medium">{m.member_name}</p>
                    <p className="text-xs text-gray-400">{m.member_no} · {m.mobile || '—'}</p>
                  </button>
                ))}
              </div>
            )}
            {selectedMember && (
              <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2 flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-green-800">{selectedMember.member_name}</p>
                  <p className="text-xs text-green-600">{selectedMember.member_no}</p>
                </div>
                <button onClick={() => setSelectedMember(null)} className="text-green-600 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            )}
          </div>
          <div>
            <label className="label">Allotment Date</label>
            <input type="date" className="input" value={allotDate}
              onChange={e => setAllotDate(e.target.value)} />
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
            <p className="font-semibold text-blue-800">Security Deposit: {`₹${Number(item.security_deposit).toLocaleString('en-IN')}`}</p>
            <p className="text-xs text-blue-600 mt-1">After allotment, collect deposit using the ₹ button in the table</p>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleAllot} disabled={saving || !selectedMember} className="btn-primary">
            {saving ? 'Allotting...' : 'Allot'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- COLLECT SECURITY DEPOSIT ----
function DepositModal({ item, org, onClose, onSuccess }) {
  const [cashAccounts, setCashAccounts] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [form, setForm] = useState({
    amount: String(item.security_deposit || ''),
    payment_mode: 'cash',
    cash_account_id: '',
    bank_account_id: '',
    date: new Date().toISOString().split('T')[0],
    cheque_no: '',
    cheque_date: new Date().toISOString().split('T')[0],
    bank_name: '',
    transaction_id: '',
    remarks: '',
  })
  const [saving, setSaving] = useState(false)

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

  async function handleCollect() {
    const amt = Number(form.amount)
    if (!amt || amt <= 0) return toast.error('Enter deposit amount')
    setSaving(true)
    try {
      // Generate receipt no
      const { count } = await supabase.from('dcba_deposit_transactions')
        .select('*', { count: 'exact', head: true }).eq('org_id', org.id)
      const fy = new Date().getMonth() >= 3
        ? `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`
        : `${new Date().getFullYear() - 1}-${String(new Date().getFullYear()).slice(2)}`
      const receiptNo = `DCBA/DEP/${fy}/${String((count || 0) + 1).padStart(4, '0')}`

      const { data: { session } } = await supabase.auth.getSession()

      const { error } = await supabase.from('dcba_deposit_transactions').insert({
        org_id: org.id,
        locker_seat_id: item.id,
        member_id: item.allotted_to,
        transaction_type: 'deposit',
        amount: amt,
        payment_mode: form.payment_mode,
        receipt_no: receiptNo,
        transaction_date: form.date,
        cash_account_id: form.payment_mode === 'cash' ? form.cash_account_id || null : null,
        bank_account_id: form.payment_mode !== 'cash' ? form.bank_account_id || null : null,
        cheque_no: form.payment_mode === 'cheque' ? form.cheque_no : null,
        cheque_date: form.payment_mode === 'cheque' ? form.cheque_date : null,
        bank_name: form.payment_mode === 'cheque' ? form.bank_name : null,
        transaction_id: ['upi', 'neft'].includes(form.payment_mode) ? form.transaction_id : null,
        remarks: form.remarks,
        created_by: session?.user?.id,
      })
      if (error) throw error

      // Update locker/seat deposit info
      await supabase.from('dcba_locker_seats').update({
        deposit_receipt_no: receiptNo,
        deposit_paid_date: form.date,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id)

      // Update member security deposit total
      await supabase.from('dcba_members').update({
        security_deposit_paid: (Number(item.security_deposit) || 0)
      }).eq('id', item.allotted_to)

      toast.success(`Deposit ₹${amt.toLocaleString('en-IN')} collected! Receipt: ${receiptNo}`)
      onSuccess()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-purple-50">
          <h3 className="text-lg font-semibold">Collect Security Deposit — {item.item_no}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
            <p className="font-semibold text-blue-800">{item.dcba_members?.member_name}</p>
            <p className="text-xs text-blue-600">{item.dcba_members?.member_no}</p>
          </div>

          <div>
            <label className="label">Deposit Amount (₹)</label>
            <input type="number" className="input text-lg font-bold" value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })} />
          </div>

          <div>
            <label className="label">Payment Mode</label>
            <div className="flex gap-2 flex-wrap">
              {['cash', 'cheque', 'upi', 'neft'].map(mode => (
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
              <select className="input" value={form.cash_account_id} onChange={e => setForm({ ...form, cash_account_id: e.target.value })}>
                {cashAccounts.map(c => <option key={c.id} value={c.id}>{c.cashier_name}</option>)}
              </select>
            </div>
          )}

          {form.payment_mode !== 'cash' && bankAccounts.length > 0 && (
            <div>
              <label className="label">Bank Account</label>
              <select className="input" value={form.bank_account_id} onChange={e => setForm({ ...form, bank_account_id: e.target.value })}>
                {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.account_name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>

          {form.payment_mode === 'cheque' && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs font-semibold text-blue-700 uppercase">Cheque Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Cheque No.</label>
                  <input className="input" value={form.cheque_no} onChange={e => setForm({ ...form, cheque_no: e.target.value })} />
                </div>
                <div>
                  <label className="label">Cheque Date</label>
                  <input type="date" className="input" value={form.cheque_date} onChange={e => setForm({ ...form, cheque_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Bank Name</label>
                <input className="input" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} placeholder="e.g. SBI" />
              </div>
            </div>
          )}

          {['upi', 'neft'].includes(form.payment_mode) && (
            <div>
              <label className="label">Transaction ID</label>
              <input className="input font-mono" value={form.transaction_id}
                onChange={e => setForm({ ...form, transaction_id: e.target.value })}
                placeholder={form.payment_mode === 'upi' ? 'UPI Ref No.' : 'NEFT/IMPS Ref No.'} />
            </div>
          )}

          <div>
            <label className="label">Remarks</label>
            <input className="input" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Optional" />
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleCollect} disabled={saving} className="btn-primary flex items-center gap-2">
            <IndianRupee className="w-4 h-4" />
            {saving ? 'Processing...' : `Collect ₹${Number(form.amount || 0).toLocaleString('en-IN')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- SURRENDER & REFUND ----
function RefundModal({ item, org, onClose, onSuccess }) {
  const [cashAccounts, setCashAccounts] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [form, setForm] = useState({
    refund_amount: String(item.security_deposit || ''),
    payment_mode: 'cash',
    cash_account_id: '',
    bank_account_id: '',
    date: new Date().toISOString().split('T')[0],
    cheque_no: '',
    bank_name: '',
    transaction_id: '',
    remarks: '',
  })
  const [saving, setSaving] = useState(false)

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

  async function handleRefund() {
    const amt = Number(form.refund_amount)
    if (!amt || amt < 0) return toast.error('Enter refund amount')
    setSaving(true)
    try {
      const { count } = await supabase.from('dcba_deposit_transactions')
        .select('*', { count: 'exact', head: true }).eq('org_id', org.id)
      const fy = new Date().getMonth() >= 3
        ? `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(2)}`
        : `${new Date().getFullYear() - 1}-${String(new Date().getFullYear()).slice(2)}`
      const receiptNo = `DCBA/REF/${fy}/${String((count || 0) + 1).padStart(4, '0')}`

      const { data: { session } } = await supabase.auth.getSession()

      await supabase.from('dcba_deposit_transactions').insert({
        org_id: org.id,
        locker_seat_id: item.id,
        member_id: item.allotted_to,
        transaction_type: 'refund',
        amount: amt,
        payment_mode: form.payment_mode,
        receipt_no: receiptNo,
        transaction_date: form.date,
        cash_account_id: form.payment_mode === 'cash' ? form.cash_account_id || null : null,
        bank_account_id: form.payment_mode !== 'cash' ? form.bank_account_id || null : null,
        cheque_no: form.payment_mode === 'cheque' ? form.cheque_no : null,
        bank_name: form.payment_mode === 'cheque' ? form.bank_name : null,
        transaction_id: ['upi', 'neft'].includes(form.payment_mode) ? form.transaction_id : null,
        remarks: form.remarks,
        created_by: session?.user?.id,
      })

      // Surrender: clear allotment, mark surrendered
      await supabase.from('dcba_locker_seats').update({
        status: 'surrendered',
        surrender_date: form.date,
        refund_amount: amt,
        refund_date: form.date,
        refund_receipt_no: receiptNo,
        allotted_to: null,
        updated_at: new Date().toISOString(),
      }).eq('id', item.id)

      // Clear member's locker/seat reference
      const memberClear = item.item_type === 'locker'
        ? { locker_no: null }
        : { seat_no: null, hall_no: null }
      await supabase.from('dcba_members').update(memberClear).eq('id', item.allotted_to)

      toast.success(`Surrendered! Refund ₹${amt.toLocaleString('en-IN')} recorded. Receipt: ${receiptNo}`)
      onSuccess()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-orange-50">
          <h3 className="text-lg font-semibold">Surrender & Refund — {item.item_no}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-orange-800">⚠️ This will surrender the {item.item_type} and mark it vacant again.</p>
            <p className="text-xs text-orange-600 mt-1">{item.dcba_members?.member_name} ({item.dcba_members?.member_no})</p>
            <p className="text-xs text-orange-600">Deposit paid: ₹{Number(item.security_deposit).toLocaleString('en-IN')}</p>
          </div>

          <div>
            <label className="label">Refund Amount (₹)</label>
            <input type="number" className="input text-lg font-bold" value={form.refund_amount}
              onChange={e => setForm({ ...form, refund_amount: e.target.value })} />
            <p className="text-xs text-gray-400 mt-1">Can be less than deposit (e.g. after deductions)</p>
          </div>

          <div>
            <label className="label">Payment Mode</label>
            <div className="flex gap-2 flex-wrap">
              {['cash', 'cheque', 'upi', 'neft'].map(mode => (
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
              <select className="input" value={form.cash_account_id} onChange={e => setForm({ ...form, cash_account_id: e.target.value })}>
                {cashAccounts.map(c => <option key={c.id} value={c.id}>{c.cashier_name}</option>)}
              </select>
            </div>
          )}

          {form.payment_mode !== 'cash' && bankAccounts.length > 0 && (
            <div>
              <label className="label">Bank Account</label>
              <select className="input" value={form.bank_account_id} onChange={e => setForm({ ...form, bank_account_id: e.target.value })}>
                {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.account_name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Surrender Date</label>
            <input type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          </div>

          {form.payment_mode === 'cheque' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Cheque No.</label>
                <input className="input" value={form.cheque_no} onChange={e => setForm({ ...form, cheque_no: e.target.value })} />
              </div>
              <div>
                <label className="label">Bank Name</label>
                <input className="input" value={form.bank_name} onChange={e => setForm({ ...form, bank_name: e.target.value })} />
              </div>
            </div>
          )}

          {['upi', 'neft'].includes(form.payment_mode) && (
            <div>
              <label className="label">Transaction ID</label>
              <input className="input font-mono" value={form.transaction_id} onChange={e => setForm({ ...form, transaction_id: e.target.value })} />
            </div>
          )}

          <div>
            <label className="label">Remarks</label>
            <input className="input" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Reason for surrender, deductions etc." />
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleRefund} disabled={saving} className="btn-primary bg-orange-600 hover:bg-orange-700">
            {saving ? 'Processing...' : '↩ Surrender & Refund'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- DETAIL VIEW ----
function DetailModal({ item, org, onClose }) {
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchTxns() }, [])

  async function fetchTxns() {
    const { data } = await supabase.from('dcba_deposit_transactions')
      .select('*')
      .eq('locker_seat_id', item.id)
      .order('transaction_date', { ascending: false })
    setTxns(data || [])
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50 flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold">{item.item_type === 'locker' ? '🔒 Locker' : '🪑 Seat'} {item.item_no}</h3>
            {item.hall_no && <p className="text-xs text-gray-500">{item.hall_no}</p>}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Status', item.status],
              ['Allotted To', item.dcba_members?.member_name || '—'],
              ['Member No.', item.dcba_members?.member_no || '—'],
              ['Allotment Date', fmt(item.allotment_date)],
              ['Security Deposit', fmtAmt(item.security_deposit)],
              ['Deposit Paid On', fmt(item.deposit_paid_date)],
              ['Deposit Receipt', item.deposit_receipt_no || '—'],
              ['Surrender Date', fmt(item.surrender_date)],
              ['Refund Amount', item.refund_amount ? fmtAmt(item.refund_amount) : '—'],
              ['Refund Date', fmt(item.refund_date)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-gray-400 font-medium">{label}</p>
                <p className="font-semibold text-gray-800">{value}</p>
              </div>
            ))}
          </div>

          {item.remarks && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400">Remarks</p>
              <p className="text-sm text-gray-700">{item.remarks}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-bold text-gray-700 mb-2">Transaction History</p>
            {loading ? (
              <p className="text-gray-400 text-sm text-center py-4">Loading...</p>
            ) : txns.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No transactions yet</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Type</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-500">Receipt</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.map((t, i) => (
                    <tr key={t.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-3 py-2">{fmt(t.transaction_date)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${t.transaction_type === 'deposit' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {t.transaction_type === 'deposit' ? '↓ Deposit' : '↑ Refund'}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-500">{t.receipt_no || '—'}</td>
                      <td className={`px-3 py-2 text-right font-bold ${t.transaction_type === 'deposit' ? 'text-green-700' : 'text-orange-700'}`}>
                        {fmtAmt(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  )
}

// ---- ALLOTMENT REQUESTS from member portal ----
function AllotmentRequestsModal({ org, onClose }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('all')

  useEffect(() => { fetchRequests() }, [filterType])

  async function fetchRequests() {
    setLoading(true)
    let q = supabase.from('dcba_member_requests')
      .select('*, dcba_members(member_name, member_no, mobile)')
      .eq('org_id', org.id)
      .in('request_type', ['seat_allotment', 'locker_allotment'])
      .order('created_at', { ascending: false })

    if (filterType !== 'all') q = q.eq('status', filterType)

    const { data } = await q
    setRequests(data || [])
    setLoading(false)
  }

  async function updateStatus(id, status) {
    await supabase.from('dcba_member_requests').update({ status, processed_at: new Date().toISOString() }).eq('id', id)
    toast.success(`Request marked as ${status}`)
    fetchRequests()
  }

  const typeLabel = { seat_allotment: '🪑 Seat', locker_allotment: '🔒 Locker' }
  const statusColor = { pending: 'bg-yellow-100 text-yellow-700', approved: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700', completed: 'bg-blue-100 text-blue-700' }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50 flex-shrink-0">
          <h3 className="text-lg font-semibold">Locker / Seat Allotment Requests</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>
        <div className="flex gap-2 px-6 pt-4 flex-shrink-0">
          {['all', 'pending', 'approved', 'rejected', 'completed'].map(s => (
            <button key={s} onClick={() => setFilterType(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors capitalize ${filterType === s ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200'}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {loading ? (
            <p className="text-center text-gray-400 py-8">Loading...</p>
          ) : requests.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No requests found</p>
          ) : requests.map(r => (
            <div key={r.id} className="border border-gray-200 rounded-xl p-4 mb-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-blue-700">{typeLabel[r.request_type]}</span>
                  <p className="font-semibold text-gray-800 mt-0.5">{r.dcba_members?.member_name}</p>
                  <p className="text-xs text-gray-500">{r.dcba_members?.member_no} · {r.dcba_members?.mobile || '—'}</p>
                  {r.preferred_location && <p className="text-xs text-gray-500 mt-1">Preference: {r.preferred_location}</p>}
                  <p className="text-xs text-gray-400 mt-1">{fmt(r.request_date)}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusColor[r.status]}`}>{r.status}</span>
              </div>
              {r.status === 'pending' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => updateStatus(r.id, 'approved')}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg font-semibold">✓ Approve</button>
                  <button onClick={() => updateStatus(r.id, 'rejected')}
                    className="px-3 py-1.5 bg-red-100 text-red-700 text-xs rounded-lg font-semibold">✕ Reject</button>
                  <button onClick={() => updateStatus(r.id, 'completed')}
                    className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs rounded-lg font-semibold">✓✓ Complete</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t flex-shrink-0">
          <button onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  )
}
