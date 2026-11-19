/**
 * Lokale Einsatz-Rollen eines NFTs (Galerie / Info).
 * Mehrere Rollen gleichzeitig möglich — orthogonal (Leserecht ≠ Guthaben ≠ Leihe).
 */

import { findNftBearerTreasuryByNft } from '@/frontend/lib/nft-bearer-treasury-local-store'
import { findNftGuardedPurseByNft } from '@/frontend/lib/nft-guarded-purse-local-store'
import { getNftKeycard } from '@/frontend/lib/nft-keycard-local-store'
import { readZeitkapselLastNftObjectId } from '@/frontend/lib/passphrase-message-local-store'
import {
  findNftTimeLeaseByNft,
  isNftTimeLeaseEscrowActive,
  isPendingNftTimeLeaseId,
} from '@/frontend/lib/nft-time-lease-local-store'
import { nftHasFundedSecuredBalance } from '@/frontend/lib/nft-secured-spend-options'

export type NftRoleBadge = {
  id: 'keycard' | 'gesichert' | 'verliehen' | 'leserecht'
  label: string
  hint: string
}

function norm(id: string): string {
  return id.trim().toLowerCase()
}

/** Aktive Einsatz-Markierungen für Galerie/Info (mehrere ok). */
export function nftRoleBadges(objectId: string): NftRoleBadge[] {
  const oid = norm(objectId)
  if (!/^0x[0-9a-f]{64}$/.test(oid)) return []
  const out: NftRoleBadge[] = []

  const card = getNftKeycard(oid)
  if (card) {
    out.push({
      id: 'keycard',
      label: 'Schlüsselkarte',
      hint: 'Lokal Passphrase/Slots gemerkt',
    })
  }

  const purse = findNftGuardedPurseByNft(oid)
  const treasury = findNftBearerTreasuryByNft(oid)
  const vaultActive =
    (purse?.status === 'active' ? purse : null) ||
    (treasury?.status === 'active' ? treasury : null)
  if (vaultActive) {
    const funded = nftHasFundedSecuredBalance(oid)
    const kind = purse?.status === 'active' ? 'Guarded' : 'Bearer'
    out.push({
      id: 'gesichert',
      label: funded ? `Gesichert (${kind})` : `Vault (${kind}, leer)`,
      hint: 'Token hinter NFT — orthogonal zu Leserecht/Leihe',
    })
  }

  const lease = findNftTimeLeaseByNft(oid)
  if (lease && isNftTimeLeaseEscrowActive(lease)) {
    const pending = isPendingNftTimeLeaseId(lease.leaseObjectId)
    out.push({
      id: 'verliehen',
      label: pending ? 'Verliehen (ID fehlt)' : 'Verliehen',
      hint: pending
        ? 'Lease-ID nachziehen: Verleihen → Liste aktualisieren / Notfall'
        : `Lease ${lease.leaseObjectId.slice(0, 10)}…`,
    })
  }

  const lastGate = (readZeitkapselLastNftObjectId() || '').trim().toLowerCase()
  if (lastGate === oid) {
    out.push({
      id: 'leserecht',
      label: 'NFT-Leserecht (zuletzt)',
      hint: 'Zuletzt im Composer für NFT-Gate gewählt — kein exklusiver On-Chain-Lock',
    })
  }

  return out
}

export function nftRoleBadgeLabels(objectId: string): string[] {
  return nftRoleBadges(objectId).map((b) => b.label)
}

export function nftRoleBadgesSummary(objectId: string): string {
  return nftRoleBadgeLabels(objectId).join(' · ')
}
