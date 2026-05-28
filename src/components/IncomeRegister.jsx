import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { Receipt, Plus, Search, TrendingUp, IndianRupee, XCircle, AlertTriangle } from 'lucide-react'
import CashEntryModal from './cashbank/CashEntryModal'
import BankEntryModal from './cashbank/BankEntryModal'
import VoucherPrint from './cashbank/VoucherPrint'
import CancelEditModal from './shared/CancelEditModal'
import { canCancel, logAudit } from '../utils/auditUtils'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()

export default function IncomeRegister() {
  const { currentOrg, userRole } = useAuth()
  const [entries, setEntries] = useState([])
  const [rentCollections, setRentCollections] = useState([])
  const [heads, setHeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)
  const [filterHead, setFilterHead] = useState('all')
  const [search, setSearch] = useState('')
  const [showEntry, setShowEntry] = useState(null)
  const [printVoucher, setPrintVoucher] = useState(null)
  const [cashAccounts, setCashAccounts] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [cancelModal, setCancelModal] = useState(null) // {entry, type}

  const role = userRole?.role || 'cashier'
  const canAdd = ['admin','cashier','supervisor','accountant'].includes(role)

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
    const [{ data: inc }, { data: rent }, { data: h }] = await Promise.all([
      supabase.from('income_entries')
        .select('*, account_heads(name), account_sub_heads(name), cash_accounts(cashier_name), bank_accounts(account_name)')
        .eq('org_id', currentOrg.id)
        .gte('entry_date', startDate).lte('entry_date', endDate)
        .order('entry_date'),
      supabase.from('rent_collections')
        .select('*, vendors(name, vendor_categories(name)), cash_accounts(cashier_name), bank_accounts(account_name)')
        .eq('org_id', currentOrg.id)
        .gte('collection_date', startDate).lte('collection_date', endDate)
        .order('collection_date'),
      supabase.from('account_heads').select('*').eq('org_id', currentOrg.id).eq('type', 'income').eq('is_active', true).order('sort_order'),
    ])
    setEntries(inc || [])
    setRentCollections(rent || [])
    setHeads(h || [])
    setLoading(false)
  }

  async function handleCancel(reason) {
    const { entry, type } = cancelModal
    const table = type === 'rent' ? 'rent_collections' : 'income_entries'
    const idField = 'id'

    const { data: session } = await supabase.auth.getSession()
    const userId = session?.session?.user?.id

    const { error } = await supabase.from(table).update({
      is_cancelled: true,
      cancelled_by: userId,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    }).eq(idField, entry.id)

    if (error) { toast.error(error.message); return }

    await logAudit({
      orgId: currentOrg.id,
      tableName: table,
      recordId: entry.id,
      action: 'cancel',
      oldData: entry.raw,
      reason,
      userId,
      userName: userRole?.name,
      userRole: role,
    })

    toast.success('Entry cancelled successfully')
    setCancelModal(null)
    fetchData()
  }

  const allIncome = [
    ...(rentCollections.filter(r => !r.is_cancelled).map(r => ({
      id: r.id, date: r.collection_date, ref_no: r.receipt_no,
      head: 'Vendor Rent Income',
      sub_head: r.vendors?.vendor_categories?.name || '',
      description: `Rent from ${r.vendors?.name} (${r.months_covered})`,
      amount: r.amount, mode: r.payment_mode,
      account: r.cash_accounts?.cashier_name || r.bank_accounts?.account_name || '',
      type: 'rent', raw: r, is_cancelled: r.is_cancelled,
      created_at: r.created_at,
    }))),
    ...(entries.filter(e => !e.is_cancelled).map(e => ({
      id: e.id, date: e.entry_date, ref_no: e.receipt_no,
      head: e.account_heads?.name || '',
      sub_head: e.account_sub_heads?.name || '',
      description: e.description || '', amount: e.amount, mode: e.payment_mode,
      account: e.cash_accounts?.cashier_name || e.bank_accounts?.account_name || '',
      type: 'income', raw: e, is_cancelled: e.is_cancelled,
      created_at: e.created_at,
    }))),
  ].sort((a, b) => new Date(a.date) - new Date(b.date))

  const filtered = allIncome.filter(e => {
    const matchHead = filterHead === 'all' || e.head === filterHead
    const matchSearch = !search || e.description.toLowerCase().includes(search.toLowerCase()) || (e.ref_no || '').toLowerCase().includes(search.toLowerCase())
    return matchHead && matchSearch
  })

  const totalIncome = filtered.reduce((s, e) => s + Number(e.amount), 0)

  const summary = {}
  filtered.forEach(e => {
    const key = e.head + (e.sub_head ? ` — ${e.sub_head}` : '')
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
            <TrendingUp className="w-6 h-6 text-green-600" /> Income Register
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name} — {MONTHS[filterMonth - 1]} {filterYear}</p>
        </div>
        {canAdd && (
          <div className="flex gap-2">
            <button onClick={() => setShowEntry('cash')} className="btn-success flex items-center gap-2">
              <Plus className="w-4 h-4" /> Cash Receipt
            </button>
            <button onClick={() => setShowEntry('bank')} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Bank Receipt
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="col-span-2 lg:col-span-1 rounded-xl border bg-green-50 border-green-200 p-4">
          <IndianRupee className="w-5 h-5 text-green-600 mb-1" />
          <p className="text-2xl font-bold text-green-700">₹{totalIncome.toLocaleString('en-IN')}</p>
          <p className="text-xs font-medium text-green-600">Total Income</p>
          <p className="text-xs text-green-500">{MONTHS[filterMonth - 1]} {filterYear}</p>
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
            <input className="input pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-auto" value={filterHead} onChange={e => setFilterHead(e.target.value)}>
            <option value="all">All Heads</option>
            <option value="Vendor Rent Income">Vendor Rent Income</option>
            {heads.map(h => <option key={h.id} value={h.name}>{h.name}</option>)}
          </select>
          <select className="input w-auto" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="input w-auto" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Date','Receipt No.','Head','Description','Mode','Account','Amount (₹)','Action'].map(h => (
                  <th key={h} className="table-header text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="table-cell text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="table-cell text-center py-8 text-gray-400">No income entries for this period</td></tr>
              ) : (
                <>
                  {filtered.map((e, i) => {
                    const cancelAllowed = canCancel(e.raw, role, 'receipt')
                    return (
                      <tr key={e.id + e.type} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-green-50/20 ${e.is_cancelled ? 'opacity-50' : ''}`}>
                        <td className="table-cell text-xs whitespace-nowrap">{formatDate(e.date)}</td>
                        <td className="table-cell text-xs font-mono text-gray-500">{e.ref_no || '—'}</td>
                        <td className="table-cell text-xs">
                          <div className="font-medium">{e.head}</div>
                          {e.sub_head && <div className="text-gray-400">{e.sub_head}</div>}
                        </td>
                        <td className="table-cell text-sm max-w-xs truncate">{e.description || '—'}</td>
                        <td className="table-cell text-xs capitalize">{e.mode}</td>
                        <td className="table-cell text-xs text-gray-500">{e.account}</td>
                        <td className="table-cell text-right font-semibold text-green-700">
                          ₹{Number(e.amount).toLocaleString('en-IN')}
                        </td>
                        <td className="table-cell">
                          {cancelAllowed && (
                            <button onClick={() => setCancelModal({ entry: e, type: e.type })}
                              className="px-2 py-1 text-xs bg-red-100 text-red-700 hover:bg-red-200 rounded font-medium flex items-center gap-1">
                              <XCircle className="w-3 h-3" /> Cancel
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="bg-green-900 text-white font-semibold">
                    <td className="px-4 py-2 text-sm" colSpan={7}>Total Income — {MONTHS[filterMonth - 1]} {filterYear}</td>
                    <td className="px-4 py-2 text-right text-sm">₹{totalIncome.toLocaleString('en-IN')}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showEntry === 'cash' && (
        <CashEntryModal type="receipt" org={currentOrg} userRole={userRole} cashAccounts={cashAccounts}
          onClose={() => setShowEntry(null)}
          onSuccess={(v) => { setShowEntry(null); fetchData(); if (v) setPrintVoucher(v) }} />
      )}
      {showEntry === 'bank' && (
        <BankEntryModal type="receipt" org={currentOrg} userRole={userRole} bankAccounts={bankAccounts} cashAccounts={cashAccounts}
          onClose={() => setShowEntry(null)}
          onSuccess={(v) => { setShowEntry(null); fetchData(); if (v) setPrintVoucher(v) }} />
      )}
      {printVoucher && (
        <VoucherPrint voucher={printVoucher} org={currentOrg} onClose={() => setPrintVoucher(null)} />
      )}
      {cancelModal && (
        <CancelEditModal
          mode="cancel"
          entry={cancelModal.entry}
          onConfirm={handleCancel}
          onClose={() => setCancelModal(null)}
        />
      )}
    </div>
  )
}
