/**
 * Einfache GET/POST-JSON-Endpunkte für Dashboard/Setup (kein `/api/command`-Envelope).
 * Vor der Aufteilung im Messenger-API-Monolith; hier mit `API_BASE` wie die übrige Messenger-API.
 */

import { getApiBase } from '@/frontend/lib/api/api-base'
import { fetchApiText, joinApiUrl } from '@/frontend/lib/api-fetch-text'
import type { CommandResponse } from '@/frontend/lib/api/command-response-types'

export type ConfigItem = {
  key: string
  value: string
  envKey: string
}

export type ConfigResponse = {
  ok: boolean
  config?: ConfigItem[]
  error?: string
}

export async function getConfig(): Promise<ConfigResponse> {
  try {
    const response = await fetch(joinApiUrl(getApiBase(), '/api/config'))
    return await response.json()
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    } as ConfigResponse & { error: string }
  }
}

export async function setConfig(key: string, value: string): Promise<CommandResponse> {
  const fr = await fetchApiText(getApiBase(), '/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
  if (!fr.ok) {
    return { ok: false, error: fr.error }
  }
  try {
    return JSON.parse(fr.text) as CommandResponse
  } catch {
    return { ok: false, error: 'Ungültige JSON-Antwort vom Server.' }
  }
}

export async function getCurrentIds(): Promise<{ ok: boolean; myAddress?: string; packageId?: string }> {
  try {
    const response = await fetch(joinApiUrl(getApiBase(), '/api/current-ids'))
    return await response.json()
  } catch {
    return { ok: false }
  }
}

/** Rohes JSON wie früher im zentralen API-Barrel — für Inbox/Setup ohne Envelope-Parser. */
export async function getPackageIdHistory(): Promise<{
  ok: boolean
  current?: string
  history?: string[]
  hints?: Record<string, { label?: string; peer?: string; note?: string }>
}> {
  try {
    const response = await fetch(joinApiUrl(getApiBase(), '/api/package-id-history'))
    return await response.json()
  } catch {
    return { ok: false }
  }
}

export async function getConnectAddresses(): Promise<{ ok: boolean; addresses?: string[] }> {
  try {
    const response = await fetch(joinApiUrl(getApiBase(), '/api/connect-addresses'))
    return await response.json()
  } catch {
    return { ok: false }
  }
}

export async function checkChainReachable(): Promise<{ ok: boolean; reachable?: boolean }> {
  try {
    const response = await fetch(joinApiUrl(getApiBase(), '/api/chain-reachable'))
    return await response.json()
  } catch {
    return { ok: false, reachable: false }
  }
}
