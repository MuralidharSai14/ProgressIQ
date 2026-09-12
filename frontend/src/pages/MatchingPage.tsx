/**
 * PROGRESSIQ — Activity Matching Page
 * Semantic vector AI matching between informal field updates and formal schedule baseline tasks.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Link2, Play, Info, ChevronDown, ChevronUp,
  ArrowDown, ArrowRight,
  RefreshCw, Check, X
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import {
  PageHeader, LoadingSpinner, EmptyState, WarningBox,
  ConfidenceBar, StatusBadge,
  btnPrimary, btnSecondary
} from '../components/ui'

export default function MatchingPage() {
  const navigate = useNavigate()
  const { projectId } = useProject()
  const { theme } = useTheme()
  const { success, error } = useToast()
  const isDark = theme === 'dark'

  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState('')

  const fetchMatches = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await apiService.getMatches(projectId)
      setMatches(data.matches || [])
    } catch (e: any) {
      error(e.message || 'Failed to load semantic matches')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMatches()
  }, [projectId])

  const handleRunMatching = async () => {
    if (!projectId) return
    setRunning(true)
    try {
      const result = await apiService.runMatching(projectId)
      success(result.message || 'Semantic matching completed.')
      await fetchMatches()
    } catch (e: any) {
      error(e.message || 'Matching failed')
    } finally {
      setRunning(false)
    }
  }

  const handleQuickReview = async (matchId: number, decision: 'approved' | 'rejected') => {
    try {
      await apiService.reviewMatch(matchId, { decision })
      success(`Match ${decision}.`)
      await fetchMatches()
    } catch (e: any) {
      error(e.message || 'Review action failed')
    }
  }

  if (!projectId) {
    return (
      <WarningBox message="No project selected. Open the Projects directory or select a project in the top header to inspect semantic matches." />
    )
  }

  const needsReviewCount = matches.filter(m => m.status === 'needs_review').length
  const approvedCount = matches.filter(m => m.status === 'approved').length

  const filteredMatches = filterStatus
    ? matches.filter(m => m.status === filterStatus)
    : matches

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity Matching"
        subtitle="Semantic vector AI alignment of informal field progress mentions to formal schedule WBS tasks"
      >
        <button
          onClick={fetchMatches}
          className={btnSecondary}
          title="Refresh matches"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
        <button
          onClick={handleRunMatching}
          disabled={running}
          className={btnPrimary}
        >
          <Play className={clsx("w-3.5 h-3.5", running && "animate-spin")} />
          {running ? 'Running Vector Matching...' : 'Run Semantic AI Matching'}
        </button>
      </PageHeader>

      {/* Explainer Card */}
      <div className={clsx(
        "p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed",
        isDark ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-blue-50/60 border-blue-200 text-blue-950"
      )}>
        <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-xs">How Vector Matching Works</p>
          <p className="text-[11px] text-slate-400 leading-normal">
            Field updates describe work colloquially (e.g. <em>"Block B foundation casting ready"</em>). The schedule baseline uses formal engineering terminology (e.g. <em>"Reinforced Concrete Substructure — Pump House Block B"</em>). The engine generates dense neural embeddings to calculate cosine similarity. Any match below the <strong>75% confidence threshold</strong> automatically queues for human verification.
          </p>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Matches</p>
          <p className="text-xl font-extrabold text-white mt-0.5">{matches.length}</p>
        </div>
        <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Auto-Approved (≥75%)</p>
          <p className="text-xl font-extrabold text-emerald-400 mt-0.5">{approvedCount}</p>
        </div>
        <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Needs Review (&lt;75%)</p>
          <p className={clsx("text-xl font-extrabold mt-0.5", needsReviewCount > 0 ? "text-amber-400" : "text-slate-400")}>
            {needsReviewCount}
          </p>
        </div>
        <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Review Queue</p>
          <button
            onClick={() => navigate('/review')}
            className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1 cursor-pointer"
          >
            Open Review Queue <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[
          { id: '', label: `All Matches (${matches.length})` },
          { id: 'needs_review', label: `Needs Review (${needsReviewCount})` },
          { id: 'approved', label: `Approved (${approvedCount})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={clsx(
              "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer",
              filterStatus === tab.id
                ? "bg-blue-600 text-white border-blue-600"
                : isDark ? "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200" : "bg-slate-100 border-slate-300 text-slate-700"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Matches List */}
      {loading ? (
        <LoadingSpinner text="Loading semantic matches..." />
      ) : filteredMatches.length === 0 ? (
        <EmptyState
          icon={<Link2 className="w-12 h-12" />}
          title="No activity matches found"
          message="Run AI Extraction on field reports first, then click 'Run Semantic AI Matching' above."
          action={
            <button onClick={handleRunMatching} disabled={running} className={btnPrimary}>
              <Play className="w-4 h-4" /> Run Semantic Matching
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filteredMatches.map(m => {
            const isExpanded = expandedId === m.id
            const isNeedsReview = m.status === 'needs_review'

            return (
              <div
                key={m.id}
                className={clsx(
                  "p-4 rounded-2xl border transition-all space-y-3",
                  isNeedsReview
                    ? isDark ? "bg-slate-900/80 border-amber-500/40 shadow-xs" : "bg-white border-amber-400 shadow-xs"
                    : isDark ? "bg-slate-900/70 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 shadow-xs"
                )}
              >
                {/* Match Connection Grid */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                  {/* Left: Connection Pair */}
                  <div className="flex-1 space-y-2.5">
                    {/* Source Field Update */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded shrink-0">
                        Field Update
                      </span>
                      <p className={clsx("font-bold text-sm truncate", isDark ? "text-slate-100" : "text-slate-900")}>
                        {m.extracted_update?.activity_description || '(No description)'}
                      </p>
                    </div>

                    {/* Arrow indicator */}
                    <div className="flex items-center gap-2 text-slate-500 text-[11px] pl-2">
                      <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
                      <span>Semantic match to schedule task:</span>
                    </div>

                    {/* Target Schedule Activity */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded shrink-0">
                        Schedule Task
                      </span>
                      <p className="text-xs font-semibold text-slate-300 truncate">
                        <span className="font-mono text-slate-400 mr-2">{m.matched_activity?.activity_id}</span>
                        {m.matched_activity?.activity_name || 'Unknown Baseline Task'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Confidence, Status, Quick Actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={m.status} />
                      <ConfidenceBar score={m.confidence_score} />
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      {isNeedsReview && (
                        <>
                          <button
                            onClick={() => handleQuickReview(m.id, 'approved')}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 cursor-pointer"
                            title="Approve match"
                          >
                            <Check className="w-3 h-3" /> Approve
                          </button>
                          <button
                            onClick={() => handleQuickReview(m.id, 'rejected')}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1 cursor-pointer"
                            title="Reject match"
                          >
                            <X className="w-3 h-3" /> Reject
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setExpandedId(isExpanded ? null : m.id)}
                        className={clsx(
                          "p-1.5 rounded-lg border text-slate-400 hover:text-white transition-colors cursor-pointer",
                          isDark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"
                        )}
                        title={isExpanded ? "Hide candidate details" : "Show candidate details"}
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details: Extracted Fields & Alternative Matches */}
                {isExpanded && (
                  <div className={clsx(
                    "p-3.5 rounded-xl border mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs",
                    isDark ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
                  )}>
                    {/* Left: Extracted Update Details */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Extracted Update Details</p>
                      <div className="space-y-1 text-slate-300">
                        <div className="flex justify-between"><span className="text-slate-500">Status:</span><span className="font-semibold">{m.extracted_update?.status || '—'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Reported Progress:</span><span className="font-mono text-blue-400">{m.extracted_update?.progress != null ? `${m.extracted_update.progress}%` : '—'}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Delay Category:</span><span>{m.extracted_update?.delay_category || 'None'}</span></div>
                      </div>
                      {m.extracted_update?.source_text && (
                        <p className="text-[11px] font-mono italic text-slate-400 pt-1 border-t border-slate-800">
                          "{m.extracted_update.source_text.slice(0, 140)}…"
                        </p>
                      )}
                    </div>

                    {/* Right: Alternative Candidates Considered */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Alternative Candidates Evaluated</p>
                      {m.alternative_matches && m.alternative_matches.length > 0 ? (
                        <div className="space-y-1.5">
                          {m.alternative_matches.map((alt: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-[11px] p-1.5 rounded bg-slate-900 border border-slate-800">
                              <span className="font-mono text-slate-400">{alt.activity_id}</span>
                              <span className="text-slate-300 truncate max-w-[160px]">{alt.activity_name}</span>
                              <span className="font-mono font-bold text-slate-400">{alt.confidence_score?.toFixed(0)}%</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-slate-500 text-[11px]">No alternative candidates scored above minimal threshold.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
