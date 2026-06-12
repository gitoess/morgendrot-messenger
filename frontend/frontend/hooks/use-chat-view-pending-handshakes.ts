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
import { canTryDirectConnectPeer } from '@/frontend/lib/direct-iota-connect'
import { shouldSkipMessengerApiRelayFallback } from '@/frontend/lib/messenger-standalone-relay'

const POLL_MS = 45_000

export const HANDSHAKE_OFFERS_REFRESH_EVENT = 'morg:handshake-offers-refresh'

/** Dashboard/Chat: Posteingang öffnen (z. B. aus Handshake-Toast). */
export const OPEN_MESSENGER_INBOX_EVENT = 'morg:open-messenger-inbox'

export function notifyOpenMessengerInbox(): void {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent(OPEN_MESSENGER_INBOX_EVENT))
  } catch {
    /* ignore */
  }
}

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
  /** false = kein Poll (Tresor); bei Basis-Ausfall reicht Handshake-Cache (§ H.15 B.2). */
  enabled: boolean
  connectedAddresses: string[]
  refreshToken: string | number
  contactDirectory?: Record<string, ContactMeshEntryClient>
  vaultLocked?: boolean
  /** Einmal-Hinweis, wenn Angebote per Fullnode ohne Basis geladen wurden. */
  basisUnreachable?: boolean
}) {
  const { enabled, connectedAddresses, refreshToken, contactDirectory, vaultLocked = false, basisUnreachable = false } = p
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
          if (r.fromCache && !opts?.silent) {
            const standalone = shouldSkipMessengerApiRelayFallback()
            toast.info('Handshake-Liste aus Cache', {
              description: standalone
                ? `Stand vor ${r.cacheAgeMinutes ?? '?'} Min. — für frische Angebote Direkt-RPC prüfen (Handoff, Fullnode). Annehmen/Connect per Direkt-RPC wenn Puls vollständig.`
                : `Basis nicht erreichbar — Stand vor ${r.cacheAgeMinutes ?? '?'} Min. (TTL 30 Min.). Annehmen/Ablehnen braucht die Basis.`,
              duration: 10_000,
            })
          } else if (r.liveSource === 'rpc' && !opts?.silent && basisUnreachable) {
            toast.info('Handshake-Liste per Direkt-RPC', {
              description: canTryDirectConnectPeer()
                ? 'Basis offline — Angebote von der Fullnode. Annehmen/Connect ohne Morgendrot-API möglich.'
                : 'Basis offline — Angebote von der Fullnode. Annehmen: RPC + Ketten-IDs + Signer + ECDH-JWK im Puls.',
              duration: 8_000,
            })
          }
          const fresh = r.fromCache ? [] : pickNewHandshakeOffersForNotify(visible, notifiedRef.current)
          for (const o of fresh) {
            const addr = o.sender.trim().toLowerCase()
            const label =
              contactDisplayLabel(directoryRef.current, addr) || `${addr.slice(0, 10)}…`
            toast.message('Handshake-Anfrage', {
              description: `${label} möchte verschlüsselt verbinden — im Posteingang annehmen oder ablehnen.`,
              duration: 12_000,
              action: {
                label: 'Posteingang',
                onClick: () => notifyOpenMessengerInbox(),
              },
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
    [enabled, vaultLocked, basisUnreachable]
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
