/**
 * Settings Page — Project management and configuration
 */
import { useState, useEffect } from 'react'
import { Plus, Trash2, Play } from 'lucide-react'
import apiService from '../services/api'
import { useProject } from '../hooks/useProject'
import { PageHeader, ErrorBox, SuccessBox, LoadingSpinner } from '../components/ui'

export default function SettingsPage() {
  const { projectId, setProject, clearProject } = useProject()
  const [projects, setProjects] = useState<any[]>([])
  const [health, setHealth] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [newName, setNewName] = useState('')
  const [newOrg, setNewOrg] = useState('')
  const [newLocation, setNewLocation] = useState('')
  const [creating, setCreating] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [p, h] = await Promise.all([
        apiService.listProjects(),
        apiService.health(),
      ])
      setProjects(p)
      setHealth(h)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData() }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true); setError(''); setSuccess('')
    try {
      const proj = await apiService.createProject({
        name: newName,
        organization: newOrg || undefined,
        location: newLocation || undefined,
      })
      setSuccess(`Project "${proj.name}" created`)
      setNewName(''); setNewOrg(''); setNewLocation('')
      setProject(proj.id, proj.name)
      await fetchData()
    } catch (e: any) { setError(e.message) }
    finally { setCreating(false) }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Delete project "${name}"? This cannot be undone.`)) return
    try {
      await apiService.deleteProject(id)
      if (projectId === id) clearProject()
      await fetchData()
      setSuccess(`Deleted "${name}"`)
    } catch (e: any) { setError(e.message) }
  }

  const handleLoadDemo = async () => {
    setDemoLoading(true); setError(''); setSuccess('')
    try {
      const result = await apiService.loadDemo()
      setProject(result.project_id, result.project_name)
      setSuccess(`Demo loaded: ${result.project_name}`)
      await fetchData()
    } catch (e: any) { setError(e.message) }
    finally { setDemoLoading(false) }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Settings" subtitle="Project management and system configuration" />

      {error && <ErrorBox message={error} />}
      {success && <SuccessBox message={success} />}

      {/* Backend Health */}
      {health && (
        <div className="card">
          <p className="section-title">System Status</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'API', value: health.status === 'ok' ? '✓ Online' : '✗ Error', ok: health.status === 'ok' },
              { label: 'AI Provider', value: health.ai_provider, ok: true },
              { label: 'Semantic Matching', value: health.semantic_matching ? '✓ Active' : '↻ TF-IDF fallback', ok: health.semantic_matching },
              { label: 'Confidence Threshold', value: `${health.confidence_threshold}%`, ok: true },
            ].map(s => (
              <div key={s.label} className="bg-slate-900/50 rounded-lg p-2.5">
                <p className="text-slate-600 text-[9px] uppercase mb-1">{s.label}</p>
                <p className={`text-sm font-medium font-mono ${s.ok ? 'text-green-400' : 'text-yellow-400'}`}>{s.value}</p>
              </div>
            ))}
          </div>
          {!health.semantic_matching && (
            <p className="text-yellow-400 text-xs mt-3">
              ℹ️ sentence-transformers model not loaded. Install with:{' '}
              <code className="bg-slate-900 px-1 py-0.5 rounded text-yellow-300">pip install sentence-transformers torch</code>.
              TF-IDF fallback is active — matching still works but is less accurate.
            </p>
          )}
        </div>
      )}

      {/* Demo */}
      <div className="card border border-cyan-500/20">
        <p className="section-title">Demo Mode</p>
        <p className="text-slate-400 text-sm mb-3">
          Load the complete Indravati River Pumping Station demo project with 70 activities, field reports, AI extractions, and risks.
        </p>
        <button onClick={handleLoadDemo} disabled={demoLoading} className="btn-primary">
          <Play className="w-4 h-4" />
          {demoLoading ? 'Loading…' : 'Load Demo Project'}
        </button>
      </div>

      {/* Create Project */}
      <div className="card">
        <p className="section-title">Create New Project</p>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Project name *"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="input-field"
          />
          <input
            type="text"
            placeholder="Organization"
            value={newOrg}
            onChange={e => setNewOrg(e.target.value)}
            className="input-field"
          />
          <input
            type="text"
            placeholder="Location"
            value={newLocation}
            onChange={e => setNewLocation(e.target.value)}
            className="input-field"
          />
          <button onClick={handleCreate} disabled={creating || !newName.trim()} className="btn-primary">
            <Plus className="w-4 h-4" />
            {creating ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </div>

      {/* Project List */}
      <div className="card">
        <p className="section-title">All Projects</p>
        {loading ? <LoadingSpinner text="Loading projects…" /> : projects.length === 0 ? (
          <p className="text-slate-500 text-sm">No projects yet. Load the demo or create one above.</p>
        ) : (
          <div className="space-y-2">
            {projects.map(p => (
              <div key={p.id} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${projectId === p.id ? 'border-cyan-500/40 bg-cyan-500/5' : 'border-slate-700/50 bg-slate-900/30'}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-slate-200 text-sm font-medium">{p.name}</p>
                    {p.is_demo && <span className="text-[9px] text-cyan-400 border border-cyan-500/30 px-1 py-0.5 rounded">DEMO</span>}
                    {projectId === p.id && <span className="text-[9px] text-green-400 border border-green-500/30 px-1 py-0.5 rounded">ACTIVE</span>}
                  </div>
                  <p className="text-slate-500 text-xs">{p.organization || 'No organization'} · {new Date(p.created_at).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="flex items-center gap-2">
                  {projectId !== p.id && (
                    <button onClick={() => setProject(p.id, p.name)} className="btn-secondary text-xs px-2 py-1">
                      Activate
                    </button>
                  )}
                  <button onClick={() => handleDelete(p.id, p.name)} className="text-slate-600 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Environment info */}
      <div className="card border-slate-700/30">
        <p className="section-title">Configuration</p>
        <p className="text-slate-500 text-xs mb-2">
          Edit <code className="text-cyan-400">.env</code> in the project root to configure:
        </p>
        <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs space-y-1 text-slate-400">
          <p><span className="text-cyan-400">AI_PROVIDER</span>=mock <span className="text-slate-600"># mock | gemini | openai</span></p>
          <p><span className="text-cyan-400">GEMINI_API_KEY</span>=your_key_here</p>
          <p><span className="text-cyan-400">CONFIDENCE_THRESHOLD</span>=75</p>
          <p><span className="text-cyan-400">DATABASE_URL</span>=sqlite:///./progressiq.db</p>
        </div>
      </div>
    </div>
  )
}
