export type PendingHandshakeOffer = {
  sender: string
  nonce: string
  source: 'mailbox' | 'event'
}

export type OutgoingHandshakeOffer = {
  recipient: string
  nonce: string
  source: 'mailbox' | 'event'
}

export type HandshakeOffersFetchResult = {
  ok: boolean
  offers?: PendingHandshakeOffer[]
  outgoingOffers?: OutgoingHandshakeOffer[]
  error?: string
  fromCache?: boolean
  cacheAgeMinutes?: number
  liveSource?: 'rpc' | 'api' | 'cache'
}
