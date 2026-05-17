'use client'

import type { ApiStatus } from '@/frontend/lib/api'

/** Stabiler Vergleich — verhindert Re-Renders alle 12 s bei unverändertem Status. */
export function apiStatusPollSignature(s: ApiStatus | null | undefined): string {
  if (!s) return ''
  const addrs = [...(s.connectedAddresses ?? [])].map((a) => a.toLowerCase()).sort()
  return JSON.stringify({
    backendRunning: s.backendRunning,
    locked: s.locked,
    connected: s.connected,
    hasKeys: s.hasKeys,
    myAddress: (s.myAddress ?? '').toLowerCase(),
    packageId: (s.packageId ?? '').toLowerCase(),
    useMailbox: s.useMailbox,
    mailboxConfigured: s.mailboxConfigured,
    connectedAddresses: addrs,
    messengerCredits: s.messengerCredits?.balance ?? null,
  })
}
