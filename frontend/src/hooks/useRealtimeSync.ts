import { useEffect, useRef, useState } from 'react'

export interface RealtimeEventPayload {
  event: string
  project_id?: number
  data: any
}

export function useRealtimeSync(
  currentProjectId: number | null,
  onProjectUpdate?: (event: RealtimeEventPayload) => void
) {
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<RealtimeEventPayload | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const callbackRef = useRef(onProjectUpdate)

  useEffect(() => {
    callbackRef.current = onProjectUpdate
  }, [onProjectUpdate])

  useEffect(() => {
    // Open SSE connection
    const rawApi = (import.meta.env.VITE_API_URL as string | undefined)?.trim()?.replace(/\/$/, '')
    const sseUrl = rawApi ? (rawApi.endsWith('/api') ? `${rawApi}/events/stream` : `${rawApi}/api/events/stream`) : '/api/events/stream'
    let es: EventSource | null = null

    try {
      es = new EventSource(sseUrl)
      eventSourceRef.current = es

      es.onopen = () => {
        setConnected(true)
      }

      const handleEvent = (event: MessageEvent) => {
        try {
          const parsed: RealtimeEventPayload = JSON.parse(event.data)
          // Filter by active project if specified
          if (!currentProjectId || !parsed.project_id || parsed.project_id === currentProjectId) {
            setLastEvent(parsed)
            if (callbackRef.current) {
              callbackRef.current(parsed)
            }
          }
        } catch {
          // Non-JSON or keep-alive message
        }
      }

      es.addEventListener('live_field_update_processed', handleEvent)
      es.addEventListener('field_report_processed', handleEvent)
      es.addEventListener('evidence_uploaded', handleEvent)
      es.addEventListener('schedule_updated', handleEvent)
      es.onmessage = handleEvent

      es.onerror = () => {
        setConnected(false)
      }
    } catch {
      setConnected(false)
    }

    return () => {
      if (es) {
        es.close()
      }
      setConnected(false)
    }
  }, [currentProjectId])

  return { connected, lastEvent }
}
