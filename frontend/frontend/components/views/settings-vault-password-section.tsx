'use client'

import { useCallback, useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { fetchStatus, vaultChangePassword, vaultLockCommand } from '@/frontend/lib/api'
import { wipeLocalPassphraseStoresOnLock } from '@/frontend/lib/privacy-lock-wipe'
import { setVaultPasswordSession } from '@/frontend/lib/vault-password-session'
import { UiPasswordInput } from '@/frontend/components/ui-password-input'

type SettingsVaultPasswordSectionProps = {
  vaultLocked?: boolean
}

export function SettingsVaultPasswordSection({ vaultLocked = false }: SettingsVaultPasswordSectionProps) {
  const [changePwCurrent, setChangePwCurrent] = useState('')
  const [changePwNew, setChangePwNew] = useState('')
  const [changePwConfirm, setChangePwConfirm] = useState('')
  const [changePwBusy, setChangePwBusy] = useState(false)
  const [sessionBusy, setSessionBusy] = useState(false)
  const [hasKeys, setHasKeys] = useState<boolean | undefined>(undefined)
  const [signerKind, setSignerKind] = useState<string | undefined>(undefined)

  const canUseVault = !vaultLocked && hasKeys === true

  const refreshVaultStatus = useCallback(async () => {
    try {
      const s = await fetchStatus()
      if ('pollClockHint' in s) {
        setHasKeys(s.hasKeys)
        setSignerKind(typeof s.signer === 'string' ? s.signer : undefined)
      }
    } catch {
      setHasKeys(undefined)
    }
  }, [])

  useEffect(() => {
    void refreshVaultStatus()
  }, [refreshVaultStatus])

  const handleChangePassword = async () => {
    if (!changePwCurrent.trim() || !changePwNew.trim()) {
      toast.error('Aktuelles und neues Passwort eingeben.')
      return
    }
    if (changePwNew !== changePwConfirm) {
      toast.error('Neues Passwort und Wiederholung stimmen nicht überein.')
      return
    }
    if (changePwNew.length < 8) {
      toast.error('Neues Passwort: mindestens 8 Zeichen.')
      return
    }
    setChangePwBusy(true)
    const newPw = changePwNew.trim()
    const res = await vaultChangePassword(changePwCurrent.trim(), newPw)
    if (res.ok) {
      setVaultPasswordSession(newPw)
      toast.success(res.message || 'Tresor-Passwort geändert. Beim nächsten Entsperren das neue Passwort nutzen.')
      setChangePwCurrent('')
      setChangePwNew('')
      setChangePwConfirm('')
    } else {
      toast.error(res.error || res.message || 'Passwort ändern fehlgeschlagen')
    }
    setChangePwBusy(false)
  }

  const handleVaultLock = async () => {
    if (
      !window.confirm(
        'Sitzung beenden / Tresor voll sperren?\n\n' +
          'Das ist nicht das weiche Badge-Sperren im Chat.\n\n' +
          '• Keys + Passwort verlassen den Server-RAM (wie Abmelden)\n' +
          '• Schnell-Cache entschlüsselter Nachrichten (.inbox.enc neben dem Tresor) wird gelöscht — damit Klartext nicht auf der Platte liegt, während alles gesperrt ist. Nachrichten bleiben on-chain und laden nach Entsperren wieder\n' +
          '• Tresor-Datei (.morgendrot-vault) bleibt unangetastet\n' +
          '• Browser-Geheimnisse nur sperren (Ciphertext bleibt), nicht löschen' +
          (signerKind === 'sdk'
            ? '\n• Seed: nur aus dem RAM weg; in der Datei bleibt er, wenn gespeichert'
            : '')
      )
    ) {
      return
    }
    setSessionBusy(true)
    const res = await vaultLockCommand()
    if (res.ok) {
      await wipeLocalPassphraseStoresOnLock()
      toast.message('Sitzung beendet — Tresor-Passwort zum Entsperren eingeben', { duration: 14_000 })
    } else {
      toast.error(res.error || res.message || 'Fehler')
    }
    await refreshVaultStatus()
    setSessionBusy(false)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-foreground">Tresor-Passwort ändern</h4>
        </div>
        <button
          type="button"
          disabled={sessionBusy}
          onClick={() => void handleVaultLock()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-600/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-500/25 disabled:opacity-50 dark:text-amber-200"
        >
          <Lock className="h-3.5 w-3.5" />
          Sitzung beenden
        </button>
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Sitzung beenden</strong> = volles Sperren wie Abmelden (Keys aus RAM,
        Inbox-Schnellcache weg). <strong className="text-foreground">Badge im Chat</strong> = nur weich (Chat bleibt
        offen, kein Cache-Löschen). Notfall-Löschung ist darunter separat.
      </p>
      {!canUseVault ? (
        <p className="mb-3 text-[12px] text-amber-800 dark:text-amber-200">
          {vaultLocked || hasKeys === false
            ? 'Tresor entsperren, dann Passwort ändern.'
            : 'Status wird geladen…'}
        </p>
      ) : null}
      <div className="grid max-w-md gap-3">
        <UiPasswordInput
          label="Aktuelles Passwort"
          value={changePwCurrent}
          onChange={setChangePwCurrent}
          disabled={!canUseVault}
          autoComplete="current-password"
          inputClassName="w-full rounded-lg border border-border bg-input px-3 py-2 disabled:opacity-50"
        />
        <UiPasswordInput
          label="Neues Passwort (min. 8 Zeichen)"
          value={changePwNew}
          onChange={setChangePwNew}
          disabled={!canUseVault}
          autoComplete="new-password"
          inputClassName="w-full rounded-lg border border-border bg-input px-3 py-2 disabled:opacity-50"
        />
        <UiPasswordInput
          label="Neues Passwort wiederholen"
          value={changePwConfirm}
          onChange={setChangePwConfirm}
          disabled={!canUseVault}
          autoComplete="new-password"
          inputClassName="w-full rounded-lg border border-border bg-input px-3 py-2 disabled:opacity-50"
        />
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
  )
}
