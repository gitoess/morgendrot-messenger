# Messenger Aufräumen P0 — Scope A/B und `dynamic()`-Plan

**Stand:** 2026-06-02  
**Kontext:** Enge Messenger-Schicht ~22k LOC (`chat-view*`, `messenger*`, zugehörige hooks/features/lib). Scope B ~12k LOC überlappt im gleichen Bundle.  
**Ziel P0:** Scope B aus dem Helfer-Happy-Path (Bundle + Parse-Zeit), ohne Feature-Abzug für Boss/Kommandant/Expert.

---

## 1. Scope A — Kern (behalten, eager OK)

**Rollen:** Helfer, Kommandant im Feld. Build: `NEXT_PUBLIC_MORG_PRODUCT=messenger`.

### 1.1 Chat & Senden (~8.5k LOC Komponenten)

| Datei | Zeilen | Rolle |
|-------|--------|--------|
| `views/chat-view.tsx` | ~50 | Einstieg Chat |
| `chat-view-main-content.tsx` | 1294 | Assembly (Refactor P1, eager) |
| `chat-view-send-panel.tsx` | 1140 | Composer |
| `chat-view-transport-card.tsx` | ~400 | Transportwahl |
| `chat-view-attachment-bar.tsx` | ~220 | Anhänge |
| `chat-view-voice-record.tsx` | ~140 | Sprachmemo |
| `chat-view-chat-header.tsx` | ~350 | Header / Tresor-Badge |
| `chat-view-offline-queue-strip.tsx` | ~120 | Offline-Warteschlange |
| `chat-view-setup-panel.tsx` | ~200 | Erst-Setup |
| `chat-view-encrypted-partner-panel.tsx` | ~280 | Partner / Handshake |
| `chat-view-encrypted-recipient-handshake-bar.tsx` | ~80 | Composer-Handshake |
| `chat-view-send-path-compact.tsx` | ~200 | Sendepfad kompakt |
| `chat-view-contact-send-mailbox-select.tsx` | ~150 | Mailbox-Auswahl |
| `chat-view-identity-card.tsx` | ~120 | Identität |
| `chat-view-phonebook-section.tsx` | 382 | Telefonbuch |
| `chat-view-phonebook-sheet.tsx` | ~150 | Sheet |
| `contact-phonebook-contact-dialog.tsx` | ~200 | Kontakt-Dialog |
| `contact-add-alias-dialog.tsx` | ~80 | Alias |
| `chat-message-body.tsx` | 720 | Nachrichten-Render |

### 1.2 Posteingang (~2.5k LOC)

| Datei | Zeilen |
|-------|--------|
| `chat-view-inbox-panel.tsx` | ~350 |
| `chat-view-inbox-list.tsx` | 578 |
| `chat-view-inbox-toolbar.tsx` | 554 |
| `chat-view-inbox-partner-strip.tsx` | ~200 |
| `chat-view-inbox-category-chips.tsx` | ~100 |
| `chat-view-inbox-handshake-requests.tsx` | ~120 |
| `chat-view-inbox-outgoing-handshake-requests.tsx` | ~100 |
| `chat-view-inbox-unread-threads-strip.tsx` | ~80 |
| `chat-view-inbox-package-expert-menu.tsx` | ~150 | *UI bleibt A; lazy wenn Expert aus* |
| `chat-view-package-id-banner.tsx` | ~100 |
| `chat-view-pending-sends-button.tsx` | ~180 |

### 1.3 Kanäle & Gruppe (Grauzone → **A**, Einsatz-Kern)

| Datei | Zeilen | Notiz |
|-------|--------|-------|
| `chat-view-group-panel.tsx` | ~520 | Team-Broadcast |
| `chat-view-pinnwand-feed-panel.tsx` | ~200 | Pinnwand-Feed |
| `chat-view-pinnwand-inbox-strip.tsx` | ~100 | |
| `chat-view-pinnwand-moderation-card.tsx` | ~150 | Kommandant |

### 1.4 Shell & Navigation (~1.5k LOC)

