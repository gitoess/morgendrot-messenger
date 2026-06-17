'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SEND_PATH_ACTIVE_CLASS } from '@/frontend/lib/messenger-appearance-theme'
import type { MessengerChatChannel } from '@/frontend/lib/messenger-chat-channel'
import {
  recipientChoicesForSendPath,
  type SendPathRecipientChoice,
} from '@/frontend/lib/messenger-send-path-recipient-options'
import type { ActiveSendPath } from '@/frontend/lib/messenger-channel-send-path'
import type { ApiStatus } from '@/frontend/lib/api'

export type ChatViewSendPathRecipientPickerProps = {
  activeSendPath: ActiveSendPath
  channelMode: MessengerChatChannel
  role: string
  apiStatus?: ApiStatus | null
  pinnwandTabUnreadCount?: number
  telegramAllActive?: boolean
  onSelectChannel: (channel: MessengerChatChannel) => void
  onSelectTelegramAll: () => void
  className?: string
}

function channelButtonClass(active: boolean, channel: MessengerChatChannel): string {
  if (!active) {
    return 'border-border/70 bg-card/80 text-foreground hover:bg-muted/70'
  }
  if (channel === 'group') return 'border-violet-600/60 bg-violet-600 text-white'
  if (channel === 'pinnwand') return 'border-orange-600/60 bg-orange-600 text-white'
  return 'border-primary/60 bg-primary text-primary-foreground'
}

function RecipientButton(p: {
  active: boolean
  label: string
  unread?: number
  onClick: () => void
  activeClass: string
}) {
  return (
    <button
      type="button"
      onClick={p.onClick}
      className={cn(
        'relative flex min-h-[3rem] w-full items-center justify-center rounded-xl border-2 px-3 py-3 text-base font-bold tracking-tight transition-colors sm:min-h-[3.25rem] sm:text-lg',
        p.active ? p.activeClass : 'border-border/70 bg-card/80 text-foreground hover:bg-muted/70'
      )}
    >
      {p.label}
      {(p.unread ?? 0) > 0 && !p.active ? (
        <span className="absolute -right-1 -top-1 min-w-[1.25rem] rounded-full bg-red-600 px-1 text-[10px] font-bold leading-5 text-white">
          {p.unread! > 99 ? '99+' : p.unread}
        </span>
      ) : null}
    </button>
  )
}

function renderChoice(
  choice: SendPathRecipientChoice,
  p: ChatViewSendPathRecipientPickerProps
): ReactNode {
  if (choice.kind === 'telegram-all') {
    return (
      <RecipientButton
        key="telegram-all"
        label={choice.label}
        active={p.telegramAllActive === true}
        activeClass={SEND_PATH_ACTIVE_CLASS.telegram}
        onClick={p.onSelectTelegramAll}
      />
    )
  }
  const unread = choice.channel === 'pinnwand' ? p.pinnwandTabUnreadCount : 0
  return (
    <RecipientButton
      key={choice.channel}
      label={choice.label}
      unread={unread}
      active={p.channelMode === choice.channel}
      activeClass={channelButtonClass(true, choice.channel)}
      onClick={() => p.onSelectChannel(choice.channel)}
    />
  )
}

export function ChatViewSendPathRecipientPicker(p: ChatViewSendPathRecipientPickerProps) {
  const choices = recipientChoicesForSendPath(p.activeSendPath, p.role, p.apiStatus)
  if (choices.length === 0) return null

  const cols = choices.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'

  return (
    <div className={cn('mt-3 space-y-3', p.className)} role="group" aria-label="Empfänger-Kanal">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Empfänger</p>
      <div className={cn('grid grid-cols-1 gap-2', cols)}>
        {choices.map((choice) => renderChoice(choice, p))}
      </div>
    </div>
  )
}
