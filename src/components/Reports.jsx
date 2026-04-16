import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import {
  FileText, Download, Printer, TrendingUp, TrendingDown,
  Building2, IndianRupee, Calendar, ChevronDown, Mail,
  BarChart3, AlertCircle
} from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1]

export default function Reports() {
  const { currentOrg, userRole } = useAuth()
  const [activeReport, setActiveReport] = useState('ie')
  const [periodType, setPeriodType] = useState('month') // 'month', 'range', 'fy'
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)
  const [fromDate, setFromDate] = useState(`${CURRENT_YEAR}-04-01`)
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState(null)
  const printRef = useRef()

  const isAdmin = userRole?.role === 'admin'

  // Compute actual date range based on period type
  function getDateRange() {
    if (periodType === 'month') {
      const startDate = `${filterYear}-${String(filterMonth).padStart(2,'0')}-01`
      const endDate = new Date(filterYear, filterMonth, 0).toISOString().split('T')[0]
      return { startDate, endDate, label: `${MONTHS[filterMonth-1]} ${filterYear}` }
    } else if (periodType === 'fy') {
      const fyStart = filterYear
      const startDate = `${fyStart}-04-01`
      const endDate = `${fyStart+1}-03-31`
      return { startDate, endDate, label: `FY ${fyStart}-${String(fyStart+1).slice(2)}` }
    } else {
      // Custom — exact dates
      const from = new Date(fromDate)
      const to = new Date(toDate)
      const formatLabel = (d) => `${String(d.getDate()).padStart(2,'0')}-${MONTHS[d.getMonth()].slice(0,3)}-${d.getFullYear()}`
      return { startDate: fromDate, endDate: toDate, label: `${formatLabel(from)} to ${formatLabel(to)}` }
    }
  }

  const reports = [
    { id: 'ie', label: 'Income & Expenditure', icon: BarChart3 },
    { id: 'vendor', label: 'Vendor-wise Collection', icon: Building2 },
    { id: 'arrears', label: 'Arrears Report', icon: AlertCircle },
    { id: 'cashbook', label: 'Cash Book Summary', icon: IndianRupee },
    ...(isAdmin ? [{ id: 'tally', label: 'Tally XML Export', icon: Download }] : []),
  ]

  useEffect(() => {
    if (currentOrg) fetchReport()
  }, [currentOrg, activeReport, filterMonth, filterYear, fromDate, toDate, periodType])

  async function fetchReport() {
    setLoading(true)
    setReportData(null)
    try {
      const range = getDateRange()
      if (activeReport === 'ie') await fetchIEReport(range)
      else if (activeReport === 'vendor') await fetchVendorReport(range)
      else if (activeReport === 'arrears') await fetchArrearsReport()
      else if (activeReport === 'cashbook') await fetchCashbookReport(range)
      else if (activeReport === 'tally') await fetchTallyData(range)
    } catch (err) {
      toast.error('Error loading report: ' + err.message)
    }
    setLoading(false)
  }

  // ---- I&E REPORT ----
  async function fetchIEReport(range) {
    const { startDate, endDate, label } = range

    const [{ data: rent }, { data: income }, { data: expenditure }] = await Promise.all([
      supabase.from('rent_collections').select('amount, vendors(vendor_categories(name))').eq('org_id', currentOrg.id).gte('collection_date', startDate).lte('collection_date', endDate),
      supabase.from('income_entries').select('amount, account_heads(name), account_sub_heads(name)').eq('org_id', currentOrg.id).gte('entry_date', startDate).lte('entry_date', endDate),
      supabase.from('expenditure_entries').select('amount, account_heads(name), account_sub_heads(name)').eq('org_id', currentOrg.id).gte('entry_date', startDate).lte('entry_date', endDate),
    ])

    // Build income summary
    const incomeMap = {}

    // Rent by category
    const rentByCat = {}
    ;(rent || []).forEach(r => {
      const cat = r.vendors?.vendor_categories?.name || 'Other Vendors'
      rentByCat[cat] = (rentByCat[cat] || 0) + Number(r.amount)
    })
    if (Object.keys(rentByCat).length > 0) {
      incomeMap['Vendor Rent Income'] = { total: 0, subs: rentByCat }
      incomeMap['Vendor Rent Income'].total = Object.values(rentByCat).reduce((a, b) => a + b, 0)
    }

    // Other income
    ;(income || []).forEach(e => {
      const head = e.account_heads?.name || 'Miscellaneous Income'
      const sub = e.account_sub_heads?.name || head
      if (!incomeMap[head]) incomeMap[head] = { total: 0, subs: {} }
      incomeMap[head].subs[sub] = (incomeMap[head].subs[sub] || 0) + Number(e.amount)
      incomeMap[head].total += Number(e.amount)
    })

    // Build expenditure summary
    const expMap = {}
    ;(expenditure || []).forEach(e => {
      const head = e.account_heads?.name || 'Miscellaneous Expenditure'
      const sub = e.account_sub_heads?.name || head
      if (!expMap[head]) expMap[head] = { total: 0, subs: {} }
      expMap[head].subs[sub] = (expMap[head].subs[sub] || 0) + Number(e.amount)
      expMap[head].total += Number(e.amount)
    })

    const totalIncome = Object.values(incomeMap).reduce((s, v) => s + v.total, 0)
    const totalExp = Object.values(expMap).reduce((s, v) => s + v.total, 0)
    const surplus = totalIncome - totalExp

    setReportData({ type: 'ie', incomeMap, expMap, totalIncome, totalExp, surplus, label })
  }

  // ---- VENDOR REPORT ----
  async function fetchVendorReport(range) {
    const { startDate, endDate, label } = range

    const { data: collections } = await supabase
      .from('rent_collections')
      .select('amount, receipt_no, collection_date, payment_mode, months_covered, vendors(name, monthly_rent, opening_arrears, vendor_categories(name))')
      .eq('org_id', currentOrg.id)
      .gte('collection_date', startDate)
      .lte('collection_date', endDate)
      .order('collection_date')

    // Group by vendor
    const vendorMap = {}
    ;(collections || []).forEach(c => {
      const vname = c.vendors?.name || 'Unknown'
      if (!vendorMap[vname]) {
        vendorMap[vname] = {
          name: vname,
          category: c.vendors?.vendor_categories?.name || '',
          monthly_rent: c.vendors?.monthly_rent || 0,
          collections: [],
          total: 0,
        }
      }
      vendorMap[vname].collections.push(c)
      vendorMap[vname].total += Number(c.amount)
    })

    const total = Object.values(vendorMap).reduce((s, v) => s + v.total, 0)
    setReportData({ type: 'vendor', vendorMap, total, label })
  }

  // ---- ARREARS REPORT ----
  async function fetchArrearsReport() {
    const { data: vendors } = await supabase
      .from('vendors')
      .select('name, monthly_rent, opening_arrears, paid_upto_month, paid_upto_year, vendor_categories(name)')
      .eq('org_id', currentOrg.id)
      .eq('status', 'active')
      .gt('opening_arrears', 0)
      .order('opening_arrears', { ascending: false })

    const total = (vendors || []).reduce((s, v) => s + Number(v.opening_arrears), 0)
    setReportData({ type: 'arrears', vendors: vendors || [], total })
  }

  // ---- CASH BOOK SUMMARY ----
  async function fetchCashbookReport(range) {
    const { startDate, endDate, label } = range

    const [{ data: cashAccs }, { data: bankAccs }] = await Promise.all([
      supabase.from('cash_accounts').select('*').eq('org_id', currentOrg.id).eq('is_active', true),
      supabase.from('bank_accounts').select('*').eq('org_id', currentOrg.id).eq('is_active', true),
    ])

    // For each cash account — get receipts and payments
    const cashSummary = []
    for (const acc of (cashAccs || [])) {
      const [{ data: rentRcpt }, { data: otherRcpt }, { data: payments }] = await Promise.all([
        supabase.from('rent_collections').select('amount').eq('cash_account_id', acc.id).gte('collection_date', startDate).lte('collection_date', endDate),
        supabase.from('income_entries').select('amount').eq('cash_account_id', acc.id).gte('entry_date', startDate).lte('entry_date', endDate),
        supabase.from('expenditure_entries').select('amount').eq('cash_account_id', acc.id).gte('entry_date', startDate).lte('entry_date', endDate),
      ])
      const totalReceipts = [...(rentRcpt||[]), ...(otherRcpt||[])].reduce((s,r) => s+Number(r.amount), 0)
      const totalPayments = (payments||[]).reduce((s,r) => s+Number(r.amount), 0)
      cashSummary.push({ name: acc.cashier_name, receipts: totalReceipts, payments: totalPayments, balance: totalReceipts - totalPayments })
    }

    const bankSummary = []
    for (const acc of (bankAccs || [])) {
      const [{ data: rentRcpt }, { data: otherRcpt }, { data: payments }] = await Promise.all([
        supabase.from('rent_collections').select('amount').eq('bank_account_id', acc.id).gte('collection_date', startDate).lte('collection_date', endDate),
        supabase.from('income_entries').select('amount').eq('bank_account_id', acc.id).gte('entry_date', startDate).lte('entry_date', endDate),
        supabase.from('expenditure_entries').select('amount').eq('bank_account_id', acc.id).gte('entry_date', startDate).lte('entry_date', endDate),
      ])
      const totalReceipts = [...(rentRcpt||[]), ...(otherRcpt||[])].reduce((s,r) => s+Number(r.amount), 0)
      const totalPayments = (payments||[]).reduce((s,r) => s+Number(r.amount), 0)
      bankSummary.push({ name: acc.account_name, acct: acc.account_number, receipts: totalReceipts, payments: totalPayments, balance: totalReceipts - totalPayments })
    }

    setReportData({ type: 'cashbook', cashSummary, bankSummary, label })
  }

  // ---- TALLY XML ----
  async function fetchTallyData(range) {
    const { startDate, endDate, label } = range

    const [{ data: rent }, { data: income }, { data: expenditure }] = await Promise.all([
      supabase.from('rent_collections').select('*, vendors(name)').eq('org_id', currentOrg.id).gte('collection_date', startDate).lte('collection_date', endDate),
      supabase.from('income_entries').select('*, account_heads(name), account_sub_heads(name)').eq('org_id', currentOrg.id).gte('entry_date', startDate).lte('entry_date', endDate),
      supabase.from('expenditure_entries').select('*, account_heads(name), account_sub_heads(name)').eq('org_id', currentOrg.id).gte('entry_date', startDate).lte('entry_date', endDate),
    ])

    setReportData({ type: 'tally', rent: rent||[], income: income||[], expenditure: expenditure||[], label })
  }

  function generateTallyXML() {
    if (!reportData || reportData.type !== 'tally') return
    const { rent, income, expenditure, month, year } = reportData

    const formatTallyDate = (dateStr) => {
      const d = new Date(dateStr)
      return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`
    }

    let vouchers = ''

    // Rent receipts
    rent.forEach(r => {
      vouchers += `
  <VOUCHER VCHTYPE="Receipt" ACTION="Create">
    <DATE>${formatTallyDate(r.collection_date)}</DATE>
    <VOUCHERNUMBER>${r.receipt_no || ''}</VOUCHERNUMBER>
    <NARRATION>Rent from ${r.vendors?.name || ''} for ${r.months_covered || ''}</NARRATION>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Vendor Rent Income</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>-${r.amount}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Cash</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>${r.amount}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>`
    })

    // Income entries
    income.forEach(e => {
      vouchers += `
  <VOUCHER VCHTYPE="Receipt" ACTION="Create">
    <DATE>${formatTallyDate(e.entry_date)}</DATE>
    <VOUCHERNUMBER>${e.receipt_no || ''}</VOUCHERNUMBER>
    <NARRATION>${e.account_heads?.name || ''} - ${e.description || ''}</NARRATION>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${e.account_sub_heads?.name || e.account_heads?.name || 'Miscellaneous Income'}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>-${e.amount}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>Cash</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>${e.amount}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>`
    })

    // Expenditure
    expenditure.forEach(e => {
      vouchers += `
  <VOUCHER VCHTYPE="Payment" ACTION="Create">
    <DATE>${formatTallyDate(e.entry_date)}</DATE>
    <VOUCHERNUMBER>${e.voucher_no || ''}</VOUCHERNUMBER>
    <NARRATION>${e.account_heads?.name || ''} - ${e.payee_name || ''} - ${e.description || ''}</NARRATION>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${e.account_sub_heads?.name || e.account_heads?.name || 'Miscellaneous Expenditure'}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
      <AMOUNT>${e.amount}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${e.payment_mode === 'cheque' ? 'Bank Account' : 'Cash'}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
      <AMOUNT>-${e.amount}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>`
    })

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${currentOrg?.name}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">${vouchers}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`

    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SBA_Tally_${MONTHS[month-1]}_${year}.xml`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Tally XML downloaded!')
  }

  function exportToExcel() {
    if (!reportData) return toast.error('No report data to export!')

    // Build rows based on report type
    let rows = []
    let sheetName = 'Report'
    const range = getDateRange()

    if (reportData.type === 'ie') {
      sheetName = 'I&E Account'
      rows.push([currentOrg?.name])
      rows.push([`Income & Expenditure Account — ${range.label}`])
      rows.push([])
      rows.push(['INCOME', '', 'EXPENDITURE', ''])
      rows.push(['Head / Sub-Head', 'Amount (₹)', 'Head / Sub-Head', 'Amount (₹)'])

      const incomeRows = []
      Object.entries(reportData.incomeMap).forEach(([head, data]) => {
        incomeRows.push([head, '', '', ''])
        Object.entries(data.subs).forEach(([sub, amt]) => incomeRows.push([`  ${sub}`, amt, '', '']))
        incomeRows.push([`Total ${head}`, data.total, '', ''])
      })
      incomeRows.push(['TOTAL INCOME', reportData.totalIncome, '', ''])

      const expRows = []
      Object.entries(reportData.expMap).forEach(([head, data]) => {
        expRows.push(['', '', head, ''])
        Object.entries(data.subs).forEach(([sub, amt]) => expRows.push(['', '', `  ${sub}`, amt]))
        expRows.push(['', '', `Total ${head}`, data.total])
      })
      expRows.push(['', '', 'TOTAL EXPENDITURE', reportData.totalExp])
      expRows.push(['', '', reportData.surplus >= 0 ? 'NET SURPLUS' : 'NET DEFICIT', Math.abs(reportData.surplus)])

      const maxLen = Math.max(incomeRows.length, expRows.length)
      for (let i = 0; i < maxLen; i++) {
        const ir = incomeRows[i] || ['', '', '', '']
        const er = expRows[i] || ['', '', '', '']
        rows.push([ir[0], ir[1], er[2], er[3]])
      }

    } else if (reportData.type === 'vendor') {
      sheetName = 'Vendor Collection'
      rows.push([currentOrg?.name])
      rows.push([`Vendor-wise Rent Collection — ${range.label}`])
      rows.push([])
      rows.push(['#', 'Vendor Name', 'Category', 'Monthly Rent (₹)', 'Collected (₹)', 'Receipt Nos.'])
      Object.values(reportData.vendorMap).forEach((v, i) => {
        rows.push([i + 1, v.name, v.category, v.monthly_rent, v.total, v.collections.map(c => c.receipt_no).join(', ')])
      })
      rows.push(['', 'TOTAL', '', '', reportData.total, ''])

    } else if (reportData.type === 'arrears') {
      sheetName = 'Arrears Report'
      const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
      rows.push([currentOrg?.name])
      rows.push(['Pending Arrears Report — As on Date'])
      rows.push([])
      rows.push(['#', 'Vendor Name', 'Category', 'Monthly Rent (₹)', 'Paid Upto', 'Arrears (₹)'])
      reportData.vendors.forEach((v, i) => {
        rows.push([i + 1, v.name, v.vendor_categories?.name, v.monthly_rent,
          v.paid_upto_month ? `${MONTHS_S[v.paid_upto_month-1]} ${v.paid_upto_year}` : '—',
          v.opening_arrears])
      })
      rows.push(['', 'TOTAL ARREARS', '', '', '', reportData.total])

    } else if (reportData.type === 'cashbook') {
      sheetName = 'Cash Bank Summary'
      rows.push([currentOrg?.name])
      rows.push([`Cash & Bank Summary — ${range.label}`])
      rows.push([])
      rows.push(['Cash Accounts'])
      rows.push(['Cashier', 'Receipts (₹)', 'Payments (₹)', 'Balance (₹)'])
      reportData.cashSummary.forEach(c => rows.push([c.name, c.receipts, c.payments, c.balance]))
      rows.push([])
      rows.push(['Bank Accounts'])
      rows.push(['Account', 'Account No.', 'Receipts (₹)', 'Payments (₹)', 'Balance (₹)'])
      reportData.bankSummary.forEach(b => rows.push([b.name, b.acct, b.receipts, b.payments, b.balance]))
    }

    // Use SheetJS via CDN — create CSV as fallback
    const csvContent = rows.map(row =>
      row.map(cell => {
        if (cell === undefined || cell === null) return ''
        const str = String(cell)
        return str.includes(',') || str.includes('"') || str.includes('\n')
          ? `"${str.replace(/"/g, '""')}"` : str
      }).join(',')
    ).join('\n')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `SBA_${sheetName.replace(/ /g,'_')}_${range.label.replace(/ /g,'_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Excel/CSV downloaded! Open in Excel.')
  }

  function handlePrint() {
    const content = printRef.current?.innerHTML
    if (!content) return
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Report - ${currentOrg?.name}</title>
      <style>
        @page { margin: 15mm; size: A4; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
        h1 { font-size: 14px; text-align: center; margin-bottom: 4px; }
        h2 { font-size: 12px; text-align: center; margin-bottom: 12px; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { background: #1e3a8a; color: white; padding: 6px 8px; text-align: left; font-size: 10px; }
        td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
        .total-row { font-weight: bold; background: #f3f4f6; }
        .surplus { color: green; font-weight: bold; }
        .deficit { color: red; font-weight: bold; }
        .section-title { font-weight: bold; font-size: 11px; background: #dbeafe; padding: 4px 8px; margin-top: 8px; }
        .text-right { text-align: right; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style>
    </head><body>${content}
    <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`)
    win.document.close()
  }

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-700" /> Reports
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </button>
          {reportData && activeReport !== 'tally' && (
            <button onClick={exportToExcel} className="btn-success flex items-center gap-2">
              <Download className="w-4 h-4" /> Excel / CSV
            </button>
          )}
          {isAdmin && activeReport === 'tally' && (
            <button onClick={generateTallyXML} className="btn-primary flex items-center gap-2">
              <Download className="w-4 h-4" /> Download XML
            </button>
          )}
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {reports.map(r => {
          const Icon = r.icon
          return (
            <button key={r.id} onClick={() => setActiveReport(r.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeReport === r.id ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              <Icon className="w-4 h-4" /> {r.label}
            </button>
          )
        })}
      </div>

      {/* Month/Year Filter */}
      {activeReport !== 'arrears' && (
        <div className="card mb-4 p-4">
          {/* Period Type Selector */}
          <div className="flex gap-2 mb-3">
            {[
              { id: 'month', label: 'Single Month' },
              { id: 'fy', label: 'Financial Year' },
              { id: 'range', label: 'Custom Range' },
            ].map(p => (
              <button key={p.id} onClick={() => setPeriodType(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${periodType === p.id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Single Month */}
          {periodType === 'month' && (
            <div className="flex gap-3 items-center">
              <Calendar className="w-4 h-4 text-gray-400" />
              <select className="input w-auto" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select className="input w-auto" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
                {YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          )}

          {/* Financial Year */}
          {periodType === 'fy' && (
            <div className="flex gap-3 items-center">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">Financial Year starting April:</span>
              <select className="input w-auto" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
                {YEARS.map(y => <option key={y} value={y}>FY {y}-{String(y+1).slice(2)}</option>)}
              </select>
            </div>
          )}

          {/* Custom Range — exact dates */}
          {periodType === 'range' && (
            <div className="flex gap-3 items-center flex-wrap">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600 font-medium">From:</span>
              <input type="date" className="input w-auto" value={fromDate}
                onChange={e => setFromDate(e.target.value)} />
              <span className="text-sm text-gray-600 font-medium">To:</span>
              <input type="date" className="input w-auto" value={toDate}
                onChange={e => setToDate(e.target.value)} />
            </div>
          )}

          <p className="text-xs text-blue-600 mt-2 font-medium">
            📅 Period: {getDateRange().label}
          </p>
        </div>
      )}

      {/* Report Content */}
      <div ref={printRef}>
        {loading ? (
          <div className="card text-center py-16 text-gray-400">Loading report...</div>
        ) : !reportData ? (
          <div className="card text-center py-16 text-gray-400">Select a report and period</div>
        ) : (
          <>
            {/* ---- I&E REPORT ---- */}
            {reportData.type === 'ie' && (
              <IEReport data={reportData} orgName={currentOrg?.name} fmt={fmt} />
            )}

            {/* ---- VENDOR REPORT ---- */}
            {reportData.type === 'vendor' && (
              <VendorReport data={reportData} fmt={fmt} />
            )}

            {/* ---- ARREARS REPORT ---- */}
            {reportData.type === 'arrears' && (
              <ArrearsReport data={reportData} fmt={fmt} />
            )}

            {/* ---- CASHBOOK REPORT ---- */}
            {reportData.type === 'cashbook' && (
              <CashbookReport data={reportData} fmt={fmt} />
            )}

            {/* ---- TALLY REPORT ---- */}
            {reportData.type === 'tally' && (
              <TallyPreview data={reportData} fmt={fmt} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ---- SUB COMPONENTS ----

function IEReport({ data, orgName, fmt }) {
  const { incomeMap, expMap, totalIncome, totalExp, surplus, label } = data
  return (
    <div className="card">
      <h1 className="text-center text-xl font-bold text-gray-800 mb-1">{orgName}</h1>
      <h2 className="text-center text-base font-semibold text-gray-600 mb-4">
        Income & Expenditure Account — {label}
      </h2>
      <div className="grid grid-cols-2 gap-0 border border-gray-200 rounded-lg overflow-hidden">
        {/* INCOME SIDE */}
        <div className="border-r border-gray-200">
          <div className="bg-green-800 text-white px-4 py-2 text-sm font-bold">INCOME</div>
          {Object.entries(incomeMap).map(([head, data]) => (
            <div key={head}>
              <div className="px-4 py-1.5 bg-green-50 text-sm font-semibold text-green-800 border-b border-green-100">
                {head}
              </div>
              {Object.entries(data.subs).map(([sub, amt]) => (
                <div key={sub} className="flex justify-between px-6 py-1 text-xs border-b border-gray-50">
                  <span className="text-gray-600">{sub}</span>
                  <span className="font-medium">{fmt(amt)}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-1.5 text-sm font-bold bg-gray-50 border-b border-gray-200">
                <span>Total {head}</span>
                <span>{fmt(data.total)}</span>
              </div>
            </div>
          ))}
          <div className="flex justify-between px-4 py-3 text-base font-bold bg-green-100 border-t-2 border-green-300">
            <span>TOTAL INCOME</span>
            <span className="text-green-800">{fmt(totalIncome)}</span>
          </div>
        </div>

        {/* EXPENDITURE SIDE */}
        <div>
          <div className="bg-red-800 text-white px-4 py-2 text-sm font-bold">EXPENDITURE</div>
          {Object.entries(expMap).map(([head, data]) => (
            <div key={head}>
              <div className="px-4 py-1.5 bg-red-50 text-sm font-semibold text-red-800 border-b border-red-100">
                {head}
              </div>
              {Object.entries(data.subs).map(([sub, amt]) => (
                <div key={sub} className="flex justify-between px-6 py-1 text-xs border-b border-gray-50">
                  <span className="text-gray-600">{sub}</span>
                  <span className="font-medium">{fmt(amt)}</span>
                </div>
              ))}
              <div className="flex justify-between px-4 py-1.5 text-sm font-bold bg-gray-50 border-b border-gray-200">
                <span>Total {head}</span>
                <span>{fmt(data.total)}</span>
              </div>
            </div>
          ))}
          <div className="flex justify-between px-4 py-3 text-base font-bold bg-red-100 border-t-2 border-red-300">
            <span>TOTAL EXPENDITURE</span>
            <span className="text-red-800">{fmt(totalExp)}</span>
          </div>
          {/* Surplus/Deficit */}
          <div className={`flex justify-between px-4 py-3 text-base font-bold border-t-2 ${surplus >= 0 ? 'bg-green-50 border-green-400 text-green-800' : 'bg-red-50 border-red-400 text-red-800'}`}>
            <span>{surplus >= 0 ? 'NET SURPLUS' : 'NET DEFICIT'}</span>
            <span>{fmt(Math.abs(surplus))}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function VendorReport({ data, fmt }) {
  const { vendorMap, total, label } = data
  return (
    <div className="card">
      <h2 className="text-center text-base font-bold mb-4">Vendor-wise Rent Collection — {label}</h2>
      <table className="w-full">
        <thead>
          <tr>
            {['#','Vendor Name','Category','Monthly Rent','Collected','Receipts'].map(h => (
              <th key={h} className="table-header text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.values(vendorMap).map((v, i) => (
            <tr key={v.name} className={i%2===0?'bg-white':'bg-gray-50'}>
              <td className="table-cell text-xs">{i+1}</td>
              <td className="table-cell font-medium">{v.name}</td>
              <td className="table-cell text-xs"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{v.category}</span></td>
              <td className="table-cell text-right">{fmt(v.monthly_rent)}</td>
              <td className="table-cell text-right font-semibold text-green-700">{fmt(v.total)}</td>
              <td className="table-cell text-xs text-gray-500">{v.collections.map(c => c.receipt_no).join(', ')}</td>
            </tr>
          ))}
          <tr className="bg-blue-900 text-white font-bold">
            <td className="px-4 py-2" colSpan={4}>TOTAL COLLECTION</td>
            <td className="px-4 py-2 text-right">{fmt(total)}</td>
            <td className="px-4 py-2"></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function ArrearsReport({ data, fmt }) {
  const { vendors, total } = data
  const MONTHS_ARR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return (
    <div className="card">
      <h2 className="text-center text-base font-bold mb-4">Pending Arrears Report — As on Date</h2>
      <table className="w-full">
        <thead>
          <tr>
            {['#','Vendor Name','Category','Monthly Rent','Paid Upto','Arrears'].map(h => (
              <th key={h} className="table-header text-left">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {vendors.map((v, i) => (
            <tr key={v.name} className={`${i%2===0?'bg-white':'bg-gray-50'} ${v.opening_arrears >= 24000 ? 'border-l-4 border-red-400' : ''}`}>
              <td className="table-cell text-xs">{i+1}</td>
              <td className="table-cell font-medium">{v.name}</td>
              <td className="table-cell text-xs"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{v.vendor_categories?.name}</span></td>
              <td className="table-cell text-right">{fmt(v.monthly_rent)}</td>
              <td className="table-cell text-xs">{v.paid_upto_month ? `${MONTHS_ARR[v.paid_upto_month-1]} ${v.paid_upto_year}` : '—'}</td>
              <td className={`table-cell text-right font-bold ${v.opening_arrears >= 24000 ? 'text-red-600' : 'text-orange-600'}`}>
                {fmt(v.opening_arrears)}
              </td>
            </tr>
          ))}
          <tr className="bg-red-900 text-white font-bold">
            <td className="px-4 py-2" colSpan={5}>TOTAL PENDING ARREARS</td>
            <td className="px-4 py-2 text-right">{fmt(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function CashbookReport({ data, fmt }) {
  const { cashSummary, bankSummary, label } = data
  return (
    <div className="card space-y-6">
      <h2 className="text-center text-base font-bold">Cash & Bank Summary — {label}</h2>
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">💵 Cash Accounts</h3>
        <table className="w-full">
          <thead><tr>{['Cashier','Receipts','Payments','Closing Balance'].map(h=><th key={h} className="table-header text-left">{h}</th>)}</tr></thead>
          <tbody>
            {cashSummary.map((c,i)=>(
              <tr key={c.name} className={i%2===0?'bg-white':'bg-gray-50'}>
                <td className="table-cell font-medium">{c.name}</td>
                <td className="table-cell text-right text-green-700 font-semibold">{fmt(c.receipts)}</td>
                <td className="table-cell text-right text-red-600 font-semibold">{fmt(c.payments)}</td>
                <td className={`table-cell text-right font-bold ${c.balance>=0?'text-blue-700':'text-red-600'}`}>{fmt(c.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-2">🏦 Bank Accounts</h3>
        <table className="w-full">
          <thead><tr>{['Account','A/c No.','Receipts','Payments','Balance'].map(h=><th key={h} className="table-header text-left">{h}</th>)}</tr></thead>
          <tbody>
            {bankSummary.map((b,i)=>(
              <tr key={b.name} className={i%2===0?'bg-white':'bg-gray-50'}>
                <td className="table-cell font-medium">{b.name}</td>
                <td className="table-cell text-xs font-mono text-gray-500">{b.acct}</td>
                <td className="table-cell text-right text-green-700 font-semibold">{fmt(b.receipts)}</td>
                <td className="table-cell text-right text-red-600 font-semibold">{fmt(b.payments)}</td>
                <td className={`table-cell text-right font-bold ${b.balance>=0?'text-blue-700':'text-red-600'}`}>{fmt(b.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TallyPreview({ data, fmt }) {
  const { rent, income, expenditure, label } = data
  const totalRent = rent.reduce((s,r)=>s+Number(r.amount),0)
  const totalInc = income.reduce((s,r)=>s+Number(r.amount),0)
  const totalExp = expenditure.reduce((s,r)=>s+Number(r.amount),0)

  return (
    <div className="card space-y-4">
      <h2 className="text-center text-base font-bold">Tally XML Export — {label}</h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{rent.length + income.length}</p>
          <p className="text-sm text-green-600">Receipt Vouchers</p>
          <p className="text-xs text-green-500 mt-1">{fmt(totalRent + totalInc)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{expenditure.length}</p>
          <p className="text-sm text-red-600">Payment Vouchers</p>
          <p className="text-xs text-red-500 mt-1">{fmt(totalExp)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{rent.length + income.length + expenditure.length}</p>
          <p className="text-sm text-blue-600">Total Vouchers</p>
          <p className="text-xs text-blue-500 mt-1">Ready for Tally</p>
        </div>
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">📥 How to import in Tally:</p>
        <ol className="list-decimal ml-4 space-y-1 text-xs">
          <li>Click "Download XML" button above</li>
          <li>Open TallyPrime → Gateway of Tally → Import Data</li>
          <li>Select "Vouchers" → Browse the downloaded XML file</li>
          <li>All vouchers will be imported with same receipt/voucher numbers</li>
        </ol>
      </div>
    </div>
  )
}
