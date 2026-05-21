'use client'

import { useState } from 'react'
import { Loader2, Users } from 'lucide-react'
import { createTeamMailboxOnChain } from '@/frontend/lib/create-team-mailbox-on-chain'
import { addMyTeamMailbox } from '@/frontend/lib/my-team-mailbox-store'

export function ChatViewTeamMailboxCreateButton(p: {
  walletValid: boolean
  onObjectId: (id: string, meta?: { digest?: string; label?: string }) => void
  onStatus?: (msg: string, kind: 'success' | 'error') => void
}) {
  const [busy, setBusy] = useState(false)

  const run = async () => {
    if (!p.walletValid || busy) return
    const label =
      typeof window !== 'undefined'
        ? window.prompt('Name der Team-Mailbox (z. B. THW Einsatz 2026):', 'Team Einsatz')?.trim()
        : ''
    setBusy(true)
    try {
      const r = await createTeamMailboxOnChain()
      if (!r.ok) {
        p.onStatus?.(r.error || 'Erstellung fehlgeschlagen.', 'error')
        return
      }
      if (r.objectId) {
        addMyTeamMailbox({
          objectId: r.objectId,
          ...(label ? { label } : {}),
          ...(r.digest ? { digest: r.digest } : {}),
        })
        p.onObjectId(r.objectId, { digest: r.digest, label: label || undefined })
        p.onStatus?.(
          r.digest
            ? `Team-Mailbox erstellt (${r.objectId.slice(0, 10)}…) — ID per QR teilen.`
            : `Team-Mailbox erstellt (${r.objectId.slice(0, 10)}…).`,
          'success'
        )
      } else {
        p.onStatus?.(r.message || 'TX gesendet — Object-ID im Explorer prüfen.', 'success')
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
      className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-sky-600/45 bg-sky-600/15 px-3 py-1.5 text-xs font-medium text-sky-950 hover:bg-sky-600/25 disabled:opacity-50 dark:text-sky-100"
      title="Neues Shared-Postfach on-chain (THW, Feuerwehr, Stab, …)"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
      Team-Mailbox erstellen
    </button>
  )
}
