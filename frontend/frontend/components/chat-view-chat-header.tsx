'use client'

/**
 * Chat-Kopf: Modus (Privat/Pinnwand), Verschlüsselungs-Hinweis, Status-Banner (Tresor, Klartext-Konfig). „Partner verbinden“ sitzt bei der Verschlüsselungs-Karte.
 */

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Activity, Lock, Unlock, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api'
import { ChatViewPulseSettings } from '@/frontend/components/chat-view-pulse-settings'
import { computeWaldConnectionTier, type WaldConnectionTier } from '@/frontend/lib/chat-wald-connection'
import {
  DIRECT_IOTA_UI_CHANGED,
  getDirectIotaPathUiState,
  type DirectIotaPathUiState,
} from '@/frontend/lib/direct-iota-plain-submit'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import { ChatViewSendPathCompact } from '@/frontend/components/chat-view-send-path-compact'

export type ChatViewChatHeaderProps = {
  isPrivate: boolean
  encrypted: boolean
  apiStatus: ApiStatus | null
  /** Nach Änderung an Puls/Heartbeat Status neu laden. */
  onRefreshStatus?: () => void | Promise<void>
  /** GET /api/status zuletzt fehlgeschlagen (Basis „offline“). */
  basisUnreachable: boolean
  /** Meshtastic Web-BT verbunden – Funkpfad für Wald-Blau. */
  meshBleConnected: boolean
  /** Aus /api/status / Chat-View (ROLE). */
  role: string
  /** Keine sichere Referenzzeit (HTTP-`Date` / GPS) — Fahrplan § H.6c. */
  deviceTimeTrustWarn?: boolean
  /** Kompakter Sendepfad neben „Wald“ (online / funk / adhoc). */
  sendPath?: {
    visible: boolean
    encrypted: boolean
    forcedTransport: ForcedTransport
    onForcedTransportChange: (t: ForcedTransport) => void
    onEncryptedChange?: (encrypted: boolean) => void
  }
  /** Direkt unter Puls-Einstellungen (z. B. Einsatz-Profil). */
  afterPulse?: ReactNode
}

function roleBadgeLabel(role: string): string {
  const r = role.trim().toLowerCase()
  if (r === 'boss') return 'Boss'
  if (r === 'arbeiter') return 'Wanderer'
  if (r === 'kommandant') return 'Kommandant'
  if (r === 'lock') return 'Schloss'
  if (r === 'monitor') return 'Monitor'
  return role.trim() || '—'
}

/** IOTA-Mailbox: Direkt-RPC vs Relay — aktualisiert bei Puls/Einstellungen (`DIRECT_IOTA_UI_CHANGED`). */
function IotaMailboxPathBadge() {
  const [ui, setUi] = useState<DirectIotaPathUiState | null>(null)
  useEffect(() => {
    const tick = () => setUi(getDirectIotaPathUiState())
    tick()
    const on = () => tick()
    window.addEventListener(DIRECT_IOTA_UI_CHANGED, on)
    return () => window.removeEventListener(DIRECT_IOTA_UI_CHANGED, on)
  }, [])
  if (!ui) return null
  const relay = ui.mode === 'relay'
  return (
    <span
      className={cn(
        'inline-flex max-w-[min(100%,14rem)] items-center gap-1.5 truncate rounded-full border px-2 py-1 text-[11px]',
        relay
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100'
          : 'border-sky-500/40 bg-sky-500/10 text-sky-950 dark:text-sky-100'
      )}
      title={ui.detail}
    >
      <Radio className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
      <span className="truncate font-medium">{ui.headline}</span>
    </span>
  )
}

function WaldCheckIndicator({ tier }: { tier: WaldConnectionTier }) {
  const meta = {
    green: { dot: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]', label: 'Basis (API) erreichbar' },
    blue: { dot: 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.45)]', label: 'Basis offline – Funk (LoRa/Mesh) aktiv' },
    red: { dot: 'bg-red-500', label: 'Keine Verbindung: weder Basis noch Funk' },
  }[tier]
  return (
    <span
      className="inline-flex max-w-[min(100%,11rem)] items-center gap-1.5 truncate rounded-full border border-border/60 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground"
      title={meta.label}
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', meta.dot)} aria-hidden />
      <span className="hidden sm:inline">Wald</span>
    </span>
  )
}

function formatHeartbeatIntervalMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 1000) return '—'
  if (ms >= 60_000) {
    const m = Math.round(ms / 60_000)
    return m >= 1 ? `${m} min` : `${Math.round(ms / 1000)} s`
  }
  return `${Math.round(ms / 1000)} s`
}

