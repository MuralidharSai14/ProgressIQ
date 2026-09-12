/**
 * PROGRESSIQ — Schedule Baseline Page
 * Comprehensive L1–L6 WBS hierarchical schedule viewer with planned vs actual metrics,
 * variance detection, milestone indicators, and drag-and-drop upload.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, Upload, Search,
  FileSpreadsheet, RefreshCw, Star,
  ChevronRight, AlertTriangle, CheckCircle2
} from 'lucide-react'
import clsx from 'clsx'
import apiService, { type ScheduleUploadSummary } from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import {
  PageHeader, LoadingSpinner, EmptyState, WarningBox,
  StatusBadge, VarianceDisplay, Modal,
  btnPrimary, btnSecondary, inputField, selectField
} from '../components/ui'

const LEVEL_CONFIG: Record<number, { label: string; badge: string; indent: number }> = {
  1: { label: 'L1', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30', indent: 0 },
  2: { label: 'L2', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30', indent: 12 },
  3: { label: 'L3', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', indent: 24 },
  4: { label: 'L4', badge: 'bg-teal-500/15 text-teal-300 border-teal-500/30', indent: 36 },
  5: { label: 'L5', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', indent: 48 },
  6: { label: 'L6', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30', indent: 60 },
}

export default function SchedulePage() {
  const navigate = useNavigate()
  const { projectId } = useProject()
  const { theme } = useTheme()
  const { success, error } = useToast()
  const isDark = theme === 'dark'

  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadSummary, setUploadSummary] = useState<ScheduleUploadSummary | null>(null)
  const [showSummaryModal, setShowSummaryModal] = useState(false)

  // Filters & Search
  const [search, setSearch] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [onlyMilestones, setOnlyMilestones] = useState(false)
  const [onlyDelayed, setOnlyDelayed] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 25

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchSchedule = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const data = await apiService.getSchedule(projectId)
      setActivities(data || [])
    } catch (e: any) {
      error(e.message || 'Failed to load project schedule')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSchedule()
  }, [projectId])

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || !projectId) return
    setUploading(true)
    try {
      const result = await apiService.uploadSchedule(projectId, selectedFile)
      setUploadSummary(result)
      setShowUploadModal(false)
      setShowSummaryModal(true)
      if (result.errors_count > 0) {
        error(`Imported ${result.activities_imported} activities with ${result.errors_count} row warnings.`)
      } else {
        success(result.message || `Successfully imported ${result.activities_imported} activities.`)
      }
      setSelectedFile(null)
      await fetchSchedule()
    } catch (e: any) {
      error(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Filtered dataset
  const filteredActivities = useMemo(() => {
    return activities.filter(a => {
      const matchSearch = !search ||
        a.activity_name?.toLowerCase().includes(search.toLowerCase()) ||
        a.activity_id?.toLowerCase().includes(search.toLowerCase()) ||
        a.dependency?.toLowerCase().includes(search.toLowerCase())

      const matchLevel = !filterLevel || String(a.level) === filterLevel
      const matchStatus = !filterStatus || a.status === filterStatus
      const matchMilestone = !onlyMilestones || a.is_milestone
      const matchDelayed = !onlyDelayed || a.status === 'delayed' || a.progress_variance < 0

      return matchSearch && matchLevel && matchStatus && matchMilestone && matchDelayed
    })
  }, [activities, search, filterLevel, filterStatus, onlyMilestones, onlyDelayed])

  // Paginated activities
  const totalPages = Math.ceil(filteredActivities.length / pageSize) || 1
  const paginatedActivities = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredActivities.slice(start, start + pageSize)
  }, [filteredActivities, currentPage])

  // Summary counts
  const milestoneCount = activities.filter(a => a.is_milestone).length
  const delayedCount = activities.filter(a => a.status === 'delayed').length

  if (!projectId) {
    return (
      <WarningBox message="No project selected. Open the Projects directory or select a project in the top header to view the schedule baseline." />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Schedule Baseline"
        subtitle="Work Breakdown Structure (L1–L6) with planned vs actual progress tracking and dependency mappings"
      >
        <button
          onClick={fetchSchedule}
          className={btnSecondary}
          title="Refresh schedule"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
        <button
          onClick={() => setShowUploadModal(true)}
          className={btnPrimary}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Schedule
        </button>
      </PageHeader>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total WBS Tasks</p>
          <p className="text-xl font-extrabold text-white mt-0.5">{activities.length}</p>
        </div>
        <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Milestones</p>
          <p className="text-xl font-extrabold text-amber-400 mt-0.5">{milestoneCount}</p>
        </div>
        <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Delayed Activities</p>
          <p className={clsx("text-xl font-extrabold mt-0.5", delayedCount > 0 ? "text-rose-400" : "text-emerald-400")}>
            {delayedCount}
          </p>
        </div>
        <div className={clsx("p-3.5 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hierarchy Depth</p>
          <p className="text-xl font-extrabold text-blue-400 mt-0.5">L1 to L6</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={clsx(
        "p-3 rounded-2xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3",
        isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      )}>
        <div className="flex-1 flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by ID, name, or dependency..."
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              className={clsx(inputField, "pl-8 text-xs")}
            />
          </div>

          {/* Level Filter */}
          <select
            value={filterLevel}
            onChange={e => { setFilterLevel(e.target.value); setCurrentPage(1); }}
            className={clsx(selectField, "w-28 text-xs")}
          >
            <option value="">All Levels</option>
            {[1, 2, 3, 4, 5, 6].map(l => (
              <option key={l} value={l}>Level {l}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            className={clsx(selectField, "w-32 text-xs")}
          >
            <option value="">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="delayed">Delayed</option>
            <option value="completed">Completed</option>
          </select>

          {/* Toggle Pills */}
          <button
            onClick={() => { setOnlyMilestones(!onlyMilestones); setCurrentPage(1); }}
            className={clsx(
              "px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1",
              onlyMilestones
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : isDark ? "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200" : "bg-slate-100 border-slate-300 text-slate-600"
            )}
          >
            <Star className="w-3 h-3 text-amber-400" /> Milestones Only
          </button>

          <button
            onClick={() => { setOnlyDelayed(!onlyDelayed); setCurrentPage(1); }}
            className={clsx(
              "px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1",
              onlyDelayed
                ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                : isDark ? "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200" : "bg-slate-100 border-slate-300 text-slate-600"
            )}
          >
            <AlertTriangle className="w-3 h-3 text-rose-400" /> Delayed Only
          </button>
        </div>

        <div className="text-xs text-slate-400 shrink-0 font-medium">
          Showing {paginatedActivities.length} of {filteredActivities.length} activities
        </div>
      </div>

      {/* Main Schedule Table */}
      {loading ? (
        <LoadingSpinner text="Loading schedule baseline..." />
      ) : filteredActivities.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-12 h-12" />}
          title="No schedule activities found"
          message={search || filterLevel || filterStatus || onlyMilestones || onlyDelayed
            ? "No activities match your active filters. Try adjusting or clearing search parameters."
            : "Upload a CSV/Excel schedule file or load the Demo Project to populate the schedule baseline."}
          action={
            <button onClick={() => setShowUploadModal(true)} className={btnPrimary}>
              <Upload className="w-4 h-4" /> Upload Schedule
            </button>
          }
        />
      ) : (
        <div className={clsx(
          "rounded-2xl border overflow-hidden transition-all",
          isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={clsx(
                  "border-b font-semibold uppercase tracking-wider text-[10px] select-none",
                  isDark ? "border-slate-800 bg-slate-950/70 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"
                )}>
                  <th className="py-3 px-3 w-28">Activity ID</th>
                  <th className="py-3 px-2 w-16">Level</th>
                  <th className="py-3 px-3 min-w-[260px]">Activity Name</th>
                  <th className="py-3 px-3 w-24">Planned Dates</th>
                  <th className="py-3 px-3 w-24">Target %</th>
                  <th className="py-3 px-3 w-24">Actual %</th>
                  <th className="py-3 px-3 w-20">Variance</th>
                  <th className="py-3 px-3 w-28">Status</th>
                  <th className="py-3 px-3 w-28">Dependency</th>
                  <th className="py-3 px-3 w-16 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {paginatedActivities.map(a => {
                  const levelCfg = LEVEL_CONFIG[a.level] || LEVEL_CONFIG[3]
                  return (
                    <tr
                      key={a.id}
                      onClick={() => navigate(`/activity/${a.id}`)}
                      className={clsx(
                        "transition-colors cursor-pointer group",
                        isDark ? "hover:bg-slate-800/50" : "hover:bg-blue-50/50"
                      )}
                    >
                      {/* ID */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-300">
                        {a.activity_id}
                      </td>

                      {/* Level Badge */}
                      <td className="py-2.5 px-2">
                        <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-bold border", levelCfg.badge)}>
                          {levelCfg.label}
                        </span>
                      </td>

                      {/* Activity Name with WBS visual indent */}
                      <td className="py-2.5 px-3">
                        <div
                          className="flex items-center gap-1.5"
                          style={{ paddingLeft: `${(a.level - 1) * 8}px` }}
                        >
                          {a.is_milestone && (
                            <Star className="w-3.5 h-3.5 text-amber-400 shrink-0 fill-amber-400/30" />
                          )}
                          <span className={clsx(
                            "font-medium leading-snug group-hover:text-blue-400 transition-colors",
                            a.level <= 2 ? "font-bold text-slate-100" : "text-slate-300"
                          )}>
                            {a.activity_name}
                          </span>
                        </div>
                      </td>

                      {/* Planned Dates */}
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {a.planned_start ? new Date(a.planned_start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                        {' → '}
                        {a.planned_finish ? new Date(a.planned_finish).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                      </td>

                      {/* Planned % */}
                      <td className="py-2.5 px-3 font-mono text-slate-300 font-medium">
                        {a.planned_progress?.toFixed(1)}%
                      </td>

                      {/* Actual % */}
                      <td className="py-2.5 px-3 font-mono text-slate-300 font-medium">
                        {a.actual_progress?.toFixed(1)}%
                      </td>

                      {/* Variance */}
                      <td className="py-2.5 px-3">
                        <VarianceDisplay variance={a.progress_variance} />
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        <StatusBadge status={a.status} />
                      </td>

                      {/* Dependency */}
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] truncate max-w-[120px]">
                        {a.dependency || '—'}
                      </td>

                      {/* Details Link */}
                      <td className="py-2.5 px-3 text-right">
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all inline-block" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className={clsx(
              "px-4 py-3 border-t flex items-center justify-between text-xs",
              isDark ? "border-slate-800 bg-slate-950/40 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-600"
            )}>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className={clsx(btnSecondary, "px-2.5 py-1 text-xs disabled:opacity-40")}
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className={clsx(btnSecondary, "px-2.5 py-1 text-xs disabled:opacity-40")}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Schedule Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Schedule Baseline"
        subtitle="Import planned WBS hierarchy and timelines from Primavera P6, MS Project, or Excel"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
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
            <FileSpreadsheet className="w-10 h-10 text-blue-400 mx-auto mb-2" />
            <p className="font-bold text-sm text-slate-200">
              {selectedFile ? selectedFile.name : 'Choose Primavera P6 (.xer, .xml), CSV, or Excel Schedule'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Supports Primavera P6 (.xer, .xml), Excel (.xlsx, .xls), CSV & JSON (Up to 50MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xer,.xml,.csv,.xlsx,.xls,.json"
              onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </div>

          {/* Format Specification Guide */}
          <div className={clsx("p-3.5 rounded-xl border space-y-1.5", isDark ? "bg-slate-900/80 border-slate-800" : "bg-slate-100 border-slate-200")}>
            <p className="font-bold text-slate-300 text-xs">Expected Column Headers:</p>
            <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
              activity_id, activity_name, level (1–6), planned_start, planned_finish, planned_progress, actual_progress, dependency, milestone, status
            </p>
            <p className="text-[10px] text-slate-500 pt-1">
              Sample file available at <code className="text-blue-400">data/sample/sample_schedule.csv</code>
            </p>
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
              {uploading ? 'Importing Schedule...' : 'Import & Update Baseline'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Schedule Upload Diagnostics & Summary Modal */}
      {uploadSummary && (
        <Modal
          isOpen={showSummaryModal}
          onClose={() => setShowSummaryModal(false)}
          title="Schedule Import Summary"
          subtitle={`Import diagnostics for Project #${uploadSummary.project_id}`}
        >
          <div className="space-y-4 text-xs">
            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className={clsx("p-3 rounded-xl border", isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200")}>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Rows Processed</p>
                <p className="text-lg font-black text-slate-100 mt-0.5">{uploadSummary.total_rows_parsed}</p>
              </div>
              <div className="p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-400">
                <p className="text-[10px] font-bold uppercase">Imported</p>
                <p className="text-lg font-black mt-0.5">{uploadSummary.activities_imported}</p>
              </div>
              <div className={clsx(
                "p-3 rounded-xl border",
                uploadSummary.errors_count > 0 ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-blue-500/10 border-blue-500/20 text-blue-400"
              )}>
                <p className="text-[10px] font-bold uppercase">{uploadSummary.errors_count > 0 ? 'Warnings' : 'Milestones'}</p>
                <p className="text-lg font-black mt-0.5">
                  {uploadSummary.errors_count > 0 ? uploadSummary.errors_count : uploadSummary.milestones_count}
                </p>
              </div>
            </div>

            {/* Success Message Banner */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs">Baseline Successfully Refreshed</p>
                <p className="text-[11px] text-emerald-400/90 mt-0.5">{uploadSummary.message}</p>
              </div>
            </div>

            {/* Error Diagnostics List if any issues were detected */}
            {uploadSummary.errors && uploadSummary.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Row-by-Row Diagnostics & Skipped Rows ({uploadSummary.errors.length}):</span>
                </div>
                <div className={clsx(
                  "max-h-40 overflow-y-auto p-2.5 rounded-xl border font-mono text-[11px] space-y-1",
                  isDark ? "bg-slate-950 border-slate-800 text-amber-200/90" : "bg-amber-50/60 border-amber-200 text-amber-900"
                )}>
                  {uploadSummary.errors.map((err: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 py-0.5">
                      <span className="text-slate-500 select-none">•</span>
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className={btnPrimary}
              >
                Close & View Schedule
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
