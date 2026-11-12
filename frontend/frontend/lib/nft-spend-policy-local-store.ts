/**
 * Optionale Spend-Politik pro NFT (Mint-Checkbox / [morg-attrs]).
 * One-Time-Use: App blockiert Folge-Spends; optional Burn nach erstem Spend.
 * Starke On-Chain-Garantie braucht Move-Upgrade (siehe NFT-GUARDED-SPEND-SPEC).
 */

import type { EvidenceAttrPair } from '@/frontend/lib/evidence-image-attrs'

export const NFT_SPEND_POLICY_LS_KEY = 'morgendrot.nftSpendPolicy.v1'
export const NFT_SPEND_POLICY_CHANGED = 'morgendrot:nft-spend-policy'

export const SPEND_POLICY_ATTR_KEY = 'spend_policy'
export const SPEND_POLICY_ONE_TIME = 'one_time'
export const OFFLINE_HANDOFF_ATTR_KEY = 'offline_handoff'

export type NftSpendPolicyEntry = {
  nftObjectId: string
  /** Nach erstem erfolgreichen Spend/Withdraw ungültig. */
  oneTimeUse: boolean
  /** Nach erstem Spend ImageNFT burnen (Default bei oneTimeUse). */
  burnAfterSpend: boolean
  /** Offline-Index-Übergabe (QR/Mesh) bevorzugt. */
  offlineHandoff: boolean
  consumedAtMs?: number
  consumeDigest?: string
  burnDigest?: string
  updatedAtMs: number
}

type StoreV1 = { v: 1; byNft: Record<string, NftSpendPolicyEntry> }

function norm(id: string): string {
  return id.trim().toLowerCase()
}

function readStore(): StoreV1 {
  if (typeof window === 'undefined') return { v: 1, byNft: {} }
  try {
    const raw = window.localStorage.getItem(NFT_SPEND_POLICY_LS_KEY)
    if (!raw) return { v: 1, byNft: {} }
    const j = JSON.parse(raw) as StoreV1
    if (j?.v !== 1 || typeof j.byNft !== 'object' || !j.byNft) return { v: 1, byNft: {} }
    return j
  } catch {
    return { v: 1, byNft: {} }
  }
}

function writeStore(s: StoreV1): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(NFT_SPEND_POLICY_LS_KEY, JSON.stringify(s))
    window.dispatchEvent(new Event(NFT_SPEND_POLICY_CHANGED))
  } catch {
    /* ignore */
  }
}

export function getNftSpendPolicy(nftObjectId: string): NftSpendPolicyEntry | null {
  const id = norm(nftObjectId)
  return readStore().byNft[id] || null
}

export function upsertNftSpendPolicy(
  patch: Partial<NftSpendPolicyEntry> & { nftObjectId: string }
): NftSpendPolicyEntry {
  const id = norm(patch.nftObjectId)
  const s = readStore()
  const prev = s.byNft[id]
  const next: NftSpendPolicyEntry = {
    nftObjectId: id,
    oneTimeUse: patch.oneTimeUse ?? prev?.oneTimeUse ?? false,
    burnAfterSpend: patch.burnAfterSpend ?? prev?.burnAfterSpend ?? Boolean(patch.oneTimeUse ?? prev?.oneTimeUse),
    offlineHandoff: patch.offlineHandoff ?? prev?.offlineHandoff ?? false,
    ...(prev?.consumedAtMs != null ? { consumedAtMs: prev.consumedAtMs } : {}),
    ...(prev?.consumeDigest ? { consumeDigest: prev.consumeDigest } : {}),
    ...(prev?.burnDigest ? { burnDigest: prev.burnDigest } : {}),
    ...(patch.consumedAtMs != null ? { consumedAtMs: patch.consumedAtMs } : {}),
    ...(patch.consumeDigest ? { consumeDigest: patch.consumeDigest } : {}),
    ...(patch.burnDigest ? { burnDigest: patch.burnDigest } : {}),
    updatedAtMs: Date.now(),
  }
  s.byNft[id] = next
  writeStore(s)
  return next
}

/** Attrs aus Mint-Checkboxen — max. 2 Keys, passen in [morg-attrs]. */
export function mintModeAttrs(opts: {
  oneTimeUse?: boolean
  offlineHandoff?: boolean
}): EvidenceAttrPair[] {
  const out: EvidenceAttrPair[] = []
  if (opts.oneTimeUse) out.push({ key: SPEND_POLICY_ATTR_KEY, value: SPEND_POLICY_ONE_TIME })
  if (opts.offlineHandoff) out.push({ key: OFFLINE_HANDOFF_ATTR_KEY, value: '1' })
  return out
}

/** Aus on-chain Description-Attrs in lokalen Index übernehmen (ohne consumed zu löschen). */
export function syncNftSpendPolicyFromAttrs(
  nftObjectId: string,
  attrs: readonly EvidenceAttrPair[] | undefined
): NftSpendPolicyEntry | null {
  if (!attrs?.length) return getNftSpendPolicy(nftObjectId)
  let oneTime = false
  let offline = false
  for (const a of attrs) {
    const k = a.key.trim().toLowerCase()
    const v = a.value.trim().toLowerCase()
    if (k === SPEND_POLICY_ATTR_KEY && (v === SPEND_POLICY_ONE_TIME || v === '1' || v === 'true')) {
      oneTime = true
    }
    if (k === OFFLINE_HANDOFF_ATTR_KEY && (v === '1' || v === 'true' || v === 'yes')) {
      offline = true
    }
  }
  if (!oneTime && !offline) return getNftSpendPolicy(nftObjectId)
  return upsertNftSpendPolicy({
    nftObjectId,
    oneTimeUse: oneTime || Boolean(getNftSpendPolicy(nftObjectId)?.oneTimeUse),
    burnAfterSpend: oneTime ? true : undefined,
    offlineHandoff: offline || Boolean(getNftSpendPolicy(nftObjectId)?.offlineHandoff),
  })
}

