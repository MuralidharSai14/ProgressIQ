/**
 * PROGRESSIQ — Enterprise UI Component System
 * Clean, data-driven, production-grade components with Dark & Light theme support.
 */
import React, { useEffect } from 'react'
import {
  Loader2, AlertCircle, CheckCircle2, Info, AlertTriangle,
  X
} from 'lucide-react'
import clsx from 'clsx'
import { useTheme } from '../hooks/useTheme'

// ── Standard Class Utilities ───────────────────────────────────────────────────

export const btnPrimary = 
  "inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"

export const btnSecondary = 
  "inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 active:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs font-semibold shadow-xs transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-800/80 dark:hover:bg-slate-700/80 dark:border-slate-700 light:bg-slate-100 light:hover:bg-slate-200 light:text-slate-800 light:border-slate-300"

export const btnOutline = 
  "inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-transparent hover:bg-slate-800/50 text-slate-300 border border-slate-700 text-xs font-semibold transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700 light:hover:bg-slate-100 light:text-slate-700 light:border-slate-300"

export const btnDanger = 
  "inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"

export const btnSuccess = 
  "inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"

export const btnGhost = 
  "inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 text-xs font-medium transition-all duration-150 cursor-pointer dark:hover:bg-slate-800/80 dark:hover:text-white light:text-slate-600 light:hover:bg-slate-100 light:hover:text-slate-900"

export const inputField = 
  "w-full px-3 py-2 rounded-lg border text-xs transition-all outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-slate-900/90 border-slate-700 text-slate-100 placeholder:text-slate-500 dark:bg-slate-900/90 dark:border-slate-700 dark:text-slate-100 light:bg-white light:border-slate-300 light:text-slate-900 light:placeholder:text-slate-400"

export const selectField = 
  "px-3 py-2 rounded-lg border text-xs transition-all outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 bg-slate-900/90 border-slate-700 text-slate-100 cursor-pointer dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100 light:bg-white light:border-slate-300 light:text-slate-800"

