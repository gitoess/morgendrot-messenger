/**
 * Sendepfad → Posteingangs-Quellenfilter.
 * Online = alles; Funk / IOTA / Telegram = nur der jeweilige Kanal.
 */

import type { ActiveSendPath } from '@/frontend/lib/messenger-channel-send-path'
import type { InboxSourceFilter } from '@/frontend/lib/inbox-source-filter'

export function inboxSourceFilterForSendPath(p: {
  activeSendPath: ActiveSendPath
  iotaPathFocus?: boolean
}): InboxSourceFilter {
  if (p.activeSendPath === 'telegram') return 'telegram'
  if (p.activeSendPath === 'mesh') return 'funk'
  /** Ad-hoc (falls wieder aktiv): kein Mesh-Inhalt → wie Funk ohne Traffic. */
  if (p.activeSendPath === 'adhoc') return 'funk'
  if (p.iotaPathFocus) return 'iota'
  /** Online: alle Nachrichten / Quellen. */
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
  /** Kanal-Filter-Toggle: nur Online (sonst steuert der Sendepfad die Quelle). */
  showKanalFilterToggle: boolean
}

export function inboxToolbarToolsForSendPath(p: {
  activeSendPath: ActiveSendPath
  iotaPathFocus?: boolean
}): InboxToolbarPathTools {
  const onlineAll = p.activeSendPath === 'internet' && !p.iotaPathFocus
  const iotaOnly = p.activeSendPath === 'internet' && Boolean(p.iotaPathFocus)
  const chain = onlineAll || iotaOnly

  return {
    showWirePaste: chain,
    showDecryptExport: true,
    showPakete: chain,
    showNachrichtenverlauf: true,
    showOnChainNft: chain,
    showIotaExpertInHistory: chain,
    showKanalFilterToggle: onlineAll,
  }
}

/** Chat-⋮ (Burn/Ratchet/Schlüssel) — nur Chain/Online sinnvoll. */
export function conversationMenuChainToolsVisible(p: {
  activeSendPath: ActiveSendPath
  iotaPathFocus?: boolean
}): boolean {
  return p.activeSendPath === 'internet'
}
