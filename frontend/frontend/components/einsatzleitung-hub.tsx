'use client'

import { useCallback, useState } from 'react'
import {
  Crown,
  Download,
  FileJson,
  FileUp,
  MessageSquareText,
  Package,
  Settings,
} from 'lucide-react'
import type { ApiStatus, ContactMeshEntryClient } from '@/frontend/lib/api'
import { exportContactMeshEncrypted } from '@/frontend/lib/api'
import {
  buildInitialProfileFromDirectory,
  downloadInitialProfileJson,
} from '@/frontend/lib/initial-profile-export'
import { LS_OFFLINE_BRIEFING_DISPLAY } from '@/frontend/lib/initial-profile-import'
import { canEditEinsatzRoleTemplates } from '@/frontend/lib/messenger-role-capabilities'
import { ChatViewEinsatzProfilImportDialog } from '@/frontend/components/chat-view-einsatz-profil-import-dialog'
import { cn } from '@/lib/utils'

export type EinsatzleitungHubProps = {
  apiStatus?: ApiStatus | null
  contactDirectory?: Record<string, ContactMeshEntryClient>
  onContactsChanged?: () => void
  onScrollToHandoffExport?: () => void
  onScrollToEinsatzVorlagen?: () => void
  /** Forensik-Export-Callbacks (optional — aus Nachrichten-Hook). */
  onExportMessagesJson?: () => void | Promise<void>
  onExportMessagesTxt?: () => void | Promise<void>
  onExportMessagesEncrypted?: () => void | Promise<void>
  onExportProtokollZip?: () => void | Promise<void>
  forensicExportBusy?: boolean
  messageCountHint?: number
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

export function EinsatzleitungHub(p: EinsatzleitungHubProps) {
  const [importOpen, setImportOpen] = useState(false)
  const [busy, setBusy] = useState<'contacts' | 'mesh' | null>(null)
  const [msg, setMsg] = useState('')

  const directory = p.contactDirectory ?? {}
  const contactCount = Object.keys(directory).filter((a) => /^0x[a-fA-F0-9]{64}$/i.test(a)).length
  const isBoss = (p.apiStatus?.role || '').trim().toLowerCase() === 'boss'
  const canEditTemplates = canEditEinsatzRoleTemplates(p.apiStatus ?? null)

  const exportContactsJson = useCallback(() => {
    let offlineBriefing: string | undefined
    try {
      offlineBriefing = localStorage.getItem(LS_OFFLINE_BRIEFING_DISPLAY)?.trim() || undefined
    } catch {
      /* ignore */
    }
    const profile = buildInitialProfileFromDirectory(directory, { offlineBriefing })
    downloadInitialProfileJson(profile)
    setMsg(`${(profile.contacts as unknown[])?.length ?? 0} Kontakt(e) als initialProfile exportiert.`)
  }, [directory])

  const exportMeshBackup = useCallback(async () => {
    const pw = window.prompt('Passwort für verschlüsseltes Kontakt-Backup (min. 8 Zeichen):')?.trim()
    if (!pw || pw.length < 8) {
      if (pw != null) setMsg('Passwort zu kurz (min. 8 Zeichen).')
      return
    }
    setBusy('mesh')
    setMsg('')
    try {
      const r = await exportContactMeshEncrypted(pw)
      setMsg(r.ok ? r.message || 'Verschlüsseltes Backup heruntergeladen.' : r.error || 'Export fehlgeschlagen.')
    } finally {
      setBusy(null)
    }
  }, [])

  return (
    <>
      <div className="space-y-5">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Crown className="h-4 w-4 text-amber-600" aria-hidden />
            Einsatzleitung — zentrale Schaltstelle
          </p>
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            Team-Mailbox, Kontakt-Import/Export, Helfer-Handoff (nur Boss → Export-Assistent unten) und Nachrichten-Forensik. JSON-Import schreibt ins
            Telefonbuch (<code className="text-[10px]">initialProfile</code>, nicht die volle Mailbox-Struktur).
          </p>
        </div>

        <details className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">JSON-Format (Import ↔ Export)</summary>
          <div className="mt-2 space-y-2 leading-snug">
            <p>
              <strong className="text-foreground">Import:</strong>{' '}
              <code className="text-[10px]">{`{ "version": 1, "contacts": [{ "name", "address", "roleTags?" }] }`}</code> oder
              verschachteltes <code className="text-[10px]">initialProfile</code> aus Handoff-ZIP.
            </p>
            <p>
              <strong className="text-foreground">Export Kontakte:</strong> gleiches Schema — Name, Adresse, Tags. Mailbox-Slots
              und Mesh über verschl. Backup oder Telefonbuch.
            </p>
          </div>
        </details>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kontakte verteilen</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <ActionCard
              icon={<FileUp className="h-4 w-4 text-cyan-600" />}
              title="Kontakte importieren"
              hint="JSON → Telefonbuch"
              variant="primary"
              onClick={() => setImportOpen(true)}
            />
            <ActionCard
              icon={<FileJson className="h-4 w-4 text-emerald-600" />}
              title="Kontakte exportieren"
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
            <ActionCard
              icon={<Download className="h-4 w-4 text-sky-600" />}
              title="Verschl. Kontakt-Backup"
              hint="Passwort — inkl. Mesh-Felder"
              busy={busy === 'mesh'}
              onClick={() => void exportMeshBackup()}
            />
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Einsatz-Paket & Konfiguration</h3>
          {!isBoss ? (
            <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
              Helfer-Handoff-ZIP: nur Rolle <strong className="text-foreground">Boss</strong> über den{' '}
              <strong className="text-foreground">Export-Assistent</strong> (Presets, Schnell-Handoff mit letztem Preset).
            </p>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {isBoss && p.onScrollToHandoffExport ? (
              <ActionCard
                icon={<Package className="h-4 w-4 text-purple-600" />}
                title="Export-Assistent"
                hint="Presets, 4 Felder, Schnell-Handoff — ZIP unten auf dieser Seite"
                variant="primary"
                onClick={p.onScrollToHandoffExport}
              />
            ) : null}
            {p.onScrollToEinsatzVorlagen ? (
              <ActionCard
                icon={<Settings className="h-4 w-4 text-muted-foreground" />}
                title="Einsatz-Vorlagen"
                hint={canEditTemplates ? 'Lesen & Speichern — unten' : 'Nur Lesen — unten'}
                onClick={p.onScrollToEinsatzVorlagen}
              />
            ) : null}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nachrichtenverlauf / Forensik
            {p.messageCountHint != null ? (
              <span className="ml-1 font-normal normal-case text-muted-foreground">({p.messageCountHint} geladen)</span>
            ) : null}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <ActionCard
              icon={<FileJson className="h-4 w-4 text-emerald-600" />}
              title="Verlauf JSON"
              hint="Alle Felder, forensisch"
              disabled={!p.onExportMessagesJson}
              busy={p.forensicExportBusy}
              onClick={() => void p.onExportMessagesJson?.()}
            />
            <ActionCard
              icon={<MessageSquareText className="h-4 w-4 text-muted-foreground" />}
              title="Verlauf TXT"
              hint="Lesbarer Kurzbericht"
              disabled={!p.onExportMessagesTxt}
              busy={p.forensicExportBusy}
              onClick={() => void p.onExportMessagesTxt?.()}
            />
            <ActionCard
              icon={<Download className="h-4 w-4 text-violet-600" />}
              title="Verschl. Bericht"
              hint="Passwortgeschützt"
              disabled={!p.onExportMessagesEncrypted}
              busy={p.forensicExportBusy}
              onClick={() => void p.onExportMessagesEncrypted?.()}
            />
            <ActionCard
              icon={<Package className="h-4 w-4 text-sky-600" />}
              title="Protokoll-ZIP"
              hint="Markierte + Anhänge"
              disabled={!p.onExportProtokollZip}
              busy={p.forensicExportBusy}
              onClick={() => void p.onExportProtokollZip?.()}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Entschlüsseln:{' '}
            <a href="/einsatzbericht-decrypt.html" target="_blank" rel="noopener noreferrer" className="underline">
              einsatzbericht-decrypt.html
            </a>
          </p>
        </section>

        {msg ? (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-foreground" role="status">
            {msg}
          </p>
        ) : null}
      </div>

      <ChatViewEinsatzProfilImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onContactsApplied={p.onContactsChanged}
      />
    </>
  )
}
