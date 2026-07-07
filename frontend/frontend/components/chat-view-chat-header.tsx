'use client'

/**
 * Chat-Kopf: Kanal/Toolbar oben, Sendepfad darunter.
 */

import Link from 'next/link'
import { useState } from 'react'
import { BookOpen, Lock, Settings, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api'
import { isMessengerSessionKeysReady } from '@/frontend/lib/messenger-session-keys-ready'
import type { ReactNode } from 'react'
import { type MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import {
  MessengerHandbookChatLink,
  MESSENGER_HB_ANCHOR_GRUPPENCHAT,
  MESSENGER_HB_ANCHOR_HANDSHAKE_TRUST,
} from '@/components/messenger-handbook-link'
import { MESSENGER_HANDBOOK_CHAT_HREF } from '@/components/messenger-handbook-link'
import { ActiveProfileBadge } from '@/frontend/components/active-profile-badge'
import { ChatNetworkBadge } from '@/frontend/components/chat-network-badge'
import { ChatViewSendPathCompact, type ChatViewSendPathCompactProps } from '@/frontend/components/chat-view-send-path-compact'
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
  onRefreshStatus?: () => void | Promise<void>
  basisUnreachable: boolean
  statusCacheAgeMinutes?: number | null
  statusPollAttempted?: boolean
  meshBleConnected: boolean
  role: string
  deviceTimeTrustWarn?: boolean
  sendPath?: ChatViewSendPathCompactProps | null
  onOpenSettings?: () => void
  vaultBannerActions?: ChatViewVaultBannerActions
  channelMode?: MessengerChatChannel
  onChannelModeChange?: (c: MessengerChatChannel) => void
  /** Kontext aus Sidebar-Auswahl — ersetzt generischen Modus-Titel. */
  conversationTitle?: string | null
  conversationSubtitle?: string | null
  afterPulse?: ReactNode
  offlineStatus?: OfflineStatusSnapshot
  pinnwandTabUnreadCount?: number
  /** APK: schlanke Kopfzeile — Sendepfad und Handbuch ausblenden (liegen unten). */
  compactNative?: boolean
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
  sessionLocked: boolean
  hasKeys?: boolean
  actions?: ChatViewVaultBannerActions
}) {
  const [busy, setBusy] = useState(false)
  const ui = tresorSessionUi(sessionLocked, hasKeys)
  const shellClass = cn(
    'inline-flex max-w-[min(100%,16rem)] items-center gap-1.5 truncate rounded-md border px-2.5 py-1.5 text-xs font-bold shadow-sm',
    ui === 'locked'
      ? 'border-amber-600/55 bg-amber-100 text-amber-950 dark:border-amber-400/50 dark:bg-amber-950/90 dark:text-amber-50'
      : ui === 'no-keys'
        ? 'border-orange-600/55 bg-orange-100 text-orange-950 dark:border-orange-400/50 dark:bg-orange-950/90 dark:text-orange-50'
        : 'border-emerald-600/55 bg-emerald-100 text-emerald-950 dark:border-emerald-400/50 dark:bg-emerald-950/90 dark:text-emerald-50'
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
      <Unlock className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
    ) : (
      <Lock className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
    )
  const label = (
    <span className="truncate font-semibold">
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

function HeaderToolbarButton(p: {
  onClick?: () => void
  href?: string
  label: string
  icon: ReactNode
}) {
  const className =
    'inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-muted'
  if (p.href) {
    return (
      <a href={p.href} className={className} aria-label={p.label} title={p.label}>
        {p.icon}
        <span className="hidden sm:inline">{p.label}</span>
      </a>
    )
  }
  return (
    <button type="button" onClick={p.onClick} className={className} aria-label={p.label} title={p.label}>
      {p.icon}
      <span className="hidden sm:inline">{p.label}</span>
    </button>
  )
}

function MessengerHandbookLink() {
  return (
    <Link
      href={MESSENGER_HANDBOOK_CHAT_HREF}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-muted"
      aria-label="Messenger-Handbuch"
      title="Messenger-Handbuch"
    >
      <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="hidden sm:inline">Handbuch</span>
    </Link>
  )
}

export function ChatViewChatHeader(p: ChatViewChatHeaderProps) {
  const {
    isPrivate,
    encrypted,
    apiStatus,
    deviceTimeTrustWarn = false,
    vaultBannerActions,
    channelMode,
    sendPath,
    onOpenSettings,
    basisUnreachable = false,
    statusPollAttempted = true,
    offlineStatus,
    conversationTitle,
    conversationSubtitle,
    compactNative = false,
  } = p

  const channelTitle =
    conversationTitle?.trim() ||
    (channelMode === 'notes'
      ? 'Notizen'
      : channelMode === 'pinnwand'
        ? 'Pinnwand'
        : 'Chats')

  const channelSubtitle = conversationSubtitle?.trim() || null
  const showHandbook = channelMode !== 'notes' && !compactNative
  const showTreasuryBadge = isPrivate && Boolean(apiStatus) && channelMode !== 'pinnwand'
  const showSendPathInHeader = sendPath?.visible && !compactNative

  const queuePending = offlineStatus?.queuePending ?? 0
  const showQueueOnlyBanner =
    isPrivate && statusPollAttempted && basisUnreachable && queuePending > 0

  return (
    <>
      <section
        className={cn(
          'rounded-xl border border-border/60 bg-card/30',
          compactNative ? 'p-2' : 'p-3 sm:p-4'
        )}
        aria-label="Chat-Kopf"
      >
        <div className={cn(compactNative ? 'space-y-2' : 'space-y-3')}>
          <div
            className={cn(
              'sticky top-0 z-30 border-b border-border/50 bg-card/95 backdrop-blur-sm',
              compactNative ? '-mx-2 px-2 pb-2' : '-mx-3 px-3 pb-3 sm:-mx-4 sm:px-4'
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 gap-2">
                {!compactNative ? (
                  <div
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                      encrypted ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                    )}
                    aria-hidden
                  >
                    {encrypted ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
                  </div>
                ) : null}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h2
                      className={cn(
                        'font-bold leading-tight text-foreground',
                        compactNative ? 'text-base' : 'text-lg sm:text-xl'
                      )}
                    >
                      {channelTitle}
                    </h2>
                    <ChatNetworkBadge />
                    {!compactNative ? <ActiveProfileBadge status={apiStatus} compact /> : null}
                  </div>
                  {channelSubtitle ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{channelSubtitle}</p>
                  ) : null}
                </div>
              </div>
              {(showHandbook || onOpenSettings) ? (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {showHandbook ? <MessengerHandbookLink /> : null}
                  {onOpenSettings ? (
                    <HeaderToolbarButton
                      label="Einstellungen"
                      icon={<Settings className="h-4 w-4 shrink-0" aria-hidden />}
                      onClick={onOpenSettings}
                    />
                  ) : null}
                  {showTreasuryBadge && apiStatus ? (
                    <TresorSessionBadge
                      sessionLocked={!!apiStatus.locked}
                      hasKeys={isMessengerSessionKeysReady(apiStatus)}
                      actions={vaultBannerActions}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {showSendPathInHeader ? <ChatViewSendPathCompact {...sendPath} className="w-full" /> : null}

          {channelMode === 'pinnwand' || channelMode === 'notes' ? (
            <div className="rounded-lg border border-border/40 bg-muted/15 px-3 py-2.5 text-sm text-muted-foreground">
              {channelMode === 'pinnwand'
                ? 'Pinnwand — nur Online (IOTA), Klartext. Nachrichten oben, Senden unten.'
                : 'Notizen — Tresor-Inhalt lokal im Vault; kein Sendeweg.'}
            </div>
          ) : null}
        </div>
      </section>

      {p.afterPulse}

      {showQueueOnlyBanner ? (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          <strong className="font-semibold">Warteschlange:</strong> {queuePending} Nachricht
          {queuePending === 1 ? '' : 'en'} warten auf Versand, sobald die Basis wieder erreichbar ist.
        </div>
      ) : null}

      {isPrivate && deviceTimeTrustWarn && (
        <div className="rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-sm text-sky-950 dark:text-sky-100">
          <strong className="font-semibold">Geräte-Uhr:</strong> Keine abgesicherte Referenzzeit (frischer{' '}
          <span className="font-mono text-xs">Date</span>-Header der Basis oder GPS-UTC). Zeitstempel in Export,
          Protokoll und Attestation können <strong>abweichen</strong>.
        </div>
      )}

      {isPrivate && apiStatus?.locked === true && (
        <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          <strong className="font-semibold">Tresor gesperrt (API-Sitzung).</strong> Startseite öffnen und erneut
          entsperren — ohne entsperrten Tresor sind Signieren und Senden nicht möglich.
        </div>
      )}
    </>
  )
}
