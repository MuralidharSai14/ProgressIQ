/**
 * Activity Matching Page — Semantic schedule matching with confidence scores
 */
import { useState, useEffect } from 'react'
import { Link2, Play, Info, ChevronDown, ChevronUp } from 'lucide-react'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import {
  PageHeader, LoadingSpinner, ErrorBox, SuccessBox,
  EmptyState, WarningBox, ConfidenceBar, StatusBadge
} from '../components/ui'

export default function MatchingPage() {
  const { projectId } = useProject()
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const fetchMatches = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await apiService.getMatches(projectId)
      setMatches(data.matches || [])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchMatches() }, [projectId])

  const handleRunMatching = async () => {
    if (!projectId) return
    setRunning(true); setError(''); setSuccess('')
    try {
      const result = await apiService.runMatching(projectId)
      setSuccess(result.message)
      await fetchMatches()
    } catch (e: any) { setError(e.message) }
    finally { setRunning(false) }
  }

  const needsReview = matches.filter(m => m.status === 'needs_review').length
  const approved = matches.filter(m => m.status === 'approved').length

  if (!projectId) return <WarningBox message="No project selected. Load the Demo Project from the Overview page first." />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity Matching"
        subtitle="Semantic AI matching of field updates to schedule activities"
      >
        <button onClick={handleRunMatching} disabled={running} className="btn-primary">
          <Play className="w-4 h-4" />
          {running ? 'Running Matching…' : 'Run Semantic Matching'}
        </button>
      </PageHeader>

      {/* Explainer */}
      <div className="card bg-slate-800/40 border-slate-700/40">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
          <p className="text-xs text-slate-400 leading-relaxed">
            <strong className="text-slate-300">How semantic matching works:</strong> Field reports use informal language ("pump house foundation work"). 
            The schedule uses formal language ("Construction of Reinforced Concrete Foundation for Pump House"). 
            The AI converts both to numerical vectors (embeddings) and finds the closest meaning — not just keywords.
            A <strong className="text-slate-300">Confidence Score &lt; {75}%</strong> triggers human review.
          </p>
        </div>
      </div>

      {/* Stats */}
      {matches.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center">
            <p className="text-2xl font-bold text-white">{matches.length}</p>
            <p className="text-slate-400 text-xs mt-1">Total Matches</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-400">{approved}</p>
            <p className="text-slate-400 text-xs mt-1">Auto-Approved</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-yellow-400">{needsReview}</p>
            <p className="text-slate-400 text-xs mt-1">Needs Review</p>
          </div>
        </div>
      )}

      {error && <ErrorBox message={error} />}
      {success && <SuccessBox message={success} />}

      {loading ? <LoadingSpinner text="Loading matches…" /> : matches.length === 0 ? (
        <EmptyState
          icon={<Link2 className="w-12 h-12" />}
          title="No matches yet"
          message="Run AI Extraction on field reports first, then click Run Semantic Matching."
        />
      ) : (
        <div className="space-y-3">
          {matches.map(m => (
            <div key={m.id} className={`card border ${m.status === 'needs_review' ? 'border-yellow-500/30' : m.status === 'approved' ? 'border-green-500/20' : 'border-slate-700/50'}`}>
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Field description */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] font-bold uppercase text-cyan-400 border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 rounded shrink-0">Field Update</span>
                    <p className="text-slate-200 text-sm font-medium truncate">
                      {m.extracted_update?.activity_description || '(No description)'}
                    </p>
                  </div>
                  {/* Arrow */}
                  <div className="flex items-center gap-2 ml-6">
                    <span className="text-slate-500 text-lg">↓</span>
                    <span className="text-slate-500 text-[10px]">Matched to schedule activity</span>
                  </div>
                  {/* Matched activity */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[9px] font-bold uppercase text-purple-400 border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 rounded shrink-0">Schedule</span>
                    <p className="text-slate-300 text-sm">
                      <span className="text-slate-500 font-mono text-xs mr-2">{m.matched_activity?.activity_id}</span>
                      {m.matched_activity?.activity_name || 'Unknown Activity'}
                    </p>
                  </div>
                </div>

                {/* Confidence + status */}
                <div className="shrink-0 text-right space-y-1 min-w-36">
                  <StatusBadge status={m.status} />
                  <div className="mt-2">
                    <p className="text-slate-500 text-[10px] mb-1">Confidence</p>
                    <ConfidenceBar score={m.confidence_score} />
                  </div>
                </div>
              </div>

              {/* Toggle details */}
              <button
                onClick={() => setExpanded(expanded === m.id ? null : m.id)}
                className="text-slate-500 hover:text-slate-300 text-xs flex items-center gap-1 mt-3"
              >
                {expanded === m.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {expanded === m.id ? 'Hide details' : 'Show details'}
              </button>

              {expanded === m.id && (
                <div className="mt-3 pt-3 border-t border-slate-700/30 grid grid-cols-2 gap-3">
                  {/* Extracted details */}
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <p className="text-[9px] uppercase text-slate-500 mb-2">Extracted Update Details</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-slate-500">Status</span><span className="text-slate-300">{m.extracted_update?.status || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Progress</span><span className="text-slate-300 font-mono">{m.extracted_update?.progress != null ? `${m.extracted_update.progress}%` : '—'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Delay Cat.</span><span className="text-slate-300">{m.extracted_update?.delay_category || '—'}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">AI Provider</span><span className="text-cyan-400 font-mono">{m.extracted_update?.ai_provider}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Extr. Confidence</span><span className="text-slate-300">{m.extracted_update?.extraction_confidence?.toFixed(1)}%</span></div>
                    </div>
                    {m.extracted_update?.source_text && (
                      <p className="text-slate-600 text-[10px] mt-2 italic">"{m.extracted_update.source_text.slice(0, 120)}…"</p>
                    )}
                  </div>

                  {/* Schedule activity details */}
                  <div className="bg-slate-900/50 rounded-lg p-3">
                    <p className="text-[9px] uppercase text-slate-500 mb-2">Matched Schedule Activity</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-slate-500">ID</span><span className="text-slate-300 font-mono">{m.matched_activity?.activity_id}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Level</span><span className="text-slate-300">L{m.matched_activity?.level}</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Planned%</span><span className="text-slate-300 font-mono">{m.matched_activity?.planned_progress}%</span></div>
                      <div className="flex justify-between"><span className="text-slate-500">Actual%</span><span className="text-slate-300 font-mono">{m.matched_activity?.actual_progress}%</span></div>
                    </div>
                    {/* Alternative matches */}
                    {m.alternative_matches?.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-800">
                        <p className="text-[9px] text-slate-600 mb-1">Alternative candidates:</p>
                        {m.alternative_matches.map((alt: any, i: number) => (
                          <p key={i} className="text-slate-600 text-[10px]">
                            {alt.activity_id} — {alt.activity_name?.slice(0, 40)} ({alt.confidence_score?.toFixed(0)}%)
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
