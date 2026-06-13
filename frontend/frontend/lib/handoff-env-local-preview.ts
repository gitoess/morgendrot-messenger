import type { HandoffImportSummary } from '@/frontend/lib/api/handoff-env-import'

/** Nur oeffentliche Handoff-Keys (kein Secret-Import). */
const HANDOFF_IMPORT_ALLOWLIST = new Set([
  'RPC_URL',
  'PACKAGE_ID',
  'MAILBOX_ID',
  'USE_MAILBOX',
  'TEAM_MAILBOX_IDS',
  'COMMAND_REGISTRY_ID',
  'VAULT_REGISTRY_ID',
  'MY_ADDRESS',
  'ROLE',
  'ROLE_ID',
  'BOSS_ADDRESS',
  'PARTNER_ADDRESS',
  'PARTNER_ADDRESSES',
  'ENABLE_UI',
  'UI_VARIANT',
  'DEPLOYMENT_PROFILE',
  'TRANSPORT_PROFILE',
  'SIMPLE_MODE',
  'SIGNER',
  'NETWORK_TRUST_TIER',
  'ENABLE_PURGE',
  'DEFAULT_TTL_DAYS',
  'ENABLE_REPLAY_PROTECTION',
  'ENABLE_PLAINTEXT_CHANNEL',
  'NEXT_PUBLIC_DIRECT_IOTA_RPC_URL',
  'API_KILL_PREVIOUS_INSTANCE',
  'HANDOFF_LABEL',
  'MESSENGER_GROUP_HANDOFF',
  'ENABLE_BROADCAST_PINNWAND',
  'BROADCAST_PINNWAND_ADDRESS',
  'BROADCAST_AUTHORIZED_SENDERS',
  'EINSATZ_CHAIN_MODE',
])

const HANDOFF_VALUE_DENY = [/mnemonic/i, /secret/i, /password/i, /private.?key/i, /seed phrase/i]

function parseHandoffEnvText(text: string): { pairs: Record<string, string>; handoffLabel?: string } {
  const pairs: Record<string, string> = {}
  let handoffLabel: string | undefined
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      const labelMatch = /^#\s*Einsatz-Bezeichnung:\s*(.+)$/i.exec(line)
      if (labelMatch?.[1]?.trim()) handoffLabel = labelMatch[1].trim()
      continue
    }
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const key = line.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    pairs[key] = value
  }
  return { pairs, handoffLabel }
}

function maskAddr(addr: string): string {
  const a = addr.trim()
  if (/^0x[a-fA-F0-9]{64}$/.test(a)) return `${a.slice(0, 10)}…${a.slice(-6)}`
  return a.length > 20 ? `${a.slice(0, 12)}…` : a
}

function partnerPreview(pairs: Record<string, string>): string | undefined {
  const multi = pairs.PARTNER_ADDRESSES?.trim()
  if (multi) {
    const parts = multi.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length === 1) return maskAddr(parts[0] ?? '')
    return `${parts.length} Partner`
  }
  const single = pairs.PARTNER_ADDRESS?.trim()
  if (single) return maskAddr(single)
  return undefined
}

function denyValue(key: string, value: string): string | null {
  if (HANDOFF_VALUE_DENY.some((re) => re.test(value))) {
    return `Verdaechtiger Wert bei ${key} - Handoff enthaelt keine Secrets.`
  }
  if (value.length > 4096) return `Wert fuer ${key} zu lang.`
  return null
}

export function previewHandoffEnvImportLocal(envText: string, existingMyAddress?: string | null): {
  ok: boolean
  errors: string[]
  summary: HandoffImportSummary | null
} {
  const errors: string[] = []
  const { pairs, handoffLabel } = parseHandoffEnvText(envText)
  const keysInFile = Object.keys(pairs).length
  if (keysInFile === 0) {
    return { ok: false, errors: ['Keine KEY=VALUE-Zeilen in der Handoff-.env gefunden.'], summary: null }
  }

  const filtered: Record<string, string> = {}
  const skippedKeys: string[] = []

  for (const [key, value] of Object.entries(pairs)) {
    if (!HANDOFF_IMPORT_ALLOWLIST.has(key)) {
      skippedKeys.push(key)
      continue
    }
    const deny = denyValue(key, value)
    if (deny) errors.push(deny)
    if (key === 'MY_ADDRESS' && !value.trim() && (existingMyAddress || '').trim()) {
      skippedKeys.push('MY_ADDRESS (leer - bestehende Wallet bleibt)')
      continue
    }
    if (!value.trim() && key !== 'MY_ADDRESS') {
      skippedKeys.push(`${key} (leer)`)
      continue
    }
    filtered[key] = value.trim()
  }

  if (handoffLabel?.trim() && !filtered.HANDOFF_LABEL) filtered.HANDOFF_LABEL = handoffLabel.trim()
  if (!filtered.PACKAGE_ID?.trim()) errors.push('PACKAGE_ID fehlt oder leer - Handoff unvollstaendig.')
  if (!filtered.BOSS_ADDRESS?.trim() || !/^0x[a-fA-F0-9]{64}$/i.test(filtered.BOSS_ADDRESS)) {
    errors.push('BOSS_ADDRESS fehlt oder ist keine gueltige 0x+64-Hex-Adresse.')
  }

  const summary: HandoffImportSummary = {
    handoffLabel,
    role: filtered.ROLE,
    deploymentProfile: filtered.DEPLOYMENT_PROFILE,
    transportProfile: filtered.TRANSPORT_PROFILE,
    simpleMode: filtered.SIMPLE_MODE,
    uiVariant: filtered.UI_VARIANT,
    packageId: filtered.PACKAGE_ID ? maskAddr(filtered.PACKAGE_ID) : undefined,
    bossAddress: filtered.BOSS_ADDRESS ? maskAddr(filtered.BOSS_ADDRESS) : undefined,
    partnerPreview: partnerPreview(filtered),
    teamMailboxIds: filtered.TEAM_MAILBOX_IDS,
    mailboxId: filtered.MAILBOX_ID ? maskAddr(filtered.MAILBOX_ID) : undefined,
    rpcUrl: filtered.RPC_URL,
    keysInFile,
    keysToApply: Object.keys(filtered).length,
    skippedKeys,
    pskHint:
      'LoRa: Meshtastic-Kanal-PSK im Funk-Kanal setzen (siehe README-HANDOFF.txt) - kein Morgendrot-Mesh-v2-E2EE.',
  }

  return {
    ok: errors.length === 0 && summary.keysToApply > 0,
    errors,
    summary,
  }
}
