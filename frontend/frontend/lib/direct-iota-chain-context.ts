'use client'

/**
 * Snapshot für **Direkt-IOTA**-Mailbox-Submit (Klartext-Pfad): Package, Mailbox, Absender, TTL.
 * Wird aus `/api/status` + `/api/current-ids` befüllt (wenn Basis erreichbar) und in localStorage gespiegelt
 * für den Fall „Basis aus, RPC + Mnemonic noch da“.
 */
import type { ApiStatus } from '@/frontend/lib/api/api-status-types'
import { readNetworkProfilesState, validateNetworkProfile } from '@/frontend/lib/einsatz-network-profiles'
import { notifyDirectIotaUiChanged } from '@/frontend/lib/direct-iota-ui-events'
import { getConfiguredDirectIotaRpcUrl, setBrowserDirectIotaRpcUrlOverride } from '@/frontend/lib/direct-iota-rpc'
import { OFFLINE_CACHE_TTL_MS } from '@/frontend/lib/offline-cache-ttl'
import { isLikelyIotaHexId } from '@morgendrot/core/iota'

const LS_PKG = 'morgendrot.directChain.packageId'
const LS_MB = 'morgendrot.directChain.mailboxId'
const LS_SENDER = 'morgendrot.directChain.senderAddress'
const LS_TTL = 'morgendrot.directChain.ttlDays'
const LS_FLAGS = 'morgendrot.directChain.flagsJson'
const LS_SAVED_AT = 'morgendrot.directChain.savedAtMs'
const LS_OPTIMISTIC_FLAGS = 'morgendrot.directChain.optimisticFlags'

/** Wie Offline-Status-Cache: Snapshot älter → Hinweis, Basis/IDs aktualisieren (§ H.15 B.1). */
export const DIRECT_CHAIN_SNAPSHOT_STALE_MS = OFFLINE_CACHE_TTL_MS

export type DirectMailboxDrainFlags = {
  useMailbox: boolean
  mailboxStorePlaintext: boolean
  messengerCreditsConfigured: boolean
}

export type DirectMailboxChainSnapshot = {
  packageId: string
  mailboxId: string
  senderAddress: string
  ttlDays: bigint
  flags: DirectMailboxDrainFlags
}

let memorySnapshot: DirectMailboxChainSnapshot | null = null
let memoryFlagsOnly: DirectMailboxDrainFlags | null = null

function readFlagsFromLs(): DirectMailboxDrainFlags | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_FLAGS)?.trim()
    if (!raw) return null
    const j = JSON.parse(raw) as Record<string, unknown>
    return {
      useMailbox: j.useMailbox === true,
      mailboxStorePlaintext: j.mailboxStorePlaintext === true,
      messengerCreditsConfigured: j.messengerCreditsConfigured === true,
    }
  } catch {
    return null
  }
}

export type PersistDirectMailboxChainResult = { ok: true } | { ok: false; error: string }

export type DirectChainSnapshotMeta = {
  hasSnapshot: boolean
  savedAtMs: number | null
  ageMinutes: number | null
  stale: boolean
  /** Anzeige: Cache-Lebensdauer in Minuten (gleich Offline-Cache). */
  staleTtlMinutes: number
  /** On-chain Mailbox-TTL (Tage) aus Snapshot. */
  mailboxTtlDays: number | null
}

function touchDirectChainSavedAtMs(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_SAVED_AT, String(Date.now()))
  } catch {
    /* ignore */
  }
}

