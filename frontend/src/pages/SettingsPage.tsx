/**
 * PROGRESSIQ — System Settings & Project Configuration Page
 * Backend health diagnostics, AI provider status, project CRUD, and environment configuration.
 */
import { useState, useEffect } from 'react'
import {
  Plus, Trash2, Play,
  Server,
  RefreshCw, Layers, Terminal
} from 'lucide-react'
import clsx from 'clsx'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { useTheme } from '../hooks/useTheme'
import { useToast } from '../hooks/useToast'
import {
  PageHeader,
  btnPrimary, btnSecondary, inputField
} from '../components/ui'

export default function SettingsPage() {
  const { projectId, setProject, clearProject } = useProject()
  const { theme } = useTheme()
  const { success, error } = useToast()
  const isDark = theme === 'dark'

  const [projects, setProjects] = useState<any[]>([])
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [creating, setCreating] = useState(false)

  const [newName, setNewName] = useState('')
  const [newOrg, setNewOrg] = useState('')
  const [newLocation, setNewLocation] = useState('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const [p, h] = await Promise.all([
        apiService.listProjects(),
        apiService.health(),
      ])
      setProjects(p || [])
      setHealth(h)
    } catch (e: any) {
      error(e.message || 'Failed to load system diagnostics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      const proj = await apiService.createProject({
        name: newName.trim(),
        organization: newOrg.trim() || undefined,
        location: newLocation.trim() || undefined,
      })
      success(`Project "${proj.name}" created successfully.`)
      setNewName('')
      setNewOrg('')
      setNewLocation('')
      setProject(proj.id, proj.name)
      await fetchData()
    } catch (e: any) {
      error(e.message || 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete project "${name}"? This action cannot be undone.`)) return
    try {
      await apiService.deleteProject(id)
      success(`Deleted project "${name}".`)
      if (projectId === id) {
        clearProject()
      }
      await fetchData()
    } catch (e: any) {
      error(e.message || 'Failed to delete project')
    }
  }

  const handleLoadDemo = async () => {
    setDemoLoading(true)
    try {
      const result = await apiService.loadDemo()
      if (result.success) {
        setProject(result.project_id, result.project_name)
        success(`Demo project initialized: ${result.project_name}`)
        await fetchData()
      }
    } catch (e: any) {
      error(e.message || 'Demo initialization failed')
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="System Settings & Diagnostics"
        subtitle="Backend connection health, AI semantic model status, project workspaces, and environment configuration"
      >
        <button
          onClick={fetchData}
          className={btnSecondary}
          title="Refresh diagnostics"
        >
          <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} /> Refresh
        </button>
      </PageHeader>

      {/* 1. Backend Diagnostics */}
      {health && (
        <div className={clsx(
          "p-5 rounded-2xl border space-y-4",
          isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
                Engine Health & Inference Diagnostics
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> API Online
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">AI Engine Mode</span>
              <span className="font-mono font-bold text-purple-400 uppercase">{health.ai_provider}</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Semantic Vector Matching</span>
              <span className={clsx("font-mono font-bold", health.semantic_matching ? "text-emerald-400" : "text-amber-400")}>
                {health.semantic_matching ? '✓ Active' : '↻ TF-IDF Fallback'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Confidence Cutoff</span>
              <span className="font-mono font-bold text-blue-400">{health.confidence_threshold}%</span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800">
              <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Backend Protocol</span>
              <span className="font-mono font-bold text-slate-300">FastAPI / Uvicorn</span>
            </div>
          </div>

          {!health.semantic_matching && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
              <p className="font-semibold">Notice regarding dense vector embeddings:</p>
              <p className="text-[11px] text-amber-400/90 mt-0.5">
                Install <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-200">sentence-transformers torch</code> to activate dense neural embeddings. PROGRESSIQ is currently operating in high-performance TF-IDF cosine fallback mode.
              </p>
            </div>
          )}
        </div>
      )}

      {/* 2. Sample Demo Dataset */}
      <div className={clsx(
        "p-5 rounded-2xl border space-y-3",
        isDark ? "bg-slate-900/70 border-blue-500/30" : "bg-white border-blue-200 shadow-xs"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-blue-400 fill-current" />
            <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
              Sample Infrastructure Dataset
            </h2>
          </div>
          <span className="text-[10px] font-mono uppercase bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-bold">
            Indravati Pumping Station
          </span>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Instantly resets or populates the complete sample infrastructure project with 70 WBS tasks, multi-day DPR reports, AI extractions, linked site photographs, material delivery vouchers, and active delay risks.
        </p>

        <button
          onClick={handleLoadDemo}
          disabled={demoLoading}
          className={btnPrimary}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {demoLoading ? 'Initializing Dataset...' : 'Load / Reset Demo Project'}
        </button>
      </div>

      {/* 3. Create Project Workspace */}
      <div className={clsx(
        "p-5 rounded-2xl border space-y-4",
        isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      )}>
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-blue-400" />
          <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
            Create New Project Workspace
          </h2>
        </div>

        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">Project Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Pipeline Expansion Phase II"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className={inputField}
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Organization / Client</label>
              <input
                type="text"
                placeholder="e.g. Oil India Ltd"
                value={newOrg}
                onChange={e => setNewOrg(e.target.value)}
                className={inputField}
              />
            </div>

            <div>
              <label className="block text-slate-400 font-semibold mb-1">Location / Site Code</label>
              <input
                type="text"
                placeholder="e.g. Duliajan, Assam"
                value={newLocation}
                onChange={e => setNewLocation(e.target.value)}
                className={inputField}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className={btnPrimary}
          >
            <Plus className="w-3.5 h-3.5" />
            {creating ? 'Creating Workspace...' : 'Create Workspace'}
          </button>
        </form>
      </div>

      {/* 4. Manage Existing Project Workspaces */}
      <div className={clsx(
        "p-5 rounded-2xl border space-y-3",
        isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-400" />
            <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
              Project Workspaces ({projects.length})
            </h2>
          </div>
        </div>

        {projects.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">No projects registered. Create one above or load the demo project.</p>
        ) : (
          <div className="space-y-2">
            {projects.map(p => {
              const isActive = projectId === p.id
              return (
                <div
                  key={p.id}
                  className={clsx(
                    "p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all",
                    isActive
                      ? isDark ? "bg-blue-600/10 border-blue-500/40" : "bg-blue-50 border-blue-200"
                      : isDark ? "bg-slate-950/40 border-slate-800" : "bg-slate-50 border-slate-200"
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={clsx("font-bold text-xs truncate", isDark ? "text-slate-200" : "text-slate-800")}>
                        {p.name}
                      </p>
                      {p.is_demo && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 uppercase">
                          Demo
                        </span>
                      )}
                      {isActive && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 uppercase">
                          Active Workspace
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {p.organization || 'Client'} · {p.location || 'Site'} · Created {new Date(p.created_at).toLocaleDateString('en-IN')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    {!isActive && (
                      <button
                        onClick={() => {
                          setProject(p.id, p.name)
                          success(`Activated workspace "${p.name}".`)
                        }}
                        className={clsx(btnSecondary, "py-1 px-2.5 text-xs")}
                      >
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete workspace"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 5. Environment & Model Guide */}
      <div className={clsx(
        "p-5 rounded-2xl border space-y-3",
        isDark ? "bg-slate-900/70 border-slate-800" : "bg-white border-slate-200 shadow-xs"
      )}>
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-slate-400" />
          <h2 className={clsx("text-sm font-bold", isDark ? "text-white" : "text-slate-900")}>
            Environment Configuration Reference
          </h2>
        </div>

        <p className="text-xs text-slate-400">
          Configure AI providers (Gemini, OpenAI, Mock) and database URLs in <code className="text-blue-400 font-mono">.env</code>:
        </p>

        <pre className={clsx(
          "p-3.5 rounded-xl text-xs font-mono leading-relaxed overflow-x-auto border",
          isDark ? "bg-slate-950 border-slate-800 text-slate-300" : "bg-slate-100 border-slate-300 text-slate-800"
        )}>
{`# AI Provider Configuration (mock | gemini | openai)
AI_PROVIDER=mock
GEMINI_API_KEY=your_gemini_api_key_here
CONFIDENCE_THRESHOLD=75

# Database Connection (SQLite or PostgreSQL)
DATABASE_URL=sqlite:///./progressiq.db`}
        </pre>
      </div>
    </div>
  )
}
