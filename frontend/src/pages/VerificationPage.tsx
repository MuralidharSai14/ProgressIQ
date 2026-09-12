/**
 * PROGRESSIQ — Verification Queue Page
 * Human-in-the-loop governance for ambiguous progress reports, evidence gaps, and low-confidence matches.
 * Supports manual verification request creation, direct file/image uploads on queue items, and image preview lightbox.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShieldCheck, RefreshCw, CheckCircle, XCircle,
  FileQuestion, Bookmark, ChevronDown, ChevronUp,
  User, Plus, Upload, Image as ImageIcon, FileText,
  Eye
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import { useRole } from '../hooks/useRole'
import { GeotagBadge } from '../components/GeotagBadge'
import {
  PageHeader, LoadingSpinner, EmptyState, WarningBox,
  PriorityBadge, ConfidenceBadge, TripleProgressBar, EvidenceBadge,
  Modal, btnPrimary, btnSecondary, btnSuccess, btnDanger, inputField, selectField
} from '../components/ui'

export default function VerificationPage() {
  const navigate = useNavigate()
  const { projectId } = useProject()
  const { theme } = useTheme()
  const { success, error } = useToast()
  const { role, permissions } = useRole()
  const isDark = theme === 'dark'

  const [tasks, setTasks] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [decidingId, setDecidingId] = useState<number | null>(null)
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [reviewer, setReviewer] = useState('Project Manager')
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Add Verification Item Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newActivityId, setNewActivityId] = useState<string>('')
  const [newPriority, setNewPriority] = useState<string>('high')
  const [newTriggerReason, setNewTriggerReason] = useState('')
  const [newReportedProgress, setNewReportedProgress] = useState('')
  const [newConflictSummary, setNewConflictSummary] = useState('')
  const [newFile, setNewFile] = useState<File | null>(null)
  const [newFilePreview, setNewFilePreview] = useState<string | null>(null)
  const [newFileDesc, setNewFileDesc] = useState('')
  const newFileInputRef = useRef<HTMLInputElement>(null)

  // Attach Evidence to Specific Task Modal State
  const [attachTask, setAttachTask] = useState<any | null>(null)
  const [attaching, setAttaching] = useState(false)
  const [attachFile, setAttachFile] = useState<File | null>(null)
  const [attachFilePreview, setAttachFilePreview] = useState<string | null>(null)
  const [attachDesc, setAttachDesc] = useState('')
  const [attachLocation, setAttachLocation] = useState('')
  const [attachDate, setAttachDate] = useState('')
  const attachFileInputRef = useRef<HTMLInputElement>(null)

  // Image Lightbox Preview Modal State
  const [previewItem, setPreviewItem] = useState<{ url?: string; filename?: string; description?: string } | null>(null)

  const loadQueue = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [queueData, scheduleData] = await Promise.all([
        apiService.getVerificationQueue(projectId),
        apiService.getSchedule(projectId).catch(() => ({ activities: [] })),
      ])
      setTasks(queueData.tasks || [])
      setActivities(scheduleData.activities || [])
      if (queueData.tasks && queueData.tasks.length > 0 && !expandedId) {
        setExpandedId(queueData.tasks[0].id)
      }
    } catch (e: any) {
      error(e.message || 'Failed to load verification queue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadQueue()
  }, [projectId])

  // File Preview Handler Helper
  const handleFileSelect = (file: File | null, setFileState: (f: File | null) => void, setPreviewState: (url: string | null) => void) => {
    setFileState(file)
    if (file && file.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(file)
      setPreviewState(objectUrl)
    } else {
      setPreviewState(null)
    }
  }

  const handleDecision = async (taskId: number, decision: string) => {
    setDecidingId(taskId)
    try {
      await apiService.makeVerificationDecision(taskId, {
        decision,
        reviewer,
        notes: notes[taskId] || '',
      })
      success(`Decision applied: Task marked '${decision.replace(/_/g, ' ')}'.`)
      setTasks(prev => prev.filter(t => t.id !== taskId))
    } catch (e: any) {
      error(e.message || 'Verification decision failed')
    } finally {
      setDecidingId(null)
    }
  }

  const handleCreateVerification = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !newActivityId || !newTriggerReason.trim()) {
      error('Please select an activity and enter a trigger reason.')
      return
    }
    setCreating(true)
    try {
      const actId = Number(newActivityId)
      await apiService.createVerificationTask(projectId, {
        activity_id: actId,
        priority: newPriority,
        trigger_reason: newTriggerReason,
        reported_progress: newReportedProgress ? parseFloat(newReportedProgress) : undefined,
        conflict_summary: newConflictSummary || undefined,
      })

      // If user also attached a file during creation, upload and link it
      if (newFile) {
        const formData = new FormData()
        formData.append('file', newFile)
        formData.append('description', newFileDesc || newTriggerReason)
        formData.append('reported_date', new Date().toISOString().split('T')[0])
        const evResult = await apiService.uploadEvidence(projectId, formData)
        if (evResult?.evidence_id) {
          await apiService.linkEvidence(evResult.evidence_id, {
            activity_id: actId,
            link_reason: `Attached during verification request creation`,
          })
        }
      }

      success('Verification item created successfully.')
      setShowCreateModal(false)
      setNewActivityId('')
      setNewTriggerReason('')
      setNewReportedProgress('')
      setNewConflictSummary('')
      setNewFile(null)
      setNewFilePreview(null)
      setNewFileDesc('')
      await loadQueue()
    } catch (e: any) {
      error(e.message || 'Failed to create verification item')
    } finally {
      setCreating(false)
    }
  }

  const handleAttachEvidence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !attachTask || !attachFile) {
      error('Please select a file to upload.')
      return
    }
    setAttaching(true)
    try {
      const formData = new FormData()
      formData.append('file', attachFile)
      formData.append('description', attachDesc || `Verification proof for ${attachTask.activity?.activity_name || 'Activity'}`)
      formData.append('location', attachLocation)
      formData.append('reported_date', attachDate || new Date().toISOString().split('T')[0])

      const evResult = await apiService.uploadEvidence(projectId, formData)
      if (evResult?.evidence_id && attachTask.activity?.id) {
        await apiService.linkEvidence(evResult.evidence_id, {
          activity_id: attachTask.activity.id,
          link_reason: `Attached directly on verification item #${attachTask.id}`,
        })
      }

      success(`Evidence attached to ${attachTask.activity?.activity_id || 'Verification Item'}.`)
      setAttachTask(null)
      setAttachFile(null)
      setAttachFilePreview(null)
      setAttachDesc('')
      setAttachLocation('')
      setAttachDate('')
      await loadQueue()
    } catch (e: any) {
      error(e.message || 'Failed to attach evidence')
    } finally {
      setAttaching(false)
    }
  }

  if (!projectId) {
    return (
      <WarningBox message="No project selected. Open the Projects directory or select a project in the top header to inspect the verification queue." />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Verification Queue"
        subtitle="Human-in-the-loop governance for uncertain progress claims, evidence gaps, and discrepancy resolution"
      >
        <button
          onClick={loadQueue}
          className={btnSecondary}
          title="Refresh queue"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>

        <button
          onClick={() => setShowCreateModal(true)}
          className={btnPrimary}
        >
          <Plus className="w-3.5 h-3.5" />
          Add Verification Item
        </button>
      </PageHeader>

      {/* Governance Banner */}
      <div className={clsx(
        "p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed",
        isDark ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-amber-50/60 border-amber-200 text-amber-950"
      )}>
        <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-xs">Human Verification & Audit Governance</p>
          <p className="text-[11px] text-slate-400 leading-normal">
            PROGRESSIQ enforces human accountability. Every item below requires formal inspection, verification notes, and optional site photo/document proof before official baseline status updates.
          </p>
        </div>
      </div>

      {/* Reviewer Meta Bar */}
      <div className={clsx(
        "p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs",
        isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      )}>
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-300">Reviewing Officer:</span>
          <input
            type="text"
            value={reviewer}
            onChange={e => setReviewer(e.target.value)}
            className={clsx(inputField, "w-48 py-1 text-xs")}
            placeholder="Officer Name / Role"
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="font-bold text-amber-400">
            {tasks.length} task(s) awaiting verification
          </span>
        </div>
      </div>

      {/* Queue Items */}
      {loading ? (
        <LoadingSpinner text="Loading verification tasks..." />
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className="w-12 h-12 text-emerald-400" />}
          title="Verification Queue is clean"
          message="All activities have verified evidence and passed consistency thresholds. You can add a manual verification request or run consistency analysis from the Conflict Center."
          action={
            <div className="flex items-center gap-2">
              <button onClick={() => setShowCreateModal(true)} className={btnPrimary}>
                <Plus className="w-3.5 h-3.5" /> Add Verification Item
              </button>
              <button onClick={() => navigate('/conflicts')} className={btnSecondary}>
                Go to Conflict Center
              </button>
            </div>
          }
        />
      ) : (
        <div className="space-y-4">
          {tasks.map(t => {
            const isExpanded = expandedId === t.id
            const isDeciding = decidingId === t.id
            const attachedEvidence = t.evidence || []

            return (
              <div
                key={t.id}
                className={clsx(
                  "p-5 rounded-2xl border transition-all space-y-4",
                  t.priority === 'critical'
                    ? isDark ? "bg-slate-900/90 border-rose-500/40" : "bg-white border-rose-400 shadow-xs"
                    : t.priority === 'high'
                      ? isDark ? "bg-slate-900/90 border-orange-500/40" : "bg-white border-orange-400 shadow-xs"
                      : isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
                )}
              >
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PriorityBadge priority={t.priority} />
                    <ConfidenceBadge
                      label={t.overall_confidence >= 80 ? 'high' : t.overall_confidence >= 55 ? 'medium' : 'low'}
                      score={t.overall_confidence}
                    />
                    <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      {t.activity?.activity_id || 'TASK'}
                    </span>
                    {attachedEvidence.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" />
                        {attachedEvidence.length} File(s) Attached
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setAttachTask(t)
                        setAttachDesc(`Proof for ${t.activity?.activity_name || t.trigger_reason}`)
                      }}
                      className={btnSecondary}
                      title="Upload site photo or document proof for this verification"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Upload Proof</span>
                    </button>

                    <button
                      onClick={() => setExpandedId(isExpanded ? null : t.id)}
                      className={btnSecondary}
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      <span>{isExpanded ? 'Hide Details' : 'Inspect Evidence'}</span>
                    </button>
                  </div>
                </div>

                {/* Activity Name & Trigger Reason */}
                <div className="space-y-2">
                  <h3 className={clsx("font-bold text-base leading-snug", isDark ? "text-slate-100" : "text-slate-900")}>
                    {t.activity?.activity_name || 'Schedule Activity'}
                  </h3>

                  <div className={clsx(
                    "p-3 rounded-xl border text-xs space-y-1",
                    isDark ? "bg-rose-950/20 border-rose-800/30 text-rose-200" : "bg-rose-50 border-rose-200 text-rose-900"
                  )}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                      Triggered Verification Reason:
                    </p>
                    <p className="font-medium leading-relaxed">
                      {t.trigger_reason}
                    </p>
                  </div>
                </div>

                {/* Attached Evidence Thumbnail Strip */}
                {attachedEvidence.length > 0 && (
                  <div className={clsx("p-3.5 rounded-xl border space-y-2 text-xs", isDark ? "bg-slate-950/50 border-slate-800" : "bg-slate-50 border-slate-200")}>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                        Attached Evidence & Site Proof ({attachedEvidence.length})
                      </span>
                      <span className="text-[10px] text-slate-500">Click photo to preview</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {attachedEvidence.map((ev: any) => (
                        <div
                          key={ev.id}
                          className={clsx(
                            "p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 transition-all cursor-pointer hover:border-blue-500/50",
                            isDark ? "bg-slate-900/80 border-slate-800" : "bg-white border-slate-200 shadow-xs"
                          )}
                          onClick={() => setPreviewItem({
                            filename: ev.filename,
                            description: ev.description || ev.link_reason,
                            url: ev.evidence_type === 'photo' ? undefined : undefined,
                          })}
                        >
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <EvidenceBadge type={ev.evidence_type} />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-200 text-xs truncate">{ev.filename}</p>
                                {ev.location && <p className="text-[10px] text-slate-400 truncate">📍 {ev.location}</p>}
                              </div>
                            </div>
                            <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          </div>
                          {(ev.latitude || ev.sha256 || ev.sha256_hash) && (
                            <div className="pt-1 border-t border-slate-800/60" onClick={e => e.stopPropagation()}>
                              <GeotagBadge data={{
                                latitude: ev.latitude,
                                longitude: ev.longitude,
                                sha256_hash: ev.sha256 || ev.sha256_hash,
                                has_gps: !!(ev.latitude && ev.longitude),
                                verified: !!(ev.sha256 || ev.sha256_hash),
                              }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expanded Details: Triple Progress & Recommendations */}
                {isExpanded && (
                  <div className="space-y-4 pt-2 border-t border-slate-800/60">
                    <TripleProgressBar
                      planned={t.activity?.planned_progress || 0}
                      reported={t.reported_progress || 0}
                      evidenceSupported={t.evidence_supported_progress}
                    />

                    {t.conflict_summary && (
                      <div className={clsx("p-3 rounded-xl border text-xs", isDark ? "bg-slate-950/60 border-slate-800 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-800")}>
                        <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Conflict Summary</p>
                        <p className="leading-relaxed">{t.conflict_summary}</p>
                      </div>
                    )}

                    {t.recommendation && (
                      <div className={clsx("p-3 rounded-xl border text-xs", isDark ? "bg-blue-950/20 border-blue-800/30 text-blue-200" : "bg-blue-50 border-blue-200 text-blue-900")}>
                        <p className="text-[10px] font-bold uppercase text-blue-400 mb-1">AI Recommendation</p>
                        <p className="leading-relaxed">{t.recommendation}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Officer Notes & Decision Actions */}
                <div className="pt-3 border-t border-slate-800/60 space-y-3">
                  <textarea
                    rows={2}
                    placeholder="Enter reviewer comments, inspection findings, or justification for this decision..."
                    value={notes[t.id] || ''}
                    onChange={e => setNotes(prev => ({ ...prev, [t.id]: e.target.value }))}
                    className={clsx(inputField, "resize-none text-xs")}
                  />

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleDecision(t.id, 'confirmed')}
                      disabled={isDeciding || !permissions.canApproveVerification}
                      title={!permissions.canApproveVerification ? `Current persona (${role}) is read-only` : undefined}
                      className={btnSuccess}
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Confirm Progress
                    </button>
                    <button
                      onClick={() => handleDecision(t.id, 'rejected')}
                      disabled={isDeciding || !permissions.canApproveVerification}
                      title={!permissions.canApproveVerification ? `Current persona (${role}) is read-only` : undefined}
                      className={btnDanger}
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject Claim
                    </button>
                    <button
                      onClick={() => handleDecision(t.id, 'evidence_requested')}
                      disabled={isDeciding}
                      className={btnSecondary}
                    >
                      <FileQuestion className="w-3.5 h-3.5 text-blue-400" /> Request Proof
                    </button>
                    <button
                      onClick={() => handleDecision(t.id, 'marked_review')}
                      disabled={isDeciding}
                      className={btnSecondary}
                    >
                      <Bookmark className="w-3.5 h-3.5 text-amber-400" /> Defer Review
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 1. Modal: Add New Verification Item */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Verification Item"
        subtitle="Flag a schedule activity for formal human verification and attach supporting site documentation"
      >
        <form onSubmit={handleCreateVerification} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Select Schedule Activity <span className="text-rose-400">*</span>
            </label>
            <select
              value={newActivityId}
              onChange={e => {
                setNewActivityId(e.target.value)
                const act = activities.find(a => String(a.id) === e.target.value)
                if (act && act.actual_progress !== undefined) {
                  setNewReportedProgress(String(act.actual_progress))
                }
              }}
              required
              className={selectField}
            >
              <option value="">-- Choose Activity from Schedule --</option>
              {activities.map(act => (
                <option key={act.id} value={act.id}>
                  [{act.activity_id}] {act.activity_name} ({act.status || 'Active'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Priority Level
              </label>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value)}
                className={selectField}
              >
                <option value="critical">🔴 Critical — High Risk</option>
                <option value="high">🟠 High Priority</option>
                <option value="medium">🟡 Medium Priority</option>
                <option value="low">🔵 Low Priority</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Reported Progress % (Optional)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="e.g. 75.0"
                value={newReportedProgress}
                onChange={e => setNewReportedProgress(e.target.value)}
                className={inputField}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Trigger Reason / Discrepancy Note <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Unverified progress claim on foundation concrete pour; physical inspection required before approval."
              value={newTriggerReason}
              onChange={e => setNewTriggerReason(e.target.value)}
              className={clsx(inputField, "resize-none")}
            />
          </div>

          {/* Optional Direct File / Image Attachment */}
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2.5">
            <label className="block text-slate-300 font-semibold">
              Attach Supporting Photo or Document (Optional)
            </label>

            <div
              onClick={() => newFileInputRef.current?.click()}
              className={clsx(
                "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all",
                newFile
                  ? "border-blue-500 bg-blue-500/10"
                  : isDark ? "border-slate-700 hover:border-slate-600 bg-slate-900/30" : "border-slate-300 hover:border-slate-400 bg-slate-50"
              )}
            >
              {newFilePreview ? (
                <div className="flex items-center justify-center gap-3">
                  <img
                    src={newFilePreview}
                    alt="Preview"
                    className="w-12 h-12 object-cover rounded-lg border border-slate-700 shadow-xs"
                  />
                  <div className="text-left">
                    <p className="font-bold text-slate-200 truncate max-w-xs">{newFile?.name}</p>
                    <p className="text-[10px] text-emerald-400">Photo preview loaded (Click to change)</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-blue-400 mx-auto mb-1" />
                  <p className="font-bold text-slate-200 text-xs">
                    {newFile ? newFile.name : 'Select or drop site photo / inspection sheet'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">JPG, PNG, PDF, CSV, XLSX (Up to 20MB)</p>
                </>
              )}
              <input
                ref={newFileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,.csv,.xlsx,.txt"
                onChange={e => handleFileSelect(e.target.files?.[0] || null, setNewFile, setNewFilePreview)}
                className="hidden"
              />
            </div>

            {newFile && (
              <input
                type="text"
                placeholder="Optional description for this attached file..."
                value={newFileDesc}
                onChange={e => setNewFileDesc(e.target.value)}
                className={clsx(inputField, "text-xs")}
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className={btnSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className={btnPrimary}
            >
              {creating ? 'Creating Item...' : 'Create Verification Item'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Modal: Attach Evidence Directly to a Verification Task */}
      <Modal
        isOpen={!!attachTask}
        onClose={() => setAttachTask(null)}
        title="Upload Verification Evidence"
        subtitle={attachTask ? `Attach photo or inspection document to ${attachTask.activity?.activity_id || 'Verification Item'}` : ''}
      >
        <form onSubmit={handleAttachEvidence} className="space-y-4 text-xs">
          {/* Dropzone */}
          <div
            onClick={() => attachFileInputRef.current?.click()}
            className={clsx(
              "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all",
              attachFile
                ? "border-emerald-500 bg-emerald-500/5"
                : isDark
                  ? "border-slate-700 hover:border-slate-600 bg-slate-900/40"
                  : "border-slate-300 hover:border-slate-400 bg-slate-50"
            )}
          >
            {attachFilePreview ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <img
                  src={attachFilePreview}
                  alt="Attachment Preview"
                  className="w-24 h-24 object-cover rounded-xl border border-slate-700 shadow-md"
                />
                <p className="font-bold text-slate-200 text-xs">{attachFile?.name}</p>
                <p className="text-[10px] text-emerald-400">Click to choose a different photo</p>
              </div>
            ) : (
              <>
                <Upload className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="font-bold text-sm text-slate-200">
                  {attachFile ? attachFile.name : 'Choose Site Photo or Inspection Document'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports JPG, PNG, PDF, CSV, XLSX (Up to 20MB)
                </p>
              </>
            )}
            <input
              ref={attachFileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,.txt,.csv,.xlsx"
              onChange={e => handleFileSelect(e.target.files?.[0] || null, setAttachFile, setAttachFilePreview)}
              className="hidden"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Description / Proof Summary</label>
            <textarea
              rows={2}
              placeholder="e.g. Concrete cube compression test passed at 28 days; inspection signed off by QC."
              value={attachDesc}
              onChange={e => setAttachDesc(e.target.value)}
              className={clsx(inputField, "resize-none")}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Site Location / Zone</label>
              <input
                type="text"
                placeholder="e.g. Pier Cap 12 / Sector 4"
                value={attachLocation}
                onChange={e => setAttachLocation(e.target.value)}
                className={inputField}
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Inspection / Capture Date</label>
              <input
                type="date"
                value={attachDate}
                onChange={e => setAttachDate(e.target.value)}
                className={inputField}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setAttachTask(null)}
              className={btnSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={attaching || !attachFile}
              className={btnSuccess}
            >
              {attaching ? 'Uploading & Linking...' : 'Upload & Attach Proof'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. Modal: Evidence Lightbox / Inspection Preview */}
      <Modal
        isOpen={!!previewItem}
        onClose={() => setPreviewItem(null)}
        title={previewItem?.filename || 'Evidence Inspection'}
        subtitle="Verifiable evidence artifact attached to project activity"
      >
        <div className="space-y-4 text-xs">
          {previewItem?.url ? (
            <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 flex items-center justify-center p-2">
              <img
                src={previewItem.url}
                alt={previewItem.filename}
                className="max-h-80 object-contain rounded-lg"
              />
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-slate-800 bg-slate-950/60 text-center space-y-3">
              <FileText className="w-12 h-12 text-blue-400 mx-auto" />
              <div>
                <p className="font-bold text-sm text-slate-200">{previewItem?.filename}</p>
                <p className="text-slate-400 text-xs mt-1">{previewItem?.description || 'Official project documentation record'}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button
              onClick={() => setPreviewItem(null)}
              className={btnSecondary}
            >
              Close Preview
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
