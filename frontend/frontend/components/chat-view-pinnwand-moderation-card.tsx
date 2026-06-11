'use client'

import { Shield } from 'lucide-react'
import type { ApiStatus } from '@/frontend/lib/api/status'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import { contactDisplayLabel } from '@/frontend/lib/contact-display'
import { maskWalletAddress } from '@/frontend/lib/contact-phonebook-format'

export function ChatViewPinnwandModerationCard(p: {
  apiStatus?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  canPost?: boolean
}) {
  const senders = p.apiStatus?.broadcastPinnwand?.authorizedSenders ?? []
  if (!p.apiStatus?.broadcastPinnwand?.enabled || senders.length === 0) return null

  return (
    <div className="rounded-xl border border-orange-500/35 bg-orange-500/8 px-3 py-2.5 text-xs">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <Shield className="h-3.5 w-3.5 shrink-0 text-orange-700 dark:text-orange-300" aria-hidden />
        Moderation
        {p.canPost ? (
          <span className="rounded-full bg-emerald-600/15 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-200">
            Du darfst posten
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Nur lesen
          </span>
        )}
      </div>
      <p className="mt-1 text-muted-foreground">
        Autorisierte Sender ({senders.length}):
      </p>
      <ul className="mt-1 space-y-0.5">
        {senders.slice(0, 8).map((addr) => {
          const label = contactDisplayLabel(p.contactDirectory ?? {}, addr)
          return (
            <li key={addr} className="font-mono text-[11px] text-foreground">
              {label || maskWalletAddress(addr)}
            </li>
          )
        })}
        {senders.length > 8 ? (
          <li className="text-[10px] text-muted-foreground">+ {senders.length - 8} weitere</li>
        ) : null}
      </ul>
    </div>
  )
}
