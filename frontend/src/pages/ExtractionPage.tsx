/**
 * AI Extraction Page — Run and view AI-extracted structured data from field reports
 */
import { useState, useEffect } from 'react'
import { Cpu, Play, ChevronDown, ChevronUp, Info } from 'lucide-react'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import {
  PageHeader, LoadingSpinner, ErrorBox, SuccessBox,
  EmptyState, WarningBox, StatusBadge, ConfidenceBar, RiskBadge
} from '../components/ui'

export default function ExtractionPage() {
  const { projectId } = useProject()
  const [reports, setReports] = useState<any[]>([])
  const [extractions, setExtractions] = useState<Record<number, any[]>>({})
  const [running, setRunning] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchReports = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await apiService.listFieldReports(projectId)
      setReports(data)
      // Fetch existing extractions for each report
      for (const r of data) {
        try {
          const exts = await apiService.getExtractions(r.id)
          setExtractions(prev => ({ ...prev, [r.id]: exts }))
        } catch { /* no extractions yet */ }
      }
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchReports() }, [projectId])

  const handleExtract = async (reportId: number) => {
    setRunning(reportId); setError(''); setSuccess('')
    try {
      const result = await apiService.extractFromReport(reportId)
      setSuccess(`AI extracted ${result.extractions_created} updates from report (provider: ${result.ai_provider})`)
      setExtractions(prev => ({ ...prev, [reportId]: result.extractions }))
    } catch (e: any) { setError(e.message) }
    finally { setRunning(null) }
  }

  if (!projectId) return <WarningBox message="No project selected. Load the Demo Project from the Overview page first." />

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI Extraction"
        subtitle="Extract structured activity updates from unstructured field reports"
      />

      {/* Explainer */}
      <div className="card bg-slate-800/40 border-slate-700/40">
        <div className="flex items-start gap-3">
          <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-400 space-y-1">
            <p><strong className="text-slate-300">How it works:</strong> The AI reads each field report, identifies activity mentions, and extracts structured fields like status, progress percentage, delay reason, and risk level.</p>
            <p><strong className="text-slate-300">AI Provider:</strong> Currently using <span className="text-cyan-400 font-mono">mock</span> mode (keyword analysis). Set <code className="text-cyan-400">AI_PROVIDER=gemini</code> and add your <code className="text-cyan-400">GEMINI_API_KEY</code> in <code className="text-cyan-400">.env</code> for real AI extraction.</p>
            <p><strong className="text-slate-300">Distinction:</strong> Fields marked <span className="text-cyan-400">AI Extracted</span> come from the AI. Fields marked <span className="text-green-400">Human Verified</span> have been reviewed.</p>
          </div>
        </div>
      </div>

      {error && <ErrorBox message={error} />}
      {success && <SuccessBox message={success} />}

      {loading ? <LoadingSpinner text="Loading field reports…" /> : reports.length === 0 ? (
        <EmptyState
          icon={<Cpu className="w-12 h-12" />}
          title="No field reports to process"
          message="Upload a field report first, or load the Demo Project."
        />
      ) : (
        <div className="space-y-4">
          {reports.map(r => {
            const exts = extractions[r.id] || []
            const isRunning = running === r.id

            return (
              <div key={r.id} className="card">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-slate-200 font-medium">{r.filename}</p>
                    <p className="text-slate-500 text-xs">{r.source_label} · {exts.length} extractions</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {exts.length > 0 && (
                      <button
                        onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        {expanded === r.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {expanded === r.id ? 'Hide' : 'View'} Extractions
                      </button>
                    )}
                    <button
                      onClick={() => handleExtract(r.id)}
                      disabled={isRunning}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {isRunning ? 'Extracting…' : exts.length > 0 ? 'Re-extract' : 'Run AI Extraction'}
                    </button>
                  </div>
                </div>

                {/* Extraction results */}
                {expanded === r.id && exts.length > 0 && (
                  <div className="space-y-3 mt-3 pt-3 border-t border-slate-700/30">
                    {exts.map((ext: any, i: number) => (
                      <div key={ext.id || i} className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/40">
                        {/* Header row */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-500 text-[9px] font-bold uppercase tracking-wider border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 rounded">AI Extracted</span>
                            {ext.status && <StatusBadge status={ext.status.toLowerCase().replace(' ', '_')} />}
                            {ext.risk_level && <RiskBadge level={ext.risk_level.toLowerCase()} />}
                          </div>
                          <ConfidenceBar score={ext.extraction_confidence || 0} />
                        </div>

                        {/* Description */}
                        <p className="text-slate-200 text-sm font-medium mb-2">
                          {ext.activity_description || '(No description extracted)'}
                        </p>

                        {/* Fields grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                          <div>
                            <p className="text-slate-600 text-[9px] uppercase">Progress</p>
                            <p className="text-slate-300 text-sm font-mono">{ext.progress != null ? `${ext.progress}%` : '—'}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 text-[9px] uppercase">Delay Category</p>
                            <p className="text-slate-300 text-sm">{ext.delay_category || '—'}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-slate-600 text-[9px] uppercase">Delay Reason</p>
                            <p className="text-slate-300 text-xs">{ext.delay_reason || '—'}</p>
                          </div>
                        </div>

                        {/* Source traceability */}
                        {ext.source_text && (
                          <div className="mt-2 pt-2 border-t border-slate-800">
                            <p className="text-slate-600 text-[9px] uppercase mb-1">Source Text (from report)</p>
                            <p className="text-slate-500 text-xs italic leading-relaxed">
                              "{ext.source_text.slice(0, 200)}{ext.source_text.length > 200 ? '…' : ''}"
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
