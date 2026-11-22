/**
 * Sendepfad → Posteingangs-Quellenfilter.
 *
 * 2026-11: **immer `all`**. Sendepfad steuert nur Senden/Toolbar/Kontakte — nicht die Liste.
 * Sonst: Funk/IOTA wechseln → neueste Chain-Zeilen weg, zurück = „nachgezogen“.
 * Bewusste Quelle: Filter/Kanal-Chips im Posteingang.
 */

import type { ActiveSendPath } from '@/frontend/lib/messenger-channel-send-path'
import type { InboxSourceFilter } from '@/frontend/lib/inbox-source-filter'

export function inboxSourceFilterForSendPath(p: {
  activeSendPath: ActiveSendPath
  iotaPathFocus?: boolean
}): InboxSourceFilter {
  void p.activeSendPath
  void p.iotaPathFocus
  return 'all'
}

/** Online = kein Kontakt-Pfadfilter; sonst nur erreichbare Kontakte des Pfads. */
export function contactSidebarSendPathFilter(p: {
  activeSendPath: ActiveSendPath
  iotaPathFocus?: boolean
}): ActiveSendPath | undefined {
  if (p.activeSendPath === 'internet' && !p.iotaPathFocus) return undefined
  if (p.activeSendPath === 'internet' && p.iotaPathFocus) return 'internet'
  return p.activeSendPath
}

/** Online zeigt Telegram-Alarmgruppe; IOTA-Fokus blendet sie aus. */
export function showTelegramAlarmOnSendPath(p: {
  activeSendPath: ActiveSendPath
  iotaPathFocus?: boolean
}): boolean {
  if (p.iotaPathFocus) return false
  if (p.activeSendPath === 'telegram') return true
  if (p.activeSendPath === 'internet') return true
  return false
}

/** Gruppen/Pinnwand = Chain — Online + IOTA; nicht Funk/Telegram. */
export function showChainSidebarExtrasOnSendPath(p: {
  activeSendPath: ActiveSendPath
  iotaPathFocus?: boolean
}): boolean {
  void p.iotaPathFocus
  return p.activeSendPath === 'internet'
}

/** Posteingang-Werkzeuge je Sendepfad (Optionen-Menü + On-Chain-Button). */
export type InboxToolbarPathTools = {
  showWirePaste: boolean
  showDecryptExport: boolean
  showPakete: boolean
  showNachrichtenverlauf: boolean
  showOnChainNft: boolean
  showIotaExpertInHistory: boolean
  /** Kanal-Filter-Toggle: Quelle bewusst filtern (Sendepfad filtert die Liste nicht mehr). */
  showKanalFilterToggle: boolean
}

export function inboxToolbarToolsForSendPath(p: {
  activeSendPath: ActiveSendPath
  iotaPathFocus?: boolean
}): InboxToolbarPathTools {
  const onlineAll = p.activeSendPath === 'internet' && !p.iotaPathFocus
  const iotaOnly = p.activeSendPath === 'internet' && Boolean(p.iotaPathFocus)
  const chain = onlineAll || iotaOnly
  const telegram = p.activeSendPath === 'telegram'

  return {
    /** Wire/PWMSG = Chain; Telegram hat Journal, kein Wire-Paste. */
    showWirePaste: chain,
    showDecryptExport: true,
    /** .morg-pkg Sneakernet — auch Telegram/Funk sinnvoll. */
    showPakete: chain || telegram || p.activeSendPath === 'mesh',
    showNachrichtenverlauf: true,
    showOnChainNft: chain,
    showIotaExpertInHistory: chain,
    showKanalFilterToggle: true,
  }
}

/** Optionen → Chat · Sicherheit (Burn-Modus/Ratchet/Schlüssel) — nur Chain/Online sinnvoll. */
export function conversationMenuChainToolsVisible(p: {
  activeSendPath: ActiveSendPath
  iotaPathFocus?: boolean
}): boolean {
  return p.activeSendPath === 'internet'
}
