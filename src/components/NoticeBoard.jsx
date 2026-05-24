import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { Bell, Plus, Eye, Pin, Trash2, Search, FileText, AlertTriangle, Calendar, Megaphone } from 'lucide-react'

const CATEGORIES = [
  { id: 'general', label: 'General', color: 'bg-blue-100 text-blue-700', icon: Bell },
  { id: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  { id: 'meeting', label: 'Meeting Notice', color: 'bg-purple-100 text-purple-700', icon: Calendar },
  { id: 'holiday', label: 'Court Holiday', color: 'bg-green-100 text-green-700', icon: Calendar },
  { id: 'election', label: 'Election', color: 'bg-yellow-100 text-yellow-700', icon: Megaphone },
  { id: 'circular', label: 'Circular', color: 'bg-gray-100 text-gray-700', icon: FileText },
]

function getCatConfig(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[0]
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function NoticeBoard() {
  const { currentOrg, userRole } = useAuth()
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [showDetail, setShowDetail] = useState(null)

  const isAdmin = ['admin', 'cashier'].includes(userRole?.role)

  useEffect(() => { if (currentOrg) fetchNotices() }, [currentOrg, filterCat])

  async function fetchNotices() {
    setLoading(true)
    let query = supabase.from('notices')
      .select('*')
      .eq('org_id', currentOrg.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (filterCat !== 'all') query = query.eq('category', filterCat)

    const { data } = await query
    setNotices(data || [])
    setLoading(false)
  }

  async function togglePin(notice) {
    const { error } = await supabase.from('notices')
      .update({ is_pinned: !notice.is_pinned })
      .eq('id', notice.id)
    if (error) toast.error(error.message)
    else { toast.success(notice.is_pinned ? 'Unpinned!' : 'Pinned!'); fetchNotices() }
  }

  async function deleteNotice(id) {
    if (!window.confirm('Delete this notice?')) return
    const { error } = await supabase.from('notices').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Deleted!'); fetchNotices() }
  }

  const filtered = notices.filter(n =>
    !search ||
    n.title?.toLowerCase().includes(search.toLowerCase()) ||
    n.content?.toLowerCase().includes(search.toLowerCase())
  )

  const pinned = filtered.filter(n => n.is_pinned)
  const regular = filtered.filter(n => !n.is_pinned)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-700" /> Notice Board
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Post Notice
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-4 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Search notices..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilterCat('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterCat === 'all' ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200'}`}>
              All
            </button>
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => setFilterCat(c.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${filterCat === c.id ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-200'}`}>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No notices found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pinned notices */}
          {pinned.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1">
                <Pin className="w-3 h-3" /> Pinned
              </p>
              {pinned.map(n => (
                <NoticeCard key={n.id} notice={n} isAdmin={isAdmin}
                  onView={() => setShowDetail(n)}
                  onPin={() => togglePin(n)}
                  onDelete={() => deleteNotice(n.id)} />
              ))}
            </div>
          )}

          {/* Regular notices */}
          {regular.length > 0 && (
            <div>
              {pinned.length > 0 && <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Recent Notices</p>}
              {regular.map(n => (
                <NoticeCard key={n.id} notice={n} isAdmin={isAdmin}
                  onView={() => setShowDetail(n)}
                  onPin={() => togglePin(n)}
                  onDelete={() => deleteNotice(n.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <AddNoticeModal
          org={currentOrg}
          userRole={userRole}
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); fetchNotices() }}
        />
      )}

      {showDetail && (
        <NoticeDetailModal
          notice={showDetail}
          isAdmin={isAdmin}
          onClose={() => setShowDetail(null)}
          onPin={() => { togglePin(showDetail); setShowDetail(null) }}
        />
      )}
    </div>
  )
}

function NoticeCard({ notice: n, isAdmin, onView, onPin, onDelete }) {
  const cat = getCatConfig(n.category)
  const CatIcon = cat.icon
  const isExpired = n.expiry_date && new Date(n.expiry_date) < new Date()

  return (
    <div className={`card mb-3 p-4 cursor-pointer hover:shadow-md transition-shadow ${n.is_pinned ? 'border-l-4 border-l-yellow-400' : ''} ${isExpired ? 'opacity-60' : ''}`}
      onClick={onView}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cat.color}`}>
            <CatIcon className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {n.is_pinned && <Pin className="w-3 h-3 text-yellow-500" />}
              <h3 className="font-semibold text-gray-800 text-sm">{n.title}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cat.color}`}>{cat.label}</span>
              {isExpired && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Expired</span>}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.content}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span>{formatDate(n.created_at)}</span>
              {n.expiry_date && <span>Expires: {formatDate(n.expiry_date)}</span>}
              {n.posted_by_name && <span>By: {n.posted_by_name}</span>}
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={onPin}
              className={`p-1.5 rounded hover:bg-gray-100 ${n.is_pinned ? 'text-yellow-500' : 'text-gray-400'}`}
              title={n.is_pinned ? 'Unpin' : 'Pin'}>
              <Pin className="w-4 h-4" />
            </button>
            <button onClick={onDelete}
              className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function AddNoticeModal({ org, userRole, onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: '',
    content: '',
    category: 'general',
    expiry_date: '',
    is_pinned: false,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.title) return toast.error('Title required')
    if (!form.content) return toast.error('Content required')

    setSaving(true)
    try {
      const { error } = await supabase.from('notices').insert({
        org_id: org.id,
        title: form.title,
        content: form.content,
        category: form.category,
        expiry_date: form.expiry_date || null,
        is_pinned: form.is_pinned,
        posted_by: userRole?.user_id,
        posted_by_name: userRole?.name,
      })
      if (error) throw error
      toast.success('Notice posted!')
      onSuccess()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-blue-50">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-700" /> Post Notice
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Category */}
          <div>
            <label className="label">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(c => {
                const Icon = c.icon
                return (
                  <button key={c.id} type="button"
                    onClick={() => setForm({ ...form, category: c.id })}
                    className={`p-2 rounded-xl border-2 text-center transition-all ${form.category === c.id ? c.color + ' border-current' : 'border-gray-200 bg-white text-gray-500'}`}>
                    <Icon className="w-4 h-4 mx-auto mb-1" />
                    <p className="text-xs font-medium">{c.label}</p>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="label">Title *</label>
            <input className="input" value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Notice title" />
          </div>

          <div>
            <label className="label">Content *</label>
            <textarea className="input h-28 resize-none" value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder="Notice details..." />
          </div>

          <div>
            <label className="label">Expiry Date <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="date" className="input" value={form.expiry_date}
              onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
          </div>

          <label className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3 cursor-pointer">
            <input type="checkbox" checked={form.is_pinned}
              onChange={e => setForm({ ...form, is_pinned: e.target.checked })}
              className="w-4 h-4 text-yellow-500" />
            <div>
              <p className="text-sm font-medium text-yellow-800">📌 Pin this notice</p>
              <p className="text-xs text-yellow-600">Pinned notices appear at the top</p>
            </div>
          </label>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            <Bell className="w-4 h-4" />
            {saving ? 'Posting...' : 'Post Notice'}
          </button>
        </div>
      </div>
    </div>
  )
}

function NoticeDetailModal({ notice: n, isAdmin, onClose, onPin }) {
  const cat = getCatConfig(n.category)
  const CatIcon = cat.icon

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className={`flex items-center justify-between px-6 py-4 border-b ${cat.color}`}>
          <div className="flex items-center gap-2">
            <CatIcon className="w-5 h-5" />
            <span className="text-sm font-medium">{cat.label}</span>
            {n.is_pinned && <Pin className="w-4 h-4 text-yellow-600" />}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/50 rounded-lg">✕</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <h2 className="text-xl font-bold text-gray-800">{n.title}</h2>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>📅 {formatDate(n.created_at)}</span>
            {n.expiry_date && <span>⏰ Expires: {formatDate(n.expiry_date)}</span>}
            {n.posted_by_name && <span>👤 {n.posted_by_name}</span>}
          </div>

          <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
            {n.content}
          </div>
        </div>

        <div className="px-6 py-4 border-t flex gap-3 justify-end">
          {isAdmin && (
            <button onClick={onPin} className="btn-secondary flex items-center gap-2">
              <Pin className="w-4 h-4" />
              {n.is_pinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          <button onClick={onClose} className="btn-primary">Close</button>
        </div>
      </div>
    </div>
  )
}
