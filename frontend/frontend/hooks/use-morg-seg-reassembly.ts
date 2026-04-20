'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parseMorgSegV1Message } from '@/frontend/lib/lora-sarq-parser'
import {
  MORG_SEG_V1_REASSEMBLY_IDLE_MS_DEFAULT,
  MORG_SEG_V1_REASSEMBLY_MAX_NAK_ROUNDS_DEFAULT,
  MorgSegV1ReassemblyBuffer,
} from '@/frontend/lib/lora-sarq-reassembly'

export type UseMorgSegReassemblyOpts = {
  /**
   * Nach letztem **neuen** Segment (Gate „Neu?“): Idle, dann NAK. Default 15 s (Mesh-Mehrhop-Heuristik).
   */
  idleTimeoutMs?: number
  maxNakRounds?: number
  /** Standard: no-op, wenn kein Funk-Rückkanal angebunden. */
  onNakWire?: (wire: string) => void
  onAssembled?: (bytes: Uint8Array, meta: { msgId: string; phase: 'luma' | 'chroma' }) => void
  /** Nach `maxNakRounds` NAKs ohne Vollständigkeit (Stufe 3). */
  onSessionFrozen?: (meta: { msgId: string; phase: 'luma' | 'chroma'; n: number }) => void
}

export type IngestMorgSegWireResult = {
  parsed: ReturnType<typeof parseMorgSegV1Message>
  assembled?: Uint8Array
  duplicateSegment?: true
}

/**
 * Reassembly + Idle-Timer: Stufe 2 (`emitIdleNakRound`), Stufe 3 (Freeze nach `maxNakRounds`),
 * Timer nur bei neuen Segmenten (Duplikat-Rebroadcast resettet 15 s nicht).
 */
const noopNak = () => {}

export function useMorgSegReassembly(opts: UseMorgSegReassemblyOpts) {
  const maxRounds = opts.maxNakRounds ?? MORG_SEG_V1_REASSEMBLY_MAX_NAK_ROUNDS_DEFAULT
  const buffer = useMemo(() => new MorgSegV1ReassemblyBuffer({ maxNakRounds: maxRounds }), [maxRounds])
  const onNakRef = useRef(opts.onNakWire ?? noopNak)
  const onAssembledRef = useRef(opts.onAssembled)
  const onSessionFrozenRef = useRef(opts.onSessionFrozen)
  const idleMsRef = useRef(opts.idleTimeoutMs ?? MORG_SEG_V1_REASSEMBLY_IDLE_MS_DEFAULT)
  const [uiTick, setUiTick] = useState(0)
  const bumpUi = useCallback(() => setUiTick((x) => x + 1), [])
  onNakRef.current = opts.onNakWire ?? noopNak
  onAssembledRef.current = opts.onAssembled
  onSessionFrozenRef.current = opts.onSessionFrozen
  idleMsRef.current = opts.idleTimeoutMs ?? MORG_SEG_V1_REASSEMBLY_IDLE_MS_DEFAULT
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearIdleTimer = useCallback(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const armIdleTimer = useCallback(() => {
    clearIdleTimer()
    const ms = idleMsRef.current
    if (!Number.isFinite(ms) || ms <= 0) return

    const tick = () => {
      timerRef.current = null
      const w = buffer.emitIdleNakRound()
      if (w) onNakRef.current(w)
      const meta = buffer.getActiveSession()
      if (buffer.isSessionFrozen() && meta) {
        onSessionFrozenRef.current?.({ msgId: meta.msgId, phase: meta.phase, n: meta.n })
      }
      bumpUi()
      if (buffer.needsIdleTimer()) {
        timerRef.current = setTimeout(tick, idleMsRef.current)
      }
    }

    timerRef.current = setTimeout(tick, ms)
  }, [buffer, clearIdleTimer, bumpUi])

  useEffect(() => () => clearIdleTimer(), [clearIdleTimer])

  const ingestWire = useCallback(
    (content: string): IngestMorgSegWireResult => {
      const parsed = parseMorgSegV1Message(content)
      if (!parsed) return { parsed: null }

      const r = buffer.ingest(parsed)
      if (r.staleSessionNak) onNakRef.current(r.staleSessionNak)

      if (r.duplicateSegment) {
        return { parsed, duplicateSegment: true }
      }

      bumpUi()

      if (r.assembled) {
        clearIdleTimer()
        onAssembledRef.current?.(r.assembled, { msgId: parsed.msgId, phase: parsed.phase })
        return { parsed, assembled: r.assembled }
      }

      if (buffer.needsIdleTimer()) armIdleTimer()
      else clearIdleTimer()

      return { parsed }
    },
    [buffer, clearIdleTimer, armIdleTimer, bumpUi]
  )

  const reset = useCallback(() => {
    clearIdleTimer()
    buffer.reset()
  }, [buffer, clearIdleTimer])

  return { ingestWire, reset, buffer, uiTick }
}
