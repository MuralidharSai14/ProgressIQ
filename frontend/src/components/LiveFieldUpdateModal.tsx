import { useState, useEffect, useRef } from 'react'
import {
  Camera, Sparkles, X, RefreshCw, Smartphone, MapPin, Calendar
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import { Modal, btnPrimary, btnSecondary, inputField, selectField } from './ui'

interface LiveFieldUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  initialActivityId?: number
}

export default function LiveFieldUpdateModal({
  isOpen,
  onClose,
  onSuccess,
  initialActivityId,
}: LiveFieldUpdateModalProps) {
  const { projectId, projectName } = useProject()
  const { user } = useAuth()
  const { theme } = useTheme()
  const { success, error } = useToast()
  const isDark = theme === 'dark'

  const [activities, setActivities] = useState<any[]>([])
  const [loadingActs, setLoadingActs] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form State
  const [selectedActId, setSelectedActId] = useState<string>(initialActivityId ? String(initialActivityId) : '')
  const [activitySearch, setActivitySearch] = useState('')
  const [progress, setProgress] = useState<number>(50)
  const [remarks, setRemarks] = useState('')
  const [location, setLocation] = useState('')
  const [reportedDate, setReportedDate] = useState(new Date().toISOString().split('T')[0])
  const [reporterName, setReporterName] = useState(user?.full_name || 'Site Engineer')

  // Photo / Evidence
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Restore draft on mount
  useEffect(() => {
    if (isOpen) {
      const draft = localStorage.getItem('progressiq_draft_update')
      if (draft && !initialActivityId) {
        try {
          const parsed = JSON.parse(draft)
          if (parsed.projectId === projectId) {
            setSelectedActId(parsed.activityId || '')
            setProgress(parsed.progress || 50)
            setRemarks(parsed.remarks || '')
            setLocation(parsed.location || '')
          }
        } catch {}
      }
      if (user?.full_name) {
        setReporterName(user.full_name)
      }
    }
  }, [isOpen, projectId, user, initialActivityId])

  // Save draft on change
  useEffect(() => {
    if (isOpen && projectId) {
      localStorage.setItem('progressiq_draft_update', JSON.stringify({
        projectId,
        activityId: selectedActId,
        progress,
        remarks,
        location,
      }))
    }
  }, [selectedActId, progress, remarks, location, isOpen, projectId])

  // Load activities
  useEffect(() => {
    if (isOpen && projectId) {
      setLoadingActs(true)
      apiService.getSchedule(projectId)
        .then((res) => {
          const acts = Array.isArray(res) ? res : res?.activities || []
          setActivities(acts)
          if (initialActivityId) {
            setSelectedActId(String(initialActivityId))
            const found = acts.find((a: any) => a.id === initialActivityId)
            if (found) {
              setProgress(found.actual_progress || 0)
            }
          } else if (acts.length > 0 && !selectedActId) {
            setSelectedActId(String(acts[0].id))
            setProgress(acts[0].actual_progress || 0)
          }
        })
        .catch(() => setActivities([]))
        .finally(() => setLoadingActs(false))
    }
  }, [isOpen, projectId, initialActivityId])

  const handleActivitySelect = (actId: string) => {
    setSelectedActId(actId)
    const act = activities.find((a) => String(a.id) === actId)
    if (act) {
      setProgress(act.actual_progress || 0)
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhoto(file)
      const url = URL.createObjectURL(file)
      setPhotoPreview(url)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId) {
      error('Please select an active project first')
      return
    }
    if (!selectedActId) {
      error('Please select an activity to update')
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('activity_id', selectedActId)
      formData.append('reported_progress', String(progress))
      formData.append('reporter_name', reporterName || user?.full_name || 'Site Engineer')
      formData.append('reported_date', reportedDate)
      if (location) formData.append('location', location)
      if (remarks) formData.append('remarks', remarks)
      if (photo) formData.append('file', photo)

      const res = await apiService.submitLiveFieldUpdate(projectId, formData)

      // Clear draft
      localStorage.removeItem('progressiq_draft_update')
      setPhoto(null)
      setPhotoPreview(null)
      setRemarks('')

      success(`Progress update submitted: ${res.activity_name} → ${res.reported_progress}% (AI consistency check initiated)`)
      if (onSuccess) onSuccess()
      onClose()
    } catch (err: any) {
      error(err.message || 'Failed to submit field update')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedActivity = activities.find((a) => String(a.id) === selectedActId)
  const filteredActivities = activities.filter((a) =>
    (a.activity_name?.toLowerCase().includes(activitySearch.toLowerCase()) ||
     a.activity_id?.toLowerCase().includes(activitySearch.toLowerCase()))
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="📱 + New Live Field Update"
      subtitle={projectName ? `Project: ${projectName}` : 'Mobile-Optimized Field Submission'}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Device Status Bar */}
        <div className={clsx(
          "p-3 rounded-xl border flex items-center justify-between text-xs",
          isDark ? "bg-slate-900/80 border-slate-800 text-slate-300" : "bg-blue-50 border-blue-200 text-blue-900"
        )}>
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Reporting as <strong>{reporterName}</strong></span>
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live Sync Ready
          </span>
        </div>

        {/* 1. Activity Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>Select Activity to Update *</span>
            {selectedActivity && (
              <span className="text-[11px] font-mono text-slate-400">
                Current: {selectedActivity.actual_progress}% (Planned: {selectedActivity.planned_progress}%)
              </span>
            )}
          </label>

          {/* Quick Filter Search */}
          <input
            type="text"
            placeholder="Search activity name or code (e.g. Foundation, L5-001)..."
            value={activitySearch}
            onChange={(e) => setActivitySearch(e.target.value)}
            className={clsx(inputField, "text-xs mb-1.5")}
          />

          <select
            value={selectedActId}
            onChange={(e) => handleActivitySelect(e.target.value)}
            className={selectField}
            required
            disabled={loadingActs}
          >
            {loadingActs ? (
              <option>Loading schedule activities...</option>
            ) : filteredActivities.length === 0 ? (
              <option value="">No matching activities found</option>
            ) : (
              filteredActivities.map((act) => (
                <option key={act.id} value={act.id}>
                  [{act.activity_id}] {act.activity_name} — Current: {act.actual_progress}%
                </option>
              ))
            )}
          </select>
        </div>

        {/* 2. Progress Percentage Slider + Numeric Input */}
        <div className={clsx(
          "p-4 rounded-xl border space-y-3",
          isDark ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
        )}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-200">
              Reported Actual Progress (%) *
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={progress}
                onChange={(e) => setProgress(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="w-16 text-center font-mono font-bold text-sm bg-blue-600/20 text-blue-400 border border-blue-500/40 rounded-lg py-1 px-1 focus:outline-hidden"
              />
              <span className="text-sm font-bold text-slate-400">%</span>
            </div>
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={progress}
            onChange={(e) => setProgress(parseFloat(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />

          {/* Quick Step Buttons */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1">
            {[0, 25, 50, 72, 75, 90, 100].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setProgress(preset)}
                className={clsx(
                  "text-[11px] font-mono px-2.5 py-1 rounded-md border transition-all cursor-pointer",
                  progress === preset
                    ? "bg-blue-600 text-white border-blue-500 font-bold"
                    : isDark ? "bg-slate-800 text-slate-400 border-slate-700 hover:text-white" : "bg-white text-slate-600 border-slate-300 hover:text-slate-900"
                )}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>

        {/* 3. Location and Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> Specific Location / Axis
            </label>
            <input
              type="text"
              placeholder="e.g. Pump House Pier-4 / Axis-B"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputField}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Progress Date
            </label>
            <input
              type="date"
              value={reportedDate}
              onChange={(e) => setReportedDate(e.target.value)}
              className={inputField}
              required
            />
          </div>
        </div>

        {/* 4. Field Remarks & Notes */}
        <div>
          <label className="text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
            <span>Site Supervisor Remarks & Delay Observations</span>
            <span className="text-[10px] text-slate-400">AI parses materials & safety keywords</span>
          </label>
          <textarea
            rows={3}
            placeholder="e.g. Excavation progressing normally. Reinforcement steel delivered 18 MT. Shoring equipment installed."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className={inputField}
          />
        </div>

        {/* 5. Photo / Camera Evidence Upload */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>📷 Site Photograph / Verifiable Evidence</span>
            <span className="text-[10px] text-slate-400">Recommended for verification</span>
          </label>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />

          {photoPreview ? (
            <div className="relative rounded-xl border border-slate-700 overflow-hidden bg-slate-900/80 p-2 flex items-center gap-3">
              <img
                src={photoPreview}
                alt="Evidence preview"
                className="w-16 h-16 object-cover rounded-lg border border-slate-700 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-200 truncate">{photo?.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {photo ? `${(photo.size / 1024).toFixed(1)} KB` : ''} · Photo Evidence Ready
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setPhoto(null); setPhotoPreview(null) }}
                className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                title="Remove photo"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className={clsx(
                "p-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
                isDark ? "border-slate-800 hover:border-blue-500/50 bg-slate-900/30" : "border-slate-300 hover:border-blue-400 bg-slate-50"
              )}
            >
              <div className="p-2.5 rounded-full bg-blue-500/10 text-blue-400">
                <Camera className="w-5 h-5" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-slate-200">Tap to Snap Photo or Upload Evidence</p>
                <p className="text-[11px] text-slate-400 mt-0.5">JPEG, PNG or PDF from your device</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className={btnSecondary}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !selectedActId}
            className={clsx(btnPrimary, "px-6")}
          >
            {submitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Submitting & Syncing...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                Submit Live Field Update
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
