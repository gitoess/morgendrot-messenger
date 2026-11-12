'use client'

import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChatViewMyWalletIdInline } from '@/frontend/components/chat-view-my-wallet-id-inline'
import type { ChatViewMyWalletIdInlineProps } from '@/frontend/components/chat-view-my-wallet-id-inline'
import { TechnicalIdRow, TechnicalIdSection } from '@/frontend/components/technical-id-row'
import { buildSelfInfoSections } from '@/frontend/lib/messenger-entity-info-model'
import { readActiveSendMailbox } from '@/frontend/lib/my-mailbox-active'
import { readCachedServerMailboxObjectId } from '@/frontend/lib/my-private-mailbox-store'

export type ChatViewSelfProfileDialogProps = ChatViewMyWalletIdInlineProps & {
  open: boolean
  onOpenChange: (open: boolean) => void
  packageId?: string
  onOpenIotaSettings?: () => void
}

/** Profil „Ich“ — Kontakt-ID, Peering-QR, technische Mailbox-/Package-IDs. */
export function ChatViewSelfProfileDialog(p: ChatViewSelfProfileDialogProps) {
  const { open, onOpenChange, packageId, onOpenIotaSettings, ...walletProps } = p
  const valid = /^0x[a-fA-F0-9]{64}$/i.test((walletProps.myAddressLine || '').trim())

  const infoSections = useMemo(() => {
    const active = readActiveSendMailbox()
    return buildSelfInfoSections({
      myAddress: walletProps.myAddressLine,
      serverMailboxId: readCachedServerMailboxObjectId() || undefined,
      privateMailboxId: active.kind === 'private' ? active.objectId : undefined,
      teamMailboxId: active.kind === 'team' ? active.objectId : undefined,
      packageId,
      telegramChatId: walletProps.myTelegramChatId ?? undefined,
    })
  }, [open, walletProps.myAddressLine, walletProps.myTelegramChatId, packageId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md gap-4 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ich</DialogTitle>
          <DialogDescription>
            Kontakt-ID, Peering, Telegram und aktive Mailbox-/Package-IDs — ohne in den Einstellungen zu suchen.
          </DialogDescription>
        </DialogHeader>
        {valid ? <ChatViewMyWalletIdInline {...walletProps} variant="panel" /> : null}

        {infoSections.map((section) => (
          <TechnicalIdSection key={section.id} title={section.title}>
            {section.fields.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">{section.note ?? '—'}</p>
            ) : (
              <>
                {section.fields.map((f) => (
                  <TechnicalIdRow
                    key={f.id}
                    label={f.label}
                    value={f.value}
                    copyable={f.copyable}
                    hint={f.hint}
                  />
                ))}
                {section.note ? (
                  <p className="border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                    {section.note}
                  </p>
                ) : null}
              </>
            )}
          </TechnicalIdSection>
        ))}

        {onOpenIotaSettings ? (
          <Button type="button" size="sm" variant="outline" onClick={onOpenIotaSettings}>
            IOTA-Einstellungen…
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
