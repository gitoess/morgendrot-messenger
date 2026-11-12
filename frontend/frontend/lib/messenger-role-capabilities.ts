import type { ApiStatus } from '@/frontend/lib/api/status'
import { getDirectIotaSessionSigner } from '@/frontend/lib/direct-iota-mnemonic-session'

export type TransportProfile = 'mesh-first' | 'iota-anchored' | 'iota-full'
export type UiMode = 'simple' | 'expert'

/** Simple Mode aus Status-API (serverseitig erzwungen). */
export function isSimpleUiMode(status: ApiStatus | null | undefined): boolean {
  if (!status) return false
  if (status.uiMode === 'simple') return true
  if (status.uiMode === 'expert') return false
  if (status.simpleMode === true) return true
  if (status.simpleMode === false) return false
  const role = (status.role || '').trim().toLowerCase()
  return role === 'arbeiter' || status.deploymentProfile === 'consumer'
}

/** IOTA-UI (Package-Banner, Relay, IOTA-Filter) nur wenn Transport es erlaubt. */
export function isIotaTransportUiVisible(status: ApiStatus | null | undefined): boolean {
  if (!status) return true
  if (status.iotaTransportUiEnabled === false) return false
  if (status.iotaTransportUiEnabled === true) return true
  const tp = status.transportProfile
  return tp === 'iota-anchored' || tp === 'iota-full'
}

/** Expert-Werkzeuge (Relay, R1, Pulse-IDs) — in Simple Mode gesperrt. */
export function canUseMessengerExpertTools(status: ApiStatus | null | undefined): boolean {
  if (isSimpleUiMode(status)) return false
  return isIotaTransportUiVisible(status)
}

/**
 * Posteingang: Package-ID-Steuerung (temporär/dauerhaft).
 * Erfordert: IOTA-Transport, kein serverseitiger Simple Mode, plus client opt-in.
 */
export function canShowInboxPackageExpertMenu(
  status: ApiStatus | null | undefined,
  clientExpertModeEnabled: boolean
): boolean {
  if (!clientExpertModeEnabled) return false
  if (isSimpleUiMode(status)) return false
  return isIotaTransportUiVisible(status)
}

export type MessengerUiCapabilities = {
  simpleMode: boolean
  iotaTransportUi: boolean
  expertTools: boolean
  /** Posteingang Package-ID-Menü — setze clientExpertModeEnabled separat. */
  showInboxPackageExpertMenu: (clientExpertModeEnabled: boolean) => boolean
  showInboxIotaFilter: boolean
  showPackageIdBanner: boolean
  /**
   * Ad-hoc BLE-Platzhalter — aus SENDPFAD entfernt (Backlog ganz hinten).
   * Default immer aus; Flag bleibt für spätere Wiedereinschaltung.
   */
  showAdhocTransport: boolean
  /** Offline-Mailbox-Queue als Streifen unter der Kopfzeile (Helfer). */
  showProminentOfflineQueueBanner: boolean
}

/** Eine Quelle für Chat-UI-Gates (§ H.0-SIMPLE). */
export function getMessengerUiCapabilities(
  status: ApiStatus | null | undefined
): MessengerUiCapabilities {
  const simpleMode = isSimpleUiMode(status)
  const iotaTransportUi = isIotaTransportUiVisible(status)
  const expertTools = canUseMessengerExpertTools(status)
  return {
    simpleMode,
    iotaTransportUi,
    expertTools,
    showInboxPackageExpertMenu: (clientExpertModeEnabled) =>
      canShowInboxPackageExpertMenu(status, clientExpertModeEnabled),
    showInboxIotaFilter: iotaTransportUi,
    showPackageIdBanner: iotaTransportUi,
    /** Ad-hoc bewusst aus dem Sendepfad — Roadmap ganz hinten. */
    showAdhocTransport: false,
    showProminentOfflineQueueBanner: simpleMode,
  }
}

/** Einsatzleitung-Tab — Boss und Kommandant. */
export function canAccessEinsatzleitung(role: string | null | undefined): boolean {
  const r = (role || '').trim().toLowerCase()
  return r === 'boss' || r === 'kommandant'
}

/** Team-Mailbox on-chain erstellen — Einsatz + teamManage, oder Direkt-IOTA-Signer (Standalone). */
export function canCreateTeamMailbox(status: ApiStatus | null | undefined): boolean {
  if (status?.deploymentProfile === 'consumer') return false
  if (status?.permissions?.teamManage) return true
  /* Standalone / Direct-RPC: Gruppe verwalten soll „Neu erstellen“ anbieten. */
  if (typeof window !== 'undefined' && getDirectIotaSessionSigner()) return true
  return false
}

/** Einsatz-Rollen-Vorlagen in Einstellungen anzeigen (Lesen für Kommandant, Schreiben nur Boss). */
export function canViewEinsatzRoleTemplatesSection(status: ApiStatus | null | undefined): boolean {
  if (!status) return false
  if (status.backendOnline !== true && status.backendRunning !== true) return false
  if (status.deploymentProfile !== 'einsatz') return false
  const role = (status.role || '').trim().toLowerCase()
  return role === 'boss' || role === 'kommandant'
}

/** Vorlagen speichern — nur Boss mit configChange. */
export function canEditEinsatzRoleTemplates(status: ApiStatus | null | undefined): boolean {
  if (!canViewEinsatzRoleTemplatesSection(status)) return false
  return Boolean(status?.permissions?.configChange)
}
