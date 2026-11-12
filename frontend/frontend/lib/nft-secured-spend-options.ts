/**
 * Optionen für „Schlüsselkarte wählen“: Keycards + aktive Vaults + geparkte Bindungen.
 */

import { listNftActivity, listNftOwnedSnapshot } from '@/frontend/lib/nft-activity-local-log'
import { listNftBearerTreasuriesLocal } from '@/frontend/lib/nft-bearer-treasury-local-store'
import { listNftGuardedPursesLocal } from '@/frontend/lib/nft-guarded-purse-local-store'
import { getNftKeycard, listNftKeycards } from '@/frontend/lib/nft-keycard-local-store'
import { listParkedNftVaults } from '@/frontend/lib/nft-vault-parked-store'

export type SecuredSpendOption = {
  objectId: string
  label: string
  kindHint?: 'guarded' | 'bearer' | 'parked' | 'keycard'
  previewUrl?: string
}

function shortId(id: string): string {
  const t = id.trim()
  if (t.length < 14) return t
  return `${t.slice(0, 8)}…${t.slice(-4)}`
}

function norm(id: string): string {
  return id.trim().toLowerCase()
}

export function buildSecuredSpendOptions(): SecuredSpendOption[] {
  const map = new Map<string, SecuredSpendOption>()

  for (const { objectId, entry } of listNftKeycards()) {
    const k = norm(objectId)
    map.set(k, {
      objectId: k,
      label: `${entry.label || 'Schlüsselkarte'} · ${shortId(k)}`,
      kindHint: entry.boundVault?.kind || 'keycard',
    })
  }

  for (const p of listNftGuardedPursesLocal().filter((x) => x.status === 'active')) {
    const k = norm(p.nftObjectId)
    const label =
      p.displayLabel?.trim() ||
      getNftKeycard(k)?.label?.trim() ||
      `Guarded · ${shortId(k)}`
    map.set(k, { objectId: k, label: `${label} · Guarded`, kindHint: 'guarded' })
  }

  for (const t of listNftBearerTreasuriesLocal().filter((x) => x.status === 'active')) {
    const k = norm(t.nftObjectId)
    const prev = map.get(k)
    const label =
      t.displayLabel?.trim() ||
      getNftKeycard(k)?.label?.trim() ||
      `Bearer · ${shortId(k)}`
    if (!prev || prev.kindHint === 'keycard') {
      map.set(k, { objectId: k, label: `${label} · Bearer`, kindHint: 'bearer' })
    } else if (prev.kindHint === 'guarded') {
      map.set(k, {
        objectId: k,
        label: `${prev.label.replace(/ · Guarded$/, '')} · Guarded+Bearer`,
        kindHint: 'guarded',
      })
    }
  }

  for (const p of listParkedNftVaults()) {
    const k = norm(p.nftObjectId)
    if (map.has(k)) continue
    const label = p.displayLabel?.trim() || `${p.kind} · ${shortId(k)}`
    map.set(k, {
      objectId: k,
      label: `${label} · geparkt (NFT war unterwegs)`,
      kindHint: 'parked',
    })
  }

  /** Galerie-/Mint-Snapshot: auch ohne „Karte merken“ im Dropdown. */
  for (const oid of listNftOwnedSnapshot()) {
    const k = norm(oid)
    if (map.has(k)) continue
    const act = listNftActivity(40).find((a) => a.objectId === k && a.label)
    map.set(k, {
      objectId: k,
      label: `${act?.label || 'NFT'} · ${shortId(k)} · Besitz`,
      kindHint: 'keycard',
    })
  }

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'de'))
}

/** Welcher Spend-Modus passt zu diesem NFT? */
export function inferSpendModeForNft(nftObjectId: string): 'guarded' | 'bearer' {
  const k = norm(nftObjectId)
  const purse = listNftGuardedPursesLocal().find((p) => p.nftObjectId === k && p.status === 'active')
  const treasury = listNftBearerTreasuriesLocal().find(
    (t) => t.nftObjectId === k && t.status === 'active'
  )
  if (treasury && !purse) return 'bearer'
  if (purse && !treasury) return 'guarded'
  const bv = getNftKeycard(k)?.boundVault
  if (bv?.kind === 'bearer' || bv?.kind === 'guarded') return bv.kind
  const parked = listParkedNftVaults().find((p) => p.nftObjectId === k)
  if (parked?.kind === 'bearer' || parked?.kind === 'guarded') return parked.kind
  return 'guarded'
}
