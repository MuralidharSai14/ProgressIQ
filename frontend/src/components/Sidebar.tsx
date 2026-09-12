/**
 * PROGRESSIQ — Enterprise Sidebar Navigation
 * Structured navigation with grouped modules, active indicators, and mobile drawer support.
 */
import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import {
  LayoutDashboard, Calendar, FileText, Cpu, Link2,
  Database, AlertTriangle, ShieldCheck, ClipboardCheck,
  Package, HardHat, ShieldAlert, ScrollText,
  BarChart3, Settings, ChevronRight, X,
  FolderKanban, PlusCircle, User, LogOut
} from 'lucide-react'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useRole } from '../hooks/useRole'
import { useAuth } from '../hooks/useAuth'
import ProgressIQLogo from './ProgressIQLogo'

interface NavItem {
  path: string
  icon: React.ElementType
  label: string
  group: 'baseline' | 'field_ai' | 'verification' | 'operations' | 'intelligence'
  highlightForRoles?: string[]
}

const NAV_ITEMS: NavItem[] = [
  // Baseline
  { path: '/', icon: LayoutDashboard, label: 'Overview', group: 'baseline', highlightForRoles: ['project_manager', 'enterprise_viewer'] },
  { path: '/projects', icon: FolderKanban, label: 'Projects', group: 'baseline' },
  { path: '/schedule', icon: Calendar, label: 'Schedule Baseline', group: 'baseline', highlightForRoles: ['planning_engineer'] },

  // Field & AI
  { path: '/reports', icon: FileText, label: 'Field Updates', group: 'field_ai', highlightForRoles: ['site_engineer'] },
  { path: '/extraction', icon: Cpu, label: 'AI Extraction', group: 'field_ai' },
  { path: '/matching', icon: Link2, label: 'Activity Matching', group: 'field_ai', highlightForRoles: ['planning_engineer'] },

  // Verification & Evidence
  { path: '/evidence', icon: Database, label: 'Evidence Center', group: 'verification', highlightForRoles: ['site_engineer'] },
  { path: '/conflicts', icon: AlertTriangle, label: 'Conflict Center', group: 'verification', highlightForRoles: ['project_controls'] },
  { path: '/verification', icon: ShieldCheck, label: 'Verification Queue', group: 'verification', highlightForRoles: ['project_manager'] },
  { path: '/review', icon: ClipboardCheck, label: 'Match Review', group: 'verification' },

  // Operations & Safety
  { path: '/logistics', icon: Package, label: 'Material Logistics', group: 'operations', highlightForRoles: ['site_engineer'] },
  { path: '/worker-safety', icon: HardHat, label: 'Worker Safety', group: 'operations', highlightForRoles: ['site_engineer'] },
  { path: '/risks', icon: ShieldAlert, label: 'Risks & Delays', group: 'operations', highlightForRoles: ['project_manager'] },
  { path: '/audit', icon: ScrollText, label: 'Audit Trail', group: 'operations', highlightForRoles: ['project_controls'] },

  // Intelligence
  { path: '/analytics', icon: BarChart3, label: 'Analytics & Reports', group: 'intelligence', highlightForRoles: ['enterprise_viewer', 'project_manager'] },
  { path: '/settings', icon: Settings, label: 'Settings', group: 'intelligence' },
]

const GROUP_LABELS: Record<string, string> = {
  baseline: 'SCHEDULE BASELINE',
  field_ai: 'FIELD & AI ENGINE',
  verification: 'EVIDENCE & VERIFICATION',
  operations: 'OPERATIONS & RISK',
  intelligence: 'INTELLIGENCE & SYSTEM',
}

