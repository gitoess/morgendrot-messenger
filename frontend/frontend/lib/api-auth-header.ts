const LS_API_AUTH_TOKEN = 'morgendrot.apiAuthToken.v1'

/** Optional: LAN-API-Token aus Handoff oder NEXT_PUBLIC_API_AUTH_TOKEN. */
export function getApiAuthToken(): string {
  if (typeof window !== 'undefined') {
    try {
      const fromLs = localStorage.getItem(LS_API_AUTH_TOKEN)?.trim()
      if (fromLs) return fromLs
    } catch {
      /* ignore */
    }
  }
  return (process.env.NEXT_PUBLIC_API_AUTH_TOKEN || '').trim()
}

/** Handoff-.env: API_AUTH_TOKEN in localStorage übernehmen (LAN-Mutationen). */
export function persistApiAuthTokenFromHandoffEnv(envText: string): void {
  if (typeof window === 'undefined') return
  const token = parseEnvValue(envText, 'API_AUTH_TOKEN')
  if (!token) return
  try {
    window.localStorage.setItem(LS_API_AUTH_TOKEN, token)
  } catch {
    /* ignore */
  }
}

function parseEnvValue(envText: string, key: string): string {
  const re = new RegExp(`^${key}\\s*=\\s*(.+)$`, 'im')
  const m = re.exec(envText)
  if (!m?.[1]) return ''
  return m[1].trim().replace(/^["']|["']$/g, '')
}

export function withApiAuthHeaders(init?: RequestInit): RequestInit {
  const token = getApiAuthToken()
  if (!token) return init ?? {}
  const headers = new Headers(init?.headers)
  headers.set('X-Morgendrot-Api-Token', token)
  return { ...init, headers }
}
