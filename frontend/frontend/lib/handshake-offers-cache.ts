'use client'

import type { OutgoingHandshakeOffer, PendingHandshakeOffer } from '@/frontend/lib/api/package-connect'
import { OFFLINE_CACHE_TTL_MS } from '@/frontend/lib/offline-cache-ttl'

const LS_KEY = 'morgendrot.handshakeOffersCache.v1'

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
    window.localStorage.setItem(LS_KEY, JSON.stringify(payload))
  } catch {
    /* ignore */
  }
}

export function readCachedHandshakeOffers(
  nowMs: number = Date.now()
): { offers: PendingHandshakeOffer[]; outgoingOffers: OutgoingHandshakeOffer[]; ageMinutes: number } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_KEY)?.trim()
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
