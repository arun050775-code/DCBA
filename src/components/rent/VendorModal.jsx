import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'
import { Building2, X } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({length: 5}, (_, i) => CURRENT_YEAR - 2 + i)

export default function VendorModal({ vendor, categories, org, onClose, onSuccess }) {
  const [form, setForm] = useState({
    name: vendor?.name || '',
    category_id: vendor?.category_id || (categories[0]?.id || ''),
    floor: vendor?.floor || '',
    location: vendor?.location || '',
    mobile: vendor?.mobile || '',
    monthly_rent: vendor?.monthly_rent || '',
    security_deposit: vendor?.security_deposit || '',
    opening_arrears: vendor?.opening_arrears || '',
    paid_upto_month: vendor?.paid_upto_month || new Date().getMonth() + 1,
    paid_upto_year: vendor?.paid_upto_year || CURRENT_YEAR,
    status: vendor?.status || 'active',
    remarks: vendor?.remarks || '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Vendor name is required')

    setSaving(true)
    try {
      const payload = {
        org_id: org.id,
        name: form.name.trim(),
        category_id: form.category_id || null,
        floor: form.floor,
        location: form.location,
        mobile: form.mobile,
        monthly_rent: Number(form.monthly_rent) || 0,
        security_deposit: Number(form.security_deposit) || 0,
        opening_arrears: Number(form.opening_arrears) || 0,
        paid_upto_month: Number(form.paid_upto_month),
        paid_upto_year: Number(form.paid_upto_year),
        status: form.status,
        remarks: form.remarks,
      }

      if (vendor) {
        const { error } = await supabase.from('vendors').update(payload).eq('id', vendor.id)
        if (error) throw error
        toast.success('Vendor updated')
      } else {
        const { error } = await supabase.from('vendors').insert(payload)
        if (error) throw error
        toast.success('Vendor added')
      }
      onSuccess()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            {vendor ? 'Edit Vendor' : 'Add New Vendor'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="label">Vendor Name *</label>
            <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Full name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="active">Active</option>
                <option value="vacant">Vacant</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Floor</label>
              <input className="input" value={form.floor} onChange={e => setForm({...form, floor: e.target.value})} placeholder="e.g. Ground Floor" />
            </div>
            <div>
              <label className="label">Location / Near</label>
              <input className="input" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="e.g. Near CH.No. 17" />
            </div>
          </div>

          <div>
            <label className="label">Mobile</label>
            <input className="input" value={form.mobile} onChange={e => setForm({...form, mobile: e.target.value})} placeholder="Contact number" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Monthly Rent (₹)</label>
              <input type="number" className="input" value={form.monthly_rent} onChange={e => setForm({...form, monthly_rent: e.target.value})} />
            </div>
            <div>
              <label className="label">Security Deposit (₹)</label>
              <input type="number" className="input" value={form.security_deposit} onChange={e => setForm({...form, security_deposit: e.target.value})} />
            </div>
          </div>

          <div>
            <label className="label">Opening Arrears (₹)</label>
            <input type="number" className="input" value={form.opening_arrears} onChange={e => setForm({...form, opening_arrears: e.target.value})} placeholder="0" />
          </div>

          <div>
            <label className="label">Paid Upto</label>
            <div className="flex gap-2">
              <select className="input" value={form.paid_upto_month} onChange={e => setForm({...form, paid_upto_month: Number(e.target.value)})}>
                {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
              </select>
              <select className="input w-28" value={form.paid_upto_year} onChange={e => setForm({...form, paid_upto_year: Number(e.target.value)})}>
                {YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Remarks</label>
            <textarea className="input" rows={2} value={form.remarks} onChange={e => setForm({...form, remarks: e.target.value})} />
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : vendor ? 'Update Vendor' : 'Add Vendor'}
          </button>
        </div>
      </div>
    </div>
  )
}
