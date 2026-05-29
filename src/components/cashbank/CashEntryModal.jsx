import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'
import { X, ArrowDownCircle, ArrowUpCircle, IndianRupee } from 'lucide-react'

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

async function generateRefNo(orgId, shortName, type) {
  const fy = new Date().getMonth() >= 3
    ? `${new Date().getFullYear()}-${String(new Date().getFullYear()+1).slice(2)}`
    : `${new Date().getFullYear()-1}-${String(new Date().getFullYear()).slice(2)}`
  const table = type === 'receipt' ? 'income_entries' : 'expenditure_entries'
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('org_id', orgId)
  const serial = String((count || 0) + 1).padStart(4, '0')
  const prefix = type === 'receipt' ? 'RCP' : 'VCH'
  return `${shortName}/${prefix}/${fy}/${serial}`
}

export default function CashEntryModal({ type, org, userRole, cashAccounts: propCashAccounts, onClose, onSuccess }) {
  const isSupervisor = userRole?.role === 'supervisor'
  const isReceipt = type === 'receipt'
  const [heads, setHeads] = useState([])
  const [subHeads, setSubHeads] = useState([])
  const [cashAccounts, setCashAccounts] = useState(propCashAccounts || [])
  const [form, setForm] = useState({
    entry_date: new Date().toISOString().split('T')[0],
    ref_no: '',
    head_id: '',
    sub_head_id: '',
    description: '',
    amount: '',
    payment_mode: 'cash',
    cash_account_id: propCashAccounts?.[0]?.id || '',
    payee_name: '',
    cheque_no: '',
    remarks: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchHeads()
    fetchCashAccounts()
    generateRefNo(org.id, org.short_name, type).then(no => setForm(f => ({ ...f, ref_no: no })))
  }, [])

  async function fetchCashAccounts() {
    const { data } = await supabase.from('cash_accounts').select('*').eq('org_id', org.id).eq('is_active', true)
    if (data?.length > 0) {
      setCashAccounts(data)
      setForm(f => ({ ...f, cash_account_id: data[0].id }))
    }
  }

  async function fetchHeads() {
    const { data } = await supabase.from('account_heads')
      .select('*')
      .eq('org_id', org.id)
      .eq('type', isReceipt ? 'income' : 'expenditure')
      .eq('is_active', true)
      .order('sort_order')
    setHeads(data || [])
    if (data?.length > 0) {
      setForm(f => ({ ...f, head_id: data[0].id }))
      fetchSubHeads(data[0].id)
    }
  }

  async function fetchSubHeads(headId) {
    const { data } = await supabase.from('account_sub_heads')
      .select('*').eq('head_id', headId).eq('is_active', true).order('sort_order')
    setSubHeads(data || [])
    setForm(f => ({ ...f, sub_head_id: data?.[0]?.id || '' }))
  }

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter amount')
    if (!isSupervisor && !form.head_id) return toast.error('Select account head')

    setSaving(true)
    try {
      const table = isReceipt ? 'income_entries' : 'expenditure_entries'
      const payload = {
        org_id: org.id,
        entry_date: form.entry_date,
        head_id: form.head_id || null,
        sub_head_id: form.sub_head_id || null,
        description: form.description,
        amount: Number(form.amount),
        payment_mode: form.payment_mode,
        cash_account_id: form.cash_account_id || null,
        remarks: form.remarks,
        ...(isReceipt ? { receipt_no: form.ref_no } : {
          voucher_no: form.ref_no,
          payee_name: form.payee_name,
          cheque_no: form.cheque_no,
        })
      }

      const { error } = await supabase.from(table).insert(payload)
      if (error) throw error

      toast.success(`${isReceipt ? 'Receipt' : 'Payment'} recorded!`)

      const voucherData = {
        ref_no: form.ref_no,
        date: form.entry_date,
        type: type,
        head: heads.find(h => h.id === form.head_id)?.name,
        sub_head: subHeads.find(s => s.id === form.sub_head_id)?.name,
        description: form.description,
        amount: Number(form.amount),
        amount_words: numberToWords(Number(form.amount)) + ' Rupees Only',
        payment_mode: form.payment_mode,
        payee_name: form.payee_name,
        cashier_name: userRole?.name,
        cheque_no: form.cheque_no,
        remarks: form.remarks,
        org_name: org.name,
      }
      onSuccess(voucherData)
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  const Icon = isReceipt ? ArrowDownCircle : ArrowUpCircle
  const color = isReceipt ? 'green' : 'red'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className={`flex items-center justify-between px-6 py-4 border-b bg-${color}-50`}>
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Icon className={`w-5 h-5 text-${color}-600`} />
              {isReceipt ? 'Cash Receipt' : 'Cash Payment'}
            </h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{isReceipt ? 'Receipt' : 'Voucher'} No.</label>
              <input className="input font-mono text-sm bg-gray-50" value={form.ref_no}
                onChange={e => setForm({ ...form, ref_no: e.target.value })} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.entry_date}
                onChange={e => setForm({ ...form, entry_date: e.target.value })} />
            </div>
          </div>

          {!isSupervisor && (
            <div>
              <label className="label">Account Head *</label>
              <select className="input" value={form.head_id}
                onChange={e => { setForm({ ...form, head_id: e.target.value, sub_head_id: '' }); fetchSubHeads(e.target.value) }}>
                {heads.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </div>
          )}

          {!isSupervisor && subHeads.length > 0 && (
            <div>
              <label className="label">Sub-Head</label>
              <select className="input" value={form.sub_head_id}
                onChange={e => setForm({ ...form, sub_head_id: e.target.value })}>
                <option value="">— Select Sub-Head —</option>
                {subHeads.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}

          {!isReceipt && (
            <div>
              <label className="label">Paid To (Payee Name)</label>
              <input className="input" value={form.payee_name}
                onChange={e => setForm({ ...form, payee_name: e.target.value })}
                placeholder="Name of person/vendor paid" />
            </div>
          )}

          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description" />
          </div>

          <div>
            <label className="label">Amount (₹) *</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input type="number" className="input pl-8 text-lg font-semibold" value={form.amount}
                onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" />
            </div>
            {form.amount > 0 && (
              <p className="text-xs text-gray-400 mt-1 italic">{numberToWords(Number(form.amount))} Rupees Only</p>
            )}
          </div>

          <div>
            <label className="label">Payment Mode</label>
            <div className="flex gap-2 flex-wrap">
              {['cash'].map(mode => (
                <button key={mode} onClick={() => setForm({ ...form, payment_mode: mode })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border capitalize transition-colors ${form.payment_mode === mode ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {form.payment_mode === 'cheque' && (
            <div>
              <label className="label">Cheque No.</label>
              <input className="input" value={form.cheque_no}
                onChange={e => setForm({ ...form, cheque_no: e.target.value })} placeholder="Cheque number" />
            </div>
          )}

          <div>
            <label className="label">Cash Account</label>
            <select className="input" value={form.cash_account_id}
              onChange={e => setForm({ ...form, cash_account_id: e.target.value })}>
              {cashAccounts.map(c => <option key={c.id} value={c.id}>{c.cashier_name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Remarks</label>
            <input className="input" value={form.remarks}
              onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Optional" />
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className={isReceipt ? 'btn-success flex items-center gap-2' : 'btn-danger flex items-center gap-2'}>
            <Icon className="w-4 h-4" />
            {saving ? 'Saving...' : `Save & Print ${isReceipt ? 'Receipt' : 'Voucher'}`}
          </button>
        </div>
      </div>
    </div>
  )
}
