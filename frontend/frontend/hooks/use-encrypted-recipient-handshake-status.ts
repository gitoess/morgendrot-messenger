'use client'

import { useCallback, useEffect, useState } from 'react'
import { findPeerHandshake } from '@/frontend/lib/api/package-connect'
import type { OutgoingHandshakeOffer, PendingHandshakeOffer } from '@/frontend/lib/api/package-connect'
import {
  encryptedHandshakeBlocksSend,
  resolveEncryptedRecipientHandshakeStatusSync,
  type EncryptedRecipientHandshakeStatus,
  isValidRecipient0x,
  normalizeRecipient0x,
} from '@/frontend/lib/encrypted-recipient-handshake-status'
import {
  getDirectChatEcdhMaterialForRecipient,
  setDirectChatEcdhPeerPubBase64,
} from '@/frontend/lib/direct-chat-ecdh-session'
import {
  getCachedChainHandshakeProbe,
  setCachedChainHandshakeProbe,
  shouldRunChainHandshakeProbe,
} from '@/frontend/lib/chain-handshake-probe-cache'

export function useEncryptedRecipientHandshakeStatus(p: {
  enabled: boolean
  recipient: string
  connectedAddresses: string[]
  incomingOffers: PendingHandshakeOffer[]
  outgoingOffers: OutgoingHandshakeOffer[]
}): {
  status: EncryptedRecipientHandshakeStatus
  blocksSend: boolean
  refresh: () => void
} {
  const { enabled, recipient, connectedAddresses, incomingOffers, outgoingOffers } = p
  const [asyncChecked, setAsyncChecked] = useState(0)

  const syncStatus = resolveEncryptedRecipientHandshakeStatusSync({
    recipient,
    connectedAddresses,
    incomingOffers,
    outgoingOffers,
  })

  const [chainAugment, setChainAugment] = useState<'none' | 'found_peer_key' | 'not_found'>('none')

  const refresh = useCallback(() => setAsyncChecked((n) => n + 1), [])

  useEffect(() => {
    if (!enabled || !isValidRecipient0x(recipient)) {
      setChainAugment('none')
      return
    }
    if (syncStatus === 'ready' || syncStatus === 'idle') {
      setChainAugment('none')
      return
    }
    const addr = normalizeRecipient0x(recipient)
    const cached = getCachedChainHandshakeProbe(addr)
    if (cached === 'found') {
      if (getDirectChatEcdhMaterialForRecipient(addr)) {
        setChainAugment('found_peer_key')
      } else {
        setChainAugment('not_found')
      }
      return
    }
    if (cached === 'not_found') {
      setChainAugment('not_found')
      return
    }
    if (!shouldRunChainHandshakeProbe(addr)) return

    let cancelled = false
    void (async () => {
      try {
        const hs = await findPeerHandshake(addr)
        if (cancelled) return
        if (hs.ok && hs.found && hs.peerPubRawBase64) {
          setDirectChatEcdhPeerPubBase64(addr, hs.peerPubRawBase64)
          setCachedChainHandshakeProbe(addr, true)
          setChainAugment('found_peer_key')
        } else {
          setCachedChainHandshakeProbe(addr, false)
          setChainAugment('not_found')
        }
      } catch {
        if (!cancelled) {
          setCachedChainHandshakeProbe(addr, false)
          setChainAugment('not_found')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, recipient, syncStatus, asyncChecked])

  let status: EncryptedRecipientHandshakeStatus = syncStatus
  if (
    enabled &&
    isValidRecipient0x(recipient) &&
    syncStatus !== 'ready' &&
    syncStatus !== 'idle' &&
    chainAugment === 'none' &&
    (syncStatus === 'needs_handshake' || syncStatus === 'awaiting_peer')
  ) {
    status = 'checking'
  }
  if (chainAugment === 'found_peer_key') {
    const addr = normalizeRecipient0x(recipient)
    if (getDirectChatEcdhMaterialForRecipient(addr)) status = 'ready'
    else status = 'needs_accept'
  }

  return {
    status,
    blocksSend: enabled && encryptedHandshakeBlocksSend(status),
    refresh,
  }
}
