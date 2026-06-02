'use client'

/**
 * Kompakte Sendepfad-Auswahl (online / funk / ad-hoc / telegram) — Chat-Kopfzeile.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import {
  isSendPathAllowedForChannel,
  sendPathDisabledReason,
} from '@/frontend/lib/messenger-channel-send-path'
import { ChatViewEncryptionContextHint } from '@/frontend/components/chat-view-encryption-context-hint'
import { ChatViewMyWalletIdInline } from '@/frontend/components/chat-view-my-wallet-id-inline'
import { showTelegramDeliveryInHeader } from '@/frontend/lib/composer-delivery-channel'

export type ChatViewSendPathCompactProps = {
  /** Pinnwand: nur wenn Klartext; privater Chat: immer. */
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
}

const ONLINE = {
  id: 'internet' as const,
  icon: '🌍',
  short: 'online',
  title: 'Online (IOTA/Mailbox)',
}

const FUNK = {
  id: 'mesh' as const,
  icon: '📡',
  short: 'funk',
  title: 'Funk (Meshtastic — 1:1 Node oder Gruppen-Secondary-Channel)',
}

const ADHOC = {
  id: 'adhoc' as const,
  icon: '📱',
  short: 'adhoc',
  title: 'Ad-hoc (1:1, BLE — Platzhalter)',
}

const TELEGRAM = {
  short: 'telegram',
  title: 'Telegram (1:1, mehrere Chat-IDs möglich)',
}

function selectCleartextTransport(
  encrypted: boolean,
  target: ForcedTransport,
  onEncryptedChange: ((v: boolean) => void) | undefined,
  onForcedTransportChange: (t: ForcedTransport) => void,
  onComposerDeliveryChange?: (d: ComposerDeliveryChannel) => void
) {
  onComposerDeliveryChange?.('chain')
  if (target === 'internet') {
    onForcedTransportChange('internet')
    return
  }
  if (target === 'mesh') {
    if (encrypted) {
      const ok = window.confirm(
        '„funk“ = Meshtastic-Klartext (LongFast), nicht Ende-zu-Ende verschlüsselt.\n\nFortfahren? (Verschlüsselung wird ausgeschaltet.)'
      )
      if (!ok) return
    }
    onForcedTransportChange('mesh')
    return
  }
  if (target === 'adhoc') {
    if (encrypted) {
      const ok = window.confirm(
        '„adhoc“ ist für Klartext nahe BLE vorgesehen — nicht verschlüsselt.\n\nVerschlüsselung ausschalten und „adhoc“ wählen?'
      )
      if (!ok) return
      if (!onEncryptedChange) {
        window.alert('Bitte zuerst „Verschlüsselung“ unten auf Klartext stellen, dann „adhoc“ wählen.')
        return
      }
      onEncryptedChange(false)
    }
    onForcedTransportChange('adhoc')
  }
}

function PathButton(p: {
  active: boolean
  disabled?: boolean
  disabledTitle?: string | null
  title: string
  activeClass?: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={p.disabled && p.disabledTitle ? p.disabledTitle : p.title}
      disabled={p.disabled}
      onClick={p.onClick}
      className={cn(
        'rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
        p.disabled && 'cursor-not-allowed opacity-40',
        p.active && !p.disabled
          ? p.activeClass ?? 'border-emerald-600/50 bg-emerald-500/15 text-foreground'
          : 'border-transparent bg-background/80 text-muted-foreground hover:bg-muted'
      )}
    >
      {p.children}
    </button>
  )
}

