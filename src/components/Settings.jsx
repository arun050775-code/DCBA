import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { Settings as SettingsIcon, Mail, Save, Printer } from 'lucide-react'

export default function Settings() {
  const { currentOrg, userRole } = useAuth()
  const [printerEmail, setPrinterEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (currentOrg) fetchSettings() }, [currentOrg])

  async function fetchSettings() {
    setLoading(true)
    const { data } = await supabase.from('org_settings')
      .select('*').eq('org_id', currentOrg.id).single()
    if (data) setPrinterEmail(data.printer_email || '')
    else setPrinterEmail('printer@dcba.in')
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { error } = await supabase.from('org_settings').upsert({
        org_id: currentOrg.id,
        printer_email: printerEmail,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id' })
      if (error) throw error
      toast.success('Settings saved!')
    } catch (err) {
      toast.error(err.message)
    }
    setSaving(false)
  }

  if (userRole?.role !== 'admin') {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <div className="card p-8 text-center text-gray-400">
          <SettingsIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Access restricted to Admin only</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-gray-600" /> Settings
        </h1>
        <p className="text-gray-500 text-sm mt-1">{currentOrg?.name}</p>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {/* Printer Settings */}
          <div className="card p-5">
            <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2 mb-4">
              <Printer className="w-4 h-4 text-blue-600" /> I-Card Printer Settings
            </h3>
            <div>
              <label className="label flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> Printer Email Address
              </label>
              <input type="email" className="input" value={printerEmail}
                onChange={e => setPrinterEmail(e.target.value)}
                placeholder="printer@example.com" data-no-upper />
              <p className="text-xs text-gray-400 mt-1">
                I-Card details will be emailed to this address when "Send to Printer" is clicked
              </p>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="btn-primary flex items-center gap-2 mt-4">
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {/* More settings can be added here */}
          <div className="card p-5 bg-gray-50 border-dashed">
            <p className="text-xs text-gray-400 text-center">More settings coming soon...</p>
          </div>
        </div>
      )}
    </div>
  )
}
