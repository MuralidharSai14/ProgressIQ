/**
 * Field Reports Page — Upload and view field progress reports
 */
import { useState, useEffect, useRef } from 'react'
import { FileText, Upload, ChevronDown, ChevronUp } from 'lucide-react'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import {
  PageHeader, LoadingSpinner, ErrorBox, SuccessBox,
  EmptyState, WarningBox
} from '../components/ui'

export default function FieldReportsPage() {
  const { projectId } = useProject()
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchReports = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await apiService.listFieldReports(projectId)
      setReports(data)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchReports() }, [projectId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !projectId) return
    setUploading(true); setError(''); setSuccess('')
    try {
      const result = await apiService.uploadFieldReport(projectId, file)
      setSuccess(`Uploaded: ${result.filename} (${result.text_length} characters extracted)`)
      await fetchReports()
    } catch (e: any) { setError(e.message) }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  if (!projectId) return <WarningBox message="No project selected. Load the Demo Project from the Overview page first." />

  return (
    <div className="space-y-5">
      <PageHeader title="Field Updates" subtitle="Upload PDF or text field progress reports">
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-primary">
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading…' : 'Upload Report'}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.txt,.text" className="hidden" onChange={handleUpload} />
      </PageHeader>

      <div className="card bg-cyan-500/5 border-cyan-500/20">
        <p className="text-cyan-300 text-xs">
          Supported formats: <strong>PDF</strong> (text-based) and <strong>TXT</strong>. The AI will extract structured activity updates from the report automatically.
          See <code className="text-cyan-400">data/sample/sample_field_report.txt</code> for an example.
        </p>
      </div>

      {error && <ErrorBox message={error} />}
      {success && <SuccessBox message={success} />}

      {loading ? <LoadingSpinner text="Loading reports…" /> : reports.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-12 h-12" />}
          title="No field reports"
          message="Upload a PDF or TXT field progress report, or load the Demo Project."
        />
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <div key={r.id} className="card-hover">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-slate-200 font-medium text-sm">{r.filename}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {r.source_label || 'Field Report'} ·{' '}
                      {new Date(r.uploaded_at).toLocaleDateString('en-IN')} ·{' '}
                      <span className="uppercase font-mono text-slate-600">{r.file_type}</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {expanded === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {expanded === r.id && r.raw_text && (
                <div className="mt-3 pt-3 border-t border-slate-700/30">
                  <p className="text-slate-500 text-xs mb-2">Extracted text preview:</p>
                  <pre className="text-slate-400 text-xs bg-slate-900/60 rounded-lg p-3 max-h-64 overflow-y-auto whitespace-pre-wrap font-sans leading-relaxed">
                    {r.raw_text.slice(0, 2000)}{r.raw_text.length > 2000 ? '\n…[truncated]' : ''}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
