import { executeCommand } from '@/frontend/lib/api/execute-command'

type VaultEcdhJwkResponse = {
  ok?: boolean
  ecdhPrivateJwk?: string
  ecdhPrivatePkcs8Base64?: string
  ecdhPubRawBase64?: string
  message?: string
  error?: string
}

function parseVaultEcdhJwkResponse(r: VaultEcdhJwkResponse): {
  ok: boolean
  ecdhPrivateJwk?: string
  ecdhPrivatePkcs8Base64?: string
  ecdhPubRawBase64?: string
  message?: string
  error?: string
} {
  return {
    ok: r.ok === true,
    ecdhPrivateJwk: typeof r.ecdhPrivateJwk === 'string' ? r.ecdhPrivateJwk : undefined,
    ecdhPrivatePkcs8Base64: typeof r.ecdhPrivatePkcs8Base64 === 'string' ? r.ecdhPrivatePkcs8Base64 : undefined,
    ecdhPubRawBase64: typeof r.ecdhPubRawBase64 === 'string' ? r.ecdhPubRawBase64 : undefined,
    message: typeof r.message === 'string' ? r.message : undefined,
    error: r.error ?? (r.ok === false && typeof r.message === 'string' ? r.message : undefined),
  }
}

/** Entsperrte Boss-Sitzung: P-256-ECDH aus Vault (JWK oder PKCS#8 + Own-Pub) — Re-Auth mit Passwort. */
export async function fetchSessionEcdhPrivateJwk(vaultPassword: string): Promise<{
  ok: boolean
  ecdhPrivateJwk?: string
  ecdhPrivatePkcs8Base64?: string
  ecdhPubRawBase64?: string
  message?: string
  error?: string
}> {
  const pw = vaultPassword.trim()
  if (!pw) return { ok: false, error: 'Vault-Passwort fehlt für ECDH-Export.' }
  const r = await executeCommand<VaultEcdhJwkResponse>('/vault-ecdh-jwk', [pw])
  return parseVaultEcdhJwkResponse(r as VaultEcdhJwkResponse)
}

/** Lokale `.morgendrot-vault` mit Passwort — wie `/vault-show-signer-import`. */
export async function revealVaultEcdhPrivateJwk(password: string): Promise<{
  ok: boolean
  ecdhPrivateJwk?: string
  ecdhPrivatePkcs8Base64?: string
  ecdhPubRawBase64?: string
  message?: string
  error?: string
}> {
  const pw = password.trim()
  if (!pw) return { ok: false, error: 'Vault-Passwort fehlt.' }
  const r = await executeCommand<VaultEcdhJwkResponse>('/vault-show-ecdh-jwk', [pw])
  return parseVaultEcdhJwkResponse(r as VaultEcdhJwkResponse)
}