export function isNftSpendCapabilityConsumed(nftObjectId: string): boolean {
  const p = getNftSpendPolicy(nftObjectId)
  return Boolean(p?.oneTimeUse && p.consumedAtMs)
}

/** Kurze Galerie-/Panel-Badges aus Policy oder on-chain Attrs. */
export function nftSpendPolicyBadgeParts(
  nftObjectId: string,
  attrs?: readonly EvidenceAttrPair[] | null
): string[] {
  const p = getNftSpendPolicy(nftObjectId)
  const parts: string[] = []
  const oneTime =
    Boolean(p?.oneTimeUse) ||
    Boolean(
      attrs?.some(
        (a) =>
          a.key.trim().toLowerCase() === SPEND_POLICY_ATTR_KEY &&
          ['one_time', '1', 'true'].includes(a.value.trim().toLowerCase())
      )
    )
  const offline =
    Boolean(p?.offlineHandoff) ||
    Boolean(
      attrs?.some(
        (a) =>
          a.key.trim().toLowerCase() === OFFLINE_HANDOFF_ATTR_KEY &&
          ['1', 'true', 'yes'].includes(a.value.trim().toLowerCase())
      )
    )
  if (oneTime) {
    parts.push(p?.consumedAtMs ? 'One-Time · verbraucht' : 'One-Time')
  }
  if (offline) parts.push('Offline-Index')
  return parts
}

export function assertNftSpendCapabilityUsable(
  nftObjectId: string
): { ok: true } | { ok: false; error: string } {
  if (!isNftSpendCapabilityConsumed(nftObjectId)) return { ok: true }
  return {
    ok: false,
    error:
      'One-Time-NFT bereits verbraucht (nach erstem Spend). Weitere Auszahlungen sind gesperrt — ggf. NFT geburnt.',
  }
}

export function markNftSpendCapabilityConsumed(input: {
  nftObjectId: string
  digest?: string
  burnDigest?: string
}): NftSpendPolicyEntry {
  const prev = getNftSpendPolicy(input.nftObjectId)
  return upsertNftSpendPolicy({
    nftObjectId: input.nftObjectId,
    oneTimeUse: true,
    burnAfterSpend: prev?.burnAfterSpend ?? true,
    offlineHandoff: prev?.offlineHandoff ?? false,
    consumedAtMs: Date.now(),
    ...(input.digest ? { consumeDigest: input.digest } : {}),
    ...(input.burnDigest ? { burnDigest: input.burnDigest } : {}),
  })
}

/** One-Time mit Burn-nach-Spend aktiv? */
export function shouldBurnNftAfterSpend(nftObjectId: string): boolean {
  const pol = getNftSpendPolicy(nftObjectId)
  return Boolean(pol?.oneTimeUse && pol.burnAfterSpend !== false)
}

/**
 * Nach erfolgreichem Spend/Withdraw: Capability entziehen + optional burn.
 * Bevorzugt: Burn schon in derselben Spend-TX (`burnAlreadyDone`).
 * Fallback: zweite TX mit Object-Refresh/Retry (stale Version nach Spend).
 */
export async function finalizeOneTimeNftAfterSuccessfulSpend(input: {
  nftObjectId: string
  spendDigest: string
  /** Burn lief bereits in der Spend-PTB mit. */
  burnAlreadyDone?: boolean
}): Promise<{ consumed: boolean; burned: boolean; burnDigest?: string; note: string }> {
  const pol = getNftSpendPolicy(input.nftObjectId)
  if (!pol?.oneTimeUse) {
    return { consumed: false, burned: false, note: '' }
  }
  let burnDigest: string | undefined
  let burned = false
  let burnNote = ''
  if (pol.burnAfterSpend !== false) {
    if (input.burnAlreadyDone) {
      burned = true
      burnDigest = input.spendDigest
      burnNote = ` NFT geburnt (gleiche TX ${input.spendDigest.slice(0, 12)}…).`
    } else {
      try {
        const { burnEvidenceImageNft } = await import('@/frontend/lib/evidence-image-transfer')
        const br = await burnEvidenceImageNft({
          objectId: input.nftObjectId,
          waitForDigest: input.spendDigest,
        })
        if (br.ok) {
          burned = true
          burnDigest = br.digest
          burnNote = ` NFT geburnt (${br.digest.slice(0, 12)}…).`
        } else {
          burnNote = ` Burn fehlgeschlagen: ${br.error} — Capability lokal entzogen.`
        }
      } catch (e) {
        burnNote = ` Burn Fehler: ${e instanceof Error ? e.message : String(e)} — Capability lokal entzogen.`
      }
    }
  } else {
    burnNote = ' Capability entzogen (NFT bleibt, Spend gesperrt).'
  }
  markNftSpendCapabilityConsumed({
    nftObjectId: input.nftObjectId,
    digest: input.spendDigest,
    burnDigest,
  })
  try {
    const { parkLocalVaultIndexForNft } = await import('@/frontend/lib/nft-vault-local-clear')
    parkLocalVaultIndexForNft(input.nftObjectId)
  } catch {
    /* optional */
  }
  return {
    consumed: true,
    burned,
    burnDigest,
    note: `One-Time: verbraucht.${burnNote}`,
  }
}
