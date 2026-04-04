// Morgendrot API Client
// API base URL – leer = gleiche Origin (Next rewrites → Backend); sonst NEXT_PUBLIC_API_BASE.
function resolveApiBase(): string {
  const explicit = (process.env.NEXT_PUBLIC_API_BASE || '').trim().replace(/\/$/, '')
  if (explicit) return explicit
  if (typeof window !== 'undefined') return ''
  return 'http://127.0.0.1:3342'
}

const API_BASE = resolveApiBase()

export interface CommandResponse {
  ok: boolean
  message?: string
  error?: string
  messages?: Array<{
    sender: string
    text: string
    isPlain?: boolean
    nonce?: number
  }>
  data?: unknown
}

export interface StatusResponse {
  ok?: boolean
  backendRunning?: boolean
  connected?: boolean
  address?: string
  myAddress?: string
  packageId?: string
  network?: string
  /** GET /api/status: Kurzdarstellung RPC_URL (Host/Pfad). */
  rpcUrlLabel?: string
  version?: string
  error?: string
}

export interface ConfigItem {
  key: string
  value: string
  envKey: string
}

export interface ConfigResponse {
  ok: boolean
  config?: ConfigItem[]
}

// Execute a command via the API
export async function executeCommand(
  cmd: string,
  args: string[] = [],
  silentFetch?: boolean
): Promise<CommandResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd, args, silentFetch }),
    })
    return await response.json()
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}

// Get current status
export async function getStatus(): Promise<StatusResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/status`)
    return await response.json()
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    } as StatusResponse & { error: string }
  }
}

// Get current configuration
export async function getConfig(): Promise<ConfigResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/config`)
    return await response.json()
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    } as ConfigResponse & { error: string }
  }
}

// Set a config value
export async function setConfig(key: string, value: string): Promise<CommandResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    return await response.json()
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}

// Get current IDs (MY_ADDRESS, PACKAGE_ID)
export async function getCurrentIds(): Promise<{ ok: boolean; myAddress?: string; packageId?: string }> {
  try {
    const response = await fetch(`${API_BASE}/api/current-ids`)
    return await response.json()
  } catch (error) {
    return { ok: false }
  }
}

// Get package ID history (current + history list)
export async function getPackageIdHistory(): Promise<{
  ok: boolean
  current?: string
  history?: string[]
  hints?: Record<string, { label?: string; peer?: string; note?: string }>
}> {
  try {
    const response = await fetch(`${API_BASE}/api/package-id-history`)
    return await response.json()
  } catch (error) {
    return { ok: false }
  }
}

// Get connect addresses
export async function getConnectAddresses(): Promise<{ ok: boolean; addresses?: string[] }> {
  try {
    const response = await fetch(`${API_BASE}/api/connect-addresses`)
    return await response.json()
  } catch (error) {
    return { ok: false }
  }
}

// Check if chain is reachable
export async function checkChainReachable(): Promise<{ ok: boolean; reachable?: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/api/chain-reachable`)
    return await response.json()
  } catch (error) {
    return { ok: false, reachable: false }
  }
}

// Get list of keys (API returns { ok, keys })
export async function listKeys(owner?: string): Promise<CommandResponse & { keys?: unknown[] }> {
  try {
    const url = owner
      ? `${API_BASE}/api/list-keys?owner=${encodeURIComponent(owner)}`
      : `${API_BASE}/api/list-keys`
    const response = await fetch(url)
    const data = await response.json()
    if (data.ok && Array.isArray(data.keys) && !data.data) data.data = data.keys
    return data
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}

// Get list of tickets (API returns { ok, tickets })
export async function listTickets(owner?: string): Promise<CommandResponse & { tickets?: unknown[] }> {
  try {
    const url = owner
      ? `${API_BASE}/api/list-tickets?owner=${encodeURIComponent(owner)}`
      : `${API_BASE}/api/list-tickets`
    const response = await fetch(url)
    const data = await response.json()
    if (data.ok && Array.isArray(data.tickets) && !data.data) data.data = data.tickets
    return data
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Connection failed',
    }
  }
}
