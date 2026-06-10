'use client'

import { getApiBase } from '@/frontend/lib/api/api-base'
import {
  isCapacitorNativePlatform,
  isStandaloneDeviceMode,
  shouldPreferStandaloneHandoffStatus,
} from '@/frontend/lib/capacitor-standalone-bootstrap'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { isStandaloneSoloPath, readStandaloneOnboardingPath } from '@/frontend/lib/standalone-onboarding'
import { ensureI18nInitialized, i18n } from '@/frontend/lib/i18n/client'

/** APK/Autarkie: Direkt-RPC + lokales Handoff — keine Morgendrot-Basis nötig. */
export function isStandaloneMessengerWithoutBasis(): boolean {
  if (!isStandaloneDeviceMode()) return false
  if (!getApiBase().trim()) return true
  return shouldPreferStandaloneHandoffStatus()
}

/** Hinweis unter dem Dashboard, wenn `backendReachable === false`. */
export function getMessengerDashboardOfflineHint(): string {
  ensureI18nInitialized()
  const tt = (key: string) => i18n.t(key, { ns: 'standalone' })

  if (!isStandaloneMessengerWithoutBasis()) {
    return (
      'Keine Verbindung zum Backend. Starte npm run dev (Backend 127.0.0.1:3342 + UI 127.0.0.1:3341). ' +
      'Bei Port-Kollision zuerst npm run dev:stop, dann erneut npm run dev. ' +
      'Wenn das Backend mit Fehlercode beendet: npm run start:secrets einzeln in einem Terminal ausführen.'
    )
  }
  const handoff = readLocalHandoffAppliedSnapshot()
  const onboardingPath = readStandaloneOnboardingPath()
  if (!handoff) {
    if (onboardingPath === 'einsatz') {
      return tt('hints.einsatzAwaitHandoff')
    }
    return tt('hints.firstStartChoice')
  }
  if (isStandaloneSoloPath()) {
    return tt('hints.soloActive')
  }
  const parts = [tt('offline.awaitHandoffSteps')]
  return parts.join(' ')
}