// ── Page Header ───────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string
  subtitle?: string
  badge?: React.ReactNode
  children?: React.ReactNode
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className={clsx(
      "flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b transition-colors",
      isDark ? "border-slate-800" : "border-slate-200"
    )}>
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className={clsx("text-xl font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
            {title}
          </h1>
          {badge}
        </div>
        {subtitle && (
          <p className={clsx("text-xs leading-relaxed max-w-3xl", isDark ? "text-slate-400" : "text-slate-600")}>
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Badges ────────────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const s = (status || 'not_started').toLowerCase().replace(/\s+/g, '_')
  
  const map: Record<string, { cls: string; label: string; dot: string }> = {
    on_track: {
      cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      label: 'On Track',
      dot: 'bg-emerald-400',
    },
    completed: {
      cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      label: 'Completed',
      dot: 'bg-emerald-400',
    },
    in_progress: {
      cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      label: 'In Progress',
      dot: 'bg-blue-400 animate-pulse',
    },
    active: {
      cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      label: 'Active',
      dot: 'bg-blue-400',
    },
    at_risk: {
      cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      label: 'At Risk',
      dot: 'bg-amber-400',
    },
    delayed: {
      cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      label: 'Delayed',
      dot: 'bg-rose-400',
    },
    critical: {
      cls: 'bg-rose-500/15 text-rose-400 border-rose-500/40',
      label: 'Critical Delay',
      dot: 'bg-rose-500',
    },
    not_started: {
      cls: 'bg-slate-500/10 text-slate-400 border-slate-600/30',
      label: 'Not Started',
      dot: 'bg-slate-400',
    },
    approved: {
      cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      label: 'Approved',
      dot: 'bg-emerald-400',
    },
    needs_review: {
      cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      label: 'Needs Review',
      dot: 'bg-amber-400',
    },
    rejected: {
      cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      label: 'Rejected',
      dot: 'bg-rose-400',
    },
    pending: {
      cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
      label: 'Pending',
      dot: 'bg-slate-400',
    },
  }

  const conf = map[s] || {
    cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
    label: status,
    dot: 'bg-slate-400',
  }

  return (
    <span className={clsx('inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border', conf.cls)}>
      <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', conf.dot)} />
      <span>{conf.label}</span>
    </span>
  )
}

export function HealthBadge({ health }: { health: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    on_track: { cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', label: '✓ On Track' },
    at_risk: { cls: 'text-amber-400 bg-amber-500/10 border-amber-500/30', label: '⚠ At Risk' },
    delayed: { cls: 'text-orange-400 bg-orange-500/10 border-orange-500/30', label: '↓ Delayed' },
    critical: { cls: 'text-rose-400 bg-rose-500/15 border-rose-500/40 font-black', label: '✕ Critical' },
    unknown: { cls: 'text-slate-400 bg-slate-500/10 border-slate-500/30', label: '— Unknown' },
  }
  const config = map[health] || map['unknown']
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border', config.cls)}>
      {config.label}
    </span>
  )
}

export function RiskBadge({ level }: { level: string }) {
  const l = (level || 'low').toLowerCase()
  const map: Record<string, string> = {
    critical: 'bg-rose-500/15 text-rose-400 border-rose-500/30 font-bold',
    high: 'bg-orange-500/15 text-orange-400 border-orange-500/30 font-bold',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-semibold',
    low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold',
  }
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border', map[l] || map.low)}>
      {l} Risk
    </span>
  )
}

export function PriorityBadge({ priority }: { priority: string }) {
  const p = (priority || 'medium').toLowerCase()
  const map: Record<string, string> = {
    critical: 'text-rose-400 bg-rose-500/15 border-rose-500/30 font-bold',
    high: 'text-orange-400 bg-orange-500/15 border-orange-500/30 font-bold',
    medium: 'text-amber-400 bg-amber-500/15 border-amber-500/30 font-semibold',
    low: 'text-slate-400 bg-slate-500/15 border-slate-500/30 font-medium',
  }
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wider border', map[p] || map.medium)}>
      {p} Priority
    </span>
  )
}

export function ConfidenceBadge({ label, score }: { label?: string | null; score?: number | null }) {
  const l = (label || (score != null ? (score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low') : 'low')).toLowerCase()
  const colors: Record<string, string> = {
    high: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    low: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  }
  return (
    <span className={clsx('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider', colors[l] || colors.low)}>
      <span>{l} Confidence</span>
      {score != null && <span className="font-mono opacity-80">· {score.toFixed(0)}%</span>}
    </span>
  )
}

export function EvidenceBadge({ type }: { type: string }) {
  const map: Record<string, { label: string; color: string }> = {
    photo: { label: '📷 Photo Evidence', color: 'text-purple-300 bg-purple-500/10 border-purple-500/30' },
    material_record: { label: '📦 Material Log', color: 'text-blue-300 bg-blue-500/10 border-blue-500/30' },
    equipment_record: { label: '⚙ Equipment Record', color: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30' },
    document: { label: '📄 Inspection Doc', color: 'text-slate-300 bg-slate-500/10 border-slate-500/30' },
  }
  const info = map[type] || { label: type, color: 'text-slate-300 bg-slate-700/50 border-slate-600' }
  return (
    <span className={clsx('text-[10px] font-semibold px-2 py-0.5 rounded border', info.color)}>
      {info.label}
    </span>
  )
}

export function ConflictBadge({ severity }: { severity: string }) {
  const s = (severity || 'medium').toLowerCase()
  const colors: Record<string, string> = {
    critical: 'text-rose-300 bg-rose-500/20 border-rose-500/40 font-bold',
    high: 'text-orange-300 bg-orange-500/20 border-orange-500/40 font-semibold',
    medium: 'text-amber-300 bg-amber-500/20 border-amber-500/40',
    low: 'text-blue-300 bg-blue-500/20 border-blue-500/40',
  }
  return (
    <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider', colors[s] || colors.medium)}>
      ⚠ {s} Discrepancy
    </span>
  )
}

export function DemoLabel() {
  return (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/40 uppercase tracking-wider">
      DEMO
    </span>
  )
}

// ── Metric / Stat Card ────────────────────────────────────────────────────────

interface StatCardProps {
  title: string
  value: string | number
  unit?: string
  color?: 'emerald' | 'rose' | 'amber' | 'blue' | 'purple' | 'slate' | 'white' | 'green' | 'red' | 'yellow' | 'cyan'
  icon?: React.ReactNode
  subtitle?: string
  trend?: { value: string; isPositive?: boolean }
  tooltip?: string
  loading?: boolean
}

export function StatCard({
  title,
  value,
  unit,
  color = 'white',
  icon,
  subtitle,
  trend,
  loading = false,
}: StatCardProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    green: 'text-emerald-400',
    rose: 'text-rose-400',
    red: 'text-rose-400',
    amber: 'text-amber-400',
    yellow: 'text-amber-400',
    blue: 'text-blue-400',
    cyan: 'text-cyan-400',
    purple: 'text-purple-400',
    slate: isDark ? 'text-slate-300' : 'text-slate-700',
    white: isDark ? 'text-white' : 'text-slate-900',
  }

  if (loading) {
    return (
      <div className={clsx(
        "rounded-xl p-4 border transition-all animate-pulse",
        isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200"
      )}>
        <div className="h-3 bg-slate-700/50 rounded w-24 mb-3" />
        <div className="h-7 bg-slate-700/50 rounded w-16 mb-2" />
        <div className="h-2.5 bg-slate-700/40 rounded w-32" />
      </div>
    )
  }

  return (
    <div className={clsx(
      "rounded-xl p-4 border transition-all duration-150 shadow-xs flex flex-col justify-between group",
      isDark
        ? "bg-slate-900/70 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900"
        : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm"
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className={clsx("text-[11px] font-semibold uppercase tracking-wider truncate", isDark ? "text-slate-400" : "text-slate-500")}>
          {title}
        </span>
        {icon && (
          <div className={clsx("shrink-0 p-1.5 rounded-lg", isDark ? "bg-slate-800/80 text-slate-400" : "bg-slate-100 text-slate-600")}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1 mt-0.5">
        <span className={clsx("text-2xl font-bold tracking-tight font-sans", colorMap[color] || colorMap.white)}>
          {value}
        </span>
        {unit && <span className={clsx("text-xs font-medium", isDark ? "text-slate-400" : "text-slate-500")}>{unit}</span>}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        {subtitle && (
          <p className={clsx("text-[11px] font-medium truncate", isDark ? "text-slate-400" : "text-slate-500")}>
            {subtitle}
          </p>
        )}
        {trend && (
          <span className={clsx(
            "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0",
            trend.isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
          )}>
            {trend.value}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Progress Bars ─────────────────────────────────────────────────────────────

export function ProgressBar({
  planned,
  actual,
  showLabels = true,
}: {
  planned: number
  actual: number
  showLabels?: boolean
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className="space-y-1.5">
      {showLabels && (
        <div className="flex justify-between text-xs font-semibold">
          <span className={isDark ? "text-slate-400" : "text-slate-600"}>Planned: {planned.toFixed(1)}%</span>
          <span className={actual >= planned ? "text-emerald-400" : actual >= planned - 10 ? "text-amber-400" : "text-rose-400"}>
            Actual: {actual.toFixed(1)}%
          </span>
        </div>
      )}
      <div className={clsx("relative h-2 rounded-full overflow-hidden", isDark ? "bg-slate-800" : "bg-slate-200")}>
        {/* Planned target marker/bar */}
        <div
          className="absolute top-0 left-0 h-full bg-slate-500/40 rounded-full"
          style={{ width: `${Math.min(100, planned)}%` }}
        />
        {/* Actual progress */}
        <div
          className={clsx(
            "absolute top-0 left-0 h-full rounded-full transition-all duration-500",
            actual >= planned
              ? "bg-emerald-500"
              : actual >= planned - 10
              ? "bg-amber-500"
              : "bg-rose-500"
          )}
          style={{ width: `${Math.min(100, actual)}%` }}
        />
      </div>
    </div>
  )
}

export function TripleProgressBar({
  planned,
  reported,
  evidenceSupported,
}: {
  planned: number
  reported: number
  evidenceSupported?: number | null
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className={clsx(
      "p-4 rounded-xl border space-y-3.5",
      isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50/80 border-slate-200"
    )}>
      {/* 1. Planned */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-semibold">
          <span className={clsx("flex items-center gap-1.5", isDark ? "text-slate-300" : "text-slate-700")}>
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-500 inline-block" />
            1. Planned Schedule Baseline
          </span>
          <span className={clsx("font-mono font-bold", isDark ? "text-white" : "text-slate-900")}>
            {planned?.toFixed(1)}%
          </span>
        </div>
        <div className={clsx("h-2 rounded-full overflow-hidden", isDark ? "bg-slate-800" : "bg-slate-200")}>
          <div className="h-full bg-slate-500 rounded-full" style={{ width: `${Math.min(100, planned || 0)}%` }} />
        </div>
      </div>

      {/* 2. Reported */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-blue-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
            2. Reported Field Progress (DPR)
          </span>
          <span className="font-mono font-bold text-blue-400">{reported?.toFixed(1)}%</span>
        </div>
        <div className={clsx("h-2 rounded-full overflow-hidden", isDark ? "bg-slate-800" : "bg-slate-200")}>
          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, reported || 0)}%` }} />
        </div>
      </div>

      {/* 3. Evidence-Supported */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            3. Evidence-Supported Progress
          </span>
          <span className="font-mono font-bold text-emerald-400">
            {evidenceSupported != null ? `${evidenceSupported.toFixed(1)}%` : '—'}
          </span>
        </div>
        <div className={clsx("h-2 rounded-full overflow-hidden", isDark ? "bg-slate-800" : "bg-slate-200")}>
          <div
            className="h-full bg-emerald-500 rounded-full"
            style={{ width: `${Math.min(100, evidenceSupported || 0)}%` }}
          />
        </div>
      </div>

      <div className="pt-1 flex items-center gap-2 text-[10px] text-slate-500">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span>Evidence-supported progress represents verifiable proof (photos, inspection notes, logistics deliveries).</span>
      </div>
    </div>
  )
}

export function ConfidenceBar({ score }: { score: number }) {
  const s = score || 0
  const color = s >= 80 ? 'bg-emerald-500' : s >= 60 ? 'bg-amber-500' : 'bg-rose-500'
  const textColor = s >= 80 ? 'text-emerald-400' : s >= 60 ? 'text-amber-400' : 'text-rose-400'

  return (
    <div className="flex items-center gap-2 min-w-28">
      <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
        <div
          className={clsx('h-1.5 rounded-full transition-all duration-300', color)}
          style={{ width: `${Math.min(100, s)}%` }}
        />
      </div>
      <span className={clsx('text-xs font-mono font-bold w-9 text-right', textColor)}>
        {s.toFixed(0)}%
      </span>
    </div>
  )
}

export function VarianceDisplay({ variance }: { variance: number }) {
  const v = variance || 0
  const isPositive = v >= 0
  const color = isPositive ? 'text-emerald-400' : v > -10 ? 'text-amber-400' : 'text-rose-400'
  return (
    <span className={clsx('font-mono font-bold text-xs inline-flex items-center gap-0.5', color)}>
      {isPositive ? '+' : ''}{v.toFixed(1)}%
    </span>
  )
}

// ── State Messages (Error, Success, Info, Warning, Empty, Loading) ───────────

export function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
      <p className="text-slate-400 text-xs font-medium">{text}</p>
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3.5">
      <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-rose-300 text-xs font-medium leading-relaxed">{message}</p>
      </div>
    </div>
  )
}

export function SuccessBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5">
      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
      <p className="text-emerald-300 text-xs font-medium leading-relaxed">{message}</p>
    </div>
  )
}

export function InfoBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3.5">
      <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
      <p className="text-blue-300 text-xs font-medium leading-relaxed">{message}</p>
    </div>
  )
}

export function WarningBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5">
      <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
      <p className="text-amber-300 text-xs font-medium leading-relaxed">{message}</p>
    </div>
  )
}

export function EmptyState({
  title,
  message,
  icon,
  action,
}: {
  title: string
  message: string
  icon?: React.ReactNode
  action?: React.ReactNode
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <div className={clsx(
      "flex flex-col items-center justify-center py-16 px-6 rounded-xl border text-center",
      isDark ? "bg-slate-900/40 border-slate-800" : "bg-slate-50 border-slate-200"
    )}>
      {icon && <div className="text-slate-400 mb-3.5">{icon}</div>}
      <h3 className={clsx("font-bold text-sm", isDark ? "text-slate-200" : "text-slate-800")}>{title}</h3>
      <p className={clsx("text-xs mt-1 max-w-md font-medium leading-relaxed mb-4", isDark ? "text-slate-400" : "text-slate-500")}>
        {message}
      </p>
      {action && <div>{action}</div>}
    </div>
  )
}

// ── Check Row for Consistency Analysis ────────────────────────────────────────

export function CheckRow({
  checkType,
  passed,
  score,
  finding,
}: {
  checkType: string
  passed: boolean
  score: number
  finding: string
}) {
  const labels: Record<string, string> = {
    schedule: 'Schedule Timing Consistency',
    dependency: 'Dependency Chain Verification',
    temporal: 'Temporal Progress Jump Check',
    resource: 'Material & Evidence Availability',
    location: 'Location Consistency',
    cross_report: 'Cross-Report Trend Consistency',
  }
  return (
    <div className="flex items-start gap-2.5 text-xs py-1.5 border-b border-slate-800/40 last:border-0">
      <span className={clsx("mt-0.5 shrink-0 font-bold", passed ? "text-emerald-400" : "text-rose-400")}>
        {passed ? '✓' : '⚠'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={clsx("font-semibold", passed ? "text-slate-300" : "text-rose-300")}>
            {labels[checkType] || checkType}
          </span>
          <span className="text-slate-500 font-mono text-[11px]">({score?.toFixed(0)}%)</span>
        </div>
        {!passed && <p className="text-slate-400 text-[11px] mt-0.5 leading-snug">{finding}</p>}
      </div>
    </div>
  )
}

// ── Modal Dialog ──────────────────────────────────────────────────────────────

export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  maxWidth?: string
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={clsx(
          "w-full rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all",
          maxWidth,
          isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        )}
      >
        <div className={clsx("flex items-start justify-between p-4.5 border-b", isDark ? "border-slate-800" : "border-slate-100")}>
          <div>
            <h3 className="text-base font-bold tracking-tight">{title}</h3>
            {subtitle && <p className={clsx("text-xs mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className={clsx("p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors", isDark ? "hover:bg-slate-800" : "hover:bg-slate-100 hover:text-slate-800")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Drawer Panel ──────────────────────────────────────────────────────────────

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  position = 'right',
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  position?: 'right' | 'left'
}) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-950/70 backdrop-blur-xs">
      <div className="flex-1" onClick={onClose} />
      <div
        className={clsx(
          "w-full max-w-md h-full shadow-2xl flex flex-col border-l transition-all duration-200",
          isDark ? "bg-slate-900 border-slate-800 text-slate-100" : "bg-white border-slate-200 text-slate-900",
          position === 'left' ? 'order-first border-r border-l-0' : ''
        )}
      >
        <div className={clsx("flex items-start justify-between p-4 border-b", isDark ? "border-slate-800" : "border-slate-100")}>
          <div>
            <h3 className="text-base font-bold tracking-tight">{title}</h3>
            {subtitle && <p className={clsx("text-xs mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className={clsx("p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors", isDark ? "hover:bg-slate-800" : "hover:bg-slate-100 hover:text-slate-800")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}
