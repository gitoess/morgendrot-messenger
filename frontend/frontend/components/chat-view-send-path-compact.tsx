'use client'

/**
 * Sendepfad (Online / Funk / Telegram) — nur Transportwahl; Empfänger kommt aus der Chat-Sidebar.
 */

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SEND_PATH_ACTIVE_CLASS } from '@/frontend/lib/messenger-appearance-theme'
import type { ComposerDeliveryChannel } from '@/frontend/lib/composer-delivery-channel'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import {
  isSendPathAllowedForChannel,
  sendPathDisabledReason,
} from '@/frontend/lib/messenger-channel-send-path'
import type { ApiStatus } from '@/frontend/lib/api/status'
import {
  composerSendPathWriteDeniedReason,
  type ComposerSendPathKey,
} from '@/frontend/lib/messenger-capability-gates'
import { messengerTransportMeta } from '@/frontend/lib/messenger-send-path-icons'

export type ChatViewSendPathCompactProps = {
  visible: boolean
  channelMode: MessengerChatChannel
  encrypted: boolean
  forcedTransport: ForcedTransport
  onForcedTransportChange: (t: ForcedTransport) => void
  onEncryptedChange?: (encrypted: boolean) => void
  /** Ad-hoc BLE — Default aus (Backlog). */
  showAdhocTransport?: boolean
  /** Sendepfad „IOTA“: Fokus Posteingang/Kontakte auf Chain. */
  iotaPathFocus?: boolean
  onIotaPathFocusChange?: (focus: boolean) => void
  composerDelivery?: ComposerDeliveryChannel
  onComposerDeliveryChange?: (d: ComposerDeliveryChannel) => void
  apiStatus?: ApiStatus | null
  /** Nur für Telegram in Gruppenmodus: zurück auf 1:1 wechseln. */
  onChannelModeChange?: (c: MessengerChatChannel) => void
  className?: string
  /** Native: 2×2-Grid statt Horizontal-Scroll. */
  layout?: 'scroll' | 'grid'
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
  short: messengerTransportMeta('internet').label,
  title: 'Alle — gesamter Posteingang; Senden über Internet (ohne IOTA-Fokus)',
}

const FUNK = {
  id: 'mesh' as const,
  short: messengerTransportMeta('mesh').label,
  title: 'Funk (Meshtastic)',
}

const ADHOC = {
  id: 'adhoc' as const,
  short: messengerTransportMeta('adhoc').label,
  title: 'Ad-hoc (BLE — Platzhalter)',
}

const IOTA = {
  short: messengerTransportMeta('iota').label,
  title: 'IOTA — nur Chain/Mailbox (Nachrichten, Kontakte, Filter)',
}

const TELEGRAM = {
  short: messengerTransportMeta('telegram').label,
  title: 'Telegram (1:1 oder Alarmgruppe)',
}

