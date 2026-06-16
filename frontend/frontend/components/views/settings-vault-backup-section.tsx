'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, Shield, Cloud, Upload, Check, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  vaultSave,
  vaultLoad,
  vaultLoadFromChain,
  vaultOnchain,
  fetchStatus,
  vaultListLocalFiles,
  vaultDeleteLocal,
  importVaultFileFromDevice,
  fetchVaultOnchainPreflight,
  syncVaultChainConfig,
  saveVaultNotes,
  fetchVaultNotes,
} from '@/frontend/lib/api'
import { getIncludeSdkMnemonicInBackup } from '@/frontend/lib/vault-sdk-mnemonic-preference'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

type SettingsVaultBackupSectionProps = {
  vaultLocked?: boolean
  onRequestVaultUnlock?: () => void
}

export function SettingsVaultBackupSection({ vaultLocked = false, onRequestVaultUnlock }: SettingsVaultBackupSectionProps) {
  const [processing, setProcessing] = useState(false)
  const [syncingOnchain, setSyncingOnchain] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [hasKeys, setHasKeys] = useState<boolean | undefined>(undefined)
  const [signerKind, setSignerKind] = useState<string | undefined>(undefined)
  const [lastLocalSavedAt, setLastLocalSavedAt] = useState<number | undefined>(undefined)
  const [lastSavedToChainAt, setLastSavedToChainAt] = useState<number | undefined>(undefined)
  const [deleteLocalDialogOpen, setDeleteLocalDialogOpen] = useState(false)
  const [deleteLocalBusy, setDeleteLocalBusy] = useState(false)
  const [vaultPaths, setVaultPaths] = useState<string[]>([])
  const [defaultVaultPath, setDefaultVaultPath] = useState('.morgendrot-vault')
  const [selectedVaultPath, setSelectedVaultPath] = useState('')
  const vaultFileInputRef = useRef<HTMLInputElement>(null)
  const autoSyncDoneRef = useRef(false)

  const canUseVault = !vaultLocked && hasKeys === true
  const chainDirty =
    lastLocalSavedAt != null && (lastSavedToChainAt == null || lastLocalSavedAt > lastSavedToChainAt)

  const showStatus = (success: boolean, msg: string) => {
    setStatus(success ? 'success' : 'error')
    setStatusMsg(msg)
    setTimeout(() => setStatus('idle'), 5000)
  }

  const refreshVaultStatus = useCallback(async () => {
    try {
      const s = await fetchStatus()
      if ('pollClockHint' in s) {
        setHasKeys(s.hasKeys)
        setSignerKind(typeof s.signer === 'string' ? s.signer : undefined)
        setLastLocalSavedAt(s.vaultStatus?.lastLocalSavedAt)
        setLastSavedToChainAt(s.vaultStatus?.lastSavedToChainAt)
      }
    } catch {
      setHasKeys(undefined)
      setSignerKind(undefined)
    }
  }, [])

  const refreshVaultFileList = useCallback(async () => {
    const r = await vaultListLocalFiles()
    if (r.ok && Array.isArray(r.paths)) {
      setVaultPaths(r.paths)
      const def = r.defaultPath?.trim() || '.morgendrot-vault'
      setDefaultVaultPath(def)
      setSelectedVaultPath((prev) => {
        if (prev && r.paths!.includes(prev)) return prev
        if (r.paths!.includes(def)) return def
        return r.paths![0] ?? def
      })
    }
  }, [])

  useEffect(() => {
    void refreshVaultStatus()
    void refreshVaultFileList()
  }, [refreshVaultStatus, refreshVaultFileList])

  useEffect(() => {
    if (autoSyncDoneRef.current) return
    autoSyncDoneRef.current = true
    void syncVaultChainConfig({ apply: true }).then(() => refreshVaultStatus())
  }, [refreshVaultStatus])

  const flushNotesToRam = async (): Promise<boolean> => {
    const r = await fetchVaultNotes()
    if (!r.ok || !Array.isArray(r.notes)) return true
    const w = await saveVaultNotes(r.notes, false)
    if (!w.ok) toast.error(w.error || 'Notizen konnten nicht synchronisiert werden.')
    return w.ok
  }

  const handleSave = async () => {
    setProcessing(true)
    if (!(await flushNotesToRam())) {
      setProcessing(false)
      return
    }
    const includeSigner = getIncludeSdkMnemonicInBackup() && signerKind === 'sdk' && hasKeys === true
    const res = await vaultSave(undefined, undefined, { includeIotaMnemonic: includeSigner })
    const okMsg = res.ok
      ? includeSigner
        ? 'Lokal gesichert — inkl. Signer-Import.'
        : 'Daten gesichert!'
      : res.error || res.message || 'Fehler beim Speichern'
    showStatus(res.ok, okMsg)
    if (res.ok) toast.success(okMsg)
    else toast.error(okMsg)
    if (res.ok) void refreshVaultStatus()
    setProcessing(false)
  }

  const handleOnchain = async () => {
    if (chainDirty) {
      const go = window.confirm('Lokale Änderungen sind noch nicht auf der Chain.\n\nJetzt auf Chain sichern?')
      if (!go) return
    }
    setSyncingOnchain(true)
    await syncVaultChainConfig({ apply: true })
    const pre = await fetchVaultOnchainPreflight()
    if (!pre.ok || !pre.preflight?.ok) {
      const issues = pre.preflight?.issues?.join(' ') || pre.error || 'Chain-Konfiguration unvollständig.'
      showStatus(false, issues)
      toast.error(issues)
      setSyncingOnchain(false)
      return
    }
    if (!(await flushNotesToRam())) {
      setSyncingOnchain(false)
      return
    }
    const res = await vaultOnchain(undefined, undefined, {
      includeIotaMnemonic: getIncludeSdkMnemonicInBackup() && signerKind === 'sdk' && hasKeys === true,
    })
    showStatus(
      res.ok,
      res.ok
        ? typeof res.message === 'string'
          ? res.message
          : 'Tresor auf Chain gesichert.'
        : res.error || res.message || 'On-Chain-Speichern fehlgeschlagen'
    )
    if (res.ok) {
      void refreshVaultStatus()
      let chainReady = false
      for (let i = 0; i < 6; i++) {
        const check = await fetchVaultOnchainPreflight()
        if (check.preflight?.vaultOnChain) {
          chainReady = true
          break
        }
        if (i < 5) await sleep(2000)
      }
      if (chainReady) setDeleteLocalDialogOpen(true)
      else {
        toast.message('On-Chain gesichert — Chain-Index braucht ggf. 1–2 Min.', { duration: 12_000 })
      }
    }
    setSyncingOnchain(false)
  }

  const handleConfirmDeleteLocalVault = async () => {
    setDeleteLocalBusy(true)
    const del = await vaultDeleteLocal()
    setDeleteLocalBusy(false)
    setDeleteLocalDialogOpen(false)
    if (del.ok) {
      toast.success(typeof del.message === 'string' ? del.message : 'Lokale Vault-Datei gelöscht.')
      void refreshVaultFileList()
    } else {
      toast.error(del.error || del.message || 'Lokale Datei konnte nicht gelöscht werden.')
    }
  }

  const handleLoad = async (filePath?: string) => {
    setProcessing(true)
    const res = await vaultLoad(undefined, filePath)
    showStatus(res.ok, res.ok ? 'Tresor-Datei eingelesen.' : res.error || res.message || 'Fehler beim Laden')
    if (res.ok) {
      toast.success('Tresor-Datei eingelesen.')
      void refreshVaultStatus()
    } else toast.error(res.error || res.message || 'Fehler')
    setProcessing(false)
  }

  const handleLoadFromChain = async () => {
    setProcessing(true)
    const res = await vaultLoadFromChain()
    showStatus(
      res.ok,
      res.ok ? 'Tresor von Chain geladen.' : res.error || res.message || 'Von Chain laden fehlgeschlagen'
    )
    if (res.ok) {
      toast.success('Tresor von Chain geladen.')
      void refreshVaultStatus()
    } else toast.error(res.error || res.message || 'Fehler')
    setProcessing(false)
  }

  const handleImportVaultFromDevice = async (file: File) => {
    setProcessing(true)
    const imp = await importVaultFileFromDevice(file)
    if (!imp.ok) {
      showStatus(false, imp.error || 'Import fehlgeschlagen')
      toast.error(imp.error || 'Import fehlgeschlagen')
      setProcessing(false)
      return
    }
    const loadRes = await vaultLoad(undefined, imp.path)
    const ok = loadRes.ok
    showStatus(ok, ok ? imp.message || 'Vault importiert und geladen.' : loadRes.error || 'Laden nach Import fehlgeschlagen')
    if (ok) {
      toast.success(imp.message || 'Vault importiert.')
      void refreshVaultFileList()
      void refreshVaultStatus()
    }
    setProcessing(false)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {vaultLocked ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
          Tresor gesperrt —{' '}
          {onRequestVaultUnlock ? (
            <button type="button" className="font-medium underline" onClick={onRequestVaultUnlock}>
              entsperren
            </button>
          ) : (
            'zuerst entsperren'
          )}
          , um zu sichern oder zu laden.
        </p>
      ) : null}
      {chainDirty ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
          Lokale Vault-Änderungen sind noch nicht auf der Chain — „Auf Chain sichern“ ausführen.
        </p>
      ) : null}
      {status !== 'idle' ? (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg p-3 text-sm font-medium',
            status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
          )}
        >
          {status === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {statusMsg}
        </div>
      ) : null}
      <input
        ref={vaultFileInputRef}
        type="file"
        className="hidden"
        accept="*"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void handleImportVaultFromDevice(f)
        }}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={processing || !canUseVault}
          className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
        >
          <Download className="h-8 w-8 text-emerald-400" />
          <span className="font-semibold text-foreground">{processing ? 'Speichere…' : 'Lokal sichern'}</span>
          <span className="text-xs text-muted-foreground">Überschreibt die Standard-Vault-Datei</span>
        </button>
        <button
          type="button"
          onClick={() => void handleOnchain()}
          disabled={processing || syncingOnchain || !canUseVault}
          className="flex flex-col items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-center transition-colors hover:bg-amber-500/10 disabled:opacity-50"
        >
          <Shield className="h-8 w-8 text-amber-400" />
          <span className="font-semibold text-foreground">{syncingOnchain ? 'Sichere…' : 'Auf Chain sichern'}</span>
          <span className="text-xs text-muted-foreground">Verschlüsselter Blob auf der Chain</span>
        </button>
        <button
          type="button"
          disabled={processing}
          onClick={() => vaultFileInputRef.current?.click()}
          className="flex flex-col items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 text-center transition-colors hover:bg-blue-500/10 disabled:opacity-50"
        >
          <Upload className="h-8 w-8 text-blue-400" />
          <span className="font-semibold text-foreground">{processing ? 'Bitte warten…' : 'Datei wählen & laden'}</span>
          <span className="text-xs text-muted-foreground">Vault-Datei vom Gerät importieren</span>
        </button>
        <button
          type="button"
          onClick={() => void handleLoadFromChain()}
          disabled={processing || !canUseVault}
          className="flex flex-col items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-5 text-center transition-colors hover:bg-sky-500/10 disabled:opacity-50"
        >
          <Cloud className="h-8 w-8 text-sky-400" />
          <span className="font-semibold text-foreground">{processing ? 'Lade…' : 'Von Chain laden'}</span>
          <span className="text-xs text-muted-foreground">On-Chain-Backup in die Sitzung</span>
        </button>
      </div>
      {vaultPaths.length > 1 ? (
        <div className="border-t border-border/60 pt-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[12rem] flex-1 text-sm">
              <span className="text-muted-foreground">Weitere Server-Dateien</span>
              <select
                value={selectedVaultPath}
                onChange={(e) => setSelectedVaultPath(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm"
              >
                {vaultPaths.map((p) => (
                  <option key={p} value={p}>
                    {p.split(/[/\\]/).pop()}
                    {p === defaultVaultPath ? ' (Standard)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={processing || !selectedVaultPath || !canUseVault}
              onClick={() => void handleLoad(selectedVaultPath)}
              className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              Server-Datei laden
            </button>
          </div>
        </div>
      ) : null}
      <Dialog open={deleteLocalDialogOpen} onOpenChange={setDeleteLocalDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>On-Chain-Backup erfolgreich</DialogTitle>
            <DialogDescription className="space-y-2 pt-1 text-left text-sm">
              <span className="block">
                Lokale Vault-Datei löschen? Sinnvoll, wenn du künftig nur noch von der Chain entsperren willst.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={deleteLocalBusy} onClick={() => setDeleteLocalDialogOpen(false)}>
              Nein, behalten
            </Button>
            <Button type="button" disabled={deleteLocalBusy} onClick={() => void handleConfirmDeleteLocalVault()}>
              {deleteLocalBusy ? 'Prüfe…' : 'Ja, lokale Datei löschen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
