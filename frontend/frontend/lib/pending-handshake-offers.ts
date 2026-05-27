import type { OutgoingHandshakeOffer, PendingHandshakeOffer } from '@/frontend/lib/api/package-connect'
import {
  handshakeOfferFingerprint,
  outgoingHandshakeOfferFingerprint,
  readDismissedHandshakeFingerprints,
  readDismissedOutgoingHandshakeFingerprints,
} from '@/frontend/lib/dismissed-handshake-offers'

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

export function filterOutgoingHandshakesNotConnected(
  offers: OutgoingHandshakeOffer[],
  connectedAddresses: string[]
): OutgoingHandshakeOffer[] {
  const connected = new Set(connectedAddresses.map((a) => a.trim().toLowerCase()).filter(Boolean))
  return offers.filter((o) => {
    const r = o.recipient.trim().toLowerCase()
    return /^0x[a-f0-9]{64}$/.test(r) && !connected.has(r)
  })
}

export function filterVisiblePendingHandshakes(
  offers: PendingHandshakeOffer[],
  connectedAddresses: string[],
  dismissed?: Set<string>
): PendingHandshakeOffer[] {
  const dismissedSet = dismissed ?? readDismissedHandshakeFingerprints()
  return filterPendingHandshakesNotConnected(offers, connectedAddresses).filter((o) => {
    const fp = handshakeOfferFingerprint(o.sender, o.nonce)
    return !dismissedSet.has(fp)
  })
}

export function filterVisibleOutgoingHandshakes(
  offers: OutgoingHandshakeOffer[],
  connectedAddresses: string[],
  dismissed?: Set<string>
): OutgoingHandshakeOffer[] {
  const dismissedSet = dismissed ?? readDismissedOutgoingHandshakeFingerprints()
  return filterOutgoingHandshakesNotConnected(offers, connectedAddresses).filter((o) => {
    const fp = outgoingHandshakeOfferFingerprint(o.recipient, o.nonce)
    return !dismissedSet.has(fp)
  })
}

/** Neue Angebote für Toast (noch nicht in dieser Browser-Session gemeldet). */
export function pickNewHandshakeOffersForNotify(
  visible: PendingHandshakeOffer[],
  alreadyNotified: Set<string>
): PendingHandshakeOffer[] {
  const fresh: PendingHandshakeOffer[] = []
  for (const o of visible) {
    const fp = handshakeOfferFingerprint(o.sender, o.nonce)
    if (alreadyNotified.has(fp)) continue
    fresh.push(o)
    alreadyNotified.add(fp)
  }
  return fresh
}
