import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import {
  Landmark, TrendingUp, TrendingDown, Wallet, CreditCard,
  IndianRupee, Printer, X
} from 'lucide-react'
import VoucherPrint from './cashbank/VoucherPrint'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function CashBank() {
  const { currentOrg, userRole } = useAuth()
  const [activeTab, setActiveTab] = useState('cash')
  const [cashAccounts, setCashAccounts] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [heads, setHeads] = useState([])
  const [subHeads, setSubHeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEntryModal, setShowEntryModal] = useState(null)
  const [printVoucher, setPrintVoucher] = useState(null)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)

  const isCashier = ['admin', 'cashier'].includes(userRole?.role)

  useEffect(() => { if (currentOrg) fetchAccounts() }, [currentOrg])
  useEffect(() => { if (selectedAccount) fetchTransactions() }, [selectedAccount, filterMonth, filterYear])

  async function fetchAccounts() {
    setLoading(true)
    const [{ data: cash }, { data: bank }, { data: h }, { data: s }] = await Promise.all([
      supabase.from('cash_accounts').select('*').eq('org_id', currentOrg.id).eq('is_active', true),
      supabase.from('bank_accounts').select('*').eq('org_id', currentOrg.id).eq('is_active', true),
      supabase.from('account_heads').select('*').eq('org_id', currentOrg.id).eq('is_active', true),
      supabase.from('account_sub_heads').select('*').eq('org_id', currentOrg.id).eq('is_active', true),
    ])
    setCashAccounts(cash || [])
    setBankAccounts(bank || [])
    setHeads(h || [])
    setSubHeads(s || [])
    if (cash && cash.length > 0) setSelectedAccount({ ...cash[0], type: 'cash' })
    setLoading(false)
  }

  async function fetchTransactions() {
    const startDate = `${filterYear}-${String(filterMonth).padStart(2,'0')}-01`
    const endDate = new Date(filterYear, filterMonth, 0).toISOString().split('T')[0]
    const idField = selectedAccount.type === 'cash' ? 'cash_account_id' : 'bank_account_id'

    const [{ data: rentRcpts }, { data: incRcpts }, { data: pmts }] = await Promise.all([
      supabase.from('rent_collections').select('*, vendors(name)').eq(idField, selectedAccount.id).gte('collection_date', startDate).lte('collection_date', endDate).order('collection_date'),
      supabase.from('income_entries').select('*, account_heads(name), account_sub_heads(name)').eq(idField, selectedAccount.id).gte('entry_date', startDate).lte('entry_date', endDate).order('entry_date'),
      supabase.from('expenditure_entries').select('*, account_heads(name), account_sub_heads(name)').eq(idField, selectedAccount.id).gte('entry_date', startDate).lte('entry_date', endDate).order('entry_date'),
    ])

    const receipts = [
      ...(rentRcpts || []).map(r => ({ ...r, txn_type: 'receipt', date: r.collection_date, description: `Rent — ${r.vendors?.name}`, ref_no: r.receipt_no })),
      ...(incRcpts || []).map(r => ({ ...r, txn_type: 'receipt', date: r.entry_date, description: `${r.account_heads?.name}${r.account_sub_heads ? ' — ' + r.account_sub_heads.name : ''}${r.description ? ': ' + r.description : ''}`, ref_no: r.receipt_no })),
    ]
    const payments = (pmts || []).map(p => ({ ...p, txn_type: 'payment', date: p.entry_date, description: `${p.account_heads?.name}${p.account_sub_heads ? ' — ' + p.account_sub_heads.name : ''}${p.description ? ': ' + p.description : ''}`, ref_no: p.voucher_no }))

    setTransactions([...receipts, ...payments].sort((a, b) => new Date(a.date) - new Date(b.date)))
  }

  function switchTab(tab) {
    setActiveTab(tab)
    const accs = tab === 'cash' ? cashAccounts : bankAccounts
    if (accs.length > 0) setSelectedAccount({ ...accs[0], type: tab })
  }

  const totalReceipts = transactions.filter(t => t.txn_type === 'receipt').reduce((s, t) => s + Number(t.amount), 0)
  const totalPayments = transactions.filter(t => t.txn_type === 'payment').reduce((s, t) => s + Number(t.amount), 0)
  const openingBal = selectedAccount?.opening_balance || 0
  const closingBalance = openingBal + totalReceipts - totalPayments

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Landmark className="w-6 h-6 text-blue-700" /> Cash & Bank Books
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
        </div>
        {isCashier && (
          <div className="flex gap-2">
            <button onClick={() => setShowEntryModal('receipt')} className="btn-success flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Receipt Entry
            </button>
            <button onClick={() => setShowEntryModal('payment')} className="btn-danger flex items-center gap-2">
              <TrendingDown className="w-4 h-4" /> Payment Voucher
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[{key:'cash', label:'Cash Book', icon:Wallet}, {key:'bank', label:'Bank Book', icon:CreditCard}].map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => switchTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key ? 'bg-blue-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex gap-4">
        {/* Account Selector */}
        <div className="w-52 flex-shrink-0 space-y-2">
          {(activeTab === 'cash' ? cashAccounts : bankAccounts).map(acc => (
            <button key={acc.id} onClick={() => setSelectedAccount({ ...acc, type: activeTab })}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedAccount?.id === acc.id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white border-gray-200 text-gray-700 hover:bg-blue-50'}`}>
              <p className="font-semibold text-sm">{activeTab === 'cash' ? acc.cashier_name : acc.account_name}</p>
              {activeTab === 'bank' && <p className="text-xs mt-0.5 opacity-75">{acc.account_number}</p>}
            </button>
          ))}
        </div>

        {/* Ledger */}
        <div className="flex-1">
          {/* Month filter */}
          <div className="flex items-center gap-3 mb-4">
            <select className="input w-auto" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
            </select>
            <select className="input w-24" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
              {[CURRENT_YEAR-1, CURRENT_YEAR, CURRENT_YEAR+1].map(y => <option key={y}>{y}</option>)}
            </select>
            <button onClick={fetchTransactions} className="btn-secondary text-sm px-3 py-2">↻ Refresh</button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Opening Balance', value: openingBal, color: 'blue' },
              { label: 'Total Receipts', value: totalReceipts, color: 'green' },
              { label: 'Total Payments', value: totalPayments, color: 'red' },
              { label: 'Closing Balance', value: closingBalance, color: closingBalance >= 0 ? 'blue' : 'red' },
            ].map(s => {
              const colors = { green:'bg-green-50 border-green-200 text-green-700', red:'bg-red-50 border-red-200 text-red-700', blue:'bg-blue-50 border-blue-200 text-blue-700' }
              return (
                <div key={s.label} className={`rounded-xl border p-3 ${colors[s.color]}`}>
                  <p className="text-base font-bold">₹{Math.abs(s.value).toLocaleString('en-IN')}</p>
                  <p className="text-xs font-medium opacity-80 mt-0.5">{s.label}</p>
                </div>
              )
            })}
          </div>

          {/* Table */}
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr>
                  {['Date','Description','Ref No.','Mode','Receipts (₹)','Payments (₹)',''].map(h => (
                    <th key={h} className="table-header text-left text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={7} className="table-cell text-center py-10 text-gray-400">No transactions for this period</td></tr>
                ) : transactions.map((txn, i) => (
                  <tr key={txn.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/20`}>
                    <td className="table-cell text-xs whitespace-nowrap">{formatDate(txn.date)}</td>
                    <td className="table-cell text-xs max-w-xs">{txn.description}</td>
                    <td className="table-cell text-xs font-mono text-gray-500">{txn.ref_no || '—'}</td>
                    <td className="table-cell text-xs capitalize">{txn.payment_mode || '—'}</td>
                    <td className="table-cell text-right text-sm font-semibold text-green-700">
                      {txn.txn_type === 'receipt' ? `₹${Number(txn.amount).toLocaleString('en-IN')}` : ''}
                    </td>
                    <td className="table-cell text-right text-sm font-semibold text-red-600">
                      {txn.txn_type === 'payment' ? `₹${Number(txn.amount).toLocaleString('en-IN')}` : ''}
                    </td>
                    <td className="table-cell">
                      {txn.txn_type === 'payment' && (
                        <button onClick={() => setPrintVoucher(txn)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Print Voucher">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {transactions.length > 0 && (
                  <tr className="bg-blue-900 text-white">
                    <td className="px-4 py-2.5 text-xs font-bold" colSpan={4}>CLOSING BALANCE</td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold">₹{totalReceipts.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold">₹{totalPayments.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-bold">₹{closingBalance.toLocaleString('en-IN')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showEntryModal && (
        <EntryModal
          type={showEntryModal}
          org={currentOrg}
          userRole={userRole}
          cashAccounts={cashAccounts}
          bankAccounts={bankAccounts}
          heads={heads}
          subHeads={subHeads}
          onClose={() => setShowEntryModal(null)}
          onSuccess={(voucher) => { setShowEntryModal(null); fetchTransactions(); if (voucher) setPrintVoucher(voucher) }}
        />
      )}

      {printVoucher && (
        <VoucherPrint voucher={printVoucher} org={currentOrg} userRole={userRole} onClose={() => setPrintVoucher(null)} />
      )}
    </div>
  )
}

function EntryModal({ type, org, userRole, cashAccounts, bankAccounts, heads, subHeads, onClose, onSuccess }) {
  const isPayment = type === 'payment'
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    head_id: '', sub_head_id: '', description: '', amount: '',
    payment_mode: 'cash', payee_name: '', cheque_no: '', remarks: '',
  })
  const [accountType, setAccountType] = useState('cash')
  const [accountId, setAccountId] = useState(cashAccounts[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const [refNo, setRefNo] = useState('')

  useEffect(() => { generateRefNo() }, [])

  async function generateRefNo() {
    const fy = new Date().getMonth() >= 3
      ? `${new Date().getFullYear()}-${String(new Date().getFullYear()+1).slice(2)}`
      : `${new Date().getFullYear()-1}-${String(new Date().getFullYear()).slice(2)}`
    const table = isPayment ? 'expenditure_entries' : 'income_entries'
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('org_id', org.id)
    const prefix = isPayment ? 'VCH' : 'RCP'
    setRefNo(`${org.short_name}/${prefix}/${fy}/${String((count||0)+1).padStart(4,'0')}`)
  }

  const filteredSubHeads = subHeads.filter(s => s.head_id === form.head_id)
  const relevantHeads = heads.filter(h => h.type === (isPayment ? 'expenditure' : 'income'))

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter amount')
    if (!form.head_id) return toast.error('Select account head')
    setSaving(true)
    try {
      const payload = {
        org_id: org.id, entry_date: form.entry_date,
        head_id: form.head_id || null, sub_head_id: form.sub_head_id || null,
        description: form.description, amount: Number(form.amount),
        payment_mode: form.payment_mode, remarks: form.remarks,
        cash_account_id: accountType === 'cash' ? accountId : null,
        bank_account_id: accountType === 'bank' ? accountId : null,
      }
      if (isPayment) {
        payload.voucher_no = refNo
        payload.payee_name = form.payee_name
        payload.cheque_no = form.cheque_no
        const { data, error } = await supabase.from('expenditure_entries').insert(payload).select().single()
        if (error) throw error
        toast.success('Payment voucher saved!')
        onSuccess({ ...data, ...form, voucher_no: refNo, txn_type: 'payment' })
      } else {
        payload.receipt_no = refNo
        const { error } = await supabase.from('income_entries').insert(payload)
        if (error) throw error
        toast.success('Receipt entry saved!')
        onSuccess(null)
      }
    } catch(err) { toast.error(err.message) }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isPayment ? 'bg-red-50' : 'bg-green-50'}`}>
          <div>
            <h3 className="text-lg font-semibold">{isPayment ? '💸 Payment Voucher' : '✅ Receipt Entry'}</h3>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{refNo}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="label">Date *</label>
            <input type="date" className="input" value={form.entry_date} onChange={e => setForm({...form, entry_date: e.target.value})} />
          </div>
          <div>
            <label className="label">{isPayment ? 'Expenditure Head' : 'Income Head'} *</label>
            <select className="input" value={form.head_id} onChange={e => setForm({...form, head_id: e.target.value, sub_head_id: ''})}>
              <option value="">— Select Head —</option>
              {relevantHeads.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          {filteredSubHeads.length > 0 && (
            <div>
              <label className="label">Sub-Head</label>
              <select className="input" value={form.sub_head_id} onChange={e => setForm({...form, sub_head_id: e.target.value})}>
                <option value="">— Select Sub-Head —</option>
                {filteredSubHeads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Narration / Description</label>
            <input className="input" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="e.g. Salary for March 2026" />
          </div>
          {isPayment && (
            <div>
              <label className="label">Paid To</label>
              <input className="input" value={form.payee_name} onChange={e => setForm({...form, payee_name: e.target.value})} placeholder="Payee name" />
            </div>
          )}
          <div>
            <label className="label">Amount (₹) *</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input type="number" className="input pl-8 text-lg font-semibold" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="label">Mode *</label>
            <div className="flex gap-2 flex-wrap">
              {['cash','cheque','upi','neft'].map(mode => (
                <button key={mode} onClick={() => setForm({...form, payment_mode: mode})}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize ${form.payment_mode === mode ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  {mode}
                </button>
              ))}
            </div>
          </div>
          {form.payment_mode === 'cheque' && (
            <div>
              <label className="label">Cheque No.</label>
              <input className="input" value={form.cheque_no} onChange={e => setForm({...form, cheque_no: e.target.value})} />
            </div>
          )}
          <div>
            <label className="label">{isPayment ? 'Paid From' : 'Credited To'} *</label>
            <select className="input" value={`${accountType}:${accountId}`}
              onChange={e => { const [t,id] = e.target.value.split(':'); setAccountType(t); setAccountId(id) }}>
              <optgroup label="Cash Accounts">
                {cashAccounts.map(c => <option key={c.id} value={`cash:${c.id}`}>Cash — {c.cashier_name}</option>)}
              </optgroup>
              <optgroup label="Bank Accounts">
                {bankAccounts.map(b => <option key={b.id} value={`bank:${b.id}`}>{b.account_name}</option>)}
              </optgroup>
            </select>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className={`${isPayment ? 'btn-danger' : 'btn-success'} flex items-center gap-2`}>
            {saving ? 'Saving...' : isPayment ? 'Save & Print Voucher' : 'Save Receipt'}
          </button>
        </div>
      </div>
    </div>
  )
}
