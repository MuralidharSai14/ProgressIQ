/**
 * PROGRESSIQ — Conflict Center
 * Identifies and explains discrepancies across planned baselines, field reports, and attached evidence.
 */
import { useState, useEffect } from 'react'
import {
  AlertTriangle, Play, RefreshCw, ShieldCheck
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import {
  PageHeader, LoadingSpinner, EmptyState, WarningBox,
  ConflictBadge,
  btnPrimary, btnSecondary
} from '../components/ui'

export default function ConflictPage() {
  const { projectId } = useProject()
  const { theme } = useTheme()
  const { success, error } = useToast()
  const isDark = theme === 'dark'

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [filterSeverity, setFilterSeverity] = useState('')

  const loadConflicts = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const result = await apiService.getConsistency(projectId)
      setData(result)
    } catch (e: any) {
      error(e.message || 'Failed to load project conflicts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConflicts()
  }, [projectId])

  const handleRunChecks = async () => {
    if (!projectId) return
    setRunning(true)
    try {
      const result = await apiService.runConsistency(projectId)
      success(`Analysis complete: ${result.conflicts_detected} conflicts detected across ${result.activities_checked} activities.`)
      await loadConflicts()
    } catch (e: any) {
      error(e.message || 'Consistency check failed')
    } finally {
      setRunning(false)
    }
  }

  if (!projectId) {
    return (
      <WarningBox message="No project selected. Open the Projects directory or select a project in the top header to inspect project conflicts." />
    )
  }

  const conflicts = (data?.conflicts || []).filter((c: any) =>
    !filterSeverity || c.severity === filterSeverity
  )
  const summary = data?.assessment_summary

  return (
    <div className="space-y-5">
      <PageHeader
        title="Conflict Center"
        subtitle="Operational discrepancies and evidence gaps detected between schedule baselines, site DPR reports, and supporting records"
      >
        <button
          onClick={loadConflicts}
          className={btnSecondary}
          title="Refresh conflicts"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
        <button
          onClick={handleRunChecks}
          disabled={running}
          className={btnPrimary}
        >
          <Play className={clsx("w-3.5 h-3.5", running && "animate-spin")} />
          {running ? 'Running Analysis...' : 'Run Consistency Analysis'}
        </button>
      </PageHeader>

      {/* Philosophy Notice */}
      <div className={clsx(
        "p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed",
        isDark ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-amber-50/60 border-amber-200 text-amber-950"
      )}>
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-xs">Neutral & Objective Conflict Intelligence</p>
          <p className="text-[11px] text-slate-400 leading-normal">
            PROGRESSIQ applies rigorous cross-consistency checks without accusatory language. Discrepancies represent variances between submitted field progress and verifiable supporting artifacts, ensuring transparent human-in-the-loop review.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">High Confidence</p>
            <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{summary.high_confidence}</p>
          </div>
          <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Medium Confidence</p>
            <p className="text-xl font-extrabold text-amber-400 mt-0.5">{summary.medium_confidence}</p>
          </div>
          <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Low Confidence</p>
            <p className="text-xl font-extrabold text-rose-400 mt-0.5">{summary.low_confidence}</p>
          </div>
          <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Conflicts</p>
            <p className="text-xl font-extrabold text-orange-400 mt-0.5">{data?.conflict_count || 0}</p>
          </div>
        </div>
      )}

      {/* Severity Filter Pills */}
      <div className="flex gap-2 flex-wrap items-center justify-between">
        <div className="flex gap-1.5 flex-wrap">
          {['', 'critical', 'high', 'medium', 'low'].map(sev => (
            <button
              key={sev}
              onClick={() => setFilterSeverity(sev)}
              className={clsx(
                "px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer capitalize",
                filterSeverity === sev
                  ? "bg-blue-600 text-white border-blue-600"
                  : isDark ? "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200" : "bg-slate-100 border-slate-300 text-slate-700"
              )}
            >
              {sev === '' ? 'All Severities' : `${sev} Severity`}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 font-medium">
          {conflicts.length} conflict(s) listed
        </span>
      </div>

      {/* Conflicts List */}
      {loading ? (
        <LoadingSpinner text="Analyzing project consistency and conflicts..." />
      ) : conflicts.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="w-12 h-12 text-emerald-400" />}
          title={data ? "No active discrepancies found" : "No consistency analysis run yet"}
          message={data
            ? "All activities passed cross-consistency and evidence alignment checks."
            : "Click 'Run Consistency Analysis' to evaluate progress consistency across all activities."}
          action={
            <button onClick={handleRunChecks} disabled={running} className={btnPrimary}>
              <Play className="w-4 h-4" /> Run Consistency Analysis
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {conflicts.map((c: any) => (
            <div
              key={c.id}
              className={clsx(
                "p-4 rounded-2xl border transition-all space-y-3",
                c.severity === 'critical'
                  ? isDark ? "bg-slate-900/90 border-rose-500/40" : "bg-white border-rose-400 shadow-xs"
                  : c.severity === 'high'
                    ? isDark ? "bg-slate-900/90 border-orange-500/40" : "bg-white border-orange-400 shadow-xs"
                    : isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ConflictBadge severity={c.severity} />
                  {c.activity_name && (
                    <span className="text-xs font-semibold text-slate-400 truncate">
                      Task: {c.activity_name}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  Detected: {c.detected_at ? new Date(c.detected_at).toLocaleDateString('en-IN') : '—'}
                </span>
              </div>

              <div>
                <h3 className={clsx("font-bold text-sm", isDark ? "text-slate-100" : "text-slate-900")}>
                  {c.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {c.description}
                </p>
              </div>

              {/* Reported vs Expected values */}
              {(c.reported_value || c.expected_value) && (
                <div className="flex flex-wrap gap-4 pt-2 border-t border-slate-800/60 text-xs">
                  {c.reported_value && (
                    <div>
                      <span className="text-slate-500 font-medium">Reported Value: </span>
                      <span className="font-mono font-bold text-blue-400">{c.reported_value}</span>
                    </div>
                  )}
                  {c.expected_value && (
                    <div>
                      <span className="text-slate-500 font-medium">Expected Baseline / Evidence: </span>
                      <span className="font-mono font-bold text-slate-300">{c.expected_value}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Recommended Action Box */}
              {c.recommended_action && (
                <div className={clsx(
                  "p-3 rounded-xl border text-xs space-y-1",
                  isDark ? "bg-amber-950/20 border-amber-800/30 text-amber-200" : "bg-amber-50 border-amber-200 text-amber-900"
                )}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Recommended Action
                  </p>
                  <p className="leading-relaxed">
                    {c.recommended_action}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
