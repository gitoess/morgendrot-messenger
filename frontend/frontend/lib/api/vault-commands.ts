import { executeCommand } from '@/frontend/lib/api/execute-command'
import type { PersonalSecretEntry } from '@/frontend/lib/api/vault-personal-secrets'

// Vault commands (notes = eigene Texte/Notizen, werden mitverschlüsselt)
export type VaultSaveOptions = {
  /** SIGNER=sdk: gleiche Phrase wie beim Unlock — verschlüsselt in `.morgendrot-vault` (Server: `getSessionIotaMnemonic`). */
  includeIotaMnemonic?: boolean
}

export function vaultSave(password?: string, notes?: string, opts?: VaultSaveOptions) {
  const wantInclude = opts?.includeIotaMnemonic === true
  const pw = (password ?? '').trim()
  const n = notes ?? ''
  if (!pw && !n && !wantInclude) return executeCommand('/vault-save', [])
  const args: string[] = []
  args.push(pw || '')
  args.push(n)
  if (wantInclude) args.push('includeIotaMnemonic')
  return executeCommand('/vault-save', args)
}

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

export type VaultOnchainOptions = { includeIotaMnemonic?: boolean }

/** Tresor verschlüsselt auf der Chain speichern (VAULT_REGISTRY_ID). Nutzt update_vault wenn bereits vorhanden. */
export function vaultOnchain(password?: string, notes?: string, opts?: VaultOnchainOptions) {
  const wantInclude = opts?.includeIotaMnemonic === true
  const pw = (password ?? '').trim()
  const n = notes ?? ''
  if (!pw && !n && !wantInclude) return executeCommand('/vault-onchain', [])
  const args: string[] = []
  args.push(pw || '')
  args.push(n)
  if (wantInclude) args.push('includeIotaMnemonic')
  return executeCommand('/vault-onchain', args)
}

export const emergencyPurge = () => executeCommand('/emergency-purge', [])

/** RAM-Keys + Wallet-Passwort der Sitzung leeren; lokaler Inbox-Klartext-Cache (.inbox.enc) schreddern. */
export const vaultLockCommand = () => executeCommand('/vault-lock', [])
