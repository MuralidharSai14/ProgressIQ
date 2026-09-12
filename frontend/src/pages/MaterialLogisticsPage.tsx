/**
 * PROGRESSIQ — Material Logistics Page
 * Monitor shipments, inventory levels, shortage conflicts, and physical delivery double verification with waybills & inspection proof.
 */
import { useState, useEffect, useRef } from 'react'
import {
  Package, RefreshCw, Plus, AlertTriangle, CheckCircle2,
  Truck, Clock, XCircle, Upload, FileText, Check
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import {
  PageHeader, LoadingSpinner, EmptyState, WarningBox,
  Modal, btnPrimary, btnSecondary, btnSuccess, inputField, selectField
} from '../components/ui'

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  ordered: { icon: Clock, color: 'text-slate-400', label: 'Ordered' },
  in_transit: { icon: Truck, color: 'text-cyan-400', label: 'In Transit' },
  delivered: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Delivered' },
  delayed: { icon: AlertTriangle, color: 'text-amber-400', label: 'Delayed' },
  shortage: { icon: XCircle, color: 'text-rose-400', label: 'Shortage' },
  cancelled: { icon: XCircle, color: 'text-slate-500', label: 'Cancelled' },
}

const PRIORITY_COLOR: Record<string, string> = {
  low: 'text-slate-400 border-slate-500/30 bg-slate-500/10',
  medium: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  high: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  critical: 'text-rose-400 border-rose-500/30 bg-rose-500/10 font-bold',
}

const CATEGORIES = ['Steel', 'Concrete', 'Piping', 'Electrical', 'Civil', 'Structural', 'Mechanical', 'Instrumentation', 'Chemicals', 'Consumables', 'Other']
const STATUSES = ['ordered', 'in_transit', 'delivered', 'delayed', 'shortage', 'cancelled']
const PRIORITIES = ['low', 'medium', 'high', 'critical']
const UNITS = ['MT', 'm³', 'm', 'nos', 'kg', 'L', 'sets', 'rolls', 'bags', 'units']

