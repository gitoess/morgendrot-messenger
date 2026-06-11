import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseJsonObjectRecord } from '@/frontend/lib/api-response-guard'
import { parseUnlockApiResponse, type UnlockBackendResult } from '@/frontend/lib/api/unlock-response-parse'
import { API_BASE, getApiBase } from '@/frontend/lib/api/api-base'
import type { StatusPollClockHint } from '@/frontend/lib/device-time-trust'
import { OFFLINE_CACHE_TTL_MS } from '@/frontend/lib/offline-cache-ttl'
import { readStandaloneDeviceStatusFallback, shouldPreferStandaloneHandoffStatus } from '@/frontend/lib/capacitor-standalone-bootstrap'
import { broadcastPinnwandStatusFromHandoff } from '@/frontend/lib/broadcast-pinnwand-handoff-status'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import type { MessengerCapabilitiesMatrix } from '@morgendrot/shared/messenger-capabilities-matrix'

/** Rechte aus getHierarchyPermissions (nur bei role boss/kommandant/arbeiter). */
export type HierarchyPermissions = {
  commandDown?: boolean
  keyIssue?: boolean
  revokeDown?: boolean
  statusReadDown?: boolean
  statusReadUp?: boolean
  configChange?: boolean
  hierarchyChange?: boolean
  teamManage?: boolean
}

/** Tresor-Status aus GET /api/status (Punkt 5 Marktreife: Listen-Ansicht + Sync-Status). */
export type VaultStatus = {
  hasLocal: boolean
  lastSavedToChainAt?: number
}

/** Backend-Status (GET /api/status): backendRunning, locked, connected, role, roleId, vaultStatus, … */
export type ApiStatus = {
  backendRunning?: boolean
  /** Frontend: aus getStatus() zusätzlich zu backendRunning. */
  backendOnline?: boolean
  /** Frontend-Fallback: letzter bekannter Status aus lokalem Cache. */
  fromCache?: boolean
  /** Fallback aus lokal vorgemerkt importiertem Handoff (kein Server-Apply). */
  fromLocalHandoff?: boolean
  /** Zeitpunkt des letzten erfolgreichen Live-Status (Epoch ms) bei Cache-Fallback. */
  cacheSavedAtMs?: number
  locked?: boolean
  connected?: boolean
  hasKeys?: boolean
  network?: string
  myAddress?: string
  role?: string
  roleId?: number
  /** Feature-Matrix (Runtime/Handoff) — feingranulare Transport-/UI-Rechte. */
  capabilities?: MessengerCapabilitiesMatrix
  permissions?: HierarchyPermissions
  vaultStatus?: VaultStatus
  plaintextMode?: boolean
  useMailbox?: boolean
  mailboxConfigured?: boolean
  /** Server-MAILBOX_ID (Einsatz-Postfach), wenn konfiguriert. */
  mailboxId?: string
  mailboxIdMasked?: string
  /** Posteingang-Union (Events / MsgKey) — Diagnose nach Package-/Mailbox-Wechsel. */
  inboxUnionPackageIds?: string[]
  inboxUnionMailboxIds?: string[]
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
  /** Herkunft der aktiven Signer-Konfiguration (env oder Runtime-Datei). */
  signerConfigSource?: 'env' | 'runtime'
  /** Herkunft der aktiven Ableitungspfad-Konfiguration (env oder Runtime-Datei). */
  walletDerivationPathConfigSource?: 'env' | 'runtime'
  /** Herkunft von USE_MAILBOX (env oder Runtime-Datei). */
  useMailboxConfigSource?: 'env' | 'runtime'
  /** Herkunft von MAILBOX_STORE_PLAINTEXT (env oder Runtime-Datei). */
  mailboxStorePlaintextConfigSource?: 'env' | 'runtime'
  /** Herkunft von ENABLE_PLAINTEXT_CHANNEL (env oder Runtime-Datei). */
  enablePlaintextChannelConfigSource?: 'env' | 'runtime'
  /** Aktive Runtime-Overrides (nur nicht-geheime Keys). */
  runtimeConfigKeys?: string[]
  /** full = Kacheln wie Dashboard; messenger = schlanker Messenger-Modus (Lite-UI). */
  uiVariant?: 'full' | 'messenger'
  /** Boss-Handoff-Bezeichnung (HANDOFF_LABEL / Einsatz-Profil). */
  handoffLabel?: string
  /** consumer = Privat/Prepper; einsatz = Organisation mit Stab (GET /api/status). */
  deploymentProfile?: 'consumer' | 'einsatz'
  /** mesh-first = Funk-Default in UI; IOTA-Backend bleibt (docs/TRANSPORT-AND-IOTA-LAYERS.md). */
  transportProfile?: 'mesh-first' | 'iota-anchored' | 'iota-full'
  /** Serverseitig erzwungener Simple Mode (Helfer/Wanderer). */
  simpleMode?: boolean
  /** simple | expert — abgeleitet aus SIMPLE_MODE. */
  uiMode?: 'simple' | 'expert'
  /** IOTA-UI (Banner, Relay, Filter) erlaubt. */
  iotaTransportUiEnabled?: boolean
  /** false: API-Port liefert keine statische ui/index.html. */
  serveLiteUiStatic?: boolean
  /** Backend nutzt SOCKS5 für IOTA-RPC (z. B. Tor). */
  rpcSocksProxyActive?: boolean
  /** Backend nutzt HTTP(S)-Proxy für RPC. */
  rpcHttpProxyActive?: boolean
  /** Nach /connect: verbundene Partner-Adressen (Handshake). */
  connectedAddresses?: string[]
  /** Konfigurierter Einsatz-Partner (maskiert wie myAddress). */
  partnerAddress?: string
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
  /** Nach Unlock: natives Wallet-Guthaben (MY_ADDRESS), vom Backend per RPC. */
  walletNativeIotaBalance?: { mist: string; displayIota: string } | null
  walletNativeIotaBalanceFetchFailed?: boolean
  /** M3: Broadcast-Pinnwand aus Server-.env (ohne Geheimnisse). */
  broadcastPinnwand?: {
    enabled: boolean
    address?: string
    authorizedSenders?: string[]
    myAddressAuthorized?: boolean
  }
  /** Boss: Einsatz on-chain + Handoff-Parameter. */
  einsatzConfig?: {
    editionLabel: string
    defaultTtlDays: number
    enablePurge: boolean
    vaultRegistryId?: string
    vaultRegistryIdMasked?: string
    commandRegistryId?: string
    commandRegistryIdMasked?: string
    moveFeatures?: {
      teamBroadcastStore: boolean
      teamBroadcastPurge: boolean
      privateMailboxPurge: boolean
      probed: boolean
      error?: string
    }
    upgradeCapConfigured?: boolean
    upgradeCapId?: string
    upgradeCapIdMasked?: string
    upgradeCapResolvedFromChain?: boolean
    deployModeHint?: string
  }
}

