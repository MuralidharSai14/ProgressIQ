/**
 * PROGRESSIQ — Field Reports & Updates Page
 * Upload, browse, and inspect site daily progress reports (DPR), field logs, and PDF/text submissions.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Upload, ChevronDown, ChevronUp, Cpu,
  Calendar, RefreshCw,
  Sparkles
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import {
  PageHeader, LoadingSpinner, EmptyState, WarningBox,
  Modal, btnPrimary, btnSecondary, inputField
} from '../components/ui'

export default function FieldReportsPage() {
  const navigate = useNavigate()
  const { projectId } = useProject()
  const { theme } = useTheme()
  const { success, error } = useToast()
  const isDark = theme === 'dark'

  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [sourceLabel, setSourceLabel] = useState('Daily Progress Report (DPR)')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchReports = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await apiService.listFieldReports(projectId)
      setReports(data || [])
    } catch (e: any) {
      error(e.message || 'Failed to load field reports')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [projectId])

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !projectId) return
    setUploading(true)
    try {
      const result = await apiService.uploadFieldReport(projectId, selectedFile)
      success(`Field report uploaded: ${result.filename} (${result.text_length} characters parsed)`)
      setSelectedFile(null)
      setShowUploadModal(false)
      await fetchReports()
    } catch (e: any) {
      error(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (!projectId) {
    return (
      <WarningBox message="No project selected. Open the Projects directory or select a project in the top header to view field updates." />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Field Updates & Daily Reports"
        subtitle="Unstructured field progress reports, daily site supervisor logs, and PDF inspection documents"
      >
        <button
          onClick={fetchReports}
          className={btnSecondary}
          title="Refresh reports"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
        <button
          onClick={() => setShowUploadModal(true)}
          className={btnPrimary}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Field Report
        </button>
      </PageHeader>

      {/* Format Information Banner */}
      <div className={clsx(
        "p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs",
        isDark ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-blue-50/70 border-blue-200 text-blue-900"
      )}>
        <div className="flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-xs">AI Extraction Pipeline Ready</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              Upload standard PDF progress documents or raw text logs. The AI engine automatically parses activity mentions, status updates, progress percentages, and delay notes.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/extraction')}
          className={clsx(btnSecondary, "shrink-0 text-xs")}
        >
          <Cpu className="w-3.5 h-3.5 text-blue-400" /> Open Extraction Engine
        </button>
      </div>

      {/* Reports Feed */}
      {loading ? (
        <LoadingSpinner text="Loading field reports..." />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-12 h-12" />}
          title="No field reports uploaded yet"
          message="Upload a PDF or TXT daily progress report from your site supervisor, or load the Demo Project."
          action={
            <button onClick={() => setShowUploadModal(true)} className={btnPrimary}>
              <Upload className="w-4 h-4" /> Upload First Report
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {reports.map(r => {
            const isExpanded = expandedId === r.id
            return (
              <div
                key={r.id}
                className={clsx(
                  "p-4 rounded-2xl border transition-all space-y-3",
                  isDark ? "bg-slate-900/70 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 shadow-xs"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={clsx(
                      "p-2.5 rounded-xl shrink-0 mt-0.5",
                      r.file_type === 'pdf'
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    )}>
                      <FileText className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={clsx("font-bold text-sm truncate", isDark ? "text-slate-100" : "text-slate-900")}>
                          {r.filename}
                        </h3>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded border border-slate-700 bg-slate-800 text-slate-300">
                          {r.file_type}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                        <span className="font-semibold text-slate-300">{r.source_label || 'Daily Progress Report'}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {new Date(r.uploaded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => navigate('/extraction')}
                      className={btnSecondary}
                      title="Run or view AI extractions for this report"
                    >
                      <Cpu className="w-3.5 h-3.5 text-blue-400" />
                      <span>Process Extractions</span>
                    </button>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      className={clsx(
                        "p-2 rounded-lg border text-slate-400 hover:text-white transition-colors cursor-pointer",
                        isDark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300"
                      )}
                      title={isExpanded ? "Collapse raw text" : "Expand raw text"}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Raw Text Preview */}
                {isExpanded && (
                  <div className="pt-3 border-t border-slate-800/60 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold">Raw Text Extracted from Document:</span>
                      <span className="font-mono text-[10px]">
                        {r.raw_text?.length || 0} characters
                      </span>
                    </div>
                    <pre className={clsx(
                      "p-3.5 rounded-xl text-xs font-mono leading-relaxed overflow-x-auto max-h-64 whitespace-pre-wrap border",
                      isDark ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-100 border-slate-300 text-slate-800"
                    )}>
                      {r.raw_text || '(No text content parsed)'}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Upload Field Report Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Field Progress Report"
        subtitle="Submit a daily report (PDF or TXT) for AI extraction and schedule activity matching"
      >
        <form onSubmit={handleUpload} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Report Source Label</label>
            <input
              type="text"
              value={sourceLabel}
              onChange={e => setSourceLabel(e.target.value)}
              placeholder="e.g. Block B - Foundation DPR"
              className={inputField}
            />
          </div>

          {/* File Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all",
              selectedFile
                ? "border-blue-500 bg-blue-500/5"
                : isDark
                  ? "border-slate-700 hover:border-slate-600 bg-slate-900/40"
                  : "border-slate-300 hover:border-slate-400 bg-slate-50"
            )}
          >
            <FileText className="w-10 h-10 text-blue-400 mx-auto mb-2" />
            <p className="font-bold text-sm text-slate-200">
              {selectedFile ? selectedFile.name : 'Choose PDF or Text Report File'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports .pdf, .txt, .text files (Up to 20MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.text"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowUploadModal(false)}
              className={btnSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !selectedFile}
              className={btnPrimary}
            >
              {uploading ? 'Processing & Extracting...' : 'Upload & Parse Report'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
