'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ChatViewMyWalletIdInline } from '@/frontend/components/chat-view-my-wallet-id-inline'
import type { ChatViewMyWalletIdInlineProps } from '@/frontend/components/chat-view-my-wallet-id-inline'

export type ChatViewSelfProfileDialogProps = ChatViewMyWalletIdInlineProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Profil „Ich“ — Kontakt-ID, Peering-QR (Sidebar-Kontakt). */
export function ChatViewSelfProfileDialog(p: ChatViewSelfProfileDialogProps) {
  const { open, onOpenChange, ...walletProps } = p
  const valid = /^0x[a-fA-F0-9]{64}$/i.test((walletProps.myAddressLine || '').trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>Ich</DialogTitle>
          <DialogDescription>Meine Kontakt-ID, Peering und Telegram-IDs für Alarm-Hinweise.</DialogDescription>
        </DialogHeader>
        {valid ? <ChatViewMyWalletIdInline {...walletProps} variant="panel" /> : null}
      </DialogContent>
    </Dialog>
  )
}