| Datei | Zeilen |
|-------|--------|
| `messenger-dashboard.tsx` | 590 |
| `messenger-bottom-nav.tsx` | ~120 |
| `dashboard-messenger-boss-header.tsx` | ~150 |
| `dashboard-messenger-boss-home.tsx` | ~200 |
| `dashboard-shared-dialogs.tsx` | ~180 |
| `dashboard-connection-status-strip.tsx` | ~80 |
| `dashboard-my-address-picker.tsx` | ~120 |
| `dashboard-pwa-install-card.tsx` | ~100 |
| `dashboard-role-pill.tsx` | ~40 |
| `dashboard-features-messenger.tsx` | ~80 |
| `helper-seed-setup-dialog.tsx` | ~200 |
| `standalone-handoff-activate-card.tsx` | 120 | Helfer-Onboarding — **klein, eager** |
| `standalone-first-start-card.tsx` | 111 | |
| `vault-unlock-dialog.tsx` | 422 |

### 1.5 Views (Helfer/Kommandant)

| Datei | Zeilen | Lazy? |
|-------|--------|-------|
| `views/vault-view.tsx` | 759 | **Nein** — Helfer-Kern |
| `views/settings-view.tsx` | 267 | Eager; **Subpanels B lazy** |
| `views/einsatzleitung-view.tsx` | 40 | Shell eager; **Boss-Subpanels lazy** |
| `einsatzleitung-hub.tsx` | 16 | A |
| `einsatz-end-panel.tsx` | 155 | A (Kommandant) |
| `einsatz-chain-mode-banner.tsx` | 34 | A |

### 1.6 Hooks (~5.5k LOC, alle **A** — Refactor P1)

| Datei | Zeilen |
|-------|--------|
| `use-chat-view-core.ts` | 996 |
| `use-chat-view-handle-send.ts` | 1473 |
| `use-chat-view-inbox-local-ui.ts` | 832 |
| `use-chat-view-inbox.ts` | ~350 |
| `use-chat-view-attachments.ts` | ~300 |
| `use-chat-view-connection-actions.ts` | ~250 |
| `use-chat-view-send-flow.ts` | ~200 |
| `use-chat-view-voice-record.ts` | ~150 |
| `use-chat-view-api-status-poll.ts` | ~200 |
| `use-chat-view-pending-handshakes.ts` | ~120 |
| `use-chat-view-telegram-composer.ts` | ~80 |
| `use-chat-view-mirror-delay.ts` | 377 |
| `use-chat-view-morg-pkg-actions.ts` | ~200 | *Expert-lastig → B2 lazy UI* |
| `use-meshtastic-ble.ts` | 741 |
| `use-dashboard-session.ts` | 834 | Shared; Messenger-Teil A |

### 1.7 Features & Lib (Auszug, **A**)

- `features/send/*`, `features/inbox/*`, `features/attachments/*`, `features/voice/*`, `features/messenger-ports/*`
- `lib/compact-image-wire.ts`, `lib/mailbox-send-hybrid.ts`, `lib/chat-view-messenger-transport.ts`
- `lib/messenger-role-capabilities.ts`, `lib/messenger-chat-channel.ts`, `lib/messenger-capability-gates.ts`
- `lib/contact-display.ts`, `lib/apply-phonebook-contact.ts`, `lib/encrypted-recipient-handshake-status.ts`
- `lib/handoff-local-apply.ts`, `lib/handoff-standalone-ready.ts` — **Runtime-Snapshot, kein UI** (~300 LOC, bleibt)
- `lib/morg-product.ts`, `lib/messenger-client-expert-mode.ts`

**Scope A Summe (praktisch):** ~22k LOC maintained; nach P0 Bundle deutlich kleiner, LOC unverändert.

---

## 2. Scope B — raus / lazy / Projekt-only

### 2.1 B0 — Projekt-only (nicht in `build:messenger` importieren)

| Datei | Zeilen | Maßnahme |
|-------|--------|----------|
| `views/lock-view.tsx` | 928 | Nur `projekt-dashboard` |
| `views/monitor-view.tsx` | 330 | Nur Projekt |
| `views/device-radar-view.tsx` | 129 | Nur Projekt |
| `views/worker-action-center-view.tsx` | 279 | Nur Projekt |
| `projekt-dashboard.tsx` | 533 | Separates Build |
| `workspace-projects-panel.tsx` | 56 | Projekt |

**Gate:** bereits `app/page.tsx` → nur eine Dashboard-Shell pro Build. Prüfen: keine transitive Imports aus `messenger-dashboard`.

### 2.2 B1 — Boss / Handoff (lazy pro View)

