'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
  hardReloadAfterChunkFailure,
  isChunkLoadErrorUnknown,
} from '@/frontend/lib/chunk-load-error'

/**
 * Fängt Chunk-Ladefehler global ab (nicht nur error.tsx-Segment) und bietet Hard-Reload.
 */
export function ChunkLoadRecovery() {
  const notifiedRef = useRef(false)

  useEffect(() => {
    const notify = (detail: string) => {
      if (notifiedRef.current) return
      notifiedRef.current = true
      toast.error('App-Update erkannt (Chunk-Fehler)', {
        description: detail,
        duration: 20_000,
        action: {
          label: 'Hart neu laden',
          onClick: () => void hardReloadAfterChunkFailure(),
        },
      })
    }

    const onError = (event: ErrorEvent) => {
      if (!isChunkLoadErrorUnknown(event.error ?? event.message)) return
      notify('Ein Modul konnte nicht geladen werden. Cache/Service-Worker werden beim Neuladen geleert.')
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadErrorUnknown(event.reason)) return
      event.preventDefault()
      notify('Asynchroner Chunk-Ladefehler — bitte hart neu laden.')
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
