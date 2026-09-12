/**
 * PROGRESSIQ — Overview / Dashboard Page
 * The main screen. Shows the complete project health at a glance.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import {
  Zap, RefreshCw, TrendingDown, Activity, AlertTriangle,
  Clock, Target, Brain, ArrowRight, Play
} from 'lucide-react'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import {
  LoadingSpinner, ErrorBox, HealthBadge, StatCard, VarianceDisplay,
  ProgressBar, EmptyState, RiskBadge
} from '../components/ui'

const DELAY_COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#8b5cf6', '#06b6d4']

export default function OverviewPage() {
  const { projectId, setProject } = useProject()
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [error, setError] = useState('')
  const [demoMsg, setDemoMsg] = useState('')
  const navigate = useNavigate()

  const loadDashboard = useCallback(async (id: number) => {
    setLoading(true)
    setError('')
    try {
      const data = await apiService.getDashboard(id)
      setDashboard(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (projectId) loadDashboard(projectId)
  }, [projectId, loadDashboard])

  const handleLoadDemo = async () => {
    setDemoLoading(true)
    setDemoMsg('')
    setError('')
    try {
      const result = await apiService.loadDemo()
      if (result.success) {
        setProject(result.project_id, result.project_name)
        setDemoMsg(`✓ Demo loaded: ${result.activities_count} activities, ${result.risks} risks detected`)
        await loadDashboard(result.project_id)
      } else {
        setError(result.error || 'Demo load failed')
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDemoLoading(false)
    }
  }

  // No project selected state
  if (!projectId && !loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-8">
        {/* Hero */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-14 h-14 bg-cyan-600/20 border border-cyan-500/40 rounded-2xl flex items-center justify-center">
              <Zap className="w-7 h-7 text-cyan-400" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">PROGRESSIQ</h1>
          <p className="text-cyan-400 text-lg font-medium mb-1">Project Progress Intelligence</p>
          <p className="text-slate-400 max-w-lg text-sm">
            AI-powered planning-to-execution bridge for infrastructure projects.
            Connects what was planned with what is actually happening.
          </p>
        </div>

        {/* Core message */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl w-full">
          {[
            { icon: '📋', label: 'Planned Schedule', sub: 'Excel / CSV upload' },
            { icon: '🤖', label: 'AI Extraction', sub: 'PDF / Text reports' },
            { icon: '📊', label: 'Project Intelligence', sub: 'Gaps · Risks · Actions' },
          ].map(item => (
            <div key={item.label} className="card text-center">
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="text-white text-sm font-semibold">{item.label}</p>
              <p className="text-slate-500 text-xs mt-1">{item.sub}</p>
            </div>
          ))}
        </div>

        {/* Demo button — the most important element */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handleLoadDemo}
            disabled={demoLoading}
            className="flex items-center gap-3 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-bold px-8 py-4 rounded-xl transition-all duration-200 shadow-lg shadow-cyan-500/20 disabled:opacity-50 text-base"
          >
            <Play className="w-5 h-5" />
            {demoLoading ? 'Loading Demo Project...' : 'Load Demo Project'}
          </button>
          <p className="text-slate-500 text-xs">
            Instantly load a complete infrastructure project with AI-processed field updates
          </p>
          {demoMsg && <p className="text-green-400 text-sm">{demoMsg}</p>}
          {error && <ErrorBox message={error} />}
        </div>

        <div className="text-center">
          <p className="text-slate-600 text-xs">— or —</p>
          <button
            onClick={() => navigate('/settings')}
            className="text-cyan-500 hover:text-cyan-400 text-sm mt-2 underline underline-offset-2"
          >
            Create a new project manually
          </button>
        </div>
      </div>
    )
  }

  if (loading) return <LoadingSpinner text="Loading project dashboard..." />

  if (error) return (
    <div className="space-y-4">
      <ErrorBox message={error} />
      <button onClick={() => projectId && loadDashboard(projectId)} className="btn-secondary">
        <RefreshCw className="w-4 h-4" /> Retry
      </button>
    </div>
  )

  if (!dashboard) return null

  // ── Data preparation for charts ────────────────────────────────────────────

  const progressChartData = (dashboard.delayed_activities || []).slice(0, 8).map((a: any) => ({
    name: a.activity_name.length > 25 ? a.activity_name.slice(0, 25) + '…' : a.activity_name,
    Planned: a.planned_progress,
    Actual: a.actual_progress,
  }))

  const delayPieData = (dashboard.top_delay_reasons || []).map((d: any) => ({
    name: d.category,
    value: d.count,
    pct: d.percentage,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{dashboard.project_name}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{dashboard.organization} · {dashboard.location}</p>
        </div>
        <div className="flex items-center gap-3">
          <HealthBadge health={dashboard.overall_health} />
          <button
            onClick={() => projectId && loadDashboard(projectId)}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={handleLoadDemo}
            disabled={demoLoading}
            className="btn-primary text-xs px-3 py-1.5"
          >
            <Play className="w-3.5 h-3.5" /> {demoLoading ? 'Loading…' : 'Reload Demo'}
          </button>
        </div>
      </div>

      {demoMsg && <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2">{demoMsg}</div>}

      {/* Key Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard
          title="Planned Progress"
          value={`${dashboard.planned_progress}%`}
          color="white"
          icon={<Target className="w-4 h-4" />}
        />
        <StatCard
          title="Actual Progress"
          value={`${dashboard.actual_progress}%`}
          color={dashboard.actual_progress >= dashboard.planned_progress ? 'green' : 'red'}
          icon={<Activity className="w-4 h-4" />}
        />
        <StatCard
          title="Variance"
          value={`${dashboard.progress_variance > 0 ? '+' : ''}${dashboard.progress_variance}%`}
          color={dashboard.progress_variance >= 0 ? 'green' : dashboard.progress_variance > -10 ? 'yellow' : 'red'}
          icon={<TrendingDown className="w-4 h-4" />}
        />
        <StatCard
          title="Delayed Activities"
          value={dashboard.delayed_count}
          color={dashboard.delayed_count === 0 ? 'green' : 'red'}
          icon={<AlertTriangle className="w-4 h-4" />}
          subtitle={`of ${dashboard.total_activities} total`}
        />
        <StatCard
          title="Active Risks"
          value={dashboard.risk_summary?.total || 0}
          color={dashboard.risk_summary?.critical > 0 ? 'red' : 'yellow'}
          icon={<AlertTriangle className="w-4 h-4" />}
          subtitle={`${dashboard.risk_summary?.critical || 0} critical`}
        />
        <StatCard
          title="Review Queue"
          value={dashboard.pending_reviews}
          color={dashboard.pending_reviews > 0 ? 'yellow' : 'green'}
          icon={<Brain className="w-4 h-4" />}
          subtitle="AI matches pending"
        />
      </div>

      {/* Progress bars overview */}
      <div className="card">
        <p className="section-title">Overall Project Progress</p>
        <ProgressBar planned={dashboard.planned_progress} actual={dashboard.actual_progress} />
        <div className="flex items-center gap-6 mt-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-500 inline-block"/>Planned {dashboard.planned_progress}%</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-500 inline-block"/>Actual {dashboard.actual_progress}%</span>
          <span>Variance: <VarianceDisplay variance={dashboard.progress_variance} /></span>
          <span>{dashboard.completed_count} completed · {dashboard.not_started_count} not started</span>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Planned vs Actual Bar Chart */}
        <div className="card lg:col-span-2">
          <p className="section-title">Planned vs Actual — Delayed Activities</p>
          {progressChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={progressChartData} margin={{ top: 5, right: 10, left: -20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0' }}
                  formatter={(v: any) => [`${v}%`]}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }} />
                <Bar dataKey="Planned" fill="#475569" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Actual" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No delayed activities" message="All activities are on track." />
          )}
        </div>

        {/* Delay Reasons Pie */}
        <div className="card">
          <p className="section-title">Top Delay Reasons</p>
          {delayPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie
                    data={delayPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {delayPieData.map((_: any, i: number) => (
                      <Cell key={i} fill={DELAY_COLORS[i % DELAY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(_v: any, _n: any, props: any) => [`${props.payload.pct}%`, props.payload.name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-1">
                {delayPieData.map((d: any, i: number) => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: DELAY_COLORS[i % DELAY_COLORS.length] }} />
                      <span className="text-slate-300">{d.name}</span>
                    </span>
                    <span className="text-slate-400 font-mono">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState title="No delay data" message="No delayed activities with identified reasons." />
          )}
        </div>
      </div>

      {/* Bottom row: Risks + Recommendations + Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Risks */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title mb-0">Top Risks</p>
            <button onClick={() => navigate('/risks')} className="text-cyan-500 hover:text-cyan-400 text-xs flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {(dashboard.top_risks || []).length > 0 ? (
            <div className="space-y-2">
              {(dashboard.top_risks || []).slice(0, 4).map((r: any) => (
                <div key={r.id} className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/30">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <RiskBadge level={r.level} />
                    <span className="text-slate-500 text-[10px]">{r.category}</span>
                  </div>
                  <p className="text-slate-300 text-xs font-medium leading-tight">{r.title.replace(/^(CRITICAL|HIGH|MEDIUM|LOW) RISK:\s*/i, '')}</p>
                  {r.affected_dependency && (
                    <p className="text-slate-500 text-[10px] mt-1">↳ {r.affected_dependency}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No active risks" message="No risks detected." />
          )}
        </div>

        {/* Upcoming Milestones */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title mb-0">Upcoming Milestones</p>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          {(dashboard.upcoming_milestones || []).length > 0 ? (
            <div className="space-y-2">
              {dashboard.upcoming_milestones.map((m: any) => (
                <div key={m.id} className="bg-slate-900/50 rounded-lg p-2.5 border border-slate-700/30">
                  <p className="text-slate-300 text-xs font-medium">{m.activity_name}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className="text-slate-500 text-[10px]">Due: {m.planned_finish?.slice(0, 10)}</span>
                    <span className="text-cyan-400 text-[10px] font-mono">{m.actual_progress}%</span>
                  </div>
                  <div className="mt-1 bg-slate-700 rounded-full h-1">
                    <div
                      className="h-1 rounded-full bg-cyan-500"
                      style={{ width: `${m.actual_progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No upcoming milestones" message="All milestones are complete or none exist." />
          )}
        </div>

        {/* AI Recommendations */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-cyan-400" />
            <p className="section-title mb-0">Recommended Attention</p>
          </div>
          <p className="text-slate-500 text-[10px] mb-3 italic">
            AI-generated suggestions based on detected conditions. Not a substitute for expert judgement.
          </p>
          {(dashboard.recommendations || []).length > 0 ? (
            <div className="space-y-2">
              {dashboard.recommendations.map((rec: string, i: number) => (
                <div key={i} className="flex items-start gap-2 bg-cyan-500/5 border border-cyan-500/15 rounded-lg p-2.5">
                  <span className="text-cyan-500 text-xs shrink-0 mt-0.5">→</span>
                  <p className="text-slate-300 text-xs leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No recommendations" message="Load demo or process field reports to generate recommendations." />
          )}
          <div className="mt-3 pt-3 border-t border-slate-700/30">
            <p className="text-slate-600 text-[10px]">
              AI Match Confidence Avg: <span className="text-cyan-500 font-mono">{dashboard.ai_match_confidence_avg?.toFixed(1) || '--'}%</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
