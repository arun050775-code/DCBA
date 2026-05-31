import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { Plus, ChevronDown, ChevronRight, Pencil, ToggleLeft, ToggleRight, BookOpen, Download, FileSpreadsheet, Upload, CheckCircle } from 'lucide-react'

export default function ChartOfAccounts() {
  const { currentOrg, userRole } = useAuth()
  const [heads, setHeads] = useState([])
  const [subHeads, setSubHeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedHeads, setExpandedHeads] = useState({})
  const [activeType, setActiveType] = useState('income')

  // Modal state
  const [showHeadModal, setShowHeadModal] = useState(false)
  const [showSubModal, setShowSubModal] = useState(false)
  const [editHead, setEditHead] = useState(null)
  const [editSub, setEditSub] = useState(null)
  const [selectedHeadId, setSelectedHeadId] = useState(null)
  const [formName, setFormName] = useState('')

  const isAdmin = ['admin', 'accountant'].includes(userRole?.role)
  const [showImport, setShowImport] = useState(false)

  function downloadTemplate() {
    const wb = XLSX.utils.book_new()

    const headsData = [
      ['Head Name', 'Type (income / expenditure)', 'Sort Order'],
      ['Member Fees', 'income', 1],
      ['Rent Income', 'income', 2],
      ['Administration', 'expenditure', 1],
      ['Maintenance', 'expenditure', 2],
      ['Legal Expenses', 'expenditure', 3],
    ]
    const ws1 = XLSX.utils.aoa_to_sheet(headsData)
    ws1['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws1, 'Heads')

    const subHeadsData = [
      ['Sub Head Name', 'Head Name (must match exactly)', 'Sort Order'],
      ['Admission Fee', 'Member Fees', 1],
      ['Annual Subscription', 'Member Fees', 2],
      ['Typist Rent', 'Rent Income', 1],
      ['Stationery', 'Administration', 1],
      ['Electricity', 'Maintenance', 1],
      ['Court Fee', 'Legal Expenses', 1],
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(subHeadsData)
    ws2['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Sub Heads')

    const instrData = [
      ['DCBA — Account Heads Import Instructions'],
      [],
      ['Heads Sheet:'],
      ['• Head Name — Name of the account head'],
      ['• Type — Must be exactly "income" or "expenditure"'],
      ['• Sort Order — Display order (1, 2, 3...)'],
      [],
      ['Sub Heads Sheet:'],
      ['• Sub Head Name — Name of the sub head'],
      ['• Head Name — Must match exactly with a head in Heads sheet or existing head'],
      ['• Sort Order — Display order within the head'],
      [],
      ['Note: Existing heads/sub-heads with same name will be skipped (no duplicates)'],
    ]
    const ws3 = XLSX.utils.aoa_to_sheet(instrData)
    ws3['!cols'] = [{ wch: 60 }]
    XLSX.utils.book_append_sheet(wb, ws3, 'Instructions')

    XLSX.writeFile(wb, 'DCBA_AccountHeads_Template.xlsx')
    toast.success('Template downloaded!')
  }

  useEffect(() => {
    if (currentOrg) fetchData()
  }, [currentOrg])

  async function fetchData() {
    setLoading(true)
    const [{ data: h }, { data: s }] = await Promise.all([
      supabase.from('account_heads').select('*').eq('org_id', currentOrg.id).order('sort_order'),
      supabase.from('account_sub_heads').select('*').eq('org_id', currentOrg.id).order('sort_order'),
    ])
    setHeads(h || [])
    setSubHeads(s || [])
    setLoading(false)
  }

  const typeLabels = { income: 'Income Heads', expenditure: 'Expenditure Heads', balance_sheet: 'Balance Sheet Items' }
  const filteredHeads = heads.filter(h => h.type === activeType)

  function toggleExpand(id) {
    setExpandedHeads(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // HEAD CRUD
  async function saveHead() {
    if (!formName.trim()) return toast.error('Name is required')
    if (editHead) {
      const { error } = await supabase.from('account_heads').update({ name: formName }).eq('id', editHead.id)
      if (error) return toast.error(error.message)
      toast.success('Head updated')
    } else {
      const { error } = await supabase.from('account_heads').insert({ org_id: currentOrg.id, type: activeType, name: formName, sort_order: filteredHeads.length + 1 })
      if (error) return toast.error(error.message)
      toast.success('Head added')
    }
    setShowHeadModal(false); setFormName(''); setEditHead(null)
    fetchData()
  }

  async function toggleHead(head) {
    const { error } = await supabase.from('account_heads').update({ is_active: !head.is_active }).eq('id', head.id)
    if (error) toast.error(error.message)
    else fetchData()
  }

  // SUBHEAD CRUD
  async function saveSub() {
    if (!formName.trim()) return toast.error('Name is required')
    if (editSub) {
      const { error } = await supabase.from('account_sub_heads').update({ name: formName }).eq('id', editSub.id)
      if (error) return toast.error(error.message)
      toast.success('Sub-head updated')
    } else {
      const existing = subHeads.filter(s => s.head_id === selectedHeadId)
      const { error } = await supabase.from('account_sub_heads').insert({ org_id: currentOrg.id, head_id: selectedHeadId, name: formName, sort_order: existing.length + 1 })
      if (error) return toast.error(error.message)
      toast.success('Sub-head added')
    }
    setShowSubModal(false); setFormName(''); setEditSub(null); setSelectedHeadId(null)
    fetchData()
  }

  async function toggleSub(sub) {
    const { error } = await supabase.from('account_sub_heads').update({ is_active: !sub.is_active }).eq('id', sub.id)
    if (error) toast.error(error.message)
    else fetchData()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-700" /> Chart of Accounts
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={downloadTemplate}
              className="btn-secondary flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" /> Template
            </button>
            <button onClick={() => setShowImport(true)}
              className="btn-secondary flex items-center gap-2 text-sm">
              <FileSpreadsheet className="w-4 h-4" /> Bulk Import
            </button>
            <button onClick={() => { setEditHead(null); setFormName(''); setShowHeadModal(true) }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Add Head
            </button>
          </div>
        )}
      </div>

      {/* Type Tabs */}
      <div className="flex gap-2 mb-6">
        {Object.entries(typeLabels).map(([key, label]) => (
          <button key={key} onClick={() => setActiveType(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeType === key ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Heads List */}
      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : filteredHeads.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No heads defined yet. Add one!</div>
      ) : (
        <div className="space-y-3">
          {filteredHeads.map(head => {
            const subs = subHeads.filter(s => s.head_id === head.id)
            const isExpanded = expandedHeads[head.id]
            return (
              <div key={head.id} className={`card p-0 overflow-hidden ${!head.is_active ? 'opacity-60' : ''}`}>
                {/* Head Row */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <button onClick={() => toggleExpand(head.id)} className="flex items-center gap-2 text-left flex-1">
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className="font-semibold text-gray-800">{head.name}</span>
                    <span className="text-xs text-gray-400">({subs.length} sub-heads)</span>
                    {!head.is_active && <span className="badge-inactive">Inactive</span>}
                  </button>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditHead(head); setFormName(head.name); setShowHeadModal(true) }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => toggleHead(head)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded">
                        {head.is_active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button onClick={() => { setSelectedHeadId(head.id); setEditSub(null); setFormName(''); setShowSubModal(true) }}
                        className="btn-primary py-1 px-2 text-xs flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Sub
                      </button>
                    </div>
                  )}
                </div>

                {/* Sub Heads */}
                {isExpanded && (
                  <div>
                    {subs.length === 0 ? (
                      <p className="px-6 py-3 text-sm text-gray-400 italic">No sub-heads. Click + Sub to add.</p>
                    ) : (
                      subs.map((sub, idx) => (
                        <div key={sub.id} className={`flex items-center justify-between px-6 py-2.5 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${!sub.is_active ? 'opacity-60' : ''}`}>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>
                            <span className="text-sm text-gray-700">{sub.name}</span>
                            {!sub.is_active && <span className="badge-inactive">Inactive</span>}
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditSub(sub); setFormName(sub.name); setSelectedHeadId(sub.head_id); setShowSubModal(true) }}
                                className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => toggleSub(sub)} className="p-1 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded">
                                {sub.is_active ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4" />}
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Head Modal */}
      {showHeadModal && (
        <Modal title={editHead ? 'Edit Head' : `Add ${typeLabels[activeType].replace(' Heads','').replace(' Items','')} Head`}
          onClose={() => { setShowHeadModal(false); setEditHead(null); setFormName('') }}
          onSave={saveHead}>
          <label className="label">Head Name</label>
          <input className="input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Rental Income" autoFocus />
        </Modal>
      )}

      {/* Sub Head Modal */}
      {showSubModal && (
        <Modal title={editSub ? 'Edit Sub-Head' : 'Add Sub-Head'}
          onClose={() => { setShowSubModal(false); setEditSub(null); setFormName('') }}
          onSave={saveSub}>
          <label className="label">Sub-Head Name</label>
          <input className="input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Typists" autoFocus />
        </Modal>
      )}
      {showImport && (
        <AccountHeadsImportModal
          org={currentOrg}
          existingHeads={heads}
          onClose={() => setShowImport(false)}
          onSuccess={() => { setShowImport(false); fetchData() }}
        />
      )}
    </div>
  )
}

function Modal({ title, children, onClose, onSave }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        </div>
        <div className="px-6 py-4">{children}</div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={onSave} className="btn-primary">Save</button>
        </div>
      </div>
    </div>
  )
}

// ---- ACCOUNT HEADS BULK IMPORT ----
function AccountHeadsImportModal({ org, existingHeads, onClose, onSuccess }) {
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
        const errs = []

        // Parse Heads
        const headsSheet = wb.Sheets['Heads'] || wb.Sheets[wb.SheetNames[0]]
        const headsRows = XLSX.utils.sheet_to_json(headsSheet, { header: 1, defval: '' })
        const newHeads = []
        headsRows.slice(1).forEach((row, i) => {
          if (!row[0]) return
          const name = String(row[0]).trim()
          const type = String(row[1] || '').trim().toLowerCase()
          const sortOrder = Number(row[2]) || 99
          if (!['income', 'expenditure'].includes(type)) {
            errs.push(`Heads row ${i+2}: Type must be "income" or "expenditure" — found "${type}"`)
            return
          }
          newHeads.push({ name, type, sortOrder })
        })

        // Parse Sub Heads
        const subSheet = wb.Sheets['Sub Heads'] || wb.Sheets[wb.SheetNames[1]]
        const newSubHeads = []
        if (subSheet) {
          const subRows = XLSX.utils.sheet_to_json(subSheet, { header: 1, defval: '' })
          subRows.slice(1).forEach((row, i) => {
            if (!row[0]) return
            const name = String(row[0]).trim()
            const headName = String(row[1] || '').trim()
            const sortOrder = Number(row[2]) || 99
            if (!headName) { errs.push(`Sub Heads row ${i+2}: Head name required`); return }
            newSubHeads.push({ name, headName, sortOrder })
          })
        }

        setErrors(errs)
        setPreview({ heads: newHeads, subHeads: newSubHeads })
        setStep(2)
      } catch (err) {
        toast.error('Error reading file: ' + err.message)
      }
    }
    reader.readAsBinaryString(f)
  }

  async function handleImport() {
    if (!preview) return
    setImporting(true)
    let imported = 0, skipped = 0
    const errs = []

    try {
      // Build head map (existing + new)
      const headMap = {}
      existingHeads.forEach(h => { headMap[h.name.toLowerCase()] = h.id })

      // Import Heads
      for (const h of preview.heads) {
        const key = h.name.toLowerCase()
        if (headMap[key]) {
          errs.push(`Head "${h.name}" already exists — skipped`)
          skipped++
          continue
        }
        const { data: newHead, error } = await supabase.from('account_heads').insert({
          org_id: org.id,
          name: h.name,
          type: h.type,
          sort_order: h.sortOrder,
          is_active: true,
        }).select().single()
        if (error) { errs.push(`Head "${h.name}": ${error.message}`); skipped++ }
        else { headMap[key] = newHead.id; imported++ }
      }

      // Import Sub Heads
      for (const s of preview.subHeads) {
        const headId = headMap[s.headName.toLowerCase()]
        if (!headId) {
          errs.push(`Sub Head "${s.name}": Head "${s.headName}" not found — skipped`)
          skipped++
          continue
        }
        const { error } = await supabase.from('account_sub_heads').insert({
          org_id: org.id,
          name: s.name,
          head_id: headId,
          sort_order: s.sortOrder,
          is_active: true,
        })
        if (error) { errs.push(`Sub Head "${s.name}": ${error.message}`); skipped++ }
        else imported++
      }

      setErrors(errs)
      setStep(3)
      toast.success(`Import complete! ${imported} items imported, ${skipped} skipped`)
    } catch (err) {
      toast.error(err.message)
    }
    setImporting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-700" /> Import Account Heads
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4">
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 space-y-1">
                <p className="font-semibold mb-2">Instructions:</p>
                <p>• Download template using "Template" button</p>
                <p>• Fill Heads sheet — Name, Type (income/expenditure), Sort Order</p>
                <p>• Fill Sub Heads sheet — Sub Head Name, Head Name (exact match), Sort Order</p>
                <p>• Duplicate heads will be skipped automatically</p>
              </div>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium mb-3">Upload filled Excel file</p>
                <label className="btn-primary cursor-pointer inline-flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Choose File
                  <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
                </label>
              </div>
            </div>
          )}

          {step === 2 && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-blue-700">{preview.heads.length}</p>
                  <p className="text-xs text-blue-600">Heads to import</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{preview.subHeads.length}</p>
                  <p className="text-xs text-green-600">Sub Heads to import</p>
                </div>
              </div>

              {errors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <p className="text-sm font-semibold text-yellow-800 mb-1">⚠️ {errors.length} warning{errors.length > 1 ? 's' : ''}:</p>
                  {errors.map((e, i) => <p key={i} className="text-xs text-yellow-700">{e}</p>)}
                </div>
              )}

              {preview.heads.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2">Heads Preview:</p>
                  <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Head Name</th>
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-center">Sort</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.heads.slice(0, 8).map((h, i) => (
                        <tr key={i} className={i%2===0?'bg-white':'bg-gray-50/50'}>
                          <td className="px-3 py-1.5 font-medium">{h.name}</td>
                          <td className="px-3 py-1.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${h.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {h.type}
                            </span>
                          </td>
                          <td className="px-3 py-1.5 text-center text-gray-500">{h.sortOrder}</td>
                        </tr>
                      ))}
                      {preview.heads.length > 8 && (
                        <tr><td colSpan={3} className="px-3 py-2 text-center text-gray-400">... and {preview.heads.length - 8} more</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {preview.subHeads.length > 0 && (
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2">Sub Heads Preview:</p>
                  <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Sub Head</th>
                        <th className="px-3 py-2 text-left">Under Head</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.subHeads.slice(0, 8).map((s, i) => (
                        <tr key={i} className={i%2===0?'bg-white':'bg-gray-50/50'}>
                          <td className="px-3 py-1.5 font-medium">{s.name}</td>
                          <td className="px-3 py-1.5 text-gray-500">{s.headName}</td>
                        </tr>
                      ))}
                      {preview.subHeads.length > 8 && (
                        <tr><td colSpan={2} className="px-3 py-2 text-center text-gray-400">... and {preview.subHeads.length - 8} more</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">Import Complete!</h3>
              {errors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mt-4 text-left">
                  <p className="text-sm font-semibold text-yellow-800 mb-1">Skipped ({errors.length}):</p>
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
              <button onClick={handleImport} disabled={importing || (!preview?.heads.length && !preview?.subHeads.length)}
                className="btn-primary">
                {importing ? 'Importing...' : `Import ${(preview?.heads.length || 0) + (preview?.subHeads.length || 0)} Items`}
              </button>
            </div>
          )}
          {step === 3 && <button onClick={onSuccess} className="btn-primary">✓ Done</button>}
        </div>
      </div>
    </div>
  )
}
