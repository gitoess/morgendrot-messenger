'use client'

import { useCallback, useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { fetchStatus, vaultChangePassword, vaultLockCommand } from '@/frontend/lib/api'

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
    const res = await vaultChangePassword(changePwCurrent.trim(), changePwNew.trim())
    if (res.ok) {
      toast.success(res.message || 'Passwort geändert.')
      setChangePwCurrent('')
      setChangePwNew('')
      setChangePwConfirm('')
    } else {
      toast.error(res.error || res.message || 'Passwort ändern fehlgeschlagen')
    }
    setChangePwBusy(false)
  }

  const handleVaultLock = async () => {
    const sdkHint =
      signerKind === 'sdk'
        ? '\n\nBei SIGNER=sdk: Seed/Mnemonic wurde aus dem RAM entfernt — beim Entsperren ggf. erneut eingeben.'
        : ''
    if (
      !window.confirm(
        'Tresor sperren?\n\n' +
          '• Messaging-Keys + Wallet-Passwort verlassen den Server-RAM\n' +
          '• Lokaler Klartext-Inbox-Cache (.inbox.enc) wird geschreddert\n' +
          '• Vault-Datei auf der Platte bleibt' +
          sdkHint
      )
    ) {
      return
    }
    setSessionBusy(true)
    const res = await vaultLockCommand()
    if (res.ok) {
      toast.message('Entsperr-Dialog — Vault-Passwort eingeben', { duration: 14_000 })
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
            disabled={!canUseVault}
            className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 disabled:opacity-50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Neues Passwort (min. 8 Zeichen)</span>
          <input
            type="password"
            autoComplete="new-password"
            value={changePwNew}
            onChange={(e) => setChangePwNew(e.target.value)}
            disabled={!canUseVault}
            className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 disabled:opacity-50"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Neues Passwort wiederholen</span>
          <input
            type="password"
            autoComplete="new-password"
            value={changePwConfirm}
            onChange={(e) => setChangePwConfirm(e.target.value)}
            disabled={!canUseVault}
            className="mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 disabled:opacity-50"
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
  )
}