export function ChatViewSendPathCompact(p: ChatViewSendPathCompactProps) {
  const {
    visible,
    channelMode,
    encrypted,
    forcedTransport,
    onForcedTransportChange,
    onEncryptedChange,
    myAddressLine,
    showAdhocTransport = true,
    composerDelivery = 'chain',
    onComposerDeliveryChange,
  } = p
  if (!visible) return null

  const showTelegram =
    showTelegramDeliveryInHeader({ channelMode }) && Boolean(onComposerDeliveryChange)
  const chainActive = composerDelivery === 'chain'

  const onlineOk = isSendPathAllowedForChannel(channelMode, 'internet')
  const funkOk = isSendPathAllowedForChannel(channelMode, 'mesh')
  const adhocOk = showAdhocTransport && isSendPathAllowedForChannel(channelMode, 'adhoc')
  const telegramOk = showTelegram && isSendPathAllowedForChannel(channelMode, 'telegram')

  return (
    <div className="flex max-w-full flex-col items-end gap-0 rounded-lg border border-border/60 bg-muted/25 px-2 py-1.5">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <span className="hidden text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
          Sendepfad
        </span>
        <span className="hidden h-4 w-px bg-border sm:inline" aria-hidden />
        <PathButton
          active={chainActive && forcedTransport === ONLINE.id}
          disabled={!onlineOk}
          disabledTitle={sendPathDisabledReason(channelMode, 'internet')}
          title={ONLINE.title}
          onClick={() => {
            onComposerDeliveryChange?.('chain')
            onForcedTransportChange(ONLINE.id)
          }}
        >
          <span className="mr-0.5" aria-hidden>
            {ONLINE.icon}
          </span>
          {ONLINE.short}
        </PathButton>
        <PathButton
          active={chainActive && forcedTransport === FUNK.id}
          disabled={!funkOk}
          disabledTitle={sendPathDisabledReason(channelMode, 'mesh')}
          title={FUNK.title}
          activeClass="border-sky-600/50 bg-sky-500/15 text-foreground"
          onClick={() =>
            selectCleartextTransport(
              encrypted,
              FUNK.id,
              onEncryptedChange,
              onForcedTransportChange,
              onComposerDeliveryChange
            )
          }
        >
          <span className="mr-0.5" aria-hidden>
            {FUNK.icon}
          </span>
          {FUNK.short}
        </PathButton>
        {showAdhocTransport ? (
          <>
            <span className="hidden h-4 w-px bg-border/80 sm:inline" aria-hidden />
            <PathButton
              active={chainActive && forcedTransport === ADHOC.id}
              disabled={!adhocOk}
              disabledTitle={sendPathDisabledReason(channelMode, 'adhoc')}
              title={ADHOC.title}
              activeClass="border-amber-600/45 bg-amber-500/12 text-foreground"
              onClick={() =>
                selectCleartextTransport(
                  encrypted,
                  ADHOC.id,
                  onEncryptedChange,
                  onForcedTransportChange,
                  onComposerDeliveryChange
                )
              }
            >
              <span className="mr-0.5" aria-hidden>
                {ADHOC.icon}
              </span>
              {ADHOC.short}
            </PathButton>
          </>
        ) : null}
        {showTelegram ? (
          <>
            <span className="hidden h-4 w-px bg-border/80 sm:inline" aria-hidden />
            <PathButton
              active={composerDelivery === 'telegram'}
              disabled={!telegramOk}
              disabledTitle={sendPathDisabledReason(channelMode, 'telegram')}
              title={TELEGRAM.title}
              activeClass="border-sky-600/50 bg-sky-500/15 text-foreground"
              onClick={() => onComposerDeliveryChange?.('telegram')}
            >
              <span className="mr-0.5" aria-hidden>
                ✈️
              </span>
              {TELEGRAM.short}
            </PathButton>
          </>
        ) : null}
      </div>
      {chainActive ? (
        <ChatViewEncryptionContextHint
          forcedTransport={forcedTransport}
          encrypted={encrypted}
          compact
          className="mt-1 max-w-[18rem] text-right"
        />
      ) : null}
      {chainActive && myAddressLine?.trim() ? (
        <ChatViewMyWalletIdInline myAddressLine={myAddressLine} />
      ) : null}
    </div>
  )
}