/** Erfolgreicher `fetchStatus` inkl. Referenz für Geräte-Uhr (HTTP `Date`, § H.6c). */
export type ApiStatusFetchOk = ApiStatus & { pollClockHint: StatusPollClockHint }

export type ApiStatusFetchResult = ApiStatusFetchOk | (ApiStatus & { error: string; backendRunning?: boolean })

function parseResponseDateMs(res: Response): number | null {
  const raw = res.headers.get('date')
  if (raw == null || !raw.trim()) return null
  const ms = Date.parse(raw)
  return Number.isFinite(ms) ? ms : null
}

/** Ohne Timeout hängt `fetch` bei totem LAN-Host (Dev-Server aus) oft sehr lange — Handy zeigt erst spät „Basis offline“. */
const STATUS_FETCH_TIMEOUT_MS = 10_000
const STATUS_CACHE_KEY = 'morgendrot.apiStatus.lastOk.v1'

type CachedStatusEnvelope = {
  savedAtMs: number
  status: ApiStatus
}

function cacheStatusSnapshot(status: ApiStatus): void {
  if (typeof window === 'undefined') return
  try {
    const envelope: CachedStatusEnvelope = { savedAtMs: Date.now(), status }
    window.localStorage.setItem(STATUS_CACHE_KEY, JSON.stringify(envelope))
  } catch {
    // Speicher voll / gesperrt: kein Hard-Fail fuer den Status-Poll.
  }
}

function readCachedStatusSnapshot():
  | { status: ApiStatus; pollClockHint: StatusPollClockHint }
  | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STATUS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedStatusEnvelope>
    const status = (parsed.status ?? null) as ApiStatus | null
    const savedAtMs = Number(parsed.savedAtMs ?? 0)
    if (!status || !Number.isFinite(savedAtMs) || savedAtMs <= 0) return null
    const ageMs = Date.now() - savedAtMs
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > OFFLINE_CACHE_TTL_MS) return null
    return {
      status: {
        ...status,
        fromCache: true,
        backendOnline: false,
        backendRunning: false,
        cacheSavedAtMs: savedAtMs,
      },
      pollClockHint: { okAtMs: savedAtMs, httpDateUtcMs: null },
    }
  } catch {
    return null
  }
}

