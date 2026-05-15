'use client'

/**
 * Chat-Kopf: Modus (Privat/Pinnwand), Verschlüsselungs-Hinweis, Status-Banner (Tresor, Klartext-Konfig). „Partner verbinden“ sitzt bei der Verschlüsselungs-Karte.
 */

import type { ReactNode } from 'react'
import { useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import { ChatViewSendPathCompact } from '@/frontend/components/chat-view-send-path-compact'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'

/** Optional: Tresor-Badge wird klickbar (Sperren / zur Startseite bei gesperrter Sitzung). */
export type ChatViewVaultBannerActions = {
  onLockSession: () => Promise<void>
  onNavigateHomeWhenLocked: () => void
}

export type ChatViewChatHeaderProps = {
  isPrivate: boolean
  encrypted: boolean
  apiStatus: ApiStatus | null
  /** Nach Änderung an Puls/Heartbeat Status neu laden. */
  onRefreshStatus?: () => void | Promise<void>
  /** GET /api/status zuletzt fehlgeschlagen (Basis „offline“). */
  basisUnreachable: boolean
  /** Meshtastic Web-BT verbunden (Status wird in der Transport-/Send-UI angezeigt). */
  meshBleConnected: boolean
  /** Aus /api/status / Chat-View (ROLE). */
  role: string
  /** Keine sichere Referenzzeit (HTTP-`Date` / GPS) — Fahrplan § H.6c. */
  deviceTimeTrustWarn?: boolean
  /** Kompakter Sendepfad (online / funk / adhoc). */
  sendPath?: {
    visible: boolean
    encrypted: boolean
    forcedTransport: ForcedTransport
    onForcedTransportChange: (t: ForcedTransport) => void
    onEncryptedChange?: (encrypted: boolean) => void
  }
  /** Wenn gesetzt: „Tresor: …“ ist ein Button (Sitzung sperren bzw. Startseite für Entsperren). */
  vaultBannerActions?: ChatViewVaultBannerActions
  /** Eine Kachel „Nachrichten“: Umschalten Privat ↔ Pinnwand (ohne Dashboard zurück). */
  channelMode?: MessengerChatChannel
  onChannelModeChange?: (c: MessengerChatChannel) => void
  /** Direkt unter Puls-Einstellungen (z. B. Einsatz-Profil). */
  afterPulse?: ReactNode
}

function TresorSessionBadge({
  locked,
  actions,
}: {
  locked: boolean
  actions?: ChatViewVaultBannerActions
}) {
  const [busy, setBusy] = useState(false)
  const shellClass = cn(
    'inline-flex max-w-[min(100%,12rem)] items-center gap-1 truncate rounded-full border px-2 py-1 text-[11px]',
    locked
      ? 'border-amber-500/45 bg-amber-500/10 text-amber-950 dark:text-amber-100'
      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
  )
  const passiveTitle = locked
    ? 'Backend-Sitzung gesperrt — Keys nicht im RAM. Startseite: Tresor entsperren.'
    : 'Backend-Sitzung entsperrt — Signieren/Mailbox möglich, solange die Basis erreichbar ist.'
  const activeTitle = locked
    ? 'Zur Startseite wechseln — dort Dialog „Tresor entsperren“ (Randfall: Sitzung gesperrt während du hier warst).'
    : 'API-Sitzung sperren — Schlüssel aus dem Arbeitsspeicher der Basis; danach Passwort erneut nötig.'

  const icon = locked ? (
    <Lock className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
  ) : (
    <Unlock className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
  )
  const label = <span className="truncate font-medium">{locked ? 'Tresor: gesperrt' : 'Tresor: entsperrt'}</span>

  if (!actions) {
    return (
      <span className={shellClass} title={passiveTitle}>
        {icon}
        {label}
      </span>
    )
  }

  return (
    <button
      type="button"
      className={cn(shellClass, 'cursor-pointer text-left transition-opacity hover:opacity-90', busy && 'opacity-70')}
      disabled={busy}
      title={activeTitle}
      aria-label={locked ? 'Zur Startseite für Tresor entsperren' : 'API-Sitzung sperren'}
      onClick={() => {
        if (locked) {
          actions.onNavigateHomeWhenLocked()
          return
        }
        void (async () => {
          if (busy) return
          setBusy(true)
          try {
            await actions.onLockSession()
          } finally {
            setBusy(false)
          }
        })()
      }}
    >
      {icon}
      {label}
    </button>
  )
}

export function ChatViewChatHeader(p: ChatViewChatHeaderProps) {
  const {
    isPrivate,
    encrypted,
    apiStatus,
    deviceTimeTrustWarn = false,
    sendPath,
    vaultBannerActions,
    channelMode,
    onChannelModeChange,
    afterPulse,
  } = p

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
                {isPrivate ? '1:1 Privat' : 'Pinnwand (Brett)'}
              </h2>
              {channelMode != null && onChannelModeChange ? (
                <span
                  className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5"
                  role="group"
                  aria-label="Kanal"
                >
                  <button
                    type="button"
                    onClick={() => onChannelModeChange('private')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                      channelMode === 'private'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    1:1
                  </button>
                  <button
                    type="button"
                    onClick={() => onChannelModeChange('pinnwand')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                      channelMode === 'pinnwand'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Brett
                  </button>
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {isPrivate
                ? 'Verschlüsselter Dialog mit einer Partner-Adresse (0x…). Gruppenchat folgt in M2.'
                : 'Schwarzes Brett: Klartext-Bekanntmachungen — kein Gruppenchat, keine 1:1-Verschlüsselung.'}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:pt-1">
          {isPrivate && apiStatus ? (
            <TresorSessionBadge locked={!!apiStatus.locked} actions={vaultBannerActions} />
          ) : null}
          {sendPath ? <ChatViewSendPathCompact {...sendPath} /> : null}
        </div>
      </div>

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
          <strong className="font-semibold">Tresor gesperrt (API-Sitzung).</strong> Normalerweise blockiert die
          Startseite den Messenger mit dem Dialog <strong>Tresor entsperren</strong>, bis die Sitzung offen ist — ohne
          entsperrten Tresor sind Signieren und zuverlässiges Senden/Empfangen nicht möglich. Dieser Hinweis gilt vor
          allem, wenn die Sitzung <strong>während</strong> du im Chat warst gesperrt wurde (anderes Tab, manuelles
          Sperren, PWA-Hintergrund) oder der Status kurz hinterherhinkt: <strong>Startseite</strong> (Badge „Tresor:
          gesperrt“ antippen) und erneut entsperren; in der Lite-UI ggf.{' '}
          <span className="font-mono text-xs">/vault-load</span>. Diese Oberfläche hat <strong>keinen geführten
          Erststart</strong> — Einrichtung über Konfiguration, Tresor und Partner verbinden.
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
