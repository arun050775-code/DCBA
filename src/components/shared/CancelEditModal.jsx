import { useState } from 'react'
import { X, AlertTriangle, Edit, XCircle } from 'lucide-react'

export default function CancelEditModal({ mode, entry, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const isCancel = mode === 'cancel'

  async function handleConfirm() {
    if (!reason.trim()) return alert('Reason is required')
    setSaving(true)
    await onConfirm(reason.trim())
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isCancel ? 'bg-red-50' : 'bg-blue-50'}`}>
          <h3 className={`font-semibold flex items-center gap-2 ${isCancel ? 'text-red-800' : 'text-blue-800'}`}>
            {isCancel ? <XCircle className="w-5 h-5" /> : <Edit className="w-5 h-5" />}
            {isCancel ? 'Cancel Entry' : 'Edit Entry'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Ref No.</span>
              <span className="font-mono font-medium">{entry.ref_no || entry.receipt_no || entry.voucher_no || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-bold">₹{Number(entry.amount).toLocaleString('en-IN')}</span>
            </div>
          </div>

          {isCancel && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">Entry will be marked cancelled — remains in records for audit but excluded from reports.</p>
            </div>
          )}

          <div>
            <label className="label">Reason * <span className="text-red-500">(required)</span></label>
            <textarea className="input h-24 resize-none" value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={isCancel ? 'Reason for cancellation...' : 'Reason for modification...'} />
          </div>
        </div>
        <div className="px-5 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Back</button>
          <button onClick={handleConfirm} disabled={saving || !reason.trim()}
            className={isCancel ? 'btn-danger flex items-center gap-2' : 'btn-primary flex items-center gap-2'}>
            {isCancel ? <XCircle className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
            {saving ? 'Processing...' : isCancel ? 'Confirm Cancel' : 'Proceed to Edit'}
          </button>
        </div>
      </div>
    </div>
  )
}