function readLocalHandoffStatusFallback():
  | { status: ApiStatus; pollClockHint: StatusPollClockHint }
  | null {
  const local = readLocalHandoffAppliedSnapshot()
  if (!local) return null
  const broadcastPinnwand = broadcastPinnwandStatusFromHandoff(local)
  return {
    status: {
      backendOnline: false,
      backendRunning: false,
      connected: false,
      fromCache: true,
      fromLocalHandoff: true,
      cacheSavedAtMs: local.savedAtMs,
      handoffLabel: local.handoffLabel,
      role: local.role,
      deploymentProfile: local.deploymentProfile,
      transportProfile: local.transportProfile,
      uiVariant: local.uiVariant,
      simpleMode: local.simpleMode,
      packageId: local.packageId,
      mailboxId: local.mailboxId,
      ...(broadcastPinnwand ? { broadcastPinnwand } : {}),
    },
    pollClockHint: { okAtMs: local.savedAtMs, httpDateUtcMs: null },
  }
}

export async function fetchStatus(): Promise<ApiStatusFetchResult> {
  const apiBase = getApiBase()
  const standaloneFirst =
    !apiBase.trim() || shouldPreferStandaloneHandoffStatus()
  if (standaloneFirst) {
    const standalone = readStandaloneDeviceStatusFallback()
    if (standalone) {
      return { ...standalone.status, pollClockHint: standalone.pollClockHint }
    }
  }
  try {
    const fr = await fetchApiText(apiBase || API_BASE, '/api/status', {
      signal: AbortSignal.timeout(STATUS_FETCH_TIMEOUT_MS),
    })
    if (!fr.ok) {
      const cached = readCachedStatusSnapshot()
      if (cached) {
        console.info('[status] Live-Request fehlgeschlagen, nutze Cache-Fallback.', { error: fr.error })
        return { ...cached.status, pollClockHint: cached.pollClockHint, error: fr.error }
      }
      const localHandoff = readLocalHandoffStatusFallback()
      if (localHandoff) {
        console.info('[status] Live-Request fehlgeschlagen, nutze lokalen Handoff-Fallback.', { error: fr.error })
        return { ...localHandoff.status, pollClockHint: localHandoff.pollClockHint, error: fr.error }
      }
      return {
        backendRunning: false,
        connected: false,
        error: fr.error,
      }
    }
    const p = parseJsonObjectRecord(fr.text)
    if (!p.ok) {
      const cached = readCachedStatusSnapshot()
      if (cached) {
        const err =
          p.error === 'invalid_json'
            ? 'Antwort vom Backend ist kein gültiges JSON.'
            : 'Unerwartetes Antwortformat (API).'
        console.info('[status] Ungültige Live-Antwort, nutze Cache-Fallback.', { error: err })
        return { ...cached.status, pollClockHint: cached.pollClockHint, error: err }
      }
      const localHandoff = readLocalHandoffStatusFallback()
      if (localHandoff) {
        const err =
          p.error === 'invalid_json'
            ? 'Antwort vom Backend ist kein gültiges JSON.'
            : 'Unerwartetes Antwortformat (API).'
        console.info('[status] Ungültige Live-Antwort, nutze lokalen Handoff-Fallback.', { error: err })
        return { ...localHandoff.status, pollClockHint: localHandoff.pollClockHint, error: err }
      }
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
    const pollClockHint: StatusPollClockHint = {
      okAtMs: Date.now(),
      httpDateUtcMs: parseResponseDateMs(fr.response),
    }
    const liveStatus: ApiStatus = {
      ...data,
      backendRunning: data.backendRunning !== false,
      backendOnline: true,
      fromCache: false,
    }
    cacheStatusSnapshot(liveStatus)
    return { ...liveStatus, pollClockHint }
  } catch (error) {
    const cached = readCachedStatusSnapshot()
    if (cached) {
      console.info('[status] Ausnahme beim Live-Request, nutze Cache-Fallback.', {
        error: formatFetchFailureMessage(error),
      })
      return { ...cached.status, pollClockHint: cached.pollClockHint, error: formatFetchFailureMessage(error) }
    }
    const localHandoff = readLocalHandoffStatusFallback()
    if (localHandoff) {
      const err = formatFetchFailureMessage(error)
      console.info('[status] Ausnahme beim Live-Request, nutze lokalen Handoff-Fallback.', { error: err })
      return { ...localHandoff.status, pollClockHint: localHandoff.pollClockHint, error: err }
    }
    return {
      backendRunning: false,
      connected: false,
      error: formatFetchFailureMessage(error),
    }
  }
}

export type { UnlockBackendResult }

export async function unlockBackend(
  password: string,
  opts?: { sdkSignerImport?: string }
): Promise<UnlockBackendResult> {
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
    return parseUnlockApiResponse(fr.text, fr.response.ok)
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
