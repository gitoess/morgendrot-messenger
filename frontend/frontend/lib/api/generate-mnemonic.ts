import { getApiBase } from '@/frontend/lib/api/api-base'
import { fetchWithApiAuth } from '@/frontend/lib/api-authenticated-fetch'
import {
  generateMnemonicKeypairLocally,
  type GenerateMnemonicOk,
  type GenerateMnemonicResult,
} from '@/frontend/lib/generate-mnemonic-local'

export type { GenerateMnemonicOk, GenerateMnemonicResult }

/** POST /api/generate-mnemonic — oder lokal wenn Basis-URL leer (Boss-APK offline). */
export async function fetchGenerateMnemonic(): Promise<GenerateMnemonicResult> {
  const apiBase = getApiBase().trim()
  if (!apiBase) {
    return generateMnemonicKeypairLocally()
  }

  try {
    const res = await fetchWithApiAuth(`${apiBase}/api/generate-mnemonic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const j = (await res.json()) as {
      ok?: boolean
      address?: string
      secretKey?: string
      error?: string
      message?: string
    }
    if (!res.ok || !j.ok) {
      return { ok: false, error: j.error || j.message || `HTTP ${res.status}` }
    }
    const address = String(j.address || '').trim()
    const secretKey = String(j.secretKey || '').trim()
    if (!address || !secretKey) {
      return { ok: false, error: 'Leere Antwort vom Server (Adresse oder Secret fehlt).' }
    }
    return { ok: true, address, secretKey }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
