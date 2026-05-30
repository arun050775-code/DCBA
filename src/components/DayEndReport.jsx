import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { FileText, Printer, Download, Search, List, BarChart2, Calendar, X } from 'lucide-react'
import * as XLSX from 'xlsx'

const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()

// Income head columns — legacy DCBA format
const HEADS = [
  { key: 'admi',       label: 'Admi.\nFee',      short: 'Admi.' },
  { key: 'sub',        label: 'Subscription',     short: 'Sub.' },
  { key: 'rent',       label: 'Rent',             short: 'Rent' },
  { key: 'nomn',       label: "Nom'n.\nFee",      short: 'Nom.' },
  { key: 'cost',       label: 'Cost/\nMisc',      short: 'Cost/Misc' },
  { key: 'sd_seats',   label: 'SD.\nSeats',       short: 'SD.Seats' },
  { key: 'library',    label: 'Library',          short: 'Library' },
  { key: 'icard',      label: 'I.\nCard',         short: 'I.Card' },
  { key: 'sd_locker',  label: 'SD.\nLocker',      short: 'SD.Locker' },
  { key: 'others',     label: 'Others',           short: 'Others' },
]

// Fixed fee amounts
const ADMISSION_FEE = 600
const ANNUAL_FEE = 600
const ICARD_FEE = 50

// Extract amount from description string e.g. "Admission Fee ₹600"
function extractAmount(str, keyword) {
  const regex = new RegExp(keyword + '[^₹]*₹([\\d,]+)', 'i')
  const m = str.match(regex)
  return m ? parseInt(m[1].replace(',','')) : 0
}

// Map entry to head keys with correct amount splitting
function mapToHead(entry) {
  const result = {}
  HEADS.forEach(h => result[h.key] = 0)

  const amt = entry.amount
  const items = (entry.items_collected || '').toLowerCase()
  const desc = (entry.description || '').toLowerCase()
  const head = (entry.head || '').toLowerCase()

  // Rent collection
  if (entry.source === 'rent' || head.includes('rent income')) {
    result.rent = amt
    return result
  }

  // Online payment — map by fee_type / items
  if (entry.source === 'online') {
    const items = (entry.items_collected || '').toLowerCase()
    if (items.includes('annual') || items.includes('subscription')) { result.sub = amt; return result }
    if (items.includes('icard') || items.includes('i-card')) { result.icard = amt; return result }
    if (items.includes('admission')) { result.admi = amt; return result }
    result.sub = amt; return result
  }

  // Bounce reversal — skip or put in others
  if (desc.includes('bounce reversal')) {
    result.others = amt
    return result
  }

  // Try to parse from items_collected first
  const hasItems = items.length > 0
  const hasAdmi = items.includes('admission') || desc.includes('admission fee')
  const hasSub = items.includes('annual subscription') || items.includes('subscription') || desc.includes('annual subscription') || desc.includes('subscription')
  const hasIcard = items.includes('i-card') || items.includes('icard') || desc.includes('i-card') || desc.includes('i card')
  const hasAccrued = items.includes('accrued') || desc.includes('accrued dues')

  if (hasAdmi || hasSub || hasIcard || hasAccrued) {
    // Try to extract exact amounts from description
    const admiAmt = extractAmount(entry.description || '', 'Admission Fee') || (hasAdmi ? ADMISSION_FEE : 0)
    const subAmt = extractAmount(entry.description || '', 'Annual Subscription') ||
                   extractAmount(entry.description || '', 'Subscription') ||
                   extractAmount(entry.description || '', 'Accrued') || 0
    const icardAmt = extractAmount(entry.description || '', 'I.Card') ||
                     extractAmount(entry.description || '', 'I-Card') || (hasIcard ? ICARD_FEE : 0)

    const parsed = admiAmt + subAmt + icardAmt

    if (parsed > 0) {
      result.admi = admiAmt
      result.sub = subAmt
      result.icard = icardAmt
      // Remaining goes to subscription
      if (amt > parsed) result.sub += (amt - parsed)
    } else {
      // Fallback: use fixed amounts
      if (hasAdmi) result.admi = ADMISSION_FEE
      if (hasSub || hasAccrued) result.sub = amt - (hasAdmi ? ADMISSION_FEE : 0) - (hasIcard ? ICARD_FEE : 0)
      if (hasIcard) result.icard = ICARD_FEE
      if (result.sub < 0) result.sub = 0
      // Remaining → subscription
      const allocated = result.admi + result.sub + result.icard
      if (amt > allocated) result.sub += (amt - allocated)
    }
    return result
  }

  // Advance payment → subscription
  if (desc.includes('advance') || head.includes('advance')) {
    result.sub = amt; return result
  }

  // Single head mappings
  if (head.includes('nomination') || desc.includes('nomination')) { result.nomn = amt; return result }
  if (head.includes('cost') || head.includes('misc') || head.includes('welfare') || desc.includes('welfare') || desc.includes('cost imposed')) { result.cost = amt; return result }
  if (head.includes('sd seat') || desc.includes('sd seat') || desc.includes('security deposit seat')) { result.sd_seats = amt; return result }
  if (head.includes('library') || desc.includes('library')) { result.library = amt; return result }
  if (head.includes('locker') || desc.includes('locker')) { result.sd_locker = amt; return result }

  // Default → others
  result.others = amt
  return result
}

function formatDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`
}

function isCash(e) {
  return (e.mode || '').toUpperCase() === 'CASH'
}
function isOnline(e) {
  return (e.mode || '').toUpperCase() === 'ONLINE'
}
function isBank(e) {
  return !isCash(e) && !isOnline(e)
}

export default function DayEndReport() {
  const { currentOrg, userRole } = useAuth()
  const role = userRole?.role
  const isSupervisor = ['admin','supervisor'].includes(role)

  const today = new Date().toISOString().split('T')[0]
  const [view, setView] = useState('detail')
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)
  const [cashierFilter, setCashierFilter] = useState(isSupervisor ? 'all' : 'mine')
  const [printMode, setPrintMode] = useState('both')
  const [cashiers, setCashiers] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const [reprintEntry, setReprintEntry] = useState(null)
  const printRef = useRef()

  useEffect(() => { if (currentOrg) { fetchCashiers() } }, [currentOrg])

  async function fetchCashiers() {
    const { data } = await supabase.from('user_roles')
      .select('user_id, name').eq('org_id', currentOrg.id)
      .in('role', ['cashier','supervisor']).eq('is_active', true)
    setCashiers(data || [])
  }

  async function fetchReport() {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id

      let startDate, endDate
      if (view === 'monthly') {
        startDate = `${filterYear}-${String(filterMonth).padStart(2,'0')}-01`
        endDate = new Date(filterYear, filterMonth, 0).toISOString().split('T')[0]
      } else {
        startDate = fromDate; endDate = toDate
      }

      let q = supabase.from('income_entries')
        .select('*, account_heads(name), cash_accounts(cashier_name), bank_accounts(account_name)')
        .eq('org_id', currentOrg.id)
        .eq('is_cancelled', false)
        .gte('entry_date', startDate).lte('entry_date', endDate)
        .order('entry_date').order('created_at')

      if (!isSupervisor || cashierFilter === 'mine') {
        // For cashier - show their entries OR entries with no created_by
        if (!isSupervisor) {
          q = q.or(`created_by.eq.${userId},created_by.is.null`)
        } else {
          q = q.eq('created_by', userId)
        }
      } else if (cashierFilter !== 'all') {
        q = q.eq('created_by', cashierFilter)
      }

      let qr = supabase.from('rent_collections')
        .select('*, vendors(name), cash_accounts(cashier_name), bank_accounts(account_name)')
        .eq('org_id', currentOrg.id)
        .gte('collection_date', startDate).lte('collection_date', endDate)
        .order('collection_date')

      // Online payments — always show all for org (no cashier filter, member portal payments)
      let qo = supabase.from('dcba_member_fees')
        .select('*, dcba_members(member_name, member_no)')
        .eq('org_id', currentOrg.id)
        .eq('payment_mode', 'online')
        .gte('payment_date', startDate).lte('payment_date', endDate)
        .order('payment_date')

      const [{ data: inc, error: e1 }, { data: rent }, { data: online }] = await Promise.all([q, qr, qo])
      if (e1) throw e1

      const combined = [
        ...(inc || []).map(e => ({
          date: e.entry_date,
          receipt_no: e.receipt_no || '—',
          party: e.description?.split('—')[1]?.split('|')[0]?.trim() || e.description || '—',
          mode: (e.payment_mode || 'cash').toUpperCase(),
          amount: Number(e.amount),
          head: e.account_heads?.name || 'Member Fee',
          description: e.description || '',
          remarks: e.remarks || '',
          items_collected: e.items_collected || '',
          source: 'income',
        })),
        ...((isSupervisor || cashierFilter === 'all') ? (rent || []).map(r => ({
          date: r.collection_date,
          receipt_no: r.receipt_no || '—',
          party: r.vendors?.name || '—',
          mode: (r.payment_mode || 'cash').toUpperCase(),
          amount: Number(r.amount),
          head: 'Vendor Rent Income',
          description: `Rent — ${r.months_covered || ''}`,
          remarks: r.remarks || '',
          items_collected: '',
          source: 'rent',
        })) : []),
        // Online payments via Razorpay
        ...(online || []).map(o => ({
          date: o.payment_date,
          receipt_no: o.receipt_no || '—',
          party: o.dcba_members?.member_name || '—',
          mode: 'ONLINE',
          amount: Number(o.amount),
          head: 'Member Fee',
          description: o.description || `Annual Subscription — ${o.dcba_members?.member_name || ''} (${o.dcba_members?.member_no || ''})`,
          remarks: `Razorpay: ${o.razorpay_payment_id || o.transaction_id || ''}`,
          items_collected: o.fee_type === 'annual' ? 'Annual Subscription' : o.fee_type || '',
          source: 'online',
        })),
      ].sort((a, b) => a.date.localeCompare(b.date) || a.receipt_no.localeCompare(b.receipt_no))

      setEntries(combined)
    } catch (err) { toast.error(err.message) }
    setLoading(false)
  }

  // Filter by print mode
  const filteredEntries = entries.filter(e => {
    if (printMode === 'cash') return isCash(e)
    if (printMode === 'bank') return !isCash(e)
    return true
  })

  const totalAmount = filteredEntries.reduce((s, e) => s + e.amount, 0)
  const totalCash = filteredEntries.filter(isCash).reduce((s, e) => s + e.amount, 0)
  const totalBank = filteredEntries.filter(isBank).reduce((s, e) => s + e.amount, 0)
  const totalOnline = filteredEntries.filter(isOnline).reduce((s, e) => s + e.amount, 0)

  // Totals per head
  function headTotals(list) {
    const t = {}
    HEADS.forEach(h => t[h.key] = 0)
    list.forEach(e => {
      const m = mapToHead(e)
      HEADS.forEach(h => t[h.key] += m[h.key])
    })
    return t
  }

  // Daily groups
  const dailyGroups = filteredEntries.reduce((acc, e) => {
    if (!acc[e.date]) acc[e.date] = []
    acc[e.date].push(e)
    return acc
  }, {})

  // Monthly groups
  const monthlyGroups = filteredEntries.reduce((acc, e) => {
    const mo = e.date.slice(0, 7) // YYYY-MM
    if (!acc[mo]) acc[mo] = []
    acc[mo].push(e)
    return acc
  }, {})

  function fmt(n) { return n > 0 ? n.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—' }

  function handlePrint() {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>DCBA Receipt Register</title>
      <style>
        @page { size: A4 landscape; margin: 8mm; }
        body { font-family: Arial, sans-serif; font-size: 8.5px; margin: 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        th { background: #1a3a5c; color: white; padding: 4px 5px; text-align: center; white-space: pre-line; font-size: 8px; border: 1px solid #ccc; }
        td { padding: 3px 5px; border: 1px solid #ddd; font-size: 8.5px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .day-total { background: #dbeafe; font-weight: bold; }
        .grand-total { background: #1a3a5c; color: white; font-weight: bold; }
        .section-head { background: #f0f4ff; font-weight: bold; font-size: 9px; }
        .rpt-hdr { text-align: center; margin-bottom: 8px; }
        .rpt-hdr h2 { margin: 0; font-size: 13px; color: #1a3a5c; }
        .rpt-hdr p { margin: 2px 0; font-size: 9px; color: #555; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head><body>${content}
    <script>window.onload=function(){window.print();setTimeout(()=>window.close(),1000)}<\/script>
    </body></html>`)
    win.document.close()
  }

  function handleExcel() {
    const wb = XLSX.utils.book_new()

    if (view === 'detail') {
      const headers = ['Receipt No.', 'Date', 'Member/Party', 'C/B',
        ...HEADS.map(h => h.short), 'Total', 'Description/Remarks']
      const rows = [
        ['DWARKA COURT BAR ASSOCIATION — RECEIPT REGISTER'],
        [`Period: ${formatDate(fromDate)} to ${formatDate(toDate)} | Mode: ${printMode.toUpperCase()}`],
        [], headers,
      ]

      Object.entries(dailyGroups).forEach(([date, dayEntries]) => {
        dayEntries.forEach(e => {
          const m = mapToHead(e)
          rows.push([
            e.receipt_no, formatDate(e.date), e.party, isCash(e) ? 'C' : 'B',
            ...HEADS.map(h => m[h.key] || ''),
            e.amount,
            `${e.description}${e.remarks ? ' | ' + e.remarks : ''}`
          ])
        })
        const dt = headTotals(dayEntries)
        const cash = dayEntries.filter(isCash).reduce((s,e) => s+e.amount, 0)
        const bank = dayEntries.filter(e => !isCash(e)).reduce((s,e) => s+e.amount, 0)
        rows.push([
          '', formatDate(date), `Day Total — Cash: ${cash.toLocaleString('en-IN')} | Chq: ${bank.toLocaleString('en-IN')}`, '',
          ...HEADS.map(h => dt[h.key] || ''),
          dayEntries.reduce((s,e) => s+e.amount, 0), ''
        ])
        rows.push([])
      })

      const gt = headTotals(filteredEntries)
      rows.push([
        '', '', `GRAND TOTAL — Cash: ${totalCash.toLocaleString('en-IN')} | Bank: ${totalBank.toLocaleString('en-IN')}`, '',
        ...HEADS.map(h => gt[h.key] || ''), totalAmount, ''
      ])

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [{ wch: 18 },{ wch: 12 },{ wch: 25 },{ wch: 5 },
        ...HEADS.map(() => ({ wch: 10 })), { wch: 12 },{ wch: 40 }]
      XLSX.utils.book_append_sheet(wb, ws, 'Detail')
    }

    if (view === 'daily') {
      const headers = ['Date', 'C/B', ...HEADS.map(h => h.short), 'Total']
      const rows = [
        ['DWARKA COURT BAR ASSOCIATION — DAILY SUMMARY'],
        [`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`],
        [], headers,
      ]
      Object.entries(dailyGroups).sort(([a],[b]) => a.localeCompare(b)).forEach(([date, dayEntries]) => {
        const cash = dayEntries.filter(isCash)
        const bank = dayEntries.filter(e => !isCash(e))
        if (cash.length > 0 || printMode === 'bank') {
          if (printMode !== 'bank') {
            const ct = headTotals(cash)
            rows.push([formatDate(date), 'C', ...HEADS.map(h => ct[h.key] || ''), cash.reduce((s,e)=>s+e.amount,0)])
          }
        }
        if (bank.length > 0 || printMode === 'cash') {
          if (printMode !== 'cash') {
            const bt = headTotals(bank)
            rows.push([formatDate(date), 'B', ...HEADS.map(h => bt[h.key] || ''), bank.reduce((s,e)=>s+e.amount,0)])
          }
        }
      })
      const gt = headTotals(filteredEntries)
      rows.push(['TOTAL', '', ...HEADS.map(h => gt[h.key] || ''), totalAmount])
      const ws = XLSX.utils.aoa_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Daily Summary')
    }

    if (view === 'monthly') {
      const headers = ['Month', 'C/B', ...HEADS.map(h => h.short), 'Total']
      const rows = [
        ['DWARKA COURT BAR ASSOCIATION — MONTHLY SUMMARY'],
        [`Period: ${MONTHS_FULL[filterMonth-1]} ${filterYear}`],
        [], headers,
      ]
      Object.entries(monthlyGroups).sort(([a],[b]) => a.localeCompare(b)).forEach(([mo, moEntries]) => {
        const [yr, mn] = mo.split('-')
        const label = `${MONTHS_FULL[parseInt(mn)-1].slice(0,3)}-${yr.slice(2)}`
        const cash = moEntries.filter(isCash)
        const bank = moEntries.filter(e => !isCash(e))
        if (printMode !== 'bank' && cash.length > 0) {
          const ct = headTotals(cash)
          rows.push([label, 'C', ...HEADS.map(h => ct[h.key] || ''), cash.reduce((s,e)=>s+e.amount,0)])
        }
        if (printMode !== 'cash' && bank.length > 0) {
          const bt = headTotals(bank)
          rows.push([label, 'B', ...HEADS.map(h => bt[h.key] || ''), bank.reduce((s,e)=>s+e.amount,0)])
        }
      })
      const gt = headTotals(filteredEntries)
      rows.push(['TOTAL', '', ...HEADS.map(h => gt[h.key] || ''), totalAmount])
      const ws = XLSX.utils.aoa_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Monthly Summary')
    }

    XLSX.writeFile(wb, `DCBA_Register_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const periodLabel = fromDate === toDate
    ? formatDate(fromDate)
    : `${formatDate(fromDate)} to ${formatDate(toDate)}`

  return (
    <div className="p-6 max-w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-700" /> Receipt Register
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={handleExcel} disabled={entries.length === 0} className="btn-primary flex items-center gap-2">
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'detail', label: 'Detail (Date-wise)', icon: List },
          { id: 'daily', label: 'Daily Summary', icon: Calendar },
          { id: 'monthly', label: 'Monthly Summary', icon: BarChart2 },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setView(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${view === id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          {view !== 'monthly' ? (
            <>
              <div><label className="label">From</label><input type="date" className="input" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
              <div><label className="label">To</label><input type="date" className="input" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
            </>
          ) : (
            <>
              <div>
                <label className="label">Month</label>
                <select className="input" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
                  {MONTHS_FULL.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Year</label>
                <select className="input" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
                  {[CURRENT_YEAR-1, CURRENT_YEAR, CURRENT_YEAR+1].map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}
          {isSupervisor && (
            <div>
              <label className="label">Cashier</label>
              <select className="input" value={cashierFilter} onChange={e => setCashierFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="mine">Mine</option>
                {cashiers.map(c => <option key={c.user_id} value={c.user_id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Mode</label>
            <div className="flex gap-1">
              {[{id:'both',label:'Both'},{id:'cash',label:'Cash'},{id:'bank',label:'Bank'}].map(m => (
                <button key={m.id} onClick={() => setPrintMode(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${printMode === m.id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300'}`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <button onClick={fetchReport} className="btn-primary flex items-center gap-2">
            <Search className="w-4 h-4" /> Generate
          </button>
        </div>
      </div>

      {/* Summary */}
      {filteredEntries.length > 0 && (
      <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="rounded-xl border bg-green-50 p-3"><p className="text-xl font-bold text-green-700">₹{totalAmount.toLocaleString('en-IN')}</p><p className="text-xs text-green-600">Total</p></div>
          <div className="rounded-xl border bg-orange-50 p-3"><p className="text-xl font-bold text-orange-700">₹{totalCash.toLocaleString('en-IN')}</p><p className="text-xs text-orange-600">Cash</p></div>
          <div className="rounded-xl border bg-blue-50 p-3"><p className="text-xl font-bold text-blue-700">₹{totalBank.toLocaleString('en-IN')}</p><p className="text-xs text-blue-600">Bank/Cheque</p></div>
          <div className="rounded-xl border bg-purple-50 p-3"><p className="text-xl font-bold text-purple-700">₹{totalOnline.toLocaleString('en-IN')}</p><p className="text-xs text-purple-600">Online (Razorpay)</p></div>
        </div>
      )}

      {/* Report */}
      <div ref={printRef}>
        <div className="rpt-hdr text-center mb-3">
          <h2 className="text-lg font-bold text-blue-900">DWARKA COURT BAR ASSOCIATION</h2>
          <p className="text-sm text-gray-500">
            Receipt Register {view === 'monthly' ? `Month Wise — ${MONTHS_FULL[filterMonth-1]} ${filterYear}` : view === 'daily' ? `Daily Summary — ${periodLabel}` : `Date Wise — ${periodLabel}`}
            {' '}| Mode: {printMode.toUpperCase()}
          </p>
        </div>

        {loading ? (
          <div className="card p-8 text-center text-gray-400">Generating...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">No entries found</div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    {view === 'detail' && <>
                      <th className="table-header text-center whitespace-nowrap">Receipt No.</th>
                      <th className="table-header text-center whitespace-nowrap">Date</th>
                      <th className="table-header text-left">Member / Party</th>
                      <th className="table-header text-center">C/B</th>
                    </>}
                    {(view === 'daily' || view === 'monthly') && <>
                      <th className="table-header text-center whitespace-nowrap">{view === 'monthly' ? 'Month' : 'Date'}</th>
                      <th className="table-header text-center">C/B</th>
                    </>}
                    {HEADS.map(h => <th key={h.key} className="table-header text-right whitespace-pre-line">{h.label}</th>)}
                    <th className="table-header text-right whitespace-nowrap">Total</th>
                    {view === 'detail' && <th className="table-header text-left">Description / Remarks</th>}
                    {view === 'detail' && <th className="table-header text-center">🖨</th>}
                  </tr>
                </thead>
                <tbody>
                  {view === 'detail' && Object.entries(dailyGroups).map(([date, dayEntries]) => {
                    const cashEntries = dayEntries.filter(isCash)
                    const bankEntries = dayEntries.filter(e => !isCash(e))
                    const dayCash = cashEntries.reduce((s,e) => s+e.amount, 0)
                    const dayBank = bankEntries.reduce((s,e) => s+e.amount, 0)
                    return (
                      <>
                        {dayEntries.map((e, idx) => {
                          const m = mapToHead(e)
                          return (
                            <tr key={`${e.receipt_no}-${idx}`} className={isOnline(e) ? 'bg-purple-50' : idx%2===0?'bg-white':'bg-gray-50/40'}>
                              <td className="table-cell text-center font-mono text-gray-600">{e.receipt_no}</td>
                              <td className="table-cell text-center whitespace-nowrap">{formatDate(e.date)}</td>
                              <td className="table-cell max-w-[160px] truncate font-medium">{e.party}</td>
                              <td className="table-cell text-center font-bold">{isCash(e) ? 'C' : isOnline(e) ? <span className="text-purple-600">ONL</span> : 'B'}</td>
                              {HEADS.map(h => <td key={h.key} className="table-cell text-right">{m[h.key] > 0 ? m[h.key].toLocaleString('en-IN', {minimumFractionDigits:2}) : '—'}</td>)}
                              <td className="table-cell text-right font-semibold text-green-700">{e.amount.toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                              <td className="table-cell text-gray-600 max-w-[200px] truncate">{e.description}{e.remarks ? ` | ${e.remarks}` : ''}</td>
                              <td className="table-cell text-center">
                                <button onClick={() => setReprintEntry(e)}
                                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded">
                                  🖨
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                        <tr className="bg-blue-50 font-semibold">
                          <td colSpan={3} className="px-3 py-2 text-xs text-blue-800">
                            Day Total : Cash : {cashEntries.reduce((s,e)=>s+e.amount,0).toLocaleString('en-IN', {minimumFractionDigits:2})}
                            &nbsp;|&nbsp; Chq. : {bankEntries.filter(e=>!isOnline(e)).reduce((s,e)=>s+e.amount,0).toLocaleString('en-IN', {minimumFractionDigits:2})}
                            {dayEntries.filter(isOnline).length > 0 && <>&nbsp;|&nbsp; Online : {dayEntries.filter(isOnline).reduce((s,e)=>s+e.amount,0).toLocaleString('en-IN', {minimumFractionDigits:2})}</>}
                          </td>
                          <td className="px-3 py-2 text-center text-xs text-blue-600">C+B</td>
                          {HEADS.map(h => {
                            const dt = headTotals(dayEntries)
                            return <td key={h.key} className="px-3 py-2 text-right text-xs text-blue-700">{dt[h.key] > 0 ? dt[h.key].toLocaleString('en-IN', {minimumFractionDigits:2}) : '—'}</td>
                          })}
                          <td className="px-3 py-2 text-right text-xs font-bold text-blue-800">{dayEntries.reduce((s,e)=>s+e.amount,0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                          <td></td>
                        </tr>
                        <tr><td colSpan={HEADS.length + 5} className="py-1"></td></tr>
                      </>
                    )
                  })}

                  {view === 'daily' && Object.entries(dailyGroups).sort(([a],[b])=>a.localeCompare(b)).map(([date, dayEntries], i) => {
                    const cash = dayEntries.filter(isCash)
                    const bank = dayEntries.filter(e => !isCash(e))
                    return (
                      <>
                        {printMode !== 'bank' && cash.length > 0 && (
                          <tr key={`${date}-c`} className={i%2===0?'bg-white':'bg-gray-50/40'}>
                            <td className="table-cell text-center whitespace-nowrap">{formatDate(date)}</td>
                            <td className="table-cell text-center font-bold text-orange-600">C</td>
                            {HEADS.map(h => { const ct=headTotals(cash); return <td key={h.key} className="table-cell text-right">{ct[h.key]>0?fmt(ct[h.key]):'—'}</td> })}
                            <td className="table-cell text-right font-semibold text-orange-700">{cash.reduce((s,e)=>s+e.amount,0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                          </tr>
                        )}
                        {printMode !== 'cash' && bank.length > 0 && (
                          <tr key={`${date}-b`} className={i%2===0?'bg-white/70':'bg-gray-50/20'}>
                            <td className="table-cell text-center whitespace-nowrap">{printMode==='bank'?formatDate(date):''}</td>
                            <td className="table-cell text-center font-bold text-blue-600">B</td>
                            {HEADS.map(h => { const bt=headTotals(bank); return <td key={h.key} className="table-cell text-right">{bt[h.key]>0?fmt(bt[h.key]):'—'}</td> })}
                            <td className="table-cell text-right font-semibold text-blue-700">{bank.reduce((s,e)=>s+e.amount,0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                          </tr>
                        )}
                      </>
                    )
                  })}

                  {view === 'monthly' && Object.entries(monthlyGroups).sort(([a],[b])=>a.localeCompare(b)).map(([mo, moEntries], i) => {
                    const [yr, mn] = mo.split('-')
                    const label = `${MONTHS_FULL[parseInt(mn)-1].slice(0,3)}-${yr.slice(2)}`
                    const cash = moEntries.filter(isCash)
                    const bank = moEntries.filter(e => !isCash(e))
                    return (
                      <>
                        {printMode !== 'bank' && cash.length > 0 && (
                          <tr key={`${mo}-c`} className={i%2===0?'bg-white':'bg-gray-50/40'}>
                            <td className="table-cell font-medium whitespace-nowrap">{label}</td>
                            <td className="table-cell text-center font-bold text-orange-600">C</td>
                            {HEADS.map(h => { const ct=headTotals(cash); return <td key={h.key} className="table-cell text-right">{ct[h.key]>0?fmt(ct[h.key]):'—'}</td> })}
                            <td className="table-cell text-right font-semibold text-orange-700">{cash.reduce((s,e)=>s+e.amount,0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                          </tr>
                        )}
                        {printMode !== 'cash' && bank.length > 0 && (
                          <tr key={`${mo}-b`} className={i%2===0?'bg-white/70':'bg-gray-50/20'}>
                            <td className="table-cell font-medium whitespace-nowrap">{printMode==='bank'?label:''}</td>
                            <td className="table-cell text-center font-bold text-blue-600">B</td>
                            {HEADS.map(h => { const bt=headTotals(bank); return <td key={h.key} className="table-cell text-right">{bt[h.key]>0?fmt(bt[h.key]):'—'}</td> })}
                            <td className="table-cell text-right font-semibold text-blue-700">{bank.reduce((s,e)=>s+e.amount,0).toLocaleString('en-IN', {minimumFractionDigits:2})}</td>
                          </tr>
                        )}
                      </>
                    )
                  })}

                  {/* Grand Total */}
                  <tr className="bg-blue-900 text-white font-bold">
                    <td colSpan={view==='detail'?3:1} className="px-3 py-3 text-sm">
                      {view==='monthly' ? `TOTAL — ${MONTHS_FULL[filterMonth-1]} ${filterYear}` : `GRAND TOTAL — ${periodLabel}`}
                    </td>
                    <td className="px-3 py-3 text-center text-xs">
                      C:{totalCash.toLocaleString('en-IN',{minimumFractionDigits:2})}<br/>
                      B:{totalBank.toLocaleString('en-IN',{minimumFractionDigits:2})}<br/>
                      {totalOnline > 0 && <>ONL:{totalOnline.toLocaleString('en-IN',{minimumFractionDigits:2})}</>}
                    </td>
                    {HEADS.map(h => {
                      const gt = headTotals(filteredEntries)
                      return <td key={h.key} className="px-3 py-3 text-right text-xs">{gt[h.key]>0?fmt(gt[h.key]):'—'}</td>
                    })}
                    <td className="px-3 py-3 text-right text-sm">₹{totalAmount.toLocaleString('en-IN',{minimumFractionDigits:2})}</td>
                    {view==='detail' && <td></td>}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Reprint Modal */}
      {reprintEntry && (
        <ReprintModal entry={reprintEntry} onClose={() => setReprintEntry(null)} />
      )}
    </div>
  )
}

function ReprintModal({ entry, onClose }) {
  function formatDate(d) {
    if (!d) return ''
    const dt = new Date(d)
    const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${String(dt.getDate()).padStart(2,'0')}-${m[dt.getMonth()]}-${dt.getFullYear()}`
  }

  function ReceiptBody({ copy }) {
    return (
      <div style={{ paddingTop:'36mm', paddingLeft:'18mm', paddingRight:'14mm', fontFamily:'Arial,sans-serif', fontSize:'11px', height:'148.5mm', boxSizing:'border-box', position:'relative' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
          <span style={{ fontSize:'8px', color:'#666', fontStyle:'italic' }}>{copy}</span>
          <span style={{ fontSize:'10px', color:'red', fontWeight:'bold', border:'1px solid red', padding:'1px 5px' }}>REPRINT</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px', borderBottom:'1px solid #ccc', paddingBottom:'4px' }}>
          <span><strong>Receipt No:</strong> {entry.receipt_no}</span>
          <span><strong>Date:</strong> {formatDate(entry.date)}</span>
        </div>
        <div style={{ marginBottom:'5px' }}><strong>Party: </strong>{entry.party}</div>
        <div style={{ display:'flex', alignItems:'baseline', gap:'8px', marginBottom:'5px' }}>
          <strong>Amount:</strong>
          <span style={{ fontSize:'15px', fontWeight:'bold' }}>₹{Number(entry.amount).toLocaleString('en-IN')}</span>
        </div>
        <div style={{ marginBottom:'4px' }}><strong>Description: </strong>{entry.description}</div>
        {entry.remarks && <div style={{ fontSize:'9px', color:'#555', marginBottom:'4px' }}><strong>Remarks:</strong> {entry.remarks}</div>}
        <div style={{ display:'flex', gap:'14px' }}>
          <span><strong>Mode:</strong> {entry.mode}</span>
        </div>
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

  function handlePrint() {
    const content = document.getElementById('reprint-content').innerHTML
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head><title>Reprint</title>
      <style>@page{size:A4 portrait;margin:0}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif}.half{height:148.5mm;overflow:hidden}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style>
    </head><body>${content}<script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2"><Printer className="w-5 h-5 text-blue-600" /> Reprint Receipt</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 bg-gray-100 overflow-y-auto max-h-[70vh]">
          <div id="reprint-content" style={{ background:'#fffff0', border:'1px solid #d4d010', borderRadius:'4px', overflow:'hidden' }}>
            <div className="half" style={{ height:'148.5mm', position:'relative' }}>
              <div style={{ height:'36mm', background:'rgba(212,208,16,0.15)', borderBottom:'1px dashed #ccc', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'9px', color:'#999' }}>↑ DCBA Pre-printed letterhead</span>
              </div>
              <ReceiptBody copy="ORIGINAL" />
            </div>
            <div style={{ borderTop:'1px dashed #999', textAlign:'center', fontSize:'8px', color:'#999', padding:'2px 0' }}>✂ — Cut Here — ✂</div>
            <div className="half" style={{ height:'148.5mm', position:'relative' }}>
              <div style={{ height:'36mm', background:'rgba(212,208,16,0.15)', borderBottom:'1px dashed #ccc', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'9px', color:'#999' }}>↑ Duplicate half</span>
              </div>
              <ReceiptBody copy="DUPLICATE (Office Copy)" />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-3 justify-between">
          <button onClick={onClose} className="btn-secondary">Close</button>
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2"><Printer className="w-4 h-4" /> Print</button>
        </div>
      </div>
    </div>
  )
}
