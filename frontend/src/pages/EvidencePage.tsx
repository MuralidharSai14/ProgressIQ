/**
 * PROGRESSIQ — Evidence Center
 * Verifiable site photographs, material delivery logs, equipment sheets, and inspection documents.
 * Features live image previews, schedule activity linking, and Logistics Double Verification.
 */
import { useState, useEffect, useRef } from 'react'
import {
  Database, Upload, Search, ShieldCheck, RefreshCw,
  Sparkles, LayoutGrid, List, Eye, Link2, Truck, CheckCircle2
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import {
  PageHeader, LoadingSpinner, EmptyState, WarningBox,
  EvidenceBadge, DemoLabel, Modal,
  btnPrimary, btnSecondary, inputField, selectField
} from '../components/ui'
import { GeotagBadge } from '../components/GeotagBadge'

export default function EvidencePage() {
  const { projectId } = useProject()
  const { theme } = useTheme()
  const { success, error } = useToast()
  const isDark = theme === 'dark'

  const [evidence, setEvidence] = useState<any[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [filterType, setFilterType] = useState('')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showUploadModal, setShowUploadModal] = useState(false)

  // Upload form mode: 'general' | 'logistics_double_verify'
  const [uploadMode, setUploadMode] = useState<'general' | 'logistics_double_verify'>('general')

  // Upload form state
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [reportedDate, setReportedDate] = useState('')
  const [materialName, setMaterialName] = useState('')
  const [expectedQty, setExpectedQty] = useState('')
  const [recordedQty, setRecordedQty] = useState('')
  const [equipmentName, setEquipmentName] = useState('')
  const [selectedActivityId, setSelectedActivityId] = useState('')
  const [selectedMaterialId, setSelectedMaterialId] = useState('')
  const [proofType, setProofType] = useState('Waybill / Dispatch Challan')

  // Link Modal state for existing evidence
  const [linkModalEvidence, setLinkModalEvidence] = useState<any | null>(null)
  const [linkingActivityId, setLinkingActivityId] = useState('')
  const [linking, setLinking] = useState(false)

  // Lightbox Preview Modal state
  const [previewEvidence, setPreviewEvidence] = useState<any | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadEvidence = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [evData, schedData, matData] = await Promise.all([
        apiService.listEvidence(projectId, filterType === 'double_verified' ? 'material_record' : filterType || undefined),
        apiService.getSchedule(projectId).catch(() => ({ activities: [] })),
        apiService.getMaterials(projectId).catch(() => ({ shipments: [] })),
      ])
      setEvidence(evData.evidence || [])
      setActivities(schedData.activities || [])
      setMaterials(matData.shipments || [])
    } catch (e: any) {
      error(e.message || 'Failed to load evidence records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadEvidence()
  }, [projectId, filterType])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null
    setFile(selected)
    if (selected && selected.type.startsWith('image/')) {
      const url = URL.createObjectURL(selected)
      setFilePreview(url)
    } else {
      setFilePreview(null)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      
      const fullDesc = uploadMode === 'logistics_double_verify'
        ? `[DOUBLE VERIFIED WAYBILL - ${proofType}] ${description || `Verified delivery for ${materialName || 'Material'}`}`
        : description

      form.append('description', fullDesc)
      form.append('location', location)
      form.append('reported_date', reportedDate || new Date().toISOString().split('T')[0])
      form.append('material_name', materialName)
      form.append('expected_quantity', expectedQty)
      form.append('recorded_quantity', recordedQty)
      form.append('equipment_name', equipmentName)

      const result = await apiService.uploadEvidence(projectId, form)

      // If linked to an activity
      if (result.evidence_id && selectedActivityId) {
        await apiService.linkEvidence(result.evidence_id, {
          activity_id: Number(selectedActivityId),
          link_reason: uploadMode === 'logistics_double_verify' ? 'Waybill double verification' : 'Linked during evidence upload',
        })
      }

      // If Double Verification mode and a material shipment was selected, update the shipment status!
      if (uploadMode === 'logistics_double_verify' && selectedMaterialId) {
        const mat = materials.find(m => String(m.id) === selectedMaterialId)
        if (mat) {
          const verifiedQty = recordedQty ? parseFloat(recordedQty) : mat.ordered_quantity
          await apiService.updateMaterial(mat.id, {
            delivered_quantity: verifiedQty,
            status: verifiedQty >= mat.required_quantity ? 'delivered' : 'in_transit',
            notes: `Double Verified: Waybill #${file.name} uploaded to Evidence Center on ${new Date().toLocaleDateString('en-IN')}`,
          })
        }
      }

      success(uploadMode === 'logistics_double_verify'
        ? `Double Verification Complete: Waybill uploaded & shipment verified!`
        : `Evidence uploaded successfully: ${result.filename || file.name}`)

      setFile(null)
      setFilePreview(null)
      setDescription('')
      setLocation('')
      setMaterialName('')
      setExpectedQty('')
      setRecordedQty('')
      setEquipmentName('')
      setSelectedActivityId('')
      setSelectedMaterialId('')
      setShowUploadModal(false)
      await loadEvidence()
    } catch (e: any) {
      error(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleLinkEvidence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkModalEvidence || !linkingActivityId) return
    setLinking(true)
    try {
      await apiService.linkEvidence(linkModalEvidence.id, {
        activity_id: Number(linkingActivityId),
        link_reason: 'Manual linkage from Evidence Center',
      })
      success(`Evidence linked to selected schedule activity.`)
      setLinkModalEvidence(null)
      setLinkingActivityId('')
      await loadEvidence()
    } catch (e: any) {
      error(e.message || 'Failed to link evidence')
    } finally {
      setLinking(false)
    }
  }

  const filteredEvidence = evidence.filter(ev => {
    if (filterType === 'double_verified') {
      const isDbl = ev.description?.includes('DOUBLE VERIFIED') || ev.material_name
      if (!isDbl) return false
    }
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      ev.filename?.toLowerCase().includes(q) ||
      ev.description?.toLowerCase().includes(q) ||
      ev.location?.toLowerCase().includes(q) ||
      ev.material_name?.toLowerCase().includes(q) ||
      ev.equipment_name?.toLowerCase().includes(q)
    )
  })

  if (!projectId) {
    return (
      <WarningBox message="No project selected. Open the Projects directory or select a project in the top header to view evidence records." />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Evidence Center"
        subtitle="Verifiable field photographs, material delivery vouchers, equipment inspection certificates, and structural tests"
      >
        <button
          onClick={loadEvidence}
          className={btnSecondary}
          title="Refresh evidence"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>

        <button
          onClick={() => {
            setUploadMode('logistics_double_verify')
            setShowUploadModal(true)
          }}
          className={clsx(btnSecondary, "text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10")}
          title="Upload Waybill / Delivery Slip for Double Verification"
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Double Verify Logistics</span>
        </button>

        <button
          onClick={() => {
            setUploadMode('general')
            setShowUploadModal(true)
          }}
          className={btnPrimary}
        >
          <Upload className="w-3.5 h-3.5" />
          Upload Evidence
        </button>
      </PageHeader>

      {/* Double Verification Banner */}
      <div className={clsx(
        "p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed",
        isDark ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-emerald-50/60 border-emerald-200 text-emerald-950"
      )}>
        <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-xs">Evidence-Backed Double Verification Protocol</p>
          <p className="text-[11px] text-slate-400 leading-normal">
            PROGRESSIQ cross-checks field progress and material shipments against physical Waybills, Weighbridge Slips, and Site Photos. Uploading delivery vouchers provides <strong>Double Verification</strong> ensuring logistics are physically shipped, weighed, and received on site before updating schedule milestones.
          </p>
        </div>
      </div>

      {/* Filters and View Mode Controls */}
      <div className={clsx(
        "p-3 rounded-2xl border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3",
        isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      )}>
        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: '', label: 'All Categories' },
            { id: 'photo', label: '📷 Photos' },
            { id: 'material_record', label: '📦 Material Logs' },
            { id: 'double_verified', label: '🚚 Double Verified Waybills' },
            { id: 'equipment_record', label: '⚙ Equipment' },
            { id: 'document', label: '📄 Documents' },
          ].map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilterType(cat.id)}
              className={clsx(
                "px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer",
                filterType === cat.id
                  ? "bg-blue-600 text-white border-blue-600"
                  : isDark ? "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200" : "bg-slate-100 border-slate-300 text-slate-700"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search & Grid/List toggle */}
        <div className="flex items-center gap-2">
          <div className="relative min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search evidence..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={clsx(inputField, "pl-8 text-xs py-1.5")}
            />
          </div>

          <div className={clsx("flex p-1 rounded-lg border", isDark ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-300")}>
            <button
              onClick={() => setViewMode('grid')}
              className={clsx(
                "p-1 rounded transition-colors cursor-pointer",
                viewMode === 'grid'
                  ? isDark ? "bg-slate-800 text-white" : "bg-white text-slate-900 shadow-xs"
                  : "text-slate-400"
              )}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={clsx(
                "p-1 rounded transition-colors cursor-pointer",
                viewMode === 'list'
                  ? isDark ? "bg-slate-800 text-white" : "bg-white text-slate-900 shadow-xs"
                  : "text-slate-400"
              )}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Evidence Items View */}
      {loading ? (
        <LoadingSpinner text="Loading evidence repository..." />
      ) : filteredEvidence.length === 0 ? (
        <EmptyState
          icon={<Database className="w-12 h-12" />}
          title="No evidence items found"
          message={search || filterType
            ? "No evidence matches the selected filter criteria."
            : "Upload site photos or material delivery sheets, or use Double Verify Logistics to upload your first waybill voucher."}
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setUploadMode('logistics_double_verify')
                  setShowUploadModal(true)
                }}
                className={btnSecondary}
              >
                <Truck className="w-3.5 h-3.5 text-emerald-400" /> Double Verify Waybill
              </button>
              <button
                onClick={() => {
                  setUploadMode('general')
                  setShowUploadModal(true)
                }}
                className={btnPrimary}
              >
                <Upload className="w-4 h-4" /> Upload Evidence
              </button>
            </div>
          }
        />
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvidence.map(ev => {
            const isDoubleVerified = ev.description?.includes('DOUBLE VERIFIED') || (ev.material_name && ev.recorded_quantity)

            return (
              <div
                key={ev.id}
                className={clsx(
                  "p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3",
                  isDoubleVerified
                    ? isDark ? "bg-slate-900/80 border-emerald-500/30 hover:border-emerald-500/50" : "bg-white border-emerald-300 shadow-xs"
                    : isDark ? "bg-slate-900/70 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 shadow-xs"
                )}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <EvidenceBadge type={ev.evidence_type} />
                      {isDoubleVerified && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Double Verified
                        </span>
                      )}
                      {ev.is_demo && <DemoLabel />}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {ev.uploaded_at ? new Date(ev.uploaded_at).toLocaleDateString('en-IN') : ''}
                    </span>
                  </div>

                  <div>
                    <h3 className={clsx("font-bold text-sm leading-snug truncate", isDark ? "text-slate-100" : "text-slate-900")}>
                      {ev.filename}
                    </h3>
                    {ev.description && (
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {ev.description.replace(/\[DOUBLE VERIFIED WAYBILL - [^\]]+\]\s*/, '')}
                      </p>
                    )}
                  </div>

                  {/* Metadata Tags */}
                  <div className="flex flex-wrap gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800/60">
                    {ev.location && <span>📍 {ev.location}</span>}
                    {ev.material_name && <span>📦 {ev.material_name}</span>}
                    {ev.recorded_quantity && (
                      <span className="text-emerald-400 font-mono font-bold">Delivered: {ev.recorded_quantity}</span>
                    )}
                    {ev.equipment_name && <span>🚚 Carrier/Truck: {ev.equipment_name}</span>}
                  </div>

                  {/* GPS Coordinates & SHA-256 Tamper-Proof Cryptographic Badges */}
                  <GeotagBadge
                    data={
                      typeof ev.ai_analysis === 'object'
                        ? ev.ai_analysis?.tamper_proof
                        : (() => {
                            try {
                              return JSON.parse(ev.ai_analysis)?.tamper_proof
                            } catch {
                              return null
                            }
                          })()
                    }
                  />

                  {/* AI Evidence Interpretation */}
                  {ev.ai_analysis && (
                    <div className={clsx(
                      "p-2.5 rounded-xl border text-xs space-y-1",
                      isDark ? "bg-purple-950/20 border-purple-800/30" : "bg-purple-50 border-purple-200"
                    )}>
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-purple-400">
                        <Sparkles className="w-3 h-3" />
                        <span>AI Evidence Analysis</span>
                      </div>
                      {ev.ai_analysis.detected_indicators?.map((ind: string, i: number) => (
                        <p key={i} className="text-slate-300 text-[11px] leading-tight">• {ind}</p>
                      ))}
                      {ev.ai_analysis.progress_estimation && (
                        <p className="text-[10px] text-amber-400/90 italic pt-0.5">
                          Note: {ev.ai_analysis.progress_estimation}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setPreviewEvidence(ev)}
                    className={clsx(btnSecondary, "text-xs py-1 px-2.5")}
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                    <span>Inspect Proof</span>
                  </button>

                  <button
                    onClick={() => setLinkModalEvidence(ev)}
                    className={clsx(btnSecondary, "text-xs py-1 px-2.5")}
                    title="Link this evidence to a schedule activity"
                  >
                    <Link2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>Link Activity</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* List View */
        <div className={clsx("rounded-2xl border overflow-hidden", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={clsx("border-b font-semibold uppercase tracking-wider text-[10px]", isDark ? "border-slate-800 bg-slate-950/70 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500")}>
                  <th className="py-3 px-4">Filename</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Description</th>
                  <th className="py-3 px-3">Location / Tag</th>
                  <th className="py-3 px-3">Uploaded Date</th>
                  <th className="py-3 px-3">AI Indicators</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filteredEvidence.map(ev => {
                  const isDoubleVerified = ev.description?.includes('DOUBLE VERIFIED') || (ev.material_name && ev.recorded_quantity)

                  return (
                    <tr key={ev.id} className={clsx("transition-colors", isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50")}>
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        <div className="flex items-center gap-2">
                          <span>{ev.filename}</span>
                          {isDoubleVerified && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              ✔ Verified
                            </span>
                          )}
                          {ev.is_demo && <DemoLabel />}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <EvidenceBadge type={ev.evidence_type} />
                      </td>
                      <td className="py-3 px-3 text-slate-400 max-w-xs truncate">
                        {ev.description || '—'}
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {ev.location || ev.material_name || ev.equipment_name || '—'}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">
                        {ev.uploaded_at ? new Date(ev.uploaded_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-3 px-3 text-purple-300 text-[11px] max-w-xs truncate">
                        {ev.ai_analysis?.detected_indicators?.join(', ') || '—'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setPreviewEvidence(ev)}
                            className={clsx(btnSecondary, "py-1 px-2 text-[11px]")}
                          >
                            <Eye className="w-3 h-3 text-blue-400" /> Inspect
                          </button>
                          <button
                            onClick={() => setLinkModalEvidence(ev)}
                            className={clsx(btnSecondary, "py-1 px-2 text-[11px]")}
                          >
                            <Link2 className="w-3 h-3 text-slate-400" /> Link
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 1. Upload Evidence Modal (Supports General and Double Verification Mode) */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title={uploadMode === 'logistics_double_verify' ? "Logistics Double Verification Upload" : "Upload Supporting Evidence"}
        subtitle={uploadMode === 'logistics_double_verify'
          ? "Attach physical waybill, weighbridge slip, or offloading photo to substantiate that materials are physically shipped"
          : "Attach photos, delivery logs, or inspection records to verify project progress"}
      >
        <form onSubmit={handleUpload} className="space-y-4 text-xs">
          {/* Mode Switcher Tabs */}
          <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={() => setUploadMode('general')}
              className={clsx(
                "flex-1 py-1.5 rounded-lg font-semibold text-xs transition-colors cursor-pointer",
                uploadMode === 'general' ? "bg-blue-600 text-white shadow-xs" : "text-slate-400 hover:text-slate-200"
              )}
            >
              General Field Proof
            </button>
            <button
              type="button"
              onClick={() => setUploadMode('logistics_double_verify')}
              className={clsx(
                "flex-1 py-1.5 rounded-lg font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5",
                uploadMode === 'logistics_double_verify' ? "bg-emerald-600 text-white shadow-xs" : "text-emerald-400 hover:text-emerald-300"
              )}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Logistics Double Verification</span>
            </button>
          </div>

          {/* Double Verification Shipment Selector */}
          {uploadMode === 'logistics_double_verify' && (
            <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-3">
              <div>
                <label className="block text-emerald-300 font-semibold mb-1">
                  Select Material Shipment to Verify <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedMaterialId}
                  onChange={e => {
                    setSelectedMaterialId(e.target.value)
                    const m = materials.find(mat => String(mat.id) === e.target.value)
                    if (m) {
                      setMaterialName(m.material_name)
                      setExpectedQty(`${m.ordered_quantity || m.required_quantity} ${m.unit}`)
                      setRecordedQty(String(m.ordered_quantity || m.required_quantity))
                      if (m.activity_id) setSelectedActivityId(String(m.activity_id))
                    }
                  }}
                  className={selectField}
                >
                  <option value="">-- Choose Material Shipment --</option>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      [{m.category}] {m.material_name} — Req: {m.required_quantity} {m.unit} (Delivered: {m.delivered_quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Proof Document Type</label>
                  <select
                    value={proofType}
                    onChange={e => setProofType(e.target.value)}
                    className={selectField}
                  >
                    <option value="Waybill / Lorry Receipt (LR)">🚚 Waybill / Lorry Receipt (LR)</option>
                    <option value="Weighbridge Gross & Tare Slip">⚖️ Weighbridge Gross & Tare Slip</option>
                    <option value="Gate Pass / Goods Receipt Note (GRN)">🏗️ Gate Pass / Physical GRN</option>
                    <option value="Mill Test Certificate (MTC)">🧪 Mill Test Certificate (MTC)</option>
                    <option value="Site Offloading Photo with Geotag">📸 Site Offloading Photo</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Carrier / Truck Plate Number</label>
                  <input
                    type="text"
                    placeholder="e.g. NL-01-AB-8492"
                    value={equipmentName}
                    onChange={e => setEquipmentName(e.target.value)}
                    className={inputField}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dropzone with Live Preview */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all",
              file
                ? uploadMode === 'logistics_double_verify' ? "border-emerald-500 bg-emerald-500/5" : "border-blue-500 bg-blue-500/5"
                : isDark
                  ? "border-slate-700 hover:border-slate-600 bg-slate-900/40"
                  : "border-slate-300 hover:border-slate-400 bg-slate-50"
            )}
          >
            {filePreview ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <img
                  src={filePreview}
                  alt="Selected Preview"
                  className="w-24 h-24 object-cover rounded-xl border border-slate-700 shadow-md"
                />
                <p className="font-bold text-slate-200 text-xs">{file?.name}</p>
                <p className="text-[10px] text-emerald-400">Photo preview loaded (Click to change file)</p>
              </div>
            ) : (
              <>
                {uploadMode === 'logistics_double_verify' ? (
                  <Truck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                ) : (
                  <Database className="w-10 h-10 text-blue-400 mx-auto mb-2" />
                )}
                <p className="font-bold text-sm text-slate-200">
                  {file ? file.name : uploadMode === 'logistics_double_verify' ? 'Choose Waybill / Delivery Voucher / Photo' : 'Choose Evidence File / Site Photo'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports JPG, PNG, PDF, CSV, XLSX (Up to 20MB)
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,.txt,.csv,.xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Description / Waybill Summary</label>
            <textarea
              rows={2}
              placeholder={uploadMode === 'logistics_double_verify' ? "e.g. Waybill verified by site gate officer. 45 MT TMT steel offloaded at yard." : "Describe what this evidence shows..."}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className={clsx(inputField, "resize-none")}
            />
          </div>

          {/* Link Directly to Schedule Activity */}
          {activities.length > 0 && (
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Link to Schedule Activity (Optional)
              </label>
              <select
                value={selectedActivityId}
                onChange={e => setSelectedActivityId(e.target.value)}
                className={selectField}
              >
                <option value="">-- No specific activity link --</option>
                {activities.map(act => (
                  <option key={act.id} value={act.id}>
                    [{act.activity_id}] {act.activity_name} ({act.status || 'Active'})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Location / Site Zone</label>
              <input
                type="text"
                placeholder="e.g. Central Yard / Block B"
                value={location}
                onChange={e => setLocation(e.target.value)}
                className={inputField}
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Delivery / Capture Date</label>
              <input
                type="date"
                value={reportedDate}
                onChange={e => setReportedDate(e.target.value)}
                className={inputField}
              />
            </div>
          </div>

          <details open={uploadMode === 'logistics_double_verify'} className="text-xs group">
            <summary className="font-semibold text-slate-400 cursor-pointer hover:text-slate-300 mb-2">
              + Material / Quantities Breakdown
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <input
                type="text"
                placeholder="Material name (e.g. TMT Steel 16mm)"
                value={materialName}
                onChange={e => setMaterialName(e.target.value)}
                className={inputField}
              />
              <input
                type="text"
                placeholder="Verified Delivered Quantity (e.g. 45 MT)"
                value={recordedQty}
                onChange={e => setRecordedQty(e.target.value)}
                className={inputField}
              />
            </div>
          </details>

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
              disabled={uploading || !file}
              className={uploadMode === 'logistics_double_verify' ? "px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs cursor-pointer disabled:opacity-50" : btnPrimary}
            >
              {uploading
                ? 'Uploading & Verifying...'
                : uploadMode === 'logistics_double_verify'
                  ? 'Double Verify & Upload Waybill'
                  : 'Upload & Analyze Evidence'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Lightbox Inspection Modal */}
      <Modal
        isOpen={!!previewEvidence}
        onClose={() => setPreviewEvidence(null)}
        title={previewEvidence?.filename || 'Evidence Inspection'}
        subtitle="Verifiable field documentation artifact"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-3">
            <div className="flex items-center justify-between">
              <EvidenceBadge type={previewEvidence?.evidence_type} />
              <span className="font-mono text-slate-400">
                {previewEvidence?.uploaded_at ? new Date(previewEvidence.uploaded_at).toLocaleDateString('en-IN') : ''}
              </span>
            </div>

            <p className="font-bold text-sm text-slate-200">{previewEvidence?.filename}</p>
            {previewEvidence?.description && (
              <p className="text-slate-300 leading-relaxed">{previewEvidence.description}</p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800 text-[11px]">
              {previewEvidence?.location && <div><span className="text-slate-500">Location:</span> <span className="text-slate-300 font-semibold">{previewEvidence.location}</span></div>}
              {previewEvidence?.material_name && <div><span className="text-slate-500">Material:</span> <span className="text-slate-300 font-semibold">{previewEvidence.material_name}</span></div>}
              {previewEvidence?.recorded_quantity && <div><span className="text-slate-500">Verified Quantity:</span> <span className="text-emerald-400 font-mono font-bold">{previewEvidence.recorded_quantity}</span></div>}
              {previewEvidence?.equipment_name && <div><span className="text-slate-500">Carrier / Truck:</span> <span className="text-slate-300 font-semibold">{previewEvidence.equipment_name}</span></div>}
            </div>

            {previewEvidence?.ai_analysis && (
              <div className="p-3 rounded-lg bg-purple-950/30 border border-purple-800/40 text-purple-200 space-y-1">
                <p className="font-bold text-[10px] uppercase text-purple-400">AI Visual & Extraction Analysis:</p>
                {previewEvidence.ai_analysis.detected_indicators?.map((ind: string, idx: number) => (
                  <p key={idx} className="text-[11px]">• {ind}</p>
                ))}
                {previewEvidence.ai_analysis.progress_estimation && (
                  <p className="italic text-[10px] text-amber-300 pt-1">Note: {previewEvidence.ai_analysis.progress_estimation}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button
              onClick={() => setPreviewEvidence(null)}
              className={btnSecondary}
            >
              Close Inspection
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. Link Evidence to Activity Modal */}
      <Modal
        isOpen={!!linkModalEvidence}
        onClose={() => setLinkModalEvidence(null)}
        title="Link Evidence to Schedule Activity"
        subtitle={linkModalEvidence ? `Link ${linkModalEvidence.filename} to a baseline activity` : ''}
      >
        <form onSubmit={handleLinkEvidence} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Select Schedule Activity <span className="text-rose-400">*</span>
            </label>
            <select
              value={linkingActivityId}
              onChange={e => setLinkingActivityId(e.target.value)}
              required
              className={selectField}
            >
              <option value="">-- Choose Schedule Activity --</option>
              {activities.map(act => (
                <option key={act.id} value={act.id}>
                  [{act.activity_id}] {act.activity_name} ({act.status || 'Active'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setLinkModalEvidence(null)}
              className={btnSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={linking || !linkingActivityId}
              className={btnPrimary}
            >
              {linking ? 'Linking...' : 'Link to Activity'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
