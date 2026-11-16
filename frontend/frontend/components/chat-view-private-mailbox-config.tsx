'use client'

import { ChatViewMyMailboxesPanel } from '@/frontend/components/chat-view-my-mailboxes-panel'

export type ChatViewPrivateMailboxConfigProps = {
  myAddressLine: string
  serverMailboxId?: string
  onMailboxStatus?: (msg: string, kind: 'success' | 'error') => void
}

export function ChatViewPrivateMailboxConfig(p: ChatViewPrivateMailboxConfigProps) {
  return (
    <div className="mt-2 rounded-lg border border-orange-500/30 bg-orange-500/[0.06] p-3 dark:bg-orange-950/20">
      <p className="mb-2 text-sm font-semibold text-foreground">Meine Mailboxen</p>
      <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
        Besitz/Anlegen hier. Posteingang liest Haupt + bekannte Privat/Team nach{' '}
        <strong className="text-foreground">Aktualisieren</strong>. Wohin geschrieben wird: Composer.
      </p>
      <ChatViewMyMailboxesPanel
        myAddressLine={p.myAddressLine}
        serverMailboxIdHint={p.serverMailboxId}
        onStatus={p.onMailboxStatus}
      />
    </div>
  )
}
