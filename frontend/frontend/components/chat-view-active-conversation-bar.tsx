'use client'

import { Lock, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ContactHandshakeBadge } from '@/frontend/components/contact-handshake-badge'
import { ChatViewEncryptedRecipientHandshakeBar } from '@/frontend/components/chat-view-encrypted-recipient-handshake-bar'
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

/** Kompakte Leiste: aktiver Chat-Partner, Handshake-Status, Verschlüsselt/Klartext. */
export function ChatViewActiveConversationBar(p: ChatViewActiveConversationBarProps) {
  const showEncryptToggle = p.forcedTransport === 'internet'

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
        {showEncryptToggle ? (
          <div className="flex shrink-0 rounded-lg border border-border bg-background p-0.5">
            <button
              type="button"
              onClick={() => p.onEncryptedChange(true)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                p.encrypted
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-muted-foreground hover:bg-muted/60'
              )}
            >
              <Lock className="h-3.5 w-3.5" />
              Verschlüsselt
            </button>
            <button
              type="button"
              onClick={() => p.onEncryptedChange(false)}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                !p.encrypted
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-muted-foreground hover:bg-muted/60'
              )}
            >
              <Unlock className="h-3.5 w-3.5" />
              Klartext
            </button>
          </div>
        ) : null}
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
