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
    role: 'project_manager', // mapped admin level
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
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('progressiq_token'))
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('progressiq_user')
    return saved ? JSON.parse(saved) : null
  })
  const [loading, setLoading] = useState(true)

  // Verify / refresh user session on startup
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('progressiq_token')
      if (savedToken) {
        try {
          const me = await apiService.getMe()
          setUser(me)
          localStorage.setItem('progressiq_user', JSON.stringify(me))
        } catch {
          // If token expired, clear
          localStorage.removeItem('progressiq_token')
          localStorage.removeItem('progressiq_user')
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
      throw new Error((res as any)?.detail || (res as any)?.error || (res as any)?.message || 'Authentication failed. Please verify server connection.')
    }
    const { access_token, user: loggedUser } = res
    setToken(access_token)
    setUser(loggedUser)
    localStorage.setItem('progressiq_token', access_token)
    localStorage.setItem('progressiq_user', JSON.stringify(loggedUser))
    if (loggedUser?.role) {
      localStorage.setItem('progressiq_role', loggedUser.role)
    }
    return loggedUser
  }

  const register = async (data: { email: string; password: string; full_name: string; role?: string; organization?: string }): Promise<UserProfile> => {
    const res = await apiService.register(data)
    if (!res || !res.access_token || !res.user) {
      throw new Error((res as any)?.detail || (res as any)?.error || (res as any)?.message || 'Registration failed.')
    }
    const { access_token, user: newUser } = res
    setToken(access_token)
    setUser(newUser)
    localStorage.setItem('progressiq_token', access_token)
    localStorage.setItem('progressiq_user', JSON.stringify(newUser))
    if (newUser?.role) {
      localStorage.setItem('progressiq_role', newUser.role)
    }
    return newUser
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('progressiq_token')
    localStorage.removeItem('progressiq_user')
  }

  const quickLoginAs = async (email: string, password: string): Promise<UserProfile> => {
    return login(email, password)
  }

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
