/**
 * PROGRESSIQ — Worker Safety & Site Hazards Page
 * Task-specific safety risk evaluations, PPE requirements, hazard logs, and compliance scorecards.
 */
import { useState, useEffect } from 'react'
import {
  HardHat, RefreshCw, Plus, ShieldCheck, ShieldAlert,
  AlertTriangle, CheckCircle2
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import {
  PageHeader, LoadingSpinner, EmptyState, WarningBox,
  RiskBadge, Modal,
  btnPrimary, btnSecondary, btnSuccess, inputField, selectField
} from '../components/ui'

const COMPLIANCE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  compliant: { icon: ShieldCheck, color: 'text-emerald-400', label: 'Compliant' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', label: 'Warning' },
  violation: { icon: ShieldAlert, color: 'text-rose-400', label: 'Violation' },
  pending_review: { icon: HardHat, color: 'text-slate-400', label: 'Pending Review' },
}

const HAZARD_CATEGORIES = [
  'Working at Height', 'Excavation', 'Electrical Hazard', 'Heavy Equipment',
  'Chemical Exposure', 'Fire & Explosion', 'Confined Space', 'Manual Handling',
  'Noise & Vibration', 'General Site',
]
const RISK_SCORES = ['low', 'medium', 'high', 'critical']
const COMPLIANCE_STATUSES = ['compliant', 'warning', 'violation', 'pending_review']

export default function WorkerSafetyPage() {
  const { projectId } = useProject()
  const { theme } = useTheme()
  const { success, error } = useToast()
  const isDark = theme === 'dark'

  const [data, setData] = useState<any>(null)
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [filterScore, setFilterScore] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [ppeInput, setPpeInput] = useState('')
  const [ppeList, setPpeList] = useState<string[]>([])
  const [form, setForm] = useState({
    title: '',
    hazard_category: 'General Site',
    risk_score: 'medium',
    description: '',
    mitigation_plan: '',
    compliance_status: 'pending_review',
    affected_workers: '',
  })

  const load = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [risks, sum] = await Promise.all([
        apiService.getSafetyRisks(projectId, filterScore || undefined, filterCategory || undefined),
        apiService.getSafetySummary(projectId),
      ])
      setData(risks)
      setSummary(sum)
    } catch (e: any) {
      error(e.message || 'Failed to load safety records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [projectId, filterScore, filterCategory])

  const addPpe = () => {
    const val = ppeInput.trim()
    if (val && !ppeList.includes(val)) {
      setPpeList(prev => [...prev, val])
    }
    setPpeInput('')
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !form.title.trim()) return
    setSubmitting(true)
    try {
      await apiService.createSafetyRisk(projectId, {
        ...form,
        affected_workers: form.affected_workers ? parseInt(form.affected_workers) : null,
        required_ppe: ppeList.length > 0 ? ppeList : null,
      })
      success(`Safety hazard '${form.title}' logged.`)
      setForm({ title: '', hazard_category: 'General Site', risk_score: 'medium', description: '', mitigation_plan: '', compliance_status: 'pending_review', affected_workers: '' })
      setPpeList([])
      setShowAddModal(false)
      await load()
    } catch (e: any) {
      error(e.message || 'Failed to add safety risk')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolve = async (id: number) => {
    try {
      await apiService.updateSafetyRisk(id, { is_resolved: true, compliance_status: 'compliant' })
      success('Hazard marked as resolved & compliant.')
      await load()
    } catch (e: any) {
      error(e.message || 'Failed to resolve hazard')
    }
  }

  if (!projectId) {
    return (
      <WarningBox message="No project selected. Open the Projects directory or select a project in the top header to view worker safety records." />
    )
  }

  const risks = data?.safety_risks || []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Worker Safety & Site Hazards"
        subtitle="Task-specific hazard evaluations, mandatory PPE compliance, worker risk exposure, and safety scorecards"
      >
        <button
          onClick={load}
          className={btnSecondary}
          title="Refresh safety records"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
        <button
          onClick={() => setShowAddModal(true)}
          className={btnPrimary}
        >
          <Plus className="w-3.5 h-3.5" /> Log Safety Hazard
        </button>
      </PageHeader>

      {/* Safety Scorecard KPI Strip */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className={clsx("p-4 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Site Safety Score</p>
            <p className={clsx("text-3xl font-black mt-0.5", summary.safety_score >= 80 ? "text-emerald-400" : summary.safety_score >= 60 ? "text-amber-400" : "text-rose-400")}>
              {summary.safety_score} / 100
            </p>
            <p className="text-[10px] font-semibold text-slate-400 capitalize mt-0.5">
              Status: {summary.overall_status?.replace(/_/g, ' ')}
            </p>
          </div>

          <div className={clsx("p-4 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Open Hazards</p>
            <p className="text-2xl font-black text-amber-400 mt-0.5">{summary.open_risks}</p>
          </div>

          <div className={clsx("p-4 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Violations</p>
            <p className={clsx("text-2xl font-black mt-0.5", summary.open_violations > 0 ? "text-rose-400" : "text-emerald-400")}>
              {summary.open_violations}
            </p>
          </div>

          <div className={clsx("p-4 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Resolved Hazards</p>
            <p className="text-2xl font-black text-emerald-400 mt-0.5">{summary.resolved_risks}</p>
          </div>
        </div>
      )}

      {/* Active Violations Banner */}
      {summary && summary.open_violations > 0 && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-2 text-xs">
          <p className="text-rose-400 font-bold text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> {summary.open_violations} Active Safety Violation{summary.open_violations > 1 ? 's' : ''} Requiring Immediate Mitigation
          </p>
          <div className="space-y-1.5">
            {summary.violations.slice(0, 3).map((v: any) => (
              <div key={v.id} className="flex items-center justify-between text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="font-semibold text-slate-200">{v.title}</span>
                <span className="text-rose-400 text-[11px] font-semibold">{v.hazard_category}</span>
                {v.affected_workers && <span className="text-slate-400 text-[11px]">{v.affected_workers} workers affected</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className={clsx(
        "p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3",
        isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      )}>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterScore}
            onChange={e => setFilterScore(e.target.value)}
            className={selectField}
          >
            <option value="">All Risk Levels</option>
            {RISK_SCORES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className={selectField}
          >
            <option value="">All Hazard Categories</option>
            {HAZARD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {(filterScore || filterCategory) && (
            <button
              onClick={() => { setFilterScore(''); setFilterCategory(''); }}
              className="text-xs text-slate-400 hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>

        <span className="text-xs text-slate-400 font-medium">
          {risks.length} hazard(s) logged
        </span>
      </div>

      {/* Risks List */}
      {loading ? (
        <LoadingSpinner text="Loading worker safety & hazard records..." />
      ) : risks.length === 0 ? (
        <EmptyState
          icon={<HardHat className="w-12 h-12" />}
          title="No safety risks logged"
          message="Log site hazards and mandatory PPE requirements to maintain a zero-incident construction environment."
          action={
            <button onClick={() => setShowAddModal(true)} className={btnPrimary}>
              <Plus className="w-4 h-4" /> Log Safety Hazard
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {risks.map((r: any) => {
            const compliance = COMPLIANCE_CONFIG[r.compliance_status] || COMPLIANCE_CONFIG.pending_review
            const CompIcon = compliance.icon
            let ppeItems: string[] = []
            try { ppeItems = r.required_ppe ? JSON.parse(r.required_ppe) : [] } catch {}

            return (
              <div
                key={r.id}
                className={clsx(
                  "p-5 rounded-2xl border transition-all space-y-3",
                  isDark ? "bg-slate-900/70 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 shadow-xs"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                      <HardHat className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className={clsx("font-bold text-sm truncate", isDark ? "text-slate-100" : "text-slate-900")}>
                        {r.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Category: <strong className="text-slate-300">{r.hazard_category}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <RiskBadge level={r.risk_score} />
                    <span className={clsx('flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border border-slate-700 bg-slate-800', compliance.color)}>
                      <CompIcon className="w-3.5 h-3.5" /> {compliance.label}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {r.description}
                </p>

                {/* PPE requirements */}
                {ppeItems.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-400 mr-1">Mandatory PPE:</span>
                    {ppeItems.map(ppe => (
                      <span
                        key={ppe}
                        className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      >
                        🦺 {ppe}
                      </span>
                    ))}
                  </div>
                )}

                {/* Mitigation Plan Box */}
                {r.mitigation_plan && (
                  <div className={clsx(
                    "p-3 rounded-xl border text-xs space-y-0.5",
                    isDark ? "bg-slate-950/60 border-slate-800 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-800"
                  )}>
                    <p className="text-[10px] font-bold uppercase text-slate-400">Mitigation Control Measure:</p>
                    <p className="leading-tight">{r.mitigation_plan}</p>
                  </div>
                )}

                {/* Footer resolution action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                  <span>
                    {r.affected_workers ? `👷 ${r.affected_workers} workers at risk` : 'Headcount unassigned'}
                    {r.activity_id ? ` · Activity Task #${r.activity_id}` : ''}
                  </span>

                  <div>
                    {!r.is_resolved ? (
                      <button
                        onClick={() => handleResolve(r.id)}
                        className={clsx(btnSuccess, "text-xs py-1 px-3")}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mark Resolved
                      </button>
                    ) : (
                      <span className="text-emerald-400 font-bold flex items-center gap-1 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Hazard Resolved
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Safety Hazard Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Log Safety Hazard & PPE Requirements"
        subtitle="Record task hazard classifications, worker risk counts, and mitigation measures"
      >
        <form onSubmit={handleAdd} className="space-y-4 text-xs">
          <div className="space-y-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Hazard Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Scaffolding erection without safety harness anchor"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className={inputField}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Hazard Category</label>
                <select
                  value={form.hazard_category}
                  onChange={e => setForm(p => ({ ...p, hazard_category: e.target.value }))}
                  className={clsx(selectField, "w-full")}
                >
                  {HAZARD_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Risk Score</label>
                <select
                  value={form.risk_score}
                  onChange={e => setForm(p => ({ ...p, risk_score: e.target.value }))}
                  className={clsx(selectField, "w-full uppercase")}
                >
                  {RISK_SCORES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Compliance Status</label>
                <select
                  value={form.compliance_status}
                  onChange={e => setForm(p => ({ ...p, compliance_status: e.target.value }))}
                  className={clsx(selectField, "w-full")}
                >
                  {COMPLIANCE_STATUSES.map(s => <option key={s} value={s}>{COMPLIANCE_CONFIG[s]?.label || s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Affected Workers (Count)</label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 12"
                  value={form.affected_workers}
                  onChange={e => setForm(p => ({ ...p, affected_workers: e.target.value }))}
                  className={inputField}
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Description *</label>
              <textarea
                required
                rows={2}
                placeholder="Describe the site condition and hazard observations..."
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className={clsx(inputField, "resize-none")}
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Mitigation Plan</label>
              <textarea
                rows={2}
                placeholder="Required safety controls and supervisor instructions..."
                value={form.mitigation_plan}
                onChange={e => setForm(p => ({ ...p, mitigation_plan: e.target.value }))}
                className={clsx(inputField, "resize-none")}
              />
            </div>

            {/* Mandatory PPE Inputs */}
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Required PPE</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Safety Harness, Hard Hat, Ear Protection..."
                  value={ppeInput}
                  onChange={e => setPpeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPpe())}
                  className={inputField}
                />
                <button
                  type="button"
                  onClick={addPpe}
                  className={btnSecondary}
                >
                  Add
                </button>
              </div>

              {ppeList.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {ppeList.map(item => (
                    <span
                      key={item}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1"
                    >
                      🦺 {item}
                      <button
                        type="button"
                        onClick={() => setPpeList(p => p.filter(x => x !== item))}
                        className="hover:text-rose-400 text-slate-400 font-black ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className={btnSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.title.trim()}
              className={btnPrimary}
            >
              {submitting ? 'Logging Hazard...' : 'Log Safety Hazard'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
