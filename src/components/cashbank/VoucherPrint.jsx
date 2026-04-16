import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'
import { X, IndianRupee, CreditCard } from 'lucide-react'

export default function AdvanceModal({ org, staff, userRole, onClose, onSuccess }) {
  const [form, setForm] = useState({
    staff_id: staff[0]?.id || '',
    advance_date: new Date().toISOString().split('T')[0],
    amount: '',
    purpose: '',
    recovery_per_month: '2000',
    opening_outstanding: '0',  // Opening outstanding if any
    payment_mode: 'cash',
    cash_account_id: '',
    bank_account_id: '',
    cheque_no: '',
    bank_name: '',
  })
  const [cashAccounts, setCashAccounts] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAccounts() }, [])

  async function fetchAccounts() {
    const [{ data: cash }, { data: bank }] = await Promise.all([
      supabase.from('cash_accounts').select('*').eq('org_id', org.id).eq('is_active', true),
      supabase.from('bank_accounts').select('*').eq('org_id', org.id).eq('is_active', true),
    ])
    setCashAccounts(cash || [])
    setBankAccounts(bank || [])
    if (cash && cash.length > 0) setForm(f => ({ ...f, cash_account_id: cash[0].id }))
  }

  async function handleSave() {
    if (!form.staff_id) return toast.error('Select staff member')
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter advance amount')
    if (form.payment_mode === 'cash' && !form.cash_account_id) return toast.error('Select cash account')
    if (form.payment_mode !== 'cash' && !form.bank_account_id) return toast.error('Select bank account')

    setSaving(true)
    try {
      const totalOutstanding = Number(form.amount) + Number(form.opening_outstanding || 0)

      // 1. Record salary advance
      const { error: advErr } = await supabase.from('salary_advances').insert({
        org_id: org.id,
        staff_id: form.staff_id,
        advance_date: form.advance_date,
        amount: Number(form.amount),
        purpose: form.purpose,
        recovery_per_month: Number(form.recovery_per_month) || 2000,
        balance_outstanding: totalOutstanding,
        opening_outstanding: Number(form.opening_outstanding || 0),
      })
      if (advErr) throw advErr

      // 2. Create payment voucher in expenditure_entries
      const selectedStaff = staff.find(s => s.id === form.staff_id)
      const { error: expErr } = await supabase.from('expenditure_entries').insert({
        org_id: org.id,
        entry_date: form.advance_date,
        payee_name: selectedStaff?.name || '',
        description: `Salary Advance — ${form.purpose || 'Personal'}`,
        amount: Number(form.amount),
        payment_mode: form.payment_mode,
        cash_account_id: form.payment_mode === 'cash' ? form.cash_account_id : null,
        bank_account_id: form.payment_mode !== 'cash' ? form.bank_account_id : null,
        cheque_no: form.cheque_no || null,
        bank_name: form.bank_name || null,
        account_head_id: null, // Salary Advance is balance sheet item
        remarks: `Advance to ${selectedStaff?.name} — Recovery: ₹${form.recovery_per_month}/month`,
      })
      if (expErr) console.warn('Voucher creation warning:', expErr.message)

      toast.success('Salary advance recorded & payment voucher created!')
      onSuccess()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-orange-50">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-orange-600" /> Record Salary Advance
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Staff */}
          <div>
            <label className="label">Staff Member *</label>
            <select className="input" value={form.staff_id} onChange={e => setForm({ ...form, staff_id: e.target.value })}>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>)}
            </select>
          </div>

          {/* Date + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.advance_date}
                onChange={e => setForm({ ...form, advance_date: e.target.value })} />
            </div>
            <div>
              <label className="label">Advance Amount (₹) *</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input type="number" className="input pl-8" value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" />
              </div>
            </div>
          </div>

          {/* Opening Outstanding */}
          <div>
            <label className="label">Opening Outstanding Balance (₹)
              <span className="text-gray-400 font-normal ml-1">— if any previous advance is pending</span>
            </label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input type="number" className="input pl-8" value={form.opening_outstanding}
                onChange={e => setForm({ ...form, opening_outstanding: e.target.value })} placeholder="0" />
            </div>
            {Number(form.opening_outstanding) > 0 && Number(form.amount) > 0 && (
              <p className="text-xs text-orange-600 mt-1 font-medium">
                Total Outstanding: ₹{(Number(form.amount) + Number(form.opening_outstanding)).toLocaleString('en-IN')}
              </p>
            )}
          </div>

          {/* Monthly Recovery */}
          <div>
            <label className="label">Monthly Recovery (₹)</label>
            <input type="number" className="input" value={form.recovery_per_month}
              onChange={e => setForm({ ...form, recovery_per_month: e.target.value })} placeholder="2000" />
            <p className="text-xs text-gray-400 mt-1">Amount to be deducted from salary each month</p>
          </div>

          {/* Payment Mode */}
          <div>
            <label className="label">Payment Mode *</label>
            <div className="flex gap-2 flex-wrap">
              {['cash', 'cheque', 'upi', 'neft'].map(mode => (
                <button key={mode} type="button"
                  onClick={() => setForm({ ...form, payment_mode: mode })}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.payment_mode === mode ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Cash Account */}
          {form.payment_mode === 'cash' && (
            <div>
              <label className="label">Cash Account *</label>
              <select className="input" value={form.cash_account_id}
                onChange={e => setForm({ ...form, cash_account_id: e.target.value })}>
                {cashAccounts.map(c => <option key={c.id} value={c.id}>{c.cashier_name}</option>)}
              </select>
            </div>
          )}

          {/* Bank Account */}
          {form.payment_mode !== 'cash' && (
            <div className="space-y-3">
              <div>
                <label className="label">Bank Account *</label>
                <select className="input" value={form.bank_account_id}
                  onChange={e => setForm({ ...form, bank_account_id: e.target.value })}>
                  <option value="">Select bank account</option>
                  {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.account_name} ({b.account_number})</option>)}
                </select>
              </div>
              {form.payment_mode === 'cheque' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Cheque No.</label>
                    <input className="input" value={form.cheque_no}
                      onChange={e => setForm({ ...form, cheque_no: e.target.value })} placeholder="Cheque number" />
                  </div>
                  <div>
                    <label className="label">Bank Name</label>
                    <input className="input" value={form.bank_name}
                      onChange={e => setForm({ ...form, bank_name: e.target.value })} placeholder="Bank name" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Purpose */}
          <div>
            <label className="label">Purpose</label>
            <input className="input" value={form.purpose}
              onChange={e => setForm({ ...form, purpose: e.target.value })}
              placeholder="e.g. Medical emergency, personal need..." />
          </div>

          {/* Summary */}
          {form.amount && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
              <p className="font-semibold text-orange-800 mb-1">Summary:</p>
              <div className="text-xs space-y-1 text-orange-700">
                <p>Advance Amount: <strong>₹{Number(form.amount||0).toLocaleString('en-IN')}</strong></p>
                {Number(form.opening_outstanding) > 0 && <p>+ Opening Outstanding: <strong>₹{Number(form.opening_outstanding).toLocaleString('en-IN')}</strong></p>}
                <p>= Total Outstanding: <strong>₹{(Number(form.amount||0)+Number(form.opening_outstanding||0)).toLocaleString('en-IN')}</strong></p>
                <p>Monthly Recovery: <strong>₹{Number(form.recovery_per_month||0).toLocaleString('en-IN')}/month</strong></p>
                <p className="text-orange-500 italic">⚡ Payment voucher will be auto-created</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Record Advance & Create Voucher'}
          </button>
        </div>
      </div>
    </div>
  )
}