/** Kompakte Zeile: Streams + Heartbeat-Konfig (kein Chat-Spam, nur Status). */
function MessengerPulseStatusLine({ apiStatus }: { apiStatus: ApiStatus }) {
  const streams = apiStatus.streams
  const hb = apiStatus.heartbeat
  const roleId = apiStatus.roleId
  const canHeartbeatSend = typeof roleId === 'number' && (roleId & 2) !== 0

  const streamsOk = streams?.active === true
  const hbLabel =
    hb == null ? '—' : hb.enabled ? `an (${formatHeartbeatIntervalMs(hb.intervalMs ?? 0)})` : 'aus'

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5 font-medium text-foreground/90">
        <Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        Puls an Basis
      </span>
      <span className="text-muted-foreground">
        Streams:{' '}
        {streamsOk ? (
          <span className="text-emerald-600 dark:text-emerald-400">bereit</span>
        ) : (
          <span className="text-amber-700 dark:text-amber-300">Bridge oder Anchor fehlt</span>
        )}
        {streams?.anchorId ? (
          <span className="ml-1 font-mono text-[10px] opacity-90" title={streams.anchorIdFull || streams.anchorId}>
            ({streams.anchorId}…)
          </span>
        ) : null}
      </span>
      <span className="hidden sm:inline text-border">·</span>
      <span>
        Heartbeat: <span className="text-foreground/80">{hbLabel}</span>
        {hb?.enabled && !hb?.streamsReady ? (
          <span className="ml-1 text-amber-700 dark:text-amber-300"> (Streams unvollständig)</span>
        ) : null}
      </span>
      {hb?.enabled && streamsOk && !canHeartbeatSend ? (
        <span className="w-full text-[11px] text-amber-800/90 dark:text-amber-200/90 sm:w-auto sm:pl-0">
          Hinweis: Heartbeat senden braucht S-Bit (ROLE_ID mit Send, z. B. 14).
        </span>
      ) : null}
    </div>
  )
}

export function ChatViewChatHeader(p: ChatViewChatHeaderProps) {
  const {
    isPrivate,
    encrypted,
    apiStatus,
    onRefreshStatus,
    basisUnreachable,
    meshBleConnected,
    role,
    deviceTimeTrustWarn = false,
    sendPath,
    afterPulse,
  } = p

  const waldTier = computeWaldConnectionTier(basisUnreachable, meshBleConnected)

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center sm:gap-3">
          <div
            className={cn(
              'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:mt-0 sm:h-12 sm:w-12',
              encrypted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
            )}
          >
            {encrypted ? <Lock className="h-5 w-5 sm:h-6 sm:w-6" /> : <Unlock className="h-5 w-5 sm:h-6 sm:w-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-lg font-bold leading-tight text-foreground sm:text-xl">
                {isPrivate ? 'Privater Chat' : 'Pinnwand'}
              </h2>
              {role.trim() ? (
                <span className="text-[11px] text-muted-foreground sm:text-xs">
                  Rolle{' '}
                  <span className="font-medium text-foreground/90">{roleBadgeLabel(role)}</span>
                </span>
              ) : null}
            </div>
            {isPrivate ? (
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:text-sm">
                {encrypted
                  ? 'Schloss = Modus „privat + verschlüsselt“ für diesen Chat. Konkreter Sendeweg (online / funk / …), Mailbox- und Basis-Optionen: Karte „Verschlüsselung“ direkt unter dem Nachrichtenbereich — nicht in dieser Kopfzeile.'
                  : 'Kein E2E. Sendeweg und Schalter: Karte „Verschlüsselung“ unter dem Nachrichtenbereich.'}
              </p>
            ) : (
              <p className="mt-0.5 text-xs leading-snug text-muted-foreground sm:text-sm">
                Unverschlüsselt auf der gewählten Route
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-1">
          <WaldCheckIndicator tier={waldTier} />
          {sendPath ? <ChatViewSendPathCompact {...sendPath} /> : null}
          {isPrivate ? <IotaMailboxPathBadge /> : null}
        </div>
      </div>

      {isPrivate && apiStatus && <MessengerPulseStatusLine apiStatus={apiStatus} />}

      {isPrivate && apiStatus && (
        <ChatViewPulseSettings apiStatus={apiStatus} onApplied={onRefreshStatus} />
      )}

      {afterPulse}

      {isPrivate && deviceTimeTrustWarn && (
        <div className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-sm text-sky-950 dark:text-sky-100">
          <strong className="font-semibold">Geräte-Uhr:</strong> Keine abgesicherte Referenzzeit (frischer{' '}
          <span className="font-mono text-xs">Date</span>-Header der Basis oder GPS-UTC). Zeitstempel in Export,
          Protokoll und Attestation können <strong>abweichen</strong> — siehe{' '}
          <span className="font-mono text-[11px]">docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md</span> §6 / Fahrplan §
          H.6c.
        </div>
      )}

      {isPrivate && apiStatus?.locked === true && (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          <strong className="font-semibold">Tresor gesperrt.</strong> Zum Senden/Empfangen auf der{' '}
          <strong>Startseite</strong> den Dialog <strong>Wallet entsperren</strong> nutzen (oder nach manuellem Sperren
          den Befehl <span className="font-mono text-xs">/vault-load</span> in der Lite-UI bzw. Konsole). Diese Oberfläche
          hat <strong>keinen geführten Erststart</strong> (kein Seed-Assistent beim ersten Öffnen) — Einrichtung über
          Konfiguration, Tresor und Partner verbinden.
        </div>
      )}

      {isPrivate &&
        encrypted &&
        apiStatus &&
        (apiStatus.plaintextMode === true || apiStatus.mailboxStorePlaintext === true) && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-950 dark:text-red-100">
            <strong className="font-semibold">Vertraulichkeit eingeschränkt:</strong> Das Backend ist für{' '}
            <span className="font-mono text-xs">ENABLE_PLAINTEXT_CHANNEL</span> und/oder{' '}
            <span className="font-mono text-xs">MAILBOX_STORE_PLAINTEXT</span> konfiguriert – Nachrichteninhalte können
            zusätzlich oder ausschließlich als Klartext in der Mailbox bzw. auf der Chain landen. Für maximale
            Inhaltsvertraulichkeit beide Optionen aus und nur verschlüsselten Pfad nutzen.
          </div>
        )}
    </>
  )
}
