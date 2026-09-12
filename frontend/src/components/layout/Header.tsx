/**
 * PROGRESSIQ — Enterprise Top Navigation Header
 * Contextual breadcrumbs, quick project switcher, role selector, global search trigger,
 * notification center, and system status indicator.
 */
import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import {
  Search, Bell, ChevronDown, Check, Plus, Play,
  Sun, Moon, Circle, Shield, User, Menu,
  Layers, ChevronRight, FolderKanban
} from 'lucide-react'
import clsx from 'clsx'
import { useProject } from '../../hooks/useProject'
import { useTheme } from '../../hooks/useTheme'
import { useRole, ROLES, type UserRole } from '../../hooks/useRole'
import { useAuth, TEST_ACCOUNTS } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import apiService from '../../services/api'
import { Modal, btnPrimary, btnSecondary, inputField } from '../ui'
import { Smartphone, LogIn, LogOut } from 'lucide-react'

const PAGE_NAMES: Record<string, string> = {
  '/': 'Overview & Executive KPIs',
  '/projects': 'Projects Directory',
  '/schedule': 'Schedule Baseline',
  '/reports': 'Field Reports & Updates',
  '/field-update': 'Live Mobile Field Update',
  '/login': 'User Authentication',
  '/extraction': 'AI Extraction Engine',
  '/matching': 'Activity Matching',
  '/evidence': 'Evidence Center',
  '/conflicts': 'Conflict Center',
  '/verification': 'Verification Queue',
  '/review': 'Match Review Queue',
  '/risks': 'Risk Intelligence',
  '/logistics': 'Material Logistics',
  '/worker-safety': 'Worker Safety & Hazards',
  '/audit': 'Audit Trail',
  '/analytics': 'Reports & Analytics',
  '/settings': 'System Settings',
}

