'use client'

import { cn } from '@/lib/utils'
import { LazyPeeringQrActions } from '@/frontend/components/lazy/messenger-scope-b'
import {
  encryptedHandshakeStatusLabel,
  type EncryptedRecipientHandshakeStatus,
} from '@/frontend/lib/encrypted-recipient-handshake-status'

export type ChatViewEncryptedRecipientHandshakeBarProps = {
  status: EncryptedRecipientHandshakeStatus
  sending?: boolean
  myAddress?: string
  onHandshake?: () => void | Promise<void>
  onAccept?: () => void | Promise<void>
  onPeeringImported?: (r: { address: string; displayName?: string; peerPubStored: boolean }) => void
  onPeeringStatus?: (msg: string) => void
}

export function ChatViewEncryptedRecipientHandshakeBar(p: ChatViewEncryptedRecipientHandshakeBarProps) {
  const { status, sending = false, myAddress = '', onHandshake, onAccept, onPeeringImported, onPeeringStatus } =
    p
  if (status === 'idle' || status === 'ready') return null

  const label = encryptedHandshakeStatusLabel(status)
  const isWarn = status === 'awaiting_peer' || status === 'needs_handshake' || status === 'needs_accept'

  return (
    <div
      className={cn(
        'mt-2 rounded-lg border px-3 py-2.5 text-[11px] leading-snug',
        status === 'checking'
          ? 'border-border bg-muted/30 text-muted-foreground'
          : isWarn
            ? 'border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100'
            : 'border-border bg-muted/20'
      )}
      role="status"
    >
      <p>{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {status === 'needs_handshake' || status === 'awaiting_peer' ? (
          <button
            type="button"
            disabled={sending || !onHandshake}
            onClick={() => void onHandshake?.()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
          >
            {status === 'awaiting_peer' ? 'Handshake erneut senden' : 'Handshake senden'}
          </button>
        ) : null}
        {status === 'needs_accept' ? (
          <button
            type="button"
            disabled={sending || !onAccept}
            onClick={() => void onAccept?.()}
            className="rounded-md border border-emerald-600/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-foreground disabled:opacity-50"
          >
            Handshake annehmen
          </button>
        ) : null}
      </div>
      {onPeeringImported ? (
        <LazyPeeringQrActions
          className="mt-2 flex flex-wrap gap-1.5"
          myAddress={myAddress}
          disabled={sending}
          onImported={onPeeringImported}
          onStatus={onPeeringStatus}
        />
      ) : null}
    </div>
  )
}
