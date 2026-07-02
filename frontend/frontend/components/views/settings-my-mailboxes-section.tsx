'use client'

import { useCallback } from 'react'
import { Mailbox } from 'lucide-react'
import Link from 'next/link'
import type { ApiStatus } from '@/frontend/lib/api'
import { ChatViewMyMailboxesPanel } from '@/frontend/components/chat-view-my-mailboxes-panel'
import { TeamMailboxSyncStatus } from '@/frontend/components/team-mailbox-sync-status'
import { useContactDirectory } from '@/frontend/hooks/use-contact-directory'
import { canCreateTeamMailbox } from '@/frontend/lib/messenger-role-capabilities'
import { toast } from 'sonner'

type SettingsMyMailboxesSectionProps = {
  apiStatus: ApiStatus | null
  myAddress: string
  backendOnline?: boolean
  onReload?: () => void
  /** Wizard: ohne Karten-Header und Sync-Panel */
  embedded?: boolean
}

export function SettingsMyMailboxesSection({
  apiStatus,
  myAddress,
  backendOnline,
  onReload,
  embedded = false,
}: SettingsMyMailboxesSectionProps) {
  const { directory, refresh: refreshContactDirectory } = useContactDirectory()
  const addr = myAddress.trim()
  const show = /^0x[a-fA-F0-9]{64}$/i.test(addr)

  const onStatus = useCallback((msg: string, kind: 'success' | 'error') => {
    if (kind === 'success') toast.success(msg)
    else toast.error(msg)
  }, [])

  if (!show) return null

  const panel = (
    <>
      {!embedded && canCreateTeamMailbox(apiStatus) ? (
        <TeamMailboxSyncStatus
          apiSnapshot={apiStatus}
          backendOnline={backendOnline}
          onReload={onReload}
        />
      ) : null}
      <ChatViewMyMailboxesPanel
        myAddressLine={addr}
        serverMailboxIdHint={apiStatus?.mailboxId}
        contactDirectory={directory}
        onContactsChanged={() => void refreshContactDirectory()}
        onStatus={onStatus}
        teamMailboxCreateAllowed={canCreateTeamMailbox(apiStatus)}
      />
    </>
  )

  if (embedded) {
    return <div className="space-y-4">{panel}</div>
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
            <Mailbox className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Meine Mailboxen</h4>
          </div>
        </div>
        <Link
          href="/handbook?file=MESSENGER-CHAT-HANDBUCH.md#kanäle-speicher-und-mailboxen"
          className="text-xs text-primary underline hover:no-underline"
        >
          Handbuch
        </Link>
      </div>
      <div className="space-y-4 p-4">
        {panel}
      </div>
    </div>
  )
}
