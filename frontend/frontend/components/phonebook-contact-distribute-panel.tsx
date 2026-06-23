'use client'

import { useCallback, useState } from 'react'
import { FileJson, FileUp } from 'lucide-react'
import type { ContactMeshEntryClient } from '@/frontend/lib/api'
import {
  buildInitialProfileFromDirectory,
  downloadInitialProfileJson,
} from '@/frontend/lib/initial-profile-export'
import { LS_OFFLINE_BRIEFING_DISPLAY } from '@/frontend/lib/initial-profile-import'
import { ChatViewEinsatzProfilImportDialog } from '@/frontend/components/chat-view-einsatz-profil-import-dialog'
import { cn } from '@/lib/utils'

export type PhonebookContactDistributePanelProps = {
  directory: Record<string, ContactMeshEntryClient>
  onContactsChanged: () => void
  className?: string
}

function ActionCard(p: {
  icon: React.ReactNode
  title: string
  hint: string
  onClick?: () => void
  disabled?: boolean
  busy?: boolean
  variant?: 'default' | 'primary'
}) {
  return (
    <button
      type="button"
      disabled={p.disabled || p.busy}
      onClick={p.onClick}
      className={cn(
        'flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors disabled:opacity-50',
        p.variant === 'primary'
          ? 'border-primary/40 bg-primary/10 hover:bg-primary/15'
          : 'border-border bg-card hover:bg-muted/40'
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {p.icon}
        {p.title}
      </span>
      <span className="text-[11px] leading-snug text-muted-foreground">{p.hint}</span>
      {p.busy ? <span className="text-[10px] text-primary">Bitte warten…</span> : null}
    </button>
  )
}

/** Import/Export initialProfile und verschl. Mesh-Backup — für Boss/Kommandant im Telefonbuch. */
export function PhonebookContactDistributePanel(p: PhonebookContactDistributePanelProps) {
  const [importOpen, setImportOpen] = useState(false)
  const [busy, setBusy] = useState<'contacts' | null>(null)
  const [msg, setMsg] = useState('')

  const contactCount = Object.keys(p.directory).filter((a) => /^0x[a-fA-F0-9]{64}$/i.test(a)).length

  const exportContactsJson = useCallback(() => {
    let offlineBriefing: string | undefined
    try {
      offlineBriefing = localStorage.getItem(LS_OFFLINE_BRIEFING_DISPLAY)?.trim() || undefined
    } catch {
      /* ignore */
    }
    const profile = buildInitialProfileFromDirectory(p.directory, { offlineBriefing })
    downloadInitialProfileJson(profile)
    setMsg(`${(profile.contacts as unknown[])?.length ?? 0} Kontakt(e) als initialProfile exportiert.`)
  }, [p.directory])

  return (
    <div className={cn('space-y-2 rounded-xl border border-border/80 bg-muted/15 p-3', p.className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kontakte verteilen</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <ActionCard
          icon={<FileUp className="h-4 w-4 text-cyan-600" />}
          title="Importieren"
          hint="JSON → Telefonbuch"
          variant="primary"
          onClick={() => setImportOpen(true)}
        />
        <ActionCard
          icon={<FileJson className="h-4 w-4 text-emerald-600" />}
          title="Exportieren"
          hint={`${contactCount} Eintrag/Einträge`}
          disabled={contactCount === 0}
          busy={busy === 'contacts'}
          onClick={() => {
            setBusy('contacts')
            try {
              exportContactsJson()
            } finally {
              setBusy(null)
            }
          }}
        />
      </div>
      {msg ? (
        <p className="text-xs text-foreground" role="status">
          {msg}
        </p>
      ) : null}

      <ChatViewEinsatzProfilImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onContactsApplied={p.onContactsChanged}
      />
    </div>
  )
}