export default function Sidebar({
  isMobileOpen,
  onCloseMobile,
  onOpenLiveUpdate,
}: {
  isMobileOpen?: boolean
  onCloseMobile?: () => void
  onOpenLiveUpdate?: () => void
}) {
  const { projectName, projectId } = useProject()
  const { theme } = useTheme()
  const { role } = useRole()
  const { user, isAuthenticated, logout } = useAuth()
  const isDark = theme === 'dark'

  const groups: Array<'baseline' | 'field_ai' | 'verification' | 'operations' | 'intelligence'> = [
    'baseline',
    'field_ai',
    'verification',
    'operations',
    'intelligence',
  ]

  const sidebarContent = (
    <aside
      className={clsx(
        "w-64 shrink-0 flex flex-col h-screen sticky top-0 transition-colors duration-150 border-r select-none",
        isDark
          ? "bg-slate-950/95 border-slate-800/90 text-slate-200"
          : "bg-white border-slate-200 text-slate-800 shadow-xs"
      )}
    >
      {/* Brand Header */}
      <div className={clsx("px-4 py-4 border-b flex items-center justify-between", isDark ? "border-slate-800" : "border-slate-100")}>
        <NavLink to="/" className="hover:opacity-90 transition-opacity">
          <ProgressIQLogo size="md" />
        </NavLink>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className={clsx(
              "md:hidden p-1.5 rounded-lg transition-colors cursor-pointer",
              isDark ? "text-slate-400 hover:text-white" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Active Project Indicator Card & Action */}
      <div className="px-3 pt-3 space-y-2">
        {projectId ? (
          <div className={clsx(
            "px-3 py-2 rounded-xl border flex items-center gap-2.5 transition-colors",
            isDark ? "bg-slate-900/90 border-slate-800 text-slate-300" : "bg-blue-50/70 border-blue-200 text-blue-950"
          )}>
            <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] uppercase font-bold tracking-wider text-slate-400 leading-none">Active Project</p>
              <p className="text-xs font-bold truncate mt-0.5">{projectName}</p>
            </div>
          </div>
        ) : (
          <div className={clsx(
            "px-3 py-2 rounded-xl border flex items-center gap-2.5 text-xs",
            isDark ? "bg-slate-900/60 border-slate-800 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600"
          )}>
            <span className="text-amber-400 text-xs">●</span>
            <span className="text-[11px] font-medium">No Project Activated</span>
          </div>
        )}

        {/* Mobile & Quick Live Update Action Button */}
        {onOpenLiveUpdate && (
          <button
            onClick={() => {
              onCloseMobile?.()
              onOpenLiveUpdate()
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-[0.98] transition-all cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+ Live Field Update</span>
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
        {groups.map(group => {
          const items = NAV_ITEMS.filter(i => i.group === group)
          return (
            <div key={group} className="space-y-0.5">
              <p className={clsx(
                "text-[9px] font-bold uppercase tracking-wider px-2.5 mb-1",
                isDark ? "text-slate-500" : "text-slate-400"
              )}>
                {GROUP_LABELS[group]}
              </p>
              {items.map(({ path, icon: Icon, label, highlightForRoles }) => {
                const isRoleHighlighted = highlightForRoles?.includes(role)
                return (
                  <NavLink
                    key={path}
                    to={path}
                    end={path === '/'}
                    onClick={() => onCloseMobile?.()}
                    className={({ isActive }) =>
                      clsx(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-150 relative group',
                        isActive
                          ? isDark
                            ? 'bg-blue-600 text-white shadow-xs font-bold'
                            : 'bg-blue-600 text-white shadow-xs font-bold'
                          : isDark
                            ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100',
                        !isActive && isRoleHighlighted && (isDark ? 'text-slate-200 bg-slate-900/40' : 'text-slate-800 bg-slate-50')
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={clsx('w-4 h-4 shrink-0', isActive ? 'text-white' : isRoleHighlighted ? 'text-blue-400' : 'text-slate-400')} />
                        <span className="flex-1 truncate">{label}</span>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/70" />}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </div>
          )
        })}
      </nav>

      {/* User Session Bar */}
      <div className={clsx("p-2.5 border-t", isDark ? "border-slate-800/80 bg-slate-950" : "border-slate-200 bg-slate-50/50")}>
        {isAuthenticated && user ? (
          <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-xs shrink-0">
                {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate text-slate-200 leading-tight">{user.full_name}</p>
                <span className="inline-block text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-blue-300 capitalize">
                  {user.role?.replace('_', ' ')}
                </span>
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <NavLink
            to="/login"
            onClick={() => onCloseMobile?.()}
            className="flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg border border-slate-700 hover:border-slate-600 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            <span>Sign In / Switch Role</span>
          </NavLink>
        )}
      </div>

      {/* Footer Branding */}
      <div className={clsx("px-4 py-2 border-t text-center text-[10px]", isDark ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-400")}>
        <div className="flex items-center justify-center gap-1 font-semibold text-slate-400">
          <HardHat className="w-3 h-3 text-amber-500" />
          <span>SIH 2026 · Problem #26122</span>
        </div>
      </div>
    </aside>
  )

  // Mobile Drawer Wrapper
  if (isMobileOpen) {
    return (
      <div className="fixed inset-0 z-50 flex md:hidden bg-slate-950/80 backdrop-blur-xs">
        <div className="relative flex-1 max-w-xs">{sidebarContent}</div>
        <div className="flex-1" onClick={onCloseMobile} />
      </div>
    )
  }

  return <div className="hidden md:block">{sidebarContent}</div>
}
