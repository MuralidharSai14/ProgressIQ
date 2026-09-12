import React from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import { useNetworkStatus } from '../hooks/useNetworkStatus'

export const OfflineBadge: React.FC = () => {
  const { isOnline } = useNetworkStatus()

  if (isOnline) {
    return (
      <div
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium"
        title="Connected to PROGRESSIQ Live Network"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <Wifi className="w-3 h-3" />
        <span>Live</span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-[11px] font-semibold animate-pulse"
      title="You are currently offline. Field changes will sync when reconnected."
    >
      <WifiOff className="w-3 h-3" />
      <span>Offline (Sync Queued)</span>
    </div>
  )
}
