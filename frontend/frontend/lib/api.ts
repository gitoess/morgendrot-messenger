import type { ApiResponse, Message, KeyData, TicketData, DeviceStatus } from './types'
import {
  mapInboxApiRowsToMessages,
  pickInboxRawMessages,
  type InboxApiRow,
} from '@/frontend/lib/inbox-map-messages'

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
    const response = await fetch(`${API_BASE}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
    const data = (await response.json()) as ApiResponse<T>
    if (data && typeof data === 'object' && data.ok === false) {
      const msg = data.message
      if (!data.error && typeof msg === 'string' && msg.length > 0) {
        return { ...data, error: msg }
      }
    }
    return data
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      return { ok: false, error: 'Zeitüberschreitung (Timeout).' }
    }
    const offline = /failed to fetch|network|load failed|Connection refused|aborted|AbortError/i.test(msg)
    return {
      ok: false,
      error: offline
        ? 'Backend nicht erreichbar oder abgebrochen. Tor/SOCKS, „npm run dev“ und Wallet prüfen.'
        : msg,
    }
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
  heartbeat?: { enabled: boolean; intervalMs: number; streamsReady: boolean }
}

export async function fetchStatus(): Promise<ApiStatus & { error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/status`)
    const data = await response.json()
    return { ...data, backendRunning: data.backendRunning !== false }
  } catch (error) {
    return {
      backendRunning: false,
      connected: false,
      error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen',
    }
  }
}

export async function unlockBackend(password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    return await response.json()
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen' }
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
    const response = await fetch(`${API_BASE}/api/package-id-history`)
    const data = await response.json()
    return {
      ok: data.ok === true,
      current: typeof data.current === 'string' ? data.current : '',
      history: Array.isArray(data.history) ? data.history : [],
      discovered: Array.isArray(data.discovered) ? data.discovered : [],
      hints: data.hints && typeof data.hints === 'object' ? data.hints : undefined,
      error: typeof data.error === 'string' ? data.error : undefined,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen',
    }
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
    const response = await fetch(`${API_BASE}/api/monitor-status`)
    const data = await response.json()
    return { ok: data.ok === true, devices: data.devices }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen' }
  }
}

/** Audit-Events für Timeline/Radar (GET /api/audit-events). */
export type AuditEvent = { ts: number; type: string; device?: string; message?: string; [key: string]: unknown }

export async function fetchAuditEvents(limit = 100): Promise<{ ok: boolean; events?: AuditEvent[]; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/audit-events?limit=${Math.max(1, Math.min(500, limit))}`)
    const data = await response.json()
    return { ok: data.ok === true, events: data.events || [] }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen' }
  }
}

export const sendHeartbeat = () =>
  executeCommand('/heartbeat', [])

export const setHeartbeatInterval = (ms: number) =>
  executeCommand('/set-heartbeat-interval', [ms])

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
    const response = await fetch(`${API_BASE}/api/vault-personal-secrets`)
    return await response.json()
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen' }
  }
}

export async function saveVaultPersonalSecrets(
  entries: PersonalSecretEntry[],
  persistLocal: boolean
): Promise<{ ok: boolean; message?: string; error?: string; entries?: PersonalSecretEntry[] }> {
  try {
    const response = await fetch(`${API_BASE}/api/vault-personal-secrets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries, persistLocal }),
    })
    return await response.json()
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen' }
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
    const response = await fetch(`${API_BASE}/api/compact-image-encode`, {
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
    return await response.json()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
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
    const response = await fetch(`${API_BASE}/api/lora-progressive-encode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64 }),
    })
    return await response.json()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Luma+Chroma-JPEG → ein JPEG (Backend sharp `composite` blend `over`). */
export async function loraProgressiveFuse(
  lumaJpegBase64: string,
  chromaJpegBase64: string
): Promise<{ ok: boolean; fusedJpegBase64?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/lora-progressive-fuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lumaJpegBase64, chromaJpegBase64 }),
    })
    return await response.json()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
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
    const response = await fetch(`${API_BASE}/api/messenger-audio-to-opus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType }),
    })
    return await response.json()
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
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
    const response = await fetch(`${API_BASE}/api/clear-local-history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shred: options?.shred !== false }),
    })
    return await response.json()
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen' }
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
    const response = await fetch(`${API_BASE}/api/shadow-sweep`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shadowMnemonic: shadowMnemonic.trim() }),
    })
    const data = (await response.json()) as Record<string, unknown>
    if (!response.ok || data.ok === false) {
      const err =
        typeof data.error === 'string' && data.error.length > 0
          ? data.error
          : `Sweep fehlgeschlagen (${response.status}).`
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
    const msg = e instanceof Error ? e.message : String(e)
    const offline = /failed to fetch|network|load failed|Connection refused/i.test(msg)
    return {
      ok: false,
      error: offline ? 'Backend nicht erreichbar (nur localhost/API).' : msg,
    }
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
    const response = await fetch(`${API_BASE}/api/help`)
    const data = await response.json()
    return { ok: data.ok === true, helpText: data.helpText }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen' }
  }
}

/** Backend neu starten (POST /api/restart). Nach Erfolg ist die Verbindung weg. */
export async function restartBackend(): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/restart`, { method: 'POST' })
    const data = await response.json()
    return { ok: data.ok === true, error: data.error }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen' }
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
    },
    ...(s.locked && { locked: true }),
  }))

/** Kontakt mit optionalem Meshtastic-Mapping (GET /api/contact-labels → directory). */
export type ContactMeshEntryClient = {
  label: string
  meshNodeId?: string
  meshPublicKeyHex?: string
  bleUuid?: string
}

export async function fetchContactDirectory(): Promise<{
  ok: boolean
  labels?: Record<string, string>
  directory?: Record<string, ContactMeshEntryClient>
  error?: string
}> {
  try {
    const response = await fetch(`${API_BASE}/api/contact-labels`)
    const data = await response.json()
    return {
      ok: data.ok === true,
      labels: data.labels,
      directory: data.directory,
      error: data.error,
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen',
    }
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
    const response = await fetch(`${API_BASE}/api/contact-label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return await response.json()
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen' }
  }
}

/** Nur Mesh-Metadaten; Passwort nur lokal/TLS. */
export async function exportContactMeshEncrypted(password: string): Promise<{
  ok: boolean
  bundle?: { v: number; salt: string; iv: string; tag: string; ciphertext: string }
  error?: string
}> {
  try {
    const response = await fetch(`${API_BASE}/api/contact-mesh-export-encrypted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await response.json()
    return { ok: data.ok === true, bundle: data.bundle, error: data.error }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen' }
  }
}

export async function importContactMeshEncrypted(
  password: string,
  bundle: { v: number; salt: string; iv: string; tag: string; ciphertext: string }
): Promise<{ ok: boolean; merged?: number; message?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/contact-mesh-import-encrypted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, bundle }),
    })
    const data = await response.json()
    return {
      ok: data.ok === true,
      merged: data.merged,
      message: data.message,
      error: data.error,
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Verbindung fehlgeschlagen' }
  }
}
