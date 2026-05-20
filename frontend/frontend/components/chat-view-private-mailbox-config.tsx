'use client'

import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { ChatViewMyMailboxesPanel } from '@/frontend/components/chat-view-my-mailboxes-panel'

export type ChatViewPrivateMailboxConfigProps = {
  myAddressLine: string
  serverMailboxId?: string
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onContactsChanged?: () => void
  onMailboxStatus?: (msg: string, kind: 'success' | 'error') => void
}

export function ChatViewPrivateMailboxConfig(p: ChatViewPrivateMailboxConfigProps) {
  return (
    <div className="mt-2 rounded-lg border border-orange-500/30 bg-orange-500/[0.06] p-3 dark:bg-orange-950/20">
      <ChatViewMyMailboxesPanel
        myAddressLine={p.myAddressLine}
        serverMailboxIdHint={p.serverMailboxId}
        contactDirectory={p.contactDirectory}
        onContactsChanged={p.onContactsChanged}
        onStatus={p.onMailboxStatus}
      />
    </div>
  )
}
