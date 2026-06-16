'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Shield,
  Download,
  Cloud,
  AlertTriangle,
  Trash2,
  Check,
  AlertCircle,
  Lock,
  Upload,
} from 'lucide-react'
import Link from 'next/link'
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
  emergencyPurge,
  fetchStatus,
  vaultLockCommand,
  clearLocalHistory,
  vaultChangePassword,
  vaultListLocalFiles,
  vaultDeleteLocal,
  importVaultFileFromDevice,
  fetchVaultNotes,
  saveVaultNotes,
  fetchVaultOnchainPreflight,
  syncVaultChainConfig,
} from '@/frontend/lib/api'
import type { VaultNoteEntry } from '@/frontend/lib/api/vault-notes'
import { VaultNotesPanel } from '@/frontend/components/vault-notes-panel'
import { getIncludeSdkMnemonicInBackup } from '@/frontend/lib/vault-sdk-mnemonic-preference'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

interface VaultViewProps {
  variant: 'local-vault' | 'emergency-purge'
}

export function VaultView({ variant }: VaultViewProps) {
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [changePwCurrent, setChangePwCurrent] = useState('')
  const [changePwNew, setChangePwNew] = useState('')
  const [changePwConfirm, setChangePwConfirm] = useState('')
  const [changePwBusy, setChangePwBusy] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  /** full = Vault on-chain + Inbox-Cache; local_cache = nur Klartext-Inbox-Datei; lock_session = nur RAM/Tresor sperren */
  const [purgeScope, setPurgeScope] = useState<'full' | 'local_cache' | 'lock_session'>('full')
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [syncingOnchain, setSyncingOnchain] = useState(false)
  const [hasKeys, setHasKeys] = useState<boolean | undefined>(undefined)
  /** GET /api/status locked — wartet auf Entsperr-Dialog (nicht dasselbe wie hasKeys). */
  const [vaultLocked, setVaultLocked] = useState(false)
  const [vaultNotes, setVaultNotes] = useState<VaultNoteEntry[]>([])
  const [notesDirty, setNotesDirty] = useState(false)
  const [vaultNetwork, setVaultNetwork] = useState<string | undefined>(undefined)
  const [lastLocalSavedAt, setLastLocalSavedAt] = useState<number | undefined>(undefined)
  const [lastSavedToChainAt, setLastSavedToChainAt] = useState<number | undefined>(undefined)
  const [rpcHint, setRpcHint] = useState<string | undefined>(undefined)
  const [sessionBusy, setSessionBusy] = useState(false)
  const [chainSyncBusy, setChainSyncBusy] = useState(false)
  /** cli | sdk | remote — aus GET /api/status (SIGNER=sdk). */
  const [signerKind, setSignerKind] = useState<string | undefined>(undefined)
  const [deleteLocalDialogOpen, setDeleteLocalDialogOpen] = useState(false)
  const [deleteLocalBusy, setDeleteLocalBusy] = useState(false)
  const notesHydratedRef = useRef(false)
  const [vaultPaths, setVaultPaths] = useState<string[]>([])
  const [defaultVaultPath, setDefaultVaultPath] = useState('.morgendrot-vault')
  const [selectedVaultPath, setSelectedVaultPath] = useState('')
  const vaultFileInputRef = useRef<HTMLInputElement>(null)

  const hydrateNotesFromApi = useCallback(async () => {
    const r = await fetchVaultNotes()
    if (r.ok && r.unlocked && Array.isArray(r.notes)) {
      setVaultNotes(r.notes)
      setNotesDirty(false)
    }
  }, [])

  const refreshVaultStatus = useCallback(async () => {
    try {
      const s = await fetchStatus()
      if ('pollClockHint' in s) {
        setHasKeys(s.hasKeys)
        setVaultLocked(!!s.locked)
        setSignerKind(typeof s.signer === 'string' ? s.signer : undefined)
        setVaultNetwork(s.vaultStatus?.network)
        setLastLocalSavedAt(s.vaultStatus?.lastLocalSavedAt)
        setLastSavedToChainAt(s.vaultStatus?.lastSavedToChainAt)
        setRpcHint(s.rpcUrlLabel || s.network)
      }
    } catch {
      setHasKeys(undefined)
      setVaultLocked(false)
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
      toast.success(
        r.paths.length
          ? `${r.paths.length} Vault-Datei(en) gefunden.`
          : 'Keine .morgendrot-vault*-Dateien im Server-Arbeitsverzeichnis.'
      )
    } else {
      toast.error(r.error || r.message || 'Dateiliste konnte nicht geladen werden.')
    }
  }, [])

  useEffect(() => {
    if (variant === 'local-vault') {
      void refreshVaultStatus()
      void refreshVaultFileList()
    }
  }, [variant, refreshVaultStatus, refreshVaultFileList])

  useEffect(() => {
    if (hasKeys !== true) notesHydratedRef.current = false
  }, [hasKeys])

  useEffect(() => {
    if (variant !== 'local-vault' || hasKeys !== true || notesHydratedRef.current) return
    notesHydratedRef.current = true
    void hydrateNotesFromApi()
  }, [variant, hasKeys, hydrateNotesFromApi])

  const syncNotesToRam = async (): Promise<boolean> => {
    const r = await saveVaultNotes(vaultNotes, false)
    if (!r.ok) {
      toast.error(r.error || 'Notizen konnten nicht in die Sitzung geschrieben werden.')
      return false
    }
    setNotesDirty(false)
    return true
  }

  const chainDirty =
    notesDirty ||
    (lastLocalSavedAt != null &&
      (lastSavedToChainAt == null || lastLocalSavedAt > lastSavedToChainAt))

  const handleSave = async () => {
    setProcessing(true)
    if (!(await syncNotesToRam())) {
      setProcessing(false)
      return
    }
    const includeSigner =
      getIncludeSdkMnemonicInBackup() && signerKind === 'sdk' && hasKeys === true
    const res = await vaultSave(undefined, undefined, {
      includeIotaMnemonic: includeSigner,
    })
    const okMsg = res.ok
      ? includeSigner
        ? 'Lokal gesichert — inkl. Signer-Import (nächstes Mal nur Vault-Passwort zum Entsperren).'
        : 'Daten gesichert!'
      : res.error || res.message || 'Fehler beim Speichern'
    showStatus(res.ok, okMsg)
    if (res.ok) toast.success(okMsg)
    else if (!res.ok) toast.error(okMsg)
    if (res.ok) {
      refreshVaultStatus()
      setNotesDirty(false)
    }
    setProcessing(false)
  }

  const showStatus = (success: boolean, msg: string) => {
    setStatus(success ? 'success' : 'error')
    setStatusMsg(msg)
    setTimeout(() => setStatus('idle'), 5000)
  }

  const handleSaveNotesOnly = async () => {
    setProcessing(true)
    const r = await saveVaultNotes(vaultNotes, true)
    if (r.ok) {
      if (r.notes) setVaultNotes(r.notes)
      setNotesDirty(false)
      toast.success(r.message || 'Notizen lokal gespeichert.')
      refreshVaultStatus()
    } else {
      toast.error(r.error || 'Speichern fehlgeschlagen.')
    }
    setProcessing(false)
  }

  const handleLoad = async (filePath?: string) => {
    setProcessing(true)
    const res = await vaultLoad(undefined, filePath)
    if (res.ok) {
      if (Array.isArray(res.vaultNotes)) setVaultNotes(res.vaultNotes)
      else await hydrateNotesFromApi()
      setNotesDirty(false)
      const msg = 'Tresor-Datei eingelesen.'
      showStatus(true, msg)
      toast.success(msg)
      refreshVaultStatus()
    } else {
      const err = res.error || res.message || 'Fehler beim Laden'
      showStatus(false, err)
      toast.error(err)
    }
    setProcessing(false)
  }

  const handleLoadFromChain = async () => {
    setProcessing(true)
    const res = await vaultLoadFromChain()
    if (res.ok) {
      if (Array.isArray(res.vaultNotes)) setVaultNotes(res.vaultNotes)
      else await hydrateNotesFromApi()
      setNotesDirty(false)
      const msg = 'Tresor von Chain geladen.'
      showStatus(true, msg)
      toast.success(msg)
      refreshVaultStatus()
    } else {
      const err = res.error || res.message || 'Von Chain laden fehlgeschlagen'
      showStatus(false, err)
      toast.error(err)
    }
    setProcessing(false)
  }

  const handleSyncChainConfig = async () => {
    setChainSyncBusy(true)
    const sync = await syncVaultChainConfig({ apply: true })
    setChainSyncBusy(false)
    if (sync.ok) {
      const msg = [
        sync.applied?.length ? `Übernommen: ${sync.applied.join('; ')}` : null,
        sync.skipped?.length ? `Offen: ${sync.skipped.join('; ')}` : null,
        sync.preflight?.ok ? `Chain bereit (${sync.preflight.network}).` : sync.preflight?.issues?.[0],
      ]
        .filter(Boolean)
        .join(' ')
      showStatus(true, msg || 'Chain-Konfiguration geprüft.')
      toast.success(msg || 'Chain-Konfiguration synchronisiert.')
      void refreshVaultStatus()
    } else {
      const err =
        sync.error ||
        sync.preflight?.issues?.join(' ') ||
        sync.message ||
        'Chain-Sync fehlgeschlagen'
      showStatus(false, err)
      toast.error(err)
    }
  }

  const handleOnchain = async () => {
    if (chainDirty) {
      const go = window.confirm(
        'Lokale Änderungen sind noch nicht auf der Chain.\n\nJetzt auf Chain sichern?'
      )
      if (!go) return
    }
    setSyncingOnchain(true)
    await syncVaultChainConfig({ apply: true })
    const pre = await fetchVaultOnchainPreflight()
    if (!pre.ok || !pre.preflight?.ok) {
      const issues = pre.preflight?.issues?.join(' ') || pre.error || 'Chain-Konfiguration unvollständig.'
      const hints = pre.preflight?.hints?.[0]
      showStatus(false, hints ? `${issues} — ${hints}` : issues)
      toast.error(issues)
      setSyncingOnchain(false)
      return
    }
    if (!(await syncNotesToRam())) {
      setSyncingOnchain(false)
      return
    }
    const res = await vaultOnchain(undefined, undefined, {
      includeIotaMnemonic:
        getIncludeSdkMnemonicInBackup() && signerKind === 'sdk' && hasKeys === true,
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
      refreshVaultStatus()
      setNotesDirty(false)
      let chainReady = false
      for (let i = 0; i < 6; i++) {
        const check = await fetchVaultOnchainPreflight()
        if (check.preflight?.vaultOnChain) {
          chainReady = true
          break
        }
        if (i < 5) await sleep(2000)
      }
      if (chainReady) {
        setDeleteLocalDialogOpen(true)
      } else {
        toast.message('On-Chain gesichert — Chain-Index braucht ggf. 1–2 Min.', {
          description:
            'Lokale Vault-Datei kannst du später löschen, wenn „Von Chain laden“ funktioniert.',
          duration: 12_000,
        })
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

  const handleChangePassword = async () => {
    if (!changePwCurrent.trim() || !changePwNew.trim()) {
      showStatus(false, 'Aktuelles und neues Passwort eingeben.')
      return
    }
    if (changePwNew !== changePwConfirm) {
      showStatus(false, 'Neues Passwort und Wiederholung stimmen nicht überein.')
      return
    }
    if (changePwNew.length < 8) {
      showStatus(false, 'Neues Passwort: mindestens 8 Zeichen.')
      return
    }
    setChangePwBusy(true)
    const res = await vaultChangePassword(changePwCurrent.trim(), changePwNew.trim())
    if (res.ok) {
      showStatus(true, res.message || 'Passwort geändert.')
      toast.success(res.message || 'Passwort geändert.')
      setChangePwCurrent('')
      setChangePwNew('')
      setChangePwConfirm('')
    } else {
      const err = res.error || res.message || 'Passwort ändern fehlgeschlagen'
      showStatus(false, err)
      toast.error(err)
    }
    setChangePwBusy(false)
  }

  const handlePurge = async () => {
    if (confirmText !== 'LÖSCHEN') return
    setProcessing(true)
    try {
      if (purgeScope === 'full') {
        const res = await emergencyPurge()
        showStatus(res.ok, res.ok ? 'Vault on-chain notfall-gelöscht + lokaler Inbox-Cache geschreddert.' : res.error || 'Fehler')
        if (res.ok) {
          setConfirmPurge(false)
          setConfirmText('')
        }
      } else if (purgeScope === 'local_cache') {
        const res = await clearLocalHistory({ shred: true })
        showStatus(
          res.ok,
          res.ok ? res.message || 'Lokaler Klartext-Inbox-Cache entfernt (Chain/Vault-Datei unverändert).' : res.error || 'Fehler'
        )
        if (res.ok) {
          setConfirmPurge(false)
          setConfirmText('')
        }
      } else {
        const res = await vaultLockCommand()
        showStatus(res.ok, res.ok ? res.message || 'Tresor gesperrt, Keys aus RAM.' : res.error || res.message || 'Fehler')
        if (res.ok) {
          setConfirmPurge(false)
          setConfirmText('')
        }
      }
    } finally {
      setProcessing(false)
    }
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
    const loadPath = imp.path
    const loadRes = await vaultLoad(undefined, loadPath)
    if (loadRes.ok) {
      if (Array.isArray(loadRes.vaultNotes)) setVaultNotes(loadRes.vaultNotes)
      else await hydrateNotesFromApi()
      setNotesDirty(false)
    }
    const ok = loadRes.ok
    showStatus(ok, ok ? imp.message || 'Vault importiert und geladen.' : loadRes.error || 'Laden nach Import fehlgeschlagen')
    if (ok) {
      toast.success(imp.message || 'Vault importiert und in die Sitzung geladen.')
      void refreshVaultFileList()
      void refreshVaultStatus()
    } else if (imp.ok) {
      toast.message(
        loadRes.error ||
          'Datei gespeichert — Startseite „Tresor entsperren“, dann wird die Vault in die Sitzung geladen.'
      )
      void refreshVaultFileList()
      void refreshVaultStatus()
    } else {
      toast.error(loadRes.error || 'Nach Import: Laden in die Sitzung fehlgeschlagen.')
    }
    setProcessing(false)
  }

  const handleVaultLock = async () => {
    const sdkHint =
      signerKind === 'sdk'
        ? '\n\nBei SIGNER=sdk: Seed/Mnemonic wurde aus dem RAM entfernt — beim Entsperren ggf. erneut eingeben (sofern nicht dauerhaft in der Vault-Datei gespeichert).'
        : ''
    if (
      !window.confirm(
        'Tresor sperren?\n\n' +
          '• Messaging-Keys + Wallet-Passwort verlassen den Server-RAM\n' +
          '• Lokaler Klartext-Inbox-Cache (.inbox.enc) wird geschreddert\n' +
          '• Vault-Datei auf der Platte bleibt — Entsperren mit Vault-Passwort' +
          sdkHint
      )
    ) {
      return
    }
    setSessionBusy(true)
    const res = await vaultLockCommand()
    showStatus(
      res.ok,
      res.ok ? res.message || 'Tresor gesperrt.' : res.error || res.message || 'Fehler'
    )
    if (res.ok) {
      toast.message('Entsperr-Dialog — Vault-Passwort eingeben', {
        description:
          signerKind === 'sdk'
            ? 'Falls der Seed nicht in der Vault liegt: Mnemonic/Secret erneut eingeben.'
            : 'Falls der Dialog fehlt: Startseite oder F5.',
        duration: 14_000,
      })
    }
    await refreshVaultStatus()
    setSessionBusy(false)
  }

  const canUseVault = !vaultLocked && hasKeys === true

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl',
            variant === 'local-vault'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          )}
        >
          {variant === 'local-vault' ? (
            <Shield className="h-6 w-6" />
          ) : (
            <AlertTriangle className="h-6 w-6" />
          )}
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-foreground">
            {variant === 'local-vault' ? 'Tresor & Sicherheit' : 'Notfall-Löschung'}
          </h2>
          {variant === 'local-vault' ? (
            <Link
              href="/handbook?file=VAULT-EINRICHTEN.md"
              className="text-sm text-primary underline underline-offset-2 hover:text-primary/90"
            >
              Handbuch
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Unwiderruflich on-chain</span>
          )}
        </div>
      </div>

      {/* Status */}
      {status !== 'idle' && (
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg p-3 text-sm font-medium',
            status === 'success'
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-red-500/10 text-red-400'
          )}
        >
          {status === 'success' ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {statusMsg}
        </div>
      )}

      {variant === 'local-vault' && (
        <div className="space-y-4">
          {vaultLocked ? (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              Tresor ist <strong className="font-medium">gesperrt</strong>. Der{' '}
              <strong className="font-medium">Entsperr-Dialog</strong> (Vollbild) sollte über dieser Seite liegen — dort
              Passwort eingeben. Siehst du ihn nicht: <strong className="font-medium">Zurück</strong> zur Startseite oder
              Seite neu laden (F5).
            </p>
          ) : null}

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                <h4 className="font-semibold text-foreground">Passwort ändern</h4>
              </div>
              <button
                type="button"
                disabled={sessionBusy}
                onClick={() => void handleVaultLock()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-600/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-500/25 disabled:opacity-50 dark:text-amber-200"
              >
                <Lock className="h-3.5 w-3.5" />
                Tresor sperren
              </button>
            </div>
            <div className="grid max-w-md gap-3">
              <label className="block text-sm">
                <span className="text-muted-foreground">Aktuelles Passwort</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={changePwCurrent}
                  onChange={(e) => setChangePwCurrent(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Neues Passwort (min. 8 Zeichen)</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={changePwNew}
                  onChange={(e) => setChangePwNew(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-muted-foreground">Neues Passwort wiederholen</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={changePwConfirm}
                  onChange={(e) => setChangePwConfirm(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2"
                />
              </label>
              <button
                type="button"
                disabled={changePwBusy || !canUseVault}
                onClick={() => void handleChangePassword()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {changePwBusy ? 'Ändere…' : 'Passwort ändern'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h4 className="font-semibold text-foreground">Sync &amp; Netzwerk</h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li>
                RPC:{' '}
                <span className="font-mono text-foreground">{rpcHint || '—'}</span>
                {vaultNetwork ? (
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                    {vaultNetwork}
                  </span>
                ) : null}
              </li>
              <li>
                Lokal zuletzt:{' '}
                {lastLocalSavedAt
                  ? new Date(lastLocalSavedAt).toLocaleString('de-DE')
                  : '—'}
              </li>
              <li>
                Chain zuletzt:{' '}
                {lastSavedToChainAt
                  ? new Date(lastSavedToChainAt).toLocaleString('de-DE')
                  : 'noch nie'}
              </li>
            </ul>
            {chainDirty ? (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                Lokale Änderungen sind noch nicht auf der Chain gesichert — „Auf Chain sichern“ ausführen.
              </p>
            ) : null}
            <button
              type="button"
              disabled={chainSyncBusy || processing}
              onClick={() => void handleSyncChainConfig()}
              className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-medium hover:bg-sky-500/15 disabled:opacity-50"
            >
              {chainSyncBusy ? 'Prüfe…' : 'Chain-Konfiguration automatisch prüfen & übernehmen'}
            </button>
            <p className="text-[11px] text-muted-foreground">
              Übernimmt RPC, PACKAGE_ID und Registry-IDs aus lokalen Deploy-Dateien (.morgendrot-package-id,
              .morgendrot-globals-ids.json) und prüft Testnet/Mainnet auf der Chain.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-foreground">Notizen</h4>
              <button
                type="button"
                disabled={processing || !canUseVault}
                onClick={() => void handleSaveNotesOnly()}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                In Vault-Datei schreiben
              </button>
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">
              Notizen und Anhänge werden mit „Lokal sichern“ bzw. „Auf Chain sichern“ mitgesichert — On-Chain sinnvoll
              für Backup/Recovery, aber große Anhänge erhöhen Blob-Größe und Gas.
            </p>
            <VaultNotesPanel
              unlocked={canUseVault}
              notes={vaultNotes}
              onNotesChange={(next) => {
                setVaultNotes(next)
                setNotesDirty(true)
              }}
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-3 font-semibold text-foreground">Sichern &amp; Laden</h4>
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
                disabled={processing}
                className="flex flex-col items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
              >
                <Download className="h-8 w-8 text-emerald-400" />
                <span className="font-semibold text-foreground">{processing ? 'Speichere…' : 'Lokal sichern'}</span>
                <span className="text-xs text-muted-foreground">Überschreibt die Standard-Vault-Datei</span>
              </button>
              <button
                type="button"
                onClick={() => void handleOnchain()}
                disabled={processing || syncingOnchain}
                className="flex flex-col items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 text-center transition-colors hover:bg-amber-500/10 disabled:opacity-50"
              >
                <Shield className="h-8 w-8 text-amber-400" />
                <span className="font-semibold text-foreground">
                  {syncingOnchain ? 'Sichere…' : 'Auf Chain sichern'}
                </span>
                <span className="text-xs text-muted-foreground">Verschlüsselter Blob auf der Chain</span>
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={() => vaultFileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 text-center transition-colors hover:bg-blue-500/10 disabled:opacity-50"
              >
                <Upload className="h-8 w-8 text-blue-400" />
                <span className="font-semibold text-foreground">
                  {processing ? 'Bitte warten…' : 'Datei wählen & laden'}
                </span>
                <span className="text-xs text-muted-foreground">Vault-Datei vom Gerät importieren</span>
              </button>
              <button
                type="button"
                onClick={() => void handleLoadFromChain()}
                disabled={processing || !canUseVault}
                className="flex flex-col items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-5 text-center transition-colors hover:bg-sky-500/10 disabled:opacity-50"
              >
                <Cloud className="h-8 w-8 text-sky-400" />
                <span className="font-semibold text-foreground">
                  {processing ? 'Lade…' : 'Von Chain laden'}
                </span>
                <span className="text-xs text-muted-foreground">On-Chain-Backup in die Sitzung</span>
              </button>
            </div>
            {!canUseVault && !processing ? (
              <p className="mt-3 text-[11px] text-muted-foreground">
                {vaultLocked
                  ? 'Zuerst Tresor entsperren — danach können Datei/Chain in die Sitzung geladen werden.'
                  : hasKeys !== true
                    ? 'Datei kann hochgeladen werden; zum Entschlüsseln: Tresor entsperren.'
                    : null}
              </p>
            ) : null}
            {vaultPaths.length > 1 ? (
              <div className="mt-4 border-t border-border/60 pt-4">
                <h5 className="mb-2 text-sm font-medium text-foreground">Weitere Dateien auf dem Server</h5>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[12rem] flex-1 text-sm">
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
          </div>

          <Dialog open={deleteLocalDialogOpen} onOpenChange={setDeleteLocalDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>On-Chain-Backup erfolgreich</DialogTitle>
                <DialogDescription className="space-y-2 pt-1 text-left text-sm">
                  <span className="block">
                    Lokale Vault-Datei auf diesem Server löschen? Sinnvoll, wenn du künftig nur noch von der Chain
                    entsperren willst.
                  </span>
                  <span className="block text-muted-foreground">
                    Die Datei wird nur gelöscht, wenn der On-Chain-Eintrag für deine Adresse bestätigt ist.
                  </span>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={deleteLocalBusy}
                  onClick={() => setDeleteLocalDialogOpen(false)}
                >
                  Nein, behalten
                </Button>
                <Button
                  type="button"
                  disabled={deleteLocalBusy}
                  onClick={() => void handleConfirmDeleteLocalVault()}
                >
                  {deleteLocalBusy ? 'Prüfe…' : 'Ja, lokale Datei löschen'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        </div>
      )}

      {variant === 'emergency-purge' && (
        <div className="space-y-4">
          {/* Warning */}
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 shrink-0 text-red-400" />
              <div>
                <h4 className="font-semibold text-red-400">Achtung: Unwiderruflich (Chain-Teil)!</h4>
                <p className="mt-1 text-sm text-red-300/80">
                  Der Umfang hängt von der gewählten Option ab (siehe unten). On-Chain gelöschte Vault-Daten sind
                  dauerhaft weg. Die lokale Vault-Datei wird vom Notfall-Purge{' '}
                  <strong className="text-red-200">nicht automatisch gelöscht</strong> – bei Bedarf Datei manuell
                  entfernen.
                </p>
              </div>
            </div>
          </div>

          {/* What gets deleted */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-3 font-semibold text-foreground">Was passiert bei welcher Option?</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <Trash2 className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                <span>
                  <strong className="text-foreground">Vollständig:</strong> Eine Chain-Transaktion entfernt den
                  Vault-Eintrag im Registry (verschlüsselter On-Chain-Backup-Inhalt). Zusätzlich wird der lokale
                  Klartext-Inbox-Cache (<code className="text-xs">.inbox.enc</code>) geschreddert. Die Datei{' '}
                  <code className="text-xs">.morgendrot-vault</code> (oder <code className="text-xs">VAULT_FILE</code>)
                  bleibt auf der Platte – Inhalt ist weiter verschlüsselt, Recovery von der Chain ist nach Purge nicht
                  mehr möglich.
                </span>
              </li>
              <li className="flex gap-2">
                <Trash2 className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
                <span>
                  <strong className="text-foreground">Nur lokale Klartext-Spuren:</strong> nur Inbox-Cache schreddern;
                  keine Chain-TX; Vault-Datei und On-Chain-Vault unverändert.
                </span>
              </li>
              <li className="flex gap-2">
                <Lock className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                <span>
                  <strong className="text-foreground">Nur Sitzung sperren:</strong> Keys und Wallet-Passwort aus RAM;
                  Inbox-Cache schreddern; Vault-Datei bleibt.
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-3 font-semibold text-foreground">Umfang wählen</h4>
            <div className="space-y-2 text-sm">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="purge-scope"
                  checked={purgeScope === 'full'}
                  onChange={() => setPurgeScope('full')}
                  className="mt-1"
                />
                <span>
                  <strong className="text-foreground">Vollständig (Vault on-chain)</strong>
                  <span className="block text-muted-foreground">
                    Notfall-Purge auf der Chain + lokaler Inbox-Klartext-Cache. Braucht ENABLE_PURGE und Wallet.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="purge-scope"
                  checked={purgeScope === 'local_cache'}
                  onChange={() => setPurgeScope('local_cache')}
                  className="mt-1"
                />
                <span>
                  <strong className="text-foreground">Nur lokale Klartext-Spuren</strong>
                  <span className="block text-muted-foreground">
                    Schreddert nur den Server-Inbox-Cache (.inbox.enc). Keine Chain-TX, Vault-Datei bleibt.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="purge-scope"
                  checked={purgeScope === 'lock_session'}
                  onChange={() => setPurgeScope('lock_session')}
                  className="mt-1"
                />
                <span>
                  <strong className="text-foreground">Nur Sitzung / Tresor sperren</strong>
                  <span className="block text-muted-foreground">
                    Keys und Wallet-Passwort aus RAM; Inbox-Cache schreddern. Vault-Datei auf Disk bleibt.
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Confirmation */}
          {!confirmPurge ? (
            <button
              onClick={() => setConfirmPurge(true)}
              className="w-full rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center transition-colors hover:bg-red-500/20"
            >
              <span className="font-semibold text-red-400">Notfall-Löschung starten</span>
            </button>
          ) : (
            <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Tippe <span className="font-mono text-red-400">LÖSCHEN</span> zum Bestätigen
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="LÖSCHEN"
                  className="w-full rounded-lg border border-red-500/30 bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-red-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setConfirmPurge(false)
                    setConfirmText('')
                  }}
                  className="flex-1 rounded-lg border border-border bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:bg-accent/80"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handlePurge}
                  disabled={processing || confirmText !== 'LÖSCHEN'}
                  className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {processing ? 'Lösche...' : 'Endgültig löschen'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
