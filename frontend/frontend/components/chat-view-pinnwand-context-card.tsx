'use client'

/**
 * Pinnwand: welche Werte andere brauchen (ohne Geheimnisse aus .env im Client) + Copy-Hilfen.
 */

import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api'
import {
  MessengerHandbookChatLink,
  MESSENGER_HB_ANCHOR_PINNWAND,
} from '@/components/messenger-handbook-link'

function CopyLine({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const v = value.trim()
  if (!v) return null
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
        <code className="mt-0.5 block truncate rounded bg-muted/60 px-2 py-1 font-mono text-[11px] text-foreground">
          {v}
        </code>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(v)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        }}
        className="inline-flex shrink-0 items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-accent"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        Kopieren
      </button>
    </div>
  )
}

export function ChatViewPinnwandContextCard(p: {
  apiStatus: ApiStatus | null
  myAddressLine: string
}) {
  const pkg = (p.apiStatus?.packageId ?? '').trim()
  const addr = (p.apiStatus?.myAddressFull ?? p.myAddressLine).trim()
  const bp = p.apiStatus?.broadcastPinnwand
  const broadcastAddr = (bp?.address ?? '').trim()
  const broadcastOn = Boolean(bp?.enabled && broadcastAddr)

  return (
    <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-3 text-sm text-sky-950 dark:text-sky-100/95">
      <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
        <Share2 className="h-4 w-4 shrink-0 text-sky-500" aria-hidden />
        Pinnwand einbinden / teilen
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        <MessengerHandbookChatLink anchor={MESSENGER_HB_ANCHOR_PINNWAND} className="text-xs" />
      </p>
      {broadcastOn ? (
        <p className="mb-2 text-[11px] text-emerald-800 dark:text-emerald-200">
          Broadcast aktiv
          {bp?.myAddressAuthorized === false ? ' — deine Adresse ist nicht in BROADCAST_AUTHORIZED_SENDERS.' : '.'}
        </p>
      ) : (
        <p className="mb-2 text-[11px] text-amber-800 dark:text-amber-200">
          Keine Broadcast-Adresse vom Server — <span className="font-mono">ENABLE_BROADCAST_PINNWAND</span> und{' '}
          <span className="font-mono">BROADCAST_PINNWAND_ADDRESS</span> in der Basis-.env prüfen.
        </p>
      )}
      <div className={cn('space-y-2 rounded-md border border-border/60 bg-background/50 p-2')}>
        <CopyLine label="PACKAGE_ID (Status / Posteingang)" value={pkg} />
        <CopyLine label="Broadcast-Adresse (Empfänger Klartext)" value={broadcastAddr} />
        <CopyLine label="Eigene Adresse (MY_ADDRESS, für Abgleich)" value={addr} />
      </div>
    </div>
  )
}



