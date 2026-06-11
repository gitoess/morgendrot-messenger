'use client'

import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'
import { isStandaloneSoloPath, readStandaloneOnboardingPath } from '@/frontend/lib/standalone-onboarding'
import { ensureI18nInitialized, i18n } from '@/frontend/lib/i18n/client'
import { standaloneT } from '@/frontend/lib/i18n/standalone-tt'
import { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/standalone-device-mode'

export { isStandaloneMessengerWithoutBasis } from '@/frontend/lib/standalone-device-mode'

/** Hinweis unter dem Dashboard, wenn `backendReachable === false`. */
export function getMessengerDashboardOfflineHint(): string {
  ensureI18nInitialized()
  const tt = standaloneT

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
