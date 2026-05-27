import type { HandoffZipWireMeta } from '@/frontend/lib/handoff-iota-wire'

export const HANDOFF_PENDING_INBOX_EVENT = 'morgendrot:handoff-pending-inbox'

const LS_PENDING = 'morgendrot.pendingHandoffZipFromInbox.v1'

function bytesToB64(u8: Uint8Array): string {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!)
  return btoa(s)
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ''))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function queueHandoffZipFromInbox(zipBytes: Uint8Array, meta: HandoffZipWireMeta): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      LS_PENDING,
      JSON.stringify({ zipB64: bytesToB64(zipBytes), meta, queuedAt: Date.now() })
    )
    window.dispatchEvent(new CustomEvent(HANDOFF_PENDING_INBOX_EVENT))
  } catch {
    /* quota */
  }
}

export function consumePendingHandoffZipFromInbox():
  | { zipBytes: Uint8Array; meta: HandoffZipWireMeta }
  | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_PENDING)
    if (!raw) return null
    window.localStorage.removeItem(LS_PENDING)
    const j = JSON.parse(raw) as { zipB64?: string; meta?: HandoffZipWireMeta }
    if (!j.zipB64) return null
    return {
      zipBytes: b64ToBytes(j.zipB64),
      meta: j.meta ?? { protected: false, exportedAt: '', zipByteLength: 0 },
    }
  } catch {
    return null
  }
}
