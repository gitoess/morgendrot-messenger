'use client'

import { useCallback, useRef, useState } from 'react'
import {
  hasBossProvisionRegistry,
  initializeBossProvisionRegistry,
  isBossProvisionRegistryUnlocked,
  unlockBossProvisionRegistry,
} from '@/frontend/lib/boss-provision-registry'

export function useHandoffProvisionRegistryAccess() {
  const [registryReady, setRegistryReady] = useState(() => isBossProvisionRegistryUnlocked())
  const [masterPassword, setMasterPassword] = useState('')
  const [masterPasswordConfirm, setMasterPasswordConfirm] = useState('')
  const [unlockPassword, setUnlockPassword] = useState('')
  const sessionMasterPassword = useRef('')

  const registryExists = hasBossProvisionRegistry()
  const registryUnlocked = registryReady

  const rememberMasterPassword = useCallback((password: string) => {
    sessionMasterPassword.current = password
  }, [])

  const activeMasterPassword = useCallback(
    (): string => sessionMasterPassword.current || unlockPassword.trim() || masterPassword.trim(),
    [unlockPassword, masterPassword]
  )

  const ensureRegistryAccess = useCallback(async (): Promise<boolean> => {
    if (registryUnlocked) return true
    if (!registryExists) {
      if (masterPassword.length < 8) return false
      if (masterPassword !== masterPasswordConfirm) return false
      const init = await initializeBossProvisionRegistry(masterPassword, masterPasswordConfirm)
      if (!init.ok) return false
      rememberMasterPassword(masterPassword)
      setRegistryReady(true)
      return true
    }
    if (!unlockPassword.trim()) return false
    const unlock = await unlockBossProvisionRegistry(unlockPassword)
    if (!unlock.ok) return false
    rememberMasterPassword(unlockPassword)
    setRegistryReady(true)
    setUnlockPassword('')
    return true
  }, [
    registryUnlocked,
    registryExists,
    masterPassword,
    masterPasswordConfirm,
    unlockPassword,
    rememberMasterPassword,
  ])

  const unlockRegistry = useCallback(async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!unlockPassword.trim()) {
      return { ok: false, error: 'Master-Passwort eingeben.' }
    }
    const unlock = await unlockBossProvisionRegistry(unlockPassword)
    if (!unlock.ok) return unlock
    rememberMasterPassword(unlockPassword)
    setRegistryReady(true)
    setUnlockPassword('')
    return { ok: true }
  }, [unlockPassword, rememberMasterPassword])

  const initRegistry = useCallback(async (): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (masterPassword.length < 8) {
      return { ok: false, error: 'Master-Passwort für die Boss-Registry: mindestens 8 Zeichen.' }
    }
    if (masterPassword !== masterPasswordConfirm) {
      return { ok: false, error: 'Master-Passwort und Wiederholung stimmen nicht überein.' }
    }
    const init = await initializeBossProvisionRegistry(masterPassword, masterPasswordConfirm)
    if (!init.ok) return init
    rememberMasterPassword(masterPassword)
    setRegistryReady(true)
    return { ok: true }
  }, [masterPassword, masterPasswordConfirm, rememberMasterPassword])

  const registryAccessError = useCallback((): string | null => {
    if (registryUnlocked) return null
    if (!registryExists) {
      if (masterPassword.length < 8) {
        return 'Master-Passwort für die Boss-Registry: mindestens 8 Zeichen.'
      }
      if (masterPassword !== masterPasswordConfirm) {
        return 'Master-Passwort und Wiederholung stimmen nicht überein.'
      }
      return null
    }
    if (!unlockPassword.trim()) {
      return 'Registry ist gesperrt — Master-Passwort zum Entsperren eingeben.'
    }
    return null
  }, [registryUnlocked, registryExists, masterPassword, masterPasswordConfirm, unlockPassword])

  return {
    registryExists,
    registryUnlocked,
    registryReady,
    setRegistryReady,
    masterPassword,
    setMasterPassword,
    masterPasswordConfirm,
    setMasterPasswordConfirm,
    unlockPassword,
    setUnlockPassword,
    activeMasterPassword,
    rememberMasterPassword,
    ensureRegistryAccess,
    unlockRegistry,
    initRegistry,
    registryAccessError,
    sessionMasterPassword,
  }
}
