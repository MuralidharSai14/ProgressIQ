/**
 * PROGRESSIQ — Match Review Queue Page
 * Human validation for AI semantic matches where confidence falls below the strict 75% threshold.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardCheck, Check, X, RefreshCw, AlertTriangle
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import {
  PageHeader, LoadingSpinner, EmptyState, WarningBox,
  ConfidenceBar, StatusBadge,
  btnPrimary, btnSecondary, btnSuccess, btnDanger, inputField
} from '../components/ui'

export default function ReviewPage() {
  const navigate = useNavigate()
  const { projectId } = useProject()
  const { theme } = useTheme()
  const { success, error } = useToast()
  const isDark = theme === 'dark'

  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [reviewingId, setReviewingId] = useState<number | null>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})

  const fetchPendingMatches = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await apiService.getMatches(projectId, 'needs_review')
      setMatches(data.matches || [])
    } catch (e: any) {
      error(e.message || 'Failed to load review queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPendingMatches()
  }, [projectId])

  const handleDecision = async (matchId: number, decision: 'approved' | 'rejected') => {
    setReviewingId(matchId)
    try {
      await apiService.reviewMatch(matchId, {
        decision,
        notes: notes[matchId] || '',
      })
      success(`Match ${decision} successfully.`)
      setMatches(prev => prev.filter(m => m.id !== matchId))
    } catch (e: any) {
      error(e.message || 'Decision failed')
    } finally {
      setReviewingId(null)
    }
  }

  if (!projectId) {
    return (
      <WarningBox message="No project selected. Open the Projects directory or select a project in the top header to inspect the match review queue." />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Match Review Queue"
        subtitle="Validate ambiguous AI semantic schedule matches before they link to the official project baseline"
      >
        <button
          onClick={fetchPendingMatches}
          className={btnSecondary}
          title="Refresh pending matches"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </PageHeader>

      {/* Explainer Banner */}
      <div className={clsx(
        "p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed",
        isDark ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-amber-50/60 border-amber-200 text-amber-950"
      )}>
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-xs">Low-Confidence AI Match Queue (&lt;75%)</p>
          <p className="text-[11px] text-slate-400 leading-normal">
            When semantic cosine similarity is below 75%, PROGRESSIQ never auto-assigns the field update to the schedule activity. Review each candidate below and confirm or reject the match.
          </p>
        </div>
      </div>

      {/* Matches List */}
      {loading ? (
        <LoadingSpinner text="Loading pending match reviews..." />
      ) : matches.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="w-12 h-12 text-emerald-400" />}
          title="Match Review Queue is empty"
          message="All semantic AI matches have confidence scores above 75% or have already been reviewed by planning engineers."
          action={
            <button onClick={() => navigate('/matching')} className={btnPrimary}>
              Go to Activity Matching
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          <p className="text-xs font-bold text-amber-400">
            {matches.length} semantic match item(s) awaiting planning engineer approval
          </p>

          {matches.map(m => {
            const isReviewing = reviewingId === m.id

            return (
              <div
                key={m.id}
                className={clsx(
                  "p-5 rounded-2xl border transition-all space-y-4",
                  isDark ? "bg-slate-900/90 border-amber-500/40 shadow-xs" : "bg-white border-amber-400 shadow-xs"
                )}
              >
                {/* Top Status & Confidence */}
                <div className="flex items-center justify-between gap-2 border-b pb-3 border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={m.status} />
                    <span className="text-xs text-slate-400 font-semibold">
                      Match ID #{m.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">AI Vector Confidence:</span>
                    <ConfidenceBar score={m.confidence_score} />
                  </div>
                </div>

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Source Field DPR Update */}
                  <div className={clsx(
                    "p-4 rounded-xl border space-y-2.5",
                    isDark ? "bg-slate-950/60 border-slate-800" : "bg-blue-50/50 border-blue-200"
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded">
                        Extracted Field Update
                      </span>
                    </div>

                    <p className={clsx("font-bold text-sm", isDark ? "text-slate-100" : "text-slate-900")}>
                      {m.extracted_update?.activity_description || '(No description)'}
                    </p>

                    <div className="space-y-1 text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                      <div className="flex justify-between">
                        <span>Reported Status:</span>
                        <span className="font-semibold text-slate-200">{m.extracted_update?.status || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Reported Progress:</span>
                        <span className="font-mono font-bold text-blue-400">{m.extracted_update?.progress}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delay Category:</span>
                        <span className="text-slate-200">{m.extracted_update?.delay_category || 'None'}</span>
                      </div>
                    </div>

                    {m.extracted_update?.source_text && (
                      <p className="text-[11px] font-mono italic text-slate-400 pt-2 border-t border-slate-800/60">
                        "{m.extracted_update.source_text.slice(0, 160)}…"
                      </p>
                    )}
                  </div>

                  {/* Right: AI Proposed Schedule Task */}
                  <div className={clsx(
                    "p-4 rounded-xl border space-y-2.5",
                    isDark ? "bg-slate-950/60 border-slate-800" : "bg-purple-50/50 border-purple-200"
                  )}>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded">
                        Proposed Schedule Activity
                      </span>
                    </div>

                    <div>
                      <p className={clsx("font-bold text-sm", isDark ? "text-slate-100" : "text-slate-900")}>
                        {m.matched_activity?.activity_name || 'Baseline Task'}
                      </p>
                      <p className="font-mono text-xs text-slate-400 mt-0.5">
                        {m.matched_activity?.activity_id} · Level {m.matched_activity?.level}
                      </p>
                    </div>

                    <div className="space-y-1 text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                      <div className="flex justify-between">
                        <span>Target Planned Progress:</span>
                        <span className="font-mono text-slate-200">{m.matched_activity?.planned_progress}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Current Actual Progress:</span>
                        <span className="font-mono text-slate-200">{m.matched_activity?.actual_progress}%</span>
                      </div>
                    </div>

                    {/* Alternatives */}
                    {m.alternative_matches && m.alternative_matches.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/60">
                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-1">Other Candidates Considered:</p>
                        {m.alternative_matches.map((alt: any, i: number) => (
                          <p key={i} className="text-[11px] text-slate-400 truncate">
                            • {alt.activity_id} — {alt.activity_name} ({alt.confidence_score?.toFixed(0)}%)
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Reviewer Notes & Decision Buttons */}
                <div className="pt-2 border-t border-slate-800/60 space-y-3">
                  <textarea
                    rows={1}
                    placeholder="Enter reason for approval or rejection (optional)..."
                    value={notes[m.id] || ''}
                    onChange={e => setNotes(prev => ({ ...prev, [m.id]: e.target.value }))}
                    className={clsx(inputField, "resize-none text-xs")}
                  />

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDecision(m.id, 'approved')}
                      disabled={isReviewing}
                      className={btnSuccess}
                    >
                      <Check className="w-3.5 h-3.5" /> Approve Match
                    </button>
                    <button
                      onClick={() => handleDecision(m.id, 'rejected')}
                      disabled={isReviewing}
                      className={btnDanger}
                    >
                      <X className="w-3.5 h-3.5" /> Reject Match
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
