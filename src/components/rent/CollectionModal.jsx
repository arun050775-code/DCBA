import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'
import { Receipt, X, IndianRupee } from 'lucide-react'
import { computeOutstanding, monthsDue, paidUptoLabel } from '../../utils/duesCalc'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

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
  const { count } = await supabase.from('rent_collections').select('*', { count: 'exact', head: true }).eq('org_id', orgId)
  return `${shortName}/RCP/${fy}/${String((count || 0) + 1).padStart(4, '0')}`
}

function nextMonth(mo, yr) {
  if (!mo) return { mo: new Date().getMonth() + 1, yr: CURRENT_YEAR }
  const nm = mo % 12 + 1
  const ny = mo === 12 ? yr + 1 : yr
  return { mo: nm, yr: ny }
}

export default function CollectionModal({ vendor, org, userRole, onClose, onSuccess }) {
  const outstanding = computeOutstanding(vendor)
  const mDue = monthsDue(vendor)
  const next = nextMonth(vendor.paid_upto_month, vendor.paid_upto_year)

  const [form, setForm] = useState({
    collection_date: new Date().toISOString().split('T')[0],
    amount: vendor.monthly_rent || '',
    payment_mode: 'cash',
    receipt_no: '',
    from_month: next.mo,
    from_year: next.yr,
    to_month: next.mo,
    to_year: next.yr,
    cheque_no: '',
    cheque_date: new Date().toISOString().split('T')[0],
    bank_name: '',
    transaction_id: '',
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
    if (cash?.length > 0) setSelectedAccount(`cash:${cash[0].id}`)
  }

  function getPeriodLabel() {
    const fromM = MONTHS[form.from_month - 1]
    const toM = MONTHS[form.to_month - 1]
    if (form.from_month === form.to_month && form.from_year === form.to_year) return `${fromM} ${form.from_year}`
    return `${fromM} ${form.from_year} to ${toM} ${form.to_year}`
  }

  function recalcAmount(fm, fy, tm, ty) {
    if (!vendor.monthly_rent) return
    let months = 0, yr = fy, mo = fm - 1
    while (true) {
      mo++; if (mo > 12) { mo = 1; yr++ }
      months++
      if (yr > ty || (yr === ty && mo >= tm)) break
      if (months > 24) break
    }
    setForm(f => ({ ...f, amount: months * vendor.monthly_rent }))
  }

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter amount')
    if (!form.receipt_no) return toast.error('Receipt number missing')
    if (!selectedAccount) return toast.error('Select account')
    if (form.payment_mode === 'cheque' && !form.cheque_no) return toast.error('Enter cheque number')

    setSaving(true)
    try {
      const [accountType, accountId] = selectedAccount.split(':')
      const payload = {
        org_id: org.id, vendor_id: vendor.id,
        receipt_no: form.receipt_no, collection_date: form.collection_date,
        amount: Number(form.amount), payment_mode: form.payment_mode,
        from_month: form.from_month, from_year: form.from_year,
        to_month: form.to_month, to_year: form.to_year,
        months_covered: getPeriodLabel(),
        bank_account_id: accountType === 'bank' ? accountId : null,
        cash_account_id: accountType === 'cash' ? accountId : null,
        remarks: form.remarks,
        cheque_no: form.payment_mode === 'cheque' ? form.cheque_no : null,
        cheque_date: form.payment_mode === 'cheque' ? form.cheque_date : null,
        bank_name: form.payment_mode === 'cheque' ? form.bank_name : null,
        transaction_id: ['upi','neft'].includes(form.payment_mode) ? form.transaction_id : null,
        cheque_status: form.payment_mode === 'cheque' ? 'pending' : null,
      }
      const { error } = await supabase.from('rent_collections').insert(payload)
      if (error) throw error

      await supabase.from('vendors').update({
        paid_upto_month: form.to_month,
        paid_upto_year: form.to_year,
      }).eq('id', vendor.id)

      toast.success('Payment recorded!')
      onSuccess({
        receipt_no: form.receipt_no, date: form.collection_date,
        vendor_name: vendor.name, vendor_mobile: vendor.mobile,
        amount: Number(form.amount),
        amount_words: numberToWords(Number(form.amount)) + ' Rupees Only',
        period: getPeriodLabel(), payment_mode: form.payment_mode,
        cashier_name: userRole?.name, org_name: org.name,
        cheque_no: form.cheque_no, cheque_date: form.cheque_date,
        bank_name: form.bank_name, transaction_id: form.transaction_id,
        remarks: form.remarks,
      })
    } catch (err) { toast.error(err.message) }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
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
          {/* O/S Summary */}
          <div className={`rounded-lg p-3 text-sm border ${outstanding > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
            <div className="flex justify-between items-center">
              <span className={`font-semibold ${outstanding > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                {outstanding > 0 ? '⚠ Outstanding' : '✓ Clear'}
              </span>
              <span className={`font-bold text-lg ${outstanding > 0 ? 'text-orange-800' : 'text-green-800'}`}>
                ₹{outstanding.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex gap-4 mt-1 text-xs text-gray-500">
              <span>Paid upto: <strong>{paidUptoLabel(vendor)}</strong></span>
              {mDue > 0 && <span>Months due: <strong>{mDue}</strong></span>}
            </div>
          </div>

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

          <div>
            <label className="label">Period Covered</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">From</p>
                <div className="flex gap-2">
                  <select className="input" value={form.from_month} onChange={e => { const m=Number(e.target.value); setForm(f=>({...f,from_month:m})); recalcAmount(m,form.from_year,form.to_month,form.to_year) }}>
                    {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
                  </select>
                  <select className="input w-24" value={form.from_year} onChange={e => { const y=Number(e.target.value); setForm(f=>({...f,from_year:y})); recalcAmount(form.from_month,y,form.to_month,form.to_year) }}>
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">To</p>
                <div className="flex gap-2">
                  <select className="input" value={form.to_month} onChange={e => { const m=Number(e.target.value); setForm(f=>({...f,to_month:m})); recalcAmount(form.from_month,form.from_year,m,form.to_year) }}>
                    {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
                  </select>
                  <select className="input w-24" value={form.to_year} onChange={e => { const y=Number(e.target.value); setForm(f=>({...f,to_year:y})); recalcAmount(form.from_month,form.from_year,form.to_month,y) }}>
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-1 font-medium">Period: {getPeriodLabel()}</p>
          </div>

          <div>
            <label className="label">Amount (₹) *</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input type="number" className="input pl-8 text-lg font-semibold" value={form.amount}
                onChange={e => setForm({...form, amount: e.target.value})} placeholder="0" />
            </div>
            {form.amount > 0 && <p className="text-xs text-gray-500 mt-1 italic">{numberToWords(Number(form.amount))} Rupees Only</p>}
          </div>

          <div>
            <label className="label">Payment Mode *</label>
            <div className="flex gap-2 flex-wrap">
              {['cash','cheque','upi','neft'].map(mode => (
                <button key={mode} onClick={() => setForm({...form, payment_mode: mode})}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border uppercase transition-colors ${form.payment_mode === mode ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  {mode}
                </button>
              ))}
            </div>
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
              <div>
                <label className="label">Bank Name</label>
                <input className="input" value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} placeholder="e.g. SBI, HDFC" />
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

          <div>
            <label className="label">Remarks</label>
            <input className="input" value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} placeholder="Optional" />
          </div>
        </div>

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
