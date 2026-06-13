import { withApiAuthHeaders } from '@/frontend/lib/api-auth-header'

/** `fetch` mit optionalem `X-Morgendrot-Api-Token` (LAN-Hardening). */
export function fetchWithApiAuth(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, withApiAuthHeaders(init))
}
