/**
 * PROGRESSIQ API Service
 * Centralized HTTP client for all backend calls.
 * Uses axios with the Vite proxy (/api → localhost:8000).
 */
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
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
  // Health
  health: () => api.get('/health').then(r => r.data),

  // Projects
  listProjects: () => api.get('/projects').then(r => r.data),
  createProject: (data: object) => api.post('/projects', data).then(r => r.data),
  getProject: (id: number) => api.get(`/projects/${id}`).then(r => r.data),
  deleteProject: (id: number) => api.delete(`/projects/${id}`).then(r => r.data),

  // Demo
  loadDemo: () => api.post('/demo/load').then(r => r.data),

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
}

export default apiService
