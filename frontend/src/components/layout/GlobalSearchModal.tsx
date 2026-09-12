/**
 * PROGRESSIQ — Global Search Command Center (Cmd+K / Ctrl+K)
 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Calendar, FileText, Cpu, Link2, Database, AlertTriangle,
  ShieldCheck, ShieldAlert, BarChart3, Settings, HardHat,
  Package, ScrollText, ArrowRight, Play
} from 'lucide-react'
import clsx from 'clsx'
import { useProject } from '../../hooks/useProject'
import { useTheme } from '../../hooks/useTheme'
import apiService from '../../services/api'

interface SearchItem {
  id: string
  title: string
  subtitle?: string
  category: 'Pages' | 'Actions' | 'Activities'
  icon: React.ElementType
  action: () => void
}

export default function GlobalSearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { projectId, setProject } = useProject()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [query, setQuery] = useState('')
  const [activities, setActivities] = useState<any[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Fetch activities when search modal opens and project is active
  useEffect(() => {
    if (isOpen && projectId) {
      apiService.getSchedule(projectId)
        .then(data => setActivities(data || []))
        .catch(() => setActivities([]))
    }
  }, [isOpen, projectId])

  // Reset query on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Build static navigation items
  const navItems: SearchItem[] = useMemo(() => [
    { id: 'p-overview', title: 'Project Overview', subtitle: 'Executive dashboard & KPIs', category: 'Pages', icon: BarChart3, action: () => { navigate('/'); onClose(); } },
    { id: 'p-projects', title: 'All Projects', subtitle: 'Manage and switch projects', category: 'Pages', icon: HardHat, action: () => { navigate('/projects'); onClose(); } },
    { id: 'p-schedule', title: 'Schedule Baseline', subtitle: 'L1–L6 WBS planned activities', category: 'Pages', icon: Calendar, action: () => { navigate('/schedule'); onClose(); } },
    { id: 'p-reports', title: 'Field Updates & DPR', subtitle: 'Uploaded site progress reports', category: 'Pages', icon: FileText, action: () => { navigate('/reports'); onClose(); } },
    { id: 'p-extract', title: 'AI Extraction', subtitle: 'Extract structured items from text', category: 'Pages', icon: Cpu, action: () => { navigate('/extraction'); onClose(); } },
    { id: 'p-match', title: 'Activity Matching', subtitle: 'Semantic vector AI schedule matching', category: 'Pages', icon: Link2, action: () => { navigate('/matching'); onClose(); } },
    { id: 'p-evidence', title: 'Evidence Center', subtitle: 'Site photos, logs, delivery records', category: 'Pages', icon: Database, action: () => { navigate('/evidence'); onClose(); } },
    { id: 'p-conflicts', title: 'Conflict Center', subtitle: 'Variance & evidence discrepancies', category: 'Pages', icon: AlertTriangle, action: () => { navigate('/conflicts'); onClose(); } },
    { id: 'p-verify', title: 'Verification Queue', subtitle: 'Human-in-the-loop validation tasks', category: 'Pages', icon: ShieldCheck, action: () => { navigate('/verification'); onClose(); } },
    { id: 'p-risks', title: 'Risk Intelligence', subtitle: 'Rule-based explainable risks & delays', category: 'Pages', icon: ShieldAlert, action: () => { navigate('/risks'); onClose(); } },
    { id: 'p-logistics', title: 'Material Logistics', subtitle: 'Shipments & inventory shortage tracking', category: 'Pages', icon: Package, action: () => { navigate('/logistics'); onClose(); } },
    { id: 'p-safety', title: 'Worker Safety', subtitle: 'Hazard assessment and PPE compliance', category: 'Pages', icon: HardHat, action: () => { navigate('/worker-safety'); onClose(); } },
    { id: 'p-audit', title: 'Audit Trail', subtitle: 'Chronological AI and human action logs', category: 'Pages', icon: ScrollText, action: () => { navigate('/audit'); onClose(); } },
    { id: 'p-analytics', title: 'Reports & Analytics', subtitle: 'Progress S-curves & variance tables', category: 'Pages', icon: BarChart3, action: () => { navigate('/analytics'); onClose(); } },
    { id: 'p-settings', title: 'Project Settings', subtitle: 'System status & project management', category: 'Pages', icon: Settings, action: () => { navigate('/settings'); onClose(); } },
  ], [navigate, onClose])

  // Build action items
  const actionItems: SearchItem[] = useMemo(() => [
    {
      id: 'a-demo',
      title: 'Load Demo Project',
      subtitle: 'Instantly load Indravati River Pumping Station dataset',
      category: 'Actions',
      icon: Play,
      action: async () => {
        try {
          const res = await apiService.loadDemo()
          if (res.success) {
            setProject(res.project_id, res.project_name)
            navigate('/')
          }
        } catch { /* ignored */ }
        onClose()
      },
    },
  ], [setProject, navigate, onClose])

  // Build activity items
  const activityItems: SearchItem[] = useMemo(() => {
    if (!activities.length) return []
    return activities.slice(0, 30).map(a => ({
      id: `act-${a.id}`,
      title: `${a.activity_id} — ${a.activity_name}`,
      subtitle: `L${a.level} · Planned: ${a.planned_progress}% · Actual: ${a.actual_progress}% · Status: ${a.status}`,
      category: 'Activities',
      icon: Calendar,
      action: () => {
        navigate(`/activity/${a.id}`)
        onClose()
      }
    }))
  }, [activities, navigate, onClose])

  // Filter items based on query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return [...navItems.slice(0, 6), ...actionItems]
    }
    const all = [...navItems, ...actionItems, ...activityItems]
    return all.filter(item => 
      item.title.toLowerCase().includes(q) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(q))
    )
  }, [query, navItems, actionItems, activityItems])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % (filteredItems.length || 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action()
        }
      } else if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, filteredItems, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className={clsx(
          "w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all",
          isDark ? "bg-slate-900 border-slate-700/80 text-slate-100" : "bg-white border-slate-200 text-slate-900"
        )}
      >
        {/* Search input bar */}
        <div className={clsx("flex items-center gap-3 px-4 py-3.5 border-b", isDark ? "border-slate-800" : "border-slate-100")}>
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search activities, pages, or actions... (Esc to close)"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500 font-medium"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-xs text-slate-500 hover:text-slate-300">
              Clear
            </button>
          )}
        </div>

        {/* Results list */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              No matching results found for "<span className="font-semibold text-slate-400">{query}</span>"
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon
              const isSelected = idx === selectedIndex
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={clsx(
                    "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer",
                    isSelected
                      ? isDark
                        ? "bg-blue-600/20 text-white border border-blue-500/30"
                        : "bg-blue-50 text-blue-950 border border-blue-200"
                      : isDark
                        ? "text-slate-300 hover:bg-slate-800/60"
                        : "text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={clsx("p-1.5 rounded-lg shrink-0", isSelected ? "bg-blue-500/20 text-blue-400" : isDark ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-600")}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className={clsx("text-[11px] truncate mt-0.5", isDark ? "text-slate-400" : "text-slate-500")}>
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={clsx("text-[10px] px-1.5 py-0.5 rounded border uppercase tracking-wider", isDark ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-400")}>
                      {item.category}
                    </span>
                    <ArrowRight className={clsx("w-3.5 h-3.5", isSelected ? "text-blue-400 opacity-100" : "opacity-0")} />
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className={clsx("px-4 py-2 border-t flex items-center justify-between text-[11px] text-slate-500", isDark ? "border-slate-800 bg-slate-950/40" : "border-slate-100 bg-slate-50")}>
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400">↵</kbd> Select</span>
            <span><kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-400">Esc</kbd> Close</span>
          </div>
          <span>PROGRESSIQ Intelligence</span>
        </div>
      </div>
    </div>
  )
}
