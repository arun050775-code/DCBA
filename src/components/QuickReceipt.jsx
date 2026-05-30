import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { Receipt, X, Printer, IndianRupee, Plus } from 'lucide-react'

const HEADS = [
  { key: 'welfare_stamp',  label: 'Welfare Stamp',          reportHead: 'cost' },
  { key: 'cost_imposed',   label: 'Cost Imposed by Court',  reportHead: 'cost' },
  { key: 'library',        label: 'Library Fee',            reportHead: 'library' },
  { key: 'nomination',     label: 'Nomination Fee',         reportHead: 'nomn' },
  { key: 'vehicle_sticker',label: 'Vehicle Sticker',        reportHead: 'others' },
  { key: 'others',         label: 'Others',                 reportHead: 'others' },
]

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
  const { count } = await supabase.from('income_entries').select('*', { count: 'exact', head: true }).eq('org_id', orgId)
  return `${shortName}/RCP/${fy}/${String((count || 0) + 1).padStart(4, '0')}`
}

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${String(dt.getDate()).padStart(2,'0')}-${months[dt.getMonth()]}-${dt.getFullYear()}`
}

// Receipt Print Component
function ReceiptPrintModal({ receipt, onClose }) {
  function handlePrint() {
    const content = document.getElementById('quick-receipt-print').innerHTML
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Receipt - ${receipt.receipt_no}</title>
      <style>
        @page { size: A4 portrait; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; }
        .half { height: 148.5mm; overflow: hidden; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head><body>${content}
    <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`)
    win.document.close()
  }

  function ReceiptBody({ copy }) {
    return (
      <div style={{ paddingTop:'36mm', paddingLeft:'18mm', paddingRight:'14mm', paddingBottom:'4mm', fontFamily:'Arial,sans-serif', fontSize:'11px', height:'148.5mm', boxSizing:'border-box', position:'relative' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
          <span style={{ fontSize:'8px', color:'#666', fontStyle:'italic' }}>{copy}</span>
          <span style={{ fontSize:'9px', color:'red', fontWeight:'bold' }}>{receipt.isReprint ? 'REPRINT' : ''}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px', borderBottom:'1px solid #ccc', paddingBottom:'4px' }}>
          <span><strong>Receipt No:</strong> {receipt.receipt_no}</span>
          <span><strong>Date:</strong> {formatDate(receipt.date)}</span>
        </div>
        <div style={{ marginBottom:'5px' }}><strong>Received From: </strong>{receipt.party || 'DCBA Member'}</div>
        <div style={{ display:'flex', alignItems:'baseline', gap:'8px', marginBottom:'5px' }}>
          <strong>Amount:</strong>
          <span style={{ fontSize:'15px', fontWeight:'bold' }}>₹{Number(receipt.amount).toLocaleString('en-IN')}</span>
          <span style={{ fontSize:'9px', color:'#444', fontStyle:'italic' }}>({numberToWords(Number(receipt.amount))} Rupees Only)</span>
        </div>
        <div style={{ marginBottom:'4px' }}><strong>Being: </strong>{receipt.head_label}</div>
        {receipt.details && <div style={{ marginBottom:'4px', fontSize:'10px' }}>{receipt.details}</div>}
        <div style={{ display:'flex', gap:'14px', marginBottom:'4px' }}>
          <span><strong>Mode:</strong> {receipt.mode?.toUpperCase()}</span>
          {receipt.cheque_no && <span><strong>Chq No:</strong> {receipt.cheque_no}</span>}
          {receipt.transaction_id && <span><strong>Txn ID:</strong> {receipt.transaction_id}</span>}
        </div>
        {receipt.remarks && <div style={{ fontSize:'9px', color:'#555' }}><strong>Remarks:</strong> {receipt.remarks}</div>}
        <div style={{ display:'flex', justifyContent:'space-between', position:'absolute', bottom:'8mm', left:'18mm', right:'14mm' }}>
          <div style={{ textAlign:'center', borderTop:'1px solid #999', paddingTop:'2px', width:'80px', fontSize:'9px', color:'#777' }}>Receiver</div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'9px', color:'#777', marginBottom:'10mm' }}>For Dwarka Court Bar Association</div>
            <div style={{ borderTop:'1px solid #000', paddingTop:'2px', fontSize:'10px', minWidth:'110px', textAlign:'center' }}>Authorised Signatory</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Printer className="w-5 h-5 text-blue-600" /> Print Receipt</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 bg-gray-100 overflow-y-auto max-h-[70vh]">
          <div id="quick-receipt-print" style={{ background:'#fffff0', border:'1px solid #d4d010', borderRadius:'4px', overflow:'hidden' }}>
            <div style={{ height:'148.5mm', position:'relative' }}>
              <div style={{ height:'36mm', background:'rgba(212,208,16,0.15)', borderBottom:'1px dashed #ccc', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'9px', color:'#999', fontStyle:'italic' }}>↑ DCBA Pre-printed letterhead</span>
              </div>
              <ReceiptBody copy="ORIGINAL" />
            </div>
            <div style={{ borderTop:'1px dashed #999', textAlign:'center', fontSize:'8px', color:'#999', padding:'2px 0' }}>✂ — — — Cut Here — — — ✂</div>
            <div style={{ height:'148.5mm', position:'relative' }}>
              <div style={{ height:'36mm', background:'rgba(212,208,16,0.15)', borderBottom:'1px dashed #ccc', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'9px', color:'#999', fontStyle:'italic' }}>↑ Duplicate half</span>
              </div>
              <ReceiptBody copy="DUPLICATE (Office Copy)" />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-3 justify-between">
          <button onClick={onClose} className="btn-secondary">Close</button>
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2"><Printer className="w-4 h-4" /> Print Receipt</button>
        </div>
      </div>
    </div>
  )
}

