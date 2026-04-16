import { useEffect, useState } from 'react'
import { supabase } from '../../supabaseClient'
import { X, FileText, Printer, RotateCcw } from 'lucide-react'
import ReceiptPrint from './ReceiptPrint'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
}

export default function VendorLedger({ vendor, org, onClose, onPrintReceipt }) {
  const [collections, setCollections] = useState([])
  const [waivers, setWaivers] = useState([])
  const [loading, setLoading] = useState(true)
  const [reprintReceipt, setReprintReceipt] = useState(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [{ data: c }, { data: w }] = await Promise.all([
      supabase.from('rent_collections').select('*').eq('vendor_id', vendor.id).order('collection_date', { ascending: false }),
      supabase.from('rent_waivers').select('*').eq('vendor_id', vendor.id).order('waiver_date', { ascending: false }),
    ])
    setCollections(c || [])
    setWaivers(w || [])
    setLoading(false)
  }

  // Merge and sort all transactions
  const allTxns = [
    ...(collections.map(c => ({ ...c, type: 'collection', date: c.collection_date }))),
    ...(waivers.map(w => ({ ...w, type: 'waiver', date: w.waiver_date }))),
  ].sort((a, b) => new Date(b.date) - new Date(a.date))

  const totalCollected = collections.reduce((s, c) => s + Number(c.amount), 0)
  const totalWaived = waivers.reduce((s, w) => s + Number(w.amount), 0)

  function handleReprint(collection) {
    const receiptData = {
      receipt_no: collection.receipt_no,
      date: collection.collection_date,
      vendor_name: vendor.name,
      vendor_mobile: vendor.mobile,
      amount: Number(collection.amount),
      amount_words: '',
      period: collection.months_covered,
      payment_mode: collection.payment_mode,
      cashier_name: '',
      org_name: org.name,
      remarks: collection.remarks,
    }
    setReprintReceipt(receiptData)
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" /> Vendor Ledger
              </h3>
              <p className="text-gray-500 text-sm">{vendor.name}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
          </div>

          {/* Summary */}
          <div className="px-6 py-3 bg-gray-50 border-b grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Monthly Rent</p>
              <p className="font-bold text-gray-800">₹{vendor.monthly_rent?.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Total Collected</p>
              <p className="font-bold text-green-700">₹{totalCollected.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Total Waived</p>
              <p className="font-bold text-orange-600">₹{totalWaived.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Current Arrears</p>
              <p className={`font-bold ${vendor.opening_arrears > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ₹{(vendor.opening_arrears||0).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Transactions */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <p className="text-gray-400 text-center py-8">Loading...</p>
            ) : allTxns.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No transactions recorded yet</p>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0">
                  <tr>
                    {['Date', 'Type', 'Receipt/Ref No.', 'Period', 'Mode', 'Amount', 'Action'].map(h => (
                      <th key={h} className="table-header text-left text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allTxns.map((txn, i) => (
                    <tr key={txn.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="table-cell text-xs">{formatDate(txn.date)}</td>
                      <td className="table-cell">
                        {txn.type === 'collection' ? (
                          <span className="badge-clear text-xs">Receipt</span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Waiver</span>
                        )}
                      </td>
                      <td className="table-cell text-xs font-mono">{txn.receipt_no || txn.id?.slice(0,8)}</td>
                      <td className="table-cell text-xs">{txn.months_covered || (txn.from_month ? `${MONTHS[txn.from_month-1]} ${txn.from_year}` : '—')}</td>
                      <td className="table-cell text-xs capitalize">{txn.payment_mode || (txn.reason ? 'Waiver' : '—')}</td>
                      <td className={`table-cell text-sm font-semibold ${txn.type === 'waiver' ? 'text-orange-600' : 'text-green-700'}`}>
                        {txn.type === 'waiver' ? '−' : ''}₹{Number(txn.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="table-cell">
                        {txn.type === 'collection' && txn.receipt_no && (
                          <button onClick={() => handleReprint(txn)}
                            title="Reprint Receipt"
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {txn.type === 'waiver' && txn.reason && (
                          <span title={txn.reason} className="p-1 text-orange-500 cursor-help">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="px-6 py-4 border-t flex justify-end">
            <button onClick={onClose} className="btn-secondary">Close</button>
          </div>
        </div>
      </div>

      {reprintReceipt && (
        <ReceiptPrint
          receipt={reprintReceipt}
          org={org}
          isReprint={true}
          onClose={() => setReprintReceipt(null)}
        />
      )}
    </>
  )
}
