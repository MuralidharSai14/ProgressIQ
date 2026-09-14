import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './index.css'

// Global error boundary — shows a message instead of blank white screen
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error?.message || 'Unknown error' }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#0f172a', color: '#f1f5f9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16, fontFamily: 'system-ui', padding: 24
        }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#ef4444' }}>Something went wrong</h1>
          <p style={{ color: '#94a3b8', fontSize: 14 }}>{this.state.error}</p>
          <button
            onClick={() => {
              // Clear potentially corrupt localStorage and reload
              try {
                localStorage.removeItem('progressiq_token')
                localStorage.removeItem('progressiq_user')
                localStorage.removeItem('progressiq_role')
              } catch {}
              window.location.href = '/'
            }}
            style={{
              marginTop: 12, padding: '10px 24px', background: '#3b82f6',
              color: '#fff', border: 'none', borderRadius: 8,
              fontWeight: 700, cursor: 'pointer', fontSize: 14
            }}
          >
            Clear Cache & Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)
