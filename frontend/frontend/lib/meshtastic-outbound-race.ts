/**
 * Meshtastic `sendText`/`sendPacket` resolved oft nicht (Broadcast/Web-BLE).
 * Stall darf die UI nicht entblocken und still als Erfolg werten.
 */

import {
  isMeshtasticOutboundSoftRoutingError,
  normalizeMeshtasticOutboundFailure,
} from '@/frontend/lib/meshtastic-routing-error'

export const MESH_SEND_STALL_MS = 25_000

/**
 * Bild-Burst (`wantAck: false`): SDK-Promise resolved oft nie → früher 25 s×Retries/Paket.
 * Kurz warten; Stall = „an Radio übergeben“ (S-ARQ repariert).
 */
export const MESH_SEND_QUEUE_STALL_MS = 1_800

export const MESH_SEND_STALL_ERROR_MSG =
  'Funk-Sendung nicht bestätigt — Verbindung/Kanal prüfen (Zeitüberschreitung beim Senden).'

export const MESH_SEND_UNCONFIRMED_ERROR_MSG =
  'Funk-Sendung nicht bestätigt — Gerät hat keine Paket-ID geliefert. Verbindung/Kanal prüfen.'

/**
 * Wartet auf `promise`, wirft aber nach `stallMs` mit {@link MESH_SEND_STALL_ERROR_MSG}
 * statt eines Fake-Erfolgs (leeres `{}`).
 * Ablehnung der Transport-Promise wird als Error weitergeworfen (kein unhandled Rejection-Race).
 *
 * Soft-Routing wird als **Erfolg mit id** zurückgegeben (kein Throw von Plain-Objects →
 * kein Next-Runtime `[object Object]` / unhandled Rejection).
 */
export type RaceMeshtasticOutboundOpts = {
  /** Stop-Button: alle ~120 ms prüfen — sonst hängt UI bis Stall (25 s). */
  isCancelled?: () => boolean
  cancelMessage?: string
  /**
   * Bild-SEG: Stall/Unbestätigt = Erfolg `{ id:0, queued:true }` —
   * nicht 25 s blockieren und nicht hart scheitern.
   */
  queueConfirm?: boolean
}

export async function raceMeshtasticOutbound<T>(
  promise: Promise<T>,
  stallMs: number = MESH_SEND_STALL_MS,
  opts?: RaceMeshtasticOutboundOpts
): Promise<T> {
  const cancelMsg = opts?.cancelMessage ?? 'Übertragung abgebrochen.'
  const queueConfirm = opts?.queueConfirm === true
  const effectiveStall = queueConfirm
    ? Math.min(stallMs, MESH_SEND_QUEUE_STALL_MS)
    : stallMs
  const result = await Promise.race([
    promise.then(
      (v) => ({ kind: 'ok' as const, v }),
      (err: unknown) => ({ kind: 'err' as const, err })
    ),
    new Promise<{ kind: 'stall' }>((resolve) =>
      setTimeout(() => resolve({ kind: 'stall' }), effectiveStall)
    ),
    new Promise<{ kind: 'cancel' }>((resolve) => {
      if (!opts?.isCancelled) return
      const t = setInterval(() => {
        if (opts.isCancelled?.()) {
          clearInterval(t)
          resolve({ kind: 'cancel' })
        }
      }, 120)
      setTimeout(() => clearInterval(t), effectiveStall + 500)
    }),
  ])
  if (result.kind === 'cancel') {
    void promise.catch(() => undefined)
    throw new Error(cancelMsg)
  }
  if (result.kind === 'stall') {
    void promise.catch(() => undefined)
    if (queueConfirm) {
      return { id: 0, queued: true, softRouting: true } as T
    }
    throw new Error(MESH_SEND_STALL_ERROR_MSG)
  }
  if (result.kind === 'err') {
    if (isMeshtasticOutboundSoftRoutingError(result.err)) {
      const id =
        result.err && typeof result.err === 'object' && 'id' in result.err
          ? (result.err as { id?: unknown }).id
          : 0
      return { id: id ?? 0, softRouting: true } as T
    }
    throw normalizeMeshtasticOutboundFailure(result.err, 'Meshtastic')
  }
  return result.v
}

/** Ob das SDK-/Firmware-Ergebnis als „Sendung angenommen“ gilt (nicht nur leeres Objekt). */
export function isMeshtasticOutboundConfirmed(result: unknown): boolean {
  if (result == null) return false
  if (typeof result === 'number' && Number.isFinite(result)) return true
  if (typeof result === 'bigint') return true
  if (typeof result === 'string' && result.trim() !== '') return true
  if (typeof result !== 'object') return false
  const o = result as { id?: unknown }
  if (!('id' in o)) return false
  return o.id != null && o.id !== ''
}

export function assertMeshtasticOutboundConfirmed(result: unknown, context: string): void {
  if (isMeshtasticOutboundConfirmed(result)) return
  throw new Error(`${context}: ${MESH_SEND_UNCONFIRMED_ERROR_MSG}`)
}
