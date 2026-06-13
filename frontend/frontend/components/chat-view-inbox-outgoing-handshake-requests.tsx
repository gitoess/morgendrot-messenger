'use client'

import { Clock, KeyRound, Loader2 } from 'lucide-react'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import type { OutgoingHandshakeOffer } from '@/frontend/lib/api/package-connect'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'

import type { HandshakeOfferSource } from '@/frontend/lib/handshake-offer-delete'

export type ChatViewInboxOutgoingHandshakeRequestsProps = {
  offers: OutgoingHandshakeOffer[]
  loading?: boolean
  sending?: boolean
  directory: Record<string, ContactMeshEntryClient>
  onUseAsPartner: (recipient: string) => void
  onResend?: (recipient: string) => void | Promise<void>
  onDelete?: (recipient: string, nonce: string, source: HandshakeOfferSource) => void | Promise<void>
}

export function ChatViewInboxOutgoingHandshakeRequests(p: ChatViewInboxOutgoingHandshakeRequestsProps) {
  const { offers, loading = false, sending = false, directory, onUseAsPartner, onResend, onDelete } = p

  if (offers.length === 0) return null

  return (
    <div className="border-b border-sky-500/25 bg-sky-500/[0.06] px-3 py-2.5 dark:bg-sky-950/20">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
        <KeyRound className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden />
        Ausstehende Anfragen (gesendet)
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>
      <ul className="space-y-2">
        {offers.map((o) => {
          const addr = o.recipient.trim().toLowerCase()
          const label = contactDisplayLabel(directory, addr)
          return (
            <li
              key={`${addr}:${o.nonce}`}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border/80 bg-background/70 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{label || 'Unbekannter Kontakt'}</p>
                <p className="font-mono text-[10px] text-muted-foreground" title={o.recipient}>
                  {maskWalletAddress(o.recipient, 10, 8)}
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/80">
                    · {o.source === 'mailbox' ? 'Mailbox' : 'Event'}
                    · <Clock className="h-3 w-3" aria-hidden /> Warte auf Partner
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={sending}
                onClick={() => onUseAsPartner(o.recipient)}
                className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
              >
                Als Partner
              </button>
              {onResend ? (
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void onResend(o.recipient)}
                  className="rounded-md border border-border px-2.5 py-1 text-[11px] hover:bg-muted disabled:opacity-50"
                >
                  {sending ? '…' : 'Erneut senden'}
                </button>
              ) : null}
              {onDelete ? (
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void onDelete(o.recipient, o.nonce, o.source)}
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
        Gesendeter Handshake — Partner kann annehmen/verbinden. „Löschen“ blendet lokal aus; bei Mailbox-Einträgen
        wird on-chain gepurgt (ENABLE_PURGE + MAILBOX_ID).
      </p>
    </div>
  )
}
