/**
 * Optionen für „Schlüsselkarte wählen“: Keycards + Vaults + Galerie-Besitz.
 * Labels bewusst schlicht: Name · Kurz-ID · optional „Guthaben“ wenn noch Mist da.
 */

import { listNftActivity, listNftOwnedSnapshot } from '@/frontend/lib/nft-activity-local-log'
import { listNftBearerTreasuriesLocal } from '@/frontend/lib/nft-bearer-treasury-local-store'
import { listNftGuardedPursesLocal } from '@/frontend/lib/nft-guarded-purse-local-store'
import { getNftKeycard, listNftKeycards } from '@/frontend/lib/nft-keycard-local-store'
import {
  isNftTimeLeaseEscrowActive,
  listNftTimeLeasesLocal,
} from '@/frontend/lib/nft-time-lease-local-store'
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

/** Lokaler Mist-Hinweis: 0 / reclaimed → kein „Guthaben“-Suffix in der Liste. */
export function vaultMistHintLooksEmpty(hint: string | undefined): boolean {
  const t = (hint || '').trim()
  if (!t) return false
  if (/reclaimed/i.test(t)) return true
  const abs = t.match(/^(\d+)\b/)
  if (abs) {
    try {
      return BigInt(abs[1]) === 0n
    } catch {
      return false
    }
  }
  return false
}

function vaultLooksFunded(entry: { status: string; balanceMistHint: string }): boolean {
  return entry.status === 'active' && !vaultMistHintLooksEmpty(entry.balanceMistHint)
}

function displayNameForNft(
  oid: string,
  fallbacks: Array<string | undefined | null> = []
): string {
  for (const f of fallbacks) {
    const t = (f || '').trim()
    if (t) return t
  }
  const card = getNftKeycard(oid)?.label?.trim()
  if (card) return card
  const act = listNftActivity(40).find((a) => a.objectId === oid && a.label?.trim())
  if (act?.label?.trim()) return act.label.trim()
  return 'NFT'
}

function optionLabel(oid: string, name: string, funded: boolean): string {
  const base = `${name} · ${shortId(oid)}`
  return funded ? `${base} · Guthaben` : base
}

function isEscrowedNow(oid: string): boolean {
  return listNftTimeLeasesLocal().some((e) => norm(e.nftObjectId) === oid && isNftTimeLeaseEscrowActive(e))
}

/** Aktives Vault-Objekt (auch leer) — blockiert neues Anlegen im gleichen Slot. */
export function nftHasActiveVaultShell(nftObjectId: string): boolean {
  const k = norm(nftObjectId)
  if (listNftGuardedPursesLocal().some((p) => p.nftObjectId === k && p.status === 'active')) return true
  if (listNftBearerTreasuriesLocal().some((t) => t.nftObjectId === k && t.status === 'active')) return true
  return false
}

/** Noch Mist hinter dem NFT (Guarded und/oder Bearer). */
export function nftHasFundedSecuredBalance(nftObjectId: string): boolean {
  const k = norm(nftObjectId)
  if (
    listNftGuardedPursesLocal().some(
      (p) => p.nftObjectId === k && p.status === 'active' && vaultLooksFunded(p)
    )
  ) {
    return true
  }
  if (
    listNftBearerTreasuriesLocal().some(
      (t) => t.nftObjectId === k && t.status === 'active' && vaultLooksFunded(t)
    )
  ) {
    return true
  }
  return false
}

/**
 * NFT-wählen im Guthaben-/Zeitkapsel-Tab: nur Besitz aus Galerie/Snapshot.
 * Guthaben: nur frei (kein finanziertes Vault; leere Shells zählen als frei — Auto-Destroy räumt sie).
 * Zeitkapsel: Besitz ohne aktive Escrow-Leihe.
 */
export function buildOwnedNftPickOptions(opts: {
  ownedObjectIds: string[]
  purpose: 'guthaben' | 'zeitkapsel'
  labelsById?: Record<string, string>
}): SecuredSpendOption[] {
  const owned = new Set<string>()
  for (const raw of opts.ownedObjectIds) {
    const k = norm(raw)
    if (k) owned.add(k)
  }
  for (const oid of listNftOwnedSnapshot()) {
    const k = norm(oid)
    if (k) owned.add(k)
  }

  const out: SecuredSpendOption[] = []
  for (const k of owned) {
    if (isEscrowedNow(k)) continue
    if (opts.purpose === 'guthaben' && nftHasFundedSecuredBalance(k)) continue
    const name = displayNameForNft(k, [opts.labelsById?.[k]])
    out.push({
      objectId: k,
      label: optionLabel(k, name, false),
      kindHint: 'keycard',
    })
  }
  return out.sort((a, b) => a.label.localeCompare(b.label, 'de'))
}

/** Überweisen / Balances: breitere Liste inkl. Vaults. */
export function buildSecuredSpendOptions(): SecuredSpendOption[] {
  const map = new Map<string, SecuredSpendOption>()

  /** Zuerst Besitz / gemerkte Karten — ohne Jargon. */
  for (const { objectId, entry } of listNftKeycards()) {
    const k = norm(objectId)
    map.set(k, {
      objectId: k,
      label: optionLabel(k, displayNameForNft(k, [entry.label]), false),
      kindHint: 'keycard',
    })
  }

  for (const oid of listNftOwnedSnapshot()) {
    const k = norm(oid)
    if (map.has(k)) continue
    map.set(k, {
      objectId: k,
      label: optionLabel(k, displayNameForNft(k), false),
      kindHint: 'keycard',
    })
  }

  for (const p of listNftGuardedPursesLocal().filter((x) => x.status === 'active')) {
    const k = norm(p.nftObjectId)
    const funded = vaultLooksFunded(p)
    const name = displayNameForNft(k, [p.displayLabel])
    const prev = map.get(k)
    map.set(k, {
      objectId: k,
      label: optionLabel(k, name, funded || Boolean(prev && / · Guthaben$/.test(prev.label))),
      kindHint: funded ? 'guarded' : prev?.kindHint || 'keycard',
    })
  }

  for (const t of listNftBearerTreasuriesLocal().filter((x) => x.status === 'active')) {
    const k = norm(t.nftObjectId)
    const funded = vaultLooksFunded(t)
    const name = displayNameForNft(k, [t.displayLabel])
    const prev = map.get(k)
    const alreadyFunded = Boolean(prev && / · Guthaben$/.test(prev.label))
    map.set(k, {
      objectId: k,
      label: optionLabel(k, name, funded || alreadyFunded),
      kindHint: funded ? 'bearer' : prev?.kindHint === 'guarded' ? 'guarded' : prev?.kindHint || 'keycard',
    })
  }

  for (const p of listParkedNftVaults()) {
    const k = norm(p.nftObjectId)
    if (map.has(k)) continue
    const name = displayNameForNft(k, [p.displayLabel])
    map.set(k, {
      objectId: k,
      label: `${optionLabel(k, name, false)} · unterwegs`,
      kindHint: 'parked',
    })
  }

  /**
   * Zurückgeholte / beendete Leihen: NFT wieder wählbar.
   * Aktive Escrow-Leihen weglassen (NFT nicht bei dir).
   */
  for (const e of listNftTimeLeasesLocal()) {
    const k = norm(e.nftObjectId)
    if (!k || isNftTimeLeaseEscrowActive(e)) {
      map.delete(k)
      continue
    }
    if (map.has(k)) continue
    map.set(k, {
      objectId: k,
      label: optionLabel(k, displayNameForNft(k), false),
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
