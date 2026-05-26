'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { fetchPendingHandshakes, type PendingHandshakeOffer } from '@/frontend/lib/api/package-connect'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { dismissHandshakeOffer, clearDismissedHandshakeForSender } from '@/frontend/lib/dismissed-handshake-offers'
import {
  filterVisiblePendingHandshakes,
  pickNewHandshakeOffersForNotify,
} from '@/frontend/lib/pending-handshake-offers'

const POLL_MS = 45_000

export function useChatViewPendingHandshakes(p: {
  enabled: boolean
  connectedAddresses: string[]
  refreshToken: string | number
  contactDirectory?: Record<string, ContactMeshEntryClient>
  vaultLocked?: boolean
}) {
  const { enabled, connectedAddresses, refreshToken, contactDirectory = {}, vaultLocked = false } = p
  const [offers, setOffers] = useState<PendingHandshakeOffer[]>([])
  const [loading, setLoading] = useState(false)
  const notifiedRef = useRef<Set<string>>(new Set())
  const hadFirstLoadRef = useRef(false)

  const reload = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!enabled || vaultLocked) {
        setOffers([])
        return
      }
      if (!opts?.silent) setLoading(true)
      try {
        const r = await fetchPendingHandshakes()
        if (r.ok && r.offers) {
          const visible = filterVisiblePendingHandshakes(r.offers, connectedAddresses)
          setOffers(visible)
          if (hadFirstLoadRef.current && visible.length > 0) {
            const fresh = pickNewHandshakeOffersForNotify(visible, notifiedRef.current)
            for (const o of fresh) {
              const addr = o.sender.trim().toLowerCase()
              const label = contactDisplayLabel(contactDirectory, addr) || `${addr.slice(0, 10)}…`
              toast.message('Handshake-Anfrage', {
                description: `${label} möchte verschlüsselt verbinden — im Posteingang annehmen oder ablehnen.`,
                duration: 12_000,
              })
            }
          }
          hadFirstLoadRef.current = true
        } else {
          setOffers([])
        }
      } catch {
        setOffers([])
      } finally {
        setLoading(false)
      }
    },
    [enabled, vaultLocked, connectedAddresses, contactDirectory]
  )

  useEffect(() => {
    void reload({ silent: true })
  }, [reload, refreshToken])

  useEffect(() => {
    if (!enabled || vaultLocked) return
    const id = window.setInterval(() => void reload({ silent: true }), POLL_MS)
    return () => window.clearInterval(id)
  }, [enabled, vaultLocked, reload])

  const dismissOffer = useCallback(
    (sender: string, nonce: string) => {
      dismissHandshakeOffer(sender, nonce)
      setOffers((prev) =>
        prev.filter(
          (o) =>
            o.sender.trim().toLowerCase() !== sender.trim().toLowerCase() ||
            o.nonce.trim() !== nonce.trim()
        )
      )
    },
    []
  )

  const clearDismissedForSender = useCallback((sender: string) => {
    clearDismissedHandshakeForSender(sender)
  }, [])

  return { offers, loading, reload, dismissOffer, clearDismissedForSender }
}
