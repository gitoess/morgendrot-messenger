'use client'

import type { OutgoingHandshakeOffer, PendingHandshakeOffer } from '@/frontend/lib/handshake-offers-types'
import { OFFLINE_CACHE_TTL_MS } from '@/frontend/lib/offline-cache-ttl'
import { readScoped, writeScoped } from '@/frontend/lib/package-profile-namespace'

const LS_KEY = 'morgendrot.handshakeOffersCache.v1'
const HANDSHAKE_DOMAIN = 'handshakes'

type HandshakeOffersCacheEnvelope = {
  savedAtMs: number
  offers: PendingHandshakeOffer[]
  outgoingOffers: OutgoingHandshakeOffer[]
}

export function cacheHandshakeOffers(
  offers: PendingHandshakeOffer[],
  outgoingOffers: OutgoingHandshakeOffer[]
): void {
  if (typeof window === 'undefined') return
  try {
    const payload: HandshakeOffersCacheEnvelope = {
      savedAtMs: Date.now(),
      offers,
      outgoingOffers,
    }
    writeScoped(HANDSHAKE_DOMAIN, LS_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function readCachedHandshakeOffers(
  nowMs: number = Date.now()
): { offers: PendingHandshakeOffer[]; outgoingOffers: OutgoingHandshakeOffer[]; ageMinutes: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = readScoped(HANDSHAKE_DOMAIN, LS_KEY)?.trim()
    if (!raw) return null
    const j = JSON.parse(raw) as Partial<HandshakeOffersCacheEnvelope>
    const savedAtMs = Number(j.savedAtMs ?? 0)
    if (!Number.isFinite(savedAtMs) || savedAtMs <= 0) return null
    const ageMs = nowMs - savedAtMs
    if (ageMs < 0 || ageMs > OFFLINE_CACHE_TTL_MS) return null
    return {
      offers: Array.isArray(j.offers) ? j.offers : [],
      outgoingOffers: Array.isArray(j.outgoingOffers) ? j.outgoingOffers : [],
      ageMinutes: Math.floor(ageMs / 60_000),
    }
  } catch {
    return null
  }
}

export function hasCachedHandshakeOffers(): boolean {
  return readCachedHandshakeOffers() != null
}
