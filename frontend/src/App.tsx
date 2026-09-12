/**
 * PROGRESSIQ — Root Application Component
 * Sets up routing and the global project context.
 */
import { Routes, Route } from 'react-router-dom'
import { ProjectProvider } from './hooks/useProject'
import Sidebar from './components/Sidebar'
import OverviewPage from './pages/OverviewPage'
import SchedulePage from './pages/SchedulePage'
import FieldReportsPage from './pages/FieldReportsPage'
import ExtractionPage from './pages/ExtractionPage'
import MatchingPage from './pages/MatchingPage'
import RisksPage from './pages/RisksPage'
import ReviewPage from './pages/ReviewPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <ProjectProvider>
      <div className="flex min-h-screen bg-slate-950">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">
            <Routes>
              <Route path="/"           element={<OverviewPage />} />
              <Route path="/schedule"   element={<SchedulePage />} />
              <Route path="/reports"    element={<FieldReportsPage />} />
              <Route path="/extraction" element={<ExtractionPage />} />
              <Route path="/matching"   element={<MatchingPage />} />
              <Route path="/risks"      element={<RisksPage />} />
              <Route path="/review"     element={<ReviewPage />} />
              <Route path="/analytics"  element={<AnalyticsPage />} />
              <Route path="/settings"   element={<SettingsPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </ProjectProvider>
  )
}
