'use client'

/**
 * Chat-Kopf: Modus (Privat/Pinnwand), Verschlüsselungs-Hinweis, Status-Banner (Tresor, Klartext-Konfig). „Partner verbinden“ sitzt bei der Verschlüsselungs-Karte.
 */

import { useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api'
import type { ReactNode } from 'react'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import { ChatViewSendPathCompact } from '@/frontend/components/chat-view-send-path-compact'
import Link from 'next/link'
import { isPinnwandChannel, type MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import { showPinnwandChannelTab } from '@/frontend/lib/messenger-pinnwand-capabilities'
import { pinnwandChannelTabLabel } from '@/frontend/lib/pinnwand-display'
import { channelDisabledReason } from '@/frontend/lib/messenger-channel-send-path'
import {
  MessengerGuideHint,
  MessengerHandbookChatLink,
  MESSENGER_HB_ANCHOR_GRUPPENCHAT,
  MESSENGER_HB_ANCHOR_HANDSHAKE_TRUST,
} from '@/components/messenger-handbook-link'
import { ActiveProfileBadge } from '@/frontend/components/active-profile-badge'
import { ChatNetworkBadge } from '@/frontend/components/chat-network-badge'
import type { OfflineStatusSnapshot } from '@/frontend/hooks/use-offline-status'

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
  /** Bei Cache-Fallback: Alter des letzten Live-Status in Minuten. */
  statusCacheAgeMinutes?: number | null
  /** Meshtastic Web-BT verbunden (Status wird in der Transport-/Send-UI angezeigt). */
  meshBleConnected: boolean
  /** Aus /api/status / Chat-View (ROLE). */
  role: string
  /** Keine sichere Referenzzeit (HTTP-`Date` / GPS) — Fahrplan § H.6c. */
  deviceTimeTrustWarn?: boolean
  /** Kompakter Sendepfad (online / funk / adhoc / telegram). */
  sendPath?: {
    visible: boolean
    channelMode: MessengerChatChannel
    encrypted: boolean
    forcedTransport: ForcedTransport
    onForcedTransportChange: (t: ForcedTransport) => void
    onEncryptedChange?: (encrypted: boolean) => void
    myAddressLine?: string
    showAdhocTransport?: boolean
    composerDelivery?: ComposerDeliveryChannel
    onComposerDeliveryChange?: (d: ComposerDeliveryChannel) => void
    apiStatus?: ApiStatus | null
  }
  /** Wenn gesetzt: „Tresor: …“ ist ein Button (Sitzung sperren bzw. Startseite für Entsperren). */
  vaultBannerActions?: ChatViewVaultBannerActions
  /** Eine Kachel „Nachrichten“: Umschalten Privat ↔ Gruppe ↔ Pinnwand (ohne Dashboard zurück). */
  channelMode?: MessengerChatChannel
  onChannelModeChange?: (c: MessengerChatChannel) => void
  /** Direkt unter Puls-Einstellungen (z. B. Einsatz-Profil). */
  afterPulse?: ReactNode
  /** Kompakter Gesamtstatus (optional, z. B. aus use-offline-status). */
  offlineStatus?: OfflineStatusSnapshot
  /** Ungelesene Lagebild-Meldungen — Badge am Tab. */
  pinnwandTabUnreadCount?: number
}

type TresorSessionUi = 'locked' | 'no-keys' | 'ready'

function tresorSessionUi(sessionLocked: boolean, hasKeys?: boolean): TresorSessionUi {
  if (sessionLocked) return 'locked'
  if (hasKeys !== true) return 'no-keys'
  return 'ready'
}

export function TresorSessionBadge({
  sessionLocked,
  hasKeys,
  actions,
}: {
  /** API: Entsperr-Dialog offen / Passwort-Resolver aktiv. */
  sessionLocked: boolean
  /** Keys im Backend-RAM (nach /vault-load) — nötig für Signieren/Mailbox. */
  hasKeys?: boolean
  actions?: ChatViewVaultBannerActions
}) {
  const [busy, setBusy] = useState(false)
  const ui = tresorSessionUi(sessionLocked, hasKeys)
  const shellClass = cn(
    'inline-flex max-w-[min(100%,14rem)] items-center gap-1 truncate rounded-full border px-2 py-1 text-[11px]',
    ui === 'locked'
      ? 'border-amber-500/45 bg-amber-500/10 text-amber-950 dark:text-amber-100'
      : ui === 'no-keys'
        ? 'border-orange-500/45 bg-orange-500/10 text-orange-950 dark:text-orange-100'
        : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
  )
  const passiveTitle =
    ui === 'locked'
      ? 'Tresor gesperrt — Entsperr-Dialog öffnen.'
      : ui === 'no-keys'
        ? 'Schlüssel fehlen in der Sitzung — erneut entsperren oder Tresor → Datei laden.'
        : 'Schlüssel geladen — Signieren und Mailbox senden möglich.'
  const activeTitle =
    ui === 'locked'
      ? 'Dialog „Tresor entsperren“ öffnen.'
      : ui === 'no-keys'
        ? 'Tresor erneut entsperren (lädt Keys in die Sitzung).'
        : 'API-Sitzung sperren — Schlüssel aus dem Arbeitsspeicher der Basis.'

  const icon =
    ui === 'ready' ? (
      <Unlock className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
    ) : (
      <Lock className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
    )
  const label = (
    <span className="truncate font-medium">
      {ui === 'locked' ? 'Tresor: gesperrt' : ui === 'no-keys' ? 'Tresor: Keys fehlen' : 'Tresor: bereit'}
    </span>
  )

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
      aria-label={
        ui === 'locked' || ui === 'no-keys' ? 'Tresor entsperren' : 'API-Sitzung sperren'
      }
      onClick={() => {
        if (ui === 'locked' || ui === 'no-keys') {
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
    statusCacheAgeMinutes,
    deviceTimeTrustWarn = false,
    sendPath,
    vaultBannerActions,
    channelMode,
    onChannelModeChange,
    afterPulse,
    offlineStatus,
    basisUnreachable,
    role = '',
    pinnwandTabUnreadCount = 0,
  } = p

  const channelModes: MessengerChatChannel[] = (
    ['private', 'group', 'pinnwand', 'notes'] as const
  ).filter((mode) => {
    if (mode === 'pinnwand') return showPinnwandChannelTab(apiStatus, role)
    return true
  })

  const channelTitle =
    channelMode === 'group'
      ? 'Gruppenchat'
      : channelMode === 'pinnwand'
        ? pinnwandChannelTabLabel(role, apiStatus)
        : channelMode === 'notes'
          ? 'Notizen'
          : '1:1 Privat'

  const handbookSubline =
    channelMode === 'group' ? (
      <MessengerHandbookChatLink anchor={MESSENGER_HB_ANCHOR_GRUPPENCHAT} className="text-[10px]" />
    ) : channelMode != null && isPinnwandChannel(channelMode) ? (
      <Link href="/handbook?file=BROADCAST-PINNWAND.md" className="text-primary underline-offset-2 hover:underline">
        Handbuch: Pinnwand
      </Link>
    ) : null

  const sendPathPanelMinH = 'min-h-[6.5rem]'

  return (
    <>
      <section
        className="rounded-xl border border-border/60 bg-card/30 p-3 sm:p-4"
        aria-label="Chat-Kopf"
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,22rem)] lg:items-start lg:gap-5">
          {/* Links: Modus + Kanal-Umschalter */}
          <div className="flex min-w-0 gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11',
                encrypted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
              )}
              aria-hidden
            >
              {encrypted ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h2 className="text-base font-bold leading-tight text-foreground sm:text-lg">{channelTitle}</h2>
                <ChatNetworkBadge />
                <ActiveProfileBadge status={apiStatus} compact />
              </div>
              {channelMode != null && onChannelModeChange ? (
                <div
                  className={cn(
                    'grid w-full max-w-[20rem] gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5',
                    channelModes.length >= 4 ? 'grid-cols-4' : 'grid-cols-3'
                  )}
                  role="group"
                  aria-label="Kanal"
                >
                  {channelModes.map((mode) => {
                    const tabLabel =
                      mode === 'private'
                        ? '1:1'
                        : mode === 'group'
                          ? 'Gruppe'
                          : mode === 'notes'
                            ? 'Notizen'
                            : pinnwandChannelTabLabel(role, apiStatus)
                    const tabUnread = mode === 'pinnwand' ? pinnwandTabUnreadCount : 0
                    const disabledReason =
                      sendPath && mode !== channelMode
                        ? channelDisabledReason(
                            mode,
                            sendPath.composerDelivery ?? 'chain',
                            sendPath.forcedTransport ?? 'internet'
                          )
                        : null
                    const disabled = Boolean(disabledReason)
                    return (
                      <button
                        key={mode}
                        type="button"
                        disabled={disabled}
                        title={disabled ? disabledReason ?? undefined : undefined}
                        onClick={() => onChannelModeChange(mode)}
                        className={cn(
                          'rounded-md px-1 py-1.5 text-center text-[11px] font-semibold leading-none transition-colors',
                          disabled && 'cursor-not-allowed opacity-40',
                          channelMode === mode && !disabled
                            ? mode === 'group'
                              ? 'bg-violet-600 text-white'
                              : mode === 'pinnwand'
                                ? 'bg-orange-600 text-white'
                                : mode === 'notes'
                                  ? 'bg-slate-600 text-white'
                                  : 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        )}
                      >
                        <span className="inline-flex items-center justify-center gap-0.5">
                          {tabLabel}
                          {tabUnread > 0 && channelMode !== mode ? (
                            <span className="min-w-[0.9rem] rounded-full bg-red-600 px-0.5 text-[8px] font-bold leading-[0.85rem] text-white">
                              {tabUnread > 99 ? '99+' : tabUnread}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : null}
              <div className="min-h-[1.125rem] text-[10px] text-muted-foreground">{handbookSubline}</div>
            </div>
          </div>

          {/* Rechts: Status + Sendepfad (feste Mindesthöhe gegen Springen) */}
          <div className="flex min-w-0 flex-col gap-2">
            {isPrivate ? (
              <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 border-b border-border/40 pb-2 text-[10px] text-muted-foreground">
                <MessengerGuideHint
                  ariaLabel="Messenger Risiken und Vertrauen"
                  teaser="Risiken"
                  anchor={MESSENGER_HB_ANCHOR_HANDSHAKE_TRUST}
                />
                <span className="hidden text-border/80 sm:inline" aria-hidden>
                  ·
                </span>
                <MessengerHandbookChatLink
                  anchor={MESSENGER_HB_ANCHOR_HANDSHAKE_TRUST}
                  className="text-[10px] font-normal text-muted-foreground hover:text-foreground"
                />
                {apiStatus ? (
                  <>
                    <span className="hidden text-border/80 sm:inline" aria-hidden>
                      ·
                    </span>
                    <TresorSessionBadge
                      sessionLocked={!!apiStatus.locked}
                      hasKeys={apiStatus.hasKeys}
                      actions={vaultBannerActions}
                    />
                  </>
                ) : null}
              </div>
            ) : null}
            <div className={sendPathPanelMinH}>
              {sendPath?.visible ? (
                <ChatViewSendPathCompact {...sendPath} className="h-full w-full" />
              ) : (
                <div
                  className={cn(
                    'flex h-full items-center rounded-lg border border-border/40 bg-muted/15 px-3 py-2 text-[10px] leading-snug text-muted-foreground',
                    sendPathPanelMinH
                  )}
                >
                  {channelMode === 'pinnwand'
                    ? 'Pinnwand — nur Online (IOTA), Klartext. Senden unten im Bereich „An Pinnwand senden“.'
                    : channelMode === 'notes'
                      ? 'Notizen — Tresor-Inhalt lokal im Vault; kein Sendeweg.'
                      : '\u00A0'}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {afterPulse}

      {isPrivate && offlineStatus && (offlineStatus.mode !== 'online' || offlineStatus.queuePending > 0) ? (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          <p>
            <strong className="font-semibold">Offline-Status:</strong>{' '}
            {offlineStatus.mode === 'cache' ? 'Cache-Modus' : offlineStatus.mode === 'offline' ? 'Offline' : 'Online'} ·
            Queue: {offlineStatus.queuePending}
          </p>
          <p className="mt-0.5 text-amber-900/90 dark:text-amber-100/90">
            {offlineStatus.lastSuccessfulSyncMinutes == null
              ? 'Letzte Synchronisation unbekannt.'
              : `Letzte Synchronisation vor ${Math.max(0, offlineStatus.lastSuccessfulSyncMinutes)} Min.`}
          </p>
        </div>
      ) : null}

      {isPrivate && apiStatus?.fromCache === true ? (
        <div className="rounded-lg border border-amber-500/45 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          <strong className="font-semibold">Offline (Cache-Modus):</strong> Letzter Live-Status vor{' '}
          <strong>{Math.max(0, Number(statusCacheAgeMinutes ?? 0))} Min.</strong> (TTL 30 Min.). Anzeigen koennen
          veraltet sein.
        </div>
      ) : null}

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

    </>
  )
}
