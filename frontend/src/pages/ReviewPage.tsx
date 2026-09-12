/**
 * Review Queue Page — Human validation of low-confidence AI matches
 */
import { useState, useEffect } from 'react'
import { ClipboardCheck, Check, X, RefreshCw } from 'lucide-react'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import {
  PageHeader, LoadingSpinner, ErrorBox, SuccessBox,
  EmptyState, WarningBox, ConfidenceBar, StatusBadge
} from '../components/ui'

export default function ReviewPage() {
  const { projectId } = useProject()
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [reviewing, setReviewing] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [notes, setNotes] = useState<Record<number, string>>({})

  const fetchPending = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await apiService.getMatches(projectId, 'needs_review')
      setMatches(data.matches || [])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchPending() }, [projectId])

  const handleDecision = async (matchId: number, decision: 'approved' | 'rejected') => {
    setReviewing(matchId); setError(''); setSuccess('')
    try {
      await apiService.reviewMatch(matchId, {
        decision,
        notes: notes[matchId] || '',
      })
      setSuccess(`Match ${decision}. `)
      setMatches(prev => prev.filter(m => m.id !== matchId))
    } catch (e: any) { setError(e.message) }
    finally { setReviewing(null) }
  }

  if (!projectId) return <WarningBox message="No project selected. Load the Demo Project from the Overview page first." />

  return (
    <div className="space-y-5">
      <PageHeader
        title="Review Queue"
        subtitle="Human validation for AI matches with confidence below threshold"
      >
        <button onClick={fetchPending} className="btn-secondary text-xs px-3 py-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </PageHeader>

      {/* Explainer */}
      <div className="card bg-amber-500/5 border-amber-500/20">
        <p className="text-amber-200 text-xs leading-relaxed">
          <strong>Why human review matters:</strong> When the AI confidence score is below{' '}
          <strong>75%</strong>, the system does not silently trust the match.
          These items are flagged here for your review. You can approve, reject, or reassign.
          This is essential for maintaining data quality and AI accountability.
        </p>
      </div>

      {error && <ErrorBox message={error} />}
      {success && <SuccessBox message={success} />}

      {loading ? <LoadingSpinner text="Loading review queue…" /> : matches.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="w-12 h-12" />}
          title="Review Queue is empty"
          message="All AI matches are either auto-approved (confidence ≥75%) or already reviewed. Load the Demo Project to see items in the queue."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">{matches.length} item(s) awaiting review</p>
          {matches.map(m => (
            <div key={m.id} className="card border border-yellow-500/30 bg-yellow-500/5">
              {/* Match details */}
              <div className="flex items-start justify-between mb-3">
                <StatusBadge status={m.status} />
                <ConfidenceBar score={m.confidence_score} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                {/* Field update */}
                <div className="bg-slate-900/60 rounded-lg p-3">
                  <p className="text-[9px] text-cyan-400 font-bold uppercase mb-2">Field Update (AI Extracted)</p>
                  <p className="text-slate-200 text-sm font-medium mb-2">
                    {m.extracted_update?.activity_description}
                  </p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <span className="text-slate-300">{m.extracted_update?.status}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Progress</span>
                      <span className="text-slate-300">{m.extracted_update?.progress}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Delay</span>
                      <span className="text-slate-300">{m.extracted_update?.delay_category || '—'}</span>
                    </div>
                  </div>
                  {m.extracted_update?.source_text && (
                    <p className="text-slate-600 text-[10px] mt-2 italic">
                      Source: "{m.extracted_update.source_text.slice(0, 120)}…"
                    </p>
                  )}
                </div>

                {/* AI proposed match */}
                <div className="bg-slate-900/60 rounded-lg p-3">
                  <p className="text-[9px] text-purple-400 font-bold uppercase mb-2">AI Proposed Schedule Match</p>
                  <p className="text-slate-300 text-sm font-medium mb-1">
                    {m.matched_activity?.activity_name}
                  </p>
                  <p className="text-slate-500 text-xs font-mono">{m.matched_activity?.activity_id} · Level {m.matched_activity?.level}</p>
                  <div className="mt-2 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Planned</span>
                      <span className="text-slate-300">{m.matched_activity?.planned_progress}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Actual</span>
                      <span className="text-slate-300">{m.matched_activity?.actual_progress}%</span>
                    </div>
                  </div>

                  {m.alternative_matches?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-800">
                      <p className="text-[9px] text-slate-600 mb-1">Alternatives considered:</p>
                      {m.alternative_matches.map((alt: any, i: number) => (
                        <p key={i} className="text-slate-600 text-[10px]">
                          {alt.activity_id} — {alt.activity_name?.slice(0, 35)} ({alt.confidence_score?.toFixed(0)}%)
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes + Actions */}
              <div className="border-t border-slate-700/30 pt-3">
                <textarea
                  placeholder="Optional reviewer notes (reason for approval/rejection)…"
                  value={notes[m.id] || ''}
                  onChange={e => setNotes(prev => ({ ...prev, [m.id]: e.target.value }))}
                  className="input-field mb-3 h-16 resize-none text-xs"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleDecision(m.id, 'approved')}
                    disabled={reviewing === m.id}
                    className="btn-success"
                  >
                    <Check className="w-4 h-4" /> Approve Match
                  </button>
                  <button
                    onClick={() => handleDecision(m.id, 'rejected')}
                    disabled={reviewing === m.id}
                    className="btn-danger"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                  <p className="text-slate-600 text-xs ml-auto">
                    Confidence: <span className="text-yellow-400 font-mono">{m.confidence_score?.toFixed(1)}%</span>
                    {' '}· Below {75}% threshold
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