function readDirectChainSavedAtMs(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_SAVED_AT)?.trim()
    if (!raw) return null
    const n = parseInt(raw, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

/** Alter und Verfalls-Hinweis des lokalen Ketten-Snapshots (Puls § H.15 B.1). */
export function getDirectChainSnapshotMeta(nowMs: number = Date.now()): DirectChainSnapshotMeta {
  const staleTtlMinutes = Math.max(1, Math.floor(DIRECT_CHAIN_SNAPSHOT_STALE_MS / 60_000))
  const snap = getDirectMailboxChainSnapshot()
  if (!snap) {
    return {
      hasSnapshot: false,
      savedAtMs: null,
      ageMinutes: null,
      stale: true,
      staleTtlMinutes,
      mailboxTtlDays: null,
    }
  }
  const savedAtMs = readDirectChainSavedAtMs()
  const ageMinutes =
    savedAtMs != null ? Math.max(0, Math.floor((nowMs - savedAtMs) / 60_000)) : null
  const stale =
    savedAtMs == null || ageMinutes == null || nowMs - savedAtMs > DIRECT_CHAIN_SNAPSHOT_STALE_MS
  const ttlN = Number(snap.ttlDays)
  return {
    hasSnapshot: true,
    savedAtMs,
    ageMinutes,
    stale,
    staleTtlMinutes,
    mailboxTtlDays: Number.isFinite(ttlN) && ttlN > 0 ? ttlN : null,
  }
}

export function formatDirectChainSnapshotStatusLine(meta: DirectChainSnapshotMeta): string {
  if (!meta.hasSnapshot) {
    return 'Kein Ketten-Snapshot — Package/Mailbox/Absender speichern oder Basis verbinden.'
  }
  const onChain = meta.mailboxTtlDays != null ? `On-chain Mailbox-TTL: ${meta.mailboxTtlDays} Tage.` : ''
  if (meta.savedAtMs == null || meta.ageMinutes == null) {
    return `Snapshot ohne Zeitstempel — „Ketten-IDs speichern“ oder Basis verbinden. ${onChain}`.trim()
  }
  const age = `Lokal gespeichert vor ${meta.ageMinutes} Min. (Lebensdauer ${meta.staleTtlMinutes} Min.)`
  const fresh = meta.stale
    ? ' Veraltet — Basis verbinden oder IDs neu speichern.'
    : ' Für Direkt-RPC nutzbar.'
  return `${age}${fresh} ${onChain}`.trim()
}

export function persistDirectMailboxChainSnapshot(s: DirectMailboxChainSnapshot): PersistDirectMailboxChainResult {
  if (typeof window === 'undefined') return { ok: false, error: 'Kein Browser (SSR).' }
  try {
    window.localStorage.setItem(LS_PKG, s.packageId.trim())
    window.localStorage.setItem(LS_MB, s.mailboxId.trim())
    window.localStorage.setItem(LS_SENDER, s.senderAddress.trim())
    window.localStorage.setItem(LS_TTL, s.ttlDays.toString())
    window.localStorage.setItem(
      LS_FLAGS,
      JSON.stringify({
        useMailbox: s.flags.useMailbox,
        mailboxStorePlaintext: s.flags.mailboxStorePlaintext,
        messengerCreditsConfigured: s.flags.messengerCreditsConfigured,
      })
    )
    memorySnapshot = s
    touchDirectChainSavedAtMs()
    notifyDirectIotaUiChanged()
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg || 'localStorage fehlgeschlagen' }
  }
}

function defaultFlagsForPartialSnapshot(): DirectMailboxDrainFlags {
  if (isDirectChainOptimisticFlagsEnabled()) {
    return { useMailbox: true, mailboxStorePlaintext: true, messengerCreditsConfigured: false }
  }
  return (
    readFlagsFromLs() ??
    memoryFlagsOnly ?? {
      useMailbox: true,
      mailboxStorePlaintext: false,
      messengerCreditsConfigured: true,
    }
  )
}

/** Einzelne Ketten-Felder aus localStorage (auch ohne vollständigen Snapshot). */
export function getDirectChainFieldIdsFromLs(): {
  packageId: string
  mailboxId: string
  senderAddress: string
  ttlDays: bigint
} {
  if (typeof window === 'undefined') {
    return { packageId: '', mailboxId: '', senderAddress: '', ttlDays: 30n }
  }
  const packageId = window.localStorage.getItem(LS_PKG)?.trim() ?? ''
  const mailboxId = window.localStorage.getItem(LS_MB)?.trim() ?? ''
  const senderAddress = window.localStorage.getItem(LS_SENDER)?.trim() ?? ''
  const ttlRaw = window.localStorage.getItem(LS_TTL)?.trim() ?? '30'
  const ttlN = parseInt(ttlRaw, 10)
  const ttlDays = BigInt(Number.isFinite(ttlN) && ttlN > 0 && ttlN <= 3650 ? ttlN : 30)
  return { packageId, mailboxId, senderAddress, ttlDays }
}

/** Ersetzt Ketten-IDs strikt aus Netzwerk-Profil (keine verwaisten Testnet-IDs auf Mainnet). */
export function setDirectChainFieldIdsFromNetworkProfile(p: {
  packageId: string
  mailboxId: string
  senderAddress?: string
}): void {
  if (typeof window === 'undefined') return
  try {
    const pkg = (p.packageId ?? '').trim()
    const mb = (p.mailboxId ?? '').trim()
    const addr = (p.senderAddress ?? getDirectChainFieldIdsFromLs().senderAddress ?? '').trim()
    if (isLikelyIotaHexId(pkg)) window.localStorage.setItem(LS_PKG, pkg)
    else window.localStorage.removeItem(LS_PKG)
    if (isLikelyIotaHexId(mb)) window.localStorage.setItem(LS_MB, mb)
    else window.localStorage.removeItem(LS_MB)
    if (isLikelyIotaHexId(addr)) window.localStorage.setItem(LS_SENDER, addr)
    touchDirectChainSavedAtMs()
  } catch {
    /* ignore */
  }
  memorySnapshot = null
  void resolveDirectMailboxChainSnapshot()
  notifyDirectIotaUiChanged()
}

