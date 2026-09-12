/**
 * PROGRESSIQ API Service
 * Centralized HTTP client for all backend calls.
 * Uses axios with the Vite proxy (/api → localhost:8000).
 */
import axios from 'axios'

const rawBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
// In browser environments (desktop, mobile, tablet), relative /api is forwarded by Vite proxy to backend
const apiBase = rawBase && !rawBase.includes('localhost')
  ? (rawBase.endsWith('/api') ? rawBase : `${rawBase.replace(/\/$/, '')}/api`)
  : '/api'

const api = axios.create({
  baseURL: apiBase,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
})

export interface ScheduleUploadSummary {
  project_id: number
  total_rows_parsed: number
  activities_imported: number
  milestones_count: number
  errors_count: number
  errors: string[]
  message: string
}

// ── Request interceptor — attach JWT Bearer token ─────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('progressiq_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor — normalize errors ───────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const msg =
      error?.response?.data?.detail ||
      error?.response?.data?.error ||
      error?.message ||
      'An unexpected error occurred'
    return Promise.reject(new Error(msg))
  }
)

// ── API Methods ───────────────────────────────────────────────────────────

export const apiService = {
  // Health & System Info
  health: () => api.get('/health').then(r => r.data),

  // Authentication
  register: (data: { email: string; password: string; full_name: string; role?: string; organization?: string }) =>
    api.post('/auth/register', data).then(r => r.data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data).then(r => r.data),
  getMe: () => api.get('/auth/me').then(r => r.data),
  listUsers: () => api.get('/auth/users').then(r => r.data),
  seedTestUsers: () => api.post('/auth/seed-test-users').then(r => r.data),

  // Projects
  listProjects: () => api.get('/projects').then(r => r.data),
  createProject: (data: object) => api.post('/projects', data).then(r => r.data),
  getProject: (id: number) => api.get(`/projects/${id}`).then(r => r.data),
  deleteProject: (id: number) => api.delete(`/projects/${id}`).then(r => r.data),

  // Universal Project Templates & Demo Loaders
  loadDemo: (template?: string) => api.post('/demo/load', null, { params: { template } }).then(r => r.data),
  getTemplates: () => api.get('/demo/templates').then(r => r.data),

  // Schedule
  uploadSchedule: (projectId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/projects/${projectId}/schedule/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  getSchedule: (projectId: number, params?: { level?: number; search?: string; status?: string }) =>
    api.get(`/projects/${projectId}/schedule`, { params }).then(r => r.data),

  // Field Reports
  uploadFieldReport: (projectId: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/projects/${projectId}/field-reports/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
  listFieldReports: (projectId: number) =>
    api.get(`/projects/${projectId}/field-reports`).then(r => r.data),
  getFieldReport: (id: number) => api.get(`/field-reports/${id}`).then(r => r.data),
  getExtractions: (reportId: number) =>
    api.get(`/field-reports/${reportId}/extractions`).then(r => r.data),

  // Live Field Updates (Mobile-first)
  submitLiveFieldUpdate: (projectId: number, formData: FormData) =>
    api.post(`/projects/${projectId}/field-updates`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),
  listLiveFieldUpdates: (projectId: number, limit = 50) =>
    api.get(`/projects/${projectId}/field-updates`, { params: { limit } }).then(r => r.data),

  // AI Extraction
  extractFromReport: (fieldReportId: number) =>
    api.post('/ai/extract', { field_report_id: fieldReportId }).then(r => r.data),

  // Matching
  runMatching: (projectId: number, fieldReportId?: number) =>
    api.post('/matching/run', { project_id: projectId, field_report_id: fieldReportId }).then(r => r.data),
  getMatches: (projectId: number, status?: string) =>
    api.get(`/projects/${projectId}/matches`, { params: { status } }).then(r => r.data),
  reviewMatch: (matchId: number, decision: object) =>
    api.post(`/matches/${matchId}/review`, decision).then(r => r.data),

  // Dashboard
  getDashboard: (projectId: number) =>
    api.get(`/projects/${projectId}/dashboard`).then(r => r.data),
  getRisks: (projectId: number) =>
    api.get(`/projects/${projectId}/risks`).then(r => r.data),
  getProgress: (projectId: number) =>
    api.get(`/projects/${projectId}/progress`).then(r => r.data),

  // Evidence
  uploadEvidence: (projectId: number, formData: FormData) =>
    api.post(`/projects/${projectId}/evidence/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),
  listEvidence: (projectId: number, evidenceType?: string) =>
    api.get(`/projects/${projectId}/evidence`, { params: { evidence_type: evidenceType } }).then(r => r.data),
  getActivityEvidence: (activityId: number) =>
    api.get(`/activities/${activityId}/evidence`).then(r => r.data),
  linkEvidence: (evidenceId: number, data: object) =>
    api.post(`/evidence/${evidenceId}/link-activity`, data).then(r => r.data),

  // Consistency
  runConsistency: (projectId: number) =>
    api.post(`/projects/${projectId}/consistency/run`).then(r => r.data),
  getConsistency: (projectId: number) =>
    api.get(`/projects/${projectId}/consistency`).then(r => r.data),
  getActivityAssessment: (activityId: number) =>
    api.get(`/activities/${activityId}/assessment`).then(r => r.data),

  // Verification
  getVerificationQueue: (projectId: number, status?: string) =>
    api.get(`/projects/${projectId}/verification-queue`, { params: { status } }).then(r => r.data),
  createVerificationTask: (projectId: number, data: object) =>
    api.post(`/projects/${projectId}/verification-queue`, data).then(r => r.data),
  makeVerificationDecision: (taskId: number, data: object) =>
    api.post(`/verification/${taskId}/decide`, data).then(r => r.data),

  // Audit
  getProjectAudit: (projectId: number) =>
    api.get(`/projects/${projectId}/audit`).then(r => r.data),
  getActivityAudit: (activityId: number) =>
    api.get(`/activities/${activityId}/audit`).then(r => r.data),

  // Material Logistics
  getMaterials: (projectId: number, status?: string, category?: string) =>
    api.get(`/projects/${projectId}/materials`, { params: { status, category } }).then(r => r.data),
  createMaterial: (projectId: number, data: object) =>
    api.post(`/projects/${projectId}/materials`, data).then(r => r.data),
  updateMaterial: (shipmentId: number, data: object) =>
    api.patch(`/materials/${shipmentId}`, data).then(r => r.data),
  deleteMaterial: (shipmentId: number) =>
    api.delete(`/materials/${shipmentId}`).then(r => r.data),
  getMaterialShortages: (projectId: number) =>
    api.get(`/projects/${projectId}/materials/shortages`).then(r => r.data),

  // Worker Safety
  getSafetyRisks: (projectId: number, risk_score?: string, hazard_category?: string) =>
    api.get(`/projects/${projectId}/safety-risks`, { params: { risk_score, hazard_category } }).then(r => r.data),
  createSafetyRisk: (projectId: number, data: object) =>
    api.post(`/projects/${projectId}/safety-risks`, data).then(r => r.data),
  updateSafetyRisk: (riskId: number, data: object) =>
    api.patch(`/safety-risks/${riskId}`, data).then(r => r.data),
  deleteSafetyRisk: (riskId: number) =>
    api.delete(`/safety-risks/${riskId}`).then(r => r.data),
  getSafetySummary: (projectId: number) =>
    api.get(`/projects/${projectId}/safety-summary`).then(r => r.data),
  getActivitySafetyRisks: (activityId: number) =>
    api.get(`/activities/${activityId}/safety-risks`).then(r => r.data),

  // EVM & S-Curve Forecasting
  getProjectEVM: (projectId: number) =>
    api.get(`/projects/${projectId}/evm`).then(r => r.data),
  getProjectSCurve: (projectId: number, intervals = 12) =>
    api.get(`/projects/${projectId}/s-curve`, { params: { intervals } }).then(r => r.data),

  // AI Project Copilot
  askCopilot: (projectId: number, query: string) =>
    api.post(`/projects/${projectId}/copilot/ask`, { query }).then(r => r.data),
  getCopilotPrompts: (projectId: number) =>
    api.get(`/projects/${projectId}/copilot/suggested-prompts`).then(r => r.data),
}

export default apiService
