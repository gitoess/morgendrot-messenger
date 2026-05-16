'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchPendingHandshakes, type PendingHandshakeOffer } from '@/frontend/lib/api/package-connect'
import { filterPendingHandshakesNotConnected } from '@/frontend/lib/pending-handshake-offers'

export function useChatViewPendingHandshakes(p: {
  enabled: boolean
  connectedAddresses: string[]
  refreshToken: string | number
}) {
  const { enabled, connectedAddresses, refreshToken } = p
  const [offers, setOffers] = useState<PendingHandshakeOffer[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    if (!enabled) {
      setOffers([])
      return
    }
    setLoading(true)
    try {
      const r = await fetchPendingHandshakes()
      if (r.ok && r.offers) {
        setOffers(filterPendingHandshakesNotConnected(r.offers, connectedAddresses))
      } else {
        setOffers([])
      }
    } catch {
      setOffers([])
    } finally {
      setLoading(false)
    }
  }, [enabled, connectedAddresses])

  useEffect(() => {
    void reload()
  }, [reload, refreshToken])

  return { offers, loading, reload }
}
