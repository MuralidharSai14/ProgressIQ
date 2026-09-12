/**
 * Shared UI utility components
 * Uses inline Tailwind classes directly (Tailwind v4 compatible)
 */
import React from 'react'
import { Loader2, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'
import clsx from 'clsx'

// ── Common class strings ──────────────────────────────────────────────────────
export const cardCls = "bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm"
export const cardHoverCls = "bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/40 hover:bg-slate-800/80"
export const btnPrimary = "bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-4 py-2 rounded-lg transition-all duration-150 flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
export const btnSecondary = "bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium px-4 py-2 rounded-lg transition-all duration-150 flex items-center gap-2 text-sm"
export const btnDanger = "bg-red-700/80 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg transition-all duration-150 flex items-center gap-2 text-sm"
export const btnSuccess = "bg-green-700/80 hover:bg-green-600 text-white font-medium px-4 py-2 rounded-lg transition-all duration-150 flex items-center gap-2 text-sm"
export const inputCls = "bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 w-full"

// ── Status Badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    on_track: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30',
    completed: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30',
    in_progress: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    at_risk: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    delayed: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30',
    critical: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30',
    not_started: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30',
    approved: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30',
    needs_review: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    rejected: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30',
    pending: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30',
  }
  const labels: Record<string, string> = {
    on_track: 'On Track', in_progress: 'In Progress', at_risk: 'At Risk',
    delayed: 'Delayed', critical: 'Critical', not_started: 'Not Started',
    completed: 'Completed', approved: 'Approved', needs_review: 'Needs Review',
    rejected: 'Rejected', pending: 'Pending',
  }
  return (
    <span className={map[status] || 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30'}>
      {labels[status] || status}
    </span>
  )
}

// ── Health Badge ──────────────────────────────────────────────────────────────
export function HealthBadge({ health }: { health: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    on_track: { cls: 'text-green-400 bg-green-500/10 border-green-500/30', label: '✓ On Track' },
    at_risk: { cls: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', label: '⚠ At Risk' },
    delayed: { cls: 'text-orange-400 bg-orange-500/10 border-orange-500/30', label: '↓ Delayed' },
    critical: { cls: 'text-red-400 bg-red-500/10 border-red-500/30', label: '✕ Critical' },
    unknown: { cls: 'text-slate-400 bg-slate-500/10 border-slate-500/30', label: '? Unknown' },
  }
  const config = map[health] || map['unknown']
  return (
    <span className={clsx('inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold border', config.cls)}>
      {config.label}
    </span>
  )
}

// ── Risk Level Badge ──────────────────────────────────────────────────────────
export function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    critical: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30',
    high: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30',
    medium: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    low: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30',
  }
  return <span className={map[level] || 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400 border border-slate-500/30'}>{level?.toUpperCase()}</span>
}

// ── Confidence Bar ────────────────────────────────────────────────────────────
export function ConfidenceBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
  const textColor = score >= 80 ? 'text-green-400' : score >= 60 ? 'text-yellow-400' : 'text-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-700 rounded-full h-1.5">
        <div
          className={clsx('h-1.5 rounded-full transition-all', color)}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <span className={clsx('text-xs font-mono font-semibold w-10 text-right', textColor)}>
        {score.toFixed(0)}%
      </span>
    </div>
  )
}

// ── Variance Display ──────────────────────────────────────────────────────────
export function VarianceDisplay({ variance }: { variance: number }) {
  const isPositive = variance >= 0
  const color = isPositive ? 'text-green-400' : variance > -10 ? 'text-yellow-400' : 'text-red-400'
  return (
    <span className={clsx('font-mono font-bold text-sm', color)}>
      {isPositive ? '+' : ''}{variance.toFixed(1)}%
    </span>
  )
}

// ── Loading Spinner ───────────────────────────────────────────────────────────
export function LoadingSpinner({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      <p className="text-slate-400 text-sm">{text}</p>
    </div>
  )
}

// ── Error Box ─────────────────────────────────────────────────────────────────
export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
      <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
      <p className="text-red-300 text-sm">{message}</p>
    </div>
  )
}

// ── Success Box ───────────────────────────────────────────────────────────────
export function SuccessBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 rounded-xl p-4">
      <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
      <p className="text-green-300 text-sm">{message}</p>
    </div>
  )
}

// ── Info Box ──────────────────────────────────────────────────────────────────
export function InfoBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
      <Info className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
      <p className="text-cyan-200 text-sm">{message}</p>
    </div>
  )
}

// ── Warning Box ───────────────────────────────────────────────────────────────
export function WarningBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
      <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
      <p className="text-yellow-200 text-sm">{message}</p>
    </div>
  )
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  title: string
  value: string | number
  unit?: string
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'cyan' | 'white'
  icon?: React.ReactNode
  subtitle?: string
}

export function StatCard({ title, value, unit, color = 'white', icon, subtitle }: StatCardProps) {
  const colorMap: Record<string, string> = {
    green: 'text-green-400', red: 'text-red-400', yellow: 'text-yellow-400',
    blue: 'text-blue-400', cyan: 'text-cyan-400', white: 'text-white',
  }
  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 backdrop-blur-sm transition-all duration-200 hover:border-cyan-500/40 hover:bg-slate-800/80">
      <div className="flex items-start justify-between mb-2">
        <p className="text-slate-400 text-xs font-medium uppercase tracking-wide">{title}</p>
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>
      <p className={clsx('text-3xl font-bold', colorMap[color])}>
        {value}{unit && <span className="text-lg ml-0.5 text-slate-400">{unit}</span>}
      </p>
      {subtitle && <p className="text-slate-500 text-xs mt-1">{subtitle}</p>}
    </div>
  )
}

// ── Page Header ───────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, children }: {
  title: string; subtitle?: string; children?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-slate-400 text-sm mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, message }: { icon?: React.ReactNode; title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {icon && <div className="text-slate-600 mb-2">{icon}</div>}
      <p className="text-slate-300 font-medium">{title}</p>
      <p className="text-slate-500 text-sm max-w-sm">{message}</p>
    </div>
  )
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ planned, actual, showLabels = true }: {
  planned: number; actual: number; showLabels?: boolean
}) {
  return (
    <div className="space-y-1.5">
      {showLabels && (
        <div className="flex justify-between text-xs text-slate-400 font-medium">
          <span>Planned: {planned.toFixed(1)}%</span>
          <span>Actual: {actual.toFixed(1)}%</span>
        </div>
      )}
      <div className="relative h-3 bg-slate-700/60 rounded-full overflow-hidden">
        <div className="absolute top-0 left-0 h-full bg-slate-500/50 rounded-full" style={{ width: `${Math.min(100, planned)}%` }} />
        <div
          className="absolute top-0 left-0 h-full rounded-full"
          style={{
            width: `${Math.min(100, actual)}%`,
            background: actual >= planned
              ? 'linear-gradient(90deg, #22d3ee, #06b6d4)'
              : actual >= planned - 10
              ? 'linear-gradient(90deg, #f59e0b, #d97706)'
              : 'linear-gradient(90deg, #ef4444, #dc2626)',
          }}
        />
      </div>
    </div>
  )
}
