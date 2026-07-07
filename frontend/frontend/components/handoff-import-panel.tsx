'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  HANDOFF_IMPORT_DRAFT_KEY,
  hasLocalHandoffPendingServerApply,
  readHandoffImportDraft,
} from '@/frontend/lib/handoff-pending-server-apply'
import { FileUp, KeyRound, Lock, Package, RefreshCw } from 'lucide-react'
import { applyHandoffEnvImport, previewHandoffEnvImport, type HandoffImportSummary } from '@/frontend/lib/api/handoff-env-import'
import {
  consumePendingHandoffZipFromInbox,
  HANDOFF_PENDING_INBOX_EVENT,
} from '@/frontend/lib/handoff-pending-inbox'
import {
  decryptHandoffPending,
  extractHandoffFromZipBytesAuto,
  extractHandoffFromZipFile,
  type HandoffEncryptedPending,
} from '@/frontend/lib/handoff-zip-import'
import { recordHandoffProfileImport } from '@/frontend/lib/handoff-profile-history'
import { previewHandoffEnvImportLocal } from '@/frontend/lib/handoff-env-local-preview'
import { applyHandoffEnvToLocalDevice } from '@/frontend/lib/handoff-device-bootstrap'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { HelperJoinRequestForm } from '@/frontend/components/onboarding/helper-join-request-form'
import { HANDOFF_DRAFT_TTL_MS } from '@/frontend/lib/offline-cache-ttl'
import { parseHandoffExtrasJson, saveHandoffExtras } from '@/frontend/lib/handoff-extras'
import { applyTeamBroadcastKeysFromExtras } from '@/frontend/lib/handoff-team-broadcast-keys'
import { clearLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { getApiBase } from '@/frontend/lib/api/api-base'
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/dashboard-basis-offline-hint'
import {
  maybeRequestHelperSeedSetup,
  notifyStandaloneHandoffApplied,
  shouldShowHelperSeedSetupDialog,
} from '@/frontend/lib/handoff-standalone-ready'
import { restartBackend } from '@/frontend/lib/api/backend-restart'
import { triggerHiddenFileInput } from '@/frontend/lib/trigger-hidden-file-input'
import { waitForBackend } from '@/frontend/lib/wait-for-backend'

type HandoffDraftSnapshot = {
  savedAtMs: number
  envText: string
  runtimeConfigText: string | null
}

export function HandoffImportPanel(
  p: {
    backendOnline?: boolean | null
    embedded?: boolean
    onApplied?: () => void
    /** Boss auf Einsatzleitung-Home: Import sichtbar, mit Hinweis auf Lokal vormerken. */
    bossEinsatzViewer?: boolean
  } = {}
) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [envText, setEnvText] = useState<string | null>(null)
  const [fileLabel, setFileLabel] = useState('')
  const [summary, setSummary] = useState<HandoffImportSummary | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [statusMsg, setStatusMsg] = useState('')
  const [applied, setApplied] = useState(false)
  const [reloading, setReloading] = useState(false)
  const [hardRestartBusy, setHardRestartBusy] = useState(false)
  const [pendingEncrypted, setPendingEncrypted] = useState<HandoffEncryptedPending | null>(null)
  const [handoffPassword, setHandoffPassword] = useState('')
  const [runtimeConfigText, setRuntimeConfigText] = useState<string | null>(null)
  const [draft, setDraft] = useState<HandoffDraftSnapshot | null>(null)
  const [localAppliedOnly, setLocalAppliedOnly] = useState(false)
  const [stage, setStage] = useState<
    'idle' | 'reading' | 'decrypting' | 'previewing' | 'ready' | 'applying' | 'applied'
  >('idle')
  const [basisApplyReady, setBasisApplyReady] = useState(false)
  const prevBackendOnlineRef = useRef<boolean | null>(null)

  const reset = () => {
    setEnvText(null)
    setFileLabel('')
    setSummary(null)
    setErrors([])
    setStatusMsg('')
    setApplied(false)
    setPendingEncrypted(null)
    setHandoffPassword('')
    setRuntimeConfigText(null)
    setLocalAppliedOnly(false)
    setStage('idle')
  }

  const loadDraftFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(HANDOFF_IMPORT_DRAFT_KEY)
      if (!raw) {
        setDraft(null)
        return
      }
      const parsed = JSON.parse(raw) as Partial<HandoffDraftSnapshot>
      const savedAtMs = Number(parsed.savedAtMs ?? 0)
      const envText = typeof parsed.envText === 'string' ? parsed.envText : ''
      const runtimeConfigText = typeof parsed.runtimeConfigText === 'string' ? parsed.runtimeConfigText : null
      const ageMs = Date.now() - savedAtMs
      if (
        !Number.isFinite(savedAtMs) ||
        savedAtMs <= 0 ||
        !Number.isFinite(ageMs) ||
        ageMs < 0 ||
        ageMs > HANDOFF_DRAFT_TTL_MS ||
        !envText.trim()
      ) {
        try {
          window.localStorage.removeItem(HANDOFF_IMPORT_DRAFT_KEY)
        } catch {
          // ignore
        }
        setDraft(null)
        return
      }
      setDraft({ savedAtMs, envText, runtimeConfigText })
    } catch {
      setDraft(null)
    }
  }, [])

  const persistDraft = useCallback((env: string, runtimeJson?: string | null) => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        HANDOFF_IMPORT_DRAFT_KEY,
        JSON.stringify({
          savedAtMs: Date.now(),
          envText: env,
          runtimeConfigText: runtimeJson?.trim() || null,
        })
      )
      loadDraftFromStorage()
    } catch {
      // Entwurf ist optional.
    }
  }, [loadDraftFromStorage])

  const standaloneHandoffMode =
    typeof window !== 'undefined' &&
    (!getApiBase().trim() || isStandaloneMessengerWithoutBasis())
  const helperSeedPending =
    typeof window !== 'undefined' &&
    (applied || localAppliedOnly) &&
    shouldShowHelperSeedSetupDialog()

  const fireHandoffApplied = useCallback(() => {
    notifyStandaloneHandoffApplied()
    p.onApplied?.()
  }, [p.onApplied])

  const applyExtractedEnv = useCallback(async (text: string, label: string, runtimeJson?: string, extrasJson?: string) => {
    setStage('previewing')
    setEnvText(text)
    setRuntimeConfigText(runtimeJson?.trim() || null)
    if (extrasJson?.trim()) {
      const parsed = parseHandoffExtrasJson(extrasJson)
      if (parsed) {
        saveHandoffExtras(parsed)
        applyTeamBroadcastKeysFromExtras(parsed)
      }
    }
    persistDraft(text, runtimeJson)
    setFileLabel(label)
    const local = previewHandoffEnvImportLocal(text, null)
    if (!getApiBase().trim()) {
      setSummary(local.summary)
      setErrors(local.errors)
      if (local.ok) {
        setStatusMsg(
          'Standalone-APK: Vorschau OK — unten „Lokal vormerken (ohne Basis)“ wählen (nicht „Import bestätigen“).'
        )
        setStage('ready')
      } else {
        setStatusMsg('Vorschau: Bitte Fehler beheben oder andere ZIP wählen.')
        setStage('idle')
      }
      return
    }
    let remoteError = ''
    try {
      const preview = await previewHandoffEnvImport(text)
      if (preview.summary) setSummary(preview.summary)
      else setSummary(local.summary)
      if (preview.errors?.length) setErrors(preview.errors)
      else if (preview.error) {
        remoteError = preview.error
        setErrors(local.errors)
      } else setErrors([])
      if (!preview.ok && !remoteError) {
        setStatusMsg('Vorschau: Bitte Fehler beheben oder andere ZIP wählen.')
        setStage('idle')
      } else {
        if (remoteError) {
          setStatusMsg('Offline-Vorschau aktiv (lokal validiert). Endgültiges Anwenden benötigt erreichbare Basis.')
        } else {
          setStatusMsg('')
        }
        setStage('ready')
      }
    } catch {
      setSummary(local.summary)
      setErrors(local.errors)
      setStatusMsg('Offline-Vorschau aktiv (lokal validiert). Endgültiges Anwenden benötigt erreichbare Basis.')
      setStage(local.ok ? 'ready' : 'idle')
    }
  }, [persistDraft])

  const processZipBytes = useCallback(
    async (data: Uint8Array, label: string, password?: string) => {
      const extracted = await extractHandoffFromZipBytesAuto(data, password)
      if ('needsPassword' in extracted && extracted.needsPassword) {
        setEnvText(null)
        setPendingEncrypted(extracted.pending)
        setFileLabel(`${label} (passwortgeschützt)`)
        setStatusMsg('Diese ZIP ist verschlüsselt — Handoff-Passwort vom Boss eingeben.')
        return
      }
      if (!extracted.ok) {
        setErrors(['error' in extracted ? extracted.error : 'Handoff konnte nicht gelesen werden.'])
        setEnvText(null)
        return
      }
      await applyExtractedEnv(
        extracted.envText,
        `${label} → ${extracted.envFileName}${extracted.encrypted ? ' (entschlüsselt)' : ''}`,
        extracted.runtimeConfigText,
        extracted.extrasText
      )
    },
    [applyExtractedEnv]
  )

  const loadZip = useCallback(
    async (file: File) => {
      setBusy(true)
      setStage('reading')
      setStatusMsg('')
      setApplied(false)
      setErrors([])
      setSummary(null)
      setPendingEncrypted(null)
      setHandoffPassword('')
      try {
        const buf = await file.arrayBuffer()
        await processZipBytes(new Uint8Array(buf), file.name)
      } finally {
        setBusy(false)
        setStage((prev) => (prev === 'reading' ? 'idle' : prev))
      }
    },
    [processZipBytes]
  )

  const loadPendingFromInbox = useCallback(async () => {
    const pending = consumePendingHandoffZipFromInbox()
    if (!pending) return
    setBusy(true)
    setStage('decrypting')
    setErrors([])
    try {
      const label = pending.meta.label?.trim()
        ? `Posteingang: ${pending.meta.label}`
        : 'Posteingang (Boss-Handoff)'
      await processZipBytes(pending.zipBytes, label)
      setStatusMsg('Handoff aus Posteingang geladen — bei Schutz Passwort eingeben, dann Vorschau prüfen.')
    } finally {
      setBusy(false)
    }
  }, [processZipBytes])

  useEffect(() => {
    loadDraftFromStorage()
  }, [loadDraftFromStorage])

  useEffect(() => {
    void loadPendingFromInbox()
    const onPending = () => void loadPendingFromInbox()
    window.addEventListener(HANDOFF_PENDING_INBOX_EVENT, onPending)
    return () => window.removeEventListener(HANDOFF_PENDING_INBOX_EVENT, onPending)
  }, [loadPendingFromInbox])

  useEffect(() => {
    if (hasLocalHandoffPendingServerApply()) {
      setLocalAppliedOnly(true)
    }
  }, [])

  useEffect(() => {
    const online = p.backendOnline === true
    const wasOnline = prevBackendOnlineRef.current === true
    prevBackendOnlineRef.current = p.backendOnline ?? null
    if (!online) {
      setBasisApplyReady(false)
      return
    }
    const pendingServerApply = localAppliedOnly || hasLocalHandoffPendingServerApply()
    if (!pendingServerApply) return
    if (!wasOnline) {
      const storedDraft = readHandoffImportDraft()
      if (!envText?.trim() && storedDraft?.envText) {
        void applyExtractedEnv(
          storedDraft.envText,
          'Entwurf (nach Reconnect)',
          storedDraft.runtimeConfigText ?? undefined
        )
      }
      setBasisApplyReady(true)
      setStatusMsg(
        'Basis wieder erreichbar — „Import bestätigen“ ausführen, damit das Profil persistent auf der Basis liegt (nicht nur lokal vorgemerkt).'
      )
    }
  }, [p.backendOnline, localAppliedOnly, envText, applyExtractedEnv])

  const onDecrypt = async () => {
    if (!pendingEncrypted) return
    if (!handoffPassword.trim()) {
      setErrors(['Bitte das Handoff-Passwort eingeben.'])
      return
    }
    setBusy(true)
    setErrors([])
    try {
      const extracted = await decryptHandoffPending(pendingEncrypted, handoffPassword)
      if (!extracted.ok) {
        setErrors(['error' in extracted ? extracted.error : 'Handoff konnte nicht gelesen werden.'])
        return
      }
      setPendingEncrypted(null)
      setHandoffPassword('')
      await applyExtractedEnv(extracted.envText, `handoff.morg.enc → ${extracted.envFileName}`)
      setStatusMsg('Entschlüsselt — Vorschau prüfen und Import bestätigen.')
    } finally {
      setBusy(false)
      setStage((prev) => (prev === 'decrypting' ? 'idle' : prev))
    }
  }

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) void loadZip(f)
  }

  const onApplyLocalOnly = useCallback(() => {
    if (!envText?.trim()) return
    const local = previewHandoffEnvImportLocal(envText, null)
    if (!local.ok) {
      setErrors(local.errors)
      setStatusMsg('Lokales Vormerken fehlgeschlagen — Vorschau-Fehler beheben.')
      return
    }
    applyHandoffEnvToLocalDevice(envText)
    setLocalAppliedOnly(true)
    setApplied(true)
    setStage('applied')
    setErrors([])
    if (local.summary) {
      setSummary(local.summary)
      recordHandoffProfileImport(envText, local.summary)
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(HANDOFF_IMPORT_DRAFT_KEY)
      } catch {
        // ignore
      }
    }
    setDraft(null)
    fireHandoffApplied()
    setStatusMsg(
      shouldShowHelperSeedSetupDialog()
        ? 'Schritt 1 erledigt — unten „Seed einrichten“ (QR vom Boss) oder Dialog bestätigen.'
        : 'Schritt 1 erledigt — Package, Mailbox und Fullnode sind lokal gespeichert.'
    )
  }, [envText, fireHandoffApplied])

  const onApply = async () => {
    if (!envText?.trim()) return
    if (!getApiBase().trim()) {
      onApplyLocalOnly()
      return
    }
    setStage('applying')
    setBusy(true)
    setStatusMsg('')
    setErrors([])
    try {
      const r = await applyHandoffEnvImport(envText, runtimeConfigText ?? undefined)
      if (r.summary) setSummary(r.summary)
      if (r.errors?.length) {
        setErrors(r.errors)
        setStatusMsg(r.error || 'Import teilweise fehlgeschlagen.')
        return
      }
      if (!r.ok) {
        setErrors([r.error || 'Import fehlgeschlagen'])
        setStage('ready')
        return
      }
      setApplied(true)
      setLocalAppliedOnly(false)
      setStage('applied')
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem(HANDOFF_IMPORT_DRAFT_KEY)
        } catch {
          // ignore
        }
      }
      setDraft(null)
      clearLocalHandoffAppliedSnapshot()
      setBasisApplyReady(false)
      setLocalAppliedOnly(false)
      if (r.summary) recordHandoffProfileImport(envText, r.summary)
      fireHandoffApplied()
      setStatusMsg(
        r.applied?.length
          ? `${r.applied.length} Einstellung(en) gespeichert — die Basis hat die Werte bereits übernommen. Seite neu laden, dann Tresor entsperren.`
          : 'Import OK — Seite neu laden, dann Tresor entsperren.'
      )
    } finally {
      setBusy(false)
    }
  }

  const onReloadPage = () => {
    setReloading(true)
    window.location.reload()
  }

  /** Nur Fallback: unter npm run dev beendet /api/restart oft den API-Prozess ohne Neustart durch concurrently. */
  const onHardRestart = async () => {
    setHardRestartBusy(true)
    setStatusMsg('Backend-Neustart … bitte warten (kann bis zu 90 s dauern).')
    try {
      await restartBackend()
    } catch {
      /* Verbindung bricht erwartbar ab */
    }
    const ok = await waitForBackend({ maxMs: 90_000, intervalMs: 1500 })
    if (ok) {
      window.location.reload()
      return
    }
    setStatusMsg(
      'Backend antwortet noch nicht. Terminal prüfen: npm run start:secrets — danach Seite manuell neu laden.'
    )
    setHardRestartBusy(false)
  }

  const embedded = p.embedded === true

  return (
    <div className={embedded ? 'space-y-3' : 'rounded-xl border border-purple-500/30 bg-card p-4'}>
      <div className={embedded ? 'space-y-3' : 'flex items-start gap-3'}>
        {!embedded ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-300">
            <Package className="h-5 w-5" aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0 flex-1 space-y-3">
          {basisApplyReady && p.backendOnline === true && envText && !applied ? (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-950 dark:text-emerald-100">
              <p className="font-medium">Basis erreichbar — persistentes Profil anwenden</p>
              <p className="mt-1 text-xs opacity-90">
                Lokal vorgemerkt reicht für Offline-Hinweise. Für den dauerhaften Stand auf dem Server jetzt{' '}
                <strong>Import bestätigen</strong> (unten).
              </p>
            </div>
          ) : null}

          {p.bossEinsatzViewer && !embedded ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
              <p className="font-medium">Boss-Profil — Helfer testen</p>
              <p className="mt-1 text-xs opacity-90">
                In <strong>Inkognito</strong> oder zweitem Browser: ZIP wählen, dann{' '}
                <strong>Lokal vormerken (ohne Basis)</strong> — nicht „Import bestätigen“ (würde die Boss-.env
                überschreiben). Oder Backend neu mit <span className="font-mono">npm run env:role:arbeiter</span>{' '}
                starten und dort normal importieren.
              </p>
            </div>
          ) : null}

          {!embedded ? (
            <div>
              <h4 className="font-semibold text-foreground">Handoff importieren</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                Boss-ZIP wählen oder aus dem <strong className="text-foreground">Posteingang</strong> (Menü an der
                Nachricht) — Klartext oder <span className="font-mono text-xs">handoff.morg.enc</span>.
                {standaloneHandoffMode ? (
                  <>
                    {' '}
                    Auf der <strong className="text-foreground">Standalone-APK ohne PC-Server</strong>: nach der Vorschau{' '}
                    <strong className="text-foreground">Lokal vormerken (ohne Basis)</strong>, dann Seite neu laden und
                    Mnemonic im Entsperren-Dialog oder Puls setzen.
                  </>
                ) : (
                  <>
                    {' '}
                    Danach <strong className="text-foreground">Seite neu laden</strong> und Tresor entsperren.
                  </>
                )}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Boss-ZIP wählen — Package, Mailbox und Netzwerk werden übernommen.
            </p>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={onPickFile}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => triggerHiddenFileInput(fileRef)}
              className="inline-flex items-center gap-2 rounded-lg border border-purple-400/45 bg-purple-500/10 px-4 py-2 text-sm font-medium text-foreground hover:bg-purple-500/20 disabled:opacity-50"
            >
              <FileUp className="h-4 w-4" aria-hidden />
              {busy ? 'Lese ZIP…' : 'Handoff-ZIP wählen'}
            </button>
            {envText || pendingEncrypted ? (
              <button
                type="button"
                disabled={busy}
                onClick={reset}
                className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Zurücksetzen
              </button>
            ) : null}
          </div>

          {stage !== 'idle' ? (
            <p className="text-xs text-muted-foreground" role="status">
              {stage === 'reading'
                ? 'Fortschritt: ZIP wird gelesen...'
                : stage === 'decrypting'
                  ? 'Fortschritt: ZIP wird entschlüsselt...'
                  : stage === 'previewing'
                    ? 'Fortschritt: Vorschau/Validierung...'
                    : stage === 'applying'
                      ? 'Fortschritt: Werte werden angewendet...'
                      : stage === 'ready'
                        ? 'Vorschau bereit.'
                        : 'Import abgeschlossen. App/Seite neu starten.'}
            </p>
          ) : null}

          {fileLabel ? (
            <p className="text-xs text-muted-foreground">
              Datei: <span className="font-mono text-foreground">{fileLabel}</span>
            </p>
          ) : null}

          {draft && !envText ? (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-950 dark:text-sky-100">
              <p>
                Entwurf gefunden ({new Date(draft.savedAtMs).toLocaleString('de-DE')}).
              </p>
              <p className="mt-1 text-[11px] text-sky-900/90 dark:text-sky-100/90">
                Hinweis: Der Draft hilft nur fuer Vorschau/Validierung. Das endgueltige Anwenden schreibt weiterhin ueber
                die Basis-API.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void applyExtractedEnv(
                      draft.envText,
                      `Lokaler Entwurf (${new Date(draft.savedAtMs).toLocaleString('de-DE')})`,
                      draft.runtimeConfigText || undefined
                    )
                  }
                  className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-950 hover:bg-sky-500/25 dark:text-sky-100"
                >
                  Draft wiederherstellen
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    try {
                      window.localStorage.removeItem(HANDOFF_IMPORT_DRAFT_KEY)
                    } catch {
                      // ignore
                    }
                    setDraft(null)
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  Draft verwerfen
                </button>
              </div>
            </div>
          ) : null}

          {pendingEncrypted ? (
            <div className="rounded-lg border border-amber-600/40 bg-amber-950/25 px-3 py-3 space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Lock className="h-4 w-4 text-amber-400" aria-hidden />
                Passwortgeschützter Handoff
              </p>
              <label className="block text-xs text-muted-foreground">Handoff-Passwort (vom Boss)</label>
              <input
                type="password"
                autoComplete="current-password"
                value={handoffPassword}
                onChange={(e) => setHandoffPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void onDecrypt()
                }}
                className="w-full max-w-sm rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void onDecrypt()}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600/90 disabled:opacity-50"
              >
                {busy ? 'Entschlüssele…' : 'Entschlüsseln & Vorschau'}
              </button>
            </div>
          ) : null}

          {errors.length > 0 ? (
            <ul className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}

          {summary ? (
            <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2 text-xs leading-relaxed">
              <p className="font-semibold text-foreground">Vorschau</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {summary.handoffLabel ? (
                  <li>
                    Bezeichnung: <strong className="text-foreground">{summary.handoffLabel}</strong>
                  </li>
                ) : null}
                {summary.role ? (
                  <li>
                    Rolle: <span className="font-mono">{summary.role}</span>
                    {summary.deploymentProfile ? ` · ${summary.deploymentProfile}` : ''}
                  </li>
                ) : null}
                {summary.transportProfile ? (
                  <li>
                    Transport: <span className="font-mono">{summary.transportProfile}</span>
                    {summary.simpleMode != null ? ` · Simple: ${summary.simpleMode}` : ''}
                    {summary.uiVariant ? ` · UI: ${summary.uiVariant}` : ''}
                  </li>
                ) : null}
                {summary.teamMailboxIds ? (
                  <li>Team-Mailboxes: {summary.teamMailboxIds.split(',').length} ID(s)</li>
                ) : null}
                {summary.mailboxId ? <li>Primäre Mailbox: {summary.mailboxId}</li> : null}
                {summary.partnerPreview ? <li>Partner: {summary.partnerPreview}</li> : null}
                <li className="pt-1 text-amber-900/90 dark:text-amber-100/90">{summary.pskHint}</li>
                <li className="text-[10px]">
                  {summary.keysToApply} von {summary.keysInFile} Keys werden übernommen
                  {summary.skippedKeys.length ? ` (${summary.skippedKeys.length} übersprungen)` : ''}.
                </li>
              </ul>
            </div>
          ) : null}

          {envText && !applied && errors.length === 0 && summary ? (
            <div className="flex flex-wrap items-center gap-2">
              {standaloneHandoffMode ? (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onApplyLocalOnly}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Handoff übernehmen — weiter mit Mnemonic
                  </button>
                  <p className="w-full text-xs text-muted-foreground">
                    Übernimmt Package, Mailbox, Fullnode und Direkt-Modus automatisch. Kein PC-Server nötig.
                  </p>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onApply()}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {busy ? 'Speichere…' : 'Import bestätigen'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onApplyLocalOnly}
                    className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Lokal vormerken (ohne Basis)
                  </button>
                </>
              )}
            </div>
          ) : null}

          {applied || localAppliedOnly ? (
            <div className="flex flex-wrap items-center gap-2">
              {helperSeedPending ? (
                <>
                  <button
                    type="button"
                    onClick={() => maybeRequestHelperSeedSetup()}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/45 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-foreground hover:bg-emerald-500/25"
                  >
                    <KeyRound className="h-4 w-4" aria-hidden />
                    Seed einrichten (QR scannen)
                  </button>
                  <p className="w-full text-sm font-medium text-emerald-800 dark:text-emerald-100">
                    Handoff übernommen — Seed-QR vom Boss scannen oder Mnemonic eingeben.
                  </p>
                </>
              ) : !standaloneHandoffMode ? (
                <>
                  <button
                    type="button"
                    disabled={reloading || hardRestartBusy}
                    onClick={onReloadPage}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/45 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-foreground hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${reloading ? 'animate-spin' : ''}`} aria-hidden />
                    Seite neu laden
                  </button>
                  <button
                    type="button"
                    disabled={reloading || hardRestartBusy}
                    onClick={() => void onHardRestart()}
                    className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {hardRestartBusy ? 'Warte auf Backend…' : 'Backend hart neu starten (nur wenn nötig)'}
                  </button>
                </>
              ) : (
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-100">
                  Handoff übernommen — Wallet ist eingerichtet.
                </p>
              )}
              <p className="w-full text-xs text-amber-900/90 dark:text-amber-100/90">
                {helperSeedPending
                  ? 'Boss-Wallet im gleichen Browser? Das ist ok — Helfer braucht den Seed-QR vom Boss, nicht die Boss-Sitzung.'
                  : standaloneHandoffMode
                    ? 'Kein Neustart nötig — Seed-QR vom Boss scannen oder Mnemonic eingeben.'
                    : 'Nach Handoff-Import App/Seite neu starten, damit Profil/Capabilities konsistent aktiv sind.'}
                {localAppliedOnly && !standaloneHandoffMode && !helperSeedPending
                  ? ' Lokaler Modus bleibt ein Fallback; fuer persistentes Anwenden bitte spaeter mit Basisverbindung "Import bestätigen".'
                  : ''}
              </p>
            </div>
          ) : null}

          {statusMsg ? (
            <p className="text-sm text-muted-foreground" role="status">
              {statusMsg}
            </p>
          ) : null}

          {stage === 'idle' && !envText && !applied && !readLocalHandoffAppliedSnapshot()?.bossAddress && !embedded ? (
            <HelperJoinRequestForm />
          ) : null}
        </div>
      </div>
    </div>
  )
}
