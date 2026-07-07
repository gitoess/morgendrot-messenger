'use client'

import { ContactHandshakeBadge } from '@/frontend/components/contact-handshake-badge'
import { ChatViewEncryptedRecipientHandshakeBar } from '@/frontend/components/chat-view-encrypted-recipient-handshake-bar'
import { ChatViewEncryptionModeToggle } from '@/frontend/components/chat-view-encryption-mode-toggle'
import type { ContactHandshakeBadgeKind } from '@/frontend/lib/contact-handshake-ui'
import type { EncryptedRecipientHandshakeStatus } from '@/frontend/lib/encrypted-recipient-handshake-status'
import type { ForcedTransport } from '@/frontend/lib/chat-view-messenger-transport'

export type ChatViewActiveConversationBarProps = {
  displayName: string
  addressLine?: string
  handshakeBadge: ContactHandshakeBadgeKind
  encrypted: boolean
  forcedTransport: ForcedTransport
  onEncryptedChange: (v: boolean) => void
  encryptedRecipientHandshakeStatus?: EncryptedRecipientHandshakeStatus
  sending?: boolean
  myAddress?: string
  onEncryptedHandshakeForRecipient?: () => void | Promise<void>
  onEncryptedAcceptHandshakeForRecipient?: () => void | Promise<void>
}

/** Kompakte Leiste: aktiver Chat-Partner, Handshake-Status, Verschlüsselt/Unverschlüsselt. */
export function ChatViewActiveConversationBar(p: ChatViewActiveConversationBarProps) {
  return (
    <div className="rounded-xl border border-border/70 bg-card/50 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{p.displayName}</p>
            <ContactHandshakeBadge kind={p.handshakeBadge} />
          </div>
          {p.addressLine ? (
            <p className="truncate font-mono text-[10px] text-muted-foreground">{p.addressLine}</p>
          ) : null}
        </div>
        <ChatViewEncryptionModeToggle
          encrypted={p.encrypted}
          forcedTransport={p.forcedTransport}
          onEncryptedChange={p.onEncryptedChange}
        />
      </div>
      {p.encrypted && p.encryptedRecipientHandshakeStatus ? (
        <ChatViewEncryptedRecipientHandshakeBar
          status={p.encryptedRecipientHandshakeStatus}
          sending={p.sending}
          myAddress={p.myAddress}
          onHandshake={p.onEncryptedHandshakeForRecipient}
          onAccept={p.onEncryptedAcceptHandshakeForRecipient}
        />
      ) : null}
    </div>
  )
}
