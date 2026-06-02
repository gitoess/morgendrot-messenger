'use client'

/**
 * Standalone (APK/Autarkie ohne API_BASE): kein Fallback auf Morgendrot-Relay (`/api/*`).
 */
import { isStandaloneDeviceMode } from '@/frontend/lib/capacitor-standalone-bootstrap'
import { getApiBase } from '@/frontend/lib/api/api-base'

export function shouldSkipMessengerApiRelayFallback(): boolean {
  return isStandaloneDeviceMode() && !getApiBase().trim()
}

/** Relay auf `/api/*` (Handshake, Connect, Posteingang) — in Standalone ohne `API_BASE` aus. */
export function canUseMessengerApiRelay(opts?: { backendReachable?: boolean }): boolean {
  if (shouldSkipMessengerApiRelayFallback()) return false
  return opts?.backendReachable !== false
}