/** Einzelne Ketten-IDs in localStorage schreiben (auch ohne vollständigen Snapshot). */
export function persistDirectChainFieldIds(p: {
  packageId?: string
  mailboxId?: string
  senderAddress?: string
}): void {
  if (typeof window === 'undefined') return
  try {
    const pkg = (p.packageId ?? '').trim()
    const mb = (p.mailboxId ?? '').trim()
    const addr = (p.senderAddress ?? '').trim()
    if (isLikelyIotaHexId(pkg)) window.localStorage.setItem(LS_PKG, pkg)
    if (isLikelyIotaHexId(mb)) window.localStorage.setItem(LS_MB, mb)
    if (isLikelyIotaHexId(addr)) window.localStorage.setItem(LS_SENDER, addr)
    touchDirectChainSavedAtMs()
  } catch {
    /* ignore */
  }
  void resolveDirectMailboxChainSnapshot()
  notifyDirectIotaUiChanged()
}

/**
 * Nutzbaren Snapshot aus einzelnen LS-Feldern (ohne vollständigen API-Snapshot).
 * Für Direkt-RPC: Package + Mailbox + Absender (0x + 64 Hex).
 */
function alignDirectChainWithActiveNetworkProfile(): void {
  const state = readNetworkProfilesState()
  const profile = state[state.active]
  if (!validateNetworkProfile(profile).ok) return

  const ls = getDirectChainFieldIdsFromLs()
  const profilePkg = profile.packageId.trim().toLowerCase()
  const profileMb = profile.mailboxId.trim().toLowerCase()
  const lsPkg = ls.packageId.trim().toLowerCase()
  const lsMb = ls.mailboxId.trim().toLowerCase()
  const rpc = (getConfiguredDirectIotaRpcUrl() || '').trim().toLowerCase()
  const profileRpc = profile.rpcUrl.trim().toLowerCase()
  if (lsPkg === profilePkg && lsMb === profileMb && (rpc === profileRpc || !profileRpc)) return

  setBrowserDirectIotaRpcUrlOverride(profile.rpcUrl)
  setDirectChainFieldIdsFromNetworkProfile({
    packageId: profile.packageId,
    mailboxId: profile.mailboxId,
    senderAddress: ls.senderAddress,
  })
  if (isLikelyIotaHexId(ls.senderAddress)) {
    void persistDirectMailboxChainSnapshot({
      packageId: profile.packageId.trim(),
      mailboxId: profile.mailboxId.trim(),
      senderAddress: ls.senderAddress.trim(),
      ttlDays: ls.ttlDays,
      flags: readFlagsFromLs() ?? memoryFlagsOnly ?? defaultFlagsForPartialSnapshot(),
    })
  } else {
    memorySnapshot = null
  }
}

export function resolveDirectMailboxChainSnapshot(): DirectMailboxChainSnapshot | null {
  if (typeof window === 'undefined') return memorySnapshot

  alignDirectChainWithActiveNetworkProfile()

  const partial = getDirectChainFieldIdsFromLs()
  const packageId = partial.packageId
  const mailboxId = partial.mailboxId
  const senderAddress = partial.senderAddress
  if (!isLikelyIotaHexId(packageId) || !isLikelyIotaHexId(mailboxId) || !isLikelyIotaHexId(senderAddress)) {
    return null
  }

  const flags = readFlagsFromLs() ?? memoryFlagsOnly ?? defaultFlagsForPartialSnapshot()
  const snap: DirectMailboxChainSnapshot = {
    packageId,
    mailboxId,
    senderAddress,
    ttlDays: partial.ttlDays,
    flags,
  }
  memorySnapshot = snap
  return snap
}

export function getDirectChainIdsReadiness(): {
  ready: boolean
  missing: string[]
} {
  if (typeof window === 'undefined') {
    return { ready: false, missing: ['Browser'] }
  }
  const partial = getDirectChainFieldIdsFromLs()
  const missing: string[] = []
  if (!isLikelyIotaHexId(partial.packageId)) missing.push('Package-ID')
  if (!isLikelyIotaHexId(partial.mailboxId)) missing.push('Mailbox-ID')
  if (!isLikelyIotaHexId(partial.senderAddress)) missing.push('Absender (0x)')
  if (!getConfiguredDirectIotaRpcUrl()) missing.push('Fullnode-URL')
  return { ready: missing.length === 0, missing }
}

export function loadDirectMailboxChainSnapshotFromLs(): DirectMailboxChainSnapshot | null {
  try {
    return resolveDirectMailboxChainSnapshot()
  } catch {
    return null
  }
}

