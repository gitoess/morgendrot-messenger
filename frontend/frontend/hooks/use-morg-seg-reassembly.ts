'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { parseMorgSegV1Message } from '@/frontend/lib/lora-sarq-parser'
import { MorgSegV1ReassemblyBuffer } from '@/frontend/lib/lora-sarq-reassembly'

export type UseMorgSegReassemblyOpts = {
  /** Nach letztem gültigen `MORG_SEG_V1`-Frame: NAK auslösen, falls noch Lücken. */
  idleTimeoutMs: number
  onNakWire: (wire: string) => void
  /** Optional: wenn alle Segmente da sind (Reihenfolge 0..n-1). */
  onAssembled?: (bytes: Uint8Array, meta: { msgId: string; phase: 'luma' | 'chroma' }) => void
}

export type IngestMorgSegWireResult = {
  parsed: ReturnType<typeof parseMorgSegV1Message>
  assembled?: Uint8Array
}

/**
 * Reassembly + Idle-Timer: bei Timeout oder Sessionwechsel mit Lücken → `buildMorgNakV1Wire` über `onNakWire`.
 */
export function useMorgSegReassembly(opts: UseMorgSegReassemblyOpts) {
  const buffer = useMemo(() => new MorgSegV1ReassemblyBuffer(), [])
  const onNakRef = useRef(opts.onNakWire)
  const onAssembledRef = useRef(opts.onAssembled)
  onNakRef.current = opts.onNakWire
  onAssembledRef.current = opts.onAssembled
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearIdleTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const scheduleIdleTimer = useCallback(() => {
    clearIdleTimer()
    const ms = opts.idleTimeoutMs
    if (!Number.isFinite(ms) || ms <= 0) return
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      const w = buffer.suggestNakIfIncomplete()
      if (w) onNakRef.current(w)
    }, ms)
  }, [buffer, clearIdleTimer, opts.idleTimeoutMs])

  useEffect(() => () => clearIdleTimer(), [clearIdleTimer])

  const ingestWire = useCallback(
    (content: string): IngestMorgSegWireResult => {
      const parsed = parseMorgSegV1Message(content)
      if (!parsed) return { parsed: null }

      const r = buffer.ingest(parsed)
      if (r.staleSessionNak) onNakRef.current(r.staleSessionNak)

      if (r.assembled) {
        clearIdleTimer()
        onAssembledRef.current?.(r.assembled, { msgId: parsed.msgId, phase: parsed.phase })
        return { parsed, assembled: r.assembled }
      }

      scheduleIdleTimer()
      return { parsed }
    },
    [buffer, clearIdleTimer, scheduleIdleTimer]
  )

  const reset = useCallback(() => {
    clearIdleTimer()
    buffer.reset()
  }, [buffer, clearIdleTimer])

  return { ingestWire, reset, buffer }
}
