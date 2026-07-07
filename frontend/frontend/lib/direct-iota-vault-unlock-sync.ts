'use client'

/**
 * Nach Tresor-Entsperren: Session-Signer + Chat-ECDH für Direct-RPC im Browser.
 */
import { revealVaultSignerImport } from '@/frontend/lib/api/vault-signer-import'
import { fetchSessionEcdhPrivateJwk, revealVaultEcdhPrivateJwk } from '@/frontend/lib/api/vault-ecdh-jwk'
import {
  applyDirectChatEcdhVaultMaterial,
  getDirectChatEcdhPrivateKey,
  restoreDirectChatEcdhPrivateFromLocalStorage,
} from '@/frontend/lib/direct-chat-ecdh-session'
import { syncActiveNetworkChainSnapshot } from '@/frontend/lib/active-network-chain-sync'
import { notifyDirectIotaUiChanged } from '@/frontend/lib/direct-iota-ui-events'
import {
  applyDirectIotaMnemonicSession,
  clearDirectIotaSessionSigner,
  clearDirectIotaSessionSignerTabSession,
  getDirectIotaSessionSigner,
  getDirectIotaSessionSignerAddress,
  hasPersistedDirectIotaSessionSigner,
  persistDirectIotaSessionSignerEncrypted,
  restoreDirectIotaSessionSignerFromEncryptedStorage,
  restoreDirectIotaSessionSignerFromTabSession,
  restoreDirectIotaSessionSignerFromTabSessionAsync,
} from '@/frontend/lib/direct-iota-mnemonic-session'
import { readNetworkProfilesState, validateNetworkProfile } from '@/frontend/lib/einsatz-network-profiles'
import { directIotaSignerMatchesIdentity } from '@/frontend/lib/direct-iota-signer-identity'
import { sessionSignerMatchesServerIdentity } from '@/frontend/lib/wallet-identity-reconcile'

const MISSING_MY_ADDRESS =
  'MY_ADDRESS unbekannt — Status aktualisieren und Tresor erneut entsperren.'

function requireExpectedAddress(expected: string | null | undefined):
  | { ok: true; address: string }
  | { ok: false; error: string } {
  const t = expected?.trim()
  if (!t) return { ok: false, error: MISSING_MY_ADDRESS }
  return { ok: true, address: t }
}

function finalizeSignerSession<S extends 'import' | 'vault' | 'persisted'>(
  address: string,
  source: S
): { ok: true; address: string; source: S } {
  syncActiveNetworkChainSnapshot(address)
  notifyDirectIotaUiChanged()
  return { ok: true, address, source }
}

async function tryImportSignerPath(opts: {
  importRaw: string
  expected: string | null | undefined
  vaultPassword: string
  persistEncrypted: boolean
}): Promise<
  | { ok: true; address: string; source: 'import' }
  | { ok: false; error: string }
  | { ok: false; skip: true }
> {
  const importRaw = opts.importRaw.trim()
  if (!importRaw) return { ok: false, skip: true }
  const expectedCheck = requireExpectedAddress(opts.expected)
  if (!expectedCheck.ok) return expectedCheck
  const applied = applyDirectIotaMnemonicSession(importRaw)
  if (!applied.ok) return applied
  if (!directIotaSignerMatchesIdentity(applied.address, expectedCheck.address)) {
    clearDirectIotaSessionSigner()
    return { ok: false, error: 'Signer passt nicht zu MY_ADDRESS — Vault/Mnemonic prüfen.' }
  }
  if (opts.persistEncrypted && opts.vaultPassword.length >= 8) {
    await persistDirectIotaSessionSignerEncrypted({
      signerImportRaw: importRaw,
      password: opts.vaultPassword,
    })
  }
  return finalizeSignerSession(applied.address, 'import')
}

async function tryPersistedSignerPath(opts: {
  vaultPassword: string
  expected: string | null | undefined
}): Promise<
  | { ok: true; address: string; source: 'persisted' }
  | { ok: false; error: string }
  | { ok: false; skip: true }
