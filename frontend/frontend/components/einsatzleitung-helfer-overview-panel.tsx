'use client'

import { useCallback, useState } from 'react'
import { FileJson, Users } from 'lucide-react'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { EinsatzleitungTeamRosterPanel } from '@/frontend/components/einsatzleitung-team-roster-panel'
import { PhonebookContactDistributePanel } from '@/frontend/components/phonebook-contact-distribute-panel'
import {
  countBossProvisionRegistryByStatus,
  getBossProvisionRegistryEntries,
  hasBossProvisionRegistry,
  isBossProvisionRegistryUnlocked,
} from '@/frontend/lib/boss-provision-registry'
import { formatHandoffAddressShort } from '@/frontend/lib/handoff-export-display'

export function EinsatzleitungHelferOverviewPanel(p: {
  apiStatus?: ApiStatus | null
  contactDirectory: Record<string, ContactMeshEntryClient>
  onContactsChanged: () => void
}) {
  const [, tick] = useState(0)
  const bump = useCallback(() => tick((n) => n + 1), [])

  const registryExists = hasBossProvisionRegistry()
  const unlocked = isBossProvisionRegistryUnlocked()
  const entries = unlocked ? getBossProvisionRegistryEntries() : []
  const stats = countBossProvisionRegistryByStatus(entries)
  const contactCount = Object.keys(p.contactDirectory).filter((a) => /^0x[a-fA-F0-9]{64}$/i.test(a)).length

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Users className="h-4 w-4" aria-hidden />
        Übersicht Helfer & Kontakte
      </h3>
      <div className="grid gap-2 sm:grid-cols-3 text-center text-xs">
        <div className="rounded-lg border border-border bg-muted/20 px-2 py-2">
          <p className="text-lg font-semibold text-foreground">{contactCount}</p>
          <p className="text-muted-foreground">Telefonbuch</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-2 py-2">
          <p className="text-lg font-semibold text-foreground">{registryExists ? stats.total : '—'}</p>
          <p className="text-muted-foreground">Provisioniert (Registry)</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-2 py-2">
          <p className="text-lg font-semibold text-foreground">{registryExists ? stats.open : '—'}</p>
          <p className="text-muted-foreground">Noch nicht übergeben</p>
        </div>
      </div>
      {unlocked && entries.length > 0 ? (
        <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
          {entries.slice(0, 8).map((e) => (
            <li key={e.id} className="flex justify-between gap-2 rounded border border-border/50 px-2 py-1">
              <span className="truncate font-medium text-foreground">{e.label}</span>
              <span className="shrink-0 font-mono text-muted-foreground">{formatHandoffAddressShort(e.address)}</span>
            </li>
          ))}
        </ul>
      ) : registryExists ? (
        <p className="text-xs text-muted-foreground">Registry gesperrt — unter „Neues Gerät“ entsperren.</p>
      ) : null}
      <EinsatzleitungTeamRosterPanel apiStatus={p.apiStatus} contactDirectory={p.contactDirectory} />
      <PhonebookContactDistributePanel
        directory={p.contactDirectory}
        onContactsChanged={() => {
          p.onContactsChanged()
          bump()
        }}
        className="border-0 bg-transparent p-0"
      />
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <FileJson className="h-3 w-3" aria-hidden />
        Helfer-Daten (Funk-ID, Telegram) kommen zurück per Team-Update oder manuell ins Telefonbuch.
      </p>
    </div>
  )
}
