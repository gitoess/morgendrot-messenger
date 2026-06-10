import { API_BASE } from '@/frontend/lib/api/api-base'

export type GenerateMnemonicOk = {
  ok: true
  address: string
  /** Mnemonic oder Bech32-Secret — nur einmalig anzeigen */
  secretKey: string
}

export type GenerateMnemonicResult = GenerateMnemonicOk | { ok: false; error: string }

/** POST /api/generate-mnemonic — nur Boss/Messenger. */
export async function fetchGenerateMnemonic(): Promise<GenerateMnemonicResult> {
  try {
    const res = await fetch(`${API_BASE}/api/generate-mnemonic`, {
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