export default function Header({
  onOpenSearch,
  onOpenNotifications,
  onToggleMobileSidebar,
  onOpenLiveUpdate,
}: {
  onOpenSearch: () => void
  onOpenNotifications: () => void
  onToggleMobileSidebar: () => void
  onOpenLiveUpdate?: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { projectId, projectName, setProject, backendOnline } = useProject()
  const { theme, toggleTheme } = useTheme()
  const { role, roleConfig, setRole } = useRole()
  const { user, isAuthenticated, logout, quickLoginAs } = useAuth()
  const { success, error } = useToast()
  const isDark = theme === 'dark'

  const [projects, setProjects] = useState<any[]>([])
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [showRoleMenu, setShowRoleMenu] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectOrg, setNewProjectOrg] = useState('')
  const [newProjectLoc, setNewProjectLoc] = useState('')
  const [creating, setCreating] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [alertCount, setAlertCount] = useState(0)

  const projectMenuRef = useRef<HTMLDivElement>(null)
  const roleMenuRef = useRef<HTMLDivElement>(null)

  // Fetch project list & notifications count
  const loadProjects = async () => {
    try {
      const data = await apiService.listProjects()
      setProjects(data || [])
    } catch { /* ignored */ }
  }

  const loadAlertsCount = async () => {
    if (!projectId) {
      setAlertCount(0)
      return
    }
    try {
      const [vData, cData] = await Promise.allSettled([
        apiService.getVerificationQueue(projectId, 'pending'),
        apiService.getConsistency(projectId),
      ])
      let count = 0
      if (vData.status === 'fulfilled') count += (vData.value?.tasks?.length || 0)
      if (cData.status === 'fulfilled') count += (cData.value?.conflict_count || cData.value?.conflicts?.length || 0)
      setAlertCount(count)
    } catch { /* ignored */ }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    loadAlertsCount()
  }, [projectId, location.pathname])

  // Close menus on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setShowProjectMenu(false)
      }
      if (roleMenuRef.current && !roleMenuRef.current.contains(e.target as Node)) {
        setShowRoleMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProjectName.trim()) return
    setCreating(true)
    try {
      const created = await apiService.createProject({
        name: newProjectName.trim(),
        organization: newProjectOrg.trim() || undefined,
        location: newProjectLoc.trim() || undefined,
      })
      success(`Project "${created.name}" created successfully.`)
      setProject(created.id, created.name)
      setShowCreateModal(false)
      setNewProjectName('')
      setNewProjectOrg('')
      setNewProjectLoc('')
      loadProjects()
    } catch (err: any) {
      error(err.message || 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const handleLoadDemo = async () => {
    setDemoLoading(true)
    try {
      const res = await apiService.loadDemo()
      if (res.success) {
        setProject(res.project_id, res.project_name)
        success(`Demo project loaded: ${res.project_name}`)
        loadProjects()
        setShowProjectMenu(false)
      }
    } catch (err: any) {
      error(err.message || 'Failed to load demo project')
    } finally {
      setDemoLoading(false)
    }
  }

  // Determine current page title
  let currentPageTitle = PAGE_NAMES[location.pathname]
  if (!currentPageTitle) {
    if (location.pathname.startsWith('/activity/')) {
      currentPageTitle = 'Activity Detail Workspace'
    } else {
      currentPageTitle = 'Project Management'
    }
  }

  return (
    <>
      <header
        className={clsx(
          "sticky top-0 z-30 h-14 border-b flex items-center justify-between px-4 sm:px-6 transition-colors backdrop-blur-md",
          isDark
            ? "bg-slate-950/85 border-slate-800/80 text-slate-200"
            : "bg-white/90 border-slate-200 text-slate-800 shadow-xs"
        )}
      >
        {/* Left: Mobile hamburger & Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleMobileSidebar}
            className={clsx(
              "md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer",
              isDark ? "hover:bg-slate-800" : "hover:bg-slate-100 hover:text-slate-900"
            )}
            title="Toggle navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumb path */}
          <nav className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
            <Link to="/projects" className="hover:text-blue-400 transition-colors flex items-center gap-1 shrink-0 font-medium">
              <FolderKanban className="w-3.5 h-3.5" />
              <span>Projects</span>
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
            <span className={clsx("font-semibold truncate max-w-[180px]", isDark ? "text-slate-300" : "text-slate-700")}>
              {projectName || 'No Project'}
            </span>
            <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
            <span className={clsx("font-bold truncate max-w-[220px]", isDark ? "text-white" : "text-slate-900")}>
              {currentPageTitle}
            </span>
          </nav>
        </div>

        {/* Right: Quick Tools, Project Switcher, Role, Search, Notifications, Theme */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Quick Project Switcher Dropdown */}
          <div className="relative" ref={projectMenuRef}>
            <button
              onClick={() => {
                setShowProjectMenu(!showProjectMenu)
                loadProjects()
              }}
              className={clsx(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer max-w-[190px] sm:max-w-[240px]",
                isDark
                  ? "bg-slate-900/90 border-slate-700/80 hover:border-slate-600 text-slate-200"
                  : "bg-slate-100 border-slate-300 hover:border-slate-400 text-slate-800"
              )}
            >
              <Layers className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="truncate">{projectName || 'Select Project'}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 shrink-0 ml-auto" />
            </button>

            {/* Dropdown Menu */}
            {showProjectMenu && (
              <div
                className={clsx(
                  "absolute right-0 mt-2 w-72 rounded-xl border shadow-2xl p-2 z-50 text-xs transition-all animate-in fade-in zoom-in-95 duration-150",
                  isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
                )}
              >
                <div className="px-2 py-1.5 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-800/50 mb-1 flex items-center justify-between">
                  <span>Switch Project</span>
                  <span>{projects.length} Total</span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1">
                  {projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setProject(p.id, p.name)
                        setShowProjectMenu(false)
                        navigate('/')
                      }}
                      className={clsx(
                        "w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer",
                        projectId === p.id
                          ? isDark
                            ? "bg-blue-600/20 text-blue-300 border border-blue-500/30 font-bold"
                            : "bg-blue-50 text-blue-900 border border-blue-200 font-bold"
                          : isDark
                            ? "hover:bg-slate-800 text-slate-300"
                            : "hover:bg-slate-100 text-slate-700"
                      )}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-semibold">{p.name}</p>
                          {p.is_demo && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-400 uppercase font-mono">Demo</span>
                          )}
                        </div>
                        <p className={clsx("text-[10px] truncate mt-0.5", isDark ? "text-slate-500" : "text-slate-400")}>
                          {p.organization || 'Infrastructure'} · {p.location || 'Site'}
                        </p>
                      </div>
                      {projectId === p.id && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                    </button>
                  ))}
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-col gap-1">
                  <button
                    onClick={() => {
                      setShowProjectMenu(false)
                      setShowCreateModal(true)
                    }}
                    className={clsx(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                      isDark ? "hover:bg-slate-800 text-blue-400" : "hover:bg-slate-100 text-blue-600"
                    )}
                  >
                    <Plus className="w-3.5 h-3.5" /> Create New Project
                  </button>
                  <button
                    onClick={handleLoadDemo}
                    disabled={demoLoading}
                    className={clsx(
                      "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                      isDark ? "hover:bg-slate-800 text-amber-400" : "hover:bg-slate-100 text-amber-600"
                    )}
                  >
                    <Play className="w-3.5 h-3.5" /> {demoLoading ? 'Loading Demo...' : 'Load Sample Demo'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Global Search Button */}
          <button
            onClick={onOpenSearch}
            className={clsx(
              "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer",
              isDark
                ? "bg-slate-900/90 border-slate-700/80 hover:border-slate-600 text-slate-300"
                : "bg-slate-100 border-slate-300 hover:border-slate-400 text-slate-700"
            )}
            title="Global Search (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden md:inline">Search...</span>
            <kbd className={clsx(
              "hidden md:inline px-1.5 py-0.5 text-[10px] rounded font-mono border",
              isDark ? "bg-slate-800 border-slate-700 text-slate-400" : "bg-slate-200 border-slate-300 text-slate-600"
            )}>
              ⌘K
            </kbd>
          </button>

          {/* Role Persona Switcher */}
          <div className="relative hidden lg:block" ref={roleMenuRef}>
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className={clsx(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                roleConfig.badgeColor
              )}
              title="Role Context View"
            >
              <Shield className="w-3 h-3" />
              <span>{roleConfig.label}</span>
              <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
            </button>

            {showRoleMenu && (
              <div
                className={clsx(
                  "absolute right-0 mt-2 w-64 rounded-xl border shadow-2xl p-2 z-50 text-xs transition-all animate-in fade-in duration-150",
                  isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
                )}
              >
                <p className="px-2 py-1 font-bold uppercase tracking-wider text-[10px] text-slate-400 border-b border-slate-800/50 mb-1">
                  Role Context
                </p>
                <div className="space-y-1">
                  {Object.values(ROLES).map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setRole(r.id as UserRole)
                        setShowRoleMenu(false)
                      }}
                      className={clsx(
                        "w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors cursor-pointer",
                        role === r.id
                          ? isDark ? "bg-blue-600/20 text-blue-300 font-bold" : "bg-blue-50 text-blue-900 font-bold"
                          : isDark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-700"
                      )}
                    >
                      <User className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{r.label}</p>
                        <p className={clsx("text-[10px] leading-tight mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
                          {r.description}
                        </p>
                      </div>
                      {role === r.id && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* + Live Field Update Quick Action Button */}
          {onOpenLiveUpdate && (
            <button
              onClick={onOpenLiveUpdate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer shrink-0"
              title="Submit Live Field Update from Mobile or Desktop"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">+ Live Update</span>
            </button>
          )}

          {/* User Profile & Auth Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={clsx(
                "flex items-center gap-1.5 p-1.5 sm:px-2 sm:py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                isDark ? "bg-slate-900 border-slate-700 text-slate-200" : "bg-slate-100 border-slate-300 text-slate-800"
              )}
              title={isAuthenticated ? `Logged in as ${user?.full_name}` : "Sign In"}
            >
              <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                {user?.full_name ? user.full_name[0].toUpperCase() : <User className="w-3 h-3" />}
              </div>
              <span className="hidden sm:inline truncate max-w-[100px]">{user?.full_name?.split(' ')[0] || 'Account'}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showUserMenu && (
              <div
                className={clsx(
                  "absolute right-0 mt-2 w-64 rounded-xl border shadow-2xl p-2 z-50 text-xs transition-all animate-in fade-in duration-150",
                  isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-900"
                )}
              >
                {isAuthenticated && user ? (
                  <>
                    <div className="p-2 border-b border-slate-800/60 mb-1">
                      <p className="font-bold text-xs text-white truncate">{user.full_name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                      <span className="inline-block mt-1 text-[9px] px-1.5 py-0.2 rounded font-mono uppercase bg-blue-500/20 text-blue-300">
                        {user.role.replace('_', ' ')}
                      </span>
                    </div>

                    <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Switch Test User
                    </p>
                    <div className="space-y-1 mb-2">
                      {TEST_ACCOUNTS.map((acc) => (
                        <button
                          key={acc.email}
                          onClick={async () => {
                            await quickLoginAs(acc.email, acc.password)
                            setShowUserMenu(false)
                          }}
                          className={clsx(
                            "w-full text-left px-2 py-1.5 rounded-lg text-[11px] flex items-center justify-between cursor-pointer",
                            user.email === acc.email
                              ? "bg-blue-600/20 text-blue-300 font-bold"
                              : isDark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-700"
                          )}
                        >
                          <span className="truncate">{acc.name}</span>
                          {user.email === acc.email && <Check className="w-3 h-3 text-blue-400 shrink-0" />}
                        </button>
                      ))}
                    </div>

                    <div className="pt-1 border-t border-slate-800/60">
                      <button
                        onClick={() => {
                          logout()
                          setShowUserMenu(false)
                          navigate('/login')
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer font-semibold text-xs"
                      >
                        <LogOut className="w-3.5 h-3.5" /> Sign Out
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-2 space-y-2">
                    <p className="text-xs text-slate-300 font-semibold">Sign in to collaborate on live projects</p>
                    <button
                      onClick={() => {
                        setShowUserMenu(false)
                        navigate('/login')
                      }}
                      className={clsx(btnPrimary, "w-full justify-center py-1.5 text-xs")}
                    >
                      <LogIn className="w-3.5 h-3.5" /> Sign In / Register
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notifications Trigger */}
          <button
            onClick={onOpenNotifications}
            className={clsx(
              "relative p-2 rounded-lg border text-slate-400 hover:text-white transition-all cursor-pointer",
              isDark
                ? "bg-slate-900/90 border-slate-700/80 hover:border-slate-600"
                : "bg-slate-100 border-slate-300 hover:border-slate-400 hover:text-slate-900"
            )}
            title="View alerts & verification tasks"
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse shadow-sm">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className={clsx(
              "p-2 rounded-lg border text-slate-400 hover:text-white transition-all cursor-pointer",
              isDark
                ? "bg-slate-900/90 border-slate-700/80 hover:border-slate-600 text-amber-300"
                : "bg-slate-100 border-slate-300 hover:border-slate-400 text-slate-700"
            )}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>

          {/* Backend Status Pill */}
          <div
            className={clsx(
              "hidden xl:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold",
              backendOnline
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/20 text-rose-400"
            )}
            title={backendOnline ? 'FastAPI Backend connected' : 'Backend unavailable'}
          >
            <Circle className="w-2 h-2 fill-current" />
            <span>{backendOnline ? 'Online' : 'Offline'}</span>
          </div>
        </div>
      </header>

      {/* Create Project Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Project"
        subtitle="Initialize a new infrastructure or EPC project in PROGRESSIQ"
      >
        <form onSubmit={handleCreateProject} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Project Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Indravati Pumping Station Expansion"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              className={inputField}
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Organization / Client</label>
            <input
              type="text"
              placeholder="e.g. Oil India Ltd / EPC Division"
              value={newProjectOrg}
              onChange={e => setNewProjectOrg(e.target.value)}
              className={inputField}
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Location / Site Code</label>
            <input
              type="text"
              placeholder="e.g. Duliajan Site, Assam"
              value={newProjectLoc}
              onChange={e => setNewProjectLoc(e.target.value)}
              className={inputField}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className={btnSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !newProjectName.trim()}
              className={btnPrimary}
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  )
}
