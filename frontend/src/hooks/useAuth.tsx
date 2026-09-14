import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import apiService from '../services/api'

export interface UserProfile {
  id: number
  email: string
  full_name: string
  role: string
  organization?: string
  is_active: boolean
}

export interface TestAccount {
  email: string
  role: string
  name: string
  description: string
  password: string
}

export const TEST_ACCOUNTS: TestAccount[] = [
  {
    email: 'admin@progressiq.ai',
    role: 'project_manager',
    name: 'Executive Administrator',
    description: 'Full administrative access across all projects, users, schedules & audits',
    password: 'admin123',
  },
  {
    email: 'pm@progressiq.ai',
    role: 'project_manager',
    name: 'Rajesh Sharma (PM)',
    description: 'Project Manager — Dashboard progress, schedule approvals, verification decisions',
    password: 'pm123',
  },
  {
    email: 'engineer@progressiq.ai',
    role: 'site_engineer',
    name: 'Amit Kumar (Site Eng)',
    description: 'Site Engineer — Mobile field updates, camera evidence, daily progress logs',
    password: 'engineer123',
  },
  {
    email: 'viewer@progressiq.ai',
    role: 'enterprise_viewer',
    name: 'Priya Patel (Auditor)',
    description: 'Viewer — Executive overview, read-only analytics, safety compliance metrics',
    password: 'viewer123',
  },
]

// ── Safe JSON parse — never crashes ──────────────────────────────────────────
function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

// ── Safe localStorage — never crashes ────────────────────────────────────────
function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function safeSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}
function safeRemoveItem(key: string): void {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

interface AuthContextType {
  user: UserProfile | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<UserProfile>
  register: (data: { email: string; password: string; full_name: string; role?: string; organization?: string }) => Promise<UserProfile>
  logout: () => void
  quickLoginAs: (email: string, password: string) => Promise<UserProfile>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,
  login: async () => { throw new Error('Not implemented') },
  register: async () => { throw new Error('Not implemented') },
  logout: () => {},
  quickLoginAs: async () => { throw new Error('Not implemented') },
})

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => safeGetItem('progressiq_token'))
  const [user, setUser] = useState<UserProfile | null>(() =>
    safeParse<UserProfile>(safeGetItem('progressiq_user'))
  )
  const [loading, setLoading] = useState(true)

  // Verify session on startup — if token exists, validate it
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = safeGetItem('progressiq_token')
      if (savedToken) {
        try {
          const me = await apiService.getMe()
          if (me && me.id) {
            setUser(me)
            safeSetItem('progressiq_user', JSON.stringify(me))
          } else {
            throw new Error('Invalid user response')
          }
        } catch {
          // Token expired or invalid — clear everything
          safeRemoveItem('progressiq_token')
          safeRemoveItem('progressiq_user')
          setToken(null)
          setUser(null)
        }
      }
      setLoading(false)
    }
    initAuth()
  }, [])

  const login = async (email: string, password: string): Promise<UserProfile> => {
    const res = await apiService.login({ email, password })
    if (!res || !res.access_token || !res.user) {
      throw new Error((res as any)?.detail || (res as any)?.error || 'Authentication failed.')
    }
    const { access_token, user: loggedUser } = res
    setToken(access_token)
    setUser(loggedUser)
    safeSetItem('progressiq_token', access_token)
    safeSetItem('progressiq_user', JSON.stringify(loggedUser))
    if (loggedUser?.role) safeSetItem('progressiq_role', loggedUser.role)
    return loggedUser
  }

  const register = async (data: {
    email: string; password: string; full_name: string; role?: string; organization?: string
  }): Promise<UserProfile> => {
    const res = await apiService.register(data)
    if (!res || !res.access_token || !res.user) {
      throw new Error((res as any)?.detail || (res as any)?.error || 'Registration failed.')
    }
    const { access_token, user: newUser } = res
    setToken(access_token)
    setUser(newUser)
    safeSetItem('progressiq_token', access_token)
    safeSetItem('progressiq_user', JSON.stringify(newUser))
    if (newUser?.role) safeSetItem('progressiq_role', newUser.role)
    return newUser
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    safeRemoveItem('progressiq_token')
    safeRemoveItem('progressiq_user')
    safeRemoveItem('progressiq_role')
  }

  const quickLoginAs = async (email: string, password: string): Promise<UserProfile> =>
    login(email, password)

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: Boolean(token && user),
      loading,
      login,
      register,
      logout,
      quickLoginAs,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
