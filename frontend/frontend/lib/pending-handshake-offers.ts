import type { PendingHandshakeOffer } from '@/frontend/lib/api/package-connect'

export function filterPendingHandshakesNotConnected(
  offers: PendingHandshakeOffer[],
  connectedAddresses: string[]
): PendingHandshakeOffer[] {
  const connected = new Set(connectedAddresses.map((a) => a.trim().toLowerCase()).filter(Boolean))
  return offers.filter((o) => {
    const s = o.sender.trim().toLowerCase()
    return /^0x[a-f0-9]{64}$/.test(s) && !connected.has(s)
  })
}
