/**
 * PROGRESSIQ — AI Extraction Engine Page
 * Parses unstructured field reports into structured activity updates with source text traceability.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Cpu, Play, ChevronDown, ChevronUp,
  Sparkles, ArrowRight, RefreshCw, FileText,
  Quote
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import {
  PageHeader, LoadingSpinner, EmptyState, WarningBox,
  StatusBadge, RiskBadge, ConfidenceBar,
  btnPrimary, btnSecondary
} from '../components/ui'

export default function ExtractionPage() {
  const navigate = useNavigate()
  const { projectId } = useProject()
  const { theme } = useTheme()
  const { success, error } = useToast()
  const isDark = theme === 'dark'

  const [reports, setReports] = useState<any[]>([])
  const [extractions, setExtractions] = useState<Record<number, any[]>>({})
  const [runningId, setRunningId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchReportsAndExtractions = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await apiService.listFieldReports(projectId)
      setReports(data || [])

      // Fetch existing extractions for all reports
      const extMap: Record<number, any[]> = {}
      for (const r of data || []) {
        try {
          const exts = await apiService.getExtractions(r.id)
          extMap[r.id] = exts || []
        } catch {
          extMap[r.id] = []
        }
      }
      setExtractions(extMap)

      // Auto-expand first report if it has extractions
      if (data && data.length > 0) {
        setExpandedId(data[0].id)
      }
    } catch (e: any) {
      error(e.message || 'Failed to load extraction items')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReportsAndExtractions()
  }, [projectId])

  const handleRunExtract = async (reportId: number) => {
    setRunningId(reportId)
    try {
      const result = await apiService.extractFromReport(reportId)
      success(`AI extracted ${result.extractions_created} updates from report (Provider: ${result.ai_provider})`)
      setExtractions(prev => ({ ...prev, [reportId]: result.extractions || [] }))
      setExpandedId(reportId)
    } catch (e: any) {
      error(e.message || 'Extraction failed')
    } finally {
      setRunningId(null)
    }
  }

  if (!projectId) {
    return (
      <WarningBox message="No project selected. Open the Projects directory or select a project in the top header to run AI extractions." />
    )
  }

  const totalExtractions = Object.values(extractions).reduce((acc, list) => acc + (list?.length || 0), 0)

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Extraction Engine"
        subtitle="Extract structured activity milestones, status indicators, and delay causes from raw field reports"
      >
        <button
          onClick={fetchReportsAndExtractions}
          className={btnSecondary}
          title="Refresh extractions"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
        <button
          onClick={() => navigate('/matching')}
          className={btnPrimary}
        >
          <ArrowRight className="w-3.5 h-3.5" />
          Go to Activity Matching
        </button>
      </PageHeader>

      {/* Explainer / Traceability Card */}
      <div className={clsx(
        "p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed",
        isDark ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-purple-50/60 border-purple-200 text-purple-950"
      )}>
        <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-xs">AI Extraction & Traceability Pipeline</p>
          <p className="text-[11px] text-slate-400 leading-normal">
            PROGRESSIQ analyzes informal site language, identifies specific task progress statements, and creates structured data objects. Each extracted record retains the exact source text quotation and confidence metric to ensure human traceability.
          </p>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Reports</p>
          <p className="text-xl font-extrabold text-white mt-0.5">{reports.length}</p>
        </div>
        <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Structured Extractions</p>
          <p className="text-xl font-extrabold text-purple-400 mt-0.5">{totalExtractions}</p>
        </div>
        <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pipeline Status</p>
          <p className="text-xl font-extrabold text-emerald-400 mt-0.5">Ready for Matching</p>
        </div>
      </div>

      {/* Reports and Extractions Accordion List */}
      {loading ? (
        <LoadingSpinner text="Loading AI extractions..." />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<Cpu className="w-12 h-12" />}
          title="No field reports uploaded"
          message="Upload a daily progress report (PDF or TXT) first before running AI extraction."
          action={
            <button onClick={() => navigate('/reports')} className={btnPrimary}>
              <FileText className="w-4 h-4" /> Go to Field Reports
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {reports.map(r => {
            const exts = extractions[r.id] || []
            const isRunning = runningId === r.id
            const isExpanded = expandedId === r.id

            return (
              <div
                key={r.id}
                className={clsx(
                  "rounded-2xl border transition-all overflow-hidden",
                  isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
                )}
              >
                {/* Header Row */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0 mt-0.5">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className={clsx("font-bold text-sm truncate", isDark ? "text-slate-100" : "text-slate-900")}>
                        {r.filename}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {r.source_label || 'Daily Progress Report'} · {exts.length} structured updates extracted
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {exts.length > 0 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : r.id)}
                        className={btnSecondary}
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        <span>{isExpanded ? 'Hide Extractions' : 'View Extractions'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleRunExtract(r.id)}
                      disabled={isRunning}
                      className={btnPrimary}
                    >
                      <Play className={clsx("w-3.5 h-3.5", isRunning && "animate-spin")} />
                      <span>{isRunning ? 'Processing AI...' : exts.length > 0 ? 'Re-extract' : 'Run AI Extraction'}</span>
                    </button>
                  </div>
                </div>

                {/* Extractions Grid */}
                {isExpanded && exts.length > 0 && (
                  <div className={clsx(
                    "p-4 border-t space-y-3",
                    isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50/50"
                  )}>
                    {exts.map((ext: any, idx: number) => (
                      <div
                        key={ext.id || idx}
                        className={clsx(
                          "p-4 rounded-xl border space-y-3 transition-all",
                          isDark ? "bg-slate-900/90 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 shadow-xs"
                        )}
                      >
                        {/* Top Metadata & Confidence */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded">
                              AI Extracted
                            </span>
                            {ext.status && <StatusBadge status={ext.status} />}
                            {ext.risk_level && <RiskBadge level={ext.risk_level} />}
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400 text-[11px]">Extraction Confidence:</span>
                            <ConfidenceBar score={ext.extraction_confidence || 85} />
                          </div>
                        </div>

                        {/* Extracted Description */}
                        <div>
                          <p className={clsx("font-bold text-sm", isDark ? "text-slate-100" : "text-slate-900")}>
                            {ext.activity_description || '(No description parsed)'}
                          </p>
                        </div>

                        {/* Structured Metrics Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/60 text-xs">
                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">Reported Progress</span>
                            <span className="font-mono font-bold text-blue-400">
                              {ext.progress != null ? `${ext.progress}%` : '—'}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">Delay Category</span>
                            <span className="font-medium text-slate-300">
                              {ext.delay_category || 'None'}
                            </span>
                          </div>

                          <div className="col-span-2">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block">Delay Cause / Notes</span>
                            <span className="text-slate-400">
                              {ext.delay_reason || 'No delay cited in report'}
                            </span>
                          </div>
                        </div>

                        {/* Source Traceability Snippet */}
                        {ext.source_text && (
                          <div className={clsx(
                            "p-3 rounded-lg border text-xs space-y-1",
                            isDark ? "bg-slate-950/60 border-slate-800 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-700"
                          )}>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500">
                              <Quote className="w-3 h-3 text-purple-400" />
                              <span>Source Quotation from DPR</span>
                            </div>
                            <p className="font-mono italic text-[11px] leading-relaxed">
                              "{ext.source_text}"
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
