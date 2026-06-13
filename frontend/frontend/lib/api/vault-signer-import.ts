import { executeCommand } from '@/frontend/lib/api/execute-command'

/** Nur SIGNER=sdk + lokale Vault mit gespeichertem Import. Passwort = Vault-Passwort (erneute Eingabe). */
export async function revealVaultSignerImport(password: string): Promise<{
  ok: boolean
  signerImport?: string
  message?: string
  error?: string
}> {
  const pw = password.trim()
  if (!pw) return { ok: false, error: 'Vault-Passwort fehlt.' }
  const r = await executeCommand<{ signerImport?: string }>('/vault-show-signer-import', [pw])
  const raw = r as { ok?: boolean; signerImport?: string; message?: string; error?: string }
  return {
    ok: raw.ok === true,
    signerImport: typeof raw.signerImport === 'string' ? raw.signerImport : undefined,
    message: typeof raw.message === 'string' ? raw.message : undefined,
    error: raw.error ?? (raw.ok === false && typeof raw.message === 'string' ? raw.message : undefined),
  }
}
