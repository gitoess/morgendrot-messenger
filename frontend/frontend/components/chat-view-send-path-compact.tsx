'use client'

/**
 * Sendepfad (online / funk / telegram) + dynamische Empfänger-Buttons nach Pfad-Klick.
 */

import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SEND_PATH_ACTIVE_CLASS } from '@/frontend/lib/messenger-appearance-theme'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import {
  isSendPathAllowedForChannel,
  resolveActiveSendPath,
  sendPathDisabledReason,
} from '@/frontend/lib/messenger-channel-send-path'
import { showTelegramDeliveryInHeader } from '@/frontend/lib/composer-delivery-channel'
import type { ApiStatus } from '@/frontend/lib/api/status'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { InboxPartnerOption } from '@/frontend/components/chat-view-inbox-partner-strip'
import {
  composerSendPathWriteDeniedReason,
  type ComposerSendPathKey,
} from '@/frontend/lib/messenger-capability-gates'
import {
  collectContactsForSendPath,
  formatAllRecipientsForSendPath,
} from '@/frontend/lib/contact-send-path'
import { readHiddenContacts } from '@/frontend/lib/contact-phonebook-meta-store'
import {
  ChatViewSendPathRecipientPicker,
  type ChatViewSendPathRecipientPickerProps,
} from '@/frontend/components/chat-view-send-path-recipient-picker'
export type ChatViewSendPathCompactProps = {
  visible: boolean
  channelMode: MessengerChatChannel
  encrypted: boolean
  forcedTransport: ForcedTransport
  onForcedTransportChange: (t: ForcedTransport) => void
  onEncryptedChange?: (encrypted: boolean) => void
  showAdhocTransport?: boolean
  composerDelivery?: ComposerDeliveryChannel
  onComposerDeliveryChange?: (d: ComposerDeliveryChannel) => void
  apiStatus?: ApiStatus | null
  role?: string
  onChannelModeChange?: (c: MessengerChatChannel) => void
  onRecipientChange?: (v: string) => void
  contactDirectory?: Record<string, ContactMeshEntryClient>
  partnerOptions?: readonly InboxPartnerOption[]
  pinnwandTabUnreadCount?: number
  className?: string
}

function sendPathCapabilityReason(
  apiStatus: ApiStatus | null | undefined,
  path: ComposerSendPathKey
): string | null {
  if (!apiStatus?.capabilities) return null
  return composerSendPathWriteDeniedReason(apiStatus, path)
}

const ONLINE = {
  id: 'internet' as const,
  icon: '🌍',
  short: 'Online',
  title: 'Online (IOTA/Mailbox)',
}

const FUNK = {
  id: 'mesh' as const,
  icon: '📡',
  short: 'Funk',
  title: 'Funk (Meshtastic)',
}

const ADHOC = {
  id: 'adhoc' as const,
  icon: '📱',
  short: 'Ad-hoc',
  title: 'Ad-hoc (BLE — Platzhalter)',
}

