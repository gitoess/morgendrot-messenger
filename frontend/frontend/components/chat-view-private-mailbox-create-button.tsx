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
    const existing = readMyPrivateMailboxes()
    if (existing.length > 0) {
      const names = existing
        .map((e) => e.label?.trim() || `${e.objectId.slice(0, 10)}…`)
        .slice(0, 3)
        .join(', ')
      const ok = window.confirm(
        `Du hast bereits ${existing.length} private Mailbox${existing.length === 1 ? '' : 'en'} (${names}).\n\n` +
          `Eine zweite ist selten nötig — beide werden im Posteingang mitgelesen.\n\nTrotzdem neue erstellen?`
      )
      if (!ok) return
    }
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
          `„${label}“ erstellt (${r.objectId.slice(0, 10)}…). Steht unter Private Mailboxen; Posteingang „Aktualisieren“.`,
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
