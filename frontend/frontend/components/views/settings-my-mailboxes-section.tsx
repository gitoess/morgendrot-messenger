'use client'

import { useCallback } from 'react'
import { Mailbox } from 'lucide-react'
import Link from 'next/link'
import type { ApiStatus } from '@/frontend/lib/api'
import { ChatViewMyMailboxesPanel } from '@/frontend/components/chat-view-my-mailboxes-panel'
import { useContactDirectory } from '@/frontend/hooks/use-contact-directory'
import { canCreateTeamMailbox } from '@/frontend/lib/messenger-role-capabilities'
import { toast } from 'sonner'

type SettingsMyMailboxesSectionProps = {
  apiStatus: ApiStatus | null
  myAddress: string
}

export function SettingsMyMailboxesSection({ apiStatus, myAddress }: SettingsMyMailboxesSectionProps) {
  const { directory, refresh: refreshContactDirectory } = useContactDirectory()
  const addr = myAddress.trim()
  const show = /^0x[a-fA-F0-9]{64}$/i.test(addr)

  const onStatus = useCallback((msg: string, kind: 'success' | 'error') => {
    if (kind === 'success') toast.success(msg)
    else toast.error(msg)
  }, [])

  if (!show) return null

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
            <Mailbox className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">My mailboxes</h4>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Server-shared, team, and private — set active, then refresh inbox.
            </p>
          </div>
        </div>
        <Link
          href="/handbook?file=MESSENGER-CHAT-HANDBUCH.md#kanäle-speicher-und-mailboxen"
          className="text-xs text-primary underline hover:no-underline"
        >
          Handbook
        </Link>
      </div>
      <div className="p-4">
        <ChatViewMyMailboxesPanel
          myAddressLine={addr}
          serverMailboxIdHint={apiStatus?.mailboxId}
          contactDirectory={directory}
          onContactsChanged={() => void refreshContactDirectory()}
          onStatus={onStatus}
          teamMailboxCreateAllowed={canCreateTeamMailbox(apiStatus)}
        />
      </div>
    </div>
  )
}
