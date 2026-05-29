import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import {
  Building2, Plus, Search, Filter, ChevronDown, ChevronRight,
  Receipt, AlertCircle, CheckCircle, XCircle, Pencil,
  Eye, RotateCcw, IndianRupee, FileText, Phone
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
  const canCollect = ['admin','cashier','supervisor'].includes(userRole?.role)
  const isCashier = ['admin','cashier','supervisor'].includes(userRole?.role)

  useEffect(() => { if (currentOrg) fetchData() }, [currentOrg])

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
          <button onClick={() => setShowAddVendor(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Vendor
          </button>
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
    </div>
  )
}
