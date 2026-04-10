import type { ApiResponse, KeyData, TicketData, DeviceStatus } from './types'
import { executeCommand } from '@/frontend/lib/api/execute-command'
import { fetchStatus, unlockBackend } from '@/frontend/lib/api/status'

export { executeCommand }

export type { HierarchyPermissions, VaultStatus, ApiStatus } from '@/frontend/lib/api/status'
export { fetchStatus, unlockBackend }

// Chat commands
export const sendMessage = (recipient: string, message: string, encrypted = true) =>
  executeCommand(encrypted ? '/send' : '/send-plain', encrypted ? [message] : [recipient, message])

/** Verschlüsseltes /send mit Timeout (Standard 120s – Chain/RPC kann langsam sein). */
export function sendEncryptedMessageWithTimeout(message: string, timeoutMs = 120_000) {
  return executeCommand('/send', [message], { timeoutMs })
}

/** Nachricht aus Mailbox purgen (Storage-Rebate). Mit /connect: /purge-msg &lt;nonce&gt; [sender]. */
export function purgeMailboxMessage(nonce: string, senderAddress?: string) {
  const args = senderAddress?.trim() ? [nonce, senderAddress.trim()] : [nonce]
  return executeCommand('/purge-msg', args)
}

export type { MeshV2Wire } from '@/frontend/lib/api/mesh-morg-pkg'
export { meshBuildV2Wires, meshDecryptV2Wire, morgPkgExport, morgPkgImport } from '@/frontend/lib/api/mesh-morg-pkg'

export { fetchInbox, fetchAllInboxMessagesForExport } from '@/frontend/lib/api/inbox'

export { fetchPackageIdHistory } from '@/frontend/lib/api/package-id-history'

/** Package-ID in `.morgendrot-package-id` schreiben (wie Terminal `/set-package-id`). */
export const setPackageIdCommand = (packageId0x: string) =>
  executeCommand('/set-package-id', [packageId0x.trim()])

export const startHandshake = (partner: string) =>
  executeCommand('/handshake', [partner])

export const connect = (address?: string) =>
  executeCommand('/connect', address ? [address] : [])

// Key commands
export const createKey = (lockAddress: string, recipient: string, ttl?: number) =>
  executeCommand('/create-key', ttl ? [lockAddress, recipient, ttl] : [lockAddress, recipient])

export const createKeys = (lockAddress: string, recipient: string, count: number, ttl?: number) =>
  executeCommand('/create-keys', ttl ? [lockAddress, recipient, count, ttl] : [lockAddress, recipient, count])

export const transferKey = (keyId: string, newOwner: string) =>
  executeCommand('/transfer-key', [keyId, newOwner])

export const purgeKey = (keyId: string) =>
  executeCommand('/purge-key', [keyId])

export async function listKeys(): Promise<ApiResponse<KeyData[]>> {
  const res = await executeCommand<KeyData[]>('/list-keys', [])
  const raw = (res as { keys?: Array<{ objectId?: string; lockId?: string; expiresAtMs?: number }> }).keys
    ?? (res as { data?: Array<{ objectId?: string; id?: string; lockId?: string; lockAddress?: string; expiresAtMs?: number; validUntil?: number }> }).data
  if (res.ok && Array.isArray(raw)) {
    return {
      ...res,
      data: raw.map((k) => ({
        id: (k as { objectId?: string; id?: string }).objectId ?? (k as { id?: string }).id ?? (k as { lockId?: string }).lockId ?? '',
        lockAddress: (k as { lockId?: string }).lockId ?? (k as { lockAddress?: string }).lockAddress,
        validUntil: (k as { expiresAtMs?: number }).expiresAtMs ?? (k as { validUntil?: number }).validUntil,
      })),
    }
  }
  return res
}

// Ticket commands
export const createTicket = (eventId: string, validFrom: number, validUntil: number, recipient: string, metadata?: string) =>
  executeCommand('/create-ticket', metadata ? [eventId, validFrom, validUntil, metadata, recipient] : [eventId, validFrom, validUntil, '', recipient])

/** Mehrere Tickets in einer TX (PTB) an denselben Empfänger. Max 50. */
export const createTickets = (
  eventId: string,
  validFrom: number,
  validUntil: number,
  recipient: string,
  count: number,
  metadata?: string
) =>
  executeCommand('/create-tickets', metadata
    ? [eventId, validFrom, validUntil, metadata, recipient, count]
    : [eventId, validFrom, validUntil, '', recipient, count])

export const useTicket = (ticketId: string, eventId: string) =>
  executeCommand('/use-ticket', [ticketId, eventId])

export const transferTicket = (ticketId: string, newOwner: string) =>
  executeCommand('/transfer-ticket', [ticketId, newOwner])

export const purgeTicket = (ticketId: string) =>
  executeCommand('/purge-ticket', [ticketId])

