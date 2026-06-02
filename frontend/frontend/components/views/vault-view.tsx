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
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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
} from '@/frontend/lib/api'
import { VAULT_FREETEXT_NOTES_MAX_CHARS } from '../../lib/vault-limits'

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
  const [notes, setNotes] = useState('')
  const [sessionBusy, setSessionBusy] = useState(false)
  /** cli | sdk | remote — aus GET /api/status (SIGNER=sdk: optional Mnemonic in Backup). */
  const [signerKind, setSignerKind] = useState<string | undefined>(undefined)
  const [includeSdkMnemonicInBackup, setIncludeSdkMnemonicInBackup] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(true)
  const notesHydratedRef = useRef(false)
  const [vaultPaths, setVaultPaths] = useState<string[]>([])
  const [defaultVaultPath, setDefaultVaultPath] = useState('.morgendrot-vault')
  const [selectedVaultPath, setSelectedVaultPath] = useState('')
  const vaultFileInputRef = useRef<HTMLInputElement>(null)

  const refreshVaultStatus = useCallback(async () => {
    try {
      const s = await fetchStatus()
      if ('pollClockHint' in s) {
        setHasKeys(s.hasKeys)
        setVaultLocked(!!s.locked)
        setSignerKind(typeof s.signer === 'string' ? s.signer : undefined)
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
    void vaultLoad().then((res) => {
      if (res.ok && typeof res.notes === 'string') setNotes(res.notes)
    })
  }, [variant, hasKeys])

  const showStatus = (success: boolean, msg: string) => {
    setStatus(success ? 'success' : 'error')
    setStatusMsg(msg)
    setTimeout(() => setStatus('idle'), 5000)
  }

  const handleSave = async () => {
    setProcessing(true)
    const includeSigner =
      includeSdkMnemonicInBackup && signerKind === 'sdk' && hasKeys === true
    const res = await vaultSave(undefined, notes, {
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
    }
    setProcessing(false)
  }

  const handleLoad = async (filePath?: string) => {
    setProcessing(true)
    const res = await vaultLoad(undefined, filePath)
    if (res.ok && typeof res.notes === 'string') setNotes(res.notes)
    if (res.ok) {
      const n = typeof res.notes === 'string' ? res.notes.trim() : ''
      const unchangedHint = n.length === 0 ? ' (Keine Notizen in der Datei.)' : ''
      const msg = `Tresor-Datei eingelesen.${unchangedHint}`
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
    if (res.ok && typeof res.notes === 'string') setNotes(res.notes)
    if (res.ok) {
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

  const handleOnchain = async () => {
    setSyncingOnchain(true)
    const res = await vaultOnchain(undefined, notes, {
      includeIotaMnemonic:
        includeSdkMnemonicInBackup && signerKind === 'sdk' && hasKeys === true,
    })
    showStatus(res.ok, res.ok ? 'Tresor auf Chain gesichert.' : res.error || 'On-Chain-Speichern fehlgeschlagen')
    if (res.ok) {
      refreshVaultStatus()
      const wantDelete = window.confirm(
        'On-Chain-Backup erfolgreich.\n\n' +
          'Lokale Vault-Datei auf diesem Server löschen? Nur sinnvoll, wenn du künftig nur noch von der Chain entsperren willst.\n\n' +
          'Die Datei wird nur gelöscht, wenn ein On-Chain-Eintrag für deine Adresse existiert.'
      )
      if (wantDelete) {
        const del = await vaultDeleteLocal()
        if (del.ok) {
          toast.success(typeof del.message === 'string' ? del.message : 'Lokale Vault-Datei gelöscht.')
          void refreshVaultFileList()
        } else {
          toast.error(del.error || del.message || 'Lokale Datei konnte nicht gelöscht werden.')
        }
      }
    }
    setSyncingOnchain(false)
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

  const handleClearLocalInboxOnly = async () => {
    if (
      !window.confirm(
        'Lokalen Klartext-Inbox-Cache (.inbox.enc) auf diesem Gerät schreddern? Vault-Datei und Chain bleiben.'
      )
    ) {
      return
    }
    setSessionBusy(true)
    const res = await clearLocalHistory({ shred: true })
    showStatus(res.ok, res.ok ? res.message || 'Lokaler Inbox-Cache entfernt.' : res.error || 'Fehler')
    setSessionBusy(false)
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
    if (loadRes.ok && typeof loadRes.notes === 'string') setNotes(loadRes.notes)
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
    if (
      !window.confirm(
        'Tresor sperren? Keys und Passwort verlassen den Server-RAM; Inbox-Cache wird geschreddert. Danach Entsperr-Dialog.'
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
      toast.message('Entsperr-Dialog sollte jetzt erscheinen', {
        description: 'Passwort dort eingeben. Falls nicht sichtbar: zur Startseite zurück oder Seite neu laden.',
        duration: 12_000,
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
            <div className="mb-3 flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">Passwort ändern</h4>
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

          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-2 font-semibold text-foreground">Notizen</h4>
            <textarea
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value.slice(0, VAULT_FREETEXT_NOTES_MAX_CHARS))
              }
              maxLength={VAULT_FREETEXT_NOTES_MAX_CHARS}
              rows={5}
              disabled={!canUseVault}
              placeholder="Notizen, Mnemonics, beliebiger Text…"
              className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-y min-h-[100px] disabled:opacity-50"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {notes.length.toLocaleString('de-DE')} / {VAULT_FREETEXT_NOTES_MAX_CHARS.toLocaleString('de-DE')} Zeichen
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-3 font-semibold text-foreground">Sichern</h4>
            {signerKind === 'sdk' ? (
              <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={includeSdkMnemonicInBackup}
                  onChange={(e) => setIncludeSdkMnemonicInBackup(e.target.checked)}
                  disabled={!canUseVault}
                  className="mt-0.5 shrink-0"
                />
                <span>
                  <span className="font-medium text-foreground">Wallet-Seed im Vault speichern</span> (nur{' '}
                  <span className="font-mono">SIGNER=sdk</span>) —{' '}
                  <Link
                    href="/handbook?file=VAULT-EINRICHTEN.md#signer-import-sdk"
                    className="text-primary underline underline-offset-2 hover:text-primary/90"
                  >
                    Handbuch: Signer-Import
                  </Link>
                </span>
              </label>
            ) : null}
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
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4">
            <button
              type="button"
              onClick={() => {
                const next = !showAdvanced
                setShowAdvanced(next)
                if (next) void refreshVaultFileList()
              }}
              className="text-sm font-medium text-foreground hover:text-primary"
            >
              {showAdvanced ? '▼ Erweitert ausblenden' : '▶ Erweitert: Vault-Datei / Chain'}
            </button>
            {showAdvanced ? (
              <div className="mt-4 space-y-4">
                <div>
                  <h5 className="mb-2 text-sm font-medium text-foreground">Vault-Datei vom Gerät</h5>
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
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => vaultFileInputRef.current?.click()}
                      className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-medium hover:bg-blue-500/15 disabled:opacity-50"
                    >
                      {processing ? 'Bitte warten…' : 'Datei wählen & laden'}
                    </button>
                    {!canUseVault && !processing ? (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {vaultLocked
                          ? 'Zuerst Tresor entsperren — danach wird die Datei in die Sitzung geladen.'
                          : hasKeys !== true
                            ? 'Datei kann hochgeladen werden; zum Entschlüsseln in die Sitzung: Startseite → Tresor entsperren oder hier nach Upload „Laden“ (wenn Keys da).'
                            : null}
                      </p>
                    ) : null}
                  </div>
                </div>
                {vaultPaths.length > 1 ? (
                  <div>
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
                        Laden
                      </button>
                    </div>
                  </div>
                ) : null}
                <div>
                  <button
                    type="button"
                    onClick={() => void handleLoadFromChain()}
                    disabled={processing || !canUseVault}
                    className="inline-flex items-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-medium hover:bg-sky-500/15 disabled:opacity-50"
                  >
                    <Cloud className="h-4 w-4 text-sky-400" />
                    {processing ? 'Lade…' : 'Von Chain laden'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
            <h4 className="font-semibold text-foreground">Sitzung</h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={sessionBusy}
                onClick={() => void handleClearLocalInboxOnly()}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                Inbox-Cache leeren
              </button>
              <button
                type="button"
                disabled={sessionBusy}
                onClick={() => void handleVaultLock()}
                className="rounded-lg border border-amber-600/40 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-500/25 disabled:opacity-50 dark:text-amber-200"
              >
                Tresor sperren
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Unterschied &amp; „alles löschen“:{' '}
              <Link
                href="/handbook?file=VAULT-EINRICHTEN.md#spuren-inbox-cache-vs-tresor-sperren"
                className="text-primary underline underline-offset-2"
              >
                Handbuch
              </Link>
            </p>
          </div>

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
