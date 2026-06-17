'use client'

import { ChatViewMyWalletIdInline } from '@/frontend/components/chat-view-my-wallet-id-inline'
import type { ChatViewMyWalletIdInlineProps } from '@/frontend/components/chat-view-my-wallet-id-inline'
import { cn } from '@/lib/utils'

export type ChatViewMyDataPanelProps = ChatViewMyWalletIdInlineProps & {
  className?: string
}

/** Sidebar „Meine Daten“ — Kontakt-ID + Peering-QR (immer sichtbar). */
export function ChatViewMyDataPanel(p: ChatViewMyDataPanelProps) {
  const full = (p.myAddressLine || '').trim()
  if (!/^0x[a-fA-F0-9]{64}$/i.test(full)) return null

  return (
    <section
      className={cn('border-b border-border bg-muted/20 px-3 py-3', p.className)}
      aria-label="Meine Daten"
    >
      <h3 className="mb-2 text-sm font-bold tracking-tight text-foreground">Meine Daten</h3>
      <ChatViewMyWalletIdInline {...p} variant="panel" />
    </section>
  )
}
