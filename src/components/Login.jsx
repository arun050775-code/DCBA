import { useState } from 'react'
import { supabase } from '../supabaseClient'
import toast from 'react-hot-toast'
import { Lock, Mail } from 'lucide-react'

const DCBA_LOGO = 'https://www.dwarkacourtbarassociation.com/images/logo.png'

const COMMITTEE = [
  { name: 'AVNISH RANA', designation: 'PRESIDENT' },
  { name: 'VIVEK DAGAR', designation: 'VICE PRESIDENT' },
  { name: 'KARAN VEER TYAGI', designation: 'HONY. SECRETARY' },
  { name: 'HEMANT VERMA', designation: 'ADDL. SECRETARY' },
  { name: 'AJAY SAINI', designation: 'JOINT SECRETARY' },
  { name: 'MAMTA YADAV', designation: 'TREASURER' },
  { name: 'AMIT KR. SINGH', designation: 'LIBRARY INCHARGE' },
  { name: 'ASHOK KR. JHA', designation: 'EXE. MEMBER' },
  { name: 'NISHA SETHI SUDAN', designation: 'WOMEN EXE. MEMBER' },
  { name: 'RITU GUPTA', designation: 'LADY EXE. MEMBER' },
  { name: 'LATA NAUTIYAL', designation: 'EXE. MEMBER' },
  { name: 'RAHUL TYAGI', designation: 'EXE. MEMBER' },
  { name: 'YAMANDEEP SOLANKI', designation: 'EXE. MEMBER' },
]

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2)
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) toast.error(error.message)
    else toast.success('Welcome back!')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0f1f3d 0%, #1a3a5c 60%, #0d2137 100%)' }}>

      {/* LEFT PANEL — Management Committee */}
      <div className="hidden lg:flex flex-col w-1/2 p-6 overflow-y-auto">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
            <img src={DCBA_LOGO} alt="DCBA" className="w-12 h-12 object-contain"
              onError={e => { e.target.parentElement.innerHTML = '<span style="font-size:1rem;font-weight:800;color:#1a3a5c">DC</span>' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">DWARKA COURT BAR ASSOCIATION</h1>
            <p className="text-blue-300 text-xs mt-0.5">Accounting & Management Suite</p>
          </div>
        </div>

        <div className="h-0.5 bg-gradient-to-r from-yellow-500 via-yellow-300 to-transparent mb-5 rounded-full" />

        <p className="text-yellow-400 text-xs font-bold uppercase tracking-widest mb-4">Management Committee</p>

        <div className="space-y-2">
          {COMMITTEE.map((m, idx) => (
            <div key={m.name} className="flex items-center gap-3 bg-white/5 rounded-xl px-3 py-2 hover:bg-white/10 transition-colors">
              <div className="w-9 h-9 rounded-full border-2 border-yellow-500 flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #1a3a5c, #2e5f8a)' }}>
                <span className="text-yellow-400 font-bold text-xs">{getInitials(m.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-bold truncate">{m.name}</p>
                <p className="text-yellow-400 text-xs">{m.designation}</p>
              </div>
              {idx === 0 && <span className="text-xs bg-yellow-500 text-blue-900 px-2 py-0.5 rounded-full font-bold flex-shrink-0">★</span>}
            </div>
          ))}
        </div>

        <p className="text-blue-600 text-xs mt-4 italic">* Photographs will be updated on receipt</p>

        <div className="mt-auto pt-4 border-t border-white/10">
          <p className="text-blue-600 text-xs text-center">© 2026 Dwarka Court Bar Association</p>
          <p className="text-blue-700 text-xs text-center mt-0.5">Powered by AKS & Associates</p>
        </div>
      </div>

      {/* RIGHT PANEL — Login */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6"
        style={{ background: 'rgba(255,255,255,0.03)', borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="w-full max-w-sm">

          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-white rounded-full mx-auto mb-3 flex items-center justify-center shadow-xl">
              <span className="font-bold text-xl text-blue-900">DC</span>
            </div>
            <h1 className="text-lg font-bold text-white">DCBA Admin Portal</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">Admin Login</h2>
              <p className="text-gray-400 text-sm mt-1">Sign in to continue</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input type="email" className="input pl-9" placeholder="Enter your email"
                    value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input type="password" className="input pl-9" placeholder="Enter your password"
                    value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-white transition-all mt-2"
                style={{ background: loading ? '#94a3b8' : 'linear-gradient(135deg, #1a3a5c, #2e5f8a)' }}>
                {loading ? 'Signing in...' : 'Sign In →'}
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-center text-xs text-gray-400">Dwarka Court Bar Association</p>
              <p className="text-center text-xs text-gray-300 mt-0.5">Accounting & Management Suite</p>
            </div>
          </div>

          <p className="text-center text-blue-600 text-xs mt-4">Powered by AKS & Associates</p>
        </div>
      </div>
    </div>
  )
}
