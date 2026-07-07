'use client'

/**
 * Handoff → lokale Geräte-Konfiguration (§ H.15 B.1, Offline-APK Phase 1).
 * Kein Server-Apply — nur localStorage für Profil, Direkt-RPC und Ketten-IDs.
 */
import { isCapacitorNativePlatform } from '@/frontend/lib/capacitor-platform'
import {
  persistDirectChainFieldIds,
  persistDirectMailboxChainSnapshot,
  setDirectChainOptimisticFlagsEnabled,
  type DirectMailboxDrainFlags,
} from '@/frontend/lib/direct-iota-chain-context'
import {
  setDirectMailboxDrainEnabled,
  setIotaSubmitMode,
} from '@/frontend/lib/direct-iota-plain-submit'
import { setBrowserDirectIotaRpcUrlOverride } from '@/frontend/lib/direct-iota-rpc'
import {
  buildLocalHandoffAppliedSnapshot,
  saveLocalHandoffAppliedSnapshot,
  type LocalHandoffAppliedSnapshot,
} from '@/frontend/lib/handoff-local-apply'
import { addConnectedPeerToLocalSnapshot } from '@/frontend/lib/connected-peers-snapshot'
import { applyMessengerGroupHandoffFromEnv } from '@/frontend/lib/messenger-group-handoff'
import { readHandoffExtras } from '@/frontend/lib/handoff-extras'
import { applyTeamBroadcastKeysFromExtras } from '@/frontend/lib/handoff-team-broadcast-keys'
import { joinMyTeamMailbox } from '@/frontend/lib/my-team-mailbox-store'
import { parseTeamMailboxIdsCsv } from '@/frontend/lib/team-mailbox-server-sync'
import { isLikelyIotaHexId } from '@morgendrot/core/iota'

const LS_FLAGS = 'morgendrot.directChain.flagsJson'
export const LS_HANDOFF_ENV_BACKUP = 'morgendrot.handoff.envBackup.v1'

export function parseHandoffEnvLines(text: string): Record<string, string> {
  return parseEnv(text)
}

export function readHandoffEnvBackup(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LS_HANDOFF_ENV_BACKUP)?.trim()
    return raw || null
  } catch {
    return null
  }
}

function saveHandoffEnvBackup(envText: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LS_HANDOFF_ENV_BACKUP, envText)
  } catch {
    /* ignore */
  }
}

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 1) continue
    const k = line.slice(0, i).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

function normalizeHexId(v: string): string {
  const t = String(v || '').trim()
  if (/^0x[a-fA-F0-9]{64}$/i.test(t)) return t.toLowerCase()
  if (/^[a-fA-F0-9]{64}$/i.test(t)) return `0x${t.toLowerCase()}`
  return t
}

function parseBool(input: string | undefined): boolean | undefined {
  if (!input) return undefined
  const v = input.trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false
  return undefined
}

