import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { CreditCard, Printer, Mail, CheckCircle, Clock, RefreshCw, Eye } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmt(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`
}

export default function ICardPrint() {
  const { currentOrg, userRole } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending') // pending | sent | all
  const [printerEmail, setPrinterEmail] = useState('printer@dcba.in')
  const [previewCard, setPreviewCard] = useState(null)
  const [sending, setSending] = useState(null)

  useEffect(() => { if (currentOrg) { fetchData(); fetchSettings() } }, [currentOrg, tab])

  async function fetchSettings() {
    const { data } = await supabase.from('org_settings').select('printer_email').eq('org_id', currentOrg.id).single()
    if (data?.printer_email) setPrinterEmail(data.printer_email)
  }

  async function fetchData() {
    setLoading(true)
    let q = supabase.from('dcba_member_requests')
      .select('*, dcba_members(member_name, member_no, enrollment_no, membership_date, mobile, email, address, office, chamber, blood_group, dob)')
      .eq('org_id', currentOrg.id)
      .eq('request_type', 'icard')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })

    if (tab === 'pending') q = q.in('icard_status', ['pending', null])
    else if (tab === 'sent') q = q.eq('icard_status', 'sent_to_printer')

    const { data } = await q
    setRequests(data || [])
    setLoading(false)
  }

  async function sendToPrinter(req) {
    setSending(req.id)
    try {
      const m = req.dcba_members
      const photoUrl = `https://xalbjrmridjgdpguobdx.supabase.co/storage/v1/object/public/member-photos/${m.member_no}.png`

      // Email body
      const emailBody = `
DWARKA COURT BAR ASSOCIATION (REGD.)
I-CARD PRINTING REQUEST
================================

REQUEST NO: ${req.request_no}
DATE: ${fmt(new Date())}

MEMBER DETAILS:
---------------
Name         : ${m.member_name}
Member No.   : ${m.member_no}  (= I-Card No.)
Designation  : Advocate
Enrollment No: ${m.enrollment_no || '—'}
Membership   : ${fmt(m.membership_date)}
Mobile       : ${m.mobile || '—'}
Blood Group  : ${m.blood_group || '—'}

ADDRESS (RESIDENTIAL):
${m.address || '—'}

OFFICE / CHAMBER:
${m.office || m.chamber || '—'}

PHOTO URL:
${photoUrl}

AUTHORISED BY:
President  : AVNISH RANA
Secretary  : KARAN VEER TYAGI

================================
Please print I-Card as per DCBA standard format.
      `.trim()

      // Send via Supabase Edge Function (email)
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: printerEmail,
          subject: `I-Card Print Request — ${m.member_name} (${m.member_no})`,
          text: emailBody,
        }
      })

      // Even if email fails — mark as sent (manual follow up)
      await supabase.from('dcba_member_requests').update({
        icard_status: 'sent_to_printer',
        icard_sent_at: new Date().toISOString(),
      }).eq('id', req.id)

      if (error) {
        toast('Marked as sent. Email delivery may need manual follow-up.', { icon: '⚠️' })
      } else {
        toast.success(`I-Card details sent to ${printerEmail}`)
      }
      fetchData()
    } catch (err) {
      toast.error(err.message)
    }
    setSending(null)
  }

  function printICard(req) {
    const m = req.dcba_members
    const photoUrl = `https://xalbjrmridjgdpguobdx.supabase.co/storage/v1/object/public/member-photos/${m.member_no}.png`
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
    <title>I-Card — ${m.member_name}</title>
    <style>
      @page { margin: 0; size: 85.6mm 54mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; width: 85.6mm; height: 54mm; }
      .card { width: 85.6mm; height: 54mm; position: relative; overflow: hidden; }
      
      /* FRONT */
      .front { background: #fff; border: 1px solid #ccc; display: flex; flex-direction: column; }
      .front-header { background: #1a3a5c; color: white; padding: 3px 6px; display: flex; align-items: center; gap: 4px; }
      .front-header h1 { font-size: 7px; font-weight: bold; }
      .front-header p { font-size: 5px; }
      .front-body { display: flex; flex: 1; padding: 4px 6px; gap: 6px; }
      .front-photo { width: 22mm; height: 28mm; border: 1px solid #ccc; object-fit: cover; flex-shrink: 0; }
      .front-info { flex: 1; }
      .member-name { font-size: 10px; font-weight: bold; color: #1a3a5c; margin-bottom: 2px; }
      .designation { font-size: 7px; color: #555; margin-bottom: 4px; }
      .field { font-size: 6.5px; margin-bottom: 2px; }
      .field span { font-weight: bold; }
      .watermark { position: absolute; opacity: 0.06; font-size: 40px; font-weight: bold; color: #1a3a5c; transform: rotate(-30deg); top: 10mm; left: 8mm; white-space: nowrap; }
      .front-footer { background: #c8960c; padding: 2px 6px; display: flex; justify-content: space-between; }
      .sig-box { text-align: center; font-size: 5px; color: #1a3a5c; }
      
      /* BACK */
      .back { background: #fff; border: 1px solid #ccc; margin-top: 4mm; }
      .back-header { background: #1a3a5c; color: #c8960c; padding: 2px 6px; font-size: 7px; font-weight: bold; }
      .back-body { padding: 4px 6px; }
      .back-field { font-size: 6.5px; margin-bottom: 3px; display: flex; gap: 4px; }
      .back-label { color: #555; width: 22mm; flex-shrink: 0; }
      .back-value { font-weight: bold; color: #222; }
      .back-footer { text-align: right; padding: 2px 6px; font-size: 6px; color: #555; border-top: 0.5px solid #eee; }
      
      @media print { 
        @page { margin: 0; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
    </head><body>
    
    <!-- FRONT -->
    <div class="card front">
      <div class="watermark">DCBA</div>
      <div class="front-header">
        <div>
          <h1>DWARKA COURT BAR ASSOCIATION (REGD.)</h1>
          <p>Dwarka Court Complex, Sector-10, Dwarka, New Delhi-110 075</p>
          <p>Ph.: 011-35017651 &nbsp;|&nbsp; dwarkacourtbarassociation@gmail.com</p>
        </div>
      </div>
      <div class="front-body">
        <img class="front-photo" src="${photoUrl}" alt="Photo" onerror="this.style.background='#eee';this.src=''" />
        <div class="front-info">
          <div class="member-name">${m.member_name}</div>
          <div class="designation">Advocate</div>
          <div class="field">Membership No.: <span>${m.member_no}</span></div>
          <div class="field">Enrollment No.: <span>${m.enrollment_no || '—'}</span></div>
          <div class="field">Estd. 2008</div>
        </div>
      </div>
      <div class="front-footer">
        <div class="sig-box">
          <div style="border-top:0.5px solid #1a3a5c; width:22mm; margin-bottom:1px;"></div>
          AVNISH RANA<br/>President
        </div>
        <div class="sig-box">
          Member's Sign.
          <div style="border-top:0.5px solid #1a3a5c; width:22mm; margin-top:6px;"></div>
        </div>
        <div class="sig-box">
          <div style="border-top:0.5px solid #1a3a5c; width:22mm; margin-bottom:1px;"></div>
          KARAN VEER TYAGI<br/>Hony. Secretary
        </div>
      </div>
    </div>

    <!-- BACK -->
    <div class="card back">
      <div class="back-header">DWARKA COURT BAR ASSOCIATION — IDENTITY CARD</div>
      <div class="back-body">
        <div class="back-field"><span class="back-label">Address :</span><span class="back-value">${m.address || '—'}</span></div>
        <div class="back-field"><span class="back-label">Off. Address :</span><span class="back-value">${m.office || m.chamber || '—'}</span></div>
        <div class="back-field"><span class="back-label">Mobile :</span><span class="back-value">${m.mobile || '—'}</span></div>
        <div class="back-field"><span class="back-label">Blood Group :</span><span class="back-value">${m.blood_group || '—'}</span></div>
      </div>
      <div class="back-footer">Identity Card No.: ${m.member_no} &nbsp;|&nbsp; Valid while membership is active</div>
    </div>

    <script>window.onload=function(){window.print();setTimeout(()=>window.close(),800)}<\/script>
    </body></html>`)
    win.document.close()
  }

  const tabs = [
    { id: 'pending', label: `Pending Print (${tab === 'pending' ? requests.length : '...'})` },
    { id: 'sent', label: 'Sent to Printer' },
    { id: 'all', label: 'All' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-blue-700" /> I-Card Printing
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
        </div>
        <div className="flex gap-2">
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" /> Printer: <strong className="text-gray-600">{printerEmail}</strong>
          </div>
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading...</div>
      ) : requests.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No I-Card requests {tab === 'pending' ? 'pending for print' : ''}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const m = req.dcba_members
            const photoUrl = `https://xalbjrmridjgdpguobdx.supabase.co/storage/v1/object/public/member-photos/${m?.member_no}.png`
            return (
              <div key={req.id} className="card p-4 flex items-center gap-4">
                {/* Photo */}
                <div className="w-14 h-16 border border-gray-200 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                  <img src={photoUrl} alt={m?.member_name}
                    className="w-full h-full object-cover"
                    onError={e => { e.target.parentElement.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:18px;font-weight:700;color:#1a3a5c">${m?.member_name?.slice(0,2)}</div>` }} />
                </div>

                {/* Info */}
                <div className="flex-1">
                  <p className="font-bold text-gray-800">{m?.member_name}</p>
                  <p className="text-sm text-blue-700 font-semibold">{m?.member_no}</p>
                  <div className="flex gap-4 mt-1 text-xs text-gray-500">
                    <span>Enrollment: {m?.enrollment_no || '—'}</span>
                    <span>Mobile: {m?.mobile || '—'}</span>
                    <span>Blood Group: {m?.blood_group || '—'}</span>
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    <span>Request: {req.request_no}</span>
                    <span>Date: {fmt(req.request_date)}</span>
                    {req.icard_sent_at && <span className="text-green-600">✅ Sent: {fmt(req.icard_sent_at)}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button onClick={() => setPreviewCard(req)}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg font-medium flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Preview
                  </button>
                  <button onClick={() => printICard(req)}
                    className="px-3 py-1.5 bg-blue-100 text-blue-700 text-xs rounded-lg font-medium flex items-center gap-1">
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                  {req.icard_status !== 'sent_to_printer' ? (
                    <button onClick={() => sendToPrinter(req)} disabled={sending === req.id}
                      className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg font-medium flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" />
                      {sending === req.id ? 'Sending...' : 'Send to Printer'}
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs rounded-lg font-medium flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Sent
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Preview Modal */}
      {previewCard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold">I-Card Preview — {previewCard.dcba_members?.member_name}</h3>
              <button onClick={() => setPreviewCard(null)} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
            </div>
            <div className="p-6">
              {/* Front Preview */}
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden mb-3">
                <div className="bg-[#1a3a5c] text-white px-3 py-2">
                  <p className="font-bold text-xs">DWARKA COURT BAR ASSOCIATION (REGD.)</p>
                  <p className="text-xs text-blue-300">Dwarka Court Complex, Sector-10, New Delhi-110 075</p>
                </div>
                <div className="flex p-3 gap-3">
                  <img
                    src={`https://xalbjrmridjgdpguobdx.supabase.co/storage/v1/object/public/member-photos/${previewCard.dcba_members?.member_no}.png`}
                    alt="Photo"
                    className="w-16 h-20 object-cover border border-gray-200 rounded flex-shrink-0 bg-gray-100"
                    onError={e => { e.target.style.background='#eee' }} />
                  <div>
                    <p className="font-bold text-[#1a3a5c] text-sm">{previewCard.dcba_members?.member_name}</p>
                    <p className="text-xs text-gray-500 mb-2">Advocate</p>
                    <p className="text-xs">Membership No.: <strong>{previewCard.dcba_members?.member_no}</strong></p>
                    <p className="text-xs">Enrollment No.: <strong>{previewCard.dcba_members?.enrollment_no || '—'}</strong></p>
                  </div>
                </div>
                <div className="bg-[#c8960c] px-3 py-1.5 flex justify-between text-xs text-[#1a3a5c] font-medium">
                  <span>AVNISH RANA · President</span>
                  <span>KARAN VEER TYAGI · Secy.</span>
                </div>
              </div>
              {/* Back Preview */}
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-[#1a3a5c] text-[#c8960c] px-3 py-1.5 text-xs font-bold">IDENTITY CARD — BACK</div>
                <div className="p-3 space-y-1.5 text-xs">
                  <div className="flex gap-2"><span className="text-gray-400 w-24">Address:</span><span className="font-medium">{previewCard.dcba_members?.address || '—'}</span></div>
                  <div className="flex gap-2"><span className="text-gray-400 w-24">Off. Address:</span><span className="font-medium">{previewCard.dcba_members?.office || previewCard.dcba_members?.chamber || '—'}</span></div>
                  <div className="flex gap-2"><span className="text-gray-400 w-24">Mobile:</span><span className="font-medium">{previewCard.dcba_members?.mobile || '—'}</span></div>
                  <div className="flex gap-2"><span className="text-gray-400 w-24">Blood Group:</span><span className="font-medium">{previewCard.dcba_members?.blood_group || '—'}</span></div>
                </div>
                <div className="border-t border-gray-100 px-3 py-1 text-xs text-gray-400 text-right">
                  Identity Card No.: {previewCard.dcba_members?.member_no}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setPreviewCard(null)} className="btn-secondary">Close</button>
              <button onClick={() => printICard(previewCard)} className="btn-secondary flex items-center gap-2">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={() => { sendToPrinter(previewCard); setPreviewCard(null) }}
                className="btn-primary flex items-center gap-2">
                <Mail className="w-4 h-4" /> Send to Printer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
