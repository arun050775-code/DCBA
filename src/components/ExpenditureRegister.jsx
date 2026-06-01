import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { Wallet, Plus, Search, TrendingDown, IndianRupee, CheckCircle, Clock, Tag } from 'lucide-react'
import CashEntryModal from './cashbank/CashEntryModal'
import BankEntryModal from './cashbank/BankEntryModal'
import VoucherPrint from './cashbank/VoucherPrint'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()

export default function ExpenditureRegister() {
  const { currentOrg, userRole } = useAuth()
  const [entries, setEntries] = useState([])
  const [heads, setHeads] = useState([])
  const [subHeads, setSubHeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)
  const [filterHead, setFilterHead] = useState('all')
  const [filterPosted, setFilterPosted] = useState('all') // 'all' | 'unposted' | 'posted'
  const [search, setSearch] = useState('')
  const [showEntry, setShowEntry] = useState(null)
  const [printVoucher, setPrintVoucher] = useState(null)
  const [postModal, setPostModal] = useState(null)
  const [cashAccounts, setCashAccounts] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])

  const role = userRole?.role
  const isAccountant = ['admin', 'accountant'].includes(role)
  const canAddEntry = ['admin', 'supervisor', 'cashier', 'accountant'].includes(role)

  useEffect(() => { if (currentOrg) { fetchData(); fetchAccounts() } }, [currentOrg, filterMonth, filterYear])

  async function fetchAccounts() {
    const [{ data: cash }, { data: bank }] = await Promise.all([
      supabase.from('cash_accounts').select('*').eq('org_id', currentOrg.id).eq('is_active', true),
      supabase.from('bank_accounts').select('*').eq('org_id', currentOrg.id).eq('is_active', true),
    ])
    setCashAccounts(cash || [])
    setBankAccounts(bank || [])
  }

  async function fetchData() {
    setLoading(true)
    const startDate = `${filterYear}-${String(filterMonth).padStart(2,'0')}-01`
    const endDate = new Date(filterYear, filterMonth, 0).toISOString().split('T')[0]

    const [{ data: exp }, { data: h }, { data: sh }] = await Promise.all([
      supabase.from('expenditure_entries')
        .select('*, account_heads(name), account_sub_heads(name), cash_accounts(cashier_name), bank_accounts(account_name)')
        .eq('org_id', currentOrg.id)
        .gte('entry_date', startDate).lte('entry_date', endDate)
        .order('entry_date'),
      supabase.from('account_heads').select('*').eq('org_id', currentOrg.id).eq('type', 'expenditure').eq('is_active', true).order('sort_order'),
      supabase.from('account_sub_heads').select('*').eq('org_id', currentOrg.id).eq('is_active', true).order('name'),
    ])

    setEntries(exp || [])
    setHeads(h || [])
    setSubHeads(sh || [])
    setLoading(false)
  }

  const filtered = entries.filter(e => {
    const matchHead = filterHead === 'all' || e.account_heads?.name === filterHead
    const matchPosted = filterPosted === 'all' || 
      (filterPosted === 'posted' ? e.is_posted : !e.is_posted)
    const matchSearch = !search ||
      (e.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.payee_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.voucher_no || '').toLowerCase().includes(search.toLowerCase())
    return matchHead && matchPosted && matchSearch
  })

  const totalExp = filtered.reduce((s, e) => s + Number(e.amount), 0)
  const unpostedCount = entries.filter(e => !e.is_posted).length
  const unpostedAmt = entries.filter(e => !e.is_posted).reduce((s, e) => s + Number(e.amount), 0)

  const summary = {}
  filtered.forEach(e => {
    const key = e.account_heads?.name || 'Uncategorised'
    summary[key] = (summary[key] || 0) + Number(e.amount)
  })

  function formatDate(d) {
    if (!d) return '—'
    const dt = new Date(d)
    return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Wallet className="w-6 h-6 text-red-600" /> Expenditure Register
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name} — {MONTHS[filterMonth - 1]} {filterYear}</p>
        </div>
        {canAddEntry && (
          <div className="flex gap-2">
            <button onClick={() => setShowEntry('cash')} className="btn-danger flex items-center gap-2">
              <Plus className="w-4 h-4" /> Cash Payment
            </button>
            <button onClick={() => setShowEntry('bank')} className="btn-secondary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Bank Payment
            </button>
          </div>
        )}
      </div>

      {/* Unposted alert for accountant */}
      {isAccountant && unpostedCount > 0 && (
        <div className="bg-orange-50 border border-orange-300 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-orange-600" />
            <div>
              <p className="font-semibold text-orange-800">{unpostedCount} entries pending account head allocation</p>
              <p className="text-xs text-orange-600">Total unposted: ₹{unpostedAmt.toLocaleString('en-IN')}</p>
            </div>
          </div>
          <button onClick={() => setFilterPosted('unposted')}
            className="px-3 py-1.5 bg-orange-600 text-white text-sm rounded-lg font-medium">
            View Unposted →
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="col-span-2 lg:col-span-1 rounded-xl border bg-red-50 border-red-200 p-4">
          <IndianRupee className="w-5 h-5 text-red-600 mb-1" />
          <p className="text-2xl font-bold text-red-700">₹{totalExp.toLocaleString('en-IN')}</p>
          <p className="text-xs font-medium text-red-600">Total Expenditure</p>
          <p className="text-xs text-red-400">{MONTHS[filterMonth - 1]} {filterYear}</p>
        </div>
        {Object.entries(summary).slice(0, 3).map(([key, val]) => (
          <div key={key} className="rounded-xl border bg-white border-gray-200 p-4">
            <p className="text-lg font-bold text-gray-800">₹{Number(val).toLocaleString('en-IN')}</p>
            <p className="text-xs font-medium text-gray-600 mt-1 truncate">{key}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search payee, description..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-auto" value={filterHead} onChange={e => setFilterHead(e.target.value)}>
            <option value="all">All Heads</option>
            {heads.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
          </select>
          {/* Posted filter — accountant only */}
          {isAccountant && (
            <div className="flex gap-1">
              {[{id:'all',label:'All'},{id:'unposted',label:'⏳ Unposted'},{id:'posted',label:'✅ Posted'}].map(f => (
                <button key={f.id} onClick={() => setFilterPosted(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${filterPosted === f.id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
          <select className="input w-auto" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="input w-auto" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Expenditure Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Date', 'Voucher No.', 'Head / Sub-Head', 'Payee', 'Description', 'Mode', 'Cheque No.', 'Amount (₹)', isAccountant ? 'Post' : ''].filter(Boolean).map(h => (
                  <th key={h} className="table-header text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="table-cell text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="table-cell text-center py-8 text-gray-400">No expenditure entries for this period</td></tr>
              ) : (
                <>
                  {filtered.map((e, i) => (
                    <tr key={e.id} className={`${!e.is_posted ? 'bg-orange-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-red-50/20`}>
                      <td className="table-cell text-xs whitespace-nowrap">{formatDate(e.entry_date)}</td>
                      <td className="table-cell text-xs font-mono text-gray-500">{e.voucher_no || '—'}</td>
                      <td className="table-cell text-xs">
                        {e.is_posted ? (
                          <>
                            <div className="font-medium">{e.account_heads?.name || '—'}</div>
                            {e.account_sub_heads?.name && <div className="text-gray-400">{e.account_sub_heads.name}</div>}
                          </>
                        ) : (
                          <span className="text-orange-500 text-xs font-medium">⏳ Not posted</span>
                        )}
                      </td>
                      <td className="table-cell text-sm">{e.payee_name || '—'}</td>
                      <td className="table-cell text-sm max-w-xs truncate">{e.description || '—'}</td>
                      <td className="table-cell text-xs capitalize">{e.payment_mode}</td>
                      <td className="table-cell text-xs font-mono">{e.cheque_no || '—'}</td>
                      <td className="table-cell text-right font-semibold text-red-600">
                        ₹{Number(e.amount).toLocaleString('en-IN')}
                      </td>
                      {isAccountant && (
                        <td className="table-cell">
                          {!e.is_posted ? (
                            <button onClick={() => setPostModal(e)}
                              className="px-2 py-1 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded text-xs font-semibold flex items-center gap-1">
                              <Tag className="w-3 h-3" /> Post
                            </button>
                          ) : (
                            <span className="text-xs text-green-600 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Posted
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  <tr className="bg-red-900 text-white font-semibold">
                    <td className="px-4 py-2 text-sm" colSpan={isAccountant ? 8 : 7}>Total Expenditure — {MONTHS[filterMonth - 1]} {filterYear}</td>
                    <td className="px-4 py-2 text-right text-sm">₹{totalExp.toLocaleString('en-IN')}</td>
                    {isAccountant && <td></td>}
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showEntry === 'cash' && (
        <CashEntryModal type="payment" org={currentOrg} userRole={userRole} cashAccounts={cashAccounts}
          onClose={() => setShowEntry(null)}
          onSuccess={(v) => { setShowEntry(null); fetchData(); if (v) setPrintVoucher(v) }} />
      )}
      {showEntry === 'bank' && (
        <BankEntryModal type="payment" org={currentOrg} userRole={userRole} bankAccounts={bankAccounts} cashAccounts={cashAccounts}
          onClose={() => setShowEntry(null)}
          onSuccess={(v) => { setShowEntry(null); fetchData(); if (v) setPrintVoucher(v) }} />
      )}
      {printVoucher && (
        <VoucherPrint voucher={printVoucher} org={currentOrg} onClose={() => setPrintVoucher(null)} />
      )}
      {postModal && (
        <PostEntryModal
          entry={postModal}
          heads={heads}
          subHeads={subHeads}
          onClose={() => setPostModal(null)}
          onSuccess={() => { setPostModal(null); fetchData() }}
        />
      )}
    </div>
  )
}

// ---- POST ENTRY MODAL (Accountant) ----
function PostEntryModal({ entry, heads, subHeads, onClose, onSuccess }) {
  const [form, setForm] = useState({
    head_id: '',
    sub_head_id: '',
  })
  const [saving, setSaving] = useState(false)

  // Filter sub heads by selected head
  const filteredSubHeads = subHeads.filter(s => s.head_id === form.head_id)

  function formatDate(d) {
    if (!d) return '—'
    const dt = new Date(d)
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${String(dt.getDate()).padStart(2,'0')}-${m[dt.getMonth()]}-${dt.getFullYear()}`
  }

  async function handlePost() {
    if (!form.head_id) return toast.error('Please select an account head')
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { error } = await supabase.from('expenditure_entries').update({
        head_id: form.head_id,
        sub_head_id: form.sub_head_id || null,
        is_posted: true,
        posted_by: session?.user?.id,
        posted_at: new Date().toISOString(),
      }).eq('id', entry.id)
      if (error) throw error
      toast.success('Entry posted successfully!')
      onSuccess()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-orange-50">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Tag className="w-5 h-5 text-orange-600" /> Post Entry — Assign Account Head
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Entry details */}
          <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-gray-400">Date</p>
              <p className="font-semibold">{formatDate(entry.entry_date)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Voucher No.</p>
              <p className="font-mono text-sm">{entry.voucher_no || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Payee</p>
              <p className="font-semibold">{entry.payee_name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Amount</p>
              <p className="font-bold text-red-600">₹{Number(entry.amount).toLocaleString('en-IN')}</p>
            </div>
            {entry.description && (
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Description</p>
                <p className="text-sm text-gray-700">{entry.description}</p>
              </div>
            )}
          </div>

          {/* Head selection */}
          <div>
            <label className="label">Account Head *</label>
            <select className="input" value={form.head_id}
              onChange={e => setForm({ head_id: e.target.value, sub_head_id: '' })}>
              <option value="">— Select Head —</option>
              {heads.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>

          {/* Sub Head selection */}
          <div>
            <label className="label">Sub Head <span className="text-gray-400 font-normal">(optional)</span></label>
            <select className="input" value={form.sub_head_id}
              onChange={e => setForm({ ...form, sub_head_id: e.target.value })}
              disabled={!form.head_id || filteredSubHeads.length === 0}>
              <option value="">— Select Sub Head —</option>
              {filteredSubHeads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {form.head_id && filteredSubHeads.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">No sub heads for this head</p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handlePost} disabled={saving || !form.head_id}
            className="btn-primary bg-orange-600 hover:bg-orange-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {saving ? 'Posting...' : 'Post Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}
