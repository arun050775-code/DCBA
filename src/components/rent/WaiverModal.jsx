import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'
import { RotateCcw, X } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export default function WaiverModal({ vendor, org, userRole, onClose, onSuccess }) {
  const [form, setForm] = useState({
    waiver_date: new Date().toISOString().split('T')[0],
    amount: '',
    from_month: new Date().getMonth() + 1,
    from_year: CURRENT_YEAR,
    to_month: new Date().getMonth() + 1,
    to_year: CURRENT_YEAR,
    reason: '',
    approved_by: '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Please enter waiver amount')
    if (!form.reason.trim()) return toast.error('Reason is mandatory for waiver')

    setSaving(true)
    try {
      const { error } = await supabase.from('rent_waivers').insert({
        org_id: org.id,
        vendor_id: vendor.id,
        waiver_date: form.waiver_date,
        amount: Number(form.amount),
        from_month: form.from_month,
        from_year: form.from_year,
        to_month: form.to_month,
        to_year: form.to_year,
        reason: form.reason,
        approved_by: form.approved_by,
      })
      if (error) throw error

      // Reduce arrears
      const newArrears = Math.max(0, (vendor.opening_arrears || 0) - Number(form.amount))
      await supabase.from('vendors').update({ opening_arrears: newArrears }).eq('id', vendor.id)

      toast.success('Waiver recorded successfully')
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
          <div>
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-600" /> Record Rent Waiver
            </h3>
            <p className="text-sm text-gray-500">{vendor.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm">
            <span className="font-medium text-orange-700">Current Arrears: </span>
            <span className="text-orange-800 font-bold">₹{(vendor.opening_arrears||0).toLocaleString('en-IN')}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Waiver Date</label>
              <input type="date" className="input" value={form.waiver_date} onChange={e => setForm({...form, waiver_date: e.target.value})} />
            </div>
            <div>
              <label className="label">Waiver Amount (₹)</label>
              <input type="number" className="input" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} placeholder="0" />
            </div>
          </div>

          <div>
            <label className="label">Period</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-1">From</p>
                <div className="flex gap-1">
                  <select className="input" value={form.from_month} onChange={e => setForm({...form, from_month: Number(e.target.value)})}>
                    {MONTHS.map((m,i) => <option key={m} value={i+1}>{m.slice(0,3)}</option>)}
                  </select>
                  <select className="input w-20" value={form.from_year} onChange={e => setForm({...form, from_year: Number(e.target.value)})}>
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">To</p>
                <div className="flex gap-1">
                  <select className="input" value={form.to_month} onChange={e => setForm({...form, to_month: Number(e.target.value)})}>
                    {MONTHS.map((m,i) => <option key={m} value={i+1}>{m.slice(0,3)}</option>)}
                  </select>
                  <select className="input w-20" value={form.to_year} onChange={e => setForm({...form, to_year: Number(e.target.value)})}>
                    {YEARS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Reason * <span className="text-red-500">(mandatory)</span></label>
            <textarea className="input" rows={3} value={form.reason} onChange={e => setForm({...form, reason: e.target.value})}
              placeholder="e.g. Waived off due to illness — approved by President" />
          </div>

          <div>
            <label className="label">Approved By (Office Bearer)</label>
            <input className="input" value={form.approved_by} onChange={e => setForm({...form, approved_by: e.target.value})}
              placeholder="e.g. Sh. Rajpal Kasana, President" />
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-danger flex items-center gap-2">
            <RotateCcw className="w-4 h-4" />
            {saving ? 'Saving...' : 'Record Waiver'}
          </button>
        </div>
      </div>
    </div>
  )
}
