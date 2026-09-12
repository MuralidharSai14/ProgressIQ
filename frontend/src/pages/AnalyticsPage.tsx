/**
 * Analytics / Reports Page — Progress charts and variance analysis
 */
import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { BarChart3, RefreshCw } from 'lucide-react'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { PageHeader, LoadingSpinner, ErrorBox, EmptyState, WarningBox, VarianceDisplay, StatusBadge } from '../components/ui'

export default function AnalyticsPage() {
  const { projectId } = useProject()
  const [progress, setProgress] = useState<any[]>([])
  const [dashboard, setDashboard] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchData = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [p, d] = await Promise.all([
        apiService.getProgress(projectId),
        apiService.getDashboard(projectId),
      ])
      setProgress(p.activities || [])
      setDashboard(d)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [projectId])

  // Filter to L3+ for charts
  const chartData = progress.filter(a => a.level >= 3 && a.level <= 4).map(a => ({
    name: a.activity_name.length > 30 ? a.activity_name.slice(0, 30) + '…' : a.activity_name,
    Planned: a.planned,
    Actual: a.actual,
    Variance: parseFloat(a.variance.toFixed(1)),
  }))

  if (!projectId) return <WarningBox message="No project selected. Load the Demo Project from the Overview page first." />

  return (
    <div className="space-y-5">
      <PageHeader title="Reports & Analytics" subtitle="Planned vs actual progress analysis">
        <button onClick={fetchData} className="btn-secondary text-xs px-3 py-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </PageHeader>

      {error && <ErrorBox message={error} />}
      {loading ? <LoadingSpinner text="Loading analytics…" /> : (
        <>
          {/* Summary stats */}
          {dashboard && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Activities', value: dashboard.total_activities },
                { label: 'Completed', value: dashboard.completed_count },
                { label: 'Delayed', value: dashboard.delayed_count, highlight: dashboard.delayed_count > 0 },
                { label: 'Not Started', value: dashboard.not_started_count },
              ].map(s => (
                <div key={s.label} className="card text-center">
                  <p className={`text-2xl font-bold ${s.highlight ? 'text-red-400' : 'text-white'}`}>{s.value}</p>
                  <p className="text-slate-400 text-xs mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Main chart */}
          {chartData.length > 0 ? (
            <div className="card">
              <p className="section-title">Planned vs Actual Progress — Level 3 & 4 Activities</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    angle={-40}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v: any) => [`${v}%`]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 12 }} />
                  <Bar dataKey="Planned" fill="#475569" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Actual" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={<BarChart3 className="w-12 h-12" />} title="No data" message="Load the Demo Project to see charts." />
          )}

          {/* Variance chart */}
          {chartData.length > 0 && (
            <div className="card">
              <p className="section-title">Progress Variance (Actual − Planned)</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} unit="%" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    formatter={(v: any) => [`${v}%`, 'Variance']}
                  />
                  <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                  <Bar dataKey="Variance" radius={[3, 3, 0, 0]}
                    fill="#ef4444"
                    label={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Detailed table */}
          {progress.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-700/50">
                <p className="section-title mb-0">Activity Detail Table</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-900/50 border-b border-slate-700/50">
                      {['Activity', 'Level', 'Planned%', 'Actual%', 'Variance', 'Status'].map(h => (
                        <th key={h} className="text-left py-2.5 px-3 text-slate-400 text-xs font-medium uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {progress.map((a, i) => (
                      <tr key={i} className="border-b border-slate-800/40 hover:bg-slate-800/20">
                        <td className="py-2 px-3 text-slate-200 text-xs max-w-xs">
                          <span style={{ marginLeft: `${(a.level - 1) * 12}px` }}>
                            {a.is_milestone && <span className="text-yellow-400 mr-1">★</span>}
                            {a.activity_name}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-xs">L{a.level}</td>
                        <td className="py-2 px-3 text-slate-300 font-mono text-xs">{a.planned}%</td>
                        <td className="py-2 px-3 text-slate-300 font-mono text-xs">{a.actual}%</td>
                        <td className="py-2 px-3"><VarianceDisplay variance={a.variance} /></td>
                        <td className="py-2 px-3"><StatusBadge status={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
