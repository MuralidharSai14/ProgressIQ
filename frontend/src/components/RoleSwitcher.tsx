import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Building2, UserCheck, HardHat, FileCheck2 } from 'lucide-react'
import { useRole, type UserRole } from '../hooks/useRole'

const ROLES: { id: UserRole; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  {
    id: 'epc',
    label: 'EPC General Contractor',
    desc: 'Full project planning, schedule import & execution control',
    icon: <Building2 className="w-4 h-4 text-emerald-500" />,
    color: 'border-emerald-500/30 text-emerald-500',
  },
  {
    id: 'owner',
    label: 'Project Owner / Client',
    desc: 'Executive S-Curve, EVM indices & milestone acceptance',
    icon: <UserCheck className="w-4 h-4 text-indigo-500" />,
    color: 'border-indigo-500/30 text-indigo-500',
  },
  {
    id: 'subcontractor',
    label: 'Subcontractor / Trade Lead',
    desc: 'Field progress submissions & material logistics',
    icon: <HardHat className="w-4 h-4 text-amber-500" />,
    color: 'border-amber-500/30 text-amber-500',
  },
  {
    id: 'auditor',
    label: 'Quality & Safety Auditor',
    desc: 'Evidence verification & tamper-proof audit approval',
    icon: <FileCheck2 className="w-4 h-4 text-purple-500" />,
    color: 'border-purple-500/30 text-purple-500',
  },
]

export const RoleSwitcher: React.FC = () => {
  const { role, setRole } = useRole()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const activeRole = ROLES.find(r => r.id === role) || ROLES[0]

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all shadow-xs"
        title="Switch user perspective role"
      >
        <span className="flex items-center gap-1.5">
          {activeRole.icon}
          <span className="hidden md:inline">{activeRole.label}</span>
          <span className="md:hidden">Role: {role.toUpperCase()}</span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Simulate User Persona</p>
          </div>
          <div className="p-1 space-y-1">
            {ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setRole(r.id)
                  setOpen(false)
                }}
                className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                  role === r.id
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="mt-0.5">{r.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{r.label}</span>
                    {role === r.id && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-snug mt-0.5">{r.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
