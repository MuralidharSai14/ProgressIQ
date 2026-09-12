/**
 * PROGRESSIQ — Reports & Analytics Page
 * Earned Value Management (EVM), S-Curve Forecasting, and Schedule Variance Distribution.
 */
import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import {
  BarChart3, RefreshCw, TrendingUp, Layers, Table
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import {
  PageHeader, LoadingSpinner, EmptyState, WarningBox,
  VarianceDisplay, StatusBadge,
  btnSecondary
} from '../components/ui'
import { EVMMetricsCard, type EVMMetrics } from '../components/EVMMetricsCard'
import { SCurveChart, type SCurvePoint } from '../components/SCurveChart'

export default function AnalyticsPage() {
  const { projectId } = useProject()
  const { theme } = useTheme()
  const { error } = useToast()
  const isDark = theme === 'dark'

  const [activeTab, setActiveTab] = useState<'scurve' | 'workpackages' | 'matrix'>('scurve')
  const [progress, setProgress] = useState<any[]>([])
  const [evm, setEvm] = useState<EVMMetrics | null>(null)
  const [scurvePoints, setScurvePoints] = useState<SCurvePoint[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [p, eData, sData] = await Promise.allSettled([
        apiService.getProgress(projectId),
        apiService.getProjectEVM(projectId),
        apiService.getProjectSCurve(projectId, 12),
      ])

      if (p.status === 'fulfilled') setProgress(p.value.activities || [])
      if (eData.status === 'fulfilled') setEvm(eData.value)
      if (sData.status === 'fulfilled' && sData.value) setScurvePoints(sData.value.data || [])
    } catch (e: any) {
      error(e.message || 'Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [projectId])

  // Chart data for L3 & L4 work packages
  const chartData = progress
    .filter(a => a.level >= 3 && a.level <= 4)
    .map(a => ({
      name: a.activity_name.length > 25 ? a.activity_name.slice(0, 25) + '…' : a.activity_name,
      Planned: a.planned,
      Actual: a.actual,
      Variance: parseFloat(a.variance.toFixed(1)),
    }))

  if (!projectId) {
    return (
      <WarningBox message="No project selected. Open the Projects directory or select a project in the top header to view analytics & reports." />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Earned Value Management (EVM), S-Curve forecasting, and planned baseline vs actual progress comparison"
      >
        <button
          onClick={fetchData}
          className={btnSecondary}
          title="Refresh analytics"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </PageHeader>

      {/* EVM Metrics Overview & Forecast Dials */}
      {evm && <EVMMetricsCard metrics={evm} />}

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('scurve')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'scurve'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>EVM S-Curve Trajectory</span>
        </button>

        <button
          onClick={() => setActiveTab('workpackages')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'workpackages'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Work Package Variance</span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          <span>Detailed Activity Matrix</span>
        </button>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading analytical telemetry..." />
      ) : (
        <>
          {/* TAB 1: S-CURVE FORECASTING */}
          {activeTab === 'scurve' && (
            <div className={clsx(
              "p-5 rounded-2xl border space-y-4",
              isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
            )}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                    Earned Value S-Curve: Planned Baseline vs Verified Actual vs Projected Forecast
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Cumulative project progress trajectory with SPI speed extrapolation up to projected completion
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5 text-blue-500 font-semibold"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Planned (PV)</span>
                  <span className="flex items-center gap-1.5 text-emerald-500 font-semibold"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Earned (EV)</span>
                  <span className="flex items-center gap-1.5 text-amber-500 font-semibold"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Forecast (EAC)</span>
                </div>
              </div>

              <SCurveChart data={scurvePoints} height={340} />
            </div>
          )}

          {/* TAB 2: WORK PACKAGES VARIANCE */}
          {activeTab === 'workpackages' && (
            <div className="space-y-6">
              {chartData.length > 0 ? (
                <>
                  <div className={clsx(
                    "p-5 rounded-2xl border space-y-4",
                    isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
                  )}>
                    <div>
                      <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                        Planned Baseline vs Actual Progress — Level 3 & 4 Work Packages
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Detailed target comparison by major engineering work packages
                      </p>
                    </div>

                    <div className="w-full h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 65 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} opacity={0.5} />
                          <XAxis
                            dataKey="name"
                            tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }}
                            angle={-35}
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
                            }}
                            formatter={(v: any) => [`${v}%`]}
                          />
                          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                          <Bar dataKey="Planned" fill="#64748b" radius={[4, 4, 0, 0]} barSize={16} />
                          <Bar dataKey="Actual" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className={clsx(
                    "p-5 rounded-2xl border space-y-4",
                    isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
                  )}>
                    <div>
                      <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                        Progress Variance Deviation (Actual % − Planned Target %)
                      </h2>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Positive values indicate ahead of baseline; negative values indicate delay gap
                      </p>
                    </div>

                    <div className="w-full h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 65 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} opacity={0.5} />
                          <XAxis dataKey="name" tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                          <YAxis tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 10 }} unit="%" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: isDark ? '#0f172a' : '#ffffff',
                              borderColor: isDark ? '#334155' : '#cbd5e1',
                              borderRadius: 12,
                              fontSize: 12,
                            }}
                            formatter={(v: any) => [`${v}%`, 'Variance']}
                          />
                          <ReferenceLine y={0} stroke="#64748b" strokeDasharray="4 4" />
                          <Bar dataKey="Variance" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={16} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState icon={<BarChart3 className="w-12 h-12" />} title="No work package data" message="Import a schedule or load the demo project." />
              )}
            </div>
          )}

          {/* TAB 3: DETAILED MATRIX */}
          {activeTab === 'matrix' && progress.length > 0 && (
            <div className={clsx("rounded-2xl border overflow-hidden", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
              <div className="px-4 py-3 border-b border-slate-800/60 font-bold text-xs text-slate-300">
                Detailed Activity Progress Matrix
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={clsx("border-b font-semibold uppercase tracking-wider text-[10px]", isDark ? "border-slate-800 bg-slate-950/70 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500")}>
                      <th className="py-3 px-4">Task Name</th>
                      <th className="py-3 px-3">Level</th>
                      <th className="py-3 px-3">Target Planned %</th>
                      <th className="py-3 px-3">Actual Reported %</th>
                      <th className="py-3 px-3">Variance Gap</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {progress.map((a, i) => (
                      <tr key={i} className={clsx("transition-colors", isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50")}>
                        <td className="py-2.5 px-4 text-slate-200 font-medium">
                          <span style={{ marginLeft: `${(a.level - 1) * 8}px` }}>
                            {a.is_milestone && <span className="text-amber-400 mr-1">★</span>}
                            {a.activity_name}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono">L{a.level}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{a.planned}%</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{a.actual}%</td>
                        <td className="py-2.5 px-3">
                          <VarianceDisplay variance={a.variance} />
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={a.status} />
                        </td>
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
