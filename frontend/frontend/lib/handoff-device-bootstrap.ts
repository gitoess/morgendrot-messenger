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
import { isLikelyIotaHexId } from '@morgendrot/core/iota'

const LS_FLAGS = 'morgendrot.directChain.flagsJson'

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
  const packageId = snapshot.packageId?.trim() ?? ''
  const mailboxId = snapshot.mailboxId?.trim() ?? ''
  const senderFromEnv = env?.MY_ADDRESS?.trim() ?? ''
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

/**
 * Handoff-.env lokal vormerken inkl. Direkt-RPC und Ketten-IDs (APK ohne Basis).
 */
export function applyHandoffEnvToLocalDevice(envText: string): LocalHandoffAppliedSnapshot {
  const env = parseEnv(envText)
  const snapshot = buildLocalHandoffAppliedSnapshot(envText)
  saveLocalHandoffAppliedSnapshot(snapshot)

  const rpc = pickHandoffRpcUrl(env)
  if (rpc) setBrowserDirectIotaRpcUrlOverride(rpc)

  syncLocalHandoffSnapshotToChainContext(snapshot, env)
  enableStandaloneDirectDefaults()

  return snapshot
}