| Datei | Zeilen | Importiert von |
|-------|--------|----------------|
| `views/boss-view.tsx` | 588 | `messenger-dashboard`, `projekt-dashboard` |
| `views/config-view.tsx` | 272 | `messenger-dashboard`, `settings-system-identity` |
| `boss-handoff-export-panel.tsx` | 1178 | `boss-helfer-einrichten-panel` |
| `boss-device-provision-wizard.tsx` | 869 | `boss-handoff-export-panel` (Wizard) |
| `boss-helfer-einrichten-panel.tsx` | 27 | `einsatzleitung-view` (Boss) |
| `handoff-import-panel.tsx` | 676 | `settings-view` |
| `handoff-capabilities-matrix-picker.tsx` | 167 | handoff-export |
| `handoff-role-id-bit-picker.tsx` | 105 | handoff-export |
| `handoff-provision-registry-section.tsx` | 343 | handoff-export |
| `handoff-provision-result-dialog.tsx` | 131 | handoff-export |
| `lan-install-qr-panel.tsx` | 333 | handoff-export |
| `messenger-export-panel.tsx` | 37 | `workspace-projects-panel` (Projekt) |
| `dashboard-einsatz-konfiguration.tsx` | 347 | Boss-Home |
| `standalone-solo-wizard-card.tsx` | 183 | Dashboard-Home |

**Lib (mitziehen wenn B1-Komponente lazy):** `lib/handoff-export-*`, `lib/handoff-zip-*`, `lib/handoff-iota-*`, `lib/boss-provision-registry.ts`, … (~3.5k LOC)

### 2.3 B2 — Expert / On-Chain (lazy + `clientExpertMode` / `expertTools`)

| Datei | Zeilen | Importiert von |
|-------|--------|----------------|
| `chat-view-pulse-settings.tsx` | 1256 | `settings-system-identity-section` |
| `chat-view-relay-submit-button.tsx` | 817 | `chat-view-main-content` |
| `chat-view-tangle-inventory-button.tsx` | 542 | `chat-view-inbox-toolbar` |
| `chat-view-protokoll-anchor-button.tsx` | 459 | `chat-view-inbox-toolbar` |
| `peering-qr-actions.tsx` | 247 | pulse-settings, encrypted-partner, handshake-bar |
| `chat-view-morg-pkg-imports-sheet.tsx` | ~200 | main-content (Expert) |
| `chat-view-tangle-inventory-button.tsx` | 542 | toolbar |
| `settings-iota-direct-card.tsx` | ~150 | settings (IOTA sichtbar) |

**Lib (B2):** `lib/direct-iota-*` (~2.5k), `lib/tangle-inventory*.ts` (~600), `lib/tx-relay-queue.ts`, `lib/peering-qr.ts`

### 2.4 B3 — Einsatzleitung Boss-Erweiterung (lazy wenn Boss)

| Datei | Zeilen | Importiert von |
|-------|--------|----------------|
| `einsatzleitung-erweitert-panel.tsx` | 47 | `einsatzleitung-view` (Boss) |
| `einsatz-manifest-anchor-panel.tsx` | 547 | erweitert-panel |
| `einsatz-forensic-batch-panel.tsx` | 282 | erweitert-panel |

**Lib:** `lib/einsatz-manifest-*`, `lib/einsatz-forensic-*`, `lib/einsatzprotokoll-anchor*` (~1.8k LOC)

---

## 3. Grauzone (Entscheidung)

| Thema | Empfehlung | Begründung |
|-------|------------|------------|
| `PeeringQrActions` in Partner-Panel | **B2 lazy** (nicht ganz raus) | Handshake-Kern, aber QR-UI schwer |
| `chat-view-morg-pkg-*` | **B2** | Expert-Import |
| Telegram-Settings | **A** | Optionaler Kanal, klein |
| `CapacitorApiBaseCard` | **A** | Handy-Build |
| `use-chat-view-einsatz-exports.ts` | **A** | Kommandant Export ZIP im Chat |
| `lib/handoff-local-apply.ts` | **A (lib)** | Kein UI; Standalone-Bootstrap |

---

## 4. `dynamic()`-Plan (Reihenfolge)

Neues Modul: **`frontend/frontend/components/lazy/messenger-scope-b.ts`** — zentrale `next/dynamic`-Exports (`ssr: false`).

### Welle 1 — Dashboard-Views (größter Chunk, risikoarm)

**Datei:** `messenger-dashboard.tsx`

| Komponente | Scope | Wann laden | Geschätzte LOC aus Initial Bundle |
|------------|-------|------------|-----------------------------------|
| `BossView` | B1 | `activeView.type === 'boss'` | ~600 + boss-project |
| `ConfigView` | B1 | `activeView.type === 'config'` | ~270 |
| `EinsatzleitungView` | A shell / B3 nested | `activeView.type === 'einsatzleitung'` | ~800 mit Boss-Panels |

