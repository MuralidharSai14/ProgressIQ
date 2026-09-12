import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type UserRole = 
  | 'project_manager'
  | 'site_engineer'
  | 'planning_engineer'
  | 'project_controls'
  | 'enterprise_viewer'

export interface RoleConfig {
  id: UserRole
  label: string
  shortLabel: string
  badgeColor: string
  description: string
}

export const ROLES: Record<UserRole, RoleConfig> = {
  project_manager: {
    id: 'project_manager',
    label: 'Project Manager',
    shortLabel: 'PM',
    badgeColor: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
    description: 'Executive view — Overall progress, variance, risks, and human verification',
  },
  site_engineer: {
    id: 'site_engineer',
    label: 'Site Engineer',
    shortLabel: 'Site',
    badgeColor: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    description: 'Field operations — Field updates, daily logs, evidence upload, safety risks',
  },
  planning_engineer: {
    id: 'planning_engineer',
    label: 'Planning Engineer',
    shortLabel: 'Planning',
    badgeColor: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    description: 'Schedule management — WBS L1-L6, baseline tracking, semantic matching',
  },
  project_controls: {
    id: 'project_controls',
    label: 'Project Controls',
    shortLabel: 'Controls',
    badgeColor: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    description: 'Controls & Audit — Consistency analysis, conflict tracking, audit trails',
  },
  enterprise_viewer: {
    id: 'enterprise_viewer',
    label: 'Enterprise Management',
    shortLabel: 'Viewer',
    badgeColor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    description: 'Executive dashboard — Read-only project health, KPI summaries, and reports',
  },
}

interface RoleContextType {
  role: UserRole
  roleConfig: RoleConfig
  setRole: (role: UserRole) => void
}

const RoleContext = createContext<RoleContextType>({
  role: 'project_manager',
  roleConfig: ROLES.project_manager,
  setRole: () => {},
})

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem('progressiq_role') as UserRole
    return (saved && ROLES[saved]) ? saved : 'project_manager'
  })

  useEffect(() => {
    localStorage.setItem('progressiq_role', role)
  }, [role])

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole)
  }

  return (
    <RoleContext.Provider value={{ role, roleConfig: ROLES[role], setRole }}>
      {children}
    </RoleContext.Provider>
  )
}

export const useRole = () => useContext(RoleContext)
