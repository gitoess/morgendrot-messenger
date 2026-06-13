'use client'

import { fetchStatus } from '@/frontend/lib/api'
import {
  syncDirectChatEcdhAfterVaultUnlock,
  syncDirectIotaSessionSignerAfterVaultUnlock,
} from '@/frontend/lib/direct-iota-vault-unlock-sync'

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
