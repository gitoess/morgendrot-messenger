import { API_BASE } from '@/frontend/lib/api/api-base'
import { fetchWithApiAuth } from '@/frontend/lib/api-authenticated-fetch'
import type { MessengerCapabilitiesOverride } from '@morgendrot/shared/messenger-capabilities-matrix'

export type StandaloneHandoffPackageSource = 'boss' | 'custom' | 'history'

export type StandaloneSmartphoneHandoffZipBody = {
  handoffLabel?: string
  rpcUrl?: string
  packageSource?: StandaloneHandoffPackageSource
  customPackageId?: string
  historyFromNewest?: number
  bossAddress?: string
  partnerAddresses?: string
  /** Leerer String erlaubt (keine MAILBOX_ID im Export); weglassen = Server nutzt Boss-.env. */
  mailboxId?: string
  /** Komma-getrennte Team-Mailbox-IDs (zusätzlich zur primären MAILBOX_ID). */
  teamMailboxIds?: string
  commandRegistryId?: string
  vaultRegistryId?: string
  nextPublicDirectIotaRpcUrl?: string
  helperRole?: 'messenger' | 'arbeiter' | 'kommandant'
  roleId?: number
  deploymentProfile?: string
  uiVariant?: 'full' | 'messenger'
  transportProfile?: 'mesh-first' | 'iota-anchored' | 'iota-full'
  simpleMode?: boolean
  /** Feingranulare Rechte → `.morgendrot-runtime-config.json` (Phase 2). */
  capabilitiesOverride?: MessengerCapabilitiesOverride
  /** README-HANDOFF.txt: Block LoRa-PSK + IOTA-Archiv (Boss-Export). */
  includeIotaArchivReadme?: boolean
  readmeExtra?: string
  /** M2c: JSON — Gruppe + Team-Mailbox (→ MESSENGER_GROUP_HANDOFF in .env). */
  messengerGroupHandoff?: string
  /** Nachrichten-TTL in Tagen → DEFAULT_TTL_DAYS (Default: Boss-Server). */
  exportTtlDays?: number
  /** ENABLE_PURGE im Handoff (Default: wie Boss-Server). */
  exportEnablePurge?: boolean
  /** `parts` = JSON mit envContent/readme (Client baut ggf. verschlüsseltes ZIP). */
  format?: 'zip' | 'parts'
  /** § H.33 — Einsatz-Kettenmodus */
  einsatzChainMode?: string
  /** § H.33 Modus A — Boss Mainnet-RPC (optional, nicht in Helfer-ZIP nötig wenn leer). */
  mainnetRpcUrl?: string
}

export type StandaloneSmartphoneHandoffPartsOk = {
  ok: true
  envContent: string
  /** `.morgendrot-runtime-config.json` — messengerCapabilities (öffentlich). */
  runtimeConfigContent?: string
  readme: string
  handoffLabel?: string
  createdAtIso: string
  packageId: string
  filenameBase: string
}

export type StandaloneSmartphoneHandoffPartsResult =
  | StandaloneSmartphoneHandoffPartsOk
  | { ok: false; error: string }

/** POST /api/standalone-smartphone-handoff-zip → Teile (für Client-Verschlüsselung). */
export async function fetchStandaloneSmartphoneHandoffParts(
  body: StandaloneSmartphoneHandoffZipBody
): Promise<StandaloneSmartphoneHandoffPartsResult> {
  try {
    const res = await fetchWithApiAuth(`${API_BASE}/api/standalone-smartphone-handoff-zip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, format: 'parts' }),
    })
    const j = (await res.json()) as { ok?: boolean; error?: string; message?: string } & Partial<
      StandaloneSmartphoneHandoffPartsOk
    >
    if (!res.ok || !j.ok) {
      return { ok: false, error: j.error || j.message || `HTTP ${res.status}` }
    }
    if (!j.envContent?.trim()) {
      return { ok: false, error: 'Leere Handoff-.env vom Server.' }
    }
    return {
      ok: true,
      envContent: j.envContent,
      runtimeConfigContent: typeof j.runtimeConfigContent === 'string' ? j.runtimeConfigContent : undefined,
      readme: j.readme ?? '',
      handoffLabel: j.handoffLabel,
      createdAtIso: j.createdAtIso || new Date().toISOString(),
      packageId: j.packageId || '',
      filenameBase: j.filenameBase || 'morgendrot-standalone-handoff',
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}

/** POST /api/standalone-smartphone-handoff-zip → Browser-Download (ZIP). */
export async function downloadStandaloneSmartphoneHandoffZip(
  body: StandaloneSmartphoneHandoffZipBody
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetchWithApiAuth(`${API_BASE}/api/standalone-smartphone-handoff-zip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, format: 'zip' }),
    })
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (!res.ok) {
      if (ct.includes('application/json')) {
        const j = (await res.json()) as { error?: string; message?: string }
        return { ok: false, error: j.error || j.message || `HTTP ${res.status}` }
      }
      return { ok: false, error: `HTTP ${res.status}` }
    }
    if (!ct.includes('application/zip')) {
      if (ct.includes('application/json')) {
        const j = (await res.json()) as { error?: string; message?: string }
        return { ok: false, error: j.error || j.message || 'Unerwartete JSON-Antwort' }
      }
      return { ok: false, error: 'Kein ZIP (Content-Type).' }
    }
    const blob = await res.blob()
    const dispo = res.headers.get('content-disposition') || ''
    const m = /filename="([^"]+)"/i.exec(dispo)
    const filename = m?.[1] || 'morgendrot-standalone-handoff.zip'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
