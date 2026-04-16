import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { UserCheck, Plus, Search, Printer, IndianRupee,
  ChevronDown, Calculator, FileText, AlertCircle
} from 'lucide-react'
import SalarySlipModal from './payroll/SalarySlipModal'
import AdvanceModal from './payroll/AdvanceModal'
import ProcessSalaryModal from './payroll/ProcessSalaryModal'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CURRENT_YEAR = new Date().getFullYear()

export default function Payroll() {
  const { currentOrg, userRole } = useAuth()
  const [staff, setStaff] = useState([])
  const [salaryData, setSalaryData] = useState({})
  const [advances, setAdvances] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR)
  const [activeTab, setActiveTab] = useState('salary')
  const [showSlip, setShowSlip] = useState(null)
  const [showAdvance, setShowAdvance] = useState(null)
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [search, setSearch] = useState('')

  const isCashier = ['admin', 'cashier'].includes(userRole?.role)

  useEffect(() => { if (currentOrg) fetchData() }, [currentOrg, filterMonth, filterYear])

  async function fetchData() {
    setLoading(true)
    const [{ data: staffData }, { data: salaries }, { data: advData }] = await Promise.all([
      supabase.from('staff').select('*').eq('org_id', currentOrg.id).eq('is_active', true).order('designation').order('name'),
      supabase.from('salary_payments')
        .select('*')
        .eq('org_id', currentOrg.id)
        .eq('pay_month', filterMonth)
        .eq('pay_year', filterYear),
      supabase.from('salary_advances')
        .select('*, staff(name, designation)')
        .eq('org_id', currentOrg.id)
        .order('advance_date', { ascending: false }),
    ])

    setStaff(staffData || [])
    setAdvances(advData || [])

    // Map salary payments by staff_id
    const salMap = {}
    ;(salaries || []).forEach(s => { salMap[s.staff_id] = s })
    setSalaryData(salMap)
    setLoading(false)
  }

  // Process salary for all staff at once
  async function processAllSalaries() {
    const unprocessed = staff.filter(s => !salaryData[s.id])
    if (unprocessed.length === 0) {
      toast.error('All salaries already processed for this month!')
      return
    }

    setProcessing(true)
    try {
      const records = unprocessed.map(s => {
        // Get outstanding advance for this staff
        const staffAdvances = advances.filter(a => a.staff_id === s.id)
        const outstandingAdv = staffAdvances.reduce((sum, a) => sum + Number(a.balance_outstanding || 0), 0)
        const loanDeduct = outstandingAdv > 0 ? Math.min(outstandingAdv, 2000) : 0 // default 2000/month

        const netPayable = s.gross_salary - (s.esi_employee || 0) - (s.pf_employee || 0) - loanDeduct

        return {
          org_id: currentOrg.id,
          staff_id: s.id,
          pay_month: filterMonth,
          pay_year: filterYear,
          gross_salary: s.gross_salary,
          days_present: getDaysInMonth(filterMonth, filterYear),
          days_absent: 0,
          due_salary: s.gross_salary,
          esi_employee: s.esi_employee || 0,
          pf_employee: s.pf_employee || 0,
          loan_deduction: loanDeduct,
          advance_deduction: 0,
          other_deduction: 0,
          net_payable: Math.max(0, netPayable),
          payment_date: new Date().toISOString().split('T')[0],
        }
      })

      const { error } = await supabase.from('salary_payments').insert(records)
      if (error) throw error
      toast.success(`${records.length} salaries processed!`)
      fetchData()
    } catch (err) {
      toast.error(err.message)
    }
    setProcessing(false)
  }

  function getDaysInMonth(month, year) {
    return new Date(year, month, 0).getDate()
  }

  async function undoSalaries() {
    const confirm = window.confirm(
      `Are you sure you want to DELETE all salary records for ${MONTHS[filterMonth - 1]} ${filterYear}?\n\nThis cannot be undone and you will need to re-process salaries.`
    )
    if (!confirm) return

    try {
      const { error } = await supabase
        .from('salary_payments')
        .delete()
        .eq('org_id', currentOrg.id)
        .eq('pay_month', filterMonth)
        .eq('pay_year', filterYear)

      if (error) throw error
      setSalaryData({}) // Clear state immediately
      toast.success(`Salaries for ${MONTHS[filterMonth - 1]} ${filterYear} deleted! You can now re-process.`)
      fetchData()
    } catch (err) {
      toast.error(err.message)
    }
  }
  const totalGross = staff.reduce((s, e) => s + Number(e.gross_salary || 0), 0)
  const totalNet = Object.values(salaryData).reduce((s, e) => s + Number(e.net_payable || 0), 0)
  const totalPF = Object.values(salaryData).reduce((s, e) => s + Number(e.pf_employee || 0) + Number(e.pf_employer || 0), 0)
  const totalESI = Object.values(salaryData).reduce((s, e) => s + Number(e.esi_employee || 0) + Number(e.esi_employer || 0), 0)
  const processedCount = Object.keys(salaryData).length

  const filteredStaff = staff.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.designation?.toLowerCase().includes(search.toLowerCase())
  )

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-blue-700" /> Payroll
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name} — {MONTHS[filterMonth - 1]} {filterYear}</p>
        </div>
        {isCashier && (
          <div className="flex gap-2">
            <button onClick={() => setShowAdvance(true)} className="btn-secondary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Salary Advance
            </button>
            {activeTab === 'salary' && (
              <button onClick={() => setShowProcessModal(true)}
                className="btn-primary flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Process Salaries
              </button>
            )}
            {activeTab === 'salary' && processedCount > 0 && userRole?.role === 'admin' && (
              <button onClick={undoSalaries}
                className="btn-danger flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Undo Month
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { id: 'salary', label: 'Monthly Salary' },
          { id: 'advances', label: 'Salary Advances' },
          { id: 'summary', label: 'PF/ESI Summary' },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t.id ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Month/Year Filter */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <select className="input w-auto" value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select className="input w-auto" value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}>
            {[CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1].map(y => <option key={y}>{y}</option>)}
          </select>
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {processedCount > 0 && (
            <span className="text-sm text-green-600 font-medium">
              ✅ {processedCount}/{staff.length} processed
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {activeTab === 'salary' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Gross', value: fmt(totalGross), color: 'blue' },
            { label: 'Total Net Payable', value: fmt(totalNet || totalGross), color: 'green' },
            { label: 'Total PF (Both)', value: fmt(totalPF), color: 'purple' },
            { label: 'Total ESI (Both)', value: fmt(totalESI), color: 'orange' },
          ].map(s => {
            const colors = { blue: 'bg-blue-50 border-blue-200 text-blue-700', green: 'bg-green-50 border-green-200 text-green-700', purple: 'bg-purple-50 border-purple-200 text-purple-700', orange: 'bg-orange-50 border-orange-200 text-orange-700' }
            return (
              <div key={s.label} className={`rounded-xl border p-4 ${colors[s.color]}`}>
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-xs font-medium opacity-80 mt-1">{s.label}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ---- SALARY TAB ---- */}
      {activeTab === 'salary' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['#', 'Name', 'Designation', 'Gross (₹)', 'Days', 'Due Salary (₹)', 'ESI Emp (₹)', 'PF Emp (₹)', 'Loan Deduct (₹)', 'Net Payable (₹)', 'Status', 'Slip'].map(h => (
                    <th key={h} className="table-header text-left whitespace-nowrap text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={12} className="table-cell text-center py-8 text-gray-400">Loading...</td></tr>
                ) : filteredStaff.map((s, i) => {
                  const sal = salaryData[s.id]
                  const isProcessed = !!sal
                  return (
                    <tr key={s.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${!isProcessed ? 'opacity-70' : ''}`}>
                      <td className="table-cell text-xs text-center">{i + 1}</td>
                      <td className="table-cell font-medium text-sm">{s.name}</td>
                      <td className="table-cell text-xs">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.designation === 'Cashier' ? 'bg-green-100 text-green-700' :
                          s.designation === 'Library Staff' ? 'bg-yellow-100 text-yellow-700' :
                          s.designation === 'Homeopathic Doctor' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{s.designation}</span>
                      </td>
                      <td className="table-cell text-right text-sm font-medium">{fmt(s.gross_salary)}</td>
                      <td className="table-cell text-center text-sm">{sal?.days_present || getDaysInMonth(filterMonth, filterYear)}</td>
                      <td className="table-cell text-right text-sm">{fmt(sal?.due_salary || s.gross_salary)}</td>
                      <td className="table-cell text-right text-xs text-purple-600">{fmt(sal?.esi_employee || s.esi_employee)}</td>
                      <td className="table-cell text-right text-xs text-blue-600">{fmt(sal?.pf_employee || s.pf_employee)}</td>
                      <td className="table-cell text-right text-xs text-red-500">{fmt(sal?.loan_deduction || 0)}</td>
                      <td className="table-cell text-right font-bold text-green-700">{fmt(sal?.net_payable || (s.gross_salary - (s.esi_employee || 0) - (s.pf_employee || 0)))}</td>
                      <td className="table-cell">
                        {isProcessed ? (
                          <span className="badge-active">Processed</span>
                        ) : (
                          <span className="badge-inactive">Pending</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <button onClick={() => setShowSlip({ staff: s, salary: sal, month: filterMonth, year: filterYear })}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg" title="Print Salary Slip">
                          <Printer className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {/* Total Row */}
                {!loading && (
                  <tr className="bg-blue-900 text-white font-bold">
                    <td className="px-4 py-2 text-sm" colSpan={3}>TOTAL — {MONTHS[filterMonth - 1]} {filterYear}</td>
                    <td className="px-4 py-2 text-right text-sm">{fmt(totalGross)}</td>
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 text-right text-sm">{fmt(totalGross)}</td>
                    <td className="px-4 py-2 text-right text-sm">{fmt(staff.reduce((s,e)=>s+Number(e.esi_employee||0),0))}</td>
                    <td className="px-4 py-2 text-right text-sm">{fmt(staff.reduce((s,e)=>s+Number(e.pf_employee||0),0))}</td>
                    <td className="px-4 py-2 text-right text-sm">{fmt(Object.values(salaryData).reduce((s,e)=>s+Number(e.loan_deduction||0),0))}</td>
                    <td className="px-4 py-2 text-right text-sm">{fmt(totalNet || staff.reduce((s,e)=>s+(e.gross_salary-(e.esi_employee||0)-(e.pf_employee||0)),0))}</td>
                    <td className="px-4 py-2" colSpan={2}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- ADVANCES TAB ---- */}
      {activeTab === 'advances' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {['Date', 'Staff Name', 'Designation', 'Advance Amount', 'Monthly Recovery', 'Balance Outstanding', 'Purpose'].map(h => (
                    <th key={h} className="table-header text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="table-cell text-center py-8 text-gray-400">Loading...</td></tr>
                ) : advances.length === 0 ? (
                  <tr><td colSpan={7} className="table-cell text-center py-8 text-gray-400">No advances recorded</td></tr>
                ) : advances.map((a, i) => (
                  <tr key={a.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="table-cell text-xs">{new Date(a.advance_date).toLocaleDateString('en-IN')}</td>
                    <td className="table-cell font-medium">{a.staff?.name}</td>
                    <td className="table-cell text-xs text-gray-500">{a.staff?.designation}</td>
                    <td className="table-cell text-right font-semibold">{fmt(a.amount)}</td>
                    <td className="table-cell text-right text-blue-600">{fmt(a.recovery_per_month)}</td>
                    <td className={`table-cell text-right font-bold ${Number(a.balance_outstanding) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {fmt(a.balance_outstanding)}
                    </td>
                    <td className="table-cell text-sm text-gray-500">{a.purpose || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---- PF/ESI TAB ---- */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-bold text-gray-700 mb-4">PF & ESI Summary — {MONTHS[filterMonth - 1]} {filterYear}</h3>
            <table className="w-full">
              <thead>
                <tr>
                  {['Staff Name', 'Designation', 'Gross', 'ESI Employee', 'ESI Employer', 'Total ESI', 'PF Employee', 'PF Employer', 'Total PF'].map(h => (
                    <th key={h} className="table-header text-right first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.filter(s => s.esi_employee > 0 || s.pf_employee > 0).map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="table-cell font-medium">{s.name}</td>
                    <td className="table-cell text-xs text-gray-500">{s.designation}</td>
                    <td className="table-cell text-right">{fmt(s.gross_salary)}</td>
                    <td className="table-cell text-right text-purple-600">{fmt(s.esi_employee)}</td>
                    <td className="table-cell text-right text-purple-400">{fmt(s.esi_employer)}</td>
                    <td className="table-cell text-right font-semibold text-purple-700">{fmt((s.esi_employee||0)+(s.esi_employer||0))}</td>
                    <td className="table-cell text-right text-blue-600">{fmt(s.pf_employee)}</td>
                    <td className="table-cell text-right text-blue-400">{fmt(s.pf_employer)}</td>
                    <td className="table-cell text-right font-semibold text-blue-700">{fmt((s.pf_employee||0)+(s.pf_employer||0))}</td>
                  </tr>
                ))}
                <tr className="bg-blue-900 text-white font-bold">
                  <td className="px-4 py-2 text-sm" colSpan={2}>TOTAL</td>
                  <td className="px-4 py-2 text-right text-sm">{fmt(staff.filter(s=>s.esi_employee>0||s.pf_employee>0).reduce((s,e)=>s+Number(e.gross_salary),0))}</td>
                  <td className="px-4 py-2 text-right text-sm">{fmt(staff.reduce((s,e)=>s+Number(e.esi_employee||0),0))}</td>
                  <td className="px-4 py-2 text-right text-sm">{fmt(staff.reduce((s,e)=>s+Number(e.esi_employer||0),0))}</td>
                  <td className="px-4 py-2 text-right text-sm">{fmt(staff.reduce((s,e)=>s+Number(e.esi_employee||0)+Number(e.esi_employer||0),0))}</td>
                  <td className="px-4 py-2 text-right text-sm">{fmt(staff.reduce((s,e)=>s+Number(e.pf_employee||0),0))}</td>
                  <td className="px-4 py-2 text-right text-sm">{fmt(staff.reduce((s,e)=>s+Number(e.pf_employer||0),0))}</td>
                  <td className="px-4 py-2 text-right text-sm">{fmt(staff.reduce((s,e)=>s+Number(e.pf_employee||0)+Number(e.pf_employer||0),0))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* PF Payable box */}
          <div className="grid grid-cols-2 gap-4">
            <div className="card bg-blue-50 border-blue-200">
              <h4 className="font-bold text-blue-800 mb-2">🏦 PF Payable to EPFO</h4>
              <p className="text-2xl font-bold text-blue-700">{fmt(staff.reduce((s,e)=>s+Number(e.pf_employee||0)+Number(e.pf_employer||0),0))}</p>
              <p className="text-xs text-blue-500 mt-1">Employee + Employer contribution — {MONTHS[filterMonth-1]} {filterYear}</p>
              <p className="text-xs text-blue-400 mt-2">Due by 15th of next month</p>
            </div>
            <div className="card bg-purple-50 border-purple-200">
              <h4 className="font-bold text-purple-800 mb-2">🏥 ESI Payable to ESIC</h4>
              <p className="text-2xl font-bold text-purple-700">{fmt(staff.reduce((s,e)=>s+Number(e.esi_employee||0)+Number(e.esi_employer||0),0))}</p>
              <p className="text-xs text-purple-500 mt-1">Employee + Employer contribution — {MONTHS[filterMonth-1]} {filterYear}</p>
              <p className="text-xs text-purple-400 mt-2">Due by 15th of next month</p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showProcessModal && (
        <ProcessSalaryModal
          staff={staff}
          month={filterMonth}
          year={filterYear}
          org={currentOrg}
          userRole={userRole}
          existingSalaries={salaryData}
          onClose={() => setShowProcessModal(false)}
          onSuccess={() => { setShowProcessModal(false); fetchData() }}
        />
      )}

      {showSlip && (
        <SalarySlipModal
          data={showSlip}
          org={currentOrg}
          onClose={() => setShowSlip(null)}
        />
      )}

      {showAdvance && (
        <AdvanceModal
          org={currentOrg}
          staff={staff}
          userRole={userRole}
          onClose={() => setShowAdvance(null)}
          onSuccess={() => { setShowAdvance(null); fetchData() }}
        />
      )}
    </div>
  )
}
