/**
 * PROGRESSIQ — Risk & Delay Intelligence Page
 * Rule-based, explainable risk detection across schedule dependencies, milestone proximity, and site delays.
 */
import { useState, useEffect, useMemo } from 'react'
import {
  ShieldAlert, RefreshCw, ShieldCheck, Search
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import {
  PageHeader, LoadingSpinner, EmptyState, WarningBox,
  RiskBadge,
  btnSecondary, inputField
} from '../components/ui'

export default function RisksPage() {
  const { projectId } = useProject()
  const { theme } = useTheme()
  const { error } = useToast()
  const isDark = theme === 'dark'

  const [risks, setRisks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filterLevel, setFilterLevel] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [search, setSearch] = useState('')

  const fetchRisks = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await apiService.getRisks(projectId)
      setRisks(data.risks || [])
    } catch (e: any) {
      error(e.message || 'Failed to load project risks')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRisks()
  }, [projectId])

  const counts = useMemo(() => {
    return risks.reduce((acc: any, r: any) => {
      acc[r.level] = (acc[r.level] || 0) + 1
      return acc
    }, { critical: 0, high: 0, medium: 0, low: 0 })
  }, [risks])

  const categories = useMemo(() => {
    const cats = new Set<string>()
    risks.forEach(r => { if (r.category) cats.add(r.category) })
    return Array.from(cats)
  }, [risks])

  const filteredRisks = useMemo(() => {
    return risks.filter(r => {
      const matchLevel = !filterLevel || r.level === filterLevel
      const matchCat = !filterCategory || r.category === filterCategory
      const matchSearch = !search ||
        r.title?.toLowerCase().includes(search.toLowerCase()) ||
        r.description?.toLowerCase().includes(search.toLowerCase()) ||
        r.affected_dependency?.toLowerCase().includes(search.toLowerCase())
      return matchLevel && matchCat && matchSearch
    })
  }, [risks, filterLevel, filterCategory, search])

  if (!projectId) {
    return (
      <WarningBox message="No project selected. Open the Projects directory or select a project in the top header to view risk intelligence." />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Risks & Delays Intelligence"
        subtitle="Rule-based risk detection with explainable causal reasoning, dependency impacts, and mitigation actions"
      >
        <button
          onClick={fetchRisks}
          className={btnSecondary}
          title="Refresh risk matrix"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </PageHeader>

      {/* Explainer Notice */}
      <div className={clsx(
        "p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed",
        isDark ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-rose-50/60 border-rose-200 text-rose-950"
      )}>
        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-xs">Explainable Engineering Risk Engine</p>
          <p className="text-[11px] text-slate-400 leading-normal">
            Risks are synthesized deterministically based on progress variance thresholds, milestone target dates, critical path dependencies, and reported field delay categories. No black-box guesses.
          </p>
        </div>
      </div>

      {/* Severity Filter Strip & Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { level: 'critical', label: 'Critical Risks', count: counts.critical, color: 'text-rose-400', border: 'hover:border-rose-500/50' },
          { level: 'high', label: 'High Risks', count: counts.high, color: 'text-orange-400', border: 'hover:border-orange-500/50' },
          { level: 'medium', label: 'Medium Risks', count: counts.medium, color: 'text-amber-400', border: 'hover:border-amber-500/50' },
          { level: 'low', label: 'Low Risks', count: counts.low, color: 'text-emerald-400', border: 'hover:border-emerald-500/50' },
        ].map(item => (
          <button
            key={item.level}
            onClick={() => setFilterLevel(filterLevel === item.level ? '' : item.level)}
            className={clsx(
              "p-3.5 rounded-xl border text-left transition-all cursor-pointer",
              filterLevel === item.level
                ? isDark ? "bg-slate-800 border-blue-500 ring-1 ring-blue-500/40" : "bg-blue-50 border-blue-400"
                : isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs",
              item.border
            )}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.label}</p>
            <p className={clsx("text-2xl font-black mt-0.5", item.color)}>{item.count}</p>
          </button>
        ))}
      </div>

      {/* Search & Category Bar */}
      <div className={clsx(
        "p-3 rounded-2xl border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3",
        isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      )}>
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search risks or affected dependencies..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={clsx(inputField, "pl-8 text-xs")}
            />
          </div>

          {categories.length > 0 && (
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className={clsx(inputField, "w-40 text-xs")}
            >
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>

        {(filterLevel || filterCategory || search) && (
          <button
            onClick={() => { setFilterLevel(''); setFilterCategory(''); setSearch(''); }}
            className="text-xs text-slate-400 hover:text-white"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Risks List */}
      {loading ? (
        <LoadingSpinner text="Analyzing project risks and causal dependencies..." />
      ) : filteredRisks.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="w-12 h-12 text-emerald-400" />}
          title={filterLevel || filterCategory || search ? "No matching risks" : "No risks detected"}
          message={filterLevel || filterCategory || search
            ? "No risks match your current filter parameters."
            : "All activities are tracking without active high-risk flags. Load the Demo Project to see sample risk scenarios."}
        />
      ) : (
        <div className="space-y-3">
          {filteredRisks.map(r => {
            const isCritical = r.level === 'critical'
            const isHigh = r.level === 'high'

            return (
              <div
                key={r.id}
                className={clsx(
                  "p-5 rounded-2xl border transition-all space-y-3.5",
                  isCritical
                    ? isDark ? "bg-slate-900/90 border-rose-500/40 shadow-xs" : "bg-white border-rose-400 shadow-xs"
                    : isHigh
                      ? isDark ? "bg-slate-900/90 border-orange-500/40 shadow-xs" : "bg-white border-orange-400 shadow-xs"
                      : isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
                )}
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <RiskBadge level={r.level} />
                    {r.category && (
                      <span className="text-[11px] font-semibold text-slate-400">
                        Category: {r.category}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    Detected: {r.detected_at ? new Date(r.detected_at).toLocaleDateString('en-IN') : '—'}
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h3 className={clsx("font-bold text-base", isDark ? "text-slate-100" : "text-slate-900")}>
                    {r.title.replace(/^(CRITICAL|HIGH|MEDIUM|LOW) RISK:\s*/i, '')}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {r.description}
                  </p>
                </div>

                {/* Impact & Action Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800/60 text-xs">
                  {r.affected_dependency && (
                    <div className={clsx(
                      "p-3 rounded-xl border space-y-1",
                      isDark ? "bg-slate-950/60 border-slate-800 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-800"
                    )}>
                      <p className="text-[10px] font-bold uppercase text-amber-400">Impacted Dependency Chain</p>
                      <p className="leading-tight font-medium">↳ {r.affected_dependency}</p>
                    </div>
                  )}

                  {r.recommended_action && (
                    <div className={clsx(
                      "p-3 rounded-xl border space-y-1",
                      isDark ? "bg-blue-950/20 border-blue-800/30 text-blue-200" : "bg-blue-50 border-blue-200 text-blue-900"
                    )}>
                      <p className="text-[10px] font-bold uppercase text-blue-400">Recommended Mitigation</p>
                      <p className="leading-tight font-medium">{r.recommended_action}</p>
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
