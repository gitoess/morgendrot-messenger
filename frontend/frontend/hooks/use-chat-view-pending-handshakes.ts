'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  fetchHandshakeOffers,
  type OutgoingHandshakeOffer,
  type PendingHandshakeOffer,
} from '@/frontend/lib/api/package-connect'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { dismissHandshakeOffer, dismissOutgoingHandshakeOffer, clearDismissedHandshakeForSender } from '@/frontend/lib/dismissed-handshake-offers'
import {
  filterVisibleOutgoingHandshakes,
  filterVisiblePendingHandshakes,
  pickNewHandshakeOffersForNotify,
} from '@/frontend/lib/pending-handshake-offers'
import { ACTIVE_MAILBOX_CHANGED_EVENT } from '@/frontend/lib/my-mailbox-active'

const POLL_MS = 45_000

export const HANDSHAKE_OFFERS_REFRESH_EVENT = 'morg:handshake-offers-refresh'

function offersEqual(a: PendingHandshakeOffer[], b: PendingHandshakeOffer[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.sender !== b[i]!.sender || a[i]!.nonce !== b[i]!.nonce) return false
  }
  return true
}

function outgoingOffersEqual(a: OutgoingHandshakeOffer[], b: OutgoingHandshakeOffer[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i]!.recipient !== b[i]!.recipient || a[i]!.nonce !== b[i]!.nonce) return false
  }
  return true
}

export type PendingHandshakesPollState = {
  offers: PendingHandshakeOffer[]
  outgoingOffers: OutgoingHandshakeOffer[]
  loading: boolean
  reload: (opts?: { silent?: boolean }) => Promise<void>
  dismissOffer: (sender: string, nonce: string) => void
  dismissOutgoingOffer: (recipient: string, nonce: string) => void
  clearDismissedForSender: (sender: string) => void
}

export function useChatViewPendingHandshakes(p: {
  enabled: boolean
  connectedAddresses: string[]
  refreshToken: string | number
  contactDirectory?: Record<string, ContactMeshEntryClient>
  vaultLocked?: boolean
}) {
  const { enabled, connectedAddresses, refreshToken, contactDirectory, vaultLocked = false } = p
  const [offers, setOffers] = useState<PendingHandshakeOffer[]>([])
  const [outgoingOffers, setOutgoingOffers] = useState<OutgoingHandshakeOffer[]>([])
  const [loading, setLoading] = useState(false)
  const notifiedRef = useRef<Set<string>>(new Set())
  const connectedRef = useRef(connectedAddresses)
  const directoryRef = useRef(contactDirectory ?? {})

  useEffect(() => {
    connectedRef.current = connectedAddresses
  }, [connectedAddresses])

  useEffect(() => {
    directoryRef.current = contactDirectory ?? {}
  }, [contactDirectory])

  const reload = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!enabled || vaultLocked) {
        setOffers((prev) => (prev.length ? [] : prev))
        setOutgoingOffers((prev) => (prev.length ? [] : prev))
        return
      }
      if (!opts?.silent) setLoading(true)
      try {
        const r = await fetchHandshakeOffers()
        if (r.ok) {
          const visible = filterVisiblePendingHandshakes(r.offers ?? [], connectedRef.current)
          const visibleOutgoing = filterVisibleOutgoingHandshakes(
            r.outgoingOffers ?? [],
            connectedRef.current
          )
          setOffers((prev) => (offersEqual(prev, visible) ? prev : visible))
          setOutgoingOffers((prev) =>
            outgoingOffersEqual(prev, visibleOutgoing) ? prev : visibleOutgoing
          )
          const fresh = pickNewHandshakeOffersForNotify(visible, notifiedRef.current)
          for (const o of fresh) {
            const addr = o.sender.trim().toLowerCase()
            const label =
              contactDisplayLabel(directoryRef.current, addr) || `${addr.slice(0, 10)}…`
            toast.message('Handshake-Anfrage', {
              description: `${label} möchte verschlüsselt verbinden — im Posteingang annehmen oder ablehnen.`,
              duration: 12_000,
            })
          }
        } else {
          setOffers((prev) => (prev.length ? [] : prev))
          setOutgoingOffers((prev) => (prev.length ? [] : prev))
        }
      } catch {
        setOffers((prev) => (prev.length ? [] : prev))
        setOutgoingOffers((prev) => (prev.length ? [] : prev))
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [enabled, vaultLocked]
  )

  useEffect(() => {
    void reload({ silent: true })
  }, [reload, refreshToken])

  useEffect(() => {
    if (!enabled || vaultLocked) return
    const id = window.setInterval(() => void reload({ silent: true }), POLL_MS)
    return () => window.clearInterval(id)
  }, [enabled, vaultLocked, reload])

  useEffect(() => {
    if (!enabled || vaultLocked) return
    const onMailboxChanged = () => void reload({ silent: true })
    const onRefreshRequested = () => void reload({ silent: true })
    window.addEventListener(ACTIVE_MAILBOX_CHANGED_EVENT, onMailboxChanged)
    window.addEventListener(HANDSHAKE_OFFERS_REFRESH_EVENT, onRefreshRequested)
    return () => {
      window.removeEventListener(ACTIVE_MAILBOX_CHANGED_EVENT, onMailboxChanged)
      window.removeEventListener(HANDSHAKE_OFFERS_REFRESH_EVENT, onRefreshRequested)
    }
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

  const dismissOutgoingOffer = useCallback((recipient: string, nonce: string) => {
    dismissOutgoingHandshakeOffer(recipient, nonce)
    setOutgoingOffers((prev) =>
      prev.filter(
        (o) =>
          o.recipient.trim().toLowerCase() !== recipient.trim().toLowerCase() ||
          o.nonce.trim() !== nonce.trim()
      )
    )
  }, [])

  const clearDismissedForSender = useCallback((sender: string) => {
    clearDismissedHandshakeForSender(sender)
  }, [])

  return {
    offers,
    outgoingOffers,
    loading,
    reload,
    dismissOffer,
    dismissOutgoingOffer,
    clearDismissedForSender,
  }
}

export function notifyHandshakeOffersRefresh(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(HANDSHAKE_OFFERS_REFRESH_EVENT))
  } catch {
    /* ignore */
  }
}
