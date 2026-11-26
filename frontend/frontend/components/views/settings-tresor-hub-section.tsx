'use client'

/**
 * Tresor-Hub: Inhalt + Seed. Netz-IDs → IOTA. Sitzung → Chat-Header (Badge / Abmelden).
 */
import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, KeyRound, Lock } from 'lucide-react'
import { UiPasswordInput } from '@/frontend/components/ui-password-input'
import { ChatViewNotesTabPanel } from '@/frontend/components/chat-view-notes-tab-panel'
import { revealVaultSignerImport } from '@/frontend/lib/api'
import {
  hasPersistedDirectIotaSessionSigner,
  revealDirectIotaSessionSignerFromEncryptedStorage,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/standalone-device-mode'

type Props = {
  vaultLocked?: boolean
  onRequestVaultUnlock?: () => void
  /** Boss-API: lokale Vault-Datei vorhanden */
  vaultHasLocal?: boolean
  backendOnline?: boolean
  /** Nach Seed-Reveal Status neu laden */
  onAfterReveal?: () => void
}

export function SettingsTresorHubSection({
  vaultLocked = false,
  onRequestVaultUnlock,
  vaultHasLocal = false,
  backendOnline = false,
  onAfterReveal,
}: Props) {
  const standalone = isStandaloneMessengerWithoutBasis()
  const [recoveryPw, setRecoveryPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [revealed, setRevealed] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showSafe, setShowSafe] = useState(false)
  const [hasLocalSignerEnc, setHasLocalSignerEnc] = useState(false)

  const refreshLocal = useCallback(() => {
    setHasLocalSignerEnc(hasPersistedDirectIotaSessionSigner())
  }, [])

  useEffect(() => {
    refreshLocal()
  }, [refreshLocal])

  const canRevealApi = backendOnline && vaultHasLocal
  const canRevealStandalone = hasLocalSignerEnc
  const canReveal = canRevealApi || canRevealStandalone

  const onReveal = async () => {
    setErr('')
    setRevealed(null)
    const pw = recoveryPw.trim()
    if (pw.length < 8) {
      setErr('Tresor-Passwort eingeben (mindestens 8 Zeichen).')
      return
    }
    setBusy(true)
    try {
      if (canRevealApi) {
        const res = await revealVaultSignerImport(pw)
        if (res.ok && res.signerImport) {
          setRevealed(res.signerImport)
          setRecoveryPw('')
          onAfterReveal?.()
          return
        }
        if (!canRevealStandalone) {
          setErr(res.error || res.message || 'Anzeige fehlgeschlagen.')
          return
        }
      }
      if (canRevealStandalone) {
        const r = await revealDirectIotaSessionSignerFromEncryptedStorage({ password: pw })
        if (!r.ok) {
          setErr(r.error)
          return
        }
        setRevealed(r.signerImportRaw)
        setRecoveryPw('')
        onAfterReveal?.()
        return
      }
      setErr('Kein gespeicherter Seed/Signer zum Anzeigen.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" aria-hidden />
          <h3 className="text-base font-semibold text-foreground">Tresor — ein Passwort</h3>
        </div>
        {vaultLocked ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-amber-800 dark:text-amber-200">Gesperrt — Inhalt und Seed erst nach Unlock.</p>
            {onRequestVaultUnlock ? (
              <button
                type="button"
                onClick={onRequestVaultUnlock}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                Entsperren
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4 className="font-semibold text-foreground">Inhalt: Notizen &amp; Passwörter</h4>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Derselbe Safe wie Nachrichten → Notizen.
              {standalone
                ? ' Solo ohne Node: Speichern braucht entsperrte Vault-API.'
                : null}
            </p>
          </div>
          <button
            type="button"
            disabled={vaultLocked}
            onClick={() => setShowSafe((v) => !v)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
          >
            {showSafe ? 'Inhalt einklappen' : 'Inhalt öffnen'}
          </button>
        </div>
        {showSafe && !vaultLocked ? <ChatViewNotesTabPanel /> : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <KeyRound className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <h4 className="font-semibold text-foreground">Seed / Signer anzeigen</h4>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Nur mit Tresor-Passwort. Niemals teilen.
              {!canReveal ? ' Noch kein gespeicherter Seed.' : null}
            </p>
          </div>
        </div>
        <div className="max-w-md">
          <UiPasswordInput
            label="Tresor-Passwort"
            value={recoveryPw}
            onChange={setRecoveryPw}
            autoComplete="off"
            inputClassName="w-full rounded-lg border border-border bg-input px-3 py-2"
          />
        </div>
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        <button
          type="button"
          disabled={busy || !canReveal}
          onClick={() => void onReveal()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? 'Lade…' : 'Seed / Signer anzeigen'}
        </button>
        {revealed ? (
          <div className="space-y-2">
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded border border-border bg-muted/50 p-3 font-mono text-xs">
              {revealed}
            </pre>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(revealed)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Kopieren
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
