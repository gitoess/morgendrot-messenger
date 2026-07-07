'use client'

/**
 * Command- / Vault-Registry lokal (Boss-APK offline, Weg A Scheibe 4).
 * @see docs/BOSS-APK-HANDOFF-EXPORT-CHECKLIST.md
 */
const LS_CMD = 'morgendrot.directChain.commandRegistryId'
const LS_VAULT = 'morgendrot.directChain.vaultRegistryId'

const HEX64 = /^0x[a-fA-F0-9]{64}$/i

export type BossChainRegistryIds = {
  commandRegistryId: string
  vaultRegistryId: string
}

function normId(raw: string | undefined): string {
  const id = String(raw ?? '').trim().toLowerCase()
  return HEX64.test(id) ? id : ''
}

export function readBossChainRegistryIds(): BossChainRegistryIds {
  if (typeof window === 'undefined') {
    return { commandRegistryId: '', vaultRegistryId: '' }
  }
  try {
    return {
      commandRegistryId: normId(window.localStorage.getItem(LS_CMD) ?? ''),
      vaultRegistryId: normId(window.localStorage.getItem(LS_VAULT) ?? ''),
    }
  } catch {
    return { commandRegistryId: '', vaultRegistryId: '' }
  }
}

/** Schreibt gültige Registry-IDs; leere Werte werden nicht gelöscht (nur Überschreiben wenn gültig). */
export function persistBossChainRegistryIds(p: {
  commandRegistryId?: string
  vaultRegistryId?: string
}): void {
  if (typeof window === 'undefined') return
  try {
    const cr = normId(p.commandRegistryId)
    const vr = normId(p.vaultRegistryId)
    if (cr) window.localStorage.setItem(LS_CMD, cr)
    if (vr) window.localStorage.setItem(LS_VAULT, vr)
  } catch {
    /* ignore */
  }
}

export function syncBossChainRegistryIdsFromEinsatzConfig(
  cfg?: { commandRegistryId?: string; vaultRegistryId?: string } | null
): void {
  if (!cfg) return
  persistBossChainRegistryIds({
    commandRegistryId: cfg.commandRegistryId,
    vaultRegistryId: cfg.vaultRegistryId,
  })
}
