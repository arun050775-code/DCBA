import { useRef } from 'react'
import { X, Printer, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`
}

// Prints on pre-printed yellow A4 letterhead
// Each half = 148.5mm | Header already printed = ~36mm | Body starts below header
function ReceiptBody({ receipt, copy, isReprint }) {
  return (
    <div style={{
      paddingTop: '36mm',       // Skip pre-printed header height
      paddingLeft: '18mm',
      paddingRight: '14mm',
      paddingBottom: '4mm',
      fontFamily: 'Arial, sans-serif',
      fontSize: '11px',
      height: '148.5mm',        // Exactly half of A4
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      {/* Copy label + Reprint */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '8px', color: '#666', fontStyle: 'italic' }}>{copy}</span>
        {isReprint && (
          <span style={{ fontSize: '9px', color: 'red', border: '1px solid red', padding: '1px 5px', borderRadius: '2px', fontWeight: 'bold', letterSpacing: '1px' }}>
            REPRINT
          </span>
        )}
      </div>

      {/* Receipt No & Date */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', borderBottom: '1px solid #ccc', paddingBottom: '4px' }}>
        <span><strong>Receipt No:</strong> {receipt.receipt_no}</span>
        <span><strong>Date:</strong> {formatDate(receipt.date)}</span>
      </div>

      {/* Received From */}
      <div style={{ marginBottom: '6px' }}>
        <strong>Received From: </strong>{receipt.vendor_name}
        {receipt.vendor_mobile && (
          <span style={{ marginLeft: '10px', color: '#666', fontSize: '10px' }}>Ph: {receipt.vendor_mobile}</span>
        )}
      </div>

      {/* Amount */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '5px' }}>
        <strong>Amount:</strong>
        <span style={{ fontSize: '15px', fontWeight: 'bold' }}>₹{Number(receipt.amount).toLocaleString('en-IN')}</span>
        <span style={{ fontSize: '9px', color: '#444', fontStyle: 'italic' }}>({receipt.amount_words})</span>
      </div>

      {/* Period */}
      <div style={{ marginBottom: '5px' }}>
        <strong>Being Rent for: </strong>{receipt.period}
      </div>

      {/* Mode */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '5px' }}>
        <span><strong>Mode:</strong> {receipt.payment_mode?.toUpperCase()}</span>
        {receipt.cheque_no && <span><strong>Chq No:</strong> {receipt.cheque_no}</span>}
        {receipt.bank_name && <span><strong>Bank:</strong> {receipt.bank_name}</span>}
      </div>

      {receipt.remarks && (
        <div style={{ fontSize: '9px', color: '#555', marginBottom: '4px' }}>
          <strong>Remarks:</strong> {receipt.remarks}
        </div>
      )}

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '8mm' }}>
        <div style={{ textAlign: 'center', borderTop: '1px solid #999', paddingTop: '2px', width: '80px', fontSize: '9px', color: '#777' }}>
          Receiver
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '9px', color: '#777', marginBottom: '14mm' }}>For Saket Bar Association</div>
          <div style={{ borderTop: '1px solid #000', paddingTop: '2px', fontSize: '10px', minWidth: '100px', textAlign: 'center' }}>
            {receipt.cashier_name || 'Authorised Signatory'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ReceiptPrint({ receipt, org, onClose, isReprint = false }) {
  const printRef = useRef()

  function handlePrint() {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Receipt - ${receipt.receipt_no}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 0;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
        .half {
          height: 148.5mm;
          overflow: hidden;
          page-break-inside: avoid;
        }
        .cut {
          border-top: 1px dashed #aaa;
          text-align: center;
          font-size: 8px;
          color: #aaa;
          padding: 0;
          height: 0;
          line-height: 0;
        }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head><body>${content}
    <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              {isReprint ? 'Reprint Receipt' : 'Print Receipt'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Prints body only on yellow pre-printed A4 letterhead
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview */}
        <div className="p-4 bg-gray-100 overflow-y-auto max-h-[70vh]">
          <p className="text-xs text-gray-400 text-center mb-1 italic">
            Preview — shaded area = pre-printed header (already on yellow paper)
          </p>

          {/* Simulated yellow paper */}
          <div ref={printRef} style={{ background: '#fffff0', border: '1px solid #d4d010', borderRadius: '4px', overflow: 'hidden' }}>

            {/* TOP HALF */}
            <div className="half" style={{ height: '148.5mm', position: 'relative' }}>
              {/* Simulated pre-printed header area */}
              <div style={{
                height: '36mm', background: 'rgba(212,208,16,0.15)',
                borderBottom: '1px dashed #ccc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '9px', color: '#999', fontStyle: 'italic' }}>
                  ↑ Pre-printed header (SBA logo + name + address on yellow paper)
                </span>
              </div>
              <ReceiptBody receipt={receipt} copy="ORIGINAL" isReprint={isReprint} />
            </div>

            {/* CUT LINE */}
            <div className="cut" style={{
              borderTop: '1px dashed #999',
              textAlign: 'center', fontSize: '8px', color: '#999',
              padding: '2px 0', background: '#f5f5d0',
            }}>
              ✂ — — — — — — — — — — — — — — — — — — — — — — — Cut Here — — — — — — — — — — — — — — — — — — — — — ✂
            </div>

            {/* BOTTOM HALF */}
            <div className="half" style={{ height: '148.5mm', position: 'relative' }}>
              <div style={{
                height: '36mm', background: 'rgba(212,208,16,0.15)',
                borderBottom: '1px dashed #ccc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: '9px', color: '#999', fontStyle: 'italic' }}>
                  ↑ Pre-printed header (duplicate half)
                </span>
              </div>
              <ReceiptBody receipt={receipt} copy="DUPLICATE (Office Copy)" isReprint={isReprint} />
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center mt-2 italic">
            💡 Tip: If text doesn't align, adjust printer margins to "None" / "Borderless"
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t flex gap-3 justify-between items-center">
          <button onClick={onClose} className="btn-secondary">Close</button>
          <div className="flex gap-2">
            <button onClick={() => toast.success('Email coming soon!')} className="btn-secondary flex items-center gap-2">
              <Mail className="w-4 h-4" /> Email
            </button>
            <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
              <Printer className="w-4 h-4" /> Print Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