> {
  if (!hasPersistedDirectIotaSessionSigner() || opts.vaultPassword.length < 8) {
    return { ok: false, skip: true }
  }
  const expectedCheck = requireExpectedAddress(opts.expected)
  if (!expectedCheck.ok) return expectedCheck
  const restored = await restoreDirectIotaSessionSignerFromEncryptedStorage({
    password: opts.vaultPassword,
  })
  if (!restored.ok) return { ok: false, skip: true }
  if (!directIotaSignerMatchesIdentity(restored.address, expectedCheck.address)) {
    clearDirectIotaSessionSigner()
    return { ok: false, error: 'Gespeicherter Signer passt nicht zu MY_ADDRESS — Vault prüfen.' }
  }
  return finalizeSignerSession(restored.address, 'persisted')
}

async function tryVaultRevealSignerPath(opts: {
  vaultPassword: string
  signerMode: string
  expected: string | null | undefined
  persistEncrypted: boolean
}): Promise<
  | { ok: true; address: string; source: 'vault' }
  | { ok: false; error: string }
> {
  const mode = opts.signerMode.trim().toLowerCase()
  if (mode !== 'sdk') {
    return { ok: false, error: 'SIGNER ist nicht sdk — Session-Signer unter Einstellungen setzen.' }
  }
  if (!opts.vaultPassword) {
    return { ok: false, error: 'Vault-Passwort fehlt für Session-Signer.' }
  }
  const expectedCheck = requireExpectedAddress(opts.expected)
  if (!expectedCheck.ok) return expectedCheck
  const r = await revealVaultSignerImport(opts.vaultPassword)
  if (!r.ok || !r.signerImport?.trim()) {
    return { ok: false, error: r.error || r.message || 'Signer aus Vault nicht lesbar.' }
  }
  const applied = applyDirectIotaMnemonicSession(r.signerImport)
  if (!applied.ok) return applied
  if (!directIotaSignerMatchesIdentity(applied.address, expectedCheck.address)) {
    clearDirectIotaSessionSigner()
    return { ok: false, error: 'Vault-Signer passt nicht zu MY_ADDRESS — Adresse prüfen.' }
  }
  if (opts.persistEncrypted && opts.vaultPassword.length >= 8) {
    await persistDirectIotaSessionSignerEncrypted({
      signerImportRaw: r.signerImport,
      password: opts.vaultPassword,
    })
  }
  return finalizeSignerSession(applied.address, 'vault')
}

function rejectSignerIfIdentityMismatch(
  signerAddress: string,
  expectedMyAddress?: string | null
): boolean {
  if (!sessionSignerMatchesServerIdentity(signerAddress, expectedMyAddress)) {
    clearDirectIotaSessionSigner()
    clearDirectIotaSessionSignerTabSession()
    return true
  }
  return false
}

/** Tab-Reload oder fehlender RAM-Signer — ohne Vault-Passwort (sync: Legacy-Tab). */
export function tryAutoRestoreDirectIotaSessionSigner(
  expectedMyAddress?: string | null
): { ok: true; address: string; source: 'session' | 'tab' } | { ok: false } {
  const existing = getDirectIotaSessionSignerAddress()
  if (existing && getDirectIotaSessionSigner()) {
    if (rejectSignerIfIdentityMismatch(existing, expectedMyAddress)) return { ok: false }
    return { ok: true, address: existing, source: 'session' }
  }
  const tab = restoreDirectIotaSessionSignerFromTabSession()
  if (tab.ok) {
    if (rejectSignerIfIdentityMismatch(tab.address, expectedMyAddress)) return { ok: false }
    syncActiveNetworkChainSnapshot(tab.address)
    notifyDirectIotaUiChanged()
    return { ok: true, address: tab.address, source: 'tab' }
  }
  return { ok: false }
}

/** Inkl. verschlüsselter Tab-Session (nach Reload). */
export async function tryAutoRestoreDirectIotaSessionSignerAsync(
  expectedMyAddress?: string | null
): Promise<{ ok: true; address: string; source: 'session' | 'tab' } | { ok: false }> {
  const existing = getDirectIotaSessionSignerAddress()
  if (existing && getDirectIotaSessionSigner()) {
    if (rejectSignerIfIdentityMismatch(existing, expectedMyAddress)) return { ok: false }
    return { ok: true, address: existing, source: 'session' }
  }
  const tab = await restoreDirectIotaSessionSignerFromTabSessionAsync()
  if (tab.ok) {
    if (rejectSignerIfIdentityMismatch(tab.address, expectedMyAddress)) return { ok: false }
    syncActiveNetworkChainSnapshot(tab.address)
    notifyDirectIotaUiChanged()
    return { ok: true, address: tab.address, source: 'tab' }
  }
  return { ok: false }
}