export async function listTickets(): Promise<ApiResponse<TicketData[]>> {
  const res = await executeCommand<TicketData[]>('/list-tickets', [])
  const raw = (res as { tickets?: unknown[] }).tickets ?? (res as { data?: unknown[] }).data
  if (res.ok && Array.isArray(raw)) {
    return {
      ...res,
      data: raw.map((t) => {
        const x = t as Record<string, unknown>
        return {
          id: String(x.objectId ?? x.id ?? ''),
          eventId: x.eventId as string | undefined,
          validFrom: Number(x.validFromMs ?? x.validFrom ?? 0),
          validUntil: Number(x.validUntilMs ?? x.validUntil ?? 0),
          used: Boolean(x.used),
        }
      }),
    }
  }
  return res
}

// Monitor commands
export const getDeviceStatus = () =>
  executeCommand<DeviceStatus[]>('/device-status', [])

export type { AuditEvent } from '@/frontend/lib/api/monitor-audit'
export { fetchMonitorStatus, fetchAuditEvents } from '@/frontend/lib/api/monitor-audit'

export const sendHeartbeat = () =>
  executeCommand('/heartbeat', [])

export const setHeartbeatInterval = (ms: number) =>
  executeCommand('/set-heartbeat-interval', [ms])

export const setHeartbeatEnabled = (enabled: boolean) =>
  executeCommand('/set-heartbeat-enabled', [enabled ? 'true' : 'false'])

export type { PersonalSecretEntry } from '@/frontend/lib/api/vault-personal-secrets'
export { fetchVaultPersonalSecrets, saveVaultPersonalSecrets } from '@/frontend/lib/api/vault-personal-secrets'

export {
  vaultSave,
  vaultLoad,
  vaultListLocalFiles,
  vaultLoadFromChain,
  vaultOnchain,
  emergencyPurge,
  vaultLockCommand,
} from '@/frontend/lib/api/vault-commands'

export {
  compactImageEncode,
  loraProgressiveEncode,
  loraProgressiveFuse,
  messengerAudioToOpus,
} from '@/frontend/lib/api/media'

export { clearLocalHistory } from '@/frontend/lib/api/clear-local-history'
export type { ShadowSweepApiResult } from '@/frontend/lib/api/shadow-sweep'
export { postShadowSweep } from '@/frontend/lib/api/shadow-sweep'

// Boss commands
export const setBossRole = (address: string, role: 'boss' | 'commander' | 'worker') =>
  executeCommand('/set-role', [address, role])

export const sendBossCommand = (targets: string[], command: string) =>
  executeCommand('/boss-command', [JSON.stringify(targets), command])

// Transfer
export const transferCoins = (recipient: string, amount: number) =>
  executeCommand('/transfer-coins', [recipient, amount])

export { fetchHelp } from '@/frontend/lib/api/help'
export { restartBackend } from '@/frontend/lib/api/backend-restart'

// Status (für Dashboard: nutze fetchStatus(); getStatus bleibt für Kompatibilität)
export const getStatus = (): Promise<
  ApiResponse<{
    network: string
    address: string
    packageId: string
    /** Backend-Prozess erreichbar (GET /api/status). */
    backendOnline: boolean
    /** Messenger-Peer (/connect) — nicht dasselbe wie Backend. */
    chatConnected: boolean
    /** IOTA-Signatur-Backend: cli | sdk | remote — siehe `docs/RECOVERY-PHRASE-BACKUP.md`. */
    signer?: string
    /** Lokale Vault-Datei vorhanden (GET /api/status → vaultStatus.hasLocal). */
    vaultHasLocal?: boolean
  }>
> =>
  fetchStatus().then((s) => ({
    ok: !!s.backendRunning,
    data: {
      network: s.rpcUrlLabel || s.network || '—',
      address: s.myAddress || '',
      packageId: s.packageId || '',
      backendOnline: !!s.backendRunning,
      chatConnected: !!s.connected,
      signer: s.signer,
      vaultHasLocal: s.vaultStatus?.hasLocal,
    },
    ...(s.locked && { locked: true }),
  }))

/** Nur SIGNER=sdk + lokale Vault mit gespeichertem Import. Passwort = Vault-Passwort (erneute Eingabe). */
export async function revealVaultSignerImport(password: string): Promise<{
  ok: boolean
  signerImport?: string
  message?: string
  error?: string
}> {
  const r = await executeCommand<{ signerImport?: string }>('/vault-show-signer-import', [password])
  const raw = r as { ok?: boolean; signerImport?: string; message?: string; error?: string }
  return {
    ok: raw.ok === true,
    signerImport: typeof raw.signerImport === 'string' ? raw.signerImport : undefined,
    message: typeof raw.message === 'string' ? raw.message : undefined,
    error: raw.error ?? (raw.ok === false && typeof raw.message === 'string' ? raw.message : undefined),
  }
}

export type { ContactMeshEntryClient } from '@/frontend/lib/api/contacts'
export {
  applyInitialProfileProvisioning,
  fetchContactDirectory,
  saveContactEntry,
  exportContactMeshEncrypted,
  importContactMeshEncrypted,
} from '@/frontend/lib/api/contacts'
