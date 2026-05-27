'use client'

import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { createPrivateMailboxOnChain } from '@/frontend/lib/create-private-mailbox-on-chain'
import { addMyPrivateMailbox, readMyPrivateMailboxes } from '@/frontend/lib/my-private-mailbox-store'

export function ChatViewPrivateMailboxCreateButton(p: {
  walletValid: boolean
  onObjectId: (id: string, meta?: { digest?: string }) => void
  onStatus?: (msg: string, kind: 'success' | 'error') => void
}) {
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!p.walletValid || busy) return
    setBusy(true)
    try {
      const r = await createPrivateMailboxOnChain()
      if (!r.ok) {
        p.onStatus?.(r.error || 'Erstellung fehlgeschlagen.', 'error')
        return
      }
      if (r.objectId) {
        addMyPrivateMailbox({
          objectId: r.objectId,
          createdAtMs: Date.now(),
          ...(r.digest ? { digest: r.digest } : {}),
        })
        const label = readMyPrivateMailboxes().find((e) => e.objectId === r.objectId)?.label || 'Private Mailbox'
        p.onObjectId(r.objectId, { digest: r.digest })
        p.onStatus?.(
          `„${label}“ erstellt und aktiv (${r.objectId.slice(0, 10)}…). Posteingang „Aktualisieren“, dann Empfänger/Handshake.`,
          'success'
        )
      } else {
        p.onStatus?.(
          r.message ||
            'Transaktion gesendet — Object-ID im Explorer prüfen und manuell eintragen (Paket-Redeploy?).',
          'success'
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={!p.walletValid || busy}
      onClick={() => void run()}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-emerald-600/40 bg-emerald-600/10 px-3 py-1.5 text-xs font-medium text-emerald-900 hover:bg-emerald-600/20 disabled:opacity-50 dark:text-emerald-100"
      title={
        p.walletValid
          ? 'Move: create_private_mailbox — Object-ID wird lokal gespeichert'
          : 'Tresor entsperren und Wallet-Adresse laden'
      }
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
      {busy ? 'Erstelle auf Chain…' : 'Eigene private Mailbox erstellen'}
    </button>
  )
}
