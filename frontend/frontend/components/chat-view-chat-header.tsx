'use client'

/**
 * Chat-Kopf: Modus (Privat/Pinnwand), Verschlüsselungs-Hinweis, „Partner verbinden“, Status-Banner (Tresor, Klartext-Konfig).
 */

import { Activity, Handshake, Lock, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api'
import { ChatViewPulseSettings } from '@/frontend/components/chat-view-pulse-settings'
import { computeWaldConnectionTier, type WaldConnectionTier } from '@/frontend/lib/chat-wald-connection'

export type ChatViewChatHeaderProps = {
  isPrivate: boolean
  encrypted: boolean
  showSetup: boolean
  onToggleSetup: () => void
  apiStatus: ApiStatus | null
  /** Nach Änderung an Puls/Heartbeat Status neu laden. */
  onRefreshStatus?: () => void | Promise<void>
  /** GET /api/status zuletzt fehlgeschlagen (Basis „offline“). */
  basisUnreachable: boolean
  /** Meshtastic Web-BT verbunden – Funkpfad für Wald-Blau. */
  meshBleConnected: boolean
  /** Aus /api/status / Chat-View (ROLE). */
  role: string
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
    showSetup,
    onToggleSetup,
    apiStatus,
    onRefreshStatus,
    basisUnreachable,
    meshBleConnected,
    role,
  } = p

  const waldTier = computeWaldConnectionTier(basisUnreachable, meshBleConnected)

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
              encrypted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
            )}
          >
            {encrypted ? <Lock className="h-6 w-6" /> : <Unlock className="h-6 w-6" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-foreground">{isPrivate ? 'Privater Chat' : 'Pinnwand'}</h2>
            <p className="text-sm text-muted-foreground">
              {encrypted ? 'Inhalt: ECDH + AES-GCM (Handshake-Keys)' : 'Unverschlüsselt (Klartext)'}
            </p>
            {role.trim() ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Rolle:{' '}
                <span className="rounded-md bg-muted/80 px-1.5 py-0.5 font-medium text-foreground/90">
                  {roleBadgeLabel(role)}
                </span>
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-1">
          <WaldCheckIndicator tier={waldTier} />
          {isPrivate && (
            <button
              type="button"
              onClick={onToggleSetup}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                showSetup
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-accent text-accent-foreground hover:bg-accent/80'
              )}
            >
              <Handshake className="h-4 w-4" />
              Partner verbinden
            </button>
          )}
        </div>
      </div>

      {isPrivate && apiStatus && <MessengerPulseStatusLine apiStatus={apiStatus} />}

      {isPrivate && apiStatus && (
        <ChatViewPulseSettings apiStatus={apiStatus} onApplied={onRefreshStatus} />
      )}

      {isPrivate && apiStatus?.locked === true && (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          <strong className="font-semibold">Tresor gesperrt.</strong> Zum Senden/Empfangen mit deinen Keys das Wallet im
          Backend entsperren (Schloss-Kachel im Dashboard oder <span className="font-mono text-xs">/vault-load</span>).
          Diese Oberfläche hat <strong>keinen geführten Erststart</strong> (kein Seed-Assistent beim ersten Öffnen) –
          Einrichtung über die übrigen Kacheln (Wallet, Setup, Partner verbinden).
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
