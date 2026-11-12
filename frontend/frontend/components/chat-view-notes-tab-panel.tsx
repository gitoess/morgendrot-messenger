'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { VaultNotesPanel } from '@/frontend/components/vault-notes-panel'
import { VaultPersonalSecretsPanel } from '@/frontend/components/vault-personal-secrets-panel'
import {
  fetchVaultNotes,
  fetchVaultPersonalSecrets,
  fetchStatus,
  saveVaultNotes,
  saveVaultPersonalSecrets,
} from '@/frontend/lib/api'
import type { VaultNoteEntry } from '@/frontend/lib/api/vault-notes'
import type { PersonalSecretEntry } from '@/frontend/lib/api/vault-personal-secrets'
import { cn } from '@/lib/utils'

const RAM_SAVE_DEBOUNCE_MS = 800

type SubTab = 'notes' | 'secrets'

export function ChatViewNotesTabPanel() {
  const [subTab, setSubTab] = useState<SubTab>('notes')
  const [vaultNotes, setVaultNotes] = useState<VaultNoteEntry[]>([])
  const [secrets, setSecrets] = useState<PersonalSecretEntry[]>([])
  const [canUseVault, setCanUseVault] = useState(false)
  const [vaultLocked, setVaultLocked] = useState(true)
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const secretsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydratedRef = useRef(false)

  const refreshSession = useCallback(async () => {
    try {
      const s = await fetchStatus()
      if ('pollClockHint' in s) {
        setVaultLocked(!!s.locked)
        setCanUseVault(!s.locked && s.hasKeys === true)
      }
    } catch {
      setCanUseVault(false)
      setVaultLocked(true)
    }
  }, [])

  const hydrate = useCallback(async () => {
    const [n, p] = await Promise.all([fetchVaultNotes(), fetchVaultPersonalSecrets()])
    if (n.ok && n.unlocked && Array.isArray(n.notes)) setVaultNotes(n.notes)
    if (p.ok && p.unlocked && Array.isArray(p.entries)) setSecrets(p.entries)
  }, [])

  useEffect(() => {
    void refreshSession()
    void hydrate()
    hydratedRef.current = true
  }, [refreshSession, hydrate])

  const scheduleNotesRamSave = useCallback((notes: VaultNoteEntry[]) => {
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(() => {
      void saveVaultNotes(notes, false).then((r) => {
        if (!r.ok) toast.error(r.error || 'Notizen konnten nicht in die Sitzung geschrieben werden.')
      })
    }, RAM_SAVE_DEBOUNCE_MS)
  }, [])

  const scheduleSecretsRamSave = useCallback((entries: PersonalSecretEntry[]) => {
    if (secretsTimerRef.current) clearTimeout(secretsTimerRef.current)
    secretsTimerRef.current = setTimeout(() => {
      void saveVaultPersonalSecrets(entries, false).then((r) => {
        if (!r.ok) toast.error(r.error || 'Safe konnte nicht in die Sitzung geschrieben werden.')
      })
    }, RAM_SAVE_DEBOUNCE_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current)
      if (secretsTimerRef.current) clearTimeout(secretsTimerRef.current)
    }
  }, [])

  const handleSaveToFile = async () => {
    if (subTab === 'notes') {
      const r = await saveVaultNotes(vaultNotes, true)
      if (r.ok) {
        if (r.notes) setVaultNotes(r.notes)
        toast.success(r.message || 'Notizen in Vault-Datei geschrieben.')
      } else {
        toast.error(r.error || 'Speichern fehlgeschlagen.')
      }
      return
    }
    const r = await saveVaultPersonalSecrets(secrets, true)
    if (r.ok) {
      if (r.entries) setSecrets(r.entries)
      toast.success(r.message || 'Passwörter in Vault-Datei geschrieben.')
    } else {
      toast.error(r.error || 'Speichern fehlgeschlagen.')
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Notizen & Safe</h2>
          <p className="text-[11px] text-muted-foreground">
            Liegt im Tresor (Vault). Auto-Sitzung; „In Vault-Datei schreiben“ oder Einstellungen → IOTA sichern.
          </p>
        </div>
        <button
          type="button"
          disabled={!canUseVault}
          onClick={() => void handleSaveToFile()}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          In Vault-Datei schreiben
        </button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
        {(
          [
            ['notes', 'Notizen'],
            ['secrets', 'Passwörter'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium',
              subTab === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {vaultLocked ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          Tresor entsperren, um {subTab === 'notes' ? 'Notizen' : 'Passwörter'} zu bearbeiten.
        </p>
      ) : null}

      {subTab === 'notes' ? (
        <VaultNotesPanel
          unlocked={canUseVault}
          notes={vaultNotes}
          onNotesChange={(next) => {
            setVaultNotes(next)
            if (hydratedRef.current) scheduleNotesRamSave(next)
          }}
        />
      ) : (
        <VaultPersonalSecretsPanel
          unlocked={canUseVault}
          entries={secrets}
          onEntriesChange={(next) => {
            setSecrets(next)
            if (hydratedRef.current) scheduleSecretsRamSave(next)
          }}
        />
      )}
    </section>
  )
}
