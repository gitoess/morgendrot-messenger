import type { LocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'

const ADDR_64 = /^0x[a-f0-9]{64}$/i

export type HandoffBroadcastPinnwandStatus = {
  enabled: boolean
  address: string
  authorizedSenders?: string[]
}

/** Lagebild-Adresse aus lokalem Handoff-Snapshot (Helfer ohne Boss-.env). */
export function broadcastPinnwandStatusFromHandoff(
  handoff: LocalHandoffAppliedSnapshot | null | undefined
): HandoffBroadcastPinnwandStatus | undefined {
  if (!handoff?.broadcastPinnwandEnabled) return undefined
  const addr = (handoff.broadcastPinnwandAddress ?? '').trim().toLowerCase()
  if (!ADDR_64.test(addr)) return undefined
  const authorized = (handoff.broadcastPinnwandAuthorizedSenders ?? [])
    .map((a) => a.trim())
    .filter(Boolean)
  return {
    enabled: true,
    address: addr,
    ...(authorized.length > 0 ? { authorizedSenders: authorized } : {}),
  }
}
