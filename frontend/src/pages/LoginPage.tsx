import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Sparkles, RefreshCw, KeyRound
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth, TEST_ACCOUNTS } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import ProgressIQLogo from '../components/ProgressIQLogo'
import { inputField, selectField, btnPrimary } from '../components/ui'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, register, quickLoginAs } = useAuth()
  const { theme } = useTheme()
  const { success, error } = useToast()
  const isDark = theme === 'dark'

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('site_engineer')
  const [organization, setOrganization] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [quickLoading, setQuickLoading] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (mode === 'login') {
        const user = await login(email, password)
        success(`Welcome back, ${user.full_name}!`)
      } else {
        const user = await register({
          email,
          password,
          full_name: fullName,
          role,
          organization: organization || undefined,
        })
        success(`Account created! Welcome, ${user.full_name}!`)
      }
      navigate('/')
    } catch (err: any) {
      error(err.message || 'Authentication failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuickLogin = async (acc: typeof TEST_ACCOUNTS[0]) => {
    setQuickLoading(acc.email)
    try {
      const user = await quickLoginAs(acc.email, acc.password)
      success(`Logged in as ${acc.name} (${user?.role || 'User'})`)
      navigate('/')
    } catch (err: any) {
      error(err.message || 'Quick login failed')
    } finally {
      setQuickLoading(null)
    }
  }

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center py-8 px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <ProgressIQLogo size="lg" layout="vertical" className="mb-2" />
          <h1 className={clsx("text-xl font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
            {mode === 'login' ? 'Sign in to PROGRESSIQ' : 'Create Authorized Account'}
          </h1>
          <p className="text-xs text-slate-400">
            Real-Time Multi-User Project Progress Intelligence Platform
          </p>
        </div>

        {/* 1-Click Multi-Device Demo Accounts Card */}
        <div className={clsx(
          "p-4 rounded-2xl border space-y-3 transition-all",
          isDark ? "bg-slate-900/90 border-slate-800" : "bg-white border-slate-200 shadow-sm"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-200">1-Click Test Accounts</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Instant Multi-User Test</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {TEST_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleQuickLogin(acc)}
                disabled={Boolean(quickLoading)}
                className={clsx(
                  "p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer",
                  isDark ? "bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 hover:border-blue-500/50" : "bg-slate-50 hover:bg-blue-50/50 border-slate-200 hover:border-blue-300"
                )}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-slate-200 truncate">{acc.name}</span>
                  {quickLoading === acc.email && <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />}
                </div>
                <span className="text-[10px] text-slate-400 truncate">{acc.email}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Credentials Form Card */}
        <div className={clsx(
          "p-6 rounded-2xl border space-y-5 transition-all",
          isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-sm"
        )}>
          {/* Tabs */}
          <div className="flex p-1 rounded-xl bg-slate-800/60 border border-slate-700/50 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={clsx(
                "flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer",
                mode === 'login' ? "bg-blue-600 text-white shadow-xs font-bold" : "text-slate-400 hover:text-white"
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={clsx(
                "flex-1 py-1.5 rounded-lg text-center transition-all cursor-pointer",
                mode === 'register' ? "bg-blue-600 text-white shadow-xs font-bold" : "text-slate-400 hover:text-white"
              )}
            >
              Register New
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1 block">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Amit Kumar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputField}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">Role *</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className={selectField}
                    >
                      <option value="project_manager">Project Manager</option>
                      <option value="site_engineer">Site Engineer</option>
                      <option value="planning_engineer">Planning Engineer</option>
                      <option value="enterprise_viewer">Enterprise Viewer</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1 block">Organization</label>
                    <input
                      type="text"
                      placeholder="e.g. Oil India Ltd"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      className={inputField}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-bold text-slate-300 mb-1 block">Email Address *</label>
              <input
                type="email"
                required
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputField}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 mb-1 block">Password *</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputField}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className={clsx(btnPrimary, "w-full py-2.5 justify-center mt-2")}
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : mode === 'login' ? (
                <>
                  Sign In to Dashboard
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  Create Account & Enter
                  <Sparkles className="w-4 h-4 ml-1 text-cyan-300" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
