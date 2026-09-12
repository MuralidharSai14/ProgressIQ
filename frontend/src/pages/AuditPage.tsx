/**
 * PROGRESSIQ — Audit Trail Page
 * Chronological governance log of all AI decisions, human verifications, and system events.
 */
import { useState, useEffect } from 'react'
import {
  ScrollText, RefreshCw, User, Cpu, ShieldCheck, Clock
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import {
  PageHeader, LoadingSpinner, EmptyState, WarningBox,
  btnSecondary
} from '../components/ui'

const EVENT_CONFIG: Record<string, { label: string; badge: string }> = {
  extraction: { label: 'AI Extraction', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  matching: { label: 'AI Matching', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  evidence_upload: { label: 'Evidence Upload', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  consistency_check: { label: 'Consistency Check', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  conflict_detected: { label: 'Conflict Detected', badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  verification_decision: { label: 'Human Verification', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
}

const ACTOR_CONFIG: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
  ai: { label: 'AI Engine', icon: Cpu, badge: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  human: { label: 'Reviewing Officer', icon: User, badge: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  system: { label: 'System', icon: ShieldCheck, badge: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
}

export default function AuditPage() {
  const { projectId } = useProject()
  const { theme } = useTheme()
  const { error } = useToast()
  const isDark = theme === 'dark'

  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filterActor, setFilterActor] = useState('')

  const loadAudit = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await apiService.getProjectAudit(projectId)
      setEvents(data.events || [])
    } catch (e: any) {
      error(e.message || 'Failed to load audit trail')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAudit()
  }, [projectId])

  const filteredEvents = events.filter(e => {
    const matchActor = !filterActor || e.actor === filterActor
    return matchActor
  })

  if (!projectId) {
    return (
      <WarningBox message="No project selected. Open the Projects directory or select a project in the top header to view the audit trail." />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Trail & Traceability"
        subtitle="Immutable chronological record of all AI inferences, data extractions, and human officer review decisions"
      >
        <button
          onClick={loadAudit}
          className={btnSecondary}
          title="Refresh audit events"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </PageHeader>

      {/* Explainer Notice */}
      <div className={clsx(
        "p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed",
        isDark ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-blue-50/60 border-blue-200 text-blue-950"
      )}>
        <ScrollText className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-xs">Full Algorithmic & Human Accountability</p>
          <p className="text-[11px] text-slate-400 leading-normal">
            The audit trail answers: <em>"Why was this activity flagged?"</em> and <em>"What exact DPR statement or evidence triggered this decision?"</em>
          </p>
        </div>
      </div>

      {/* Filter Strip */}
      <div className={clsx(
        "p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3",
        isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      )}>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-400 mr-1">Filter Actor:</span>
          {[
            { id: '', label: 'All Actors' },
            { id: 'ai', label: '🤖 AI Engine' },
            { id: 'human', label: '👤 Human Officer' },
            { id: 'system', label: '⚙ System' },
          ].map(a => (
            <button
              key={a.id}
              onClick={() => setFilterActor(a.id)}
              className={clsx(
                "px-2.5 py-1 rounded-lg border text-xs font-semibold transition-colors cursor-pointer",
                filterActor === a.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : isDark ? "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200" : "bg-slate-100 border-slate-300 text-slate-700"
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-slate-400 font-medium">
          {filteredEvents.length} event(s) logged
        </span>
      </div>

      {/* Audit Events Timeline */}
      {loading ? (
        <LoadingSpinner text="Loading chronological audit log..." />
      ) : filteredEvents.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="w-12 h-12" />}
          title="No audit events found"
          message="Load the Demo Project or upload new reports to generate audit events."
        />
      ) : (
        <div className="space-y-3">
          {filteredEvents.map(ev => {
            const eventCfg = EVENT_CONFIG[ev.event_type] || { label: ev.event_type, badge: 'bg-slate-800 text-slate-300 border-slate-700' }
            const actorCfg = ACTOR_CONFIG[ev.actor] || ACTOR_CONFIG.system
            const ActorIcon = actorCfg.icon

            return (
              <div
                key={ev.id}
                className={clsx(
                  "p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                  isDark ? "bg-slate-900/70 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 shadow-xs"
                )}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className={clsx("p-2 rounded-xl border shrink-0 mt-0.5", actorCfg.badge)}>
                    <ActorIcon className="w-4 h-4" />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={clsx("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border", eventCfg.badge)}>
                        {eventCfg.label}
                      </span>
                      {ev.activity_name && (
                        <span className="text-xs font-semibold text-slate-400 truncate">
                          Task: {ev.activity_name}
                        </span>
                      )}
                    </div>

                    <p className={clsx("text-xs font-semibold leading-relaxed", isDark ? "text-slate-200" : "text-slate-800")}>
                      {ev.summary}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right self-end sm:self-auto shrink-0">
                  <div className="text-[11px] text-slate-500 font-mono">
                    <Clock className="w-3 h-3 inline-block mr-1 text-slate-500" />
                    {ev.occurred_at ? new Date(ev.occurred_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
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
