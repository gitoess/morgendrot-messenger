'use client'

import { getApiBase } from '@/frontend/lib/api/api-base'
import { isStandaloneDeviceMode } from '@/frontend/lib/capacitor-standalone-bootstrap'
import { readLocalHandoffAppliedSnapshot } from '@/frontend/lib/handoff-local-apply'

/** APK/Autarkie ohne `API_BASE` — Kernpfad über Direkt-RPC, nicht Morgendrot-Relay. */
export function isStandaloneMessengerWithoutBasis(): boolean {
  return isStandaloneDeviceMode() && !getApiBase().trim()
}

/** Hinweis unter dem Dashboard, wenn `backendReachable === false`. */
export function getMessengerDashboardOfflineHint(): string {
  if (!isStandaloneMessengerWithoutBasis()) {
    return (
      'Keine Verbindung zum Backend. Starte npm run dev (Backend 127.0.0.1:3342 + UI 127.0.0.1:3341). ' +
      'Bei Port-Kollision zuerst npm run dev:stop, dann erneut npm run dev. ' +
      'Wenn das Backend mit Fehlercode beendet: npm run start:secrets einzeln in einem Terminal ausführen.'
    )
  }
  const handoff = readLocalHandoffAppliedSnapshot()
  const parts = [
    'Standalone ohne Morgendrot-Basis: IOTA-Chat über Fullnode-RPC, Handoff (lokal vormerken) und Peering-QR — kein Morgendrot-Server auf dem Handy nötig.',
    'Einstellungen → Handoff-Import oder Puls → Peering-QR; Mnemonic + Chat-ECDH-JWK im Puls setzen.',
    'Smoke: docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md (Schritte 4b–4f).',
  ]
  if (!handoff) {
    parts.push('Noch kein lokales Handoff — Boss-ZIP „Lokal vormerken“ oder Peering-QR mit RPC/Package scannen.')
  }
  return parts.join(' ')
}
