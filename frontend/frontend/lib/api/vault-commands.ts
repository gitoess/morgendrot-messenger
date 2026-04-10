import { executeCommand } from '@/frontend/lib/api/execute-command'
import type { PersonalSecretEntry } from '@/frontend/lib/api/vault-personal-secrets'

// Vault commands (notes = eigene Texte/Notizen, werden mitverschlüsselt)
export const vaultSave = (password?: string, notes?: string) =>
  executeCommand('/vault-save', password ? [password, notes ?? ''] : [])

/** Antwort flach wie vom Backend (nicht unter `data`). */
export async function vaultLoad(password?: string): Promise<{
  ok: boolean
  message?: string
  notes?: string
  personalSecrets?: PersonalSecretEntry[]
  error?: string
}> {
  const r = await executeCommand('/vault-load', password ? [password] : [])
  return r as {
    ok: boolean
    message?: string
    notes?: string
    personalSecrets?: PersonalSecretEntry[]
    error?: string
  }
}

/** Lokale Vault-Dateien im Arbeitsverzeichnis (Server) – kein Vault-Passwort nötig. */
export async function vaultListLocalFiles(): Promise<{
  ok: boolean
  paths?: string[]
  defaultPath?: string
  message?: string
  error?: string
}> {
  const r = await executeCommand('/vault-list', [])
  return r as {
    ok: boolean
    paths?: string[]
    defaultPath?: string
    message?: string
    error?: string
  }
}

/** Vault aus VAULT_REGISTRY_ID laden (RPC + PACKAGE_ID nötig). */
export async function vaultLoadFromChain(password?: string): Promise<{
  ok: boolean
  message?: string
  notes?: string
  personalSecrets?: PersonalSecretEntry[]
  error?: string
}> {
  const r = await executeCommand('/vault-load-from-chain', password ? [password] : [])
  return r as {
    ok: boolean
    message?: string
    notes?: string
    personalSecrets?: PersonalSecretEntry[]
    error?: string
  }
}

/** Tresor verschlüsselt auf der Chain speichern (VAULT_REGISTRY_ID). Nutzt update_vault wenn bereits vorhanden. */
export const vaultOnchain = (password?: string, notes?: string) =>
  executeCommand('/vault-onchain', password ? [password, notes ?? ''] : [])

export const emergencyPurge = () => executeCommand('/emergency-purge', [])

/** RAM-Keys + Wallet-Passwort der Sitzung leeren; lokaler Inbox-Klartext-Cache (.inbox.enc) schreddern. */
export const vaultLockCommand = () => executeCommand('/vault-lock', [])
