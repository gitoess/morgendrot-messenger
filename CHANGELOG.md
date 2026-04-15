# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert (manuell gepflegt; kein automatischer Diff).

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Repository / Bundles

- **Verkaufs-Messenger-Referenz:** `exports/Morgendrot-Messenger-verkauf/move-test/build/` aus dem Git-Index entfernt (336 Artefakte); lokal per `sui move build` reproduzierbar. `.gitignore`: `exports/**/move-test/build/`, IDE-Temporärdateien.

### Messenger (PWA)

- **Next / `@morgendrot/shared`:** Relative Imports unter **`src/shared/`** ohne **`.js`-Suffix** (z. B. `./bytes-base64`, `./opcodes`) — **Turbopack** (`next build`) löst sonst keine `.ts`-Datei für `./modul.js` auf.
- **§ H.1b:** ESLint-Feature-Grenzen **send ↔ attachments** ergänzt; **`lint:feature-boundaries`** lintet **`features/attachments`** mit — **`frontend/eslint.config.mjs`**, **`frontend/package.json`**.
- **§ H.1b:** Dashboard-Kachel-Whitelist (**§ H.17**) in **`lib/dashboard-workspace-tile-visibility.ts`** mit Vitest; **`dashboard.tsx`** ruft nur noch den Filter — **`features/README.md`**, **`docs/MESSENGER-UI-MODULARITY-STRATEGY.md`**.
- **§ H.17 (UI):** `UI_VARIANT=messenger` — Posteingang-**Boss-Übersicht** (`bossView`) ausgeblendet + State zurückgesetzt; **Geräte-Radar** nur noch für **Boss** (nicht Kommandant) im Messenger-Bundle — **`chat-view-inbox-toolbar.tsx`**, **`use-chat-view-core.ts`**, **`dashboard.tsx`**, **`device-radar-view.tsx`**, Kurz-Hinweis **`workspace-projects-panel.tsx`**.
- **§ H.17 (Kacheln):** Messenger-Bundle + **Boss** + Arbeitsbereich **`full`** → Dashboard-Kacheln nur **Nachrichten / Tresor / Steuerung** (`chat`, `vault`, `boss`); Zugang & Überwachung ausgeblendet — **`dashboard.tsx`**, Hinweis **`workspace-projects-panel.tsx`** (`liteMessengerBossFullTiles`).
- **§ H.15 / § H.12 — Mailbox-Warteschlange (Konflikt & Drain):** Statuszeilen nach Drain bei `failed>0` (inkl. gemischt mit `sent`); Banner **Backoff** + Kurztext letzte **`lastError`**; Sendepfad: **Dedup** vs. **Reject** aus **`enqueueOfflineMailboxFailure`** — **`use-chat-view-mirror-delay`**, **`use-chat-view-handle-send`**, **`chat-view-send-panel`**; Re-Export **`shouldDeferDrainAttempt`** / **`backoffMsForDrainAttempt`** aus **`offline-queue.ts`**.
- **SOS-Hilferuf (UI):** Sichtbare Kurzerklärung für **SOS — Hilferuf (Text)** und **SOS — Hilferuf (Sprache)**; `confirm`-Texte präzisieren Ziel (Chat/Mesh, **kein** 112) — **`chat-view-send-panel.tsx`**.
- **UX (Posteingang / Dashboard):** **Weiterleiten** — flache Menüeinträge, **Sonner-Toast**, Scroll zu **`#chat-composer-message`**; **Protokoll** — markierte Zeilen mit Rand + **Protokoll**-Badge; **Einsatz-Profil** im privaten Chat (**`chat-view-einsatz-profil-inline.tsx`**); **PWA + IOTA-Überweisung** auf dem Haupt-Dashboard (**`dashboard-pwa-install-card`**, **`dashboard-iota-transfer-card`**); Einstellungen mit Kurzverweis. **Einsatz-Rollen-Vorlagen:** Text „Geräte / Worker“.
- **§6.B.4 Stufe 1:** Posteingang **Klartext-Mailbox** per Fullnode (`fetchPlaintextMailboxInboxRows` / gemischter RPC, **`use-chat-view-inbox`**) ohne `/api/inbox`, wenn Snapshot/Flags wie Direkt-Klartext-Senden und Zeilen > 0; sonst weiter `/inbox`.
- **§6.B.4:** **`use-chat-view-inbox`** — **RPC vor API:** bei erreichbarem Direkt-Fullnode-Pfad zuerst Chain, **`/inbox`** parallel als Ergänzung; gleicher `dedupKey` → Chain-Eintrag gewinnt (Archive / Basis-Verzug).
- **§6.B.4 Stufe 2:** Posteingang **verschlüsselte Mailbox** (`MsgKey`) per Fullnode + Entschlüsselung im Client (**`tryFetchDirectMailboxInboxViaIota`**, Chat-ECDH); gemeinsam mit Klartext über **`fetchMailboxInboxRpcRows`**. Verschlüsselt nur mit **Direkt-Mailbox-Drain** (`localStorage`) wie Direkt-Submit.
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

