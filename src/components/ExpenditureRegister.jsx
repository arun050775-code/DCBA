import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { Wallet, Plus, Search, TrendingDown, IndianRupee } from 'lucide-react'
import CashEntryModal from './cashbank/CashEntryModal'
import BankEntryModal from './cashbank/BankEntryModal'
import VoucherPrint from './cashbank/VoucherPrint'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()

export default function ExpenditureRegister() {
  const { currentOrg, userRole } = useAuth()
  const [entries, setEntries] = useState([])
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

  const role = userRole?.role
  const isCashier = role && ['admin','supervisor','accountant'].includes(role)

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

    const [{ data: exp }, { data: h }] = await Promise.all([
      supabase.from('expenditure_entries')
        .select('*, account_heads(name), account_sub_heads(name), cash_accounts(cashier_name), bank_accounts(account_name)')
        .eq('org_id', currentOrg.id)
        .gte('entry_date', startDate).lte('entry_date', endDate)
        .order('entry_date'),
      supabase.from('account_heads').select('*').eq('org_id', currentOrg.id).eq('type', 'expenditure').eq('is_active', true).order('sort_order'),
    ])

    setEntries(exp || [])
    setHeads(h || [])
    setLoading(false)
  }

  const filtered = entries.filter(e => {
    const matchHead = filterHead === 'all' || e.account_heads?.name === filterHead
    const matchSearch = !search ||
      (e.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.payee_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.voucher_no || '').toLowerCase().includes(search.toLowerCase())
    return matchHead && matchSearch
  })

  const totalExp = filtered.reduce((s, e) => s + Number(e.amount), 0)

  // Head-wise summary
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
        {isCashier && (
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
                {['Date', 'Voucher No.', 'Head / Sub-Head', 'Payee', 'Description', 'Mode', 'Cheque No.', 'Amount (₹)'].map(h => (
                  <th key={h} className="table-header text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="table-cell text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="table-cell text-center py-8 text-gray-400">No expenditure entries for this period</td></tr>
              ) : (
                <>
                  {filtered.map((e, i) => (
                    <tr key={e.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-red-50/20`}>
                      <td className="table-cell text-xs whitespace-nowrap">{formatDate(e.entry_date)}</td>
                      <td className="table-cell text-xs font-mono text-gray-500">{e.voucher_no || '—'}</td>
                      <td className="table-cell text-xs">
                        <div className="font-medium">{e.account_heads?.name}</div>
                        {e.account_sub_heads?.name && <div className="text-gray-400">{e.account_sub_heads.name}</div>}
                      </td>
                      <td className="table-cell text-sm">{e.payee_name || '—'}</td>
                      <td className="table-cell text-sm max-w-xs truncate">{e.description || '—'}</td>
                      <td className="table-cell text-xs capitalize">{e.payment_mode}</td>
                      <td className="table-cell text-xs font-mono">{e.cheque_no || '—'}</td>
                      <td className="table-cell text-right font-semibold text-red-600">
                        ₹{Number(e.amount).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-red-900 text-white font-semibold">
                    <td className="px-4 py-2 text-sm" colSpan={7}>Total Expenditure — {MONTHS[filterMonth - 1]} {filterYear}</td>
                    <td className="px-4 py-2 text-right text-sm">₹{totalExp.toLocaleString('en-IN')}</td>
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
    </div>
  )
}
