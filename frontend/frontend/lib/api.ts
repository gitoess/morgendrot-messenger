import type { ApiResponse, Message, KeyData, TicketData, DeviceStatus } from './types'
import {
  mapInboxApiRowsToMessages,
  pickInboxRawMessages,
  type InboxApiRow,
} from '@/frontend/lib/inbox-map-messages'
import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseApiJsonEnvelope, parseJsonObjectRecord } from '@/frontend/lib/api-response-guard'
import {
  parseOkEnvelopePassthrough,
  parseSimpleOkEnvelopeText,
} from '@/frontend/lib/api-simple-ok-envelope'
import { parseUnlockBackendEnvelopeText } from '@/frontend/lib/api-unlock-envelope'

/** Explizit setzen, wenn kein Next-Rewrite (z. B. statischer Export). Sonst leer = gleiche Origin + `rewrites` in next.config.mjs. */
function resolveApiBase(): string {
  const explicit = (process.env.NEXT_PUBLIC_API_BASE || '').trim().replace(/\/$/, '')
  if (explicit) return explicit
  if (typeof window !== 'undefined') return ''
  return 'http://127.0.0.1:3342'
}

const API_BASE = resolveApiBase()

export async function executeCommand<T = unknown>(
  command: string,
  args: (string | number)[] = [],
  opts?: { timeoutMs?: number; signal?: AbortSignal; morgPkg?: unknown }
): Promise<ApiResponse<T>> {
  try {
    const signal =
      opts?.signal ?? (opts?.timeoutMs != null ? AbortSignal.timeout(opts.timeoutMs) : undefined)
    const body: Record<string, unknown> = { cmd: command, args: args.map(String) }
    if (opts?.morgPkg != null && typeof opts.morgPkg === 'object') body.morgPkg = opts.morgPkg
    const fr = await fetchApiText(API_BASE, '/api/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    if (!fr.ok) {
      return { ok: false, error: fr.error } as ApiResponse<T>
    }
    const envelope = parseApiJsonEnvelope(fr.text)
    if (!envelope.ok) {
      return {
        ok: false,
        error:
          envelope.error === 'invalid_json'
            ? 'Antwort vom Backend ist kein gültiges JSON.'
            : 'Unerwartetes Antwortformat (API).',
      } as ApiResponse<T>
    }
    const data = envelope.data as ApiResponse<T>
    if (data && typeof data === 'object' && data.ok === false) {
      const msg = data.message
      if (!data.error && typeof msg === 'string' && msg.length > 0) {
        return { ...data, error: msg }
      }
    }
    return data
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

/** Rechte aus getHierarchyPermissions (nur bei role boss/kommandant/arbeiter). */
export type HierarchyPermissions = {
  commandDown?: boolean
  keyIssue?: boolean
  revokeDown?: boolean
  statusReadDown?: boolean
  statusReadUp?: boolean
  configChange?: boolean
  hierarchyChange?: boolean
}

/** Tresor-Status aus GET /api/status (Punkt 5 Marktreife: Listen-Ansicht + Sync-Status). */
export type VaultStatus = {
  hasLocal: boolean
  lastSavedToChainAt?: number
}

/** Backend-Status (GET /api/status): backendRunning, locked, connected, role, roleId, vaultStatus, … */
export type ApiStatus = {
  backendRunning?: boolean
  locked?: boolean
  connected?: boolean
  hasKeys?: boolean
  network?: string
  myAddress?: string
  role?: string
  roleId?: number
  permissions?: HierarchyPermissions
  vaultStatus?: VaultStatus
  plaintextMode?: boolean
  useMailbox?: boolean
  mailboxConfigured?: boolean
  mailboxStorePlaintext?: boolean
  messengerEdition?: 'standalone' | 'sales'
  messengerCreditsConfigured?: boolean
  messengerCredits?: { balance: string; maxBalance: string } | null
  messengerCreditsFetchFailed?: boolean
  configHints?: string[]
  rpcUrlLabel?: string
  packageId?: string
  /** Gebundener API-Port (nach Port-Kollision). */
  apiListenPort?: number
  /** Next.js-UI (.env UI_PORT) – Sendepfad Online/Funk nur dort. */
  dashboardPort?: number
  /** Backend unterstützt POST /api/compact-image-encode. */
  compactImageEncode?: boolean
  /** Backend unterstützt POST /api/lora-progressive-encode (Mesh / zweiphasig). */
  loraProgressiveEncode?: boolean
  /** cli | sdk | remote – für Entsperr-Dialog (z. B. Mnemonic-Zusatzfeld). */
  signer?: string
  /** full = Kacheln wie Dashboard; messenger = schlanker Messenger-Modus (Lite-UI). */
  uiVariant?: 'full' | 'messenger'
  /** false: API-Port liefert keine statische ui/index.html. */
  serveLiteUiStatic?: boolean
  /** Backend nutzt SOCKS5 für IOTA-RPC (z. B. Tor). */
  rpcSocksProxyActive?: boolean
  /** Backend nutzt HTTP(S)-Proxy für RPC. */
  rpcHttpProxyActive?: boolean
  /** Nach /connect: verbundene Partner-Adressen (Handshake). */
  connectedAddresses?: string[]
  partnerCount?: number
  /** Streams-Kanal für Heartbeat/Puls (GET /api/status). */
  streams?: { active: boolean; anchorId?: string; anchorIdFull?: string }
  /** Konfiguration Heartbeat (ENABLE_HEARTBEAT, Intervall) – Senden braucht S-Bit, siehe UI. */
  heartbeat?: {
    enabled: boolean
    intervalMs: number
    streamsReady: boolean
    /** Feste Minuten-Presets (Server): 1, 5, 15, 30, 60. */
    presetsMinutes?: number[]
    /** false: .env-Intervall passt zu keinem Preset – in der UI ein Preset wählen. */
    intervalMatchesPreset?: boolean
  }
  /** Volle eigene IOTA-Adresse (Explorer) – nur vertrauenswürdiges UI; myAddress bleibt maskiert. */
  myAddressFull?: string
}

export async function fetchStatus(): Promise<ApiStatus & { error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/status')
    if (!fr.ok) {
      return {
        backendRunning: false,
        connected: false,
        error: fr.error,
      }
    }
    const p = parseJsonObjectRecord(fr.text)
    if (!p.ok) {
      return {
        backendRunning: false,
        connected: false,
        error:
          p.error === 'invalid_json'
            ? 'Antwort vom Backend ist kein gültiges JSON.'
            : 'Unerwartetes Antwortformat (API).',
      }
    }
    const data = p.data as ApiStatus & { backendRunning?: boolean }
    return { ...data, backendRunning: data.backendRunning !== false }
  } catch (error) {
    return {
      backendRunning: false,
      connected: false,
      error: formatFetchFailureMessage(error),
    }
  }
}

export async function unlockBackend(
  password: string,
  opts?: { sdkSignerImport?: string }
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body: Record<string, string> = { password }
    const extra = (opts?.sdkSignerImport ?? '').trim()
    if (extra) body.sdkSignerImport = extra
    const fr = await fetchApiText(API_BASE, '/api/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    return parseUnlockBackendEnvelopeText(fr.text)
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

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

export type MeshV2Wire = { recipient: string; wireBase64: string; meshNonce: number }

export async function meshBuildV2Wires(message: string): Promise<{
  ok: boolean
  wires?: MeshV2Wire[]
  error?: string
  message?: string
}> {
  const r = await executeCommand<{
    ok?: boolean
    wires?: MeshV2Wire[]
    message?: string
    error?: string
  }>('/mesh-build-v2', [message])
  const rec = r as { ok?: boolean; wires?: MeshV2Wire[]; message?: string; error?: string }
  return {
    ok: rec.ok === true,
    wires: rec.wires,
    error: rec.error,
    message: rec.message,
  }
}

export async function meshDecryptV2Wire(
  senderAddress: string,
  wireBase64: string
): Promise<{ ok: boolean; text?: string; error?: string }> {
  const r = await executeCommand<{ ok?: boolean; text?: string; message?: string; error?: string }>(
    '/mesh-decrypt-v2',
    [senderAddress, wireBase64]
  )
  const rec = r as { ok?: boolean; text?: string; message?: string; error?: string }
  const text = typeof rec.text === 'string' ? rec.text : typeof rec.message === 'string' ? rec.message : undefined
  return {
    ok: rec.ok === true && !!text,
    text,
    error: rec.error,
  }
}

/** Sneakernet: ECDH + AES-GCM wie /send; Empfänger muss in peerMap (nach Handshake). */
const MORG_PKG_COMMAND_TIMEOUT_MS = 180_000

export async function morgPkgExport(
  recipient0x: string,
  plaintext: string
): Promise<{ ok: boolean; morgPkg?: Record<string, unknown>; message?: string; error?: string }> {
  const r = await executeCommand('/morg-pkg-export', [recipient0x, plaintext], {
    timeoutMs: MORG_PKG_COMMAND_TIMEOUT_MS,
  })
  const rec = r as { ok?: boolean; morgPkg?: Record<string, unknown>; message?: string; error?: string }
  return {
    ok: rec.ok === true,
    morgPkg: rec.morgPkg,
    message: rec.message,
    error: rec.error,
  }
}

export async function morgPkgImport(pkg: Record<string, unknown>): Promise<{
  ok: boolean
  plaintext?: string
  message?: string
  error?: string
}> {
  const r = await executeCommand('/morg-pkg-import', [], {
    morgPkg: pkg,
    timeoutMs: MORG_PKG_COMMAND_TIMEOUT_MS,
  })
  const rec = r as { ok?: boolean; plaintext?: string; text?: string; message?: string; error?: string }
  const plaintext =
    typeof rec.plaintext === 'string'
      ? rec.plaintext
      : typeof rec.text === 'string'
        ? rec.text
        : undefined
  return { ok: rec.ok === true && !!plaintext, plaintext, message: rec.message, error: rec.error }
}

/** limit, optional senderFilter (0x…), optional packageId, optional bossView, optional offset (ältere Seiten). */
export const fetchInbox = (
  limit = 20,
  senderFilter?: string,
  packageId?: string,
  bossView?: boolean,
  offset = 0
) =>
  executeCommand<Message[]>('/inbox', bossView
    ? [String(limit), senderFilter ?? '', packageId ?? '', 'boss', '', String(offset)]
    : [String(limit), senderFilter ?? '', packageId ?? '', '', '', String(offset)])

/** Alle Posteingangs-Nachrichten (paginiert bis leer) – für Exporte, unabhängig von der aktuell geladenen UI-Seite. */
export async function fetchAllInboxMessagesForExport(p: {
  packageId?: string
  bossView: boolean
  role: string
  pageSize?: number
}): Promise<Message[]> {
  const pageSize = Math.min(500, Math.max(1, p.pageSize ?? 100))
  const useBoss = p.role === 'boss' && p.bossView
  let offset = 0
  const all: InboxApiRow[] = []
  for (;;) {
    const res = await fetchInbox(pageSize, undefined, p.packageId, useBoss, offset)
    const raw = pickInboxRawMessages(res as { data?: unknown; messages?: unknown })
    if (!res.ok || raw == null || raw.length === 0) break
    all.push(...(raw as InboxApiRow[]))
    if (raw.length < pageSize) break
    offset += raw.length
  }
  return mapInboxApiRowsToMessages(all)
}

/** GET /api/package-id-history – aktuelle ID, Verlauf, optional von der Chain entdeckte Package-IDs. */
export async function fetchPackageIdHistory(): Promise<{
  ok: boolean
  current?: string
  history?: string[]
  discovered?: string[]
  hints?: Record<string, unknown>
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/package-id-history')
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Package-ID-Verlauf nicht lesbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return {
      ok: true,
      current: typeof b.current === 'string' ? b.current : '',
      history: Array.isArray(b.history) ? (b.history as string[]) : [],
      discovered: Array.isArray(b.discovered) ? (b.discovered as string[]) : [],
      hints: b.hints && typeof b.hints === 'object' && !Array.isArray(b.hints) ? (b.hints as Record<string, unknown>) : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

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

/** Geräte-Status für Radar (GET /api/monitor-status). Boss/Kommandant: alle Worker mit letztem Heartbeat. */
export async function fetchMonitorStatus(): Promise<{ ok: boolean; devices?: Array<{ device: string; lastSeen: number; status: string }>; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/monitor-status')
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Monitor-Status nicht lesbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return { ok: true, devices: Array.isArray(b.devices) ? (b.devices as Array<{ device: string; lastSeen: number; status: string }>) : undefined }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

/** Audit-Events für Timeline/Radar (GET /api/audit-events). */
export type AuditEvent = { ts: number; type: string; device?: string; message?: string; [key: string]: unknown }

export async function fetchAuditEvents(limit = 100): Promise<{ ok: boolean; events?: AuditEvent[]; error?: string }> {
  try {
    const fr = await fetchApiText(
      API_BASE,
      `/api/audit-events?limit=${Math.max(1, Math.min(500, limit))}`
    )
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Audit-Events nicht lesbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return { ok: true, events: Array.isArray(b.events) ? (b.events as AuditEvent[]) : [] }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

export const sendHeartbeat = () =>
  executeCommand('/heartbeat', [])

export const setHeartbeatInterval = (ms: number) =>
  executeCommand('/set-heartbeat-interval', [ms])

export const setHeartbeatEnabled = (enabled: boolean) =>
  executeCommand('/set-heartbeat-enabled', [enabled ? 'true' : 'false'])

/** Strukturierte Geheimnisse im Vault-Payload (AES-GCM wie Messaging-Keys). */
export type PersonalSecretEntry = {
  id: string
  title: string
  username?: string
  secret?: string
  note?: string
  updatedAt?: number
}

export async function fetchVaultPersonalSecrets(): Promise<{
  ok: boolean
  unlocked?: boolean
  entries?: PersonalSecretEntry[]
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/vault-personal-secrets')
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Safe-API nicht lesbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return {
      ok: true,
      unlocked: b.unlocked === true,
      entries: Array.isArray(b.entries) ? (b.entries as PersonalSecretEntry[]) : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

export async function saveVaultPersonalSecrets(
  entries: PersonalSecretEntry[],
  persistLocal: boolean
): Promise<{ ok: boolean; message?: string; error?: string; entries?: PersonalSecretEntry[] }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/vault-personal-secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries, persistLocal }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Safe speichern fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return {
      ok: true,
      message: typeof b.message === 'string' ? b.message : undefined,
      error: typeof b.error === 'string' ? b.error : undefined,
      entries: Array.isArray(b.entries) ? (b.entries as PersonalSecretEntry[]) : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

// Vault commands (notes = eigene Texte/Notizen, werden mitverschlüsselt)
export const vaultSave = (password?: string, notes?: string) =>
  executeCommand('/vault-save', password ? [password, notes ?? ''] : [])

/** Antwort flach wie vom Backend (nicht unter `data`). */
export async function vaultLoad(password?: string): Promise<{
  ok: boolean
  message?: string
  notes?: string
  personalSecrets?: PersonalSecretEntry[]
  error?: string
}> {
  const r = await executeCommand('/vault-load', password ? [password] : [])
  return r as {
    ok: boolean
    message?: string
    notes?: string
    personalSecrets?: PersonalSecretEntry[]
    error?: string
  }
}

/** Lokale Vault-Dateien im Arbeitsverzeichnis (Server) – kein Vault-Passwort nötig. */
export async function vaultListLocalFiles(): Promise<{
  ok: boolean
  paths?: string[]
  defaultPath?: string
  message?: string
  error?: string
}> {
  const r = await executeCommand('/vault-list', [])
  return r as {
    ok: boolean
    paths?: string[]
    defaultPath?: string
    message?: string
    error?: string
  }
}

/** Vault aus VAULT_REGISTRY_ID laden (RPC + PACKAGE_ID nötig). */
export async function vaultLoadFromChain(password?: string): Promise<{
  ok: boolean
  message?: string
  notes?: string
  personalSecrets?: PersonalSecretEntry[]
  error?: string
}> {
  const r = await executeCommand('/vault-load-from-chain', password ? [password] : [])
  return r as {
    ok: boolean
    message?: string
    notes?: string
    personalSecrets?: PersonalSecretEntry[]
    error?: string
  }
}

/** Tresor verschlüsselt auf der Chain speichern (VAULT_REGISTRY_ID). Nutzt update_vault wenn bereits vorhanden. */
export const vaultOnchain = (password?: string, notes?: string) =>
  executeCommand('/vault-onchain', password ? [password, notes ?? ''] : [])

export const emergencyPurge = () =>
  executeCommand('/emergency-purge', [])

/** Luma+Chroma kompakt (Server/sharp) – braucht entsperrtes Wallet. */
export async function compactImageEncode(
  imageBase64: string,
  options?: {
    fitLuma?: boolean
    lumaQuality?: number
    targetLumaBytes?: number
    /** Netto-Blob-Limit für `MORG_COMPACT_IMG_V1` (Default: Server `MESSENGER_COMPACT_IMAGE_BLOB_MAX_BYTES`, z. B. 11800). */
    maxPlaintextBytes?: number
  }
): Promise<{
  ok: boolean
  blobBase64?: string
  lumaBytes?: number
  chromaBytes?: number
  totalBytes?: number
  sha256Hex?: string
  usedQuality?: number
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/compact-image-encode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        fitLuma: options?.fitLuma !== false,
        lumaQuality: options?.lumaQuality,
        targetLumaBytes: options?.targetLumaBytes,
        maxPlaintextBytes: options?.maxPlaintextBytes,
      }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Bildkodierung fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    if (typeof b.blobBase64 !== 'string' || !b.blobBase64.length) {
      return { ok: false, error: 'Unerwartete Encoder-Antwort (blobBase64).' }
    }
    return {
      ok: true,
      blobBase64: b.blobBase64,
      lumaBytes: typeof b.lumaBytes === 'number' ? b.lumaBytes : undefined,
      chromaBytes: typeof b.chromaBytes === 'number' ? b.chromaBytes : undefined,
      totalBytes: typeof b.totalBytes === 'number' ? b.totalBytes : undefined,
      sha256Hex: typeof b.sha256Hex === 'string' ? b.sha256Hex : undefined,
      usedQuality: typeof b.usedQuality === 'number' ? b.usedQuality : undefined,
    }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

/** Zweiphasig Luma+Chroma für Funk/Mesh (scharfes S/W + optionale Farbe) – kein IOTA-Kompaktformat. */
export async function loraProgressiveEncode(imageBase64: string): Promise<{
  ok: boolean
  messageId?: string
  lumaWire?: string
  chromaWire?: string
  lumaJpegBytes?: number
  chromaJpegBytes?: number
  lumaWireUtf8Bytes?: number
  chromaWireUtf8Bytes?: number
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/lora-progressive-encode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'LoRa-Kodierung fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    if (
      typeof b.messageId !== 'string' ||
      typeof b.lumaWire !== 'string' ||
      typeof b.chromaWire !== 'string'
    ) {
      return { ok: false, error: 'Unerwartete LoRa-Encoder-Antwort.' }
    }
    return {
      ok: true,
      messageId: b.messageId,
      lumaWire: b.lumaWire,
      chromaWire: b.chromaWire,
      lumaJpegBytes: typeof b.lumaJpegBytes === 'number' ? b.lumaJpegBytes : undefined,
      chromaJpegBytes: typeof b.chromaJpegBytes === 'number' ? b.chromaJpegBytes : undefined,
      lumaWireUtf8Bytes: typeof b.lumaWireUtf8Bytes === 'number' ? b.lumaWireUtf8Bytes : undefined,
      chromaWireUtf8Bytes: typeof b.chromaWireUtf8Bytes === 'number' ? b.chromaWireUtf8Bytes : undefined,
    }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

/** Luma+Chroma-JPEG → ein JPEG (Backend sharp `composite` blend `over`). */
export async function loraProgressiveFuse(
  lumaJpegBase64: string,
  chromaJpegBase64: string
): Promise<{ ok: boolean; fusedJpegBase64?: string; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/lora-progressive-fuse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lumaJpegBase64, chromaJpegBase64 }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'LoRa-Zusammenführung fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    if (typeof b.fusedJpegBase64 !== 'string' || !b.fusedJpegBase64.length) {
      return { ok: false, error: 'Unerwartete Fuse-Antwort.' }
    }
    return { ok: true, fusedJpegBase64: b.fusedJpegBase64 }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

/**
 * MediaRecorder-Rohblob → Ogg/Opus (ffmpeg auf dem Backend, z. B. CM4). Kein Wallet.
 */
export async function messengerAudioToOpus(
  audioBase64: string,
  mimeType: string
): Promise<{ ok: boolean; opusBase64?: string; bytes?: number; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/messenger-audio-to-opus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Audio-Transkodierung fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    if (typeof b.opusBase64 !== 'string' || !b.opusBase64.length) {
      return { ok: false, error: 'Unerwartete Opus-Antwort.' }
    }
    return {
      ok: true,
      opusBase64: b.opusBase64,
      bytes: typeof b.bytes === 'number' ? b.bytes : undefined,
    }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

/** RAM-Keys + Wallet-Passwort der Sitzung leeren; lokaler Inbox-Klartext-Cache (.inbox.enc) schreddern. */
export const vaultLockCommand = () => executeCommand('/vault-lock', [])

/**
 * Nur Server-seitiger Klartext-Inbox-Cache (Datei …vault.inbox.enc). Kein Wallet nötig.
 * UI-Liste im Browser separat leeren (setMessages([])).
 */
export async function clearLocalHistory(options?: {
  shred?: boolean
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/clear-local-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shred: options?.shred !== false }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseSimpleOkEnvelopeText(fr.text)
    if (!r.ok) return { ok: false, error: r.error }
    return { ok: true, message: r.message }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

/** Schatten-Mnemonic → neues Main-Keypair, Assets sweepen (POST /api/shadow-sweep). Braucht erreichbare Chain. */
export type ShadowSweepApiResult = {
  ok: true
  digest?: string
  shadowAddress: string
  mainAddress: string
  mainSecretKey: string
  transferredObjectCount: number
  sentMistApprox: string
  note?: string
  securityNote?: string
}

export async function postShadowSweep(
  shadowMnemonic: string
): Promise<ShadowSweepApiResult | { ok: false; error: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/shadow-sweep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shadowMnemonic: shadowMnemonic.trim() }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const { response, text } = fr
    const envelope = parseApiJsonEnvelope(text)
    if (!envelope.ok) {
      return {
        ok: false,
        error:
          envelope.error === 'invalid_json'
            ? 'Antwort vom Backend ist kein gültiges JSON.'
            : 'Unerwartetes Antwortformat (API).',
      }
    }
    const data = envelope.data as Record<string, unknown>
    if (!response.ok || data.ok === false) {
      const err =
        (typeof data.error === 'string' && data.error.length > 0 && data.error) ||
        (typeof data.message === 'string' && data.message.length > 0 && data.message) ||
        `Sweep fehlgeschlagen (${response.status}).`
      return { ok: false, error: err }
    }
    if (
      data.ok === true &&
      typeof data.mainAddress === 'string' &&
      typeof data.mainSecretKey === 'string' &&
      typeof data.shadowAddress === 'string'
    ) {
      return {
        ok: true,
        digest: typeof data.digest === 'string' ? data.digest : undefined,
        shadowAddress: data.shadowAddress,
        mainAddress: data.mainAddress,
        mainSecretKey: data.mainSecretKey,
        transferredObjectCount:
          typeof data.transferredObjectCount === 'number' ? data.transferredObjectCount : 0,
        sentMistApprox: typeof data.sentMistApprox === 'string' ? data.sentMistApprox : '0',
        note: typeof data.note === 'string' ? data.note : undefined,
        securityNote: typeof data.securityNote === 'string' ? data.securityNote : undefined,
      }
    }
    return { ok: false, error: 'Unerwartete Antwort vom Server.' }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}

// Boss commands
export const setBossRole = (address: string, role: 'boss' | 'commander' | 'worker') =>
  executeCommand('/set-role', [address, role])

export const sendBossCommand = (targets: string[], command: string) =>
  executeCommand('/boss-command', [JSON.stringify(targets), command])

// Transfer
export const transferCoins = (recipient: string, amount: number) =>
  executeCommand('/transfer-coins', [recipient, amount])

/** Hilfetext vom Backend (GET /api/help) – kontextabhängig (Start vs. verbunden). */
export async function fetchHelp(): Promise<{ ok: boolean; helpText?: string; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/help')
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Hilfetext nicht verfügbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const helpText = typeof r.body.helpText === 'string' ? r.body.helpText : undefined
    return { ok: true, helpText }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

/** Backend neu starten (POST /api/restart). Nach Erfolg ist die Verbindung weg. */
export async function restartBackend(): Promise<{ ok: boolean; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/restart', { method: 'POST' })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseSimpleOkEnvelopeText(fr.text)
    if (!r.ok) return { ok: false, error: r.error }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

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

/** Kontakt mit optionalem Meshtastic-Mapping (GET /api/contact-labels → directory). */
export type ContactMeshEntryClient = {
  label: string
  /** Einsatz-Tags (z. B. Medic) — Anzeige, siehe initialProfile */
  roleTags?: string[]
  meshNodeId?: string
  meshPublicKeyHex?: string
  bleUuid?: string
}

/** POST /api/contact-labels/apply-initial-profile — gleiches Schema wie Server `InitialProfile`. */
export async function applyInitialProfileProvisioning(profile: Record<string, unknown>): Promise<{
  ok: boolean
  applied?: number
  message?: string
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/contact-labels/apply-initial-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Profil konnte nicht angewendet werden.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return {
      ok: true,
      applied: typeof b.applied === 'number' ? b.applied : undefined,
      message: typeof b.message === 'string' ? b.message : undefined,
      error: typeof b.error === 'string' ? b.error : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

export async function fetchContactDirectory(): Promise<{
  ok: boolean
  labels?: Record<string, string>
  directory?: Record<string, ContactMeshEntryClient>
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/contact-labels')
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Kontakte nicht lesbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return {
      ok: true,
      labels: b.labels as Record<string, string> | undefined,
      directory: b.directory as Record<string, ContactMeshEntryClient> | undefined,
      error: typeof b.error === 'string' ? b.error : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

/** Kontakt inkl. optionaler BLE-UUID / Mesh-Felder (POST /api/contact-label). */
export async function saveContactEntry(body: {
  address: string
  label?: string
  bleUuid?: string
  meshNodeId?: string
  meshPublicKeyHex?: string
  clearMesh?: boolean
}): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/contact-label', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Kontakt speichern fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return {
      ok: true,
      message: typeof b.message === 'string' ? b.message : undefined,
      error: typeof b.error === 'string' ? b.error : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

/** Nur Mesh-Metadaten; Passwort nur lokal/TLS. */
export async function exportContactMeshEncrypted(password: string): Promise<{
  ok: boolean
  bundle?: { v: number; salt: string; iv: string; tag: string; ciphertext: string }
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/contact-mesh-export-encrypted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Mesh-Export fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    const raw = b.bundle
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, error: 'Unerwartete Export-Antwort (bundle).' }
    }
    const o = raw as Record<string, unknown>
    if (
      typeof o.v !== 'number' ||
      typeof o.salt !== 'string' ||
      typeof o.iv !== 'string' ||
      typeof o.tag !== 'string' ||
      typeof o.ciphertext !== 'string'
    ) {
      return { ok: false, error: 'Unerwartetes Bundle-Format.' }
    }
    return {
      ok: true,
      bundle: { v: o.v, salt: o.salt, iv: o.iv, tag: o.tag, ciphertext: o.ciphertext },
      error: typeof b.error === 'string' ? b.error : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

export async function importContactMeshEncrypted(
  password: string,
  bundle: { v: number; salt: string; iv: string; tag: string; ciphertext: string }
): Promise<{ ok: boolean; merged?: number; message?: string; error?: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/contact-mesh-import-encrypted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, bundle }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Mesh-Import fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return {
      ok: true,
      merged: typeof b.merged === 'number' ? b.merged : undefined,
      message: typeof b.message === 'string' ? b.message : undefined,
      error: typeof b.error === 'string' ? b.error : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