const TELEGRAM = {
  short: 'Telegram',
  title: 'Telegram (1:1 oder Alle)',
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
        '„Funk“ = Meshtastic-Klartext (LongFast), nicht Ende-zu-Ende verschlüsselt.\n\nFortfahren? (Verschlüsselung wird ausgeschaltet.)'
      )
      if (!ok) return
    }
    onForcedTransportChange('mesh')
    return
  }
  if (target === 'adhoc') {
    if (encrypted) {
      const ok = window.confirm(
        '„Ad-hoc“ ist für Klartext nahe BLE vorgesehen — nicht verschlüsselt.\n\nVerschlüsselung ausschalten und „Ad-hoc“ wählen?'
      )
      if (!ok) return
      if (!onEncryptedChange) {
        window.alert('Bitte zuerst „Verschlüsselung“ auf Klartext stellen, dann „Ad-hoc“ wählen.')
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
        'flex min-h-[2.75rem] flex-1 items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-colors sm:text-base',
        p.disabled && 'cursor-not-allowed opacity-40',
        p.active && !p.disabled
          ? p.activeClass ?? SEND_PATH_ACTIVE_CLASS.default
          : 'border-border/70 bg-card/90 text-foreground hover:bg-muted/60'
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
    showAdhocTransport = true,
    composerDelivery = 'chain',
    onComposerDeliveryChange,
    apiStatus,
    role = '',
    onChannelModeChange,
    onRecipientChange,
    contactDirectory = {},
    partnerOptions = [],
    pinnwandTabUnreadCount = 0,
    className,
  } = p

  const [recipientPanelOpen, setRecipientPanelOpen] = useState(false)

  if (!visible) return null

  const showTelegram =
    showTelegramDeliveryInHeader({ channelMode }) && Boolean(onComposerDeliveryChange)
  const chainActive = composerDelivery === 'chain'
  const activeSendPath = resolveActiveSendPath(composerDelivery, forcedTransport)

  const onlineChannelOk = isSendPathAllowedForChannel(channelMode, 'internet')
  const funkChannelOk = isSendPathAllowedForChannel(channelMode, 'mesh')
  const adhocChannelOk = showAdhocTransport && isSendPathAllowedForChannel(channelMode, 'adhoc')
  const telegramChannelOk = showTelegram && isSendPathAllowedForChannel(channelMode, 'telegram')

  const onlineCapReason = sendPathCapabilityReason(apiStatus, 'internet')
  const funkCapReason = sendPathCapabilityReason(apiStatus, 'mesh')
  const adhocCapReason = sendPathCapabilityReason(apiStatus, 'adhoc')
  const telegramCapReason = sendPathCapabilityReason(apiStatus, 'telegram')

  const openPanel = () => setRecipientPanelOpen(true)

  const recipientPickerProps: ChatViewSendPathRecipientPickerProps | null =
    onChannelModeChange && recipientPanelOpen
      ? {
          activeSendPath,
          channelMode,
          role,
          apiStatus,
          pinnwandTabUnreadCount,
          telegramAllActive: false,
          onSelectChannel: (c) => onChannelModeChange(c),
          onSelectTelegramAll: () => {
            onChannelModeChange('private')
            onComposerDeliveryChange?.('telegram')
            const contacts = collectContactsForSendPath({
              directory: contactDirectory,
              partnerOptions,
              path: 'telegram',
              hidden: readHiddenContacts(),
            })
            const { recipient } = formatAllRecipientsForSendPath(contacts, 'telegram')
            onRecipientChange?.(recipient)
          },
        }
      : null

  return (
    <div
      className={cn(
        'flex w-full flex-col rounded-xl border border-border/60 bg-muted/25 px-3 py-3',
        className
      )}
    >
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Sendepfad</p>
      <div className="flex flex-nowrap gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Sendepfad">
        <PathButton
          active={chainActive && forcedTransport === ONLINE.id}
          disabled={!onlineChannelOk || Boolean(onlineCapReason)}
          disabledTitle={onlineCapReason ?? sendPathDisabledReason(channelMode, 'internet')}
          title={ONLINE.title}
          activeClass={SEND_PATH_ACTIVE_CLASS.online}
          onClick={() => {
            openPanel()
            onComposerDeliveryChange?.('chain')
            onForcedTransportChange(ONLINE.id)
          }}
        >
          <span aria-hidden>{ONLINE.icon}</span>
          {ONLINE.short}
        </PathButton>
        <PathButton
          active={chainActive && forcedTransport === FUNK.id}
          disabled={!funkChannelOk || Boolean(funkCapReason)}
          disabledTitle={funkCapReason ?? sendPathDisabledReason(channelMode, 'mesh')}
          title={FUNK.title}
          activeClass={SEND_PATH_ACTIVE_CLASS.mesh}
          onClick={() => {
            openPanel()
            selectCleartextTransport(
              encrypted,
              FUNK.id,
              onEncryptedChange,
              onForcedTransportChange,
              onComposerDeliveryChange
            )
          }}
        >
          <span aria-hidden>{FUNK.icon}</span>
          {FUNK.short}
        </PathButton>
        {showAdhocTransport ? (
          <PathButton
            active={chainActive && forcedTransport === ADHOC.id}
            disabled={!adhocChannelOk || Boolean(adhocCapReason)}
            disabledTitle={adhocCapReason ?? sendPathDisabledReason(channelMode, 'adhoc')}
            title={ADHOC.title}
            activeClass={SEND_PATH_ACTIVE_CLASS.adhoc}
            onClick={() => {
              openPanel()
              selectCleartextTransport(
                encrypted,
                ADHOC.id,
                onEncryptedChange,
                onForcedTransportChange,
                onComposerDeliveryChange
              )
            }}
          >
            <span aria-hidden>{ADHOC.icon}</span>
            {ADHOC.short}
          </PathButton>
        ) : null}
        {showTelegram ? (
          <PathButton
            active={composerDelivery === 'telegram'}
            disabled={!telegramChannelOk || Boolean(telegramCapReason)}
            disabledTitle={telegramCapReason ?? sendPathDisabledReason(channelMode, 'telegram')}
            title={TELEGRAM.title}
            activeClass={SEND_PATH_ACTIVE_CLASS.telegram}
            onClick={() => {
              openPanel()
              onComposerDeliveryChange?.('telegram')
            }}
          >
            <span aria-hidden>✈️</span>
            {TELEGRAM.short}
          </PathButton>
        ) : null}
      </div>
      {recipientPickerProps ? <ChatViewSendPathRecipientPicker {...recipientPickerProps} /> : null}
    </div>
  )
}
