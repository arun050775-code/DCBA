import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import { ClipboardList, Search, RefreshCw } from 'lucide-react'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatDate(d) {
  if (!d) return '—'
  const dt = new Date(d)
  return `${String(dt.getDate()).padStart(2,'0')}-${MONTHS[dt.getMonth()]}-${dt.getFullYear()} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
}

const ACTION_BADGE = {
  cancel: 'bg-red-100 text-red-700',
  edit: 'bg-blue-100 text-blue-700',
  create: 'bg-green-100 text-green-700',
  post: 'bg-purple-100 text-purple-700',
}

export default function AuditLog() {
  const { currentOrg } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterAction, setFilterAction] = useState('all')

  useEffect(() => { if (currentOrg) fetchLogs() }, [currentOrg, filterAction])

  async function fetchLogs() {
    setLoading(true)
    let q = supabase.from('audit_log')
      .select('*')
      .eq('org_id', currentOrg.id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (filterAction !== 'all') q = q.eq('action', filterAction)

    const { data } = await q
    setLogs(data || [])
    setLoading(false)
  }

  const filtered = logs.filter(l =>
    !search ||
    (l.done_by_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.reason || '').toLowerCase().includes(search.toLowerCase()) ||
    (l.table_name || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-purple-600" /> Audit Trail
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name} — All modifications and cancellations</p>
        </div>
        <button onClick={fetchLogs} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search by name, reason, table..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            {['all','create','edit','cancel','post'].map(a => (
              <button key={a} onClick={() => setFilterAction(a)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border capitalize transition-colors ${filterAction === a ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
                {a}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Date & Time','Action','Table','Done By','Role','Reason'].map(h => (
                  <th key={h} className="table-header text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="table-cell text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="table-cell text-center py-8 text-gray-400">No audit records found</td></tr>
              ) : filtered.map((l, i) => (
                <tr key={l.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="table-cell text-xs whitespace-nowrap text-gray-500">{formatDate(l.created_at)}</td>
                  <td className="table-cell">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ACTION_BADGE[l.action] || 'bg-gray-100 text-gray-600'}`}>
                      {l.action}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-gray-500">{l.table_name?.replace('_', ' ')}</td>
                  <td className="table-cell text-sm font-medium">{l.done_by_name || '—'}</td>
                  <td className="table-cell text-xs capitalize text-gray-500">{l.done_by_role}</td>
                  <td className="table-cell text-sm text-gray-700 max-w-xs">{l.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t text-xs text-gray-400">{filtered.length} records shown (last 200)</div>
      </div>
    </div>
  )
}
