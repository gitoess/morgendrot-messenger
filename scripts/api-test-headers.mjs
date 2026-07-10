/** Gemeinsame LAN-API-Auth für Script-Integrationstests (API_AUTH_TOKEN aus .env). */
export function apiTestJsonHeaders(extra) {
    const headers = new Headers(extra)
    if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    const token = (process.env.API_AUTH_TOKEN || '').trim()
    if (token) headers.set('X-Morgendrot-Api-Token', token)
    return headers
}

export function apiTestFetchInit(init = {}) {
    const headers = apiTestJsonHeaders(init.headers)
    return { ...init, headers }
}

/** true wenn API_BASE auf diesen Rechner zeigt (P0.5 erlaubt Mutationen ohne Token). */
export function isLoopbackApiBase(apiBase) {
    const b = String(apiBase || '').toLowerCase()
    return b.includes('127.0.0.1') || b.includes('localhost') || b.includes('[::1]')
}