export default function MaterialLogisticsPage() {
  const { projectId } = useProject()
  const { theme } = useTheme()
  const { success, error } = useToast()
  const isDark = theme === 'dark'

  const [data, setData] = useState<any>(null)
  const [shortages, setShortages] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Double Verification Modal State
  const [verifyShipment, setVerifyShipment] = useState<any | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [waybillFile, setWaybillFile] = useState<File | null>(null)
  const [waybillFilePreview, setWaybillFilePreview] = useState<string | null>(null)
  const [verifiedQty, setVerifiedQty] = useState('')
  const [waybillNumber, setWaybillNumber] = useState('')
  const [truckNumber, setTruckNumber] = useState('')
  const [receiverNotes, setReceiverNotes] = useState('')
  const [proofType, setProofType] = useState('Waybill / Dispatch Challan')
  const waybillInputRef = useRef<HTMLInputElement>(null)

  // Preview Voucher Lightbox
  const [previewNote, setPreviewNote] = useState<{ title: string; notes: string } | null>(null)

  const [form, setForm] = useState({
    material_name: '', category: 'Other', supplier_name: '',
    unit: 'MT', required_quantity: '', ordered_quantity: '',
    delivered_quantity: '', status: 'ordered', priority: 'medium',
    expected_delivery: '', delay_reason: '', notes: '',
  })

  const load = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [mat, sho] = await Promise.all([
        apiService.getMaterials(projectId, filterStatus || undefined, filterCategory || undefined),
        apiService.getMaterialShortages(projectId),
      ])
      setData(mat)
      setShortages(sho)
    } catch (e: any) {
      error(e.message || 'Failed to load materials')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [projectId, filterStatus, filterCategory])

  const handleWaybillFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null
    setWaybillFile(selected)
    if (selected && selected.type.startsWith('image/')) {
      const url = URL.createObjectURL(selected)
      setWaybillFilePreview(url)
    } else {
      setWaybillFilePreview(null)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !form.material_name.trim()) return
    setSubmitting(true)
    try {
      await apiService.createMaterial(projectId, {
        ...form,
        required_quantity: parseFloat(form.required_quantity) || 0,
        ordered_quantity: parseFloat(form.ordered_quantity) || 0,
        delivered_quantity: parseFloat(form.delivered_quantity) || 0,
        expected_delivery: form.expected_delivery || null,
      })
      success(`Material '${form.material_name}' added to logistics tracker.`)
      setForm({ material_name: '', category: 'Other', supplier_name: '', unit: 'MT', required_quantity: '', ordered_quantity: '', delivered_quantity: '', status: 'ordered', priority: 'medium', expected_delivery: '', delay_reason: '', notes: '' })
      setShowAddModal(false)
      await load()
    } catch (e: any) {
      error(e.message || 'Failed to add material')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDoubleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !verifyShipment || !waybillFile) {
      error('Please select a waybill or proof document to upload.')
      return
    }
    setVerifying(true)
    try {
      const qtyNum = verifiedQty ? parseFloat(verifiedQty) : verifyShipment.ordered_quantity || verifyShipment.required_quantity

      // 1. Upload evidence document to Evidence Center
      const formData = new FormData()
      formData.append('file', waybillFile)
      formData.append('description', `[DOUBLE VERIFIED WAYBILL - ${proofType}] ${receiverNotes || `Shipment voucher for ${verifyShipment.material_name} (Waybill #${waybillNumber || 'N/A'})`}`)
      formData.append('material_name', verifyShipment.material_name)
      formData.append('recorded_quantity', `${qtyNum} ${verifyShipment.unit}`)
      formData.append('expected_quantity', `${verifyShipment.required_quantity} ${verifyShipment.unit}`)
      formData.append('equipment_name', truckNumber || 'Site Delivery Carrier')
      formData.append('reported_date', new Date().toISOString().split('T')[0])

      const evResult = await apiService.uploadEvidence(projectId, formData)

      // 2. Link to activity if shipment is tied to one
      if (evResult?.evidence_id && verifyShipment.activity_id) {
        await apiService.linkEvidence(evResult.evidence_id, {
          activity_id: verifyShipment.activity_id,
          link_reason: `Double verified delivery for ${verifyShipment.material_name}`,
        })
      }

      // 3. Update material shipment delivered quantity & status
      await apiService.updateMaterial(verifyShipment.id, {
        delivered_quantity: qtyNum,
        status: qtyNum >= verifyShipment.required_quantity ? 'delivered' : 'in_transit',
        notes: `Double Verified: ${proofType} #${waybillNumber || waybillFile.name} attached & verified on site.`,
      })

      success(`Double Verification Complete: ${verifyShipment.material_name} verified with waybill!`)
      setVerifyShipment(null)
      setWaybillFile(null)
      setWaybillFilePreview(null)
      setVerifiedQty('')
      setWaybillNumber('')
      setTruckNumber('')
      setReceiverNotes('')
      await load()
    } catch (e: any) {
      error(e.message || 'Double verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const handleQuickUpdate = async (id: number, statusVal: string) => {
    try {
      await apiService.updateMaterial(id, { status: statusVal })
      success('Material status updated.')
      await load()
    } catch (e: any) {
      error(e.message || 'Update failed')
    }
  }

  if (!projectId) {
    return (
      <WarningBox message="No project selected. Open the Projects directory or select a project in the top header to view material logistics." />
    )
  }

  const shipments = data?.shipments || []
  const doubleVerifiedCount = shipments.filter((s: any) => s.notes?.includes('Double Verified') || s.status === 'delivered').length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Material Logistics"
        subtitle="Track site materials shipments, required inventory vs delivered quantities, and supply chain double verification"
      >
        <button
          onClick={load}
          className={btnSecondary}
          title="Refresh logistics"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
        <button
          onClick={() => setShowAddModal(true)}
          className={btnPrimary}
        >
          <Plus className="w-3.5 h-3.5" /> Add Material Item
        </button>
      </PageHeader>

      {/* Double Verification Protocol Banner */}
      <div className={clsx(
        "p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed",
        isDark ? "bg-slate-900/60 border-slate-800 text-slate-300" : "bg-emerald-50/60 border-emerald-200 text-emerald-950"
      )}>
        <Truck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-xs">Logistics Double Verification Protocol</p>
          <p className="text-[11px] text-slate-400 leading-normal">
            To prevent premature milestone claims, upload physical <strong>Waybills, Weighbridge Tickets, or Gate Passes</strong> directly to shipments. Double Verification ensures materials are physically offloaded, verified, and certified on site.
          </p>
        </div>
      </div>

      {/* Summary KPI cards */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className={clsx("p-4 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Materials</p>
            <p className="text-2xl font-black text-white mt-0.5">{data.total}</p>
          </div>
          <div className={clsx("p-4 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Double Verified</p>
            <p className="text-2xl font-black text-emerald-400 mt-0.5">{doubleVerifiedCount}</p>
          </div>
          <div className={clsx("p-4 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">In Transit</p>
            <p className="text-2xl font-black text-cyan-400 mt-0.5">{data.status_counts?.in_transit || 0}</p>
          </div>
          <div className={clsx("p-4 rounded-xl border", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shortage Conflicts</p>
            <p className={clsx("text-2xl font-black mt-0.5", (shortages?.conflict_count || 0) > 0 ? "text-rose-400" : "text-emerald-400")}>
              {shortages?.conflict_count || 0}
            </p>
          </div>
        </div>
      )}

      {/* Overall Delivery Progress Bar */}
      {data && (
        <div className={clsx(
          "p-4 rounded-2xl border space-y-2",
          isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="flex justify-between text-xs font-semibold">
            <span className={isDark ? 'text-slate-300' : 'text-slate-700'}>Overall Logistics Fulfillment</span>
            <span className="font-mono font-bold text-blue-400">{data.overall_delivery_pct}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${data.overall_delivery_pct}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            {data.total_delivered?.toFixed(1)} / {data.total_required?.toFixed(1)} total units fulfilled across all site packages
          </p>
        </div>
      )}

      {/* Shortages Alert Box */}
      {shortages && shortages.conflict_count > 0 && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <AlertTriangle className="w-4 h-4" />
            {shortages.conflict_count} Active Material Shortage Conflict{shortages.conflict_count > 1 ? 's' : ''}
          </div>
          <div className="space-y-1.5">
            {shortages.conflicts.map((c: any) => (
              <div key={c.shipment_id} className="flex items-center justify-between text-xs bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="font-semibold text-slate-200">{c.material_name}</span>
                <span className="text-rose-400 font-mono font-bold">{c.shortage_pct}% Deficit</span>
                <span className="text-slate-400 text-[11px]">{c.delay_reason || 'Supply delay'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className={clsx(
        "p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3",
        isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      )}>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className={selectField}
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>)}
          </select>

          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className={selectField}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {(filterStatus || filterCategory) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterCategory(''); }}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Clear filters
            </button>
          )}
        </div>

        <span className="text-xs text-slate-400 font-medium">
          {shipments.length} item(s) tracked
        </span>
      </div>

      {/* Shipments List */}
      {loading ? (
        <LoadingSpinner text="Loading materials & shipments..." />
      ) : shipments.length === 0 ? (
        <EmptyState
          icon={<Package className="w-12 h-12" />}
          title="No materials logged"
          message="Add your first material shipment to track site inventory and delivery schedules."
          action={
            <button onClick={() => setShowAddModal(true)} className={btnPrimary}>
              <Plus className="w-4 h-4" /> Add Material
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {shipments.map((s: any) => {
            const cfg = STATUS_CONFIG[s.status] || STATUS_CONFIG.ordered
            const StatusIcon = cfg.icon
            const deliveryPct = s.required_quantity > 0
              ? Math.min(100, Math.round((s.delivered_quantity / s.required_quantity) * 100))
              : 0
            const isVerified = s.notes?.includes('Double Verified') || s.status === 'delivered'

            return (
              <div
                key={s.id}
                className={clsx(
                  "p-4 rounded-2xl border transition-all space-y-3",
                  isVerified
                    ? isDark ? "bg-slate-900/80 border-emerald-500/30" : "bg-white border-emerald-300 shadow-xs"
                    : isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={clsx("font-bold text-sm truncate", isDark ? "text-slate-100" : "text-slate-900")}>
                          {s.material_name}
                        </h3>
                        {isVerified && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Double Verified
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {s.category} · Supplier: <strong className="text-slate-300">{s.supplier_name || 'Unassigned'}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 flex-wrap">
                    <button
                      onClick={() => {
                        setVerifyShipment(s)
                        setVerifiedQty(String(s.ordered_quantity || s.required_quantity))
                      }}
                      className={clsx(btnSecondary, "text-xs py-1 px-2.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10")}
                      title="Upload Waybill or Weighbridge Slip for Double Verification"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isVerified ? 'Update Waybill' : 'Double Verify'}</span>
                    </button>

                    <span className={clsx('text-[10px] font-bold border rounded-full px-2 py-0.5 uppercase', PRIORITY_COLOR[s.priority] || PRIORITY_COLOR.medium)}>
                      {s.priority} Priority
                    </span>
                    <span className={clsx('flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded border border-slate-700 bg-slate-800', cfg.color)}>
                      <StatusIcon className="w-3.5 h-3.5" /> {cfg.label}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Delivered: <strong className="text-slate-200">{s.delivered_quantity}</strong> / {s.required_quantity} {s.unit}</span>
                    <span className="font-mono font-bold text-blue-400">{deliveryPct}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={clsx(
                        "h-full rounded-full transition-all",
                        deliveryPct >= 100 ? "bg-emerald-500" : s.status === 'shortage' ? "bg-rose-500" : "bg-blue-500"
                      )}
                      style={{ width: `${deliveryPct}%` }}
                    />
                  </div>
                </div>

                {/* Footer status update & notes */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs text-slate-400">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>
                      Expected: {s.expected_delivery ? new Date(s.expected_delivery).toLocaleDateString('en-IN') : 'No date set'}
                      {s.delay_reason && <span className="text-amber-400 ml-2">⚠ {s.delay_reason}</span>}
                    </span>

                    {s.notes && (
                      <button
                        onClick={() => setPreviewNote({ title: s.material_name, notes: s.notes })}
                        className="text-[11px] text-blue-400 hover:text-blue-300 underline underline-offset-2 flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" /> View Waybill Note
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-[11px] text-slate-500">Quick Update:</span>
                    <select
                      value={s.status}
                      onChange={e => handleQuickUpdate(s.id, e.target.value)}
                      className={clsx(selectField, "py-1 text-[11px]")}
                    >
                      {STATUSES.map(st => <option key={st} value={st}>{STATUS_CONFIG[st]?.label || st}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 1. Modal: Add Material Shipment */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Material Shipment"
        subtitle="Log material requirements, supplier details, and expected delivery milestones"
      >
        <form onSubmit={handleAdd} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-semibold mb-1">Material Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Reinforced TMT Rebar 25mm Fe500D"
                value={form.material_name}
                onChange={e => setForm(p => ({ ...p, material_name: e.target.value }))}
                className={inputField}
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className={clsx(selectField, "w-full")}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Supplier Name</label>
              <input
                type="text"
                placeholder="e.g. Jindal Steel & Power"
                value={form.supplier_name}
                onChange={e => setForm(p => ({ ...p, supplier_name: e.target.value }))}
                className={inputField}
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Required Quantity</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={form.required_quantity}
                  onChange={e => setForm(p => ({ ...p, required_quantity: e.target.value }))}
                  className={inputField}
                />
                <select
                  value={form.unit}
                  onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                  className={clsx(selectField, "w-24")}
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Delivered Quantity</label>
              <input
                type="number"
                step="any"
                placeholder="0"
                value={form.delivered_quantity}
                onChange={e => setForm(p => ({ ...p, delivered_quantity: e.target.value }))}
                className={inputField}
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className={clsx(selectField, "w-full")}
              >
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
                className={clsx(selectField, "w-full capitalize")}
              >
                {PRIORITIES.map(p => <option key={p} value={p}>{p} Priority</option>)}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-slate-400 font-semibold mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={form.expected_delivery}
                onChange={e => setForm(p => ({ ...p, expected_delivery: e.target.value }))}
                className={inputField}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className={btnSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.material_name.trim()}
              className={btnPrimary}
            >
              {submitting ? 'Adding Material...' : 'Add to Logistics Tracker'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 2. Modal: Double Verification Waybill Upload */}
      <Modal
        isOpen={!!verifyShipment}
        onClose={() => setVerifyShipment(null)}
        title="Double Verify Material Shipment"
        subtitle={verifyShipment ? `Substantiate physical dispatch & delivery for ${verifyShipment.material_name}` : ''}
      >
        <form onSubmit={handleDoubleVerify} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-200 space-y-1">
            <p className="font-bold">Shipment Specification:</p>
            <p className="text-[11px]">
              Material: <strong>{verifyShipment?.material_name}</strong> · Required: <strong>{verifyShipment?.required_quantity} {verifyShipment?.unit}</strong> · Supplier: <strong>{verifyShipment?.supplier_name || 'N/A'}</strong>
            </p>
          </div>

          {/* Dropzone with Live Preview */}
          <div
            onClick={() => waybillInputRef.current?.click()}
            className={clsx(
              "border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all",
              waybillFile
                ? "border-emerald-500 bg-emerald-500/5"
                : isDark
                  ? "border-slate-700 hover:border-slate-600 bg-slate-900/40"
                  : "border-slate-300 hover:border-slate-400 bg-slate-50"
            )}
          >
            {waybillFilePreview ? (
              <div className="flex flex-col items-center justify-center gap-2">
                <img
                  src={waybillFilePreview}
                  alt="Waybill Preview"
                  className="w-24 h-24 object-cover rounded-xl border border-slate-700 shadow-md"
                />
                <p className="font-bold text-slate-200 text-xs">{waybillFile?.name}</p>
                <p className="text-[10px] text-emerald-400">Waybill photo preview loaded (Click to change)</p>
              </div>
            ) : (
              <>
                <Truck className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <p className="font-bold text-sm text-slate-200">
                  {waybillFile ? waybillFile.name : 'Upload Waybill / Weighbridge Slip / Delivery Photo'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports PDF, JPG, PNG, XLSX (Up to 20MB)
                </p>
              </>
            )}
            <input
              ref={waybillInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.pdf,.csv,.xlsx,.txt"
              onChange={handleWaybillFileChange}
              className="hidden"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Proof Category</label>
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
              <label className="block text-slate-300 font-semibold mb-1">
                Verified Quantity Delivered ({verifyShipment?.unit || 'Units'}) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="any"
                required
                placeholder="e.g. 45"
                value={verifiedQty}
                onChange={e => setVerifiedQty(e.target.value)}
                className={inputField}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Waybill / Challan Number</label>
              <input
                type="text"
                placeholder="e.g. WB-2026-94821"
                value={waybillNumber}
                onChange={e => setWaybillNumber(e.target.value)}
                className={inputField}
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Truck / Carrier Number</label>
              <input
                type="text"
                placeholder="e.g. NL-01-AB-4492"
                value={truckNumber}
                onChange={e => setTruckNumber(e.target.value)}
                className={inputField}
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Receiver / Quality Verification Notes</label>
            <textarea
              rows={2}
              placeholder="e.g. Materials received in intact condition, verified against weighbridge ticket #4492 by Site Engineer."
              value={receiverNotes}
              onChange={e => setReceiverNotes(e.target.value)}
              className={clsx(inputField, "resize-none")}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setVerifyShipment(null)}
              className={btnSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={verifying || !waybillFile || !verifiedQty}
              className={btnSuccess}
            >
              {verifying ? 'Uploading & Double Verifying...' : 'Double Verify & Confirm Receipt'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 3. Modal: View Waybill Note */}
      <Modal
        isOpen={!!previewNote}
        onClose={() => setPreviewNote(null)}
        title={previewNote?.title || 'Waybill Verification Note'}
        subtitle="Verifiable delivery voucher summary"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 text-slate-200 leading-relaxed">
            <p className="font-bold text-sm text-emerald-400 mb-2 flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Double Verification Logged
            </p>
            <p className="text-slate-300">{previewNote?.notes}</p>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800">
            <button
              onClick={() => setPreviewNote(null)}
              className={btnSecondary}
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
