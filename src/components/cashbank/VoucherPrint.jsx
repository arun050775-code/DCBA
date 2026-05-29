import { useRef } from 'react'
import { X, Printer } from 'lucide-react'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()}`
}

function VoucherBody({ voucher, copy }) {
  const isReceipt = voucher.type === 'receipt'
  return (
    <div style={{ paddingTop:'36mm', paddingLeft:'18mm', paddingRight:'14mm', paddingBottom:'4mm', fontFamily:'Arial,sans-serif', fontSize:'11px', height:'148.5mm', boxSizing:'border-box', position:'relative' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
        <span style={{ fontSize:'8px', color:'#666', fontStyle:'italic' }}>{copy}</span>
        <span style={{ fontSize:'9px', fontWeight:'bold', color: isReceipt ? '#166534' : '#991b1b' }}>
          {isReceipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER'}
        </span>
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px', borderBottom:'1px solid #ccc', paddingBottom:'4px' }}>
        <span><strong>{isReceipt ? 'Receipt' : 'Voucher'} No:</strong> {voucher.ref_no}</span>
        <span><strong>Date:</strong> {formatDate(voucher.date)}</span>
      </div>

      {voucher.payee_name && (
        <div style={{ marginBottom:'5px' }}>
          <strong>{isReceipt ? 'Received From' : 'Paid To'}: </strong>{voucher.payee_name}
        </div>
      )}

      <div style={{ display:'flex', alignItems:'baseline', gap:'8px', marginBottom:'5px' }}>
        <strong>Amount:</strong>
        <span style={{ fontSize:'15px', fontWeight:'bold' }}>₹{Number(voucher.amount).toLocaleString('en-IN')}</span>
        <span style={{ fontSize:'9px', color:'#444', fontStyle:'italic' }}>({voucher.amount_words})</span>
      </div>

      {voucher.head && (
        <div style={{ marginBottom:'4px' }}>
          <strong>Account Head: </strong>{voucher.head}{voucher.sub_head ? ` → ${voucher.sub_head}` : ''}
        </div>
      )}

      {voucher.description && (
        <div style={{ marginBottom:'4px' }}>
          <strong>Description: </strong>{voucher.description}
        </div>
      )}

      <div style={{ display:'flex', gap:'14px', marginBottom:'4px', flexWrap:'wrap' }}>
        <span><strong>Mode:</strong> {voucher.payment_mode?.toUpperCase()}</span>
        {voucher.cheque_no && <span><strong>Chq No:</strong> {voucher.cheque_no}</span>}
        {voucher.cheque_date && <span><strong>Chq Date:</strong> {formatDate(voucher.cheque_date)}</span>}
        {voucher.bank_name && <span><strong>Bank:</strong> {voucher.bank_name}{voucher.bank_account_no ? ` (${voucher.bank_account_no})` : ''}</span>}
        {voucher.transaction_id && <span><strong>Txn ID:</strong> {voucher.transaction_id}</span>}
      </div>

      {voucher.remarks && (
        <div style={{ fontSize:'9px', color:'#555', marginBottom:'4px' }}>
          <strong>Remarks:</strong> {voucher.remarks}
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', position:'absolute', bottom:'8mm', left:'18mm', right:'14mm' }}>
        <div style={{ textAlign:'center', borderTop:'1px solid #999', paddingTop:'2px', width:'80px', fontSize:'9px', color:'#777' }}>
          {isReceipt ? 'Receiver' : 'Payee'}
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:'9px', color:'#777', marginBottom:'10mm' }}>For Dwarka Court Bar Association</div>
          <div style={{ borderTop:'1px solid #000', paddingTop:'2px', fontSize:'10px', minWidth:'110px', textAlign:'center' }}>
            {voucher.cashier_name || 'Authorised Signatory'}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function VoucherPrint({ voucher, org, onClose }) {
  const printRef = useRef()

  function handlePrint() {
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>Voucher - ${voucher.ref_no}</title>
      <style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif}.half{height:148.5mm;overflow:hidden;page-break-inside:avoid}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
    </head><body>${printRef.current.innerHTML}
    <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              {voucher.type === 'receipt' ? 'Print Receipt Voucher' : 'Print Payment Voucher'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">Prints on DCBA pre-printed A4 letterhead · 2 copies per sheet</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 bg-gray-100 overflow-y-auto max-h-[70vh]">
          <div ref={printRef} style={{ background:'#fffff0', border:'1px solid #d4d010', borderRadius:'4px', overflow:'hidden' }}>
            <div className="half" style={{ height:'148.5mm', position:'relative' }}>
              <div style={{ height:'36mm', background:'rgba(212,208,16,0.15)', borderBottom:'1px dashed #ccc', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'9px', color:'#999', fontStyle:'italic' }}>↑ DCBA Pre-printed letterhead</span>
              </div>
              <VoucherBody voucher={voucher} copy="ORIGINAL" />
            </div>
            <div style={{ borderTop:'1px dashed #999', textAlign:'center', fontSize:'8px', color:'#999', padding:'2px 0', background:'#f5f5d0' }}>
              ✂ — — — Cut Here — — — ✂
            </div>
            <div className="half" style={{ height:'148.5mm', position:'relative' }}>
              <div style={{ height:'36mm', background:'rgba(212,208,16,0.15)', borderBottom:'1px dashed #ccc', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'9px', color:'#999', fontStyle:'italic' }}>↑ Duplicate half</span>
              </div>
              <VoucherBody voucher={voucher} copy="DUPLICATE (Office Copy)" />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-between">
          <button onClick={onClose} className="btn-secondary">Close</button>
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print Voucher
          </button>
        </div>
      </div>
    </div>
  )
}
