'use client'

import { KeyRound, Loader2 } from 'lucide-react'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { PendingHandshakeOffer } from '@/frontend/lib/api/package-connect'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'

import type { HandshakeOfferSource } from '@/frontend/lib/handshake-offer-delete'

export type ChatViewInboxHandshakeRequestsProps = {
  offers: PendingHandshakeOffer[]
  loading?: boolean
  sending?: boolean
  directory: Record<string, ContactMeshEntryClient>
  onAccept: (sender: string) => void
  onUseAsPartner: (sender: string) => void
  onDelete?: (sender: string, nonce: string, source: HandshakeOfferSource) => void | Promise<void>
}

export function ChatViewInboxHandshakeRequests(p: ChatViewInboxHandshakeRequestsProps) {
  const { offers, loading = false, sending = false, directory, onAccept, onUseAsPartner, onDelete } = p

  /** Nur bei echten Angeboten — kein „Suche Handshakes“ beim Posteingang-Aktualisieren. */
  if (offers.length === 0) return null

  return (
    <div className="border-b border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5 dark:bg-emerald-950/20">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
        <KeyRound className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
        Handshake-Anfragen (eingehend)
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>
      <ul className="space-y-2">
        {offers.map((o) => {
          const addr = o.sender.trim().toLowerCase()
          const label = contactDisplayLabel(directory, addr)
          return (
            <li
              key={`${addr}:${o.nonce}`}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border/80 bg-background/70 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{label || 'Unbekannter Kontakt'}</p>
                <p className="font-mono text-[10px] text-muted-foreground" title={o.sender}>
                  {maskWalletAddress(o.sender, 10, 8)}
                  <span className="ml-1.5 text-[10px] text-muted-foreground/80">
                    · {o.source === 'mailbox' ? 'Mailbox' : 'Event'}
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={sending}
                onClick={() => onUseAsPartner(o.sender)}
                className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
              >
                Als Partner
              </button>
              <button
                type="button"
                disabled={sending}
                onClick={() => onAccept(o.sender)}
                className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
              >
                {sending ? '…' : 'Annehmen'}
              </button>
              {onDelete ? (
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void onDelete(o.sender, o.nonce, o.source)}
                  className="rounded-md border border-destructive/40 px-2.5 py-1 text-[11px] text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  {sending ? '…' : 'Löschen'}
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
        „Annehmen“ = Handshake verbinden. „Löschen“ = lokal ausblenden; bei Mailbox-Einträgen zusätzlich{' '}
        <code className="text-[10px]">/purge-handshake</code> on-chain (wenn Purge + MAILBOX_ID aktiv).
        Event-only-Anfragen nur lokal ausblendbar.
      </p>
    </div>
  )
}
