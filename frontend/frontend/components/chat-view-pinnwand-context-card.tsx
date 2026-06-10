'use client'

/**
 * Pinnwand: Server-Konfiguration anzeigen (nicht im Client editierbar) + Copy-Hilfen.
 */

import { useState } from 'react'
import { Check, Copy, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ApiStatus } from '@/frontend/lib/api'
import {
  MessengerHandbookChatLink,
  MESSENGER_HB_ANCHOR_PINNWAND,
} from '@/components/messenger-handbook-link'
import {
  canPostToPinnwand,
  getMessengerPinnwandCapabilities,
} from '@/frontend/lib/messenger-pinnwand-capabilities'

function CopyLine({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const [copied, setCopied] = useState(false)
  const v = value.trim()
  if (!v) return null
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
        {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p> : null}
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
  role?: string
}) {
  const pkg = (p.apiStatus?.packageId ?? '').trim()
  const caps = getMessengerPinnwandCapabilities(p.apiStatus, p.role, 'pinnwand', p.myAddressLine)
  const broadcastAddr = caps.broadcastAddress
  const broadcastOn = caps.configured
  const canPost = canPostToPinnwand(p.apiStatus, p.role)
  const addr = (p.apiStatus?.myAddressFull ?? p.myAddressLine).trim()

  return (
    <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-3 py-3 text-sm text-sky-950 dark:text-sky-100/95">
      <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
        <Share2 className="h-4 w-4 shrink-0 text-sky-500" aria-hidden />
        Pinnwand — feste Brett-Adresse (Server)
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Die Brett-Adresse kommt aus der <strong className="text-foreground">Basis-.env</strong> (
        <span className="font-mono">BROADCAST_PINNWAND_ADDRESS</span>) — hier{' '}
        <strong className="text-foreground">nur anzeigen und teilen</strong>, nicht ändern. Boss trägt
        sie vor dem Handoff ein (Export-Assistent / Einstellungen).{' '}
        <MessengerHandbookChatLink anchor={MESSENGER_HB_ANCHOR_PINNWAND} className="text-xs" />
      </p>
      {broadcastOn ? (
        <p className="mb-2 text-[11px] text-emerald-800 dark:text-emerald-200">
          Broadcast aktiv
          {canPost
            ? ' — du darfst posten.'
            : ' — nur lesen (deine Adresse steht nicht in BROADCAST_AUTHORIZED_SENDERS).'}
        </p>
      ) : (
        <p className="mb-2 text-[11px] text-amber-800 dark:text-amber-200">
          Keine Broadcast-Adresse vom Server — <span className="font-mono">ENABLE_BROADCAST_PINNWAND=true</span>{' '}
          und <span className="font-mono">BROADCAST_PINNWAND_ADDRESS</span> in der Basis-.env setzen, Backend
          neu starten.
        </p>
      )}
      {caps.broadcastEqualsMyAddress ? (
        <p className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-950 dark:text-amber-100">
          Hinweis: Brett-Adresse = deine eigene Wallet — nur für Tests. Im Einsatz besser eine{' '}
          <strong>eigene Brett-0x</strong> (oder dedizierte Rolle), damit Lesen/Schreiben klar getrennt sind.
        </p>
      ) : null}
      <div className={cn('space-y-2 rounded-md border border-border/60 bg-background/50 p-2')}>
        <CopyLine
          label="Brett-Adresse (immer dieser Empfänger beim Posten)"
          value={broadcastAddr}
          hint="Alle mit gleicher PACKAGE_ID lesen mit; Schreiben nur autorisierte 0x."
        />
        <CopyLine label="PACKAGE_ID (gleicher Einsatz / Move-Paket)" value={pkg} />
        <CopyLine label="Deine Wallet (MY_ADDRESS — zum Abgleich)" value={addr} />
      </div>
    </div>
  )
}
