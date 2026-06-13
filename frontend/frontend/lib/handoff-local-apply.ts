import { parseEinsatzChainMode, type EinsatzChainMode } from '@morgendrot/shared/einsatz-chain-mode'

/**
 * Lokale Handoff-Vormerkung (Client-only):
 * Ermöglicht einen minimalen Profil-Fallback, wenn die Basis beim finalen Apply nicht erreichbar ist.
 */

export type LocalHandoffAppliedSnapshot = {
  savedAtMs: number
  handoffLabel?: string
  role?: string
  deploymentProfile?: 'consumer' | 'einsatz'
  transportProfile?: 'mesh-first' | 'iota-anchored' | 'iota-full'
  uiVariant?: 'full' | 'messenger'
  simpleMode?: boolean
  packageId?: string
  mailboxId?: string
  bossAddress?: string
  /** Lagebild (Pinnwand) — automatisch aus Handoff, Helfer konfiguriert nichts. */
  broadcastPinnwandEnabled?: boolean
  broadcastPinnwandAddress?: string
  broadcastPinnwandAuthorizedSenders?: string[]
  /** § H.33 — Kettenmodus aus Handoff-.env */
  einsatzChainMode?: EinsatzChainMode
}

const LOCAL_HANDOFF_APPLIED_KEY = 'morgendrot.handoff.localApplied.v1'

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#')) {
      const labelMatch = /^#\s*Einsatz-Bezeichnung:\s*(.+)$/i.exec(line)
      if (labelMatch?.[1]?.trim() && !out.HANDOFF_LABEL) {
        out.HANDOFF_LABEL = labelMatch[1].trim()
      }
      continue
    }
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

export function buildLocalHandoffAppliedSnapshot(envText: string): LocalHandoffAppliedSnapshot {
  const env = parseEnv(envText)
  const deploymentRaw = env.DEPLOYMENT_PROFILE?.trim()
  const transportRaw = env.TRANSPORT_PROFILE?.trim()
  const uiRaw = env.UI_VARIANT?.trim()
  return {
    savedAtMs: Date.now(),
    handoffLabel: env.HANDOFF_LABEL?.trim() || undefined,
    role: env.ROLE?.trim() || undefined,
    deploymentProfile:
      deploymentRaw === 'consumer' || deploymentRaw === 'einsatz' ? deploymentRaw : undefined,
    transportProfile:
      transportRaw === 'mesh-first' || transportRaw === 'iota-anchored' || transportRaw === 'iota-full'
        ? transportRaw
        : undefined,
    uiVariant: uiRaw === 'full' || uiRaw === 'messenger' ? uiRaw : undefined,
    simpleMode: parseBool(env.SIMPLE_MODE),
    packageId: env.PACKAGE_ID?.trim() || undefined,
    mailboxId: env.MAILBOX_ID?.trim() || undefined,
    bossAddress: env.BOSS_ADDRESS?.trim() || undefined,
    broadcastPinnwandEnabled: parseBool(env.ENABLE_BROADCAST_PINNWAND),
    broadcastPinnwandAddress: env.BROADCAST_PINNWAND_ADDRESS?.trim() || undefined,
    einsatzChainMode: parseEinsatzChainMode(env.EINSATZ_CHAIN_MODE),
    broadcastPinnwandAuthorizedSenders: env.BROADCAST_AUTHORIZED_SENDERS
      ? env.BROADCAST_AUTHORIZED_SENDERS.split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined,
  }
}

export function saveLocalHandoffAppliedSnapshot(snapshot: LocalHandoffAppliedSnapshot): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LOCAL_HANDOFF_APPLIED_KEY, JSON.stringify(snapshot))
  } catch {
    // optionaler Fallback
  }
}

export function readLocalHandoffAppliedSnapshot(): LocalHandoffAppliedSnapshot | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LOCAL_HANDOFF_APPLIED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LocalHandoffAppliedSnapshot>
    const savedAtMs = Number(parsed.savedAtMs ?? 0)
    if (!Number.isFinite(savedAtMs) || savedAtMs <= 0) return null
    return {
      savedAtMs,
      handoffLabel: typeof parsed.handoffLabel === 'string' ? parsed.handoffLabel : undefined,
      role: typeof parsed.role === 'string' ? parsed.role : undefined,
      deploymentProfile:
        parsed.deploymentProfile === 'consumer' || parsed.deploymentProfile === 'einsatz'
          ? parsed.deploymentProfile
          : undefined,
      transportProfile:
        parsed.transportProfile === 'mesh-first' ||
        parsed.transportProfile === 'iota-anchored' ||
        parsed.transportProfile === 'iota-full'
          ? parsed.transportProfile
          : undefined,
      uiVariant: parsed.uiVariant === 'full' || parsed.uiVariant === 'messenger' ? parsed.uiVariant : undefined,
      simpleMode: typeof parsed.simpleMode === 'boolean' ? parsed.simpleMode : undefined,
      packageId: typeof parsed.packageId === 'string' ? parsed.packageId : undefined,
      mailboxId: typeof parsed.mailboxId === 'string' ? parsed.mailboxId : undefined,
      bossAddress: typeof parsed.bossAddress === 'string' ? parsed.bossAddress : undefined,
      broadcastPinnwandEnabled:
        typeof parsed.broadcastPinnwandEnabled === 'boolean' ? parsed.broadcastPinnwandEnabled : undefined,
      broadcastPinnwandAddress:
        typeof parsed.broadcastPinnwandAddress === 'string' ? parsed.broadcastPinnwandAddress : undefined,
      broadcastPinnwandAuthorizedSenders: Array.isArray(parsed.broadcastPinnwandAuthorizedSenders)
        ? parsed.broadcastPinnwandAuthorizedSenders.filter((v): v is string => typeof v === 'string')
        : undefined,
      einsatzChainMode: parseEinsatzChainMode(
        typeof parsed.einsatzChainMode === 'string' ? parsed.einsatzChainMode : undefined
      ),
    }
  } catch {
    return null
  }
}

export function clearLocalHandoffAppliedSnapshot(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LOCAL_HANDOFF_APPLIED_KEY)
  } catch {
    // ignore
  }
}
