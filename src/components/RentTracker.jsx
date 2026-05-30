import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import {
  Building2, Plus, Search, Filter, ChevronDown, ChevronRight,
  Receipt, AlertCircle, CheckCircle, XCircle, Pencil,
  Eye, RotateCcw, IndianRupee, FileText, Phone, Download, FileSpreadsheet, Upload
} from 'lucide-react'
import CollectionModal from './rent/CollectionModal'
import WaiverModal from './rent/WaiverModal'
import VendorModal from './rent/VendorModal'
import VendorLedger from './rent/VendorLedger'
import ReceiptPrint from './rent/ReceiptPrint'

import { computeOutstanding, paidUptoLabel, monthsDue } from '../utils/duesCalc'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CATEGORIES = ['All','Typist Pool 1','Typist Pool 2','Photostat Vendor','Tea Stall','Stationery','Canteen / Kiosk']

export default function RentTracker() {
  const { currentOrg, userRole } = useAuth()
  const [vendors, setVendors] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('All')
  const [filterStatus, setFilterStatus] = useState('all')
  const [expandedVendor, setExpandedVendor] = useState(null)

  // Modals
  const [collectionVendor, setCollectionVendor] = useState(null)
  const [waiverVendor, setWaiverVendor] = useState(null)
  const [editVendor, setEditVendor] = useState(null)
  const [showAddVendor, setShowAddVendor] = useState(false)
  const [ledgerVendor, setLedgerVendor] = useState(null)
  const [printReceipt, setPrintReceipt] = useState(null)

  const isAdmin = ['admin','cashier','supervisor','accountant'].includes(userRole?.role)
  const isAdminOnly = userRole?.role === 'admin'
  const [showImport, setShowImport] = useState(false)
  const canCollect = ['admin','cashier','supervisor'].includes(userRole?.role)
  const isCashier = ['admin','cashier','supervisor'].includes(userRole?.role)

  useEffect(() => { if (currentOrg) fetchData() }, [currentOrg])

  function downloadVendorTemplate() {
    const wb = XLSX.utils.book_new()

    const vendorData = [
      ['Vendor Name', 'Category', 'Floor', 'Location/Shop No.', 'Mobile', 'Monthly Rent (₹)', 'Security Deposit (₹)', 'Paid Upto Month (1-12)', 'Paid Upto Year', 'Opening Arrears (₹)', 'Status', 'Remarks'],
      ['Ram Typist', 'Typist Pool 1', 'Ground', 'Shop G-1', '9999999999', 1200, 5000, 12, 2024, 0, 'active', ''],
      ['Shyam Photostat', 'Photostat Vendor', 'First', 'Shop F-3', '8888888888', 2000, 10000, 11, 2024, 2000, 'active', 'Arrears pending'],
      ['Closed Stall', 'Tea Stall', 'Ground', 'G-5', '', 800, 3000, 6, 2024, 0, 'inactive', 'Closed'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(vendorData)
    ws['!cols'] = [
      { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 18 }, { wch: 14 },
      { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 25 }
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors')

    const instrData = [
      ['DCBA — Vendor Bulk Import Instructions'],
      [],
      ['Column Notes:'],
      ['• Category — Any text; if not found in system, it will be created automatically'],
      ['• Paid Upto Month — Enter 1-12 (January=1, December=12)'],
      ['• Paid Upto Year — e.g. 2024'],
      ['• Opening Arrears — Manual adjustment if needed (0 for none)'],
      ['• Status — Must be exactly "active" or "inactive"'],
      ['• Outstanding is auto-calculated from Monthly Rent × months since Paid Upto'],
      [],
      ['Example: Paid Upto Month=12, Year=2024, Monthly Rent=1200'],
      ['  → O/S from Jan 2025 to current month is auto-calculated'],
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(instrData)
    ws2['!cols'] = [{ wch: 70 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Instructions')

    XLSX.writeFile(wb, 'DCBA_Vendor_Import_Template.xlsx')
    toast.success('Template downloaded!')
  }

  async function fetchData() {
    setLoading(true)
    const [{ data: v }, { data: c }] = await Promise.all([
      supabase.from('vendors').select('*, vendor_categories(name)').eq('org_id', currentOrg.id).order('name'),
      supabase.from('vendor_categories').select('*').eq('org_id', currentOrg.id).order('sort_order'),
    ])
    setVendors(v || [])
    setCategories(c || [])
    setLoading(false)
  }

  // Filter vendors
  const filtered = vendors.filter(v => {
    const matchSearch = v.name.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'All' || v.vendor_categories?.name === filterCat
    const matchStatus = filterStatus === 'all' || v.status === filterStatus
    return matchSearch && matchCat && matchStatus
  })

  // Summary stats
  const activeVendors = vendors.filter(v => v.status === 'active')
  const totalMonthlyRent = activeVendors.reduce((s, v) => s + (v.monthly_rent || 0), 0)
  const totalOutstanding = activeVendors.reduce((s, v) => s + computeOutstanding(v), 0)
  const highArrears = activeVendors.filter(v => computeOutstanding(v) >= 24000).length

  function getArrearsBadge(vendor) {
    if (vendor.status !== 'active') return null
    const outstanding = computeOutstanding(vendor)
    if (outstanding === 0) return <span className="badge-clear">Clear</span>
    if (outstanding >= 24000) return <span className="badge-arrears">⚠ ₹{outstanding.toLocaleString('en-IN')}</span>
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">₹{outstanding.toLocaleString('en-IN')}</span>
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-blue-700" /> Rent Tracker
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
        </div>
        {['admin','cashier','supervisor'].includes(userRole?.role) && (
          <div className="flex gap-2">
            <button onClick={() => downloadVendorTemplate()}
              className="btn-secondary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Template
            </button>
            {isAdminOnly && (
              <button onClick={() => setShowImport(true)}
                className="btn-secondary flex items-center gap-2 text-sm">
                <FileSpreadsheet className="w-4 h-4" /> Bulk Import
              </button>
            )}
            <button onClick={() => setShowAddVendor(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Vendor
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Active Vendors', value: activeVendors.length, color: 'blue', icon: Building2 },
          { label: 'Monthly Rent Roll', value: `₹${totalMonthlyRent.toLocaleString('en-IN')}`, color: 'green', icon: IndianRupee },
          { label: 'Total Outstanding', value: `₹${totalOutstanding.toLocaleString('en-IN')}`, color: 'red', icon: AlertCircle },
          { label: 'High Arrears (24k+)', value: highArrears, color: 'orange', icon: XCircle },
        ].map(s => {
          const Icon = s.icon
          const colors = { blue:'bg-blue-50 border-blue-200 text-blue-700', green:'bg-green-50 border-green-200 text-green-700', red:'bg-red-50 border-red-200 text-red-700', orange:'bg-orange-50 border-orange-200 text-orange-700' }
          return (
            <div key={s.label} className={`rounded-xl border p-4 ${colors[s.color]}`}>
              <Icon className="w-5 h-5 mb-2 opacity-70" />
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs font-medium opacity-80 mt-0.5">{s.label}</p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search vendor name..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-auto" value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <select className="input w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="vacant">Vacant</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Vendor Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Vendor Name', 'Category', 'Monthly Rent', 'Paid Upto', 'Arrears', 'Status', 'Actions'].map(h => (
                  <th key={h} className="table-header text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="table-cell text-center py-8 text-gray-400">Loading vendors...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center py-8 text-gray-400">No vendors found</td></tr>
              ) : filtered.map((vendor, idx) => (
                <>
                  <tr key={vendor.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/30 transition-colors`}>
                    <td className="table-cell">
                      <div className="font-medium text-gray-800">{vendor.name}</div>
                      {vendor.floor && <div className="text-xs text-gray-400">{vendor.floor} {vendor.location && `— ${vendor.location}`}</div>}
                      {vendor.mobile && <div className="text-xs text-gray-400 flex items-center gap-1"><Phone className="w-3 h-3" />{vendor.mobile}</div>}
                    </td>
                    <td className="table-cell">
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {vendor.vendor_categories?.name || '—'}
                      </span>
                    </td>
                    <td className="table-cell font-semibold">
                      {vendor.monthly_rent > 0 ? `₹${vendor.monthly_rent.toLocaleString('en-IN')}` : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="table-cell text-sm">{paidUptoLabel(vendor)}</td>
                    <td className="table-cell">{getArrearsBadge(vendor)}</td>
                    <td className="table-cell">
                      {vendor.status === 'active' && <span className="badge-active">Active</span>}
                      {vendor.status === 'vacant' && <span className="badge-inactive">Vacant</span>}
                      {vendor.status === 'closed' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Closed</span>}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        {/* Collect Rent */}
                        {isCashier && vendor.status === 'active' && (
                          <button onClick={() => setCollectionVendor(vendor)}
                            title="Collect Rent"
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                            <Receipt className="w-4 h-4" />
                          </button>
                        )}
                        {/* Waiver */}
                        {isCashier && vendor.status === 'active' && (
                          <button onClick={() => setWaiverVendor(vendor)}
                            title="Record Waiver"
                            className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        {/* Ledger */}
                        <button onClick={() => setLedgerVendor(vendor)}
                          title="View Ledger"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Edit */}
                        {isAdmin && (
                          <button onClick={() => setEditVendor(vendor)}
                            title="Edit Vendor"
                            className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                </>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
          Showing {filtered.length} of {vendors.length} vendors
        </div>
      </div>

      {/* Modals */}
      {collectionVendor && (
        <CollectionModal
          vendor={collectionVendor}
          org={currentOrg}
          userRole={userRole}
          onClose={() => setCollectionVendor(null)}
          onSuccess={(receipt) => {
            setCollectionVendor(null)
            fetchData()
            if (receipt) setPrintReceipt(receipt)
          }}
        />
      )}

      {waiverVendor && (
        <WaiverModal
          vendor={waiverVendor}
          org={currentOrg}
          userRole={userRole}
          onClose={() => setWaiverVendor(null)}
          onSuccess={() => { setWaiverVendor(null); fetchData() }}
        />
      )}

      {(editVendor || showAddVendor) && (
        <VendorModal
          vendor={editVendor}
          categories={categories}
          org={currentOrg}
          onClose={() => { setEditVendor(null); setShowAddVendor(false) }}
          onSuccess={() => { setEditVendor(null); setShowAddVendor(false); fetchData() }}
        />
      )}

      {ledgerVendor && (
        <VendorLedger
          vendor={ledgerVendor}
          org={currentOrg}
          onClose={() => setLedgerVendor(null)}
          onPrintReceipt={(r) => setPrintReceipt(r)}
        />
      )}

      {printReceipt && (
        <ReceiptPrint
          receipt={printReceipt}
          org={currentOrg}
          onClose={() => setPrintReceipt(null)}
        />
      )}
      {showImport && (
        <VendorBulkImport
          org={currentOrg}
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); fetchData() }}
        />
      )}
    </div>
  )
}

// ---- VENDOR BULK IMPORT ----
function VendorBulkImport({ org, onClose, onSuccess }) {
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [errors, setErrors] = useState([])
  const [step, setStep] = useState(1)

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setErrors([])

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const ws = wb.Sheets['Vendors'] || wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        const errs = []
        const vendors = []

        rows.slice(1).forEach((row, i) => {
          if (!row[0]) return
          const name = String(row[0]).trim()
          const category = String(row[1] || '').trim()
          const floor = String(row[2] || '').trim()
          const location = String(row[3] || '').trim()
          const mobile = String(row[4] || '').trim()
          const monthlyRent = Number(row[5]) || 0
          const securityDeposit = Number(row[6]) || 0
          const paidUptoMonth = Number(row[7]) || new Date().getMonth() + 1
          const paidUptoYear = Number(row[8]) || new Date().getFullYear()
          const openingArrears = Number(row[9]) || 0
          const status = String(row[10] || 'active').trim().toLowerCase()
          const remarks = String(row[11] || '').trim()

          if (!name) { errs.push(`Row ${i+2}: Vendor name required`); return }
          if (!['active','inactive'].includes(status)) { errs.push(`Row ${i+2}: Status must be active or inactive`) }
          if (paidUptoMonth < 1 || paidUptoMonth > 12) { errs.push(`Row ${i+2}: Paid Upto Month must be 1-12`) }

          vendors.push({ name, category, floor, location, mobile, monthlyRent, securityDeposit, paidUptoMonth, paidUptoYear, openingArrears, status, remarks })
        })

        setErrors(errs)
        setPreview(vendors)
        setStep(2)
      } catch (err) {
        toast.error('Error reading file: ' + err.message)
      }
    }
    reader.readAsBinaryString(f)
  }

  async function handleImport() {
    if (!preview?.length) return
    setImporting(true)
    let imported = 0, skipped = 0
    const errs = []

    try {
      // Fetch existing categories
      const { data: existingCats } = await supabase.from('vendor_categories')
        .select('*').eq('org_id', org.id)
      const catMap = {}
      existingCats?.forEach(c => { catMap[c.name.toLowerCase()] = c.id })

      for (const v of preview) {
        try {
          // Create category if not exists
          let categoryId = null
          if (v.category) {
            const catKey = v.category.toLowerCase()
            if (catMap[catKey]) {
              categoryId = catMap[catKey]
            } else {
              const { data: newCat, error: catErr } = await supabase.from('vendor_categories').insert({
                org_id: org.id,
                name: v.category,
                sort_order: Object.keys(catMap).length + 1,
              }).select().single()
              if (!catErr && newCat) {
                catMap[catKey] = newCat.id
                categoryId = newCat.id
              }
            }
          }

          const { error } = await supabase.from('vendors').upsert({
            org_id: org.id,
            name: v.name,
            category_id: categoryId,
            floor: v.floor,
            location: v.location,
            mobile: v.mobile,
            monthly_rent: v.monthlyRent,
            security_deposit: v.securityDeposit,
            paid_upto_month: v.paidUptoMonth,
            paid_upto_year: v.paidUptoYear,
            opening_arrears: v.openingArrears,
            status: v.status,
            remarks: v.remarks,
          }, { onConflict: 'org_id,name' })

          if (error) { errs.push(`${v.name}: ${error.message}`); skipped++ }
          else imported++
        } catch (err) {
          errs.push(`${v.name}: ${err.message}`); skipped++
        }
      }

      setErrors(errs)
      setStep(3)
      toast.success(`Import complete! ${imported} vendors imported, ${skipped} skipped`)
    } catch (err) {
      toast.error(err.message)
    }
    setImporting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-700" /> Vendor Bulk Import
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
                <p className="font-semibold mb-2">Instructions:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Download template using the "Template" button in Rent Tracker</li>
                  <li>• Category: any name — auto-created if not found</li>
                  <li>• Status: must be exactly "active" or "inactive"</li>
                  <li>• Paid Upto Month: 1-12, Year: e.g. 2024</li>
                  <li>• Existing vendors (same name) will be updated</li>
                </ul>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-2">Upload filled Excel file</p>
                <label className="btn-primary cursor-pointer inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Choose File
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
                </label>
              </div>
            </div>
          )}

          {step === 2 && preview && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-700">{preview.length}</p>
                <p className="text-xs text-blue-600">Vendors to import</p>
              </div>
              {errors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <p className="text-sm font-semibold text-yellow-800 mb-2">⚠️ {errors.length} warning{errors.length > 1 ? 's' : ''}:</p>
                  {errors.map((e, i) => <p key={i} className="text-xs text-yellow-700">{e}</p>)}
                </div>
              )}
              <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    {['Vendor Name','Category','Monthly Rent','Paid Upto','Status'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0,8).map((v, i) => (
                    <tr key={i} className={i%2===0?'bg-white':'bg-gray-50/50'}>
                      <td className="px-3 py-1.5 font-medium">{v.name}</td>
                      <td className="px-3 py-1.5 text-gray-500">{v.category || '—'}</td>
                      <td className="px-3 py-1.5">₹{v.monthlyRent.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-1.5">{v.paidUptoMonth}/{v.paidUptoYear}</td>
                      <td className="px-3 py-1.5">
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${v.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {preview.length > 8 && (
                    <tr><td colSpan={5} className="px-3 py-2 text-center text-gray-400">... and {preview.length - 8} more</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Import Complete!</h3>
              {errors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mt-4 text-left">
                  <p className="text-sm font-semibold text-yellow-800 mb-2">Issues ({errors.length}):</p>
                  {errors.map((e, i) => <p key={i} className="text-xs text-yellow-700">{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-between">
          <button onClick={onClose} className="btn-secondary">
            {step === 3 ? 'Close' : 'Cancel'}
          </button>
          {step === 2 && (
            <div className="flex gap-2">
              <button onClick={() => { setStep(1); setPreview(null) }} className="btn-secondary">← Back</button>
              <button onClick={handleImport} disabled={importing || !preview?.length}
                className="btn-primary flex items-center gap-2">
                {importing ? 'Importing...' : `Import ${preview?.length} Vendors`}
              </button>
            </div>
          )}
          {step === 3 && <button onClick={onSuccess} className="btn-primary">✓ Done</button>}
        </div>
      </div>
    </div>
  )
}
