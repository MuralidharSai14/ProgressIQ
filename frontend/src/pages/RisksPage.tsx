/**
 * Risk Intelligence Page — All detected risks with explanations
 */
import { useState, useEffect } from 'react'
import { ShieldAlert, RefreshCw } from 'lucide-react'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { PageHeader, LoadingSpinner, ErrorBox, EmptyState, WarningBox, RiskBadge } from '../components/ui'

const RISK_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  critical: { border: 'border-red-500/40', bg: 'bg-red-500/5', icon: '🔴' },
  high:     { border: 'border-orange-500/40', bg: 'bg-orange-500/5', icon: '🟠' },
  medium:   { border: 'border-yellow-500/30', bg: 'bg-yellow-500/5', icon: '🟡' },
  low:      { border: 'border-green-500/20', bg: 'bg-green-500/5', icon: '🟢' },
}

export default function RisksPage() {
  const { projectId } = useProject()
  const [risks, setRisks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')

  const fetchRisks = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await apiService.getRisks(projectId)
      setRisks(data.risks || [])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchRisks() }, [projectId])

  const filtered = filter ? risks.filter(r => r.level === filter) : risks

  const counts = risks.reduce((acc: any, r: any) => {
    acc[r.level] = (acc[r.level] || 0) + 1
    return acc
  }, {})

  if (!projectId) return <WarningBox message="No project selected. Load the Demo Project from the Overview page first." />

  return (
    <div className="space-y-5">
      <PageHeader title="Risk Intelligence" subtitle="Rule-based risk detection with explainable reasons">
        <button onClick={fetchRisks} className="btn-secondary text-xs px-3 py-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </PageHeader>

      {/* Explainer */}
      <div className="card bg-slate-800/40 border-slate-700/40 text-xs text-slate-400">
        <strong className="text-slate-300">How risks are detected:</strong> Rule-based engine analyzes progress variance, dependency chains, milestone proximity, and delay categories. Every risk has an explicit reason — no black-box decisions.
      </div>

      {/* Summary pills */}
      <div className="flex items-center gap-3 flex-wrap">
        {['critical','high','medium','low'].map(level => (
          <button
            key={level}
            onClick={() => setFilter(filter === level ? '' : level)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filter === level ? 'opacity-100' : 'opacity-70 hover:opacity-90'}`}
            style={{
              borderColor: level === 'critical' ? '#ef4444' : level === 'high' ? '#f97316' : level === 'medium' ? '#eab308' : '#22c55e',
              color: level === 'critical' ? '#ef4444' : level === 'high' ? '#f97316' : level === 'medium' ? '#eab308' : '#22c55e',
              backgroundColor: filter === level ? `${level === 'critical' ? '#ef444415' : level === 'high' ? '#f9731615' : level === 'medium' ? '#eab30815' : '#22c55e15'}` : 'transparent',
            }}
          >
            {level.toUpperCase()} ({counts[level] || 0})
          </button>
        ))}
        {filter && <button onClick={() => setFilter('')} className="text-slate-500 text-xs">Clear filter</button>}
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? <LoadingSpinner text="Loading risks…" /> : filtered.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert className="w-12 h-12" />}
          title={filter ? `No ${filter} risks` : 'No risks detected'}
          message="Load the Demo Project to see risk intelligence in action."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const style = RISK_STYLES[r.level] || RISK_STYLES.low
            return (
              <div key={r.id} className={`card border ${style.border} ${style.bg}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span>{style.icon}</span>
                    <RiskBadge level={r.level} />
                    {r.category && <span className="text-slate-500 text-xs">· {r.category}</span>}
                  </div>
                  <span className="text-slate-600 text-[10px]">
                    {r.detected_at ? new Date(r.detected_at).toLocaleDateString('en-IN') : ''}
                  </span>
                </div>

                <h3 className="text-slate-200 font-semibold text-sm mb-2">
                  {r.title.replace(/^(CRITICAL|HIGH|MEDIUM|LOW) RISK:\s*/i, '')}
                </h3>

                <p className="text-slate-400 text-xs leading-relaxed mb-3">{r.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {r.affected_dependency && (
                    <div className="bg-slate-900/50 rounded-lg p-2">
                      <p className="text-slate-600 text-[9px] uppercase mb-1">Affected Dependency</p>
                      <p className="text-slate-300 text-xs">↳ {r.affected_dependency}</p>
                    </div>
                  )}
                  {r.recommended_action && (
                    <div className="bg-slate-900/50 rounded-lg p-2">
                      <p className="text-slate-600 text-[9px] uppercase mb-1">Recommended Action</p>
                      <p className="text-slate-300 text-xs">{r.recommended_action}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
