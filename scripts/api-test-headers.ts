/** Gemeinsame LAN-API-Auth für Script-Integrationstests (API_AUTH_TOKEN aus .env). */
export function apiTestJsonHeaders(extra?: HeadersInit): HeadersInit {
    const headers = new Headers(extra)
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    const token = (process.env.API_AUTH_TOKEN || '').trim()
    if (token) headers.set('X-Morgendrot-Api-Token', token)
    return headers
}

export function apiTestFetchInit(init?: RequestInit): RequestInit {
    const headers = apiTestJsonHeaders(init?.headers)
    return { ...init, headers }
}
