import { useState } from 'react'
import { supabase } from '../../supabaseClient'
import toast from 'react-hot-toast'
import { X, Calculator, UserCheck, IndianRupee, Plus, Trash2 } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getDaysInMonth(month, year) {
  return new Date(year, month, 0).getDate()
}

export default function ProcessSalaryModal({ staff, month, year, org, userRole, existingSalaries, onClose, onSuccess }) {
  const totalDays = getDaysInMonth(month, year)

  // Initialize attendance for each staff
  const [attendance, setAttendance] = useState(
    staff.map(s => ({
      staff_id: s.id,
      name: s.name,
      designation: s.designation,
      gross: Number(s.gross_salary || 0),
      esi_emp: Number(s.esi_employee || 0),
      pf_emp: Number(s.pf_employee || 0),
      bank_account_no: s.bank_account_no || '',
      days_present: totalDays,
      days_absent: 0,
      late_deduction: 0,
      allowances: [], // one-time allowances [{label, amount}]
      already_processed: !!existingSalaries[s.id],
    }))
  )

  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1) // 1=attendance, 2=review

  function updateAttendance(idx, field, value) {
    setAttendance(prev => {
      const updated = [...prev]
      updated[idx] = { ...updated[idx], [field]: Number(value) || 0 }
      // Auto-calculate days absent
      if (field === 'days_present') {
        updated[idx].days_absent = Math.max(0, totalDays - (Number(value) || 0))
      }
      if (field === 'days_absent') {
        updated[idx].days_present = Math.max(0, totalDays - (Number(value) || 0))
      }
      return updated
    })
  }

  function addAllowance(idx) {
    setAttendance(prev => {
      const updated = [...prev]
      updated[idx] = {
        ...updated[idx],
        allowances: [...updated[idx].allowances, { label: '', amount: 0 }]
      }
      return updated
    })
  }

  function updateAllowance(staffIdx, allowIdx, field, value) {
    setAttendance(prev => {
      const updated = [...prev]
      const allowances = [...updated[staffIdx].allowances]
      allowances[allowIdx] = { ...allowances[allowIdx], [field]: field === 'amount' ? Number(value) || 0 : value }
      updated[staffIdx] = { ...updated[staffIdx], allowances }
      return updated
    })
  }

  function removeAllowance(staffIdx, allowIdx) {
    setAttendance(prev => {
      const updated = [...prev]
      updated[staffIdx].allowances = updated[staffIdx].allowances.filter((_, i) => i !== allowIdx)
      return updated
    })
  }

  // Calculate due salary based on attendance
  function calculateDueSalary(att) {
    if (att.days_present >= totalDays) return att.gross
    return Math.round((att.gross / totalDays) * att.days_present * 100) / 100
  }

  function calculateAllowanceTotal(att) {
    return att.allowances.reduce((s, a) => s + Number(a.amount || 0), 0)
  }

  function calculateNet(att) {
    const due = calculateDueSalary(att)
    const allowTotal = calculateAllowanceTotal(att)
    return Math.max(0, due - att.esi_emp - att.pf_emp - att.late_deduction + allowTotal)
  }

  async function handleProcess() {
    const toProcess = attendance.filter(a => !a.already_processed)
    if (toProcess.length === 0) {
      toast.error('All salaries already processed!')
      return
    }

    setSaving(true)
    try {
      const records = toProcess.map(att => {
        const dueSalary = calculateDueSalary(att)
        const allowTotal = calculateAllowanceTotal(att)
        const netPayable = Math.max(0, dueSalary - att.esi_emp - att.pf_emp - att.late_deduction + allowTotal)

        return {
          org_id: org.id,
          staff_id: att.staff_id,
          pay_month: month,
          pay_year: year,
          gross_salary: att.gross,
          days_present: att.days_present,
          days_absent: att.days_absent,
          due_salary: dueSalary,
          esi_employee: att.esi_emp,
          pf_employee: att.pf_emp,
          advance_deduction: 0,
          loan_deduction: 0,
          other_deduction: att.late_deduction,
          net_payable: netPayable,
          payment_date: new Date().toISOString().split('T')[0],
          // Store allowances in remarks
          remarks: att.allowances.length > 0
            ? att.allowances.map(a => `${a.label}: ₹${a.amount}`).join(', ')
            : null,
        }
      })

      const { error } = await supabase.from('salary_payments').insert(records)
      if (error) throw error

      toast.success(`${records.length} salaries processed successfully!`)
      onSuccess()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  const desigColor = {
    'Cashier': 'bg-green-100 text-green-700',
    'Library Staff': 'bg-yellow-100 text-yellow-700',
    'Homeopathic Doctor': 'bg-orange-100 text-orange-700',
    'Sub Staff': 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-700" />
              Process Salaries — {MONTHS[month - 1]} {year}
            </h3>
            <p className="text-sm text-gray-500">Total days in month: {totalDays} | Enter attendance & allowances</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* Step tabs */}
        <div className="flex border-b px-6">
          {['Attendance & Allowances', 'Review & Process'].map((s, i) => (
            <button key={s} onClick={() => setStep(i + 1)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${step === i + 1 ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {i + 1}. {s}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* STEP 1 — Attendance */}
          {step === 1 && (
            <div className="space-y-4">
              {attendance.map((att, idx) => (
                <div key={att.staff_id}
                  className={`border rounded-xl p-4 ${att.already_processed ? 'bg-gray-50 opacity-60' : 'bg-white'}`}>

                  {/* Staff header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${desigColor[att.designation] || 'bg-gray-100 text-gray-600'}`}>
                        {att.designation}
                      </span>
                      <span className="font-semibold text-gray-800">{att.name}</span>
                      <span className="text-sm text-gray-500">Gross: {fmt(att.gross)}</span>
                    </div>
                    {att.already_processed && (
                      <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-full">✅ Already Processed</span>
                    )}
                  </div>

                  {!att.already_processed && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Attendance */}
                      <div>
                        <label className="label text-xs">Days Present *</label>
                        <input type="number" className="input text-center font-bold text-lg"
                          value={att.days_present} min={0} max={totalDays}
                          onChange={e => updateAttendance(idx, 'days_present', e.target.value)} />
                        <p className="text-xs text-gray-400 text-center mt-0.5">out of {totalDays}</p>
                      </div>
                      <div>
                        <label className="label text-xs">Days Absent</label>
                        <input type="number" className="input text-center"
                          value={att.days_absent} min={0} max={totalDays}
                          onChange={e => updateAttendance(idx, 'days_absent', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">Late Deduction (₹)</label>
                        <input type="number" className="input"
                          value={att.late_deduction}
                          onChange={e => updateAttendance(idx, 'late_deduction', e.target.value)}
                          placeholder="0" />
                      </div>
                      <div>
                        <label className="label text-xs">Due Salary</label>
                        <div className="input bg-blue-50 text-blue-800 font-bold text-center">
                          {fmt(calculateDueSalary(att))}
                        </div>
                      </div>

                      {/* One-time Allowances */}
                      <div className="col-span-2 lg:col-span-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-medium text-gray-600">One-time Allowances (Bonus, Ex-gratia, Festival etc.)</label>
                          <button onClick={() => addAllowance(idx)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                            <Plus className="w-3 h-3" /> Add Allowance
                          </button>
                        </div>
                        {att.allowances.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No allowances — click "Add Allowance" to add</p>
                        ) : (
                          <div className="space-y-2">
                            {att.allowances.map((allow, aIdx) => (
                              <div key={aIdx} className="flex gap-2 items-center">
                                <input className="input flex-1" placeholder="Allowance description (e.g. Holi Bonus)"
                                  value={allow.label}
                                  onChange={e => updateAllowance(idx, aIdx, 'label', e.target.value)} />
                                <div className="relative w-36">
                                  <IndianRupee className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                                  <input type="number" className="input pl-7" placeholder="Amount"
                                    value={allow.amount || ''}
                                    onChange={e => updateAllowance(idx, aIdx, 'amount', e.target.value)} />
                                </div>
                                <button onClick={() => removeAllowance(idx, aIdx)}
                                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            {calculateAllowanceTotal(att) > 0 && (
                              <p className="text-xs text-green-600 font-medium">
                                Total Allowances: {fmt(calculateAllowanceTotal(att))}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Net summary */}
                      <div className="col-span-2 lg:col-span-4 bg-green-50 rounded-lg px-4 py-2 flex items-center justify-between">
                        <div className="flex gap-6 text-xs text-gray-600">
                          <span>Due: <strong>{fmt(calculateDueSalary(att))}</strong></span>
                          {att.esi_emp > 0 && <span>ESI: <strong className="text-purple-600">-{fmt(att.esi_emp)}</strong></span>}
                          {att.pf_emp > 0 && <span>PF: <strong className="text-blue-600">-{fmt(att.pf_emp)}</strong></span>}
                          {att.late_deduction > 0 && <span>Late: <strong className="text-red-500">-{fmt(att.late_deduction)}</strong></span>}
                          {calculateAllowanceTotal(att) > 0 && <span>Allowance: <strong className="text-green-600">+{fmt(calculateAllowanceTotal(att))}</strong></span>}
                        </div>
                        <div className="text-base font-bold text-green-800">
                          NET: {fmt(calculateNet(att))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* STEP 2 — Review */}
          {step === 2 && (
            <div>
              <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">📋 Review before processing:</p>
                <p className="text-xs text-blue-600">Please verify all figures before clicking "Process Salaries"</p>
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    {['Staff', 'Gross', 'Present', 'Due Salary', 'ESI', 'PF', 'Allowances', 'Net Payable', 'Status'].map(h => (
                      <th key={h} className="table-header text-left text-xs whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((att, i) => (
                    <tr key={att.staff_id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${att.already_processed ? 'opacity-50' : ''}`}>
                      <td className="table-cell">
                        <div className="font-medium text-sm">{att.name}</div>
                        <div className="text-xs text-gray-400">{att.designation}</div>
                      </td>
                      <td className="table-cell text-right text-xs">{fmt(att.gross)}</td>
                      <td className="table-cell text-center text-sm font-medium">{att.days_present}/{totalDays}</td>
                      <td className="table-cell text-right text-sm">{fmt(calculateDueSalary(att))}</td>
                      <td className="table-cell text-right text-xs text-purple-600">{att.esi_emp > 0 ? fmt(att.esi_emp) : '—'}</td>
                      <td className="table-cell text-right text-xs text-blue-600">{att.pf_emp > 0 ? fmt(att.pf_emp) : '—'}</td>
                      <td className="table-cell text-right text-xs text-green-600">
                        {calculateAllowanceTotal(att) > 0 ? `+${fmt(calculateAllowanceTotal(att))}` : '—'}
                        {att.allowances.length > 0 && (
                          <div className="text-xs text-gray-400">{att.allowances.map(a => a.label).join(', ')}</div>
                        )}
                      </td>
                      <td className="table-cell text-right font-bold text-green-800">{fmt(calculateNet(att))}</td>
                      <td className="table-cell">
                        {att.already_processed
                          ? <span className="badge-active text-xs">Done</span>
                          : <span className="badge-inactive text-xs">Pending</span>}
                      </td>
                    </tr>
                  ))}
                  {/* Total row */}
                  <tr className="bg-blue-900 text-white font-bold">
                    <td className="px-4 py-2 text-sm" colSpan={3}>TOTAL — {MONTHS[month-1]} {year}</td>
                    <td className="px-4 py-2 text-right text-sm">{fmt(attendance.filter(a=>!a.already_processed).reduce((s,a)=>s+calculateDueSalary(a),0))}</td>
                    <td className="px-4 py-2 text-right text-sm">{fmt(attendance.reduce((s,a)=>s+a.esi_emp,0))}</td>
                    <td className="px-4 py-2 text-right text-sm">{fmt(attendance.reduce((s,a)=>s+a.pf_emp,0))}</td>
                    <td className="px-4 py-2 text-right text-sm">{fmt(attendance.reduce((s,a)=>s+calculateAllowanceTotal(a),0))}</td>
                    <td className="px-4 py-2 text-right text-sm">{fmt(attendance.filter(a=>!a.already_processed).reduce((s,a)=>s+calculateNet(a),0))}</td>
                    <td className="px-4 py-2"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <div className="flex gap-3">
            {step === 1 && (
              <button onClick={() => setStep(2)} className="btn-primary flex items-center gap-2">
                Review Salaries →
              </button>
            )}
            {step === 2 && (
              <>
                <button onClick={() => setStep(1)} className="btn-secondary">← Edit Attendance</button>
                <button onClick={handleProcess} disabled={saving}
                  className="btn-success flex items-center gap-2">
                  <UserCheck className="w-4 h-4" />
                  {saving ? 'Processing...' : `Process ${attendance.filter(a => !a.already_processed).length} Salaries`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
