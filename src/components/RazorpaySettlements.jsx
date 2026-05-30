import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { IndianRupee, CheckCircle, Clock, Search, Download, RefreshCw, CreditCard, Building2 } from 'lucide-react'
import * as XLSX from 'xlsx'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()}`
}
function fmtAmt(n) { return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` }

function getFY() {
  const now = new Date()
  return now.getMonth() >= 3
    ? `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(2)}`
    : `${now.getFullYear() - 1}-${String(now.getFullYear()).slice(2)}`
}

// Group payments by date
function groupByDate(payments) {
  return payments.reduce((acc, p) => {
    const d = p.payment_date
    if (!acc[d]) acc[d] = []
    acc[d].push(p)
    return acc
  }, {})
}

export default function RazorpaySettlements() {
  const { currentOrg, userRole } = useAuth()
  const [payments, setPayments] = useState([])
  const [settlements, setSettlements] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending') // 'pending' | 'settled' | 'all'
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
  const [showSettleModal, setShowSettleModal] = useState(null) // date group
  const [stats, setStats] = useState({ total: 0, settled: 0, pending: 0, pendingAmt: 0, settledAmt: 0 })

  const isAdmin = ['admin', 'supervisor', 'accountant'].includes(userRole?.role)

  useEffect(() => { if (currentOrg) { fetchData() } }, [currentOrg, fromDate, toDate, tab])

  async function fetchData() {
    setLoading(true)
    try {
      const [{ data: pay }, { data: set }, { data: banks }] = await Promise.all([
        supabase.from('dcba_razorpay_payments')
          .select('*, dcba_members(member_name, member_no)')
          .eq('org_id', currentOrg.id)
          .gte('payment_date', fromDate)
          .lte('payment_date', toDate)
          .order('payment_date', { ascending: false }),
        supabase.from('dcba_razorpay_settlements')
          .select('*, bank_accounts(account_name)')
          .eq('org_id', currentOrg.id)
          .gte('settlement_date', fromDate)
          .lte('settlement_date', toDate)
          .order('settlement_date', { ascending: false }),
        supabase.from('bank_accounts').select('*').eq('org_id', currentOrg.id).eq('is_active', true),
      ])

      setPayments(pay || [])
      setSettlements(set || [])
      setBankAccounts(banks || [])

      // Stats
      const all = pay || []
      const pending = all.filter(p => !p.settled)
      const settled = all.filter(p => p.settled)
      setStats({
        total: all.length,
        pending: pending.length,
        settled: settled.length,
        pendingAmt: pending.reduce((s, p) => s + Number(p.amount), 0),
        settledAmt: settled.reduce((s, p) => s + Number(p.amount), 0),
      })
    } catch (err) {
      toast.error(err.message)
    }
    setLoading(false)
  }

  // Filter payments by tab
  const filteredPayments = payments.filter(p => {
    if (tab === 'pending') return !p.settled
    if (tab === 'settled') return p.settled
    return true
  })

  const groupedByDate = groupByDate(filteredPayments)

  function handleExcel() {
    const wb = XLSX.utils.book_new()
    const rows = [
      ['DCBA — Razorpay Payment Register'],
      [`Period: ${fmt(fromDate)} to ${fmt(toDate)}`],
      [],
      ['Date', 'Payment ID', 'Member', 'Member No.', 'Purpose', 'Amount', 'Fee (2%)', 'Net Amount', 'Status'],
    ]
    filteredPayments.forEach(p => {
      rows.push([
        fmt(p.payment_date),
        p.razorpay_payment_id,
        p.member_name || p.dcba_members?.member_name || '—',
        p.member_no || p.dcba_members?.member_no || '—',
        p.payment_for,
        Number(p.amount),
        Number(p.fee_amount || 0),
        Number(p.net_amount || p.amount),
        p.settled ? 'Settled' : 'Pending',
      ])
    })
    rows.push([])
    rows.push(['', '', '', '', 'TOTAL',
      filteredPayments.reduce((s, p) => s + Number(p.amount), 0),
      filteredPayments.reduce((s, p) => s + Number(p.fee_amount || 0), 0),
      filteredPayments.reduce((s, p) => s + Number(p.net_amount || p.amount), 0),
      ''
    ])

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Razorpay Payments')

    // Settlements sheet
    if (settlements.length > 0) {
      const sRows = [
        ['DCBA — Razorpay Settlements'],
        [],
        ['Settlement Date', 'Settlement ID', 'Transactions', 'Total Amount', 'Razorpay Fee', 'Net Credited', 'Bank', 'Credit Date', 'Status'],
      ]
      settlements.forEach(s => {
        sRows.push([
          fmt(s.settlement_date),
          s.razorpay_settlement_id || '—',
          s.total_transactions,
          Number(s.total_amount),
          Number(s.razorpay_fee || 0),
          Number(s.credit_amount || s.total_amount),
          s.bank_accounts?.account_name || '—',
          fmt(s.credit_date),
          s.credited_to_bank ? 'Credited' : 'Pending',
        ])
      })
      const ws2 = XLSX.utils.aoa_to_sheet(sRows)
      XLSX.utils.book_append_sheet(wb, ws2, 'Settlements')
    }

    XLSX.writeFile(wb, `DCBA_Razorpay_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-purple-700" /> Razorpay Settlements
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={handleExcel} disabled={payments.length === 0} className="btn-primary flex items-center gap-2">
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Transactions', value: stats.total, sub: `${fmt(fromDate)} to ${fmt(toDate)}`, color: 'blue' },
          { label: 'Pending Settlement', value: stats.pending, sub: fmtAmt(stats.pendingAmt), color: 'yellow' },
          { label: 'Settled', value: stats.settled, sub: fmtAmt(stats.settledAmt), color: 'green' },
          { label: 'Razorpay Fee (est.)', value: fmtAmt(payments.reduce((s, p) => s + Number(p.fee_amount || 0), 0)), sub: '~2% per transaction', color: 'red', isAmt: true },
        ].map(s => {
          const colors = {
            blue: 'bg-blue-50 border-blue-200 text-blue-700',
            yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
            green: 'bg-green-50 border-green-200 text-green-700',
            red: 'bg-red-50 border-red-200 text-red-700',
          }
          return (
            <div key={s.label} className={`rounded-xl border p-4 ${colors[s.color]}`}>
              <p className={`font-bold ${s.isAmt ? 'text-xl' : 'text-3xl'}`}>{s.value}</p>
              <p className="text-xs font-semibold opacity-80 mt-1">{s.label}</p>
              <p className="text-xs opacity-60 mt-0.5">{s.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Filters */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'pending', label: `Pending (${stats.pending})` },
          { id: 'settled', label: `Settled (${stats.settled})` },
          { id: 'all', label: 'All' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.id ? 'bg-white shadow text-purple-700' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Daily Groups */}
      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading...</div>
      ) : Object.keys(groupedByDate).length === 0 ? (
        <div className="card p-8 text-center text-gray-400">
          <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No {tab === 'pending' ? 'pending' : tab === 'settled' ? 'settled' : ''} Razorpay payments found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByDate)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dayPayments]) => {
              const dayTotal = dayPayments.reduce((s, p) => s + Number(p.amount), 0)
              const dayFee = dayPayments.reduce((s, p) => s + Number(p.fee_amount || 0), 0)
              const dayNet = dayTotal - dayFee
              const settlement = settlements.find(s => s.settlement_date === date)
              const allSettled = dayPayments.every(p => p.settled)

              return (
                <div key={date} className="card p-0 overflow-hidden">
                  {/* Day header */}
                  <div className={`flex items-center justify-between px-4 py-3 ${allSettled ? 'bg-green-50 border-b border-green-100' : 'bg-yellow-50 border-b border-yellow-100'}`}>
                    <div className="flex items-center gap-3">
                      {allSettled
                        ? <CheckCircle className="w-5 h-5 text-green-600" />
                        : <Clock className="w-5 h-5 text-yellow-600" />
                      }
                      <div>
                        <p className="font-bold text-gray-800">{fmt(date)}</p>
                        <p className="text-xs text-gray-500">
                          {dayPayments.length} transaction{dayPayments.length > 1 ? 's' : ''} · 
                          Total: {fmtAmt(dayTotal)} · Fee: {fmtAmt(dayFee)} · Net: {fmtAmt(dayNet)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {settlement?.credited_to_bank && (
                        <div className="text-right">
                          <p className="text-xs text-green-700 font-semibold">✅ Credited to Bank</p>
                          <p className="text-xs text-green-600">{fmt(settlement.credit_date)} · {fmtAmt(settlement.credit_amount)}</p>
                          {settlement.razorpay_settlement_id && (
                            <p className="text-xs font-mono text-gray-400">{settlement.razorpay_settlement_id}</p>
                          )}
                        </div>
                      )}
                      {isAdmin && !allSettled && (
                        <button
                          onClick={() => setShowSettleModal({ date, payments: dayPayments, total: dayTotal, fee: dayFee, net: dayNet })}
                          className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg font-semibold flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" /> Mark Settled
                        </button>
                      )}
                      {isAdmin && allSettled && !settlement?.credited_to_bank && (
                        <button
                          onClick={() => setShowSettleModal({ date, payments: dayPayments, total: dayTotal, fee: dayFee, net: dayNet, settlement })}
                          className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Confirm Bank Credit
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Transactions table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Payment ID</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Member</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500">Purpose</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500">Amount</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500">Fee (2%)</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-500">Net</th>
                          <th className="px-3 py-2 text-center font-semibold text-gray-500">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dayPayments.map((p, i) => (
                          <tr key={p.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <td className="px-3 py-2 font-mono text-gray-500">{p.razorpay_payment_id}</td>
                            <td className="px-3 py-2">
                              <p className="font-medium text-gray-800">{p.member_name || p.dcba_members?.member_name || '—'}</p>
                              <p className="text-gray-400">{p.member_no || p.dcba_members?.member_no || '—'}</p>
                            </td>
                            <td className="px-3 py-2 capitalize text-gray-600">{p.payment_for === 'annual' ? 'Annual Subscription' : p.payment_for || '—'}</td>
                            <td className="px-3 py-2 text-right font-semibold text-purple-700">{fmtAmt(p.amount)}</td>
                            <td className="px-3 py-2 text-right text-red-500">{fmtAmt(p.fee_amount || 0)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-green-700">{fmtAmt(p.net_amount || p.amount)}</td>
                            <td className="px-3 py-2 text-center">
                              {p.settled
                                ? <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold">Settled</span>
                                : <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full font-semibold">Pending</span>
                              }
                            </td>
                          </tr>
                        ))}
                        {/* Day total row */}
                        <tr className="bg-purple-50 font-semibold border-t border-purple-100">
                          <td colSpan={3} className="px-3 py-2 text-purple-800 text-xs">Day Total</td>
                          <td className="px-3 py-2 text-right text-purple-700">{fmtAmt(dayTotal)}</td>
                          <td className="px-3 py-2 text-right text-red-500">{fmtAmt(dayFee)}</td>
                          <td className="px-3 py-2 text-right text-green-700">{fmtAmt(dayNet)}</td>
                          <td></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Settlement Modal */}
      {showSettleModal && (
        <SettleModal
          data={showSettleModal}
          org={currentOrg}
          bankAccounts={bankAccounts}
          onClose={() => setShowSettleModal(null)}
          onSuccess={() => { setShowSettleModal(null); fetchData() }}
        />
      )}
    </div>
  )
}

// ---- SETTLE MODAL ----
function SettleModal({ data, org, bankAccounts, onClose, onSuccess }) {
  const { date, payments, total, fee, net, settlement } = data
  const isConfirmCredit = !!settlement // second step — confirm bank credit

  const [form, setForm] = useState({
    razorpay_settlement_id: settlement?.razorpay_settlement_id || '',
    bank_account_id: bankAccounts[0]?.id || '',
    credit_date: new Date().toISOString().split('T')[0],
    credit_amount: String(net.toFixed(2)),
    razorpay_fee: String(fee.toFixed(2)),
    notes: '',
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      if (isConfirmCredit) {
        // Update existing settlement — mark credited to bank
        const { error } = await supabase.from('dcba_razorpay_settlements').update({
          credited_to_bank: true,
          bank_account_id: form.bank_account_id,
          credit_date: form.credit_date,
          credit_amount: Number(form.credit_amount),
          razorpay_fee: Number(form.razorpay_fee),
          razorpay_settlement_id: form.razorpay_settlement_id || null,
          notes: form.notes || null,
          updated_at: new Date().toISOString(),
        }).eq('id', settlement.id)
        if (error) throw error
      } else {
        // Create settlement record
        const { data: newSettlement, error: sErr } = await supabase
          .from('dcba_razorpay_settlements').insert({
            org_id: org.id,
            settlement_date: date,
            total_amount: total,
            total_transactions: payments.length,
            razorpay_settlement_id: form.razorpay_settlement_id || null,
            credited_to_bank: false,
            notes: form.notes || null,
          }).select().single()
        if (sErr) throw sErr

        // Mark all payments as settled
        const paymentIds = payments.map(p => p.id)
        const { error: pErr } = await supabase.from('dcba_razorpay_payments')
          .update({ settled: true, settlement_id: newSettlement.id })
          .in('id', paymentIds)
        if (pErr) throw pErr
      }

      toast.success(isConfirmCredit ? 'Bank credit confirmed!' : `${payments.length} payments marked as settled!`)
      onSuccess()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className={`flex items-center justify-between px-6 py-4 border-b ${isConfirmCredit ? 'bg-green-50' : 'bg-purple-50'}`}>
          <h3 className="text-lg font-semibold">
            {isConfirmCredit ? '✅ Confirm Bank Credit' : '🏦 Mark Settled'} — {fmt(date)}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-3 grid grid-cols-3 gap-3 text-center text-sm">
            <div>
              <p className="text-xs text-gray-400">Transactions</p>
              <p className="font-bold text-gray-800">{payments.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Total Amount</p>
              <p className="font-bold text-purple-700">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Net (after fee)</p>
              <p className="font-bold text-green-700">₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div>
            <label className="label">Razorpay Settlement ID <span className="text-gray-400 font-normal">(from Razorpay dashboard)</span></label>
            <input className="input font-mono" value={form.razorpay_settlement_id}
              onChange={e => setForm({ ...form, razorpay_settlement_id: e.target.value })}
              placeholder="setl_XXXXXXXXXX (optional)" />
          </div>

          {isConfirmCredit && (
            <>
              <div>
                <label className="label">Bank Account</label>
                <select className="input" value={form.bank_account_id}
                  onChange={e => setForm({ ...form, bank_account_id: e.target.value })}>
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>{b.account_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Credit Date</label>
                  <input type="date" className="input" value={form.credit_date}
                    onChange={e => setForm({ ...form, credit_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Amount Credited (₹)</label>
                  <input type="number" className="input" value={form.credit_amount}
                    onChange={e => setForm({ ...form, credit_amount: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Razorpay Fee Deducted (₹)</label>
                <input type="number" className="input" value={form.razorpay_fee}
                  onChange={e => setForm({ ...form, razorpay_fee: e.target.value })} />
                <p className="text-xs text-gray-400 mt-1">Verify from Razorpay settlement report</p>
              </div>
            </>
          )}

          <div>
            <label className="label">Notes</label>
            <input className="input" value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional remarks" />
          </div>

          {!isConfirmCredit && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
              ⚠️ Razorpay typically settles within 2 working days. After marking settled, use "Confirm Bank Credit" once amount appears in bank statement.
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className={`btn-primary ${isConfirmCredit ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}>
            {saving ? 'Saving...' : isConfirmCredit ? '✅ Confirm Credit' : '🏦 Mark Settled'}
          </button>
        </div>
      </div>
    </div>
  )
}
