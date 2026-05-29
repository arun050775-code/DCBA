import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { FileText, Printer, Download, Search, List, BarChart2, Calendar } from 'lucide-react'
import * as XLSX from 'xlsx'

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()

function formatDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2,'0')}-${String(dt.getMonth()+1).padStart(2,'0')}-${dt.getFullYear()}`
}

function isCash(e) { return e.mode === 'CASH' }
function isBank(e) { return !isCash(e) }

export default function DayEndReport() {
  const { currentOrg, userRole } = useAuth()
  const role = userRole?.role
  const isSupervisor = ['admin','supervisor'].includes(role)

  const today = new Date().toISOString().split('T')[0]
  const [view, setView] = useState('detail') // detail | daily | monthly
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)
  const [cashierFilter, setCashierFilter] = useState('mine')
  const [printMode, setPrintMode] = useState('both') // cash | bank | both
  const [cashiers, setCashiers] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(false)
  const printRef = useRef()

  useEffect(() => { if (currentOrg) { fetchCashiers(); fetchReport() } }, [currentOrg])

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
        .order('entry_date')

      if (!isSupervisor || cashierFilter === 'mine') q = q.eq('created_by', userId)
      else if (cashierFilter !== 'all') q = q.eq('created_by', cashierFilter)

      let qr = supabase.from('rent_collections')
        .select('*, vendors(name), cash_accounts(cashier_name), bank_accounts(account_name)')
        .eq('org_id', currentOrg.id)
        .gte('collection_date', startDate).lte('collection_date', endDate)
        .order('collection_date')

      const [{ data: inc }, { data: rent }] = await Promise.all([q, qr])

      const combined = [
        ...(inc || []).map(e => ({
          date: e.entry_date,
          receipt_no: e.receipt_no || '—',
          party: e.description?.split('—')[1]?.split('|')[0]?.trim() || '—',
          head: e.account_heads?.name || 'Member Fee',
          description: e.description || '—',
          remarks: e.remarks || '',
          mode: (e.payment_mode || 'cash').toUpperCase(),
          amount: Number(e.amount),
          account: e.cash_accounts?.cashier_name || e.bank_accounts?.account_name || '—',
          source: 'income',
        })),
        ...((isSupervisor && cashierFilter !== 'mine') ? (rent || []).map(r => ({
          date: r.collection_date,
          receipt_no: r.receipt_no || '—',
          party: r.vendors?.name || '—',
          head: 'Vendor Rent Income',
          description: `Rent — ${r.months_covered || ''}`,
          remarks: r.remarks || '',
          mode: (r.payment_mode || 'cash').toUpperCase(),
          amount: Number(r.amount),
          account: r.cash_accounts?.cashier_name || r.bank_accounts?.account_name || '—',
          source: 'rent',
        })) : []),
      ].sort((a, b) => new Date(a.date) - new Date(b.date))

      setEntries(combined)
    } catch (err) { toast.error(err.message) }
    setLoading(false)
  }

  // Filter by print mode
  const filteredEntries = entries.filter(e => {
    if (printMode === 'cash') return isCash(e)
    if (printMode === 'bank') return isBank(e)
    return true
  })

  // Head groups
  const headGroups = filteredEntries.reduce((acc, e) => {
    if (!acc[e.head]) acc[e.head] = []
    acc[e.head].push(e)
    return acc
  }, {})

  const totalAmount = filteredEntries.reduce((s, e) => s + e.amount, 0)
  const totalCash = filteredEntries.filter(isCash).reduce((s, e) => s + e.amount, 0)
  const totalBank = filteredEntries.filter(isBank).reduce((s, e) => s + e.amount, 0)

  // Daily summary — group by date+head
  const dailySummary = () => {
    const days = {}
    filteredEntries.forEach(e => {
      if (!days[e.date]) days[e.date] = {}
      if (!days[e.date][e.head]) days[e.date][e.head] = { cash: 0, bank: 0 }
      if (isCash(e)) days[e.date][e.head].cash += e.amount
      else days[e.date][e.head].bank += e.amount
    })
    return days
  }

  // Monthly summary — group by head
  const monthlySummary = () => {
    const heads = {}
    filteredEntries.forEach(e => {
      if (!heads[e.head]) heads[e.head] = { cash: 0, bank: 0, total: 0 }
      if (isCash(e)) heads[e.head].cash += e.amount
      else heads[e.head].bank += e.amount
      heads[e.head].total += e.amount
    })
    return heads
  }

  function handlePrint() {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>DCBA Report</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; font-size: 10px; margin: 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { background: #1a3a5c; color: white; padding: 5px 8px; text-align: left; font-size: 9px; }
        td { padding: 4px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
        .head-row td { background: #eef2ff; font-weight: bold; color: #1a3a5c; }
        .subtotal-row td { background: #f0fdf4; font-weight: bold; color: #166534; }
        .total-row td { background: #1a3a5c; color: white; font-weight: bold; }
        .rpt-header { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #1a3a5c; padding-bottom: 8px; }
        .rpt-header h2 { margin: 0 0 4px; font-size: 14px; color: #1a3a5c; }
        .rpt-header p { margin: 0; font-size: 10px; color: #666; }
        .section-title { font-weight: bold; color: #1a3a5c; margin: 8px 0 4px; font-size: 11px; }
        .amount { text-align: right; }
        .text-green { color: #166534; }
        .text-blue { color: #1a3a5c; }
      </style>
    </head><body>${content}
    <script>window.onload=function(){window.print();setTimeout(()=>window.close(),1000)}<\/script>
    </body></html>`)
    win.document.close()
  }

  function handleExcel() {
    const wb = XLSX.utils.book_new()

    if (view === 'detail') {
      const rows = [
        ['DWARKA COURT BAR ASSOCIATION — COLLECTION DETAIL REPORT'],
        [`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}  |  Mode: ${printMode.toUpperCase()}`],
        [],
        ['#','Date','Receipt No.','Party','Head','Description','Remarks','Mode','Account','Amount (₹)'],
      ]
      let sno = 1
      Object.entries(headGroups).forEach(([head, items]) => {
        rows.push([`--- ${head} ---`,'','','','','','','','',''])
        items.forEach(e => rows.push([sno++,formatDate(e.date),e.receipt_no,e.party,e.head,e.description,e.remarks,e.mode,e.account,e.amount]))
        rows.push(['','','','','','','','','Subtotal',items.reduce((s,e)=>s+e.amount,0)])
      })
      rows.push([],['' ,'','','','','','','','GRAND TOTAL',totalAmount])
      rows.push(['','','','','','','','','Cash Total',totalCash])
      rows.push(['','','','','','','','','Bank Total',totalBank])
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Detail')
    }

    if (view === 'daily' || view === 'detail') {
      const days = dailySummary()
      const allHeads = [...new Set(filteredEntries.map(e => e.head))]
      const rows = [
        ['DWARKA COURT BAR ASSOCIATION — DAILY SUMMARY'],
        [`Period: ${formatDate(fromDate)} to ${formatDate(toDate)}`],
        [],
        ['Date', ...allHeads.flatMap(h => [`${h} (Cash)`, `${h} (Bank)`]), 'Day Cash', 'Day Bank', 'Day Total'],
      ]
      Object.entries(days).sort(([a],[b]) => a.localeCompare(b)).forEach(([date, heads]) => {
        const row = [formatDate(date)]
        let dayCash = 0, dayBank = 0
        allHeads.forEach(h => {
          const c = heads[h]?.cash || 0, bk = heads[h]?.bank || 0
          row.push(c || '', bk || '')
          dayCash += c; dayBank += bk
        })
        row.push(dayCash || '', dayBank || '', dayCash + dayBank)
        rows.push(row)
      })
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Daily Summary')
    }

    if (view === 'monthly' || view === 'detail') {
      const heads = monthlySummary()
      const rows = [
        ['DWARKA COURT BAR ASSOCIATION — MONTHLY SUMMARY'],
        [`Month: ${MONTHS_FULL[filterMonth-1]} ${filterYear}`],
        [],
        ['Head', 'Cash (₹)', 'Bank (₹)', 'Total (₹)'],
      ]
      Object.entries(heads).forEach(([head, data]) => {
        rows.push([head, data.cash || '', data.bank || '', data.total])
      })
      rows.push(['GRAND TOTAL', totalCash, totalBank, totalAmount])
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Monthly Summary')
    }

    XLSX.writeFile(wb, `DCBA_Report_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const days = dailySummary()
  const monthHeads = monthlySummary()
  const allHeads = [...new Set(filteredEntries.map(e => e.head))]
  const periodLabel = fromDate === toDate ? formatDate(fromDate) : `${formatDate(fromDate)} to ${formatDate(toDate)}`

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-700" /> Collection Reports
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
          { id: 'detail', label: 'Detail Report', icon: List },
          { id: 'daily', label: 'Daily Summary', icon: Calendar },
          { id: 'monthly', label: 'Monthly Summary', icon: BarChart2 },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setView(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${view === id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-6 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          {view !== 'monthly' ? (
            <>
              <div>
                <label className="label">From Date</label>
                <input type="date" className="input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
              </div>
              <div>
                <label className="label">To Date</label>
                <input type="date" className="input" value={toDate} onChange={e => setToDate(e.target.value)} />
              </div>
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
                <option value="all">All Cashiers</option>
                <option value="mine">My Collections</option>
                {cashiers.map(c => <option key={c.user_id} value={c.user_id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Print Mode</label>
            <div className="flex gap-1">
              {[{id:'both',label:'Both'},{id:'cash',label:'Cash'},{id:'bank',label:'Bank'}].map(m => (
                <button key={m.id} onClick={() => setPrintMode(m.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${printMode === m.id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300'}`}>
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

      {/* Summary Cards */}
      {filteredEntries.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border bg-green-50 border-green-200 p-4">
            <p className="text-2xl font-bold text-green-700">₹{totalAmount.toLocaleString('en-IN')}</p>
            <p className="text-xs font-medium text-green-600">Total Collection</p>
          </div>
          <div className="rounded-xl border bg-orange-50 border-orange-200 p-4">
            <p className="text-2xl font-bold text-orange-700">₹{totalCash.toLocaleString('en-IN')}</p>
            <p className="text-xs font-medium text-orange-600">Cash Total</p>
          </div>
          <div className="rounded-xl border bg-blue-50 border-blue-200 p-4">
            <p className="text-2xl font-bold text-blue-700">₹{totalBank.toLocaleString('en-IN')}</p>
            <p className="text-xs font-medium text-blue-600">Bank Total</p>
          </div>
        </div>
      )}

      {/* Report Content */}
      <div ref={printRef}>
        {/* Print Header */}
        <div className="rpt-header mb-4">
          <h2 className="text-lg font-bold text-blue-900">DWARKA COURT BAR ASSOCIATION</h2>
          <p className="text-sm text-gray-500">
            {view === 'detail' ? 'Detail Collection Report' : view === 'daily' ? 'Daily Summary' : 'Monthly Summary'}
            {' '}— {view === 'monthly' ? `${MONTHS_FULL[filterMonth-1]} ${filterYear}` : periodLabel}
            {' '}| Mode: {printMode.toUpperCase()}
          </p>
        </div>

        {loading ? (
          <div className="card p-8 text-center text-gray-400">Generating...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="card p-8 text-center text-gray-400">No entries found</div>
        ) : (
          <>
            {/* DETAIL VIEW */}
            {view === 'detail' && (
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr>
                      {['#','Date','Receipt No.','Party','Head','Description','Remarks','Mode','Account','Amount (₹)'].map(h => (
                        <th key={h} className="table-header text-left whitespace-nowrap text-xs">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(headGroups).map(([head, items]) => (
                      <>
                        <tr key={`h-${head}`} className="head-row bg-blue-50">
                          <td colSpan={10} className="px-4 py-2 text-sm font-semibold text-blue-800">📂 {head}</td>
                        </tr>
                        {items.map((e, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="table-cell text-xs text-gray-400">{filteredEntries.indexOf(e)+1}</td>
                            <td className="table-cell text-xs whitespace-nowrap">{formatDate(e.date)}</td>
                            <td className="table-cell text-xs font-mono">{e.receipt_no}</td>
                            <td className="table-cell text-sm font-medium max-w-[150px] truncate">{e.party}</td>
                            <td className="table-cell text-xs">{e.head}</td>
                            <td className="table-cell text-xs max-w-[150px] truncate">{e.description}</td>
                            <td className="table-cell text-xs text-gray-500">{e.remarks||'—'}</td>
                            <td className="table-cell text-xs">{e.mode}</td>
                            <td className="table-cell text-xs text-gray-500">{e.account}</td>
                            <td className="table-cell text-right font-semibold text-green-700">₹{e.amount.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                        <tr key={`s-${head}`} className="subtotal-row bg-green-50">
                          <td colSpan={7} className="px-4 py-2 text-xs text-green-700">
                            Cash: ₹{items.filter(isCash).reduce((s,e)=>s+e.amount,0).toLocaleString('en-IN')} &nbsp;|&nbsp;
                            Bank: ₹{items.filter(isBank).reduce((s,e)=>s+e.amount,0).toLocaleString('en-IN')}
                          </td>
                          <td colSpan={2} className="px-4 py-2 text-sm font-semibold text-green-700 text-right">{head} Total</td>
                          <td className="px-4 py-2 text-right font-bold text-green-700">₹{items.reduce((s,e)=>s+e.amount,0).toLocaleString('en-IN')}</td>
                        </tr>
                      </>
                    ))}
                    <tr className="bg-blue-900 text-white font-bold">
                      <td colSpan={7} className="px-4 py-3 text-xs">
                        Cash: ₹{totalCash.toLocaleString('en-IN')} &nbsp;|&nbsp; Bank: ₹{totalBank.toLocaleString('en-IN')}
                      </td>
                      <td colSpan={2} className="px-4 py-3 text-sm text-right">GRAND TOTAL</td>
                      <td className="px-4 py-3 text-right text-sm">₹{totalAmount.toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* DAILY SUMMARY VIEW */}
            {view === 'daily' && (
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header text-left whitespace-nowrap">Date</th>
                        {allHeads.map(h => (
                          <>
                            <th key={`${h}-c`} className="table-header text-right whitespace-nowrap text-xs">{h}<br/><span className="text-orange-300">Cash</span></th>
                            <th key={`${h}-b`} className="table-header text-right whitespace-nowrap text-xs">{h}<br/><span className="text-blue-300">Bank</span></th>
                          </>
                        ))}
                        <th className="table-header text-right whitespace-nowrap text-orange-300">Day Cash</th>
                        <th className="table-header text-right whitespace-nowrap text-blue-300">Day Bank</th>
                        <th className="table-header text-right whitespace-nowrap">Day Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(days).sort(([a],[b]) => a.localeCompare(b)).map(([date, heads], i) => {
                        let dayCash = 0, dayBank = 0
                        return (
                          <tr key={date} className={i%2===0?'bg-white':'bg-gray-50/50'}>
                            <td className="table-cell text-sm font-medium whitespace-nowrap">{formatDate(date)}</td>
                            {allHeads.map(h => {
                              const c = heads[h]?.cash||0, bk = heads[h]?.bank||0
                              dayCash += c; dayBank += bk
                              return (
                                <>
                                  <td key={`${h}-c`} className="table-cell text-right text-sm text-orange-700">{c > 0 ? `₹${c.toLocaleString('en-IN')}` : '—'}</td>
                                  <td key={`${h}-b`} className="table-cell text-right text-sm text-blue-700">{bk > 0 ? `₹${bk.toLocaleString('en-IN')}` : '—'}</td>
                                </>
                              )
                            })}
                            <td className="table-cell text-right font-semibold text-orange-700">{dayCash > 0 ? `₹${dayCash.toLocaleString('en-IN')}` : '—'}</td>
                            <td className="table-cell text-right font-semibold text-blue-700">{dayBank > 0 ? `₹${dayBank.toLocaleString('en-IN')}` : '—'}</td>
                            <td className="table-cell text-right font-bold">₹{(dayCash+dayBank).toLocaleString('en-IN')}</td>
                          </tr>
                        )
                      })}
                      <tr className="bg-blue-900 text-white font-bold">
                        <td className="px-4 py-3 text-sm">TOTAL</td>
                        {allHeads.map(h => (
                          <>
                            <td key={`tot-${h}-c`} className="px-4 py-3 text-right text-sm">₹{(filteredEntries.filter(e=>e.head===h&&isCash(e)).reduce((s,e)=>s+e.amount,0)).toLocaleString('en-IN')}</td>
                            <td key={`tot-${h}-b`} className="px-4 py-3 text-right text-sm">₹{(filteredEntries.filter(e=>e.head===h&&isBank(e)).reduce((s,e)=>s+e.amount,0)).toLocaleString('en-IN')}</td>
                          </>
                        ))}
                        <td className="px-4 py-3 text-right text-sm">₹{totalCash.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right text-sm">₹{totalBank.toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right text-sm">₹{totalAmount.toLocaleString('en-IN')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* MONTHLY SUMMARY VIEW */}
            {view === 'monthly' && (
              <div className="card p-0 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header text-left">Income Head</th>
                      <th className="table-header text-right text-orange-300">Cash (₹)</th>
                      <th className="table-header text-right text-blue-300">Bank (₹)</th>
                      <th className="table-header text-right">Total (₹)</th>
                      <th className="table-header text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(monthHeads).map(([head, data], i) => (
                      <tr key={head} className={i%2===0?'bg-white':'bg-gray-50/50'}>
                        <td className="table-cell font-medium">{head}</td>
                        <td className="table-cell text-right text-orange-700">₹{data.cash.toLocaleString('en-IN')}</td>
                        <td className="table-cell text-right text-blue-700">₹{data.bank.toLocaleString('en-IN')}</td>
                        <td className="table-cell text-right font-semibold text-green-700">₹{data.total.toLocaleString('en-IN')}</td>
                        <td className="table-cell text-right text-gray-500 text-xs">
                          {totalAmount > 0 ? ((data.total/totalAmount)*100).toFixed(1) : '0'}%
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-blue-900 text-white font-bold">
                      <td className="px-4 py-3">GRAND TOTAL — {MONTHS_FULL[filterMonth-1]} {filterYear}</td>
                      <td className="px-4 py-3 text-right">₹{totalCash.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right">₹{totalBank.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right">₹{totalAmount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
