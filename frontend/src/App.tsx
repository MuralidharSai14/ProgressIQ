/**
 * PROGRESSIQ — Root Application Component
 */
import { useState, useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import clsx from 'clsx'

import { ProjectProvider, useProject } from './hooks/useProject'
import { ThemeProvider, useTheme } from './hooks/useTheme'
import { RoleProvider } from './hooks/useRole'
import { ToastProvider, useToast } from './hooks/useToast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useRealtimeSync } from './hooks/useRealtimeSync'

import Sidebar from './components/Sidebar'
import Header from './components/layout/Header'
import GlobalSearchModal from './components/layout/GlobalSearchModal'
import NotificationsDrawer from './components/layout/NotificationsDrawer'
import LiveFieldUpdateModal from './components/LiveFieldUpdateModal'
import { CopilotDrawer } from './components/CopilotDrawer'
import { Sparkles } from 'lucide-react'

import OverviewPage from './pages/OverviewPage'
import ProjectsPage from './pages/ProjectsPage'
import SchedulePage from './pages/SchedulePage'
import FieldReportsPage from './pages/FieldReportsPage'
import FieldUpdatePage from './pages/FieldUpdatePage'
import LoginPage from './pages/LoginPage'
import ExtractionPage from './pages/ExtractionPage'
import MatchingPage from './pages/MatchingPage'
import EvidencePage from './pages/EvidencePage'
import ConflictPage from './pages/ConflictPage'
import VerificationPage from './pages/VerificationPage'
import ReviewPage from './pages/ReviewPage'
import RisksPage from './pages/RisksPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'
import ActivityDetailPage from './pages/ActivityDetailPage'
import AuditPage from './pages/AuditPage'
import MaterialLogisticsPage from './pages/MaterialLogisticsPage'
import WorkerSafetyPage from './pages/WorkerSafetyPage'

// ── Full app shell (authenticated) ───────────────────────────────────────────
function AppShell() {
  const { theme } = useTheme()
  const { projectId } = useProject()
  const { info } = useToast()
  const isDark = theme === 'dark'

  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [isLiveUpdateOpen, setIsLiveUpdateOpen] = useState(false)
  const [isCopilotOpen, setIsCopilotOpen] = useState(false)

  useRealtimeSync(projectId, (event) => {
    if (event.event === 'live_field_update_processed') {
      info(`📱 Live field update received: ${event.data.activity_name} (${event.data.progress}%) by ${event.data.reporter}`)
    } else if (event.event === 'field_report_processed') {
      info(`📄 Field report extraction complete: ${event.data.filename}`)
    } else if (event.event === 'evidence_uploaded') {
      info(`📷 New evidence uploaded: ${event.data.filename} (${event.data.evidence_type})`)
    }
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className={clsx(
      "flex min-h-screen transition-colors duration-150 font-sans",
      isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
    )}>
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onOpenLiveUpdate={() => setIsLiveUpdateOpen(true)}
      />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
          onOpenLiveUpdate={() => setIsLiveUpdateOpen(true)}
          onOpenCopilot={() => setIsCopilotOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            <Routes>
              <Route path="/" element={<OverviewPage onOpenLiveUpdate={() => setIsLiveUpdateOpen(true)} />} />
              <Route path="/field-update" element={<FieldUpdatePage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/reports" element={<FieldReportsPage />} />
              <Route path="/extraction" element={<ExtractionPage />} />
              <Route path="/matching" element={<MatchingPage />} />
              <Route path="/evidence" element={<EvidencePage />} />
              <Route path="/conflicts" element={<ConflictPage />} />
              <Route path="/verification" element={<VerificationPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/logistics" element={<MaterialLogisticsPage />} />
              <Route path="/worker-safety" element={<WorkerSafetyPage />} />
              <Route path="/risks" element={<RisksPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/activity/:activityId" element={<ActivityDetailPage />} />
              <Route path="*" element={<OverviewPage onOpenLiveUpdate={() => setIsLiveUpdateOpen(true)} />} />
            </Routes>
          </div>
        </main>
      </div>

      <button
        onClick={() => setIsCopilotOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white font-bold text-xs shadow-xl hover:shadow-2xl hover:scale-105 transition-all cursor-pointer border border-white/20 backdrop-blur-md"
        title="Open PROGRESSIQ AI Project Copilot"
      >
        <Sparkles className="w-4 h-4 animate-spin [animation-duration:4s]" />
        <span>Ask AI Copilot</span>
      </button>

      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <NotificationsDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
      <LiveFieldUpdateModal isOpen={isLiveUpdateOpen} onClose={() => setIsLiveUpdateOpen(false)} onSuccess={() => {}} />
      <CopilotDrawer projectId={projectId || 1} isOpen={isCopilotOpen} onClose={() => setIsCopilotOpen(false)} />
    </div>
  )
}

// ── Login screen ─────────────────────────────────────────────────────────────
function LoginScreen() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  return (
    <div className={clsx(
      "min-h-screen flex items-center justify-center p-4",
      isDark ? "bg-slate-950 text-slate-100" : "bg-slate-100 text-slate-900"
    )}>
      <LoginPage />
    </div>
  )
}

// ── Root — decides login vs app based on auth state ──────────────────────────
function Root() {
  const { isAuthenticated, loading } = useAuth()

  // Loading state — show spinner while checking saved token
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Loading PROGRESSIQ...</p>
        </div>
      </div>
    )
  }

  // Not authenticated → show login
  if (!isAuthenticated) {
    return <LoginScreen />
  }

  // Authenticated → show full app with routing
  return (
    <Routes>
      <Route path="/*" element={<AppShell />} />
    </Routes>
  )
}

// ── App entry ────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProjectProvider>
          <RoleProvider>
            <ToastProvider>
              <Root />
            </ToastProvider>
          </RoleProvider>
        </ProjectProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
