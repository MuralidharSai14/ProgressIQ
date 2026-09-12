import React, { createContext, useContext, useState } from 'react'

export type UserRole = 'epc' | 'owner' | 'subcontractor' | 'auditor'

export interface RolePermissions {
  canUploadSchedule: boolean
  canApproveVerification: boolean
  canUploadEvidence: boolean
  canEditMaterials: boolean
  canSignOffMilestones: boolean
  canCreateProject: boolean
  roleLabel: string
  roleDescription: string
  badgeColor: string
}

export const ROLE_DEFINITIONS: Record<UserRole, RolePermissions> = {
  epc: {
    canUploadSchedule: true,
    canApproveVerification: true,
    canUploadEvidence: true,
    canEditMaterials: true,
    canSignOffMilestones: false,
    canCreateProject: true,
    roleLabel: 'EPC General Contractor',
    roleDescription: 'Full operations, schedule management, contractor oversight & field verification',
    badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  owner: {
    canUploadSchedule: false,
    canApproveVerification: true,
    canUploadEvidence: true,
    canEditMaterials: false,
    canSignOffMilestones: true,
    canCreateProject: true,
    roleLabel: 'Project Owner / Client',
    roleDescription: 'Executive oversight, EVM S-Curve controls & final milestone sign-off',
    badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  },
  subcontractor: {
    canUploadSchedule: false,
    canApproveVerification: false,
    canUploadEvidence: true,
    canEditMaterials: true,
    canSignOffMilestones: false,
    canCreateProject: false,
    roleLabel: 'Subcontractor / Trade Lead',
    roleDescription: 'Site execution, live field updates & material delivery logs',
    badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  auditor: {
    canUploadSchedule: false,
    canApproveVerification: true,
    canUploadEvidence: true,
    canEditMaterials: false,
    canSignOffMilestones: true,
    canCreateProject: false,
    roleLabel: 'Quality & Safety Auditor',
    roleDescription: 'Independent inspection, tamper-proof evidence verification & dispute escalation',
    badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  },
}

export const ROLES: Record<UserRole, { id: UserRole; label: string; description: string; badge: string; color: string; badgeColor: string }> = {
  epc: {
    id: 'epc',
    label: 'EPC General Contractor',
    description: 'Full operations, schedule management, contractor oversight & field verification',
    badge: 'EPC Lead',
    color: 'emerald',
    badgeColor: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  owner: {
    id: 'owner',
    label: 'Project Owner / Client',
    description: 'Executive oversight, EVM S-Curve controls & final milestone sign-off',
    badge: 'Owner/Client',
    color: 'indigo',
    badgeColor: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  },
  subcontractor: {
    id: 'subcontractor',
    label: 'Subcontractor / Trade Lead',
    description: 'Site execution, live field updates & material delivery logs',
    badge: 'Trade Lead',
    color: 'amber',
    badgeColor: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  auditor: {
    id: 'auditor',
    label: 'Quality & Safety Auditor',
    description: 'Independent inspection, tamper-proof evidence verification & dispute escalation',
    badge: 'Auditor',
    color: 'purple',
    badgeColor: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
  },
}

export interface RoleContextType {
  role: UserRole
  roleConfig: typeof ROLES[UserRole]
  setRole: (role: UserRole) => void
  permissions: RolePermissions
  canVerify: boolean
  canEdit: boolean
  canView: boolean
}

const RoleContext = createContext<RoleContextType | undefined>(undefined)

export const RoleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem('progressiq_active_role')
    return (saved as UserRole) || 'epc'
  })

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole)
    localStorage.setItem('progressiq_active_role', newRole)
  }

  const permissions = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.epc
  const roleConfig = ROLES[role] || ROLES.epc

  return (
    <RoleContext.Provider
      value={{
        role,
        roleConfig,
        setRole,
        permissions,
        canVerify: permissions.canApproveVerification,
        canEdit: permissions.canUploadSchedule || permissions.canEditMaterials,
        canView: true,
      }}
    >
      {children}
    </RoleContext.Provider>
  )
}

export const useRole = () => {
  const context = useContext(RoleContext)
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider')
  }
  return context
}