- **§ H.17 (Begriffe):** Trennung **Volle Oberfläche** (`morgendrot_show_all_tiles`), **Arbeitsbereich Volldashboard** (`morgendrot_workspace_tile_set` = `full`), **Geräte-Radar** (`DeviceRadarView`, Messenger nur Boss), **Chat-Boss-Übersicht** (`bossView`); Zielbild Messenger vs. Hauptprojekt — **`docs/ROADMAP-FAHRPLAN.md`**, **`docs/UI-ROLLEN-WORKSPACES.md`** §6, **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`**.
- **§ H.18 (Roadmap) + TTS/STT:** Fahrplan-Eintrag **TTS / STT**; **`docs/MESSENGER-SPRACHAUFNAHME.md`** — Abschnitt *SOS-Hilferuf: Text vs. Sprache* und Verweis **§ H.18**; **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** — Nutzer-Kurzfassung mit Verweis auf Messenger-Doku.
- **§ H.17 (Roadmap):** Dashboard vs. **Volle Oberfläche** vs. Chat-**Boss-Ansicht** vs. **DeviceRadar**; Wanderer/Lite — Boss-Teile und Platzhalter-Kacheln später ausblendbar (**`docs/ROADMAP-FAHRPLAN.md`**).
- **§ H.16 (Roadmap):** Telefonbuch mit Klarnamen, QR Einlesen/Anzeigen, Boss-LAN-Onboarding (Helfer scannen Install-QR); kritische Leitplanken (HTTPS, Same-Origin, § H.12, **§ H.3b** QR-Schema); Verweis aus **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** § 6.
- **`docs/PWA-MANUAL-CHECKS.md`:** Protokoll-Tabelle chronologisch sortiert; doppelte **2026-03-28**-Zeile zu einer Eintragung zusammengeführt.
- **`docs/OPERATIONS-SNAPSHOT-2026-03.md`:** Nachtrag **2026-03-28** (Doku-Pflege, Verweis PWA-Protokoll / Handy vs. Schreibtisch).
- **`docs/PWA-HANDBUCH-OFFLINE.md`:** Absatz Sendeweg / **`morgendrot.iotaSubmitMode`**; § 6 Pflege um neue Handbuch-Dateien und **`sw.js`**.
- **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`:** Stufe **0–3** Erfolgskriterien um **Ist** / Verweise ergänzt.
- **`docs/MORGENDROT-CORE-PACKAGE-PLAN.md`:** Risiko-Abschnitt → Verweis **§ H.15** / **`SYNC-*`** § 8.
- **`CHANGELOG.md`:** neu — zentrale Stelle für Release- und Doku-Notizen neben **`docs/ROADMAP-FAHRPLAN.md`**.

### Qualität / Handy

- **Frontend-`tsc` / Core:** `direct-iota-encrypted-submit.test.ts` — `BigInt(1)` statt Literal `1n` (Target ES6); **`mailbox-inbox-mixed-rpc.ts`** — `nonce` aus Move-`fields` robust nach `bigint` (Record `unknown`). Ritual-Lauf siehe **`docs/TEST-RUN-LOGBOOK.md`** (2026-03-28).
- **Messenger vs. Ticket-Kachel:** **`TESTING.md`**, **`README.md`**, **`docs/HANDY-TEST-WINDOW.md`**, **`docs/TEST-RUN-LOGBOOK.md`**, **`docs/OPERATIONS-SNAPSHOT-2026-03.md`**, **`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`** — klar: **`test:messages*`** = Messenger-Smoke; **`test:tickets-accesskey-realworld`** (Alias **`test:realworld`**) = **andere Kachel**, nicht Teil des Messenger-Gates.
- **`docs/TEST-RUN-LOGBOOK.md`** — Troubleshooting **api version mismatch** nur Ticket-Skript; Log-Zeilen weiterhin getrennt pflegbar.
- **`scripts/run-messages-chat-realworld.ts`** — Abschlusshinweis auf separates Ticket-Skript.
- **`scripts/run-ticket-accesskey-realworld.ts`** — Kopfkommentar: empfohlener npm-Name **`test:tickets-accesskey-realworld`**.

### Hinweis (Fahrplan)

- Operative Reihenfolge und „nächste drei“ Arbeiten: **`docs/ROADMAP-FAHRPLAN.md`** (**§ C.0b**, **§ H.0–H.2**, **§ H.15**).
