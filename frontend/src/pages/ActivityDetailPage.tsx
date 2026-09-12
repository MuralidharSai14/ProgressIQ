/**
 * PROGRESSIQ — Activity Detail Workspace
 * 360-degree intelligence hub for a single activity: schedule baseline, field reports,
 * evidence artifacts, consistency check scorecards, and audit decisions.
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, RefreshCw, AlertTriangle, Sparkles
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useTheme } from '../hooks/useTheme'
import {
  LoadingSpinner, ErrorBox,
  ConfidenceBadge, ConflictBadge, StatusBadge, TripleProgressBar,
  EvidenceBadge, CheckRow, DemoLabel,
  btnSecondary
} from '../components/ui'

export default function ActivityDetailPage() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadActivityIntelligence = async () => {
    if (!activityId) return
    setLoading(true)
    setError('')
    try {
      const result = await apiService.getActivityAssessment(Number(activityId))
      setData(result)
    } catch (e: any) {
      setError(e.message || 'Failed to load activity assessment')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadActivityIntelligence()
  }, [activityId])

  if (loading) {
    return <LoadingSpinner text="Loading 360° activity intelligence..." />
  }

  if (error) {
    return (
      <div className="space-y-4 max-w-xl">
        <ErrorBox message={error} />
        <button onClick={() => navigate(-1)} className={btnSecondary}>
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    )
  }

  if (!data) return null

  const { activity, assessment, consistency_checks, conflicts, evidence } = data

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Back Nav & Actions */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate(-1)}
          className={clsx(
            "flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors cursor-pointer",
            isDark ? "bg-slate-900 border-slate-700 text-slate-300 hover:text-white" : "bg-white border-slate-300 text-slate-700 hover:text-slate-900"
          )}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Schedule
        </button>

        <button
          onClick={loadActivityIntelligence}
          className={btnSecondary}
          title="Refresh assessment"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Activity Title Banner */}
      <div className={clsx(
        "p-6 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4",
        isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      )}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
              {activity.activity_id}
            </span>
            <span className="text-xs font-bold text-slate-400">Level {activity.level}</span>
            <StatusBadge status={activity.status} />
            {activity.is_milestone && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                ★ Milestone
              </span>
            )}
          </div>

          <h1 className={clsx("text-xl sm:text-2xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
            {activity.activity_name}
          </h1>

          <p className="text-xs text-slate-400 flex items-center gap-2">
            <span>Dependencies: <strong className="text-slate-300 font-mono">{activity.dependency || 'None'}</strong></span>
            {activity.delay_category && (
              <>
                <span>•</span>
                <span>Delay Category: <strong className="text-amber-400">{activity.delay_category}</strong></span>
              </>
            )}
          </p>
        </div>

        {assessment && (
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <ConfidenceBadge
              label={assessment.confidence_label}
              score={assessment.overall_confidence}
            />
            {assessment.requires_verification && (
              <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2.5 py-0.5 rounded">
                ⚠ Verification Required
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Grid: Left Column (Schedule & Intelligence) | Right Column (Evidence & Scorecard) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-5">
          {/* 1. Schedule Baseline Metadata */}
          <div className={clsx(
            "p-5 rounded-2xl border space-y-3",
            isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
          )}>
            <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
              Schedule Baseline Specification
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Planned Start</span>
                <span className="font-mono text-slate-300">
                  {activity.planned_start ? new Date(activity.planned_start).toLocaleDateString('en-IN') : '—'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Planned Finish</span>
                <span className="font-mono text-slate-300">
                  {activity.planned_finish ? new Date(activity.planned_finish).toLocaleDateString('en-IN') : '—'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Planned Target %</span>
                <span className="font-mono font-bold text-slate-200">{activity.planned_progress?.toFixed(1)}%</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80">
                <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Actual Reported %</span>
                <span className="font-mono font-bold text-blue-400">{activity.actual_progress?.toFixed(1)}%</span>
              </div>
            </div>

            {activity.delay_reason && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                <span className="font-bold text-amber-400 block mb-0.5">Reported Delay Reason:</span>
                <p className="text-amber-200/90">{activity.delay_reason}</p>
              </div>
            )}
          </div>

          {/* 2. Progress Intelligence Triple Bar */}
          {assessment ? (
            <div className={clsx(
              "p-5 rounded-2xl border space-y-3",
              isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
            )}>
              <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                Progress Intelligence Verification
              </h2>

              <TripleProgressBar
                planned={assessment.planned_progress}
                reported={assessment.reported_progress}
                evidenceSupported={assessment.evidence_supported_progress}
              />
            </div>
          ) : (
            <div className="p-6 rounded-2xl border text-center text-xs text-slate-500 border-slate-800">
              No assessment computed yet. Run Consistency Analysis in the Conflict Center.
            </div>
          )}

          {/* 3. Consistency Checks Scorecard */}
          {consistency_checks && consistency_checks.length > 0 && (
            <div className={clsx(
              "p-5 rounded-2xl border space-y-3",
              isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
            )}>
              <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                Automated Consistency Check Scorecard
              </h2>

              <div className="space-y-1">
                {consistency_checks.map((c: any) => (
                  <CheckRow
                    key={c.check_type}
                    checkType={c.check_type}
                    passed={c.passed}
                    score={c.score}
                    finding={c.finding}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 4. Active Conflicts for this Activity */}
          {conflicts && conflicts.length > 0 && (
            <div className={clsx(
              "p-5 rounded-2xl border space-y-3",
              isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
            )}>
              <h2 className={clsx("text-sm font-bold text-rose-400 flex items-center gap-2")}>
                <AlertTriangle className="w-4 h-4" /> Detected Discrepancies ({conflicts.length})
              </h2>

              <div className="space-y-2.5">
                {conflicts.map((c: any) => (
                  <div key={c.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <ConflictBadge severity={c.severity} />
                      <span className="font-bold text-slate-200">{c.title}</span>
                    </div>
                    <p className="text-slate-400 leading-relaxed">{c.description}</p>
                    {c.recommended_action && (
                      <p className="text-amber-400/90 font-medium pt-1">
                        ↳ Action: {c.recommended_action}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 Col: Evidence & Confidence Breakdown) */}
        <div className="space-y-5">
          {/* Supporting Evidence List */}
          <div className={clsx(
            "p-5 rounded-2xl border space-y-3",
            isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
          )}>
            <div className="flex items-center justify-between">
              <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                Supporting Evidence ({evidence?.length || 0})
              </h2>
              <button
                onClick={() => navigate('/evidence')}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300"
              >
                Upload +
              </button>
            </div>

            {evidence && evidence.length > 0 ? (
              <div className="space-y-2">
                {evidence.map((e: any) => (
                  <div key={e.id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-1">
                      <EvidenceBadge type={e.evidence_type} />
                      {e.is_demo && <DemoLabel />}
                    </div>
                    <p className="font-semibold text-slate-200 truncate">{e.filename}</p>
                    {e.description && <p className="text-[11px] text-slate-400 line-clamp-2">{e.description}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                No supporting evidence linked to this activity yet.
              </div>
            )}
          </div>

          {/* Confidence Factors Breakdown */}
          {assessment?.confidence_factors && (
            <div className={clsx(
              "p-5 rounded-2xl border space-y-3",
              isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
            )}>
              <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                AI Confidence Factors
              </h2>

              <div className="space-y-2 text-xs">
                {Object.entries(assessment.confidence_factors as Record<string, number>).map(([k, val]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="text-slate-400 capitalize">{k.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={clsx(
                            "h-full rounded-full",
                            val >= 80 ? "bg-emerald-400" : val >= 55 ? "bg-amber-400" : "bg-rose-400"
                          )}
                          style={{ width: `${val}%` }}
                        />
                      </div>
                      <span className="font-mono text-slate-200 font-bold w-7 text-right">
                        {val?.toFixed(0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Recommendation Box */}
          {assessment?.recommendation && (
            <div className={clsx(
              "p-4 rounded-2xl border text-xs space-y-1.5",
              isDark ? "bg-blue-950/20 border-blue-800/30 text-blue-200" : "bg-blue-50 border-blue-200 text-blue-900"
            )}>
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-blue-400">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Recommendation</span>
              </div>
              <p className="leading-relaxed font-medium">
                {assessment.recommendation}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
