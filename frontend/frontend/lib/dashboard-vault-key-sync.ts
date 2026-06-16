'use client'

import { fetchStatus } from '@/frontend/lib/api'
import { vaultLoad } from '@/frontend/lib/api/vault-commands'
import {
  syncDirectChatEcdhAfterVaultUnlock,
  syncDirectIotaSessionSignerAfterVaultUnlock,
} from '@/frontend/lib/direct-iota-vault-unlock-sync'
import { getIncludeSdkMnemonicInBackup } from '@/frontend/lib/vault-sdk-mnemonic-preference'

/** Nach Entsperren: Messaging-Keys in die API-Sitzung (hasKeys), falls /vault-load beim Unlock fehlte. */
export async function ensureBackendVaultKeysInSession(vaultPassword: string): Promise<boolean> {
  const pw = vaultPassword.trim()
  if (!pw) return false
  try {
    const snap = await fetchStatus()
    if (!('pollClockHint' in snap)) return false
    if (snap.locked || snap.hasKeys === true) return snap.hasKeys === true
    if (!snap.vaultStatus?.hasLocal) return false
    const r = await vaultLoad(pw)
    return r.ok === true
  } catch {
    return false
  }
}

export async function syncMainnetKeysAfterBackendUnlock(opts: {
  vaultPassword: string
  signerImport?: string
  expectedAddress?: string
  statusSigner?: string
  apiSigner?: string | null
}): Promise<{ mainnetSignerHint: string | null }> {
  let statusSigner = opts.statusSigner
  let statusAddr = opts.expectedAddress
  try {
    const snap = await fetchStatus()
    if ('pollClockHint' in snap) {
      statusSigner = snap.signer ?? statusSigner
      statusAddr = snap.myAddressFull?.trim() || snap.myAddress?.trim() || statusAddr
    }
  } catch {
    /* optional */
  }
  const signerSync = await syncDirectIotaSessionSignerAfterVaultUnlock({
    vaultPassword: opts.vaultPassword,
    signerMode: statusSigner ?? opts.apiSigner,
    signerImport: opts.signerImport,
    expectedAddress: statusAddr,
    persistEncrypted: getIncludeSdkMnemonicInBackup(),
  })
  const ecdhSync = await syncDirectChatEcdhAfterVaultUnlock({ vaultPassword: opts.vaultPassword })
  const sdkMode = statusSigner === 'sdk' || opts.apiSigner === 'sdk'
  if (!signerSync.ok && sdkMode) {
    return {
      mainnetSignerHint:
        signerSync.error.includes('Vault') || signerSync.error.includes('Signer')
          ? `${signerSync.error} — ggf. Tresor mit „Signer-Import mit speichern“ neu sichern.`
          : signerSync.error,
    }
  }
  if (!ecdhSync.ok) {
    return {
      mainnetSignerHint: `${ecdhSync.error} — verschlüsselter Direkt-Send erst nach erneutem Entsperren oder Hard Refresh.`,
    }
  }
  return { mainnetSignerHint: null }
}
