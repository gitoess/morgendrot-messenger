# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert (manuell gepflegt; kein automatischer Diff).

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Repository / Bundles

- **Verkaufs-Messenger-Referenz:** `exports/Morgendrot-Messenger-verkauf/move-test/build/` aus dem Git-Index entfernt (336 Artefakte); lokal per `sui move build` reproduzierbar. `.gitignore`: `exports/**/move-test/build/`, IDE-Temporärdateien.

### Messenger (PWA)

- **§6.B.4 Stufe 1:** Posteingang **Klartext-Mailbox** per Fullnode (`fetchPlaintextMailboxInboxRows`, **`use-chat-view-inbox`**) ohne `/api/inbox`, wenn Snapshot/Flags wie Direkt-Klartext-Senden und Zeilen > 0; sonst weiter `/inbox`.
- **Puls / H.15:** Manuelle Ketten-IDs (Package, Mailbox, Absender) inkl. optional geschätzter Flags; **Chat-ECDH** (Peer-Pub in `localStorage`, JWK nur RAM) für verschlüsselten **Direkt-Mailbox-Drain** in der Offline-Warteschlange; **`@morgendrot/core`**: PTB **`store_encrypted_message`** (ohne Credits).
- **§ H.15 Stufe 0 — IOTA-Sendeweg:** Chat **Puls**-Einstellungen: Modus **Direkt (Standard)** vs. **Nur Morgendrot-API** (`localStorage` **`morgendrot.iotaSubmitMode`** = `relay` oder leer). Bei „Nur API“: kein Klartext-Mailbox-Upload per Fullnode; Offline-Queue und Drain berücksichtigen den Modus.
- **§ H.15 Stufe 2:** Smoke-/Feldprotokoll **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**; Vitest **`frontend/frontend/lib/direct-iota-plain-submit.test.ts`**; **`TESTING.md`** verweist darauf.
- **§ H.15 Stufe 3:** **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** § 8 (eine Wahrheit: Core + PWA-Adapter); Kommentar in **`frontend/frontend/lib/api/offline-queue.ts`**.
- **§ H.0:** Einstellungen → Karte **„Wallet & Session“** mit Handbuch-Links (**`settings-view.tsx`**).
- **§ H.2 / PWA:** **`sw.js`** **`morgendrot-sw-9`** — Offline-Fallback-Text an **Handy-first-Zielbild** vs. **Übergang** angeglichen; **`docs/DEV-START.md`**, **`app/offline/page.tsx`**. **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**: Leitsatz (4 Punkte) oben; **§ 6** Reihenfolge „Handy-only“ vs. Deploy.
- **§ H.15 Stufe 4:** Merge-Ritual **`TESTING.md`** Zeile **5c**; Root-/Frontend-Skript **`npm run test:h15-direct-submit`**; Anhang § 4 in **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**.
- **§ H.15 Stufe 3 (vertieft):** **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** § 8.1 (Retry/Backoff-**Ist**); **`docs/MORGENDROT-CORE-PACKAGE-PLAN.md`** Scheibe 4 Verweis.
- **§ H.1b:** **`SettingsWalletSessionCard`** (`settings-wallet-session-card.tsx`); **`docs/MESSENGER-UI-MODULARITY-STRATEGY.md`** Fortschritt **2026-04-28**.

### Dokumentation

- **§ H.16 (Roadmap):** Telefonbuch mit Klarnamen, QR Einlesen/Anzeigen, Boss-LAN-Onboarding (Helfer scannen Install-QR); kritische Leitplanken (HTTPS, Same-Origin, § H.12, **§ H.3b** QR-Schema); Verweis aus **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** § 6.
- **`docs/PWA-MANUAL-CHECKS.md`:** Protokoll-Tabelle chronologisch sortiert; doppelte **2026-03-28**-Zeile zu einer Eintragung zusammengeführt.
- **`docs/OPERATIONS-SNAPSHOT-2026-03.md`:** Nachtrag **2026-03-28** (Doku-Pflege, Verweis PWA-Protokoll / Handy vs. Schreibtisch).
- **`docs/PWA-HANDBUCH-OFFLINE.md`:** Absatz Sendeweg / **`morgendrot.iotaSubmitMode`**; § 6 Pflege um neue Handbuch-Dateien und **`sw.js`**.
- **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`:** Stufe **0–3** Erfolgskriterien um **Ist** / Verweise ergänzt.
- **`docs/MORGENDROT-CORE-PACKAGE-PLAN.md`:** Risiko-Abschnitt → Verweis **§ H.15** / **`SYNC-*`** § 8.
- **`CHANGELOG.md`:** neu — zentrale Stelle für Release- und Doku-Notizen neben **`docs/ROADMAP-FAHRPLAN.md`**.

### Qualität / Handy

- **Messenger vs. Ticket-Kachel:** **`TESTING.md`**, **`README.md`**, **`docs/HANDY-TEST-WINDOW.md`**, **`docs/TEST-RUN-LOGBOOK.md`**, **`docs/OPERATIONS-SNAPSHOT-2026-03.md`**, **`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`** — klar: **`test:messages*`** = Messenger-Smoke; **`test:tickets-accesskey-realworld`** (Alias **`test:realworld`**) = **andere Kachel**, nicht Teil des Messenger-Gates.
- **`docs/TEST-RUN-LOGBOOK.md`** — Troubleshooting **api version mismatch** nur Ticket-Skript; Log-Zeilen weiterhin getrennt pflegbar.
- **`scripts/run-messages-chat-realworld.ts`** — Abschlusshinweis auf separates Ticket-Skript.
- **`scripts/run-ticket-accesskey-realworld.ts`** — Kopfkommentar: empfohlener npm-Name **`test:tickets-accesskey-realworld`**.

### Hinweis (Fahrplan)

- Operative Reihenfolge und „nächste drei“ Arbeiten: **`docs/ROADMAP-FAHRPLAN.md`** (**§ C.0b**, **§ H.0–H.2**, **§ H.15**).
