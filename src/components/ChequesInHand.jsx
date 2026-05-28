import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { CheckSquare, Clock, XCircle, Search, Landmark, RefreshCw, X } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`
}

// Deposit confirmation modal
function DepositModal({ cheque, bankAccounts, onConfirm, onClose }) {
  const [bankId, setBankId] = useState(bankAccounts[0]?.id || '')
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  async function handleConfirm() {
    if (!bankId) return toast.error('Select bank account')
    setSaving(true)
    await onConfirm(cheque, bankId, depositDate)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b bg-green-50">
          <h3 className="font-semibold text-green-800 flex items-center gap-2">
            <CheckSquare className="w-5 h-5" /> Mark as Deposited
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Cheque info */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Party</span><span className="font-medium">{cheque.party}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Cheque No.</span><span className="font-mono font-semibold text-blue-700">{cheque.cheque_no}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Amount</span><span className="font-bold text-green-700">₹{Number(cheque.amount).toLocaleString('en-IN')}</span></div>
          </div>

          {/* Bank selection */}
          <div>
            <label className="label">Deposited in Bank Account *</label>
            <select className="input" value={bankId} onChange={e => setBankId(e.target.value)}>
              {bankAccounts.map(b => (
                <option key={b.id} value={b.id}>{b.account_name} — {b.bank_name} ({b.account_number})</option>
              ))}
            </select>
          </div>

          {/* Deposit date */}
          <div>
            <label className="label">Deposit Date</label>
            <input type="date" className="input" value={depositDate} onChange={e => setDepositDate(e.target.value)} />
          </div>
        </div>
        <div className="px-5 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleConfirm} disabled={saving} className="btn-success flex items-center gap-2">
            <CheckSquare className="w-4 h-4" />
            {saving ? 'Saving...' : 'Confirm Deposit'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ChequesInHand() {
  const { currentOrg, userRole } = useAuth()
  const [cheques, setCheques] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('pending')
  const [updating, setUpdating] = useState(null)
  const [depositModal, setDepositModal] = useState(null) // cheque being deposited
  const [bankAccounts, setBankAccounts] = useState([])

  const isAdmin = ['admin','cashier'].includes(userRole?.role)

  useEffect(() => { if (currentOrg) { fetchCheques(); fetchBanks() } }, [currentOrg, filterStatus])

  async function fetchBanks() {
    const { data } = await supabase.from('bank_accounts').select('*').eq('org_id', currentOrg.id).eq('is_active', true)
    setBankAccounts(data || [])
  }

  async function fetchCheques() {
    setLoading(true)
    let q = supabase.from('income_entries')
      .select('id, receipt_no, entry_date, amount, cheque_no, cheque_date, cheque_status, description, account_heads(name)')
      .eq('org_id', currentOrg.id)
      .eq('payment_mode', 'cheque')
      .not('cheque_no', 'is', null)

    if (filterStatus !== 'all') q = q.eq('cheque_status', filterStatus)

    let qr = supabase.from('rent_collections')
      .select('id, receipt_no, collection_date, amount, cheque_no, cheque_date, bank_name, cheque_status, vendors(name)')
      .eq('org_id', currentOrg.id)
      .eq('payment_mode', 'cheque')
      .not('cheque_no', 'is', null)

    if (filterStatus !== 'all') qr = qr.eq('cheque_status', filterStatus)

    const [{ data: inc }, { data: rent }] = await Promise.all([q, qr])

    const merged = [
      ...(inc || []).map(c => ({
        id: c.id, source: 'income',
        ref_no: c.receipt_no, date: c.entry_date,
        cheque_date: c.cheque_date, amount: c.amount,
        cheque_no: c.cheque_no, bank_name: null,
        status: c.cheque_status || 'pending',
        party: c.description?.split('—')[1]?.split('|')[0]?.trim() || '—',
        head: c.account_heads?.name || 'Member Fee',
      })),
      ...(rent || []).map(c => ({
        id: c.id, source: 'rent',
        ref_no: c.receipt_no, date: c.collection_date,
        cheque_date: c.cheque_date, amount: c.amount,
        cheque_no: c.cheque_no, bank_name: c.bank_name,
        status: c.cheque_status || 'pending',
        party: c.vendors?.name || '—',
        head: 'Vendor Rent',
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date))

    setCheques(merged)
    setLoading(false)
  }

  async function confirmDeposit(cheque, bankId, depositDate) {
    const table = cheque.source === 'rent' ? 'rent_collections' : 'income_entries'
    const { error } = await supabase.from(table).update({
      cheque_status: 'deposited',
      bank_account_id: bankId,
      collection_date: cheque.source === 'rent' ? depositDate : undefined,
      entry_date: cheque.source === 'income' ? depositDate : undefined,
    }).eq('id', cheque.id)
    if (error) toast.error(error.message)
    else toast.success('Cheque marked as deposited!')
    setDepositModal(null)
    fetchCheques()
  }

  async function markBounced(cheque) {
    const table = cheque.source === 'rent' ? 'rent_collections' : 'income_entries'
    const { error } = await supabase.from(table).update({ cheque_status: 'bounced' }).eq('id', cheque.id)
    if (error) toast.error(error.message)
    else toast.success('Cheque marked as bounced')
    fetchCheques()
  }

  const filtered = cheques.filter(c =>
    !search ||
    (c.cheque_no || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.party || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.ref_no || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPending = cheques.filter(c => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0)

  const badge = (s) => {
    if (s === 'pending') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700"><Clock className="w-3 h-3"/>Pending</span>
    if (s === 'deposited') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700"><CheckSquare className="w-3 h-3"/>Deposited</span>
    if (s === 'bounced') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"><XCircle className="w-3 h-3"/>Bounced</span>
    return <span className="text-xs text-gray-400">{s}</span>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Landmark className="w-6 h-6 text-blue-700" /> Cheques in Hand
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name} — Received cheques pending deposit</p>
        </div>
        <button onClick={fetchCheques} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {totalPending > 0 && (
        <div className="rounded-xl border bg-yellow-50 border-yellow-200 p-4 mb-6 flex items-center gap-4">
          <Clock className="w-8 h-8 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="text-xl font-bold text-yellow-800">₹{totalPending.toLocaleString('en-IN')}</p>
            <p className="text-sm text-yellow-600">Total pending cheques — awaiting deposit</p>
          </div>
        </div>
      )}

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search cheque no., party, receipt..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {['all','pending','deposited','bounced'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border capitalize transition-colors ${filterStatus === s ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>{['Receipt No.','Party','Head','Cheque No.','Bank','Cheque Date','Amount (₹)','Status','Action'].map(h => (
                <th key={h} className="table-header text-left whitespace-nowrap">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="table-cell text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="table-cell text-center py-8 text-gray-400">No cheques found</td></tr>
              ) : filtered.map((c, i) => (
                <tr key={c.id+c.source} className={`${i%2===0?'bg-white':'bg-gray-50/50'} hover:bg-blue-50/20`}>
                  <td className="table-cell text-xs font-mono text-gray-500">{c.ref_no||'—'}</td>
                  <td className="table-cell text-sm font-medium">{c.party}</td>
                  <td className="table-cell text-xs text-gray-500">{c.head}</td>
                  <td className="table-cell text-sm font-mono font-semibold text-blue-700">{c.cheque_no}</td>
                  <td className="table-cell text-xs">{c.bank_name||'—'}</td>
                  <td className="table-cell text-xs">{formatDate(c.cheque_date)}</td>
                  <td className="table-cell text-right font-semibold text-green-700">₹{Number(c.amount).toLocaleString('en-IN')}</td>
                  <td className="table-cell">{badge(c.status)}</td>
                  <td className="table-cell">
                    {isAdmin && c.status === 'pending' && (
                      <div className="flex gap-1">
                        <button onClick={() => setDepositModal(c)}
                          className="px-2 py-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 rounded font-medium">✓ Deposited</button>
                        <button onClick={() => markBounced(c)}
                          className="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded font-medium">✗ Bounced</button>
                      </div>
                    )}
                    {c.status !== 'pending' && <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">{filtered.length} cheques shown</div>
      </div>

      {/* Deposit Modal */}
      {depositModal && (
        <DepositModal
          cheque={depositModal}
          bankAccounts={bankAccounts}
          onConfirm={confirmDeposit}
          onClose={() => setDepositModal(null)}
        />
      )}
    </div>
  )
}
