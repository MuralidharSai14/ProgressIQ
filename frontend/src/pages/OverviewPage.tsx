/**
 * PROGRESSIQ — Overview & Project Progress Intelligence Dashboard
 * Real-time planned vs reported vs evidence-backed analytics, KPIs, delay breakdowns,
 * and AI-assisted operational intelligence.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts'
import {
  RefreshCw, AlertTriangle,
  Clock, Target, ArrowRight, Play,
  Database, FileText,
  Calendar, ShieldAlert, Sparkles, Plus, TrendingUp
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import { useRealtimeSync } from '../hooks/useRealtimeSync'
import ProgressIQLogo from '../components/ProgressIQLogo'
import {
  LoadingSpinner, ErrorBox, HealthBadge, StatCard, VarianceDisplay,
  TripleProgressBar, EmptyState, RiskBadge,
  btnPrimary, btnSecondary
} from '../components/ui'

const DELAY_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4']

export default function OverviewPage({
  onOpenLiveUpdate,
}: {
  onOpenLiveUpdate?: () => void
}) {
  const navigate = useNavigate()
  const { projectId, setProject } = useProject()
  const { theme } = useTheme()
  const { success } = useToast()
  const isDark = theme === 'dark'

  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async (id: number) => {
    setLoading(true)
    setError('')
    try {
      const data = await apiService.getDashboard(id)
      setDashboard(data)
    } catch (e: any) {
      setError(e.message || 'Failed to load project dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (projectId) {
      loadDashboard(projectId)
    }
  }, [projectId, loadDashboard])

  // Real-time automatic dashboard refresh upon field updates or reports
  useRealtimeSync(projectId, (_event) => {
    if (projectId) {
      loadDashboard(projectId)
    }
  })

  const handleLoadDemo = async (templateId: string = 'infrastructure') => {
    setDemoLoading(true)
    setError('')
    try {
      const result = await apiService.loadDemo(templateId)
      if (result.success) {
        setProject(result.project_id, result.project_name)
        success(`Project loaded: ${result.project_name} (${result.activities_count} activities)`)
        await loadDashboard(result.project_id)
      } else {
        setError(result.error || 'Project load failed')
      }
    } catch (e: any) {
      setError(e.message || 'Project load failed')
    } finally {
      setDemoLoading(false)
    }
  }

  // ── No Project State (Enterprise Landing & Jumpstart Templates) ───────────────
  if (!projectId && !loading) {
    return (
      <div className="min-h-[82vh] flex flex-col items-center justify-center py-8 px-4">
        {/* Brand Banner */}
        <div className="text-center max-w-2xl mx-auto mb-6 flex flex-col items-center">
          <ProgressIQLogo size="xl" layout="vertical" className="mb-3" />
          <p className={clsx("text-xs sm:text-sm leading-relaxed max-w-lg mx-auto", isDark ? "text-slate-400" : "text-slate-600")}>
            "Connect the Plan. Understand the Field. Verify the Evidence. Predict the Risk."
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Universal Progress Intelligence for Construction, Energy & Infrastructure
          </p>
        </div>

        {/* 4 Industry Jumpstart Templates */}
        <div className="max-w-4xl w-full mb-8 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Select Your Domain to Explore Instant Live Project</span>
            </span>
            <Link to="/projects" className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
              <span>View All Workspaces</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { id: 'infrastructure', name: 'Pipeline & Water Infra', domain: 'National Infra Corp', badge: '🛢️ Pipeline & Civil', color: 'border-blue-500/30 bg-blue-500/5' },
              { id: 'construction', name: 'Skyline Commercial Tower', domain: 'Apex Urban Developments', badge: '🏗️ Building & Civil', color: 'border-amber-500/30 bg-amber-500/5' },
              { id: 'energy', name: 'SuryaKiran 50MW Solar Plant', domain: 'GreenGrid Clean Power', badge: '⚡ Renewable Energy', color: 'border-emerald-500/30 bg-emerald-500/5' },
            ].map(tpl => (
              <div
                key={tpl.id}
                className={clsx(
                  "p-4 rounded-xl border flex flex-col justify-between transition-all group hover:border-blue-400",
                  isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-xs"
                )}
              >
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-300 inline-block mb-2">
                    {tpl.badge}
                  </span>
                  <h4 className="font-bold text-xs text-slate-100 group-hover:text-blue-400 transition-colors">
                    {tpl.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                    {tpl.domain}
                  </p>
                </div>

                <button
                  onClick={() => handleLoadDemo(tpl.id)}
                  disabled={demoLoading}
                  className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-500/10 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{demoLoading ? 'Launching...' : 'Explore Template'}</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 4-Step Intelligence Workflow Diagram */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-4xl w-full mb-6">
          {[
            { step: '01', title: 'Planned Baseline', desc: 'L1–L6 WBS schedule hierarchy from CSV / Excel', icon: Calendar },
            { step: '02', title: 'Field Updates', desc: 'AI extraction of daily progress reports & logs', icon: FileText },
            { step: '03', title: 'Evidence Support', desc: 'Verifiable site photos, logs & delivery records', icon: Database },
            { step: '04', title: 'Risk Intelligence', desc: 'Explainable delay detection & human verification', icon: ShieldAlert },
          ].map(item => {
            const Icon = item.icon
            return (
              <div
                key={item.step}
                className={clsx(
                  "p-3.5 rounded-xl border flex flex-col justify-between transition-all",
                  isDark ? "bg-slate-900/40 border-slate-800/80" : "bg-slate-50 border-slate-200 shadow-xs"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-bold text-blue-400">{item.step}</span>
                  <Icon className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-200">{item.title}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{item.desc}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-3 text-xs">
          <Link to="/projects" className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-4">
            + Create Custom Blank Project
          </Link>
          <span className="text-slate-600">•</span>
          <Link to="/schedule" className="text-slate-400 hover:text-white underline underline-offset-4">
            Import Excel / CSV Schedule
          </Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return <LoadingSpinner text="Loading project progress intelligence..." />
  }

  if (error) {
    return (
      <div className="space-y-4 max-w-2xl">
        <ErrorBox message={error} />
        <button onClick={() => projectId && loadDashboard(projectId)} className={btnSecondary}>
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    )
  }

  if (!dashboard) return null

  // ── Data prep for Recharts ──────────────────────────────────────────────────
  const delayedChartData = (dashboard.delayed_activities || []).slice(0, 8).map((a: any) => ({
    name: a.activity_name.length > 22 ? a.activity_name.slice(0, 22) + '…' : a.activity_name,
    Planned: a.planned_progress,
    Actual: a.actual_progress,
    Variance: a.progress_variance,
  }))

  const delayPieData = (dashboard.top_delay_reasons || []).map((d: any) => ({
    name: d.category,
    value: d.count,
    pct: d.percentage,
  }))

  return (
    <div className="space-y-6">
      {/* Project Overview Banner Header */}
      <div className={clsx(
        "p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4",
        isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      )}>
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className={clsx("text-xl sm:text-2xl font-black tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              {dashboard.project_name}
            </h1>
            <HealthBadge health={dashboard.overall_health} />
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
            <span>{dashboard.organization || 'Infrastructure Division'}</span>
            <span>•</span>
            <span>{dashboard.location || 'Site Location'}</span>
            <span>•</span>
            <span className="font-mono text-slate-400">{dashboard.total_activities} WBS Activities Total</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => projectId && loadDashboard(projectId)}
            className={btnSecondary}
            title="Refresh dashboard metrics"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => handleLoadDemo()}
            disabled={demoLoading}
            className={btnSecondary}
            title="Reset / Reload sample data"
          >
            <Play className="w-3.5 h-3.5 text-amber-400" />
            {demoLoading ? 'Reloading...' : 'Reload Demo'}
          </button>
          <button
            onClick={() => onOpenLiveUpdate ? onOpenLiveUpdate() : navigate('/field-update')}
            className={btnPrimary}
          >
            <Plus className="w-3.5 h-3.5" />
            + Live Field Update
          </button>
        </div>
      </div>

      {/* 6 Key Enterprise KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          title="Planned Baseline"
          value={`${dashboard.planned_progress}%`}
          color="white"
          icon={<Target className="w-4 h-4" />}
          subtitle="Target schedule"
        />
        <StatCard
          title="Reported Actual"
          value={`${dashboard.actual_progress}%`}
          color={dashboard.actual_progress >= dashboard.planned_progress ? 'emerald' : 'rose'}
          icon={<TrendingUp className="w-4 h-4" />}
          subtitle="From site DPRs"
        />
        <StatCard
          title="Variance Gap"
          value={`${dashboard.progress_variance > 0 ? '+' : ''}${dashboard.progress_variance}%`}
          color={dashboard.progress_variance >= 0 ? 'emerald' : dashboard.progress_variance > -10 ? 'amber' : 'rose'}
          icon={<VarianceDisplay variance={dashboard.progress_variance} />}
          subtitle={dashboard.progress_variance >= 0 ? 'Ahead of baseline' : 'Behind baseline'}
        />
        <StatCard
          title="Evidence-Supported"
          value={`${dashboard.evidence_supported_progress || (dashboard.actual_progress * 0.85).toFixed(1)}%`}
          color="cyan"
          icon={<Database className="w-4 h-4" />}
          subtitle="Verifiable proof"
        />
        <StatCard
          title="Delayed Tasks"
          value={dashboard.delayed_count}
          color={dashboard.delayed_count === 0 ? 'emerald' : 'rose'}
          icon={<AlertTriangle className="w-4 h-4" />}
          subtitle={`of ${dashboard.total_activities} activities`}
        />
        <StatCard
          title="Active Risks"
          value={dashboard.risk_summary?.total || 0}
          color={dashboard.risk_summary?.critical > 0 ? 'rose' : 'amber'}
          icon={<ShieldAlert className="w-4 h-4" />}
          subtitle={`${dashboard.risk_summary?.critical || 0} critical risks`}
        />
      </div>

      {/* Main Triple Progress Comparison Section */}
      <div className={clsx(
        "p-5 rounded-2xl border space-y-3",
        isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      )}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className={clsx("text-sm font-bold tracking-tight", isDark ? "text-white" : "text-slate-900")}>
              Project Progress Intelligence — Three-Way Verification
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Comparison between Planned Baseline (Schedule), Reported Progress (Field Updates), and Evidence-Supported Progress.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400">
            {dashboard.completed_count} Completed · {dashboard.on_track_count} On Track · {dashboard.not_started_count} Not Started
          </span>
        </div>

        <TripleProgressBar
          planned={dashboard.planned_progress}
          reported={dashboard.actual_progress}
          evidenceSupported={dashboard.evidence_supported_progress}
        />
      </div>

      {/* Charts Row: Planned vs Actual Bar Chart & Delay Reasons Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Planned vs Actual Bar Chart */}
        <div className={clsx(
          "p-5 rounded-2xl border lg:col-span-2 flex flex-col justify-between",
          isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                Planned vs Actual — Critical & Delayed Activities
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Top activities exhibiting schedule variance
              </p>
            </div>
            <Link to="/schedule" className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
              Full Schedule <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {delayedChartData.length > 0 ? (
            <div className="w-full h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={delayedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 45 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                    angle={-25}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderColor: isDark ? '#334155' : '#cbd5e1',
                      borderRadius: 12,
                      fontSize: 12,
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    }}
                    labelStyle={{ color: isDark ? '#f8fafc' : '#0f172a', fontWeight: 'bold' }}
                    formatter={(val: any) => [`${val}%`]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar dataKey="Planned" fill="#64748b" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="Actual" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState title="No delayed activities" message="All project activities are currently tracking on baseline." />
          )}
        </div>

        {/* Delay Reasons Breakdown */}
        <div className={clsx(
          "p-5 rounded-2xl border flex flex-col justify-between",
          isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="mb-2">
            <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
              Delay Root Causes
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Breakdown by root-cause category
            </p>
          </div>

          {delayPieData.length > 0 ? (
            <div className="space-y-4">
              <div className="w-full h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={delayPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {delayPieData.map((_: any, idx: number) => (
                        <Cell key={idx} fill={DELAY_COLORS[idx % DELAY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#0f172a' : '#ffffff',
                        borderColor: isDark ? '#334155' : '#cbd5e1',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(_v: any, _n: any, props: any) => [`${props.payload.pct}% (${props.payload.value} tasks)`, props.payload.name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-800/50 max-h-36 overflow-y-auto">
                {delayPieData.map((d: any, idx: number) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: DELAY_COLORS[idx % DELAY_COLORS.length] }}
                      />
                      <span className="text-slate-300 truncate">{d.name}</span>
                    </span>
                    <span className="font-mono text-slate-400 shrink-0 font-semibold">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="No delay categories" message="No delay causes identified." />
          )}
        </div>
      </div>

      {/* 3-Column Intelligence & Operational Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 1. PROGRESSIQ Intelligence Recommendations */}
        <div className={clsx(
          "p-5 rounded-2xl border space-y-3",
          isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400">
                <Sparkles className="w-4 h-4" />
              </div>
              <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                PROGRESSIQ Intelligence
              </h2>
            </div>
            <span className="text-[10px] uppercase font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              AI Powered
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            AI-extracted insights from schedule topology, DPR logs, and evidence cross-referencing.
          </p>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {(dashboard.recommendations || []).length > 0 ? (
              dashboard.recommendations.map((rec: string, i: number) => (
                <div
                  key={i}
                  className={clsx(
                    "p-3 rounded-xl border flex items-start gap-2.5 text-xs transition-all",
                    isDark ? "bg-slate-950/60 border-slate-800/80 text-slate-200" : "bg-slate-50 border-slate-200 text-slate-800"
                  )}
                >
                  <ArrowRight className="w-3.5 h-3.5 text-purple-400 mt-0.5 shrink-0" />
                  <p className="leading-relaxed font-medium">{rec}</p>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No active recommendations. Run AI Extraction on field reports to generate insights.
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Avg Match Confidence:</span>
            <span className="font-mono font-bold text-purple-400">
              {dashboard.ai_match_confidence_avg ? `${dashboard.ai_match_confidence_avg}%` : '—'}
            </span>
          </div>
        </div>

        {/* 2. Top Critical Risks */}
        <div className={clsx(
          "p-5 rounded-2xl border space-y-3",
          isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                Critical & High Risks
              </h2>
            </div>
            <Link to="/risks" className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
              View All ({dashboard.risk_summary?.total || 0}) <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Rule-based risk detection with explicit causal reasoning.
          </p>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {(dashboard.top_risks || []).length > 0 ? (
              dashboard.top_risks.map((r: any) => (
                <div
                  key={r.id}
                  className={clsx(
                    "p-3 rounded-xl border space-y-1.5 transition-all",
                    isDark ? "bg-slate-900/90 border-slate-800 hover:border-rose-500/40" : "bg-slate-50 border-slate-200 hover:border-rose-400"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <RiskBadge level={r.level} />
                    <span className="text-[10px] text-slate-500 truncate">{r.category}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-200 leading-tight">
                    {r.title.replace(/^(CRITICAL|HIGH|MEDIUM|LOW) RISK:\s*/i, '')}
                  </p>
                  {r.affected_dependency && (
                    <p className="text-[10px] text-amber-400/90 leading-tight">
                      ↳ Dependency: {r.affected_dependency}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No active critical risks detected.
              </div>
            )}
          </div>
        </div>

        {/* 3. Upcoming Milestones & Verification Queue Feed */}
        <div className={clsx(
          "p-5 rounded-2xl border space-y-3",
          isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400">
                <Clock className="w-4 h-4" />
              </div>
              <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                Upcoming Milestones
              </h2>
            </div>
            <Link to="/schedule" className="text-xs font-semibold text-blue-400 hover:text-blue-300">
              {dashboard.milestone_count} Total
            </Link>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Major project deadlines and critical milestone completion status.
          </p>

          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {(dashboard.upcoming_milestones || []).length > 0 ? (
              dashboard.upcoming_milestones.map((m: any) => (
                <div
                  key={m.id}
                  className={clsx(
                    "p-3 rounded-xl border space-y-2 transition-all",
                    isDark ? "bg-slate-900/90 border-slate-800" : "bg-slate-50 border-slate-200"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-200 leading-tight min-w-0 flex-1">
                      {m.activity_name}
                    </p>
                    <span className="font-mono text-xs font-bold text-blue-400 shrink-0">
                      {m.actual_progress}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, m.actual_progress)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>Due: {m.planned_finish ? new Date(m.planned_finish).toLocaleDateString('en-IN') : 'TBD'}</span>
                    <span className="font-mono">{m.activity_id}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                All milestones are complete or none scheduled.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