`ChatView`, `VaultView`, `SettingsView` bleiben **eager** (Helfer-Hot-Path).

### Welle 2 — Settings & Expert

| Stelle | Komponente | Gate |
|--------|------------|------|
| `settings-view.tsx` | `HandoffImportPanel` | `!slimMessengerEinsatz \|\| !isBossRole` |
| `settings-system-identity-section.tsx` | `ChatViewPulseSettings` | Collapsible geöffnet + `isIotaTransportUiVisible` |
| `settings-system-identity-section.tsx` | `ConfigView` embed | Link → lieber Navigation statt Embed (später) |
| `chat-view-main-content.tsx` | `ChatViewRelaySubmitButton` | `uiCaps.expertTools` |
| `chat-view-inbox-toolbar.tsx` | `ProtokollAnchor`, `TangleInventory` | `showIotaExpertInboxActions` |

### Welle 3 — Verschachtelte B1-Bäume

| Stelle | Komponente |
|--------|------------|
| `einsatzleitung-view.tsx` | `BossHelferEinrichtenPanel` → lazy |
| `boss-helfer-einrichten-panel.tsx` | `BossHandoffExportPanel` → lazy |
| `boss-handoff-export-panel.tsx` | Sub-Picker bleiben im gleichen Chunk (ein dynamic reicht) |
| `dashboard-messenger-boss-home.tsx` | `dashboard-einsatz-konfiguration` → lazy |

### Welle 4 — Peering & Morg-Pkg

| Stelle | Komponente |
|--------|------------|
| `chat-view-encrypted-partner-panel.tsx` | `PeeringQrActions` lazy wenn QR-Sektion offen |
| `chat-view-main-content.tsx` | `ChatViewMorgPkgImportsSheet` lazy |

### Welle 5 — Build-Gates (optional, CI)

- `webpack` `alias` / `null-loader` für B0-Dateien in `next.config.mjs` wenn `NEXT_PUBLIC_MORG_PRODUCT=messenger`
- Bundle-Diff CI: `build` vs `build:messenger` (Roadmap-Backlog)

---

## 5. Code-Muster

```tsx
// frontend/frontend/components/lazy/messenger-scope-b.ts
import dynamic from 'next/dynamic'

export const LazyBossView = dynamic(
  () => import('@/frontend/components/views/boss-view').then((m) => m.BossView),
  { ssr: false, loading: () => null }
)

export const LazyHandoffImportPanel = dynamic(
  () => import('@/frontend/components/handoff-import-panel').then((m) => m.HandoffImportPanel),
  { ssr: false, loading: () => null }
)
```

Expert-gated (erst rendern wenn Gate true — dann lädt Chunk):

```tsx
{uiCaps.expertTools ? <LazyChatViewRelaySubmitButton hideMenuTrigger /> : null}
```

---

## 6. Erfolgskriterien P0

| Metrik | Ziel |
|--------|------|
| Helfer öffnet Chat (kein Boss/Expert) | Kein Fetch von `boss-handoff-export-panel`, `pulse-settings`, `relay-submit` Chunks |
| `build:messenger` First Load JS | Messbar ↓ vs. Stand heute (Baseline in CI festhalten) |
| Boss öffnet Einsatzleitung | Handoff-Export lädt nach (<1s spürbar OK) |
| Expert-Mode an | Relay/Protokoll/Tangle Chunks nach Toggle |
| Tests | Bestehende Vitest grün; smoke manuell Boss-Home + Helfer-Chat |

---

## 7. Nicht in P0 (P1+)

- Split `use-chat-view-handle-send.ts`
- Split `use-chat-view-core.ts` / Port-Assembler
- `main-content` Hook-Extraktion
- Lib-Dateien ohne UI-Grenze (separate `lazy`-Loader pro Feature-Modul)

---

## 8. Umsetzungs-Checkliste

- [x] `lazy/messenger-scope-b.ts` anlegen
- [x] Welle 1: `messenger-dashboard.tsx` (BossView, ConfigView)
- [x] Welle 2: settings + main-content + inbox-toolbar
- [x] Welle 3: einsatzleitung Boss-Panels
- [x] Welle 4: peering / morg-pkg
- [ ] Manuell: Network-Tab Helfer vs Boss
- [ ] Optional: CI Bundle-Größen-Vergleich