// Main Quick Receipt Modal
function QuickReceiptModal({ org, userRole, onClose, onSuccess }) {
  const [selectedHead, setSelectedHead] = useState('')
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    receipt_no: '',
    amount: '',
    party: '',
    description: '',
    remarks: '',
    // Cost imposed fields
    case_no: '',
    court_of: '',
    // SD fields
    seat_no: '',
    locker_no: '',
    // Payment
    mode: 'cash',
    cheque_no: '',
    cheque_date: new Date().toISOString().split('T')[0],
    transaction_id: '',
  })
  const [cashAccounts, setCashAccounts] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    generateReceiptNo(org.id, org.short_name).then(no => setForm(f => ({...f, receipt_no: no})))
    fetchAccounts()
  }, [])

  async function fetchAccounts() {
    const [{ data: cash }, { data: bank }] = await Promise.all([
      supabase.from('cash_accounts').select('*').eq('org_id', org.id).eq('is_active', true),
      supabase.from('bank_accounts').select('*').eq('org_id', org.id).eq('is_active', true),
    ])
    setCashAccounts(cash || [])
    setBankAccounts(bank || [])
    if (cash?.length > 0) setSelectedAccount(`cash:${cash[0].id}`)
  }

  function buildDescription() {
    const head = HEADS.find(h => h.key === selectedHead)
    if (!head) return ''
    
    let parts = [head.label]
    if (selectedHead === 'cost_imposed') {
      if (form.case_no) parts.push(`Case No: ${form.case_no}`)
      if (form.court_of) parts.push(`Court of ${form.court_of}`)
    }
    if (selectedHead === 'sd_seats' && form.seat_no) parts.push(`Seat No: ${form.seat_no}`)
    if (selectedHead === 'sd_locker' && form.locker_no) parts.push(`Locker No: ${form.locker_no}`)
    if (form.party) parts.push(`— ${form.party}`)
    if (form.description) parts.push(`| ${form.description}`)
    return parts.join(' ')
  }

  function buildDetails() {
    if (selectedHead === 'cost_imposed') {
      return [form.case_no && `Case No: ${form.case_no}`, form.court_of && `Court of: ${form.court_of}`, form.description].filter(Boolean).join(' | ')
    }
    if (selectedHead === 'sd_seats') return form.seat_no ? `Seat No: ${form.seat_no}` : ''
    if (selectedHead === 'sd_locker') return form.locker_no ? `Locker No: ${form.locker_no}` : ''
    return form.description
  }

  async function handleSave() {
    if (!selectedHead) return toast.error('Select receipt head')
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Enter amount')
    if (!selectedAccount) return toast.error('Select account')
    if (form.mode === 'cheque' && !form.cheque_no) return toast.error('Enter cheque number')

    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      const [accountType, accountId] = selectedAccount.split(':')
      const head = HEADS.find(h => h.key === selectedHead)
      const fullDesc = buildDescription()

      const { error } = await supabase.from('income_entries').insert({
        org_id: org.id,
        entry_date: form.date,
        receipt_no: form.receipt_no,
        description: fullDesc,
        items_collected: head.label,
        amount: Number(form.amount),
        payment_mode: form.mode,
        cash_account_id: accountType === 'cash' ? accountId : null,
        bank_account_id: accountType === 'bank' ? accountId : null,
        remarks: form.remarks,
        cheque_no: form.mode === 'cheque' ? form.cheque_no : null,
        cheque_date: form.mode === 'cheque' ? form.cheque_date : null,
        transaction_id: ['upi','neft'].includes(form.mode) ? form.transaction_id : null,
        cheque_status: form.mode === 'cheque' ? 'pending' : null,
        created_by: userId,
      })
      if (error) throw error

      toast.success('Receipt saved!')
      onSuccess({
        receipt_no: form.receipt_no,
        date: form.date,
        party: form.party,
        amount: Number(form.amount),
        head_label: head.label,
        details: buildDetails(),
        mode: form.mode,
        cheque_no: form.cheque_no,
        transaction_id: form.transaction_id,
        remarks: form.remarks,
      })
    } catch (err) { toast.error(err.message) }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-green-50">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Receipt className="w-5 h-5 text-green-600" /> Quick Receipt
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Receipt No & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Receipt No.</label>
              <input className="input font-mono text-sm bg-gray-50" value={form.receipt_no}
                onChange={e => setForm({...form, receipt_no: e.target.value})} />
            </div>
            <div>
              <label className="label">Date</label>
              <input type="date" className="input" value={form.date}
                onChange={e => setForm({...form, date: e.target.value})} />
            </div>
          </div>

          {/* Head Selection */}
          <div>
            <label className="label">Receipt Head *</label>
            <div className="grid grid-cols-2 gap-2">
              {HEADS.map(h => (
                <button key={h.key} onClick={() => setSelectedHead(h.key)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border text-left transition-colors ${selectedHead === h.key ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                  {h.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic fields based on head */}
          {selectedHead && (
            <>
              {/* Party/Member name */}
              <div>
                <label className="label">Received From (Party/Name)</label>
                <input className="input" value={form.party}
                  onChange={e => setForm({...form, party: e.target.value})}
                  placeholder="Name of person/party" />
              </div>

              {/* Cost Imposed extra fields */}
              {selectedHead === 'cost_imposed' && (
                <div className="space-y-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <p className="text-xs font-semibold text-blue-700 uppercase">Court Details</p>
                  <div>
                    <label className="label">Case No. *</label>
                    <input className="input font-mono" value={form.case_no}
                      onChange={e => setForm({...form, case_no: e.target.value})}
                      placeholder="e.g. CS No. 201/2024" />
                  </div>
                  <div>
                    <label className="label">Court of (Judge Name) *</label>
                    <input className="input" value={form.court_of}
                      onChange={e => setForm({...form, court_of: e.target.value})}
                      placeholder="e.g. Ld. CJ Sh. Sarthak Panwar" />
                  </div>
                </div>
              )}

              {/* SD Seats */}
              {selectedHead === 'sd_seats' && (
                <div>
                  <label className="label">Seat No.</label>
                  <input className="input" value={form.seat_no}
                    onChange={e => setForm({...form, seat_no: e.target.value})}
                    placeholder="e.g. T/8, B-12" />
                </div>
              )}

              {/* SD Locker */}
              {selectedHead === 'sd_locker' && (
                <div>
                  <label className="label">Locker No.</label>
                  <input className="input" value={form.locker_no}
                    onChange={e => setForm({...form, locker_no: e.target.value})}
                    placeholder="e.g. G-98" />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="label">Description</label>
                <input className="input" value={form.description}
                  onChange={e => setForm({...form, description: e.target.value})}
                  placeholder="Additional details..." />
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
                  <p className="text-xs text-gray-400 mt-1 italic">{numberToWords(Number(form.amount))} Rupees Only</p>
                )}
              </div>

              {/* Payment Mode */}
              <div>
                <label className="label">Payment Mode</label>
                <div className="flex gap-2 flex-wrap">
                  {['cash','cheque','upi','neft'].map(m => (
                    <button key={m} onClick={() => {
                      setForm({...form, mode: m})
                      // Auto-select appropriate account
                      if (m === 'cash' && cashAccounts.length > 0) setSelectedAccount(`cash:${cashAccounts[0].id}`)
                      else if (m !== 'cash' && bankAccounts.length > 0) setSelectedAccount(`bank:${bankAccounts[0].id}`)
                    }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border uppercase transition-colors ${form.mode === m ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cheque fields */}
              {form.mode === 'cheque' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div>
                    <label className="label">Cheque No.</label>
                    <input className="input" value={form.cheque_no}
                      onChange={e => setForm({...form, cheque_no: e.target.value})} />
                  </div>
                  <div>
                    <label className="label">Cheque Date</label>
                    <input type="date" className="input" value={form.cheque_date}
                      onChange={e => setForm({...form, cheque_date: e.target.value})} />
                  </div>
                </div>
              )}

              {/* UPI/NEFT */}
              {['upi','neft'].includes(form.mode) && (
                <div>
                  <label className="label">Transaction ID</label>
                  <input className="input font-mono" value={form.transaction_id}
                    onChange={e => setForm({...form, transaction_id: e.target.value})}
                    placeholder={form.mode === 'upi' ? 'UPI Ref No.' : 'NEFT Ref No.'} />
                </div>
              )}

              {/* Account */}
              {/* Account Selection */}
              <div>
                <label className="label">Credit To *</label>
                {form.mode === 'cash' ? (
                  <select className="input" value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}>
                    {cashAccounts.map(c => <option key={c.id} value={`cash:${c.id}`}>Cash — {c.cashier_name}</option>)}
                  </select>
                ) : (
                  <select className="input" value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}>
                    {bankAccounts.map(b => <option key={b.id} value={`bank:${b.id}`}>{b.account_name} — {b.bank_name}</option>)}
                  </select>
                )}
              </div>

              {/* Remarks */}
              <div>
                <label className="label">Remarks</label>
                <input className="input" value={form.remarks}
                  onChange={e => setForm({...form, remarks: e.target.value})} placeholder="Optional" />
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving || !selectedHead}
            className="btn-success flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save & Print'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Main exported component — button + modals
export default function QuickReceipt() {
  const { currentOrg, userRole } = useAuth()
  const [showModal, setShowModal] = useState(false)
  const [printReceipt, setPrintReceipt] = useState(null)

  if (!currentOrg) return null

  return (
    <>
      <button onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 z-40 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-2 font-semibold transition-all">
        <Plus className="w-5 h-5" /> Quick Receipt
      </button>

      {showModal && (
        <QuickReceiptModal
          org={currentOrg}
          userRole={userRole}
          onClose={() => setShowModal(false)}
          onSuccess={(receipt) => {
            setShowModal(false)
            setPrintReceipt(receipt)
          }}
        />
      )}

      {printReceipt && (
        <ReceiptPrintModal
          receipt={printReceipt}
          onClose={() => setPrintReceipt(null)}
        />
      )}
    </>
  )
}
