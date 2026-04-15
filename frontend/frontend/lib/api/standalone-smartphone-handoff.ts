import { API_BASE } from '@/frontend/lib/api/api-base'

export type StandaloneHandoffPackageSource = 'boss' | 'custom' | 'history'

export type StandaloneSmartphoneHandoffZipBody = {
  handoffLabel?: string
  rpcUrl?: string
  packageSource?: StandaloneHandoffPackageSource
  customPackageId?: string
  historyFromNewest?: number
  bossAddress?: string
  partnerAddresses?: string
  /** Leerer String erlaubt (keine MAILBOX_ID im Export); weglassen = Server nutzt Boss-.env. */
  mailboxId?: string
  commandRegistryId?: string
  vaultRegistryId?: string
  nextPublicDirectIotaRpcUrl?: string
}

/** POST /api/standalone-smartphone-handoff-zip → Browser-Download (ZIP). */
export async function downloadStandaloneSmartphoneHandoffZip(
  body: StandaloneSmartphoneHandoffZipBody
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/standalone-smartphone-handoff-zip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (!res.ok) {
      if (ct.includes('application/json')) {
        const j = (await res.json()) as { error?: string; message?: string }
        return { ok: false, error: j.error || j.message || `HTTP ${res.status}` }
      }
      return { ok: false, error: `HTTP ${res.status}` }
    }
    if (!ct.includes('application/zip')) {
      if (ct.includes('application/json')) {
        const j = (await res.json()) as { error?: string; message?: string }
        return { ok: false, error: j.error || j.message || 'Unerwartete JSON-Antwort' }
      }
      return { ok: false, error: 'Kein ZIP (Content-Type).' }
    }
    const blob = await res.blob()
    const dispo = res.headers.get('content-disposition') || ''
    const m = /filename="([^"]+)"/i.exec(dispo)
    const filename = m?.[1] || 'morgendrot-standalone-handoff.zip'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg }
  }
}
