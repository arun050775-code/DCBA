import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { Car, Printer, Mail, CheckCircle, RefreshCw } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmt(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`
}

export default function StickerPrint() {
  const { currentOrg } = useAuth()
  const [stickers, setStickers] = useState([])
  const [loading, setLoading] = useState(true)
  const [vehicleTab, setVehicleTab] = useState('2W') // 2W | 4W
  const [statusTab, setStatusTab] = useState('pending') // pending | sent | all
  const [printerEmail, setPrinterEmail] = useState('printer@dcba.in')
  const [sending, setSending] = useState(null)
  const [selected, setSelected] = useState([])

  useEffect(() => { if (currentOrg) { fetchData(); fetchSettings() } }, [currentOrg, vehicleTab, statusTab])

  async function fetchSettings() {
    const { data } = await supabase.from('org_settings').select('printer_email').eq('org_id', currentOrg.id).single()
    if (data?.printer_email) setPrinterEmail(data.printer_email)
  }

  async function fetchData() {
    setLoading(true)
    let q = supabase.from('dcba_vehicle_stickers')
      .select('*')
      .eq('org_id', currentOrg.id)
      .eq('vehicle_type', vehicleTab)
      .order('created_at', { ascending: false })

    if (statusTab === 'pending') q = q.eq('sticker_status', 'pending')
    else if (statusTab === 'sent') q = q.eq('sticker_status', 'sent_to_printer')

    const { data } = await q
    setStickers(data || [])
    setSelected([])
    setLoading(false)
  }

  function toggleSelect(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  }

  function toggleSelectAll() {
    setSelected(selected.length === stickers.length ? [] : stickers.map(s => s.id))
  }

  async function sendToPrinter(ids) {
    if (ids.length === 0) return toast.error('Select at least one sticker')
    setSending('batch')
    try {
      const items = stickers.filter(s => ids.includes(s.id))

      const emailBody = `
DWARKA COURT BAR ASSOCIATION (REGD.)
VEHICLE STICKER PRINTING REQUEST — ${vehicleTab === '2W' ? 'TWO WHEELER' : 'FOUR WHEELER'}
================================================

DATE: ${fmt(new Date())}
TOTAL STICKERS: ${items.length}

${items.map((s, i) => `
${i+1}. NAME         : ${s.member_name}
   MEMBERSHIP NO.: ${s.member_no}
   MOBILE        : ${s.mobile || '—'}
   VEHICLE NO.   : ${s.vehicle_no}
   VEHICLE MAKE  : ${s.vehicle_make || '—'}
`).join('')}

================================================
Please print personalized ${vehicleTab} stickers as per DCBA standard format.
      `.trim()

      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: printerEmail,
          subject: `Vehicle Sticker Print Request — ${vehicleTab} (${items.length} stickers)`,
          text: emailBody,
        }
      })

      await supabase.from('dcba_vehicle_stickers').update({
        sticker_status: 'sent_to_printer',
        sticker_sent_at: new Date().toISOString(),
      }).in('id', ids)

      if (error) {
        toast('Marked as sent. Email delivery may need manual follow-up.', { icon: '⚠️' })
      } else {
        toast.success(`${items.length} sticker(s) sent to ${printerEmail}`)
      }
      fetchData()
    } catch (err) {
      toast.error(err.message)
    }
    setSending(null)
  }

  function printList(ids) {
    const items = stickers.filter(s => ids.includes(s.id))
    if (items.length === 0) return toast.error('Select at least one sticker')

    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
    <title>Vehicle Stickers — ${vehicleTab}</title>
    <style>
      @page { margin: 12mm; size: A4; }
      body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
      h1 { font-size: 14px; text-align: center; margin-bottom: 2px; }
      h2 { font-size: 11px; text-align: center; margin-bottom: 12px; color: #555; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1a3a5c; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
      td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
      tr:nth-child(even) { background: #f9f9f9; }
      @media print { body { -webkit-print-color-adjust: exact; } }
    </style></head><body>
    <h1>DWARKA COURT BAR ASSOCIATION</h1>
    <h2>Vehicle Sticker List — ${vehicleTab === '2W' ? 'Two Wheeler' : 'Four Wheeler'} · Printed: ${fmt(new Date())}</h2>
    <table>
      <thead><tr><th>#</th><th>Name</th><th>Membership No.</th><th>Mobile</th><th>Vehicle No.</th><th>Make</th></tr></thead>
      <tbody>
        ${items.map((s, i) => `
          <tr><td>${i+1}</td><td>${s.member_name}</td><td>${s.member_no}</td><td>${s.mobile||'—'}</td><td>${s.vehicle_no}</td><td>${s.vehicle_make||'—'}</td></tr>
        `).join('')}
      </tbody>
    </table>
    <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Car className="w-6 h-6 text-blue-700" /> Vehicle Sticker Printing
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="text-xs text-gray-400 flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" /> Printer: <strong className="text-gray-600">{printerEmail}</strong>
          </div>
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Vehicle Type Tabs */}
      <div className="flex gap-1 mb-3 bg-gray-100 p-1 rounded-xl w-fit">
        {['2W', '4W'].map(t => (
          <button key={t} onClick={() => setVehicleTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${vehicleTab === t ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === '2W' ? '🛵 Two Wheeler' : '🚗 Four Wheeler'}
          </button>
        ))}
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'pending', label: 'Pending Print' },
          { id: 'sent', label: 'Sent to Printer' },
          { id: 'all', label: 'All' },
        ].map(t => (
          <button key={t.id} onClick={() => setStatusTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusTab === t.id ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Actions bar */}
      {stickers.length > 0 && (
        <div className="flex items-center justify-between mb-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={selected.length === stickers.length && stickers.length > 0}
              onChange={toggleSelectAll} className="w-4 h-4" />
            {selected.length > 0 ? `${selected.length} selected` : 'Select all'}
          </label>
          <div className="flex gap-2">
            <button onClick={() => printList(selected.length ? selected : stickers.map(s=>s.id))}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg font-medium flex items-center gap-1">
              <Printer className="w-3.5 h-3.5" /> Print List
            </button>
            {statusTab !== 'sent' && (
              <button onClick={() => sendToPrinter(selected.length ? selected : stickers.map(s=>s.id))}
                disabled={sending}
                className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg font-medium flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {sending ? 'Sending...' : `Send to Printer (${selected.length || stickers.length})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading...</div>
      ) : stickers.length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          <Car className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No {vehicleTab} stickers {statusTab === 'pending' ? 'pending for print' : ''}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="p-3 w-10"></th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500">Name</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500">Member No.</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500">Mobile</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500">Vehicle No.</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500">Make</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500">Fee</th>
                <th className="p-3 text-left text-xs font-semibold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody>
              {stickers.map(s => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <input type="checkbox" checked={selected.includes(s.id)}
                      onChange={() => toggleSelect(s.id)} className="w-4 h-4" />
                  </td>
                  <td className="p-3 font-medium text-gray-800">{s.member_name}</td>
                  <td className="p-3 text-blue-700 font-semibold">{s.member_no}</td>
                  <td className="p-3 text-gray-500">{s.mobile || '—'}</td>
                  <td className="p-3 font-mono">{s.vehicle_no}</td>
                  <td className="p-3 text-gray-500">{s.vehicle_make || '—'}</td>
                  <td className="p-3">
                    {Number(s.fee_charged) > 0
                      ? <span className="text-amber-600 font-medium">₹{s.fee_charged}</span>
                      : <span className="text-green-600">Free</span>}
                  </td>
                  <td className="p-3">
                    {s.sticker_status === 'sent_to_printer'
                      ? <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3"/> Sent</span>
                      : <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full w-fit">Pending</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
