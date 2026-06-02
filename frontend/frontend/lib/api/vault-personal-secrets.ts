import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseOkEnvelopePassthrough } from '@/frontend/lib/api-simple-ok-envelope'
import { API_BASE } from '@/frontend/lib/api/api-base'

/** Strukturierte Geheimnisse im Vault-Payload (AES-GCM wie Messaging-Keys). */
export type PersonalSecretEntry = {
  id: string
  title: string
  username?: string
  secret?: string
  note?: string
  updatedAt?: number
}

export async function fetchVaultPersonalSecrets(): Promise<{
  ok: boolean
  unlocked?: boolean
  entries?: PersonalSecretEntry[]
  error?: string
}> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/vault-personal-secrets')
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Safe-API nicht lesbar.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    return {
      ok: true,
      unlocked: b.unlocked === true,
      entries: Array.isArray(b.entries) ? (b.entries as PersonalSecretEntry[]) : undefined,
    }
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}

export async function saveVaultPersonalSecrets(
  entries: PersonalSecretEntry[],
  persistLocal: boolean
): Promise<{ ok: boolean; message?: string; error?: string; entries?: PersonalSecretEntry[] }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/vault-personal-secrets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries, persistLocal }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const r = parseOkEnvelopePassthrough(fr.text, { falseOkFallback: 'Safe speichern fehlgeschlagen.' })
    if (!r.ok) return { ok: false, error: r.error }
    const b = r.body
    const out = {
      ok: true as const,
      message: typeof b.message === 'string' ? b.message : undefined,
      error: typeof b.error === 'string' ? b.error : undefined,
      entries: Array.isArray(b.entries) ? (b.entries as PersonalSecretEntry[]) : undefined,
    }
    return out
  } catch (error) {
    return { ok: false, error: formatFetchFailureMessage(error) }
  }
}
