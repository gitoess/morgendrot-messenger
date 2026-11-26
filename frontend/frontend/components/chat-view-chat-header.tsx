'use client'

/**
 * Chat-Kopf: Kanal/Toolbar oben, Sendepfad darunter.
 */

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Bell, BellOff, BookOpen, Inbox, Lock, RefreshCw, Settings, StickyNote, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api'
import { isBrowserSessionSignerReady } from '@/frontend/lib/messenger-session-keys-ready'
import {
  isPrivacySoftLocked,
  PRIVACY_SOFT_LOCK_CHANGED_EVENT,
} from '@/frontend/lib/privacy-soft-lock'
import {
  hasVaultPasswordSession,
  VAULT_PASSWORD_SESSION_CHANGED,
} from '@/frontend/lib/vault-password-session'
import { PASSPHRASE_MESSAGE_VAULT_CHANGED_EVENT } from '@/frontend/lib/passphrase-message-local-store'
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
import { useAppTranslation } from '@/frontend/lib/i18n/hooks'

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
  /** Tresor-Notizen — rechts neben Einstellungen / Vault. */
  onOpenNotes?: () => void
  vaultBannerActions?: ChatViewVaultBannerActions
  channelMode?: MessengerChatChannel
  onChannelModeChange?: (c: MessengerChatChannel) => void
  /** Kontext aus Sidebar-Auswahl — ersetzt generischen Modus-Titel. */
  conversationTitle?: string | null
  conversationSubtitle?: string | null
  conversationIcon?: 'lock' | 'inbox'
  afterPulse?: ReactNode
  offlineStatus?: OfflineStatusSnapshot
  pinnwandTabUnreadCount?: number
  /** APK: schlanke Kopfzeile — Sendepfad und Handbuch ausblenden (liegen unten). */
  compactNative?: boolean
  /**
   * Unter festem App-Header (Boss): kein zweites Handbuch/Einstellungen/Vault/Netz-Badge.
   * Notizen bleibt (Chat-Kontext).
   */
  suppressAppChrome?: boolean
  /** Kein Titel/Icon (Sidebar-Layout: Posteingang bündig mit Chats). */
  hideTitleRow?: boolean
  /** T53: Eingangs-Ton für diesen Chat stumm (localStorage). */
  chatMuted?: boolean
  onToggleChatMute?: () => void
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
  const [softLocked, setSoftLocked] = useState(() => isPrivacySoftLocked())
  const [vaultSessionOpen, setVaultSessionOpen] = useState(() => hasVaultPasswordSession())
  useEffect(() => {
    const sync = () => {
      setSoftLocked(isPrivacySoftLocked())
      setVaultSessionOpen(hasVaultPasswordSession())
    }
    sync()
    window.addEventListener(PRIVACY_SOFT_LOCK_CHANGED_EVENT, sync)
    window.addEventListener(PASSPHRASE_MESSAGE_VAULT_CHANGED_EVENT, sync)
    window.addEventListener(VAULT_PASSWORD_SESSION_CHANGED, sync)
    return () => {
      window.removeEventListener(PRIVACY_SOFT_LOCK_CHANGED_EVENT, sync)
      window.removeEventListener(PASSPHRASE_MESSAGE_VAULT_CHANGED_EVENT, sync)
      window.removeEventListener(VAULT_PASSWORD_SESSION_CHANGED, sync)
    }
  }, [])
  const effectivelyLocked = sessionLocked || softLocked
  const ui = tresorSessionUi(effectivelyLocked, hasKeys)
  /** F5 / nie getippt: Keys oft da, Browser-PW fehlt — UI = gesperrt, Klick = Unlock. */
  const needsVaultPassword = ui === 'ready' && !vaultSessionOpen
  /** Nur zwei sichtbare Labels: bereit | gesperrt (Details nur im title). */
  const showReady = ui === 'ready' && !needsVaultPassword
  const shellClass = cn(
    'inline-flex max-w-[min(100%,16rem)] items-center gap-1.5 truncate rounded-md border px-2.5 py-1.5 text-xs font-bold shadow-sm',
    showReady
      ? 'border-emerald-600/55 bg-emerald-100 text-emerald-950 dark:border-emerald-400/50 dark:bg-emerald-950/90 dark:text-emerald-50'
      : 'border-amber-600/55 bg-amber-100 text-amber-950 dark:border-amber-400/50 dark:bg-amber-950/90 dark:text-amber-50'
  )
  const passiveTitle = showReady
    ? 'Tresor bereit — Keys + Browser-Passwort ok. Tippen = Soft-Pause.'
    : needsVaultPassword
      ? 'Gesperrt — Browser-Passwort fehlt (z. B. nach F5). Tippen → Passwort.'
      : softLocked && !sessionLocked
        ? 'Gesperrt (Pause) — Keys im RAM. Tippen → Passwort → Weitersprechen.'
        : ui === 'no-keys'
          ? 'Gesperrt — Signer fehlt. Tippen → Passwort.'
          : 'Tresor gesperrt — Tippen → Entsperren.'
  const activeTitle = showReady
    ? 'Soft-Pause: ausgrauen, Keys im RAM; Weitersprechen mit Passwort. Abmelden = alles weg.'
    : 'Tresor-Passwort eingeben (Unlock).'

  const icon = showReady ? (
    <Unlock className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
  ) : (
    <Lock className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
  )
  const label = (
    <span className="truncate font-semibold">{showReady ? 'Tresor: bereit' : 'Tresor: gesperrt'}</span>
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
      aria-label={showReady ? 'Tresor sperren (Soft-Pause)' : 'Tresor-Passwort eingeben'}
      onClick={() => {
        if (!showReady) {
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
  title?: string
}) {
  const className =
    'inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-muted'
  const tip = p.title || p.label
  if (p.href) {
    return (
      <a href={p.href} className={className} aria-label={p.label} title={tip}>
        {p.icon}
        <span className="hidden sm:inline">{p.label}</span>
      </a>
    )
  }
  return (
    <button type="button" onClick={p.onClick} className={className} aria-label={p.label} title={tip}>
      {p.icon}
      <span>{p.label}</span>
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
  const { t } = useAppTranslation('dashboard')
  const {
    isPrivate,
    encrypted,
    apiStatus,
    deviceTimeTrustWarn = false,
    vaultBannerActions,
    channelMode,
    sendPath,
    onOpenSettings,
    onOpenNotes,
    basisUnreachable = false,
    statusPollAttempted = true,
    offlineStatus,
    conversationTitle,
    conversationSubtitle,
    conversationIcon = 'lock',
    compactNative = false,
    suppressAppChrome = false,
    hideTitleRow = false,
    onRefreshStatus,
    chatMuted = false,
    onToggleChatMute,
  } = p

  const channelTitle =
    conversationTitle?.trim() ||
    (channelMode === 'notes'
      ? 'Notizen'
      : channelMode === 'pinnwand'
        ? 'Pinnwand'
        : 'Chats')

  const channelSubtitle = conversationSubtitle?.trim() || null
  const showHandbook = channelMode !== 'notes' && !compactNative && !suppressAppChrome
  /** Bei Einsatz-App-Header: Tresor/Aktualisieren nur dort — hier nicht doppelt. */
  const showTreasuryBadge =
    !suppressAppChrome && Boolean(apiStatus) && channelMode !== 'pinnwand'
  const showProfileBadges = !suppressAppChrome && !compactNative
  const showSendPathInHeader = sendPath?.visible && !compactNative
  const showSettingsBtn = Boolean(onOpenSettings) && !suppressAppChrome
  /** App-Header hat Aktualisieren bei suppressAppChrome; sonst hier neben Tresor. */
  const showHeaderRefresh = Boolean(onRefreshStatus) && !suppressAppChrome
  const useInboxIcon = conversationIcon === 'inbox' || channelMode === 'pinnwand' || channelMode === 'notes'
  const showTitleBlock = !hideTitleRow

  const queuePending = offlineStatus?.queuePending ?? 0
  const showQueueOnlyBanner =
    isPrivate && statusPollAttempted && basisUnreachable && queuePending > 0

  const showChromeActions =
    showHeaderRefresh ||
    showTreasuryBadge ||
    showHandbook ||
    (onOpenNotes && channelMode === 'notes') ||
    showSettingsBtn ||
    Boolean(onToggleChatMute)

  return (
    <>
      <section
        className={cn(
          'rounded-xl border border-border/60 bg-card/30',
          compactNative ? 'p-2' : hideTitleRow && !showChromeActions ? 'p-2 sm:p-3' : 'p-3 sm:p-4'
        )}
        aria-label="Chat-Kopf"
      >
        <div className={cn(compactNative ? 'space-y-2' : 'space-y-3')}>
          {showTitleBlock || showChromeActions ? (
            <div
              className={cn(
                showTitleBlock &&
                  'sticky top-0 z-30 border-b border-border/50 bg-card/95 backdrop-blur-sm',
                showTitleBlock &&
                  (compactNative ? '-mx-2 px-2 pb-2' : '-mx-3 px-3 pb-3 sm:-mx-4 sm:px-4')
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                {showTitleBlock ? (
                  <div className="flex min-w-0 gap-2">
                    {!compactNative ? (
                      <div
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                          useInboxIcon
                            ? 'bg-muted text-foreground'
                            : encrypted
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-amber-500/10 text-amber-400'
                        )}
                        aria-hidden
                      >
                        {useInboxIcon ? (
                          <Inbox className="h-5 w-5" />
                        ) : encrypted ? (
                          <Lock className="h-5 w-5" />
                        ) : (
                          <Unlock className="h-5 w-5" />
                        )}
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
                        {onToggleChatMute ? (
                          <button
                            type="button"
                            onClick={onToggleChatMute}
                            className={cn(
                              'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                              chatMuted
                                ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                                : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground'
                            )}
                            title={chatMuted ? t('chatMute.titleUnmute') : t('chatMute.titleMute')}
                            aria-pressed={chatMuted}
                            aria-label={chatMuted ? t('chatMute.ariaUnmute') : t('chatMute.ariaMute')}
                          >
                            {chatMuted ? (
                              <BellOff className="h-3 w-3" aria-hidden />
                            ) : (
                              <Bell className="h-3 w-3" aria-hidden />
                            )}
                            {chatMuted ? t('chatMute.off') : t('chatMute.on')}
                          </button>
                        ) : null}
                        {showProfileBadges ? <ChatNetworkBadge /> : null}
                        {showProfileBadges ? <ActiveProfileBadge status={apiStatus} compact /> : null}
                      </div>
                      {channelSubtitle ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{channelSubtitle}</p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="min-w-0 flex-1" />
                )}
                <div className="flex max-w-full flex-col items-stretch gap-2 sm:max-w-none sm:items-end">
                  {onToggleChatMute && hideTitleRow ? (
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={onToggleChatMute}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors',
                          chatMuted
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                            : 'border-border bg-card text-muted-foreground hover:text-foreground'
                        )}
                        title={chatMuted ? t('chatMute.titleUnmute') : t('chatMute.titleMute')}
                        aria-pressed={chatMuted}
                        aria-label={chatMuted ? t('chatMute.ariaUnmute') : t('chatMute.ariaMute')}
                      >
                        {chatMuted ? (
                          <BellOff className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Bell className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {chatMuted ? t('chatMute.off') : t('chatMute.on')}
                      </button>
                    </div>
                  ) : null}
                  {showHeaderRefresh || showTreasuryBadge ? (
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {showTreasuryBadge && apiStatus ? (
                        <TresorSessionBadge
                          sessionLocked={!!apiStatus.locked}
                          /** Grün nur mit Browser-Signer — Server-hasKeys allein war nach Login falsch grün. */
                          hasKeys={isBrowserSessionSignerReady(!!apiStatus.locked)}
                          actions={vaultBannerActions}
                        />
                      ) : null}
                      {showHeaderRefresh ? (
                        <button
                          type="button"
                          onClick={() => void onRefreshStatus?.()}
                          className="inline-flex items-center gap-1.5 rounded-md border border-foreground/25 bg-foreground px-3 py-2 text-xs font-bold text-background shadow-sm transition-colors hover:bg-foreground/90"
                          title="Status, Posteingang und Kontakte neu laden"
                          aria-label="Aktualisieren"
                        >
                          <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
                          Aktualisieren
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {showHandbook || onOpenNotes || showSettingsBtn ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {showHandbook ? <MessengerHandbookLink /> : null}
                      {onOpenNotes && channelMode === 'notes' ? (
                        <HeaderToolbarButton
                          label="Zu Chats"
                          icon={<StickyNote className="h-4 w-4 shrink-0" aria-hidden />}
                          onClick={onOpenNotes}
                          title="Zurück zum Posteingang"
                        />
                      ) : null}
                      {showSettingsBtn ? (
                        <HeaderToolbarButton
                          label="Einstellungen"
                          icon={<Settings className="h-4 w-4 shrink-0" aria-hidden />}
                          onClick={onOpenSettings}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

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
          <strong className="font-semibold">Tresor gesperrt (API-Sitzung).</strong> Badge tippen zum Entsperren —
          ohne entsperrten Tresor sind Signieren und Senden nicht möglich.
        </div>
      )}
    </>
  )
}
