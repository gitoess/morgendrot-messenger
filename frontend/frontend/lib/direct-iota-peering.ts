'use client'

import { resolveConnectedAddresses } from '@/frontend/lib/connected-peers-snapshot'
import { listDirectChatEcdhPeerRecipientAddresses } from '@/frontend/lib/direct-chat-ecdh-session'
import { canTryLiveEncryptedDirectMailbox } from '@/frontend/lib/direct-iota-encrypted-submit'
import { isDirectMailboxDrainEnabled, isIotaRelayOnlyMode } from '@/frontend/lib/direct-iota-plain-submit'
import { canFetchHandshakesViaDirectIota } from '@/frontend/lib/direct-iota-handshake-fetch'
import { canTryDirectHandshakeSubmit } from '@/frontend/lib/direct-iota-handshake-submit'
import { getConfiguredDirectIotaRpcUrl } from '@/frontend/lib/direct-iota-rpc'
import { getDirectMailboxChainSnapshot } from '@/frontend/lib/direct-iota-chain-context'
import { canTryDirectConnectPeer } from '@/frontend/lib/direct-iota-connect'

export type DirectIotaPeeringContext = {
  backendReachable: boolean
  connectedAddresses?: string[] | null
}

/** Handshake/Connect laufen über Morgendrot-API (Relay) — nicht per Fullnode. */
export function canUseBasisPeeringCommands(ctx: DirectIotaPeeringContext): boolean {
  return ctx.backendReachable !== false
}

export function hasDirectEncryptedMaterialForRecipient(recipient: string): boolean {
  const r = recipient.trim()
  if (!r) return false
  return canTryLiveEncryptedDirectMailbox(r)
}

export function listDirectIotaPeeringGaps(ctx: DirectIotaPeeringContext, partner?: string): string[] {
  const gaps: string[] = []
  const r = (partner || '').trim()

  if (!canUseBasisPeeringCommands(ctx)) {
    if (canTryDirectHandshakeSubmit()) {
      gaps.push(
        'Basis offline — Handshake senden/annehmen (Connect) per Direkt-RPC möglich; Einsatz-Partner (.env) weiter nur mit Basis.'
      )
    } else if (canFetchHandshakesViaDirectIota()) {
      gaps.push(
        'Basis offline — Handshake-Angebote per Direkt-RPC lesen; Peering-QR für Partner + ECDH-Pub; Handshake senden: RPC + Signer + ECDH-JWK im Puls.'
      )
    } else {
      gaps.push(
        'Connect braucht die Morgendrot-Basis — offline: Peering-QR oder Peer-Pub manuell im Puls.'
      )
    }
  }

  if (isIotaRelayOnlyMode()) {
    gaps.push('Modus „Nur Morgendrot-API“ — verschlüsselter Direkt-Mailbox-Versand per Fullnode ist aus.')
    return gaps
  }

  if (!getConfiguredDirectIotaRpcUrl()) {
    gaps.push('Direkt-RPC-URL fehlt — für verschlüsselten Direkt-Versand in den Puls-Einstellungen setzen.')
  }
  if (!isDirectMailboxDrainEnabled()) {
    gaps.push('Direkt-Mailbox-Drain aus — für verschlüsselten Direkt-Versand einschalten.')
  }
  if (!getDirectMailboxChainSnapshot()) {
    gaps.push('Ketten-IDs fehlen — Package/Mailbox/Absender im Puls speichern.')
  }

  if (r && !hasDirectEncryptedMaterialForRecipient(r)) {
    const peerAddrs = listDirectChatEcdhPeerRecipientAddresses()
    if (!peerAddrs.includes(r.toLowerCase())) {
      gaps.push(
        `Für ${r.slice(0, 10)}… fehlt Peer-Pub/ECDH — Handshake (wenn Basis da) oder Peer-Pub manuell im Puls.`
      )
    }
  }

  return gaps
}

/** Nur Partner-Austausch / Handshake — ohne Direkt-RPC-Setup (siehe listDirectIotaSetupGaps). */
export function listDirectIotaPeeringExchangeGaps(ctx: DirectIotaPeeringContext, partner?: string): string[] {
  return listDirectIotaPeeringGaps(ctx, partner).filter((g) => {
    if (g.includes('Direkt-RPC-URL')) return false
    if (g.includes('Direkt-Mailbox-Drain')) return false
    if (g.includes('Ketten-IDs fehlen')) return false
    if (g.includes('Nur Morgendrot-API')) return false
    return true
  })
}

/** Einstellungen: kurzer Status nur wenn lokale Peering-Daten existieren. */
export function formatDirectIotaPeeringStatusLineForSettings(ctx: DirectIotaPeeringContext): string | null {
  const resolved = resolveConnectedAddresses({
    fromStatus: ctx.connectedAddresses,
    preferCacheWhenEmpty: true,
  })
  const ecdhPeers = listDirectChatEcdhPeerRecipientAddresses()
  if (resolved.addresses.length === 0 && ecdhPeers.length === 0) return null
  const parts: string[] = []
  if (resolved.addresses.length > 0) {
    parts.push(
      `${resolved.addresses.length} Partner-Adresse${resolved.addresses.length === 1 ? '' : 'n'} bekannt`
    )
  }
  if (ecdhPeers.length > 0) {
    parts.push(`${ecdhPeers.length} Verschlüsselungsschlüssel gespeichert`)
  }
  return parts.join(' · ')
}

export function formatDirectIotaPeeringStatusLine(ctx: DirectIotaPeeringContext): string {
  const resolved = resolveConnectedAddresses({
    fromStatus: ctx.connectedAddresses,
    preferCacheWhenEmpty: true,
  })
  const ecdhPeers = listDirectChatEcdhPeerRecipientAddresses()
  const parts: string[] = []
  if (resolved.addresses.length > 0) {
    parts.push(
      resolved.fromCache
        ? `${resolved.addresses.length} Partner (Cache, Basis offline)`
        : `${resolved.addresses.length} Partner verbunden`
    )
  }
  if (ecdhPeers.length > 0) {
    parts.push(`${ecdhPeers.length} ECDH-Material lokal`)
  }
  if (!canUseBasisPeeringCommands(ctx)) {
    parts.push(
      canTryDirectConnectPeer()
        ? 'Peering: Direkt-RPC'
        : canFetchHandshakesViaDirectIota()
          ? 'Angebote: Direkt-RPC'
          : 'Connect: Basis nötig'
    )
  } else if (resolved.addresses.length === 0 && ecdhPeers.length === 0) {
    parts.push('Noch keine Peering-Daten lokal')
  }
  return parts.join(' · ') || 'Peering: —'
}
