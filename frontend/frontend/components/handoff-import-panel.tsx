'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  HANDOFF_IMPORT_DRAFT_KEY,
  hasLocalHandoffPendingServerApply,
  readHandoffImportDraft,
} from '@/frontend/lib/handoff-pending-server-apply'
import { FileUp, Lock, Package, RefreshCw } from 'lucide-react'
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
import { HANDOFF_DRAFT_TTL_MS } from '@/frontend/lib/offline-cache-ttl'
import { applyHandoffEnvToLocalDevice } from '@/frontend/lib/handoff-device-bootstrap'
import { clearLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { getApiBase } from '@/frontend/lib/api/api-base'
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/dashboard-basis-offline-hint'
import { notifyStandaloneHandoffApplied } from '@/frontend/lib/handoff-standalone-ready'
import { restartBackend } from '@/frontend/lib/api/backend-restart'
import { triggerHiddenFileInput } from '@/frontend/lib/trigger-hidden-file-input'
import { waitForBackend } from '@/frontend/lib/wait-for-backend'

type HandoffDraftSnapshot = {
  savedAtMs: number
  envText: string
  runtimeConfigText: string | null
}

export function HandoffImportPanel(p: { backendOnline?: boolean | null } = {}) {
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

  const applyExtractedEnv = useCallback(async (text: string, label: string, runtimeJson?: string) => {
    setStage('previewing')
    setEnvText(text)
    setRuntimeConfigText(runtimeJson?.trim() || null)
    persistDraft(text, runtimeJson)
    setFileLabel(label)
    const local = previewHandoffEnvImportLocal(text, null)
    if (!getApiBase().trim()) {
      setSummary(local.summary)
      setErrors(local.errors)
      if (local.ok) {
        setStatusMsg(
          'Standalone APK: preview OK — choose "Stage locally (no basis server)" below (not "Confirm import").'
        )
        setStage('ready')
      } else {
        setStatusMsg('Preview: fix errors or choose a different ZIP.')
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
        setStatusMsg('Preview: fix errors or choose a different ZIP.')
        setStage('idle')
      } else {
        if (remoteError) {
          setStatusMsg('Offline preview active (validated locally). Final apply requires a reachable basis server.')
        } else {
          setStatusMsg('')
        }
        setStage('ready')
      }
    } catch {
      setSummary(local.summary)
      setErrors(local.errors)
      setStatusMsg('Offline preview active (validated locally). Final apply requires a reachable basis server.')
      setStage(local.ok ? 'ready' : 'idle')
    }
  }, [persistDraft])

  const processZipBytes = useCallback(
    async (data: Uint8Array, label: string, password?: string) => {
      const extracted = await extractHandoffFromZipBytesAuto(data, password)
      if ('needsPassword' in extracted && extracted.needsPassword) {
        setEnvText(null)
        setPendingEncrypted(extracted.pending)
        setFileLabel(`${label} (password protected)`)
        setStatusMsg('This ZIP is encrypted — enter the handoff password from the boss.')
        return
      }
      if (!extracted.ok) {
        setErrors(['error' in extracted ? extracted.error : 'Could not read handoff.'])
        setEnvText(null)
        return
      }
      await applyExtractedEnv(
        extracted.envText,
        `${label} → ${extracted.envFileName}${extracted.encrypted ? ' (decrypted)' : ''}`,
        extracted.runtimeConfigText
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
        ? `Inbox: ${pending.meta.label}`
        : 'Inbox (boss handoff)'
      await processZipBytes(pending.zipBytes, label)
      setStatusMsg('Handoff loaded from inbox — if protected, enter password, then review preview.')
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
          'Draft (after reconnect)',
          storedDraft.runtimeConfigText ?? undefined
        )
      }
      setBasisApplyReady(true)
      setStatusMsg(
        'Basis server reachable again — run "Confirm import" so the profile is persisted on the server (not just staged locally).'
      )
    }
  }, [p.backendOnline, localAppliedOnly, envText, applyExtractedEnv])

  const onDecrypt = async () => {
    if (!pendingEncrypted) return
    if (!handoffPassword.trim()) {
      setErrors(['Enter the handoff password.'])
      return
    }
    setBusy(true)
    setErrors([])
    try {
      const extracted = await decryptHandoffPending(pendingEncrypted, handoffPassword)
      if (!extracted.ok) {
        setErrors(['error' in extracted ? extracted.error : 'Could not read handoff.'])
        return
      }
      setPendingEncrypted(null)
      setHandoffPassword('')
      await applyExtractedEnv(extracted.envText, `handoff.morg.enc → ${extracted.envFileName}`)
      setStatusMsg('Decrypted — review preview and confirm import.')
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
      setStatusMsg('Local staging failed — fix preview errors.')
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
    notifyStandaloneHandoffApplied()
    setStatusMsg(
      'Step 1 done — package, mailbox, and fullnode are saved. Next: "Set up seed?" (QR or entry).'
    )
  }, [envText])

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
        setStatusMsg(r.error || 'Import partially failed.')
        return
      }
      if (!r.ok) {
        setErrors([r.error || 'Import failed'])
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
      setStatusMsg(
        r.applied?.length
          ? `${r.applied.length} setting(s) saved — the basis server has already applied the values. Reload the page, then unlock the vault.`
          : 'Import OK — reload the page, then unlock the vault.'
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
    setStatusMsg('Restarting backend… please wait (may take up to 90 s).')
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
      'Backend is not responding yet. Check the terminal: npm run start:secrets — then reload the page manually.'
    )
    setHardRestartBusy(false)
  }

  return (
    <div className="rounded-xl border border-purple-500/30 bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-300">
          <Package className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          {basisApplyReady && p.backendOnline === true && envText && !applied ? (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-950 dark:text-emerald-100">
              <p className="font-medium">Basis server reachable — apply persistent profile</p>
              <p className="mt-1 text-xs opacity-90">
                Local staging is enough for offline hints. For the permanent server state, run{' '}
                <strong>Confirm import</strong> now (below).
              </p>
            </div>
          ) : null}

          <div>
            <h4 className="font-semibold text-foreground">Import handoff</h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a boss ZIP or use the <strong className="text-foreground">inbox</strong> (message menu) — plaintext
              or <span className="font-mono text-xs">handoff.morg.enc</span>.
              {standaloneHandoffMode ? (
                <>
                  {' '}
                  On the <strong className="text-foreground">standalone APK without a PC server</strong>: after preview,
                  choose <strong className="text-foreground">Stage locally (no basis server)</strong>, then reload the
                  page and set the mnemonic in the unlock dialog or Pulse.
                </>
              ) : (
                <>
                  {' '}
                  Then <strong className="text-foreground">reload the page</strong> and unlock the vault.
                </>
              )}
            </p>
          </div>

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
              {busy ? 'Reading ZIP…' : 'Choose handoff ZIP'}
            </button>
            {envText || pendingEncrypted ? (
              <button
                type="button"
                disabled={busy}
                onClick={reset}
                className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                Reset
              </button>
            ) : null}
          </div>

          {stage !== 'idle' ? (
            <p className="text-xs text-muted-foreground" role="status">
              {stage === 'reading'
                ? 'Progress: reading ZIP...'
                : stage === 'decrypting'
                  ? 'Progress: decrypting ZIP...'
                  : stage === 'previewing'
                    ? 'Progress: preview/validation...'
                    : stage === 'applying'
                      ? 'Progress: applying values...'
                      : stage === 'ready'
                        ? 'Preview ready.'
                        : 'Import complete. Restart the app/page.'}
            </p>
          ) : null}

          {fileLabel ? (
            <p className="text-xs text-muted-foreground">
              File: <span className="font-mono text-foreground">{fileLabel}</span>
            </p>
          ) : null}

          {draft && !envText ? (
            <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs text-sky-950 dark:text-sky-100">
              <p>
                Draft found ({new Date(draft.savedAtMs).toLocaleString('de-DE')}).
              </p>
              <p className="mt-1 text-[11px] text-sky-900/90 dark:text-sky-100/90">
                Note: the draft only helps with preview/validation. Final apply still goes through the basis API.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void applyExtractedEnv(
                      draft.envText,
                      `Local draft (${new Date(draft.savedAtMs).toLocaleString('de-DE')})`,
                      draft.runtimeConfigText || undefined
                    )
                  }
                  className="rounded-lg border border-sky-500/40 bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-950 hover:bg-sky-500/25 dark:text-sky-100"
                >
                  Restore draft
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
                  Discard draft
                </button>
              </div>
            </div>
          ) : null}

          {pendingEncrypted ? (
            <div className="rounded-lg border border-amber-600/40 bg-amber-950/25 px-3 py-3 space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Lock className="h-4 w-4 text-amber-400" aria-hidden />
                Password-protected handoff
              </p>
              <label className="block text-xs text-muted-foreground">Handoff password (from boss)</label>
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
                {busy ? 'Decrypting…' : 'Decrypt & preview'}
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
              <p className="font-semibold text-foreground">Preview</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {summary.handoffLabel ? (
                  <li>
                    Label: <strong className="text-foreground">{summary.handoffLabel}</strong>
                  </li>
                ) : null}
                {summary.role ? (
                  <li>
                    Role: <span className="font-mono">{summary.role}</span>
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
                {summary.mailboxId ? <li>Primary mailbox: {summary.mailboxId}</li> : null}
                {summary.partnerPreview ? <li>Partner: {summary.partnerPreview}</li> : null}
                <li className="pt-1 text-amber-900/90 dark:text-amber-100/90">{summary.pskHint}</li>
                <li className="text-[10px]">
                  {summary.keysToApply} of {summary.keysInFile} keys will be applied
                  {summary.skippedKeys.length ? ` (${summary.skippedKeys.length} skipped)` : ''}.
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
                    Apply handoff — continue with mnemonic
                  </button>
                  <p className="w-full text-xs text-muted-foreground">
                    Applies package, mailbox, fullnode, and direct mode automatically. No PC server required.
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
                    {busy ? 'Saving…' : 'Confirm import'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={onApplyLocalOnly}
                    className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    Stage locally (no basis server)
                  </button>
                </>
              )}
            </div>
          ) : null}

          {applied || localAppliedOnly ? (
            <div className="flex flex-wrap items-center gap-2">
              {!standaloneHandoffMode ? (
                <>
                  <button
                    type="button"
                    disabled={reloading || hardRestartBusy}
                    onClick={onReloadPage}
                    className="inline-flex items-center gap-2 rounded-lg border border-emerald-600/45 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-foreground hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${reloading ? 'animate-spin' : ''}`} aria-hidden />
                    Reload page
                  </button>
                  <button
                    type="button"
                    disabled={reloading || hardRestartBusy}
                    onClick={() => void onHardRestart()}
                    className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                  >
                    {hardRestartBusy ? 'Waiting for backend…' : 'Hard restart backend (only if needed)'}
                  </button>
                </>
              ) : (
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-100">
                  Handoff applied — &quot;Set up seed?&quot; will appear next (scan QR).
                </p>
              )}
              <p className="w-full text-xs text-amber-900/90 dark:text-amber-100/90">
                {standaloneHandoffMode
                  ? 'No restart needed — scan the boss seed QR or enter the mnemonic.'
                  : 'After handoff import, restart the app/page so profile/capabilities are active consistently.'}
                {localAppliedOnly && !standaloneHandoffMode
                  ? ' Local mode remains a fallback; for persistent apply, later run "Confirm import" when connected to the basis server.'
                  : ''}
              </p>
            </div>
          ) : null}

          {statusMsg ? (
            <p className="text-sm text-muted-foreground" role="status">
              {statusMsg}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
