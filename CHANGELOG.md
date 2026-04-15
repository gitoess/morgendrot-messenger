# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert (manuell gepflegt; kein automatischer Diff).

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Messenger (PWA)

- **§ H.15 Stufe 0 — IOTA-Sendeweg:** Chat **Puls**-Einstellungen: Modus **Direkt (Standard)** vs. **Nur Morgendrot-API** (`localStorage` **`morgendrot.iotaSubmitMode`** = `relay` oder leer). Bei „Nur API“: kein Klartext-Mailbox-Upload per Fullnode; Offline-Queue und Drain berücksichtigen den Modus.
- **§ H.15 Stufe 2:** Smoke-/Feldprotokoll **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**; Vitest **`frontend/frontend/lib/direct-iota-plain-submit.test.ts`**; **`TESTING.md`** verweist darauf.
- **§ H.15 Stufe 3:** **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** § 8 (eine Wahrheit: Core + PWA-Adapter); Kommentar in **`frontend/frontend/lib/api/offline-queue.ts`**.
- **§ H.0:** Einstellungen → Karte **„Wallet & Session“** mit Handbuch-Links (**`settings-view.tsx`**).
- **§ H.2 / PWA:** Handbuch-Sync um **`ONBOARDING-WALLET-UX-SPEC.md`**, **`RECOVERY-PHRASE-BACKUP.md`**; **`sw.js`** **`morgendrot-sw-6`** + **`HANDBOOK_URLS`**; Protokollzeile **2026-04-28** in **`docs/PWA-MANUAL-CHECKS.md`**.
- **§ H.15 Stufe 4:** Merge-Ritual **`TESTING.md`** Zeile **5c**; Root-/Frontend-Skript **`npm run test:h15-direct-submit`**; Anhang § 4 in **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**.
- **§ H.15 Stufe 3 (vertieft):** **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** § 8.1 (Retry/Backoff-**Ist**); **`docs/MORGENDROT-CORE-PACKAGE-PLAN.md`** Scheibe 4 Verweis.
- **§ H.1b:** **`SettingsWalletSessionCard`** (`settings-wallet-session-card.tsx`); **`docs/MESSENGER-UI-MODULARITY-STRATEGY.md`** Fortschritt **2026-04-28**.

### Dokumentation

- **`docs/PWA-MANUAL-CHECKS.md`:** Protokoll-Tabelle chronologisch sortiert; doppelte **2026-03-28**-Zeile zu einer Eintragung zusammengeführt.
- **`docs/OPERATIONS-SNAPSHOT-2026-03.md`:** Nachtrag **2026-03-28** (Doku-Pflege, Verweis PWA-Protokoll / Handy vs. Schreibtisch).
- **`docs/PWA-HANDBUCH-OFFLINE.md`:** Absatz Sendeweg / **`morgendrot.iotaSubmitMode`**; § 6 Pflege um neue Handbuch-Dateien und **`sw.js`**.
- **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`:** Stufe **0–3** Erfolgskriterien um **Ist** / Verweise ergänzt.
- **`docs/MORGENDROT-CORE-PACKAGE-PLAN.md`:** Risiko-Abschnitt → Verweis **§ H.15** / **`SYNC-*`** § 8.
- **`CHANGELOG.md`:** neu — zentrale Stelle für Release- und Doku-Notizen neben **`docs/ROADMAP-FAHRPLAN.md`**.

### Qualität / Handy

- **`docs/TEST-RUN-LOGBOOK.md`** — dokumentierter Lauf **2026-04-28** (Smoke, Frontend-, Core-, H.15-Vitest; Realworld teilweise wegen `locked` / zweiter API).
- **`docs/HANDY-TEST-WINDOW.md`** — wann die PWA **am Gerät** testen (nach grünem Schreibtisch + optional Realworld mit Unlock).

### Hinweis (Fahrplan)

- Operative Reihenfolge und „nächste drei“ Arbeiten: **`docs/ROADMAP-FAHRPLAN.md`** (**§ C.0b**, **§ H.0–H.2**, **§ H.15**).
