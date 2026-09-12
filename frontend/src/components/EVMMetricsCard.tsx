import React from 'react'
import { TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle2, Calendar, Target } from 'lucide-react'

export interface EVMMetrics {
  project_id: number
  project_name?: string
  bac: number
  pv: number
  ev: number
  ac: number
  sv: number
  cv: number
  spi: number
  cpi: number
  eac: number
  etc: number
  vac: number
  tcpi: number
  health: 'healthy' | 'warning' | 'critical'
  status_description: string
  planned_completion_date?: string | null
  projected_completion_date?: string | null
  variance_days: number
  total_activities?: number
}

interface EVMMetricsCardProps {
  metrics: EVMMetrics
}

export const EVMMetricsCard: React.FC<EVMMetricsCardProps> = ({ metrics }) => {
  const isSpiGood = metrics.spi >= 0.95
  const isCpiGood = metrics.cpi >= 0.95

  const healthBadge = {
    healthy: {
      label: 'On Schedule & Budget',
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    },
    warning: {
      label: 'Caution — Slippage Detected',
      bg: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    },
    critical: {
      label: 'Critical Delay & Friction',
      bg: 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
      icon: <AlertTriangle className="w-4 h-4 text-rose-500" />,
    },
  }[metrics.health] || {
    label: 'Monitoring',
    bg: 'bg-slate-500/10 border-slate-500/30 text-slate-500',
    icon: <Clock className="w-4 h-4" />,
  }

  return (
    <div className="space-y-4">
      {/* Top Health & Forecast Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shadow-xs border border-slate-200/60 dark:border-slate-700/60">
            <Target className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Earned Value Controls & Completion Forecast</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{metrics.status_description}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold ${healthBadge.bg}`}>
            {healthBadge.icon}
            <span>{healthBadge.label}</span>
          </div>
        </div>
      </div>

      {/* Grid of Key EVM Dials */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {/* SPI */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">SPI (Schedule)</span>
            {isSpiGood ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-rose-500" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${isSpiGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {metrics.spi.toFixed(3)}
            </span>
            <span className="text-xs text-slate-400 font-medium">Target ≥ 1.0</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {metrics.spi >= 1 ? 'Ahead of baseline' : `${((1 - metrics.spi) * 100).toFixed(1)}% behind speed`}
          </p>
        </div>

        {/* CPI */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CPI (Cost / Effort)</span>
            {isCpiGood ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-amber-500" />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-black ${isCpiGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {metrics.cpi.toFixed(3)}
            </span>
            <span className="text-xs text-slate-400 font-medium">Target ≥ 1.0</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {metrics.cpi >= 1 ? 'Cost efficiency positive' : 'Effort friction noted'}
          </p>
        </div>

        {/* Planned vs Earned Value */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Earned vs Planned</span>
            <Target className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{metrics.ev}%</span>
            <span className="text-xs text-slate-400">/ {metrics.pv}%</span>
          </div>
          <p className={`text-[11px] font-bold mt-1 ${metrics.sv >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
            Variance: {metrics.sv > 0 ? `+${metrics.sv}` : metrics.sv}%
          </p>
        </div>

        {/* Completion Forecast */}
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Projected Finish</span>
            <Calendar className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-black text-slate-900 dark:text-white truncate">
              {metrics.projected_completion_date || 'TBD'}
            </span>
          </div>
          <p className={`text-[11px] font-semibold mt-1 ${metrics.variance_days > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
            {metrics.variance_days > 0 ? `+${metrics.variance_days} days variance` : 'On planned baseline'}
          </p>
        </div>
      </div>
    </div>
  )
}
