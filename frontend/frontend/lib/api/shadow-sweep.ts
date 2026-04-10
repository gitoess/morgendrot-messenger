import { fetchApiText, formatFetchFailureMessage } from '@/frontend/lib/api-fetch-text'
import { parseApiJsonEnvelope } from '@/frontend/lib/api-response-guard'
import { API_BASE } from '@/frontend/lib/api/api-base'

/** Schatten-Mnemonic → neues Main-Keypair, Assets sweepen (POST /api/shadow-sweep). Braucht erreichbare Chain. */
export type ShadowSweepApiResult = {
  ok: true
  digest?: string
  shadowAddress: string
  mainAddress: string
  mainSecretKey: string
  transferredObjectCount: number
  sentMistApprox: string
  note?: string
  securityNote?: string
}

export async function postShadowSweep(
  shadowMnemonic: string
): Promise<ShadowSweepApiResult | { ok: false; error: string }> {
  try {
    const fr = await fetchApiText(API_BASE, '/api/shadow-sweep', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shadowMnemonic: shadowMnemonic.trim() }),
    })
    if (!fr.ok) return { ok: false, error: fr.error }
    const { response, text } = fr
    const envelope = parseApiJsonEnvelope(text)
    if (!envelope.ok) {
      return {
        ok: false,
        error:
          envelope.error === 'invalid_json'
            ? 'Antwort vom Backend ist kein gültiges JSON.'
            : 'Unerwartetes Antwortformat (API).',
      }
    }
    const data = envelope.data as Record<string, unknown>
    if (!response.ok || data.ok === false) {
      const err =
        (typeof data.error === 'string' && data.error.length > 0 && data.error) ||
        (typeof data.message === 'string' && data.message.length > 0 && data.message) ||
        `Sweep fehlgeschlagen (${response.status}).`
      return { ok: false, error: err }
    }
    if (
      data.ok === true &&
      typeof data.mainAddress === 'string' &&
      typeof data.mainSecretKey === 'string' &&
      typeof data.shadowAddress === 'string'
    ) {
      return {
        ok: true,
        digest: typeof data.digest === 'string' ? data.digest : undefined,
        shadowAddress: data.shadowAddress,
        mainAddress: data.mainAddress,
        mainSecretKey: data.mainSecretKey,
        transferredObjectCount:
          typeof data.transferredObjectCount === 'number' ? data.transferredObjectCount : 0,
        sentMistApprox: typeof data.sentMistApprox === 'string' ? data.sentMistApprox : '0',
        note: typeof data.note === 'string' ? data.note : undefined,
        securityNote: typeof data.securityNote === 'string' ? data.securityNote : undefined,
      }
    }
    return { ok: false, error: 'Unerwartete Antwort vom Server.' }
  } catch (e) {
    return { ok: false, error: formatFetchFailureMessage(e) }
  }
}
