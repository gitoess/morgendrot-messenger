'use client'

import { useCallback, useEffect, useState } from 'react'
import { Lock } from 'lucide-react'
import { toast } from 'sonner'
import { fetchStatus, vaultChangePassword } from '@/frontend/lib/api'
import { setVaultPasswordSession } from '@/frontend/lib/vault-password-session'
import {
  readVaultIdleLockMinutes,
  VAULT_IDLE_LOCK_MINUTE_OPTIONS,
  writeVaultIdleLockMinutes,
  type VaultIdleLockMinutes,
} from '@/frontend/lib/vault-idle-lock-pref'
import { UiPasswordInput } from '@/frontend/components/ui-password-input'

type SettingsVaultPasswordSectionProps = {
  vaultLocked?: boolean
}

/**
 * Passwort ändern + optionales Idle-Lock.
 * Voll sperren = Chat-Header „Abmelden“ (nicht hier — Doppel zu Soft-Pause-Badge).
 */
export function SettingsVaultPasswordSection({ vaultLocked = false }: SettingsVaultPasswordSectionProps) {
  const [changePwCurrent, setChangePwCurrent] = useState('')
  const [changePwNew, setChangePwNew] = useState('')
  const [changePwConfirm, setChangePwConfirm] = useState('')
  const [changePwBusy, setChangePwBusy] = useState(false)
  const [hasKeys, setHasKeys] = useState<boolean | undefined>(undefined)
  const [idleMinutes, setIdleMinutes] = useState<VaultIdleLockMinutes>(0)

  useEffect(() => {
    setIdleMinutes(readVaultIdleLockMinutes())
  }, [])

  const canUseVault = !vaultLocked && hasKeys === true

  const refreshVaultStatus = useCallback(async () => {
    try {
      const s = await fetchStatus()
      if ('pollClockHint' in s) {
        setHasKeys(s.hasKeys)
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

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Lock className="h-5 w-5 text-primary" />
        <h4 className="font-semibold text-foreground">Tresor-Passwort ändern</h4>
      </div>
      <label className="mb-4 flex max-w-md flex-col gap-1.5 text-[12px] text-muted-foreground">
        <span className="font-medium text-foreground">Auto-Sperren nach Abwesenheit (Idle)</span>
        <select
          className="rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground"
          value={idleMinutes}
          onChange={(e) => {
            const next = Number(e.target.value) as VaultIdleLockMinutes
            const allowed = (VAULT_IDLE_LOCK_MINUTE_OPTIONS as readonly number[]).includes(next)
              ? next
              : 0
            setIdleMinutes(allowed as VaultIdleLockMinutes)
            writeVaultIdleLockMinutes(allowed as VaultIdleLockMinutes)
            toast.message(
              allowed === 0
                ? 'Idle-Sperre aus — nur Abmelden / Soft-Pause / F5 / PWA-Hintergrund.'
                : `Idle-Sperre: nach ${allowed} Min. ohne Maus/Tastatur → voll sperren.`
            )
          }}
        >
          <option value={0}>Aus (empfohlen — nur Abmelden / Badge Soft-Pause)</option>
          <option value={5}>Nach 5 Minuten</option>
          <option value={15}>Nach 15 Minuten</option>
          <option value={30}>Nach 30 Minuten</option>
          <option value={60}>Nach 60 Minuten</option>
        </select>
        <span className="text-[11px] leading-snug">
          Default aus. Unabhängig davon: <strong className="font-medium text-foreground">F5</strong> = Browser-PW weg;
          installierte <strong className="font-medium text-foreground">PWA</strong> im Hintergrund ≈45 s → Hard-Lock.
          Soft-Pause (Badge) lässt Keys im RAM.
        </span>
      </label>
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
