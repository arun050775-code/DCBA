import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'
import { Receipt, X, IndianRupee } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

// Number to words (Indian)
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

async function generateReceiptNo(orgId, shortName) {
  const fy = new Date().getMonth() >= 3
    ? `${new Date().getFullYear()}-${String(new Date().getFullYear()+1).slice(2)}`
    : `${new Date().getFullYear()-1}-${String(new Date().getFullYear()).slice(2)}`

  const { count } = await supabase
    .from('rent_collections')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)

  const serial = String((count || 0) + 1).padStart(4, '0')
  return `${shortName}/RCP/${fy}/${serial}`
}

export default function CollectionModal({ vendor, org, userRole, onClose, onSuccess }) {
  const [form, setForm] = useState({
    collection_date: new Date().toISOString().split('T')[0],
    amount: vendor.monthly_rent || '',
    payment_mode: 'cash',
    receipt_no: '',
    from_month: vendor.paid_upto_month ? (vendor.paid_upto_month % 12) + 1 : new Date().getMonth() + 1,
    from_year: vendor.paid_upto_month === 12 ? (vendor.paid_upto_year || CURRENT_YEAR) + 1 : (vendor.paid_upto_year || CURRENT_YEAR),
    to_month: vendor.paid_upto_month ? (vendor.paid_upto_month % 12) + 1 : new Date().getMonth() + 1,
    to_year: vendor.paid_upto_month === 12 ? (vendor.paid_upto_year || CURRENT_YEAR) + 1 : (vendor.paid_upto_year || CURRENT_YEAR),
    cheque_no: '',
    bank_name: '',
    remarks: '',
  })
  const [bankAccounts, setBankAccounts] = useState([])
  const [cashAccounts, setCashAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    generateReceiptNo(org.id, org.short_name).then(no => setForm(f => ({...f, receipt_no: no})))
    fetchAccounts()
  }, [])

  async function fetchAccounts() {
    const [{ data: banks }, { data: cash }] = await Promise.all([
      supabase.from('bank_accounts').select('*').eq('org_id', org.id).eq('is_active', true),
      supabase.from('cash_accounts').select('*').eq('org_id', org.id).eq('is_active', true),
    ])
    setBankAccounts(banks || [])
    setCashAccounts(cash || [])
    if (cash && cash.length > 0) setSelectedAccount(`cash:${cash[0].id}`)
  }

  function getPeriodLabel() {
    const fromM = MONTHS[form.from_month - 1]
    const toM = MONTHS[form.to_month - 1]
    if (form.from_month === form.to_month && form.from_year === form.to_year) return `${fromM} ${form.from_year}`
    return `${fromM} ${form.from_year} to ${toM} ${form.to_year}`
  }

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Please enter amount')
    if (!form.receipt_no) return toast.error('Receipt number missing')
    if (!selectedAccount) return toast.error('Please select account')

    setSaving(true)
    try {
      const [accountType, accountId] = selectedAccount.split(':')
      const payload = {
        org_id: org.id,
        vendor_id: vendor.id,
        receipt_no: form.receipt_no,
        collection_date: form.collection_date,
        amount: Number(form.amount),
        payment_mode: form.payment_mode,
        from_month: form.from_month,
        from_year: form.from_year,
        to_month: form.to_month,
        to_year: form.to_year,
        months_covered: getPeriodLabel(),
        bank_account_id: accountType === 'bank' ? accountId : null,
        cash_account_id: accountType === 'cash' ? accountId : null,
        remarks: form.remarks,
      }

      const { data: collection, error } = await supabase.from('rent_collections').insert(payload).select().single()
      if (error) throw error

      // Update vendor paid_upto and reduce arrears
      const newArrears = Math.max(0, (vendor.opening_arrears || 0) - Number(form.amount))
      await supabase.from('vendors').update({
        paid_upto_month: form.to_month,
        paid_upto_year: form.to_year,
        opening_arrears: newArrears,
      }).eq('id', vendor.id)

      toast.success('Payment recorded successfully!')

      // Build receipt data for printing
      const receiptData = {
        receipt_no: form.receipt_no,
        date: form.collection_date,
        vendor_name: vendor.name,
        vendor_mobile: vendor.mobile,
        amount: Number(form.amount),
        amount_words: numberToWords(Number(form.amount)) + ' Rupees Only',
        period: getPeriodLabel(),
        payment_mode: form.payment_mode,
        cashier_name: userRole?.name,
        org_name: org.name,
        cheque_no: form.cheque_no,
        bank_name: form.bank_name,
        remarks: form.remarks,
      }
      onSuccess(receiptData)
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-green-50">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-600" /> Collect Rent
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">{vendor.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Arrears info */}
          {(vendor.opening_arrears || 0) > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
              <span className="font-medium text-orange-700">Pending Arrears: </span>
              <span className="text-orange-800 font-bold">₹{vendor.opening_arrears.toLocaleString('en-IN')}</span>
              <span className="text-orange-600 ml-2">(Paid upto: {MONTHS[(vendor.paid_upto_month||1)-1]} {vendor.paid_upto_year})</span>
            </div>
          )}

          {/* Receipt No */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Receipt No. *</label>
              <input className="input bg-gray-50 font-mono text-sm" value={form.receipt_no}
                onChange={e => setForm({...form, receipt_no: e.target.value})} />
            </div>
            <div>
              <label className="label">Date *</label>
              <input type="date" className="input" value={form.collection_date}
                onChange={e => setForm({...form, collection_date: e.target.value})} />
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="label">Amount (₹) *</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input type="number" className="input pl-8 text-lg font-semibold" value={form.amount}
                onChange={e => setForm({...form, amount: e.target.value})} placeholder="0" />
            </div>
            {form.amount > 0 && (
              <p className="text-xs text-gray-500 mt-1 italic">{numberToWords(Number(form.amount))} Rupees Only</p>
            )}
          </div>

          {/* Period */}
          <div>
            <label className="label">Period Covered</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">From</p>
                <div className="flex gap-2">
                  <select className="input" value={form.from_month} onChange={e => setForm({...form, from_month: Number(e.target.value)})}>
                    {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
                  </select>
                  <select className="input w-24" value={form.from_year} onChange={e => setForm({...form, from_year: Number(e.target.value)})}>
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">To</p>
                <div className="flex gap-2">
                  <select className="input" value={form.to_month} onChange={e => setForm({...form, to_month: Number(e.target.value)})}>
                    {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
                  </select>
                  <select className="input w-24" value={form.to_year} onChange={e => setForm({...form, to_year: Number(e.target.value)})}>
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-1 font-medium">Period: {getPeriodLabel()}</p>
          </div>

          {/* Payment Mode */}
          <div>
            <label className="label">Payment Mode *</label>
            <div className="flex gap-2 flex-wrap">
              {['cash','cheque','upi','neft','card'].map(mode => (
                <button key={mode} onClick={() => setForm({...form, payment_mode: mode})}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    form.payment_mode === mode ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}>
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Cheque details if cheque */}
          {form.payment_mode === 'cheque' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Cheque No.</label>
                <input className="input" value={form.cheque_no} onChange={e => setForm({...form, cheque_no: e.target.value})} placeholder="Cheque number" />
              </div>
              <div>
                <label className="label">Bank Name</label>
                <input className="input" value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} placeholder="Bank name" />
              </div>
            </div>
          )}

          {/* Account selection */}
          <div>
            <label className="label">Credit To *</label>
            <select className="input" value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}>
              <optgroup label="Cash Accounts">
                {cashAccounts.map(c => <option key={c.id} value={`cash:${c.id}`}>Cash — {c.cashier_name}</option>)}
              </optgroup>
              <optgroup label="Bank Accounts">
                {bankAccounts.map(b => <option key={b.id} value={`bank:${b.id}`}>{b.account_name} — {b.bank_name}</option>)}
              </optgroup>
            </select>
          </div>

          {/* Remarks */}
          <div>
            <label className="label">Remarks</label>
            <input className="input" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} placeholder="Optional notes" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-success flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save & Print Receipt'}
          </button>
        </div>
      </div>
    </div>
  )
}
