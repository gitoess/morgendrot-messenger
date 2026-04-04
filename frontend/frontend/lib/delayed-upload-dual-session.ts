'use client'

/**
 * Empfänger: Zwei MF1-Ströme (MORG_DS_V1, LU dann CH) mit gemeinsamer Session-ID.
 * Unvollständige Sessions werden nach TTL verworfen (verlorenes Chroma/Luma).
 */

export const DUAL_STREAM_SESSION_TTL_MS = 45 * 60_000

export type DualStreamPartBuf = {
  lu?: string
  ch?: string
  /** letzte Aktivität (LU oder CH eingegangen) */
  updatedAt: number
}

/** Entfernt alte halbe Sessions (nur ein Teil vorhanden und älter als TTL). */
export function pruneStaleDualStreamSessions(
  sessions: Map<string, DualStreamPartBuf>,
  now = Date.now(),
  onExpired?: (sessionId: string, buf: DualStreamPartBuf) => void
): void {
  for (const [sid, buf] of sessions) {
    const complete = buf.lu != null && buf.ch != null
    if (!complete && now - buf.updatedAt > DUAL_STREAM_SESSION_TTL_MS) {
      onExpired?.(sid, { lu: buf.lu, ch: buf.ch, updatedAt: buf.updatedAt })
      sessions.delete(sid)
    }
  }
}

export type DualMergeResult =
  | { status: 'pending'; sessionId: string; haveLu: boolean; haveCh: boolean }
  | { status: 'complete'; lu: string; ch: string }

/**
 * Nimmt einen LU- oder CH-Teil auf; bei vollständigem Paar wird die Session aus der Map entfernt.
 */
export function mergeDualStreamPart(
  sessions: Map<string, DualStreamPartBuf>,
  sessionId: string,
  phase: 'LU' | 'CH',
  wire: string,
  now = Date.now(),
  onDualExpired?: (sessionId: string, buf: DualStreamPartBuf) => void
): DualMergeResult {
  pruneStaleDualStreamSessions(sessions, now, onDualExpired)
  const prev = sessions.get(sessionId)
  const lu = phase === 'LU' ? wire : prev?.lu
  const ch = phase === 'CH' ? wire : prev?.ch
  const buf: DualStreamPartBuf = { lu, ch, updatedAt: now }
  if (lu != null && ch != null) {
    sessions.delete(sessionId)
    return { status: 'complete', lu, ch }
  }
  sessions.set(sessionId, buf)
  return {
    status: 'pending',
    sessionId,
    haveLu: lu != null,
    haveCh: ch != null,
  }
}