export function shouldAutoRestoreSessionSignerForMainnet(): boolean {
  const state = readNetworkProfilesState()
  return state.active === 'mainnet' && validateNetworkProfile(state.mainnet).ok
}

export async function syncDirectIotaSessionSignerAfterVaultUnlock(opts: {
  vaultPassword: string
  signerMode?: string | null
  expectedAddress?: string | null
  signerImport?: string | null
  persistEncrypted?: boolean
}): Promise<
  | { ok: true; address: string; source: 'session' | 'import' | 'vault' | 'persisted' }
  | { ok: false; error: string }
> {
  const existing = getDirectIotaSessionSignerAddress()
  if (existing && getDirectIotaSessionSigner()) {
    syncActiveNetworkChainSnapshot(existing)
    return { ok: true, address: existing, source: 'session' }
  }

  const pw = opts.vaultPassword.trim()
  const persist = opts.persistEncrypted !== false

  const imported = await tryImportSignerPath({
    importRaw: opts.signerImport ?? '',
    expected: opts.expectedAddress,
    vaultPassword: pw,
    persistEncrypted: persist,
  })
  if (imported.ok) return imported
  if (!('skip' in imported)) return imported

  const persisted = await tryPersistedSignerPath({ vaultPassword: pw, expected: opts.expectedAddress })
  if (persisted.ok) return persisted
  if (!('skip' in persisted)) return persisted

  return tryVaultRevealSignerPath({
    vaultPassword: pw,
    signerMode: (opts.signerMode ?? 'sdk').trim(),
    expected: opts.expectedAddress,
    persistEncrypted: persist,
  })
}

async function applyVaultEcdhMaterialFromApi(res: {
  ecdhPrivateJwk?: string
  ecdhPrivatePkcs8Base64?: string
  ecdhPubRawBase64?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!res.ecdhPrivateJwk?.trim() && !res.ecdhPrivatePkcs8Base64?.trim()) {
    return { ok: false, error: 'Vault-Antwort ohne ECDH-Privatkey.' }
  }
  return applyDirectChatEcdhVaultMaterial(res)
}

async function restoreDirectChatEcdhPrivateKey(opts?: {
  vaultPassword?: string
  trySession?: boolean
}): Promise<{ ok: true } | { ok: false; error?: string }> {
  if (getDirectChatEcdhPrivateKey()) return { ok: true }
  const pw = opts?.vaultPassword?.trim()
  const ls = await restoreDirectChatEcdhPrivateFromLocalStorage()
  if (ls.ok) return { ok: true }

  if (opts?.trySession !== false && pw) {
    try {
      const session = await fetchSessionEcdhPrivateJwk()
      if (session.ok) {
        const applied = await applyVaultEcdhMaterialFromApi(session)
        if (applied.ok) return { ok: true }
      }
    } catch {
      /* Basis offline */
    }
  }

  if (pw) {
    try {
      const revealed = await revealVaultEcdhPrivateJwk(pw)
      if (revealed.ok) {
        const applied = await applyVaultEcdhMaterialFromApi(revealed)
        if (applied.ok) return { ok: true }
        return { ok: false, error: 'Chat-ECDH aus Vault nicht anwendbar.' }
      }
      return { ok: false, error: revealed.error || revealed.message || 'Chat-ECDH aus Vault nicht lesbar.' }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  return { ok: false }
}

export async function tryAutoRestoreDirectChatEcdhPrivateKey(): Promise<{ ok: true } | { ok: false }> {
  const r = await restoreDirectChatEcdhPrivateKey({ trySession: true })
  return r.ok ? { ok: true } : { ok: false }
}

export async function syncDirectChatEcdhAfterVaultUnlock(opts: {
  vaultPassword: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await restoreDirectChatEcdhPrivateKey({
    vaultPassword: opts.vaultPassword,
    trySession: true,
  })
  if (r.ok) return { ok: true }
  return { ok: false, error: r.error ?? 'Chat-ECDH aus Vault nicht geladen.' }
}
