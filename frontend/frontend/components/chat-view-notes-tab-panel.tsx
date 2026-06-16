'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { VaultNotesPanel } from '@/frontend/components/vault-notes-panel'
import { fetchVaultNotes, fetchStatus, saveVaultNotes } from '@/frontend/lib/api'
import type { VaultNoteEntry } from '@/frontend/lib/api/vault-notes'

const RAM_SAVE_DEBOUNCE_MS = 800

export function ChatViewNotesTabPanel() {
  const [vaultNotes, setVaultNotes] = useState<VaultNoteEntry[]>([])
  const [canUseVault, setCanUseVault] = useState(false)
  const [vaultLocked, setVaultLocked] = useState(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
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

  const hydrateNotes = useCallback(async () => {
    const r = await fetchVaultNotes()
    if (r.ok && r.unlocked && Array.isArray(r.notes)) {
      setVaultNotes(r.notes)
    }
  }, [])

  useEffect(() => {
    void refreshSession()
    void hydrateNotes()
    hydratedRef.current = true
  }, [refreshSession, hydrateNotes])

  const scheduleRamSave = useCallback((notes: VaultNoteEntry[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void saveVaultNotes(notes, false).then((r) => {
        if (!r.ok) toast.error(r.error || 'Notizen konnten nicht in die Sitzung geschrieben werden.')
      })
    }, RAM_SAVE_DEBOUNCE_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const handleSaveToFile = async () => {
    const r = await saveVaultNotes(vaultNotes, true)
    if (r.ok) {
      if (r.notes) setVaultNotes(r.notes)
      toast.success(r.message || 'Notizen in Vault-Datei geschrieben.')
    } else {
      toast.error(r.error || 'Speichern fehlgeschlagen.')
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Notizen</h2>
          <p className="text-[11px] text-muted-foreground">
            Änderungen werden automatisch in die Sitzung geschrieben. Mit „In Vault-Datei schreiben“ oder unter
            Einstellungen → IOTA sichern.
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
      {vaultLocked ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          Tresor entsperren, um Notizen zu bearbeiten.
        </p>
      ) : null}
      <VaultNotesPanel
        unlocked={canUseVault}
        notes={vaultNotes}
        onNotesChange={(next) => {
          setVaultNotes(next)
          if (hydratedRef.current) scheduleRamSave(next)
        }}
      />
    </section>
  )
}
