import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react'
import clsx from 'clsx'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface ToastItem {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, title?: string, duration?: number) => void
  success: (message: string, title?: string) => void
  error: (message: string, title?: string) => void
  warning: (message: string, title?: string) => void
  info: (message: string, title?: string) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = useCallback((message: string, type: ToastType = 'info', title?: string, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev.slice(-4), { id, type, title, message, duration }])

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  const success = useCallback((msg: string, title?: string) => toast(msg, 'success', title), [toast])
  const error = useCallback((msg: string, title?: string) => toast(msg, 'error', title, 6000), [toast])
  const warning = useCallback((msg: string, title?: string) => toast(msg, 'warning', title, 5000), [toast])
  const info = useCallback((msg: string, title?: string) => toast(msg, 'info', title), [toast])

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      case 'error': return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
      default: return <Info className="w-4 h-4 text-blue-400 shrink-0" />
    }
  }

  const getBgClass = (type: ToastType) => {
    switch (type) {
      case 'success': return 'bg-slate-900 border-emerald-500/40 text-slate-100 shadow-emerald-500/10'
      case 'error': return 'bg-slate-900 border-rose-500/40 text-slate-100 shadow-rose-500/10'
      case 'warning': return 'bg-slate-900 border-amber-500/40 text-slate-100 shadow-amber-500/10'
      default: return 'bg-slate-900 border-blue-500/40 text-slate-100 shadow-blue-500/10'
    }
  }

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, removeToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map(t => (
          <div
            key={t.id}
            className={clsx(
              "pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl transition-all duration-300 transform translate-y-0",
              getBgClass(t.type)
            )}
          >
            <div className="mt-0.5">{getIcon(t.type)}</div>
            <div className="flex-1 min-w-0">
              {t.title && <p className="text-xs font-bold leading-none mb-1 text-white">{t.title}</p>}
              <p className="text-xs text-slate-300 leading-relaxed font-medium">{t.message}</p>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-white transition-colors p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
