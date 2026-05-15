import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseJsonObjectRecord } from '@/frontend/lib/api-response-guard'
import { parseUnlockApiResponse, type UnlockBackendResult } from '@/frontend/lib/api/unlock-response-parse'
import { API_BASE } from '@/frontend/lib/api/api-base'
import type { StatusPollClockHint } from '@/frontend/lib/device-time-trust'

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
  /** Maskierte Server-MAILBOX_ID (Admin/Betrieb — nicht Partner-Adresse). */
  mailboxIdMasked?: string
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

export async function fetchStatus(): Promise<ApiStatusFetchResult> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/status', {
      signal: AbortSignal.timeout(STATUS_FETCH_TIMEOUT_MS),
    })
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
    const pollClockHint: StatusPollClockHint = {
      okAtMs: Date.now(),
      httpDateUtcMs: parseResponseDateMs(fr.response),
    }
    return { ...data, backendRunning: data.backendRunning !== false, pollClockHint }
  } catch (error) {
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
