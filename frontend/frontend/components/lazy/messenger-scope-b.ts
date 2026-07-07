'use client'

/**
 * Scope-B UI: Boss, Handoff, Expert/On-Chain — lazy via next/dynamic.
 * Siehe docs/MESSENGER-SCOPE-P0-LAZY-PLAN.md
 */
import dynamic from 'next/dynamic'

/** B1 — Boss-Steuerung */
export const LazyBossView = dynamic(
  () => import('@/frontend/components/views/boss-view').then((m) => m.BossView),
  { ssr: false, loading: () => null }
)

/** B1 — Backend-.env-Editor */
export const LazyConfigView = dynamic(
  () => import('@/frontend/components/views/config-view').then((m) => m.ConfigView),
  { ssr: false, loading: () => null }
)

/** B1 — Handoff-Import (Settings) */
export const LazyHandoffImportPanel = dynamic(
  () => import('@/frontend/components/handoff-import-panel').then((m) => m.HandoffImportPanel),
  { ssr: false, loading: () => null }
)

/** B1 — Boss: Helfer einrichten → Handoff-Export-Baum */
export const LazyBossHelferEinrichtenPanel = dynamic(
  () => import('@/frontend/components/boss-helfer-einrichten-panel').then((m) => m.BossHelferEinrichtenPanel),
  { ssr: false, loading: () => null }
)

/** B1 — Boss: „Mein Team“ (provisionierte Helfer, Roster, Team-Postfächer) */
export const LazyEinsatzleitungMeinTeamPanel = dynamic(
  () => import('@/frontend/components/einsatzleitung-mein-team-panel').then((m) => m.EinsatzleitungMeinTeamPanel),
  { ssr: false, loading: () => null }
)

/** B3 — Kommandant/Boss: erweiterte Einsatzleitung */
export const LazyEinsatzleitungErweitertPanel = dynamic(
  () => import('@/frontend/components/einsatzleitung-erweitert-panel').then((m) => m.EinsatzleitungErweitertPanel),
  { ssr: false, loading: () => null }
)

/** B2 — Direct-IOTA / Pulse / Peering-Settings */
export const LazyChatViewPulseSettings = dynamic(
  () => import('@/frontend/components/chat-view-pulse-settings').then((m) => m.ChatViewPulseSettings),
  { ssr: false, loading: () => null }
)

/** B2 — TX-Relay / R1-Courier */
export const LazyChatViewRelaySubmitButton = dynamic(
  () => import('@/frontend/components/chat-view-relay-submit-button').then((m) => m.ChatViewRelaySubmitButton),
  { ssr: false, loading: () => null }
)

/** B2 — Protokoll on-chain verankern */
export const LazyChatViewProtokollAnchorButton = dynamic(
  () =>
    import('@/frontend/components/chat-view-protokoll-anchor-button').then((m) => m.ChatViewProtokollAnchorButton),
  { ssr: false, loading: () => null }
)

/** B2 — Tangle-Inventar */
export const LazyChatViewTangleInventoryButton = dynamic(
  () => import('@/frontend/components/chat-view-tangle-inventory-button').then((m) => m.ChatViewTangleInventoryButton),
  { ssr: false, loading: () => null }
)

/** B2 — Peering-QR (QR / Scan / Einfügen) */
export const LazyPeeringQrActions = dynamic(
  () => import('@/frontend/components/peering-qr-actions').then((m) => m.PeeringQrActions),
  { ssr: false, loading: () => null }
)

/** B2 — .morg-pkg Paket-Archiv (Sheet) */
export const LazyChatViewMorgPkgImportsSheet = dynamic(
  () =>
    import('@/frontend/components/chat-view-morg-pkg-imports-sheet').then((m) => m.ChatViewMorgPkgImportsSheet),
  { ssr: false, loading: () => null }
)
