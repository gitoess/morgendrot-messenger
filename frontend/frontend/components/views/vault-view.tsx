'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Shield,
  Download,
  Upload,
  AlertTriangle,
  Trash2,
  Check,
  AlertCircle,
  Lock,
  Cloud,
  CloudOff,
  KeyRound,
  Copy,
  Plus,
} from 'lucide-react'
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
  fetchVaultPersonalSecrets,
  saveVaultPersonalSecrets,
  vaultListLocalFiles,
  type VaultStatus,
  type PersonalSecretEntry,
} from '@/frontend/lib/api'
import { VAULT_FREETEXT_NOTES_MAX_CHARS } from '../../lib/vault-limits'

interface VaultViewProps {
  variant: 'local-vault' | 'emergency-purge'
}

export function VaultView({ variant }: VaultViewProps) {
  const [password, setPassword] = useState('')
  const [confirmPurge, setConfirmPurge] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  /** full = Vault on-chain + Inbox-Cache; local_cache = nur Klartext-Inbox-Datei; lock_session = nur RAM/Tresor sperren */
  const [purgeScope, setPurgeScope] = useState<'full' | 'local_cache' | 'lock_session'>('full')
  const [processing, setProcessing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [syncingOnchain, setSyncingOnchain] = useState(false)
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null)
  const [hasKeys, setHasKeys] = useState<boolean | undefined>(undefined)
  const [notes, setNotes] = useState('')
  const [sessionBusy, setSessionBusy] = useState(false)
  const [vaultMainTab, setVaultMainTab] = useState<'backup' | 'safe'>('backup')
  const [safeEntries, setSafeEntries] = useState<PersonalSecretEntry[]>([])
  const [safeBusy, setSafeBusy] = useState(false)
  const [safeMsg, setSafeMsg] = useState<string | null>(null)
  const [vaultPaths, setVaultPaths] = useState<string[]>([])
  const [vaultDefaultPath, setVaultDefaultPath] = useState<string | null>(null)
  /** cli | sdk | remote — aus GET /api/status (SIGNER=sdk: optional Mnemonic in Backup). */
  const [signerKind, setSignerKind] = useState<string | undefined>(undefined)
  const [includeSdkMnemonicInBackup, setIncludeSdkMnemonicInBackup] = useState(false)

  const refreshVaultStatus = useCallback(async () => {
    try {
      const s = await fetchStatus()
      if ('pollClockHint' in s) {
        setVaultStatus(s.vaultStatus ?? null)
        setHasKeys(s.hasKeys)
        setSignerKind(typeof s.signer === 'string' ? s.signer : undefined)
      }
    } catch {
      setVaultStatus(null)
      setHasKeys(undefined)
      setSignerKind(undefined)
    }
  }, [])

  const refreshVaultPaths = useCallback(async () => {
    const r = await vaultListLocalFiles()
    if (r.ok && Array.isArray(r.paths)) setVaultPaths(r.paths)
    else setVaultPaths([])
    setVaultDefaultPath(typeof r.defaultPath === 'string' ? r.defaultPath : null)
  }, [])

  useEffect(() => {
    if (variant === 'local-vault') {
      void refreshVaultStatus()
      void refreshVaultPaths()
    }
  }, [variant, refreshVaultStatus, refreshVaultPaths])

  useEffect(() => {
    if (hasKeys === false) setSafeEntries([])
  }, [hasKeys])

  useEffect(() => {
    if (variant !== 'local-vault' || hasKeys !== true) return
    let alive = true
    fetchVaultPersonalSecrets().then((r) => {
      if (!alive || !r.ok || !r.unlocked || !Array.isArray(r.entries)) return
      setSafeEntries(r.entries)
    })
    return () => {
      alive = false
    }
  }, [variant, hasKeys])

  const showStatus = (success: boolean, msg: string) => {
    setStatus(success ? 'success' : 'error')
    setStatusMsg(msg)
    setTimeout(() => setStatus('idle'), 5000)
  }

  const handleSave = async () => {
    setProcessing(true)
    const res = await vaultSave(password || undefined, notes)
    showStatus(res.ok, res.ok ? 'Daten gesichert!' : res.error || 'Fehler beim Speichern')
    if (res.ok) {
      refreshVaultStatus()
      void refreshVaultPaths()
    }
    setProcessing(false)
  }

  const handleLoad = async () => {
    setProcessing(true)
    const res = await vaultLoad(password || undefined)
    if (res.ok && 'notes' in res && typeof (res as { notes?: string }).notes === 'string') setNotes((res as { notes: string }).notes)
    if (res.ok && Array.isArray(res.personalSecrets)) setSafeEntries(res.personalSecrets)
    showStatus(res.ok, res.ok ? 'Daten wiederhergestellt!' : res.error || 'Fehler beim Laden')
    if (res.ok) {
      refreshVaultStatus()
      void refreshVaultPaths()
    }
    setProcessing(false)
  }

  const handleLoadFromChain = async () => {
    setProcessing(true)
    const res = await vaultLoadFromChain(password || undefined)
    if (res.ok && 'notes' in res && typeof (res as { notes?: string }).notes === 'string') setNotes((res as { notes: string }).notes)
    if (res.ok && Array.isArray(res.personalSecrets)) setSafeEntries(res.personalSecrets)
    showStatus(res.ok, res.ok ? 'Tresor von Chain geladen!' : res.error || 'Von Chain laden fehlgeschlagen')
    if (res.ok) {
      refreshVaultStatus()
      void refreshVaultPaths()
    }
    setProcessing(false)
  }

  const handleOnchain = async () => {
    setSyncingOnchain(true)
    const res = await vaultOnchain(password || undefined, notes, {
      includeIotaMnemonic:
        includeSdkMnemonicInBackup && signerKind === 'sdk' && hasKeys === true,
    })
    showStatus(res.ok, res.ok ? 'Tresor auf Chain gesichert.' : res.error || 'On-Chain-Speichern fehlgeschlagen')
    if (res.ok) {
      refreshVaultStatus()
      void refreshVaultPaths()
    }
    setSyncingOnchain(false)
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

  const handleVaultLock = async () => {
    if (
      !window.confirm(
        'Tresor sperren? Entfernt Keys und Wallet-Passwort aus der Backend-Sitzung und schreddert den lokalen Inbox-Klartext-Cache. Danach in der App erneut entsperren (/vault-load bzw. Passwort-Dialog).'
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
    setSafeEntries([])
    setVaultMainTab('backup')
    await refreshVaultStatus()
    setSessionBusy(false)
  }

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
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {variant === 'local-vault' ? 'Tresor & Passwortmanager' : 'Notfall-Löschung'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {variant === 'local-vault'
              ? 'Messaging-Identität sichern — Passwörter/Zugänge im selben verschlüsselten Container (kein Chatverlauf hier)'
              : 'Lösche alle sensiblen Daten sofort'}
          </p>
          {variant === 'local-vault' && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setVaultMainTab('backup')}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  vaultMainTab === 'backup'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                )}
              >
                Tresor öffnen &amp; sichern
              </button>
              <button
                type="button"
                onClick={() => setVaultMainTab('safe')}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  vaultMainTab === 'safe'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                )}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Passwortmanager
              </button>
            </div>
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
          {vaultMainTab === 'safe' ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4">
                <h4 className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                  <KeyRound className="h-5 w-5 text-violet-500" />
                  Passwortmanager
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Anlegen / bearbeiten:</strong> Einträge unten.{' '}
                  <strong className="text-foreground">Speichern:</strong> zuerst „Übernehmen (Sitzung)“, dann „Passwortmanager in Tresor-Datei schreiben“ — damit landen die Daten im{' '}
                  <strong className="text-foreground">selben</strong> verschlüsselten Container wie die Messaging-Keys (keine zweite Vault-Datei).
                  Klartext nur im Backend-RAM bei entsperrtem Tresor. Nach dem Kopieren ggf. Zwischenablage leeren. „Auf Chain sichern“ (im Tab Tresor) sichert den gesamten Blob inkl. Passwortmanager mit.
                </p>
              </div>
              {hasKeys !== true ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-200">
                  Zuerst Wallet entsperren und <strong className="font-medium">Tresor öffnen</strong> (Tab „Tresor öffnen &amp; sichern“: „Daten laden“ oder App-Start mit Vault). Danach kannst du den Passwortmanager nutzen.
                </p>
              ) : (
                <>
                  {safeMsg && (
                    <p className="text-xs text-muted-foreground" role="status">
                      {safeMsg}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={safeBusy}
                      onClick={() =>
                        setSafeEntries((p) => [
                          ...p,
                          {
                            id:
                              typeof crypto !== 'undefined' && 'randomUUID' in crypto
                                ? crypto.randomUUID()
                                : `e-${Date.now()}`,
                            title: 'Neuer Eintrag',
                            updatedAt: Date.now(),
                          },
                        ])
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Neuer Eintrag
                    </button>
                    <button
                      type="button"
                      disabled={safeBusy}
                      onClick={async () => {
                        setSafeBusy(true)
                        setSafeMsg(null)
                        const r = await saveVaultPersonalSecrets(safeEntries, false)
                        setSafeBusy(false)
                        if (r.ok) {
                          setSafeMsg(r.message ?? 'Passwortmanager in der Sitzung übernommen (noch nicht in der Datei).')
                          if (r.entries) setSafeEntries(r.entries)
                        } else setSafeMsg(r.error ?? 'Fehler')
                      }}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
                    >
                      Passwortmanager übernehmen (nur Sitzung)
                    </button>
                    <button
                      type="button"
                      disabled={safeBusy}
                      onClick={async () => {
                        setSafeBusy(true)
                        setSafeMsg(null)
                        const r = await saveVaultPersonalSecrets(safeEntries, true)
                        setSafeBusy(false)
                        if (r.ok) {
                          setSafeMsg(r.message ?? 'Passwortmanager in Tresor-Datei gespeichert.')
                          if (r.entries) setSafeEntries(r.entries)
                          void refreshVaultStatus()
                        } else setSafeMsg(r.error ?? 'Fehler')
                      }}
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      Passwortmanager in Tresor-Datei schreiben
                    </button>
                  </div>
                  <div className="space-y-3">
                    {safeEntries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Noch keine Einträge – „Neuer Eintrag“ oder nach Vault-Laden erscheinen gespeicherte Daten.</p>
                    ) : (
                      safeEntries.map((e) => (
                        <div key={e.id} className="space-y-2 rounded-lg border border-border bg-card p-3">
                          <input
                            value={e.title}
                            onChange={(ev) =>
                              setSafeEntries((prev) =>
                                prev.map((x) =>
                                  x.id === e.id ? { ...x, title: ev.target.value, updatedAt: Date.now() } : x
                                )
                              )
                            }
                            placeholder="Titel"
                            className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm font-medium"
                          />
                          <input
                            value={e.username ?? ''}
                            onChange={(ev) =>
                              setSafeEntries((prev) =>
                                prev.map((x) =>
                                  x.id === e.id ? { ...x, username: ev.target.value, updatedAt: Date.now() } : x
                                )
                              )
                            }
                            placeholder="Benutzername (optional)"
                            className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm"
                          />
                          <input
                            type="password"
                            value={e.secret ?? ''}
                            onChange={(ev) =>
                              setSafeEntries((prev) =>
                                prev.map((x) =>
                                  x.id === e.id ? { ...x, secret: ev.target.value, updatedAt: Date.now() } : x
                                )
                              )
                            }
                            placeholder="Passwort / Seed / Schlüssel"
                            autoComplete="off"
                            className="w-full rounded-md border border-border bg-input px-2 py-1.5 font-mono text-sm"
                          />
                          <textarea
                            value={e.note ?? ''}
                            onChange={(ev) =>
                              setSafeEntries((prev) =>
                                prev.map((x) =>
                                  x.id === e.id ? { ...x, note: ev.target.value, updatedAt: Date.now() } : x
                                )
                              )
                            }
                            placeholder="Notiz (optional)"
                            rows={2}
                            className="w-full rounded-md border border-border bg-input px-2 py-1.5 text-sm"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={!e.secret}
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(e.secret ?? '')
                                  setSafeMsg('Geheimtext in Zwischenablage kopiert.')
                                } catch {
                                  setSafeMsg('Kopieren fehlgeschlagen (Berechtigung / HTTPS).')
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                            >
                              <Copy className="h-3 w-3" />
                              Kopieren
                            </button>
                            <button
                              type="button"
                              onClick={() => setSafeEntries((prev) => prev.filter((x) => x.id !== e.id))}
                              className="inline-flex items-center gap-1 rounded-md border border-red-500/30 px-2 py-1 text-xs text-red-600 hover:bg-red-500/10 dark:text-red-400"
                            >
                              <Trash2 className="h-3 w-3" />
                              Entfernen
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Wichtig:</strong> Der <strong className="text-foreground">Chat- und Nachrichtenverlauf</strong> wird{' '}
            <strong className="text-foreground">nicht</strong> in der Vault-Datei gespeichert — er kommt von der Chain und optional lokal aus{' '}
            <span className="font-mono">.inbox.enc</span> (Cache). Hier sicherst du nur <strong className="text-foreground">Messaging-Keys</strong>,{' '}
            optional Signer-Notizen und (im Tab Passwortmanager) Zugangsdaten im selben Blob. Doku:{' '}
            <span className="font-mono">docs/VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md</span> (im Repo).
          </div>
          <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 p-4 text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground">Andere Vault-Datei = Tresor wechseln (kein Windows-Logout)</p>
            <p className="mt-1.5">
              <strong className="text-foreground">„Daten laden“</strong> ersetzt die <strong className="text-foreground">Tresor-Daten in dieser Backend-Sitzung</strong> (Messaging-Keys, Notizen, Passwortmanager) durch den Inhalt der Datei — vergleichbar mit einem <strong className="text-foreground">anderen Tresor-Nutzer</strong> für Chat/Handshake, <strong className="text-foreground">nicht</strong> mit einem zweiten PC-Benutzerkonto. Die Web-App bleibt entsperrt; du wirst <strong className="text-foreground">nicht</strong> automatisch zum Passwort-Dialog geschickt (außer du nutzt „Tresor sperren“).
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Passwort:</strong> Trage unten das <strong className="text-foreground">Passwort dieser Vault-Datei</strong> ein — es hat Vorrang vor dem Wallet-Passwort der Sitzung. Leer lassen nur, wenn Vault und App-Entsperren <strong className="text-foreground">dieselbe</strong> Passphrase nutzen.
            </p>
          </div>
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
            <h4 className="mb-2 text-sm font-semibold text-foreground">Tresor: Ablauf in vier Schritten</h4>
            <ol className="list-decimal space-y-1.5 pl-4 text-xs text-muted-foreground">
              <li>
                <span className="text-foreground font-medium">Wallet</span> oben in der App entsperren (Passwort für Signatur
                / CLI-Keystore – nicht dasselbe wie der Tresor, kann aber identisch sein).
              </li>
              <li>
                <span className="text-foreground font-medium">Tresor-Passwort</span> unten eintragen: wird zum Verschlüsseln
                der Datei <span className="font-mono">.morgendrot-vault</span> und des Chain-Backups genutzt (PBKDF2 +
                AES-GCM im Backend).
              </li>
              <li>
                <span className="text-foreground font-medium">Öffnen:</span> „Daten laden“ (lokal) oder „Von Chain laden“
                (braucht RPC, <span className="font-mono">VAULT_REGISTRY_ID</span>, <span className="font-mono">PACKAGE_ID</span>).
              </li>
              <li>
                <span className="text-foreground font-medium">Sichern:</span> bei Änderungen „Lokal sichern“; optional
                „Auf Chain sichern“ für geräteunabhängiges Backup.
              </li>
            </ol>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-2 font-semibold text-foreground">Aktueller Zustand</h4>
            <p className="text-sm text-muted-foreground">
              {hasKeys === true
                ? 'Sitzung aktiv: Messaging-Keys und Konfiguration liegen im Backend-RAM (ECDH, optional Streams-Anker). Du kannst chatten und signieren.'
                : vaultStatus?.hasLocal
                  ? 'Keine Keys im RAM. Auf der Platte liegt eine Vault-Datei – Tresor-Passwort eintragen und „Daten laden“ oder „Von Chain laden“.'
                  : 'Noch keine Vault-Datei erkannt. Nach erstem Setup: „Lokal sichern“; oder Keys nur in der Sitzung bis zum Speichern.'}
            </p>
            <p className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">On-Chain-Backup:</span>{' '}
              {vaultStatus?.lastSavedToChainAt
                ? `Kopie auf der Chain – zuletzt ${new Date(vaultStatus.lastSavedToChainAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}.`
                : 'Kein gemeldeter Zeitstempel – unabhängig davon, ob eine lokale Datei existiert.'}
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              {vaultStatus?.lastSavedToChainAt ? (
                <>
                  <Cloud className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span>Chain-Backup vorhanden.</span>
                </>
              ) : (
                <>
                  <CloudOff className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>Chain-Backup nicht gemeldet.</span>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold text-foreground">Gefundene Vault-Dateien (Server-Verzeichnis)</h4>
              <button
                type="button"
                onClick={() => void refreshVaultPaths()}
                className="rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-accent"
              >
                Liste aktualisieren
              </button>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              Alle Dateien, die wie <span className="font-mono">.morgendrot-vault*</span> heißen (ein Datei = ein
              verschlüsselter Container für Messaging-Keys + optional Passwortmanager-Einträge + Notizen). Es gibt kein separates
              „KeePass-Dateiformat“ – <strong className="text-foreground">Passwortmanager</strong> ist ein Bereich innerhalb
              desselben Vault-Blobs. Standardpfad für „Daten laden“:{' '}
              <span className="font-mono text-foreground">{vaultDefaultPath ?? '.morgendrot-vault'}</span>
              . Anderen Pfad nur per CLI <span className="font-mono">/vault-load &lt;pw&gt; &lt;pfad&gt;</span>.
            </p>
            {vaultPaths.length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine Vault-Dateien im Arbeitsverzeichnis des Backends.</p>
            ) : (
              <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-[11px] text-muted-foreground">
                {vaultPaths.map((p) => (
                  <li
                    key={p}
                    className={cn(
                      'rounded border border-border/60 px-2 py-1',
                      vaultDefaultPath && p === vaultDefaultPath && 'border-primary/40 bg-primary/5 text-foreground'
                    )}
                  >
                    {p}
                    {vaultDefaultPath && p === vaultDefaultPath ? (
                      <span className="ml-2 text-[10px] text-primary">Standard</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">Tresor-Passwort</h4>
            </div>
            <label className="mb-1.5 block text-sm text-muted-foreground">
              Für Vault-Datei und Chain-Backup; beim <strong className="text-foreground">Laden</strong> hat dieses Feld{' '}
              <strong className="text-foreground">Vorrang</strong> vor dem Wallet-Passwort der Sitzung (andere Datei =
              anderes Passwort möglich)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Passwort eingeben…"
              autoComplete="off"
              className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <ul className="mt-4 space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Wann brauchst du es?</span> Beim{' '}
                <strong className="text-foreground">Entschlüsseln</strong> (Laden von Platte/Chain) und beim{' '}
                <strong className="text-foreground">neuen Verschlüsseln</strong> (Speichern). Beim <strong className="text-foreground">Laden</strong>: ausgefülltes Feld = dieses Passwort zuerst (andere Vault-Datei). Leer = Fallback auf{' '}
                <strong className="text-foreground">Wallet-Passwort</strong> der Sitzung.
              </li>
              <li>
                <span className="font-medium text-foreground">Mehrere Vault-Dateien?</span> Jede Datei kann ein eigenes
                Passwort haben. Gleiche App-Version = gleiches Dateiformat; Passwörter sind nicht untereinander
                „kompatibel“, du musst pro Datei das richtige kennen.
              </li>
              <li>
                <span className="font-medium text-foreground">Passwort vergessen?</span> Es gibt{' '}
                <strong className="text-foreground">keine technische Wiederherstellung</strong> des Vault-Inhalts. Optionen:
                separates IOTA-Seed-/Key-Backup (Wallet neu einrichten, Messaging-Keys neu), oder alte Vault-Datei +
                richtiges Passwort, oder Chain-Backup + richtiges Passwort. Für Kunden: klare Anleitung, Passwort-Manager,
                getrenntes Wallet-Backup.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-1 font-semibold text-foreground">1. Tresor öffnen</h4>
            <p className="mb-3 text-xs text-muted-foreground">
              Zwei Wege – beide brauchen das Tresor-Passwort (oder Fallback auf Wallet-Passwort, siehe oben).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void handleLoad()}
                disabled={processing}
                className="flex flex-col items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 text-center transition-colors hover:bg-blue-500/10 disabled:opacity-50"
              >
                <Upload className="h-8 w-8 text-blue-400" />
                <span className="font-semibold text-foreground">{processing ? 'Lade…' : 'Daten laden'}</span>
                <span className="text-xs text-muted-foreground">
                  Lokale Datei <span className="font-mono">.morgendrot-vault</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void handleLoadFromChain()}
                disabled={processing}
                className="flex flex-col items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/5 p-5 text-center transition-colors hover:bg-sky-500/10 disabled:opacity-50"
              >
                <Cloud className="h-8 w-8 text-sky-400" />
                <span className="font-semibold text-foreground">{processing ? 'Lade…' : 'Von Chain laden'}</span>
                <span className="text-xs text-muted-foreground">Voraussetzungen: RPC, Registry, Package-ID, vorheriges On-Chain-Backup</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-2 font-semibold text-foreground">2. Notizen &amp; Freitext</h4>
            <p className="mb-2 text-xs text-muted-foreground">
              Landen im gleichen verschlüsselten Vault wie die Keys (max.{' '}
              {VAULT_FREETEXT_NOTES_MAX_CHARS.toLocaleString('de-DE')} Zeichen — verhindert zu große Blobs). Lange Tagebücher
              lieber <strong className="text-foreground">außerhalb</strong> des Vaults ablegen. Strukturierte Zugangsdaten: Reiter{' '}
              <strong className="text-foreground">Passwortmanager</strong> (pro Eintrag begrenzt).
            </p>
            <textarea
              value={notes}
              onChange={(e) =>
                setNotes(e.target.value.slice(0, VAULT_FREETEXT_NOTES_MAX_CHARS))
              }
              maxLength={VAULT_FREETEXT_NOTES_MAX_CHARS}
              rows={5}
              placeholder="Notizen, Mnemonics, beliebiger Text…"
              className="w-full rounded-lg border border-border bg-input px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-y min-h-[100px]"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {notes.length.toLocaleString('de-DE')} / {VAULT_FREETEXT_NOTES_MAX_CHARS.toLocaleString('de-DE')} Zeichen
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-1 font-semibold text-foreground">3. Sichern &amp; Backup</h4>
            <p className="mb-3 text-xs text-muted-foreground">
              Nach Änderungen zuerst lokal sichern; Chain-Backup zusätzlich für anderen Rechner oder Verlust der Datei.
            </p>
            {signerKind === 'sdk' ? (
              <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-lg border border-border/80 bg-muted/30 p-3 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={includeSdkMnemonicInBackup}
                  onChange={(e) => setIncludeSdkMnemonicInBackup(e.target.checked)}
                  disabled={hasKeys !== true}
                  className="mt-0.5 shrink-0"
                />
                <span>
                  <span className="font-medium text-foreground">Signer-Import mit speichern</span>
                  {' — '}
                  dieselbe Mnemonic/Bech32 wie beim Entsperren verschlüsselt in Vault-Datei bzw. Chain-Blob (wie Lite-UI).
                  {hasKeys !== true ? (
                    <span className="block pt-1 text-amber-700 dark:text-amber-300">
                      Nur bei entsperrtem Tresor (Keys im RAM) möglich — zuerst laden oder Wallet entsperren.
                    </span>
                  ) : null}
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
                <span className="text-xs text-muted-foreground">
                  Schreibt/aktualisiert die Vault-Datei (Standardpfad) — überschreibt dieselbe Datei, kein „Kopie“-Dialog
                </span>
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
                <span className="text-xs text-muted-foreground">Verschlüsselter Blob in der Registry (IOTA)</span>
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
            <h4 className="font-semibold text-foreground">4. Sitzung beenden &amp; lokale Spuren</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Wenn du nicht „Tresor sperren“ nutzt:</strong> Keys und Wallet-Passwort
              bleiben im Backend-Prozess im RAM, bis du sperrst, den Server beendest oder der Rechner neu startet. Die
              verschlüsselte Vault-Datei auf der Festplatte ändert sich dabei nicht.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Die Messenger-Web-UI hält die sichtbare Nachrichtenliste im Browser-RAM. Auf dem Rechner kann zusätzlich die
              Datei <span className="font-mono">.morgendrot-vault.inbox.enc</span> liegen (nach Abruf entschlüsselbar).{' '}
              <strong className="text-foreground">Lokale Spuren verwischen</strong> schreddert nur diesen Inbox-Cache.{' '}
              <strong className="text-foreground">Tresor sperren</strong> entfernt zusätzlich Keys und Wallet-Passwort aus
              dem Backend-RAM und schreddert den Inbox-Cache (wie <span className="font-mono">/vault-lock</span>) – zum
              Weiterarbeiten danach Wallet entsperren und ggf. „Daten laden“.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={sessionBusy}
                onClick={() => void handleClearLocalInboxOnly()}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium hover:bg-accent disabled:opacity-50"
              >
                Lokale Spuren verwischen (Inbox-Cache)
              </button>
              <button
                type="button"
                disabled={sessionBusy}
                onClick={() => void handleVaultLock()}
                className="rounded-lg border border-amber-600/40 bg-amber-500/15 px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-500/25 disabled:opacity-50 dark:text-amber-200"
              >
                Tresor sperren + Inbox-Cache schreddern
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h4 className="mb-2 font-semibold text-foreground">Was wird gesichert?</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>ECDH-Schlüssel (Messaging) und Handshake-Informationen</li>
              <li>Passwortmanager: Titel, Benutzername, Geheimtext, Notiz (im Vault-Payload)</li>
              <li>Optionale Streams Anchor-ID und Konfiguration</li>
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              Zuerst lokal sichern, dann bei Bedarf „Auf Chain sichern“ – so hast du ein Backup unabhängig vom Gerät.
            </p>
          </div>
            </>
          )}
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
