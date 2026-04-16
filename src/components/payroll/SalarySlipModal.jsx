import { useRef } from 'react'
import { X, Printer } from 'lucide-react'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function SalarySlipModal({ data, org, onClose }) {
  const { staff, salary, month, year } = data
  const printRef = useRef()

  const gross = Number(salary?.gross_salary || staff.gross_salary || 0)
  const esiEmp = Number(salary?.esi_employee || staff.esi_employee || 0)
  const pfEmp = Number(salary?.pf_employee || staff.pf_employee || 0)
  const loanDeduct = Number(salary?.loan_deduction || 0)
  const advDeduct = Number(salary?.advance_deduction || 0)
  const otherDeduct = Number(salary?.other_deduction || 0)
  const netPayable = Number(salary?.net_payable || (gross - esiEmp - pfEmp - loanDeduct))
  const daysPresent = salary?.days_present || new Date(year, month, 0).getDate()
  const daysAbsent = salary?.days_absent || 0

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

  function handlePrint() {
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Salary Slip - ${staff.name} - ${MONTHS[month-1]} ${year}</title>
      <style>
        @page { margin: 10mm; size: A4; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; }
        .slip { border: 2px solid #000; padding: 16px; }
        h1 { font-size: 16px; text-align: center; font-weight: bold; }
        h2 { font-size: 12px; text-align: center; color: #333; margin: 4px 0 12px; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 12px; }
        .info-row { display: flex; gap: 4px; font-size: 10px; }
        .info-label { font-weight: bold; min-width: 120px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { background: #1e3a8a; color: white; padding: 5px 8px; text-align: left; font-size: 10px; }
        td { padding: 4px 8px; border: 1px solid #ddd; font-size: 10px; }
        .total-row { font-weight: bold; background: #f3f4f6; }
        .net-row { font-weight: bold; background: #1e3a8a; color: white; font-size: 12px; }
        .sig-area { display: flex; justify-content: space-between; margin-top: 24px; }
        .sig-box { text-align: center; width: 120px; border-top: 1px solid #000; padding-top: 4px; font-size: 10px; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style>
    </head><body>
    <div class="slip">
      ${content}
    </div>
    <script>window.onload=function(){window.print();setTimeout(()=>window.close(),500)}<\/script>
    </body></html>`)
    win.document.close()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" /> Salary Slip
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* Preview */}
        <div className="p-4 bg-gray-100">
          <div ref={printRef} className="bg-white border-2 border-gray-300 p-6 rounded">
            {/* Header */}
            <div className="text-center border-b-2 border-gray-800 pb-3 mb-3">
              <h1 className="text-lg font-bold">{org?.name}</h1>
              <p className="text-xs text-gray-600">Saket Court Complex, New Delhi - 110017</p>
              <h2 className="text-base font-semibold mt-2 text-blue-800">SALARY SLIP — {MONTHS[month-1].toUpperCase()} {year}</h2>
            </div>

            {/* Staff Info */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 text-xs">
              {[
                ['Name', staff.name],
                ['Designation', staff.designation],
                ['Bank Account No.', staff.bank_account_no || '—'],
                ['Days in Month', new Date(year, month, 0).getDate()],
                ['Days Present', daysPresent],
                ['Days Absent', daysAbsent],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-2">
                  <span className="font-bold text-gray-600 w-32">{label}:</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>

            {/* Earnings & Deductions */}
            <div className="grid grid-cols-2 gap-4">
              {/* Earnings */}
              <table className="w-full">
                <thead>
                  <tr><th className="bg-green-800 text-white px-3 py-2 text-left text-xs" colSpan={2}>EARNINGS</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-1.5 text-xs border border-gray-200">Basic / Gross Salary</td>
                    <td className="px-3 py-1.5 text-xs border border-gray-200 text-right font-medium">{fmt(gross)}</td>
                  </tr>
                  <tr className="bg-green-50 font-bold">
                    <td className="px-3 py-1.5 text-xs border border-gray-200">TOTAL EARNINGS</td>
                    <td className="px-3 py-1.5 text-xs border border-gray-200 text-right text-green-700">{fmt(gross)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Deductions */}
              <table className="w-full">
                <thead>
                  <tr><th className="bg-red-800 text-white px-3 py-2 text-left text-xs" colSpan={2}>DEDUCTIONS</th></tr>
                </thead>
                <tbody>
                  {esiEmp > 0 && (
                    <tr>
                      <td className="px-3 py-1.5 text-xs border border-gray-200">ESI (Employee)</td>
                      <td className="px-3 py-1.5 text-xs border border-gray-200 text-right text-purple-600">{fmt(esiEmp)}</td>
                    </tr>
                  )}
                  {pfEmp > 0 && (
                    <tr>
                      <td className="px-3 py-1.5 text-xs border border-gray-200">PF (Employee)</td>
                      <td className="px-3 py-1.5 text-xs border border-gray-200 text-right text-blue-600">{fmt(pfEmp)}</td>
                    </tr>
                  )}
                  {loanDeduct > 0 && (
                    <tr>
                      <td className="px-3 py-1.5 text-xs border border-gray-200">Loan Recovery</td>
                      <td className="px-3 py-1.5 text-xs border border-gray-200 text-right text-red-500">{fmt(loanDeduct)}</td>
                    </tr>
                  )}
                  {advDeduct > 0 && (
                    <tr>
                      <td className="px-3 py-1.5 text-xs border border-gray-200">Advance Recovery</td>
                      <td className="px-3 py-1.5 text-xs border border-gray-200 text-right text-red-500">{fmt(advDeduct)}</td>
                    </tr>
                  )}
                  {esiEmp === 0 && pfEmp === 0 && loanDeduct === 0 && (
                    <tr>
                      <td className="px-3 py-1.5 text-xs border border-gray-200 text-gray-400" colSpan={2}>No deductions</td>
                    </tr>
                  )}
                  <tr className="bg-red-50 font-bold">
                    <td className="px-3 py-1.5 text-xs border border-gray-200">TOTAL DEDUCTIONS</td>
                    <td className="px-3 py-1.5 text-xs border border-gray-200 text-right text-red-700">{fmt(esiEmp + pfEmp + loanDeduct + advDeduct + otherDeduct)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Net Payable */}
            <div className="mt-4 bg-blue-900 text-white rounded-lg p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold">NET SALARY PAYABLE</p>
                <p className="text-xs text-blue-200 mt-0.5">Credited to A/c: {staff.bank_account_no || '—'}</p>
              </div>
              <p className="text-2xl font-bold">{fmt(netPayable)}</p>
            </div>

            {/* Signatures */}
            <div className="flex justify-between mt-8">
              <div className="text-center">
                <div className="border-t border-gray-800 pt-1 w-28 text-xs">Employee Signature</div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-800 pt-1 w-28 text-xs">Cashier</div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-800 pt-1 w-28 text-xs">Authorised Signatory</div>
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 mt-4 border-t pt-2">
              This is a computer generated salary slip — {org?.name}
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Close</button>
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print Salary Slip
          </button>
        </div>
      </div>
    </div>
  )
}
