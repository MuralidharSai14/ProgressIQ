/**
 * PROGRESSIQ — Notifications & Alerts Drawer
 * Real-time operational intelligence notifications for the active project.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ShieldCheck, ShieldAlert,
  ArrowRight, CheckCircle2, RefreshCw
} from 'lucide-react'
import clsx from 'clsx'
import { useProject } from '../../hooks/useProject'
import { useTheme } from '../../hooks/useTheme'
import apiService from '../../services/api'
import { Drawer, RiskBadge, ConflictBadge, PriorityBadge } from '../ui'

export default function NotificationsDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { projectId } = useProject()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [loading, setLoading] = useState(false)
  const [verifications, setVerifications] = useState<any[]>([])
  const [conflicts, setConflicts] = useState<any[]>([])
  const [risks, setRisks] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'verification' | 'conflicts' | 'risks'>('all')

  const fetchAlerts = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const [vData, cData, rData] = await Promise.allSettled([
        apiService.getVerificationQueue(projectId, 'pending'),
        apiService.getConsistency(projectId),
        apiService.getRisks(projectId),
      ])

      if (vData.status === 'fulfilled') setVerifications(vData.value?.tasks || [])
      if (cData.status === 'fulfilled') setConflicts(cData.value?.conflicts || [])
      if (rData.status === 'fulfilled') {
        const activeRisks = (rData.value?.risks || []).filter((r: any) => !r.is_resolved && (r.level === 'critical' || r.level === 'high'))
        setRisks(activeRisks)
      }
    } catch { /* ignored */ }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (isOpen && projectId) {
      fetchAlerts()
    }
  }, [isOpen, projectId])

  const totalCount = verifications.length + conflicts.length + risks.length

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Project Notifications & Alerts"
      subtitle={`${totalCount} active items requiring attention`}
    >
      <div className="space-y-4">
        {/* Top Controls & Filter Tabs */}
        <div className="flex items-center justify-between border-b pb-3 border-slate-800/40">
          <div className="flex gap-1">
            {[
              { id: 'all', label: `All (${totalCount})` },
              { id: 'verification', label: `Verify (${verifications.length})` },
              { id: 'conflicts', label: `Conflicts (${conflicts.length})` },
              { id: 'risks', label: `Risks (${risks.length})` },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={clsx(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                  activeTab === tab.id
                    ? isDark ? "bg-blue-600 text-white" : "bg-blue-600 text-white"
                    : isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchAlerts}
            disabled={loading}
            className="p-1 rounded text-slate-400 hover:text-white"
            title="Refresh alerts"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
        </div>

        {/* Notifications List */}
        {totalCount === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
            <p className="text-xs font-semibold text-slate-300">All clear!</p>
            <p className="text-[11px] mt-0.5">No critical alerts or pending verifications at this time.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Verification Items */}
            {(activeTab === 'all' || activeTab === 'verification') && verifications.map(v => (
              <div
                key={`v-${v.id}`}
                className={clsx(
                  "p-3 rounded-xl border space-y-2 transition-all",
                  isDark ? "bg-slate-900/80 border-slate-800 hover:border-amber-500/40" : "bg-slate-50 border-slate-200 hover:border-amber-400"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    <ShieldCheck className="w-3.5 h-3.5" /> Verification Required
                  </span>
                  <PriorityBadge priority={v.priority} />
                </div>
                <p className="text-xs font-semibold text-slate-200">{v.activity?.activity_name || 'Activity'}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{v.trigger_reason}</p>
                <button
                  onClick={() => { navigate('/verification'); onClose(); }}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1 cursor-pointer"
                >
                  Review in Verification Queue <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Conflict Items */}
            {(activeTab === 'all' || activeTab === 'conflicts') && conflicts.map(c => (
              <div
                key={`c-${c.id}`}
                className={clsx(
                  "p-3 rounded-xl border space-y-2 transition-all",
                  isDark ? "bg-slate-900/80 border-slate-800 hover:border-rose-500/40" : "bg-slate-50 border-slate-200 hover:border-rose-400"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
                    <AlertTriangle className="w-3.5 h-3.5" /> Discrepancy
                  </span>
                  <ConflictBadge severity={c.severity} />
                </div>
                <p className="text-xs font-semibold text-slate-200">{c.title}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{c.description}</p>
                <button
                  onClick={() => { navigate('/conflicts'); onClose(); }}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1 cursor-pointer"
                >
                  Inspect in Conflict Center <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Risk Items */}
            {(activeTab === 'all' || activeTab === 'risks') && risks.map(r => (
              <div
                key={`r-${r.id}`}
                className={clsx(
                  "p-3 rounded-xl border space-y-2 transition-all",
                  isDark ? "bg-slate-900/80 border-slate-800 hover:border-orange-500/40" : "bg-slate-50 border-slate-200 hover:border-orange-400"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">
                    <ShieldAlert className="w-3.5 h-3.5" /> High Risk Alert
                  </span>
                  <RiskBadge level={r.level} />
                </div>
                <p className="text-xs font-semibold text-slate-200">{r.title.replace(/^(CRITICAL|HIGH|MEDIUM|LOW) RISK:\s*/i, '')}</p>
                <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">{r.description}</p>
                <button
                  onClick={() => { navigate('/risks'); onClose(); }}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1 cursor-pointer"
                >
                  View Risk Matrix <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  )
}
