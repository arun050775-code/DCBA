import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [currentOrg, setCurrentOrg] = useState(null)
  const [userOrgs, setUserOrgs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUserData(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchUserData(session.user.id)
      else { setUserRole(null); setCurrentOrg(null); setUserOrgs([]); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchUserData(userId) {
    try {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('*, organisations(*)')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (roles && roles.length > 0) {
        setUserOrgs(roles)
        // Default to first org (admin picks SBA by default)
        const defaultRole = roles.find(r => r.organisations.short_name === 'SBA') || roles[0]
        setUserRole(defaultRole)
        setCurrentOrg(defaultRole.organisations)
      }
    } catch (err) {
      console.error('Error fetching user data:', err)
    } finally {
      setLoading(false)
    }
  }

  function switchOrg(orgId) {
    const role = userOrgs.find(r => r.org_id === orgId)
    if (role) {
      setUserRole(role)
      setCurrentOrg(role.organisations)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, userRole, currentOrg, userOrgs, loading, switchOrg, signOut, fetchUserData }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
