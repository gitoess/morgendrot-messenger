import type {
  OutgoingHandshakeOffer,
  PendingHandshakeOffer,
} from '@/frontend/lib/handshake-offers-types'

/** Ausstehende Handshake-Angebote (Inbox + Composer-Status). */
export type HandshakeOffersReadPort = {
  readonly pendingOffers: readonly PendingHandshakeOffer[]
  readonly outgoingOffers: readonly OutgoingHandshakeOffer[]
  readonly reload: () => void
}

export function asHandshakeOffersRead(
  pendingOffers: readonly PendingHandshakeOffer[],
  outgoingOffers: readonly OutgoingHandshakeOffer[],
  reload: () => void
): HandshakeOffersReadPort {
  return { pendingOffers, outgoingOffers, reload }
}
