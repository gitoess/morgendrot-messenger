/**
 * PWA: **direkter** IOTA-Fullnode (Light-Client), ohne Morgendrot-API als Pflicht.
 *
 * Auflösung (erste nicht-leere):
 * 1. `localStorage['morgendrot.directIotaRpcUrl']` (nur im Browser)
 * 2. `process.env.NEXT_PUBLIC_DIRECT_IOTA_RPC_URL` (Build-Zeit)
 *
 * @see docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md
 */
import { createDirectIotaClient, probeDirectIotaRpc, type IotaClient } from '@morgendrot/core/iota'

const LS_KEY = 'morgendrot.directIotaRpcUrl'

export function readBrowserDirectIotaRpcUrlOverride(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage?.getItem(LS_KEY)?.trim()
    return v || null
  } catch {
    return null
  }
}

export function getConfiguredDirectIotaRpcUrl(): string | null {
  const fromLs = readBrowserDirectIotaRpcUrlOverride()
  if (fromLs) return fromLs
  const fromEnv =
    typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DIRECT_IOTA_RPC_URL
      ? String(process.env.NEXT_PUBLIC_DIRECT_IOTA_RPC_URL).trim()
      : ''
  return fromEnv || null
}

/** Persist override; `null`/`''` removes. Browser-only no-op on server. */
export function setBrowserDirectIotaRpcUrlOverride(url: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (!url?.trim()) window.localStorage.removeItem(LS_KEY)
    else window.localStorage.setItem(LS_KEY, url.trim())
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Returns a client or `null` if no URL is configured.
 * @throws if URL is set but invalid (caller should surface to UI).
 */
export function tryCreateBrowserDirectIotaClient(): IotaClient | null {
  const raw = getConfiguredDirectIotaRpcUrl()
  if (!raw) return null
  return createDirectIotaClient({ rpcUrl: raw })
}

export async function probeBrowserDirectIotaIfConfigured(): Promise<boolean> {
  const client = tryCreateBrowserDirectIotaClient()
  if (!client) return false
  return probeDirectIotaRpc(client)
}

export { createDirectIotaClient, probeDirectIotaRpc, sanitizeDirectIotaRpcUrl } from '@morgendrot/core/iota'
export type { IotaClient } from '@morgendrot/core/iota'
