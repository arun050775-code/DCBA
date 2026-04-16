import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { Plus, ChevronDown, ChevronRight, Pencil, ToggleLeft, ToggleRight, BookOpen } from 'lucide-react'

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

  const isAdmin = userRole?.role === 'admin'

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
          <button onClick={() => { setEditHead(null); setFormName(''); setShowHeadModal(true) }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Head
          </button>
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
