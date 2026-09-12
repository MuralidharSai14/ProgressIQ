/**
 * PROGRESSIQ — Projects Directory Page
 * Manage, switch, create, and inspect infrastructure and construction projects.
 */
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FolderKanban, Plus, Search, Trash2, ArrowRight, Play,
  Building2, MapPin, Calendar, CheckCircle2, RefreshCw,
  Sparkles, Code, Sun, Layers
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import {
  PageHeader, LoadingSpinner, EmptyState, Modal,
  btnPrimary, btnSecondary, inputField, selectField
} from '../components/ui'

interface IndustryTemplate {
  id: string
  name: string
  category: string
  organization: string
  location: string
  description: string
  badge: string
  activities_count: number
  icon: string
}

const DEFAULT_TEMPLATES: IndustryTemplate[] = [
  {
    id: "infrastructure",
    name: "Indravati River Pumping Station & Pipeline",
    category: "Infrastructure & Utilities",
    organization: "National Infrastructure & Energy Corp",
    location: "Indravati River Basin, Odisha",
    description: "70 WBS activities across intake structures, pumping houses, pipeline trenching, thrust blocks, and HT transmission lines.",
    badge: "Water & Pipeline",
    activities_count: 70,
    icon: "infrastructure",
  },
  {
    id: "construction",
    name: "Skyline Heights Commercial Center & Tower",
    category: "Commercial Real Estate & Civil",
    organization: "Apex Urban Developments Ltd",
    location: "Sector 62, Metro City",
    description: "G+24 high-rise building with raft foundation, shear walls, unitized curtain wall facade, and MEP systems.",
    badge: "Building & Civil",
    activities_count: 22,
    icon: "construction",
  },
  {
    id: "software",
    name: "NextGen Enterprise Cloud Platform",
    category: "Software & Information Technology",
    organization: "Synapse Digital Solutions",
    location: "Global / Multi-Region Cloud (AWS & GCP)",
    description: "Microservices APIs, OAuth2 RBAC, React UI, AI vector search pipeline, automated CI/CD, and SOC2 audit.",
    badge: "IT & Software",
    activities_count: 18,
    icon: "software",
  },
  {
    id: "energy",
    name: "SuryaKiran 50MW Solar Power Plant",
    category: "Renewable Energy & Power",
    organization: "GreenGrid Clean Power Ltd",
    location: "Bhadla Solar Park, Rajasthan",
    description: "50MW solar array with 110,000 bifacial PV modules, string inverter stations, 33kV switchyard, and SCADA telemetry.",
    badge: "Clean Energy",
    activities_count: 20,
    icon: "energy",
  },
]

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { projectId, setProject, clearProject } = useProject()
  const { theme } = useTheme()
  const { success, error } = useToast()
  const isDark = theme === 'dark'

  const [projects, setProjects] = useState<any[]>([])
  const [templates, setTemplates] = useState<IndustryTemplate[]>(DEFAULT_TEMPLATES)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [loadingTemplateId, setLoadingTemplateId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [org, setOrg] = useState('')
  const [location, setLocation] = useState('')
  const [category, setCategory] = useState('Construction & Civil')

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const data = await apiService.listProjects()
      setProjects(data || [])
    } catch (err: any) {
      error(err.message || 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
    apiService.getTemplates().then((t: any) => {
      if (Array.isArray(t) && t.length > 0) setTemplates(t)
    }).catch(() => {})
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setCreating(true)
    try {
      const created = await apiService.createProject({
        name: name.trim(),
        organization: org.trim() || undefined,
        location: location.trim() || undefined,
      })
      success(`Project "${created.name}" created.`)
      setProject(created.id, created.name)
      setName('')
      setOrg('')
      setLocation('')
      setShowCreateModal(false)
      await fetchProjects()
      navigate('/')
    } catch (err: any) {
      error(err.message || 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number, projName: string) => {
    if (!window.confirm(`Delete project "${projName}"? This action cannot be undone.`)) return
    try {
      await apiService.deleteProject(id)
      success(`Project "${projName}" deleted.`)
      if (projectId === id) {
        clearProject()
      }
      await fetchProjects()
    } catch (err: any) {
      error(err.message || 'Failed to delete project')
    }
  }

  const handleLoadTemplate = async (templateId: string) => {
    setLoadingTemplateId(templateId)
    try {
      const res = await apiService.loadDemo(templateId)
      if (res.success) {
        setProject(res.project_id, res.project_name)
        success(`Project loaded: ${res.project_name}`)
        await fetchProjects()
        navigate('/')
      }
    } catch (err: any) {
      error(err.message || 'Failed to load project template')
    } finally {
      setLoadingTemplateId(null)
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      p.organization?.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q)
    )
  }, [projects, search])

  const getTemplateIcon = (id: string) => {
    switch (id) {
      case 'software': return <Code className="w-5 h-5 text-indigo-400" />
      case 'construction': return <Building2 className="w-5 h-5 text-amber-400" />
      case 'energy': return <Sun className="w-5 h-5 text-emerald-400" />
      default: return <Layers className="w-5 h-5 text-blue-400" />
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects & Workspaces"
        subtitle="Manage, switch, or launch tailored progress intelligence environments across any industry"
      >
        <button
          onClick={() => setShowCreateModal(true)}
          className={btnPrimary}
        >
          <Plus className="w-3.5 h-3.5" />
          Create Custom Project
        </button>
      </PageHeader>

      {/* 🌟 Instant Industry Templates Strip */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Instant Industry Jumpstart Templates</span>
          </p>
          <span className="text-[11px] text-slate-500">1-click populated WBS, DPRs, AI extractions & evidence</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {templates.map(tpl => {
            const isLoading = loadingTemplateId === tpl.id
            return (
              <div
                key={tpl.id}
                className={clsx(
                  "p-4 rounded-xl border flex flex-col justify-between transition-all group hover:border-blue-500/50",
                  isDark ? "bg-slate-900/70 border-slate-800 hover:bg-slate-900" : "bg-white border-slate-200 shadow-xs hover:shadow-md"
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={clsx(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                      tpl.id === 'software' ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" :
                      tpl.id === 'construction' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                      tpl.id === 'energy' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                      "bg-blue-500/10 border-blue-500/20 text-blue-400"
                    )}>
                      {tpl.badge}
                    </span>
                    {getTemplateIcon(tpl.id)}
                  </div>
                  <h4 className="font-bold text-xs text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">
                    {tpl.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed line-clamp-2">
                    {tpl.description}
                  </p>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-500">{tpl.activities_count} WBS Tasks</span>
                  <button
                    onClick={() => handleLoadTemplate(tpl.id)}
                    disabled={Boolean(loadingTemplateId)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/20 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{isLoading ? 'Loading...' : 'Launch'}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects by name, client, or site location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={clsx(inputField, "pl-9")}
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={fetchProjects}
            className={clsx("p-2 rounded-lg border text-slate-400 hover:text-white transition-colors cursor-pointer", isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-300")}
            title="Refresh list"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
          <div className={clsx("flex p-1 rounded-lg border", isDark ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-300")}>
            <button
              onClick={() => setViewMode('grid')}
              className={clsx(
                "px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer",
                viewMode === 'grid'
                  ? isDark ? "bg-slate-800 text-white" : "bg-white text-slate-900 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={clsx(
                "px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer",
                viewMode === 'table'
                  ? isDark ? "bg-slate-800 text-white" : "bg-white text-slate-900 shadow-xs"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Projects List */}
      {loading ? (
        <LoadingSpinner text="Loading projects directory..." />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="w-12 h-12" />}
          title={search ? "No matching projects" : "No projects found"}
          message={search ? `No projects match "${search}". Try clearing search or creating a new project.` : "Initialize your first project or load the complete Indravati River Pumping Station demo."}
          action={
            <div className="flex gap-2">
              <button
                onClick={() => handleLoadTemplate('infrastructure')}
                disabled={Boolean(loadingTemplateId)}
                className={btnPrimary}
              >
                <Play className="w-4 h-4" /> Load Sample Project
              </button>
              <button onClick={() => setShowCreateModal(true)} className={btnSecondary}>
                <Plus className="w-4 h-4" /> Create Project
              </button>
            </div>
          }
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const isActive = projectId === p.id
            return (
              <div
                key={p.id}
                className={clsx(
                  "p-5 rounded-2xl border transition-all flex flex-col justify-between group",
                  isActive
                    ? isDark
                      ? "bg-slate-900 border-blue-500/50 shadow-md shadow-blue-500/5 ring-1 ring-blue-500/30"
                      : "bg-white border-blue-500/60 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/40"
                    : isDark
                      ? "bg-slate-900/70 border-slate-800 hover:border-slate-700"
                      : "bg-white border-slate-200 hover:border-slate-300 shadow-xs"
                )}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={clsx(
                        "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider",
                        isActive
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : isDark ? "bg-slate-800 text-slate-400 border border-slate-700" : "bg-slate-100 text-slate-600 border border-slate-200"
                      )}>
                        {isActive ? 'Active Workspace' : 'Project'}
                      </span>
                      {p.is_demo && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase">
                          Demo
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="text-slate-600 hover:text-rose-400 transition-colors p-1"
                      title="Delete project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className={clsx("font-bold text-base tracking-tight mb-2 leading-snug", isDark ? "text-white" : "text-slate-900")}>
                    {p.name}
                  </h3>

                  <div className="space-y-1.5 text-xs text-slate-400 mb-4">
                    {p.organization && (
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{p.organization}</span>
                      </div>
                    )}
                    {p.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{p.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span>Created: {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-2">
                  {isActive ? (
                    <button
                      onClick={() => navigate('/')}
                      className={clsx(btnPrimary, "w-full text-xs")}
                    >
                      <span>Open Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setProject(p.id, p.name)
                        success(`Switched active workspace to "${p.name}".`)
                        navigate('/')
                      }}
                      className={clsx(btnSecondary, "w-full text-xs")}
                    >
                      <span>Activate & Open</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Table View */
        <div className={clsx("rounded-2xl border overflow-hidden", isDark ? "bg-slate-900/60 border-slate-800" : "bg-white border-slate-200 shadow-xs")}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={clsx("border-b text-slate-400 font-semibold uppercase tracking-wider text-[10px]", isDark ? "border-slate-800 bg-slate-950/60" : "border-slate-200 bg-slate-50")}>
                  <th className="py-3 px-4">Project Name</th>
                  <th className="py-3 px-4">Organization</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {filtered.map(p => {
                  const isActive = projectId === p.id
                  return (
                    <tr
                      key={p.id}
                      className={clsx(
                        "transition-colors",
                        isActive
                          ? isDark ? "bg-blue-600/10" : "bg-blue-50/70"
                          : isDark ? "hover:bg-slate-800/40" : "hover:bg-slate-50"
                      )}
                    >
                      <td className="py-3 px-4 font-semibold text-slate-200">
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.is_demo && (
                            <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase">
                              Demo
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{p.organization || '—'}</td>
                      <td className="py-3 px-4 text-slate-400">{p.location || '—'}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono">
                        {new Date(p.created_at).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px]">Ready</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setProject(p.id, p.name)
                              navigate('/')
                            }}
                            className={isActive ? btnPrimary : btnSecondary}
                          >
                            {isActive ? 'Open' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Project"
        subtitle="Set up project details to start tracking schedules and field reports"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Project Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Indravati Pumping Station Upgrade"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputField}
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Industry Domain / Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className={selectField}
            >
              <option value="Construction & Civil">🏗️ Building & Civil Construction</option>
              <option value="Infrastructure & Utilities">🛢️ Infrastructure, Pipeline & Utilities</option>
              <option value="Software & IT">💻 Software Engineering & Cloud Platforms</option>
              <option value="Renewable Energy">⚡ Renewable Energy & Power Systems</option>
              <option value="Industrial Manufacturing">🏭 Industrial & Manufacturing</option>
              <option value="General Milestone Tracking">📋 General Project Tracking</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Organization / Client</label>
            <input
              type="text"
              placeholder="e.g. Apex Corp / Infrastructure Division"
              value={org}
              onChange={e => setOrg(e.target.value)}
              className={inputField}
            />
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">Location / Site Code / Cloud Region</label>
            <input
              type="text"
              placeholder="e.g. Metro Site Sector 4, or AWS us-east-1"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className={inputField}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className={btnSecondary}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !name.trim()}
              className={btnPrimary}
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
