import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { Plus, Users, Mail, ToggleRight, ToggleLeft } from 'lucide-react'

export default function UserManagement() {
  const { currentOrg } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', name: '', role: 'cashier' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (currentOrg) fetchUsers() }, [currentOrg])

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_org_users', { org_uuid: currentOrg.id })
    if (error) console.error(error)
    setUsers(data || [])
    setLoading(false)
  }

  async function createUser() {
    if (!form.email || !form.password || !form.name) return toast.error('All fields required')
    setSaving(true)
    try {
      // Create auth user via Supabase Admin (using service role would be needed for production)
      // For now, use sign-up flow
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.name } }
      })
      if (authError) throw authError

      const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: authData.user.id,
        org_id: currentOrg.id,
        role: form.role,
        name: form.name,
      })
      if (roleError) throw roleError

      toast.success(`User ${form.name} created successfully`)
      setShowModal(false)
      setForm({ email: '', password: '', name: '', role: 'cashier' })
      fetchUsers()
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  async function toggleUser(user) {
    const { error } = await supabase.from('user_roles').update({ is_active: !user.is_active }).eq('id', user.id)
    if (error) toast.error(error.message)
    else { toast.success('User status updated'); fetchUsers() }
  }

  const roleColors = { admin: 'bg-purple-100 text-purple-700', cashier: 'bg-blue-100 text-blue-700', management: 'bg-green-100 text-green-700' }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-700" /> User Management
          </h1>
          <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr>
              {['Name', 'Role', 'Status', 'Added On', 'Action'].map(h => (
                <th key={h} className="table-header text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="table-cell text-center text-gray-400">Loading...</td></tr>
            ) : users.map((u, i) => (
              <tr key={u.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                <td className="table-cell font-medium">{u.name}</td>
                <td className="table-cell">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${roleColors[u.role]}`}>{u.role}</span>
                </td>
                <td className="table-cell">
                  {u.is_active ? <span className="badge-active">Active</span> : <span className="badge-inactive">Inactive</span>}
                </td>
                <td className="table-cell text-gray-500">{new Date(u.created_at).toLocaleDateString('en-IN')}</td>
                <td className="table-cell">
                  <button onClick={() => toggleUser(u)} className="p-1 rounded hover:bg-gray-100">
                    {u.is_active ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Add New User</h3>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="label">Full Name</label>
                <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Aftab Alam" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="user@email.com" />
              </div>
              <div>
                <label className="label">Password</label>
                <input className="input" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Min 6 characters" />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="cashier">Cashier</option>
                  <option value="management">Management (View Only)</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 justify-end">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={createUser} disabled={saving} className="btn-primary flex items-center gap-2">
                <Mail className="w-4 h-4" /> {saving ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