export function getDirectMailboxChainSnapshot(): DirectMailboxChainSnapshot | null {
  return resolveDirectMailboxChainSnapshot()
}

export function syncDirectMailboxFlagsFromApiStatus(status: ApiStatus): void {
  const state = readNetworkProfilesState()
  const mainnetProfileReady =
    state.active === 'mainnet' && validateNetworkProfile(state.mainnet).ok

  memoryFlagsOnly = mainnetProfileReady
    ? {
        useMailbox: true,
        mailboxStorePlaintext: true,
        messengerCreditsConfigured: false,
      }
    : {
        useMailbox: status.useMailbox === true,
        mailboxStorePlaintext: status.mailboxStorePlaintext === true,
        messengerCreditsConfigured: status.messengerCreditsConfigured === true,
      }

  if (memorySnapshot) {
    memorySnapshot = { ...memorySnapshot, flags: memoryFlagsOnly }
  }
  if (typeof window !== 'undefined') {
    try {
      const nextFlags = JSON.stringify(memoryFlagsOnly)
      const prevFlags = window.localStorage.getItem(LS_FLAGS)
      if (prevFlags !== nextFlags) {
        window.localStorage.setItem(LS_FLAGS, nextFlags)
        notifyDirectIotaUiChanged()
      }
    } catch {
      /* ignore */
    }
  }
}

export function applyDirectMailboxChainSnapshotFromNetworkIds(j: {
  packageId?: string
  mailboxId?: string
  myAddress?: string
}): void {
  const packageId = (j.packageId || '').trim()
  const mailboxId = (j.mailboxId || '').trim()
  const senderAddress = (j.myAddress || '').trim()
  if (!isLikelyIotaHexId(packageId) || !isLikelyIotaHexId(mailboxId) || !isLikelyIotaHexId(senderAddress)) return
  const flags = memoryFlagsOnly ?? readFlagsFromLs() ?? {
    useMailbox: true,
    mailboxStorePlaintext: true,
    messengerCreditsConfigured: false,
  }
  const ttlDays = memorySnapshot?.ttlDays ?? BigInt(30)
  void persistDirectMailboxChainSnapshot({ packageId, mailboxId, senderAddress, ttlDays, flags })
}

export function canUseDirectPlaintextMailboxDrain(): boolean {
  const s = getDirectMailboxChainSnapshot()
  if (!s) return false
  if (isDirectChainOptimisticFlagsEnabled()) return true
  if (!s.flags.useMailbox || !s.flags.mailboxStorePlaintext) return false
  if (s.flags.messengerCreditsConfigured) return false
  return true
}

/** `store_encrypted_message` ohne Credits — Mailbox an, keine Messenger-Credits (Credits-Pfad = separates PTB). */
export function canUseDirectEncryptedMailboxDrain(): boolean {
  const s = getDirectMailboxChainSnapshot()
  if (!s) return false
  if (isDirectChainOptimisticFlagsEnabled()) return true
  if (!s.flags.useMailbox) return false
  if (s.flags.messengerCreditsConfigured) return false
  return true
}

/** H.15/H.6e: lokaler Autarkie-Schalter für Direct-RPC ohne frische `/api/status`-Flags. */
export function isDirectChainOptimisticFlagsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(LS_OPTIMISTIC_FLAGS) === '1'
  } catch {
    return false
  }
}

export function setDirectChainOptimisticFlagsEnabled(on: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (on) window.localStorage.setItem(LS_OPTIMISTIC_FLAGS, '1')
    else window.localStorage.removeItem(LS_OPTIMISTIC_FLAGS)
    notifyDirectIotaUiChanged()
  } catch {
    /* ignore */
  }
}

/** § H.32b — lokale Ketten-IDs des abgeschlossenen Einsatzes entfernen (ohne Wallet/Chain). */
export function clearDirectMailboxChainSnapshot(): void {
  memorySnapshot = null
  memoryFlagsOnly = null
  if (typeof window === 'undefined') return
  try {
    for (const k of [LS_PKG, LS_MB, LS_SENDER, LS_TTL, LS_FLAGS, LS_SAVED_AT, LS_OPTIMISTIC_FLAGS]) {
      window.localStorage.removeItem(k)
    }
    notifyDirectIotaUiChanged()
  } catch {
    /* ignore */
  }
}

export function persistDirectMailboxTtlDays(ttlDays: bigint): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_TTL, ttlDays.toString())
    if (memorySnapshot) memorySnapshot = { ...memorySnapshot, ttlDays }
    if (getDirectMailboxChainSnapshot()) touchDirectChainSavedAtMs()
  } catch {
    /* ignore */
  }
}