function PathIcon({ k }: { k: 'internet' | 'mesh' | 'adhoc' | 'telegram' | 'iota' }) {
  const { Icon } = messengerTransportMeta(k)
  return <Icon className="h-4 w-4 shrink-0" aria-hidden />
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
  gridLayout?: boolean
}) {
  return (
    <button
      type="button"
      title={p.disabled && p.disabledTitle ? p.disabledTitle : p.title}
      disabled={p.disabled}
      onClick={p.onClick}
      className={cn(
        'flex min-h-[2.75rem] items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-colors sm:text-base',
        p.gridLayout ? 'w-full' : 'flex-1',
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
    showAdhocTransport = false,
    iotaPathFocus = false,
    onIotaPathFocusChange,
    composerDelivery = 'chain',
    onComposerDeliveryChange,
    apiStatus,
    onChannelModeChange,
    className,
    layout,
  } = p

  if (!visible) return null

  /** Immer Grid — kein horizontaler Schiebebalken bei schmaler Breite. */
  const gridLayout = layout !== 'row'

  const showTelegramPath = Boolean(onComposerDeliveryChange)
  const chainActive = composerDelivery === 'chain'
  const clearIotaFocus = () => onIotaPathFocusChange?.(false)

  const onlineChannelOk = isSendPathAllowedForChannel(channelMode, 'internet')
  const funkChannelOk = isSendPathAllowedForChannel(channelMode, 'mesh')
  const adhocChannelOk = showAdhocTransport && isSendPathAllowedForChannel(channelMode, 'adhoc')
  const telegramChannelOk = isSendPathAllowedForChannel(channelMode, 'telegram')
  const iotaChannelOk = isSendPathAllowedForChannel(channelMode, 'internet')

  const onlineCapReason = sendPathCapabilityReason(apiStatus, 'internet')
  const funkCapReason = sendPathCapabilityReason(apiStatus, 'mesh')
  const adhocCapReason = sendPathCapabilityReason(apiStatus, 'adhoc')
  const telegramCapReason = sendPathCapabilityReason(apiStatus, 'telegram')
  const iotaCapReason = sendPathCapabilityReason(apiStatus, 'internet')

  return (
    <div
      className={cn(
        'flex w-full flex-col overflow-x-hidden rounded-xl border border-border/60 bg-muted/25 px-3 py-3',
        className
      )}
    >
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Sendepfad</p>
      <div
        className={cn(
          'overflow-x-hidden',
          gridLayout
            ? showAdhocTransport
              ? 'grid grid-cols-2 gap-2 sm:grid-cols-3'
              : 'grid grid-cols-2 gap-2 sm:grid-cols-4'
            : 'flex flex-wrap gap-2'
        )}
        role="group"
        aria-label="Sendepfad"
      >
        <PathButton
          gridLayout={gridLayout}
          active={chainActive && forcedTransport === ONLINE.id && !iotaPathFocus}
          disabled={!onlineChannelOk || Boolean(onlineCapReason)}
          disabledTitle={onlineCapReason ?? sendPathDisabledReason(channelMode, 'internet')}
          title={ONLINE.title}
          activeClass={SEND_PATH_ACTIVE_CLASS.online}
          onClick={() => {
            clearIotaFocus()
            onComposerDeliveryChange?.('chain')
            onForcedTransportChange(ONLINE.id)
          }}
        >
          <PathIcon k="internet" />
          {ONLINE.short}
        </PathButton>
        <PathButton
          gridLayout={gridLayout}
          active={chainActive && forcedTransport === FUNK.id}
          disabled={!funkChannelOk || Boolean(funkCapReason)}
          disabledTitle={funkCapReason ?? sendPathDisabledReason(channelMode, 'mesh')}
          title={FUNK.title}
          activeClass={SEND_PATH_ACTIVE_CLASS.mesh}
          onClick={() => {
            clearIotaFocus()
            selectCleartextTransport(
              encrypted,
              FUNK.id,
              onEncryptedChange,
              onForcedTransportChange,
              onComposerDeliveryChange
            )
          }}
        >
          <PathIcon k="mesh" />
          {FUNK.short}
        </PathButton>
        <PathButton
          gridLayout={gridLayout}
          active={chainActive && forcedTransport === ONLINE.id && iotaPathFocus}
          disabled={!iotaChannelOk || Boolean(iotaCapReason)}
          disabledTitle={iotaCapReason ?? sendPathDisabledReason(channelMode, 'internet')}
          title={IOTA.title}
          activeClass={SEND_PATH_ACTIVE_CLASS.iota}
          onClick={() => {
            /** setIotaPathFocus setzt chain+internet; nicht vorher setForcedTransport (das löscht den Fokus). */
            if (onIotaPathFocusChange) onIotaPathFocusChange(true)
            else {
              onComposerDeliveryChange?.('chain')
              onForcedTransportChange(ONLINE.id)
            }
          }}
        >
          <PathIcon k="iota" />
          {IOTA.short}
        </PathButton>
        {showAdhocTransport ? (
          <PathButton
            gridLayout={gridLayout}
            active={chainActive && forcedTransport === ADHOC.id}
            disabled={!adhocChannelOk || Boolean(adhocCapReason)}
            disabledTitle={adhocCapReason ?? sendPathDisabledReason(channelMode, 'adhoc')}
            title={ADHOC.title}
            activeClass={SEND_PATH_ACTIVE_CLASS.adhoc}
            onClick={() => {
              clearIotaFocus()
              selectCleartextTransport(
                encrypted,
                ADHOC.id,
                onEncryptedChange,
                onForcedTransportChange,
                onComposerDeliveryChange
              )
            }}
          >
            <PathIcon k="adhoc" />
            {ADHOC.short}
          </PathButton>
        ) : null}
        {showTelegramPath ? (
          <PathButton
            gridLayout={gridLayout}
            active={composerDelivery === 'telegram'}
            disabled={!telegramChannelOk || Boolean(telegramCapReason)}
            disabledTitle={telegramCapReason ?? sendPathDisabledReason(channelMode, 'telegram')}
            title={TELEGRAM.title}
            activeClass={SEND_PATH_ACTIVE_CLASS.telegram}
            onClick={() => {
              clearIotaFocus()
              if (channelMode !== 'private') onChannelModeChange?.('private')
              onComposerDeliveryChange?.('telegram')
            }}
          >
            <PathIcon k="telegram" />
            {TELEGRAM.short}
          </PathButton>
        ) : null}
      </div>
    </div>
  )
}
