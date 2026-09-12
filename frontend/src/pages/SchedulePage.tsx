/**
 * Schedule Page — Upload and browse the project schedule (L1-L6 hierarchy)
 */
import { useState, useEffect, useRef } from 'react'
import { Calendar, Upload, Search } from 'lucide-react'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import {
  PageHeader, LoadingSpinner, ErrorBox, SuccessBox,
  StatusBadge, VarianceDisplay, EmptyState, WarningBox
} from '../components/ui'

const LEVEL_COLORS: Record<number, string> = {
  1: 'text-purple-400 bg-purple-500/10',
  2: 'text-blue-400 bg-blue-500/10',
  3: 'text-cyan-400 bg-cyan-500/10',
  4: 'text-teal-400 bg-teal-500/10',
  5: 'text-green-400 bg-green-500/10',
  6: 'text-yellow-400 bg-yellow-500/10',
}

export default function SchedulePage() {
  const { projectId } = useProject()
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchSchedule = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await apiService.getSchedule(projectId)
      setActivities(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSchedule() }, [projectId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !projectId) return
    setUploading(true)
    setError('')
    setSuccess('')
    try {
      const result = await apiService.uploadSchedule(projectId, file)
      setSuccess(result.message)
      await fetchSchedule()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const filtered = activities.filter(a => {
    const matchSearch = !search ||
      a.activity_name.toLowerCase().includes(search.toLowerCase()) ||
      a.activity_id.toLowerCase().includes(search.toLowerCase())
    const matchLevel = !filterLevel || String(a.level) === filterLevel
    const matchStatus = !filterStatus || a.status === filterStatus
    return matchSearch && matchLevel && matchStatus
  })

  if (!projectId) return (
    <WarningBox message="No project selected. Load the Demo Project from the Overview page first." />
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Project Schedule"
        subtitle="L1–L6 activity hierarchy with planned vs actual progress"
      >
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-primary"
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading…' : 'Upload Schedule'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={handleUpload}
        />
      </PageHeader>

      {/* Upload hint */}
      <div className="card bg-cyan-500/5 border-cyan-500/20">
        <p className="text-cyan-300 text-xs">
          <strong>Upload format:</strong> CSV or Excel with columns: activity_id, activity_name, level, planned_start, planned_finish, planned_progress, actual_progress, dependency, milestone, status.
          See <code className="text-cyan-400">data/sample/sample_schedule.csv</code> for an example.
        </p>
      </div>

      {error && <ErrorBox message={error} />}
      {success && <SuccessBox message={success} />}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search activities…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-9"
          />
        </div>
        <select
          value={filterLevel}
          onChange={e => setFilterLevel(e.target.value)}
          className="input-field w-36"
        >
          <option value="">All Levels</option>
          {[1,2,3,4,5,6].map(l => <option key={l} value={l}>Level {l}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="input-field w-40"
        >
          <option value="">All Status</option>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="delayed">Delayed</option>
          <option value="completed">Completed</option>
        </select>
        <span className="text-slate-500 text-xs">{filtered.length} of {activities.length}</span>
      </div>

      {/* Table */}
      {loading ? <LoadingSpinner text="Loading schedule…" /> : (
        activities.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-12 h-12" />}
            title="No schedule data"
            message="Upload a CSV/Excel schedule file or load the Demo Project to see activities here."
          />
        ) : (
          <div className="card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 bg-slate-900/50">
                    {['ID', 'Level', 'Activity Name', 'Planned Start', 'Planned Finish', 'Planned%', 'Actual%', 'Variance', 'Status', 'Dependency'].map(h => (
                      <th key={h} className="text-left py-3 px-3 text-slate-400 font-medium text-xs uppercase tracking-wide whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((a, _i) => (
                    <tr
                      key={a.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                      style={{ paddingLeft: `${(a.level - 1) * 8}px` }}
                    >
                      <td className="py-2.5 px-3 font-mono text-xs text-slate-300">{a.activity_id}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${LEVEL_COLORS[a.level] || 'text-slate-400'}`}>
                          L{a.level}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 max-w-xs">
                        <span style={{ paddingLeft: `${(a.level - 1) * 12}px` }}>
                          {a.is_milestone && <span className="text-yellow-400 mr-1">★</span>}
                          {a.activity_name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-xs whitespace-nowrap">
                        {a.planned_start ? new Date(a.planned_start).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 text-xs whitespace-nowrap">
                        {a.planned_finish ? new Date(a.planned_finish).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono text-xs">{a.planned_progress}%</td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono text-xs">{a.actual_progress}%</td>
                      <td className="py-2.5 px-3">
                        <VarianceDisplay variance={a.progress_variance} />
                      </td>
                      <td className="py-2.5 px-3"><StatusBadge status={a.status} /></td>
                      <td className="py-2.5 px-3 text-slate-500 text-xs">{a.dependency || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  )
}
