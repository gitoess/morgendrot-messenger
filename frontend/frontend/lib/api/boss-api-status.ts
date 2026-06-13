import type { ApiStatus } from '@/frontend/lib/api'
import {
  USER_MSG_FETCH_TIMEOUT,
  userMessageIndicatesFetchNetworkFailure,
} from '@/frontend/lib/api-fetch-text'

/** Boss-API nur wenn Status explizit online (nicht bei `undefined`). */
export function isBossApiLikelyOnline(apiStatus?: ApiStatus | null): boolean {
  if (!apiStatus) return false
  return apiStatus.backendRunning === true || apiStatus.backendOnline === true
}

export function isFetchTransportFailureMessage(msg: string): boolean {
  return userMessageIndicatesFetchNetworkFailure(msg) || msg.includes(USER_MSG_FETCH_TIMEOUT)
}
