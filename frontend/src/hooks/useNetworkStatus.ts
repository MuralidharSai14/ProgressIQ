import { useState, useEffect } from 'react'

export interface NetworkStatus {
  isOnline: boolean
  lastOnlineAt: Date | null
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  })
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(new Date())

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setLastOnlineAt(new Date())
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, lastOnlineAt }
}
