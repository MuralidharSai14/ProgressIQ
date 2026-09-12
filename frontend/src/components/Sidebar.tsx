/**
 * PROGRESSIQ — Sidebar Layout Component
 * The permanent left navigation panel.
 */
import { NavLink } from 'react-router-dom'
import clsx from 'clsx'
import {
  LayoutDashboard, Calendar, FileText, Cpu, Link2,
  ShieldAlert, ClipboardCheck, BarChart3, Settings,
  Zap, ChevronRight, Circle
} from 'lucide-react'
import { useProject } from '../hooks/useProject'

const NAV_ITEMS = [
  { path: '/',            icon: LayoutDashboard, label: 'Overview',          group: 'main' },
  { path: '/schedule',   icon: Calendar,         label: 'Schedule',           group: 'main' },
  { path: '/reports',    icon: FileText,          label: 'Field Updates',      group: 'main' },
  { path: '/extraction', icon: Cpu,               label: 'AI Extraction',      group: 'ai' },
  { path: '/matching',   icon: Link2,             label: 'Activity Matching',  group: 'ai' },
  { path: '/risks',      icon: ShieldAlert,       label: 'Risk Intelligence',  group: 'ai' },
  { path: '/review',     icon: ClipboardCheck,    label: 'Review Queue',       group: 'review' },
  { path: '/analytics',  icon: BarChart3,         label: 'Reports',            group: 'reports' },
  { path: '/settings',   icon: Settings,          label: 'Settings',           group: 'settings' },
]

const GROUP_LABELS: Record<string, string> = {
  main: 'PROJECT',
  ai: 'AI INTELLIGENCE',
  review: 'HUMAN REVIEW',
  reports: 'REPORTS',
  settings: 'SYSTEM',
}

export default function Sidebar() {
  const { projectName, projectId, backendOnline } = useProject()

  const groups = ['main', 'ai', 'review', 'reports', 'settings']

  return (
    <aside className="w-64 shrink-0 bg-slate-900/80 border-r border-slate-700/50 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700/50">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 bg-cyan-600/20 border border-cyan-500/40 rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-none">PROGRESSIQ</h1>
            <p className="text-cyan-500/70 text-[9px] uppercase tracking-widest font-medium mt-0.5">
              Project Intelligence
            </p>
          </div>
        </div>
      </div>

      {/* Backend status */}
      <div className="px-4 py-2 border-b border-slate-700/30">
        <div className="flex items-center gap-2 text-xs">
          <Circle
            className={clsx('w-2 h-2 fill-current', backendOnline ? 'text-green-400' : 'text-red-400')}
          />
          <span className={backendOnline ? 'text-green-400' : 'text-red-400'}>
            {backendOnline ? 'Backend Online' : 'Backend Offline'}
          </span>
        </div>
      </div>

      {/* Project indicator */}
      {projectId && (
        <div className="px-4 py-2.5 border-b border-slate-700/30 bg-cyan-500/5">
          <p className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Active Project</p>
          <p className="text-cyan-300 text-xs font-medium truncate">{projectName}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
        {groups.map(group => {
          const items = NAV_ITEMS.filter(i => i.group === group)
          return (
            <div key={group}>
              <p className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider px-2 mb-1">
                {GROUP_LABELS[group]}
              </p>
              {items.map(({ path, icon: Icon, label }) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === '/'}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 group',
                      isActive
                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={clsx('w-4 h-4 shrink-0', isActive ? 'text-cyan-400' : '')} />
                      <span className="flex-1">{label}</span>
                      {isActive && <ChevronRight className="w-3 h-3 text-cyan-500/50" />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-700/30">
        <p className="text-[9px] text-slate-600 text-center">
          SIH 2026 — Problem #26122 — Oil India Ltd
        </p>
        <p className="text-[9px] text-slate-700 text-center mt-0.5">v1.0.0 MVP</p>
      </div>
    </aside>
  )
}