function pickHandoffRpcUrl(env: Record<string, string>): string | undefined {
  const direct = env.NEXT_PUBLIC_DIRECT_IOTA_RPC_URL?.trim()
  if (direct) return direct
  const rpc = env.RPC_URL?.trim()
  if (rpc && /^https?:\/\//i.test(rpc)) return rpc
  return undefined
}

function persistDrainFlagsFromEnv(env: Record<string, string>): void {
  if (typeof window === 'undefined') return
  const flags: DirectMailboxDrainFlags = {
    useMailbox: parseBool(env.USE_MAILBOX) ?? true,
    mailboxStorePlaintext: parseBool(env.MAILBOX_STORE_PLAINTEXT) ?? true,
    messengerCreditsConfigured: false,
  }
  try {
    window.localStorage.setItem(LS_FLAGS, JSON.stringify(flags))
  } catch {
    /* ignore */
  }
}

/** Ketten-Felder aus Handoff-Snapshot / .env in Direct-IOTA-Storage spiegeln. */
export function syncLocalHandoffSnapshotToChainContext(
  snapshot: LocalHandoffAppliedSnapshot,
  env?: Record<string, string>
): void {
  const packageId = normalizeHexId(snapshot.packageId?.trim() ?? '')
  const mailboxId = normalizeHexId(snapshot.mailboxId?.trim() ?? '')
  const senderFromEnv = normalizeHexId(env?.MY_ADDRESS?.trim() ?? '')
  const sender = isLikelyIotaHexId(senderFromEnv) ? senderFromEnv : ''

  persistDirectChainFieldIds({
    packageId: isLikelyIotaHexId(packageId) ? packageId : undefined,
    mailboxId: isLikelyIotaHexId(mailboxId) ? mailboxId : undefined,
    senderAddress: sender || undefined,
  })

  if (env) persistDrainFlagsFromEnv(env)

  const pkg = packageId
  const mb = mailboxId
  const addr = sender
  if (isLikelyIotaHexId(pkg) && isLikelyIotaHexId(mb) && isLikelyIotaHexId(addr)) {
    void persistDirectMailboxChainSnapshot({
      packageId: pkg,
      mailboxId: mb,
      senderAddress: addr,
      ttlDays: 30n,
      flags: {
        useMailbox: parseBool(env?.USE_MAILBOX) ?? true,
        mailboxStorePlaintext: parseBool(env?.MAILBOX_STORE_PLAINTEXT) ?? true,
        messengerCreditsConfigured: false,
      },
    })
  }
}

function enableStandaloneDirectDefaults(): void {
  setIotaSubmitMode('client')
  setDirectMailboxDrainEnabled(true)
  setDirectChainOptimisticFlagsEnabled(true)
  try {
    if (isCapacitorNativePlatform()) {
      window.localStorage.setItem('morgendrot.autarkyMode', '1')
    }
  } catch {
    /* ignore */
  }
}

function seedPartnersFromHandoffEnv(env: Record<string, string>): void {
  const add = (raw?: string) => {
    const t = String(raw || '').trim()
    if (t) addConnectedPeerToLocalSnapshot(t)
  }
  add(env.BOSS_ADDRESS)
  add(env.PARTNER_ADDRESS)
  const multi = env.PARTNER_ADDRESSES?.trim()
  if (multi) {
    for (const part of multi.split(',')) add(part)
  }
}

/** TEAM_MAILBOX_IDS aus Handoff-.env in lokalen Team-Store übernehmen. */
export function importTeamMailboxesFromHandoffEnv(env: Record<string, string>): number {
  const label = env.HANDOFF_LABEL?.trim() || undefined
  const ids = parseTeamMailboxIdsCsv(env.TEAM_MAILBOX_IDS)
  let n = 0
  for (const id of ids) {
    joinMyTeamMailbox(id, label)
    n++
  }
  return n
}

const HANDOFF_SECRET_DENY = [/mnemonic/i, /secret/i, /password/i, /private.?key/i, /seed phrase/i]

function handoffEnvTextContainsDeniedSecret(text: string): boolean {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (HANDOFF_SECRET_DENY.some((p) => p.test(trimmed))) return true
  }
  return false
}

/**
 * Handoff-.env lokal vormerken inkl. Direkt-RPC und Ketten-IDs (APK ohne Basis).
 */
export function applyHandoffEnvToLocalDevice(envText: string): LocalHandoffAppliedSnapshot {
  if (handoffEnvTextContainsDeniedSecret(envText)) {
    throw new Error('Handoff enthält verbotene Secret-Muster — nur öffentliche Keys lokal vormerken.')
  }
  const env = parseEnv(envText)
  saveHandoffEnvBackup(envText)
  const snapshot = buildLocalHandoffAppliedSnapshot(envText)
  saveLocalHandoffAppliedSnapshot(snapshot)

  const rpc = pickHandoffRpcUrl(env)
  if (rpc) setBrowserDirectIotaRpcUrlOverride(rpc)

  syncLocalHandoffSnapshotToChainContext(snapshot, env)
  seedPartnersFromHandoffEnv(env)
  importTeamMailboxesFromHandoffEnv(env)
  applyMessengerGroupHandoffFromEnv(env)
  applyTeamBroadcastKeysFromExtras(readHandoffExtras())
  enableStandaloneDirectDefaults()

  return snapshot
}
