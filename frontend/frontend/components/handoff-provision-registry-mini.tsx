'use client'

import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { useHandoffProvisionRegistryAccess } from '@/frontend/lib/handoff-provision-registry-access'

type RegistryAccess = ReturnType<typeof useHandoffProvisionRegistryAccess>

/** Kompakte Registry-Entsperrung für Schnell-Assistent (H3). */
export function HandoffProvisionRegistryMini(p: {
  registry: RegistryAccess
  onUnlocked?: () => void
}) {
  const { registry, onUnlocked } = p
  const {
    registryExists,
    registryUnlocked,
    masterPassword,
    setMasterPassword,
    masterPasswordConfirm,
    setMasterPasswordConfirm,
    unlockPassword,
    setUnlockPassword,
    unlockRegistry,
    initRegistry,
  } = registry

  const [busy, setBusy] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const onInit = async () => {
    setStatusMsg('')
    setBusy(true)
    const r = await initRegistry()
    setBusy(false)
    if (!r.ok) {
      setStatusMsg(r.error)
      return
    }
    setStatusMsg('Registry angelegt und entsperrt.')
    onUnlocked?.()
  }

  const onUnlock = async () => {
    setStatusMsg('')
    setBusy(true)
    const r = await unlockRegistry()
    setBusy(false)
    if (!r.ok) {
      setStatusMsg(r.error)
      return
    }
    setStatusMsg('Registry entsperrt.')
    onUnlocked?.()
  }

  if (registryUnlocked) {
    return (
      <p className="text-sm text-emerald-600 dark:text-emerald-400" role="status">
        Provision-Registry entsperrt — du kannst ZIP + Seed + QR erstellen.
      </p>
    )
  }

  if (!registryExists) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="h-4 w-4" aria-hidden />
          Registry anlegen (einmalig)
        </p>
        <p className="text-xs text-muted-foreground">
          Verschlüsselt Seed-Historie in diesem Browser. Master-Passwort sicher aufbewahren.
        </p>
        <Input
          type="password"
          value={masterPassword}
          onChange={(e) => setMasterPassword(e.target.value)}
          placeholder="Master-Passwort (8+ Zeichen)"
          autoComplete="new-password"
        />
        <Input
          type="password"
          value={masterPasswordConfirm}
          onChange={(e) => setMasterPasswordConfirm(e.target.value)}
          placeholder="Wiederholen"
          autoComplete="new-password"
        />
        <Button type="button" size="sm" disabled={busy} onClick={() => void onInit()}>
          {busy ? '…' : 'Anlegen & entsperren'}
        </Button>
        {statusMsg ? <p className="text-xs text-destructive">{statusMsg}</p> : null}
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-500/35 bg-amber-500/10 p-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <KeyRound className="h-4 w-4" aria-hidden />
        Registry entsperren
      </p>
      <Input
        type="password"
        value={unlockPassword}
        onChange={(e) => setUnlockPassword(e.target.value)}
        placeholder="Master-Passwort"
        autoComplete="current-password"
      />
      <Button type="button" size="sm" disabled={busy} onClick={() => void onUnlock()}>
        {busy ? '…' : 'Entsperren'}
      </Button>
      {statusMsg ? <p className="text-xs text-destructive">{statusMsg}</p> : null}
    </div>
  )
}
