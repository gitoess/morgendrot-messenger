# Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert (manuell gepflegt; kein automatischer Diff).

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Repository / Bundles

- **Verkaufs-Messenger-Referenz:** `exports/Morgendrot-Messenger-verkauf/move-test/build/` aus dem Git-Index entfernt (336 Artefakte); lokal per `sui move build` reproduzierbar. `.gitignore`: `exports/**/move-test/build/`, IDE-Temporärdateien.

### Messenger (PWA)

- **LoRa Klartext (LongFast):** Funk-Klartext **max. 200 Zeichen** gilt jetzt für **alle** unverschlüsselten Mesh-Sendungen (vorher nur privater Chat — öffentlicher Kanal konnte längere Texte senden und **TOO_LARGE** / Funkfehler provozieren). **`sendMeshText`:** bis zu **3 Versuche** mit Backoff bei transienten Routing-Codes **NO_ROUTE**, **MAX_RETRANSMIT**, **NO_RESPONSE** (`**`meshtastic-routing-error.ts`**`, **`use-meshtastic-ble.ts`**). Kurz-Checkliste PC: **`docs/LORA-PC-FIRST-SMOKE.md`**; Verweis in **`docs/MESHTASTIC-BUILDING-BLOCKS.md`**.
- **Mailbox-Klartext: Event vs. Persistent:** `localStorage` **`morgendrot.messagingPersistenceMode`** (`event` \| `mailbox`); Transport-Card **Nur Event** / **Mailbox** (nur Klartext + **online**). **`POST /api/command`:** Feld **`messagingPersistenceMode`**; **`sendPlaintextOnly`** / **`storePlaintextMessage`** mit **`forceLegacyPlaintext`** (Default **Legacy** = bisheriges Verhalten; **`mailbox`** → Mailbox-Store wenn Move/`.env` passen). **Terminal** `/send-plain` weiterhin explizit Legacy (**`wallet-bridge.ts`**). **Hybrid:** **`mailbox-send-hybrid.ts`**, **`chat-commands.ts`**, **`execute-command.ts`** (`buildApiCommandPostBody`), **`use-chat-view-core`**, **`send-transport-ports`**, **`chat-view-main-content`**, **`chat-view-transport-card`**. **Vitest:** **`messaging-persistence-mode.test.ts`**, **`execute-command.test.ts`**. **Spec:** **`docs/MESSAGING-MAILBOX-SSOT-SPEC.md`**. **Export-Spiegel:** `exports/Morgendrot-Messenger-verkauf/…` (**`messenger-chain-wrap`**, **`messenger-command-handler`**, **`wallet-bridge`**).
- **Anhang-Leiste — Pipeline-Hinweis:** optional **`attachmentPipelineHint`** + barrierefreier Status + Puls-Streifen (**`chat-view-attachment-bar.tsx`**, **`attachment-bar-port.ts`**, **`use-chat-view-attachments.ts`**, **`use-chat-view-core`**, **`chat-view-main-content`**).
- **LoRa-Bild (automatisch):** IOTA-`MORG_COMPACT_IMG_V1`-Anhang im **privaten verschlüsselten** Chat bei Transport **„funk“** wird per **`POST /api/compact-blob-to-lora-wires`** (Sharp: Kompakt → PNG → LUMA+CHROMA) und **`useChatViewAttachments`**-Effect in den LoRa-Zweiteiler umgewandelt; Senden bleibt bis dahin deaktiviert (**`chat-view-send-panel`**). **LoRa-Encode:** `sharp(..., { failOn: 'none' })`, kleinere Chroma-Layouts. **Sprachmemo:** unverschlüsselter Funk blockiert Senden mit Hinweis (**`meshKlartextVoiceBlocked`**). Neuer Anhang setzt **`loraOnlineFallbackOffer`** zurück (kein festhängender grauer Senden-Button).
- **Meshtastic / Web Bluetooth:** Rückgaben von `sendPacket` / `sendText` mit **`Routing.Error`** ausgewertet — verständliche Meldung plus **Aktions-Hinweis** (z. B. **NO_CHANNEL** → Kanal in der Meshtastic-App, **TOO_LARGE** → kürzen / LUMA+CHROMA oder online); **`TIMEOUT` (3)** beim Ausgang nicht als harter Fehler (**`meshtastic-routing-error.ts`**, **`use-meshtastic-ble.ts`**). **README:** Kurzüberblick Funk+Foto, Routing, lokales Mesh-Archiv, Filter „Nur LoRa/Mesh“.
- **Meshtastic Klartext (LongFast):** Senden **ohne** `/connect` bei **unverschlüsselt + „funk“** (Broadcast oder optional **Node-ID** `!…` im Composer); **öffentliche Pinnwand** ebenfalls per Funk-Klartext möglich. **Adressbuch:** optionale **Meshtastic Node-ID** beim Speichern eines 0x-Kontakts. **Next-Dev:** `dev`/`dev:lan` mit **`--webpack`** + Client-**`util`**-Shim für `@meshtastic/core`. **UI:** Abschnitt „Nachricht verfassen“, Transport-Hinweise (IOTA vs. Funk) angepasst; größere UI-Trennung → Roadmap **§ H.1b**.
- **§ H.15 — Zentraler Mailbox-Hybrid:** **`frontend/frontend/lib/mailbox-send-hybrid.ts`** (`sendPlaintextMailboxHybrid`, `sendEncryptedMailboxHybrid`) — **Direct (PTB + Signatur im Browser)** zuerst, **`/api`** als Fallback. Angebunden: **`use-chat-view-handle-send.ts`** (Composer + SOS-Mailbox + B2-Spiegel), **`use-chat-view-mirror-delay.ts`** (Mirror-Drain / Delayed-Mirror; Parameter **`mailboxRecipient`** aus **`use-chat-view-core.ts`**), **`use-chat-view-confirm-lora-online.ts`**, **`einsatzprotokoll-anchor.ts`**. **Chat-Kopf-Badge** unverändert (`getDirectIotaPathUiState`).
- **§ H.15 — Direkt zuerst, Relay fallback:** Mailbox-**Offline-Queue** versucht nach fehlgeschlagenem **Direct-IOTA**-Versand automatisch **`/api`** (Relay), wenn die Basis erreichbar ist — **`frontend/frontend/lib/api/offline-queue.ts`**. **Einstellungen:** Karte **„IOTA auf diesem Gerät“** mit Schalter **„Direkt mit IOTA verbinden“** (Default an) und Statuszeile (`getDirectIotaPathUiState`) — **`settings-view.tsx`**, **`direct-iota-plain-submit.ts`**. **Puls:** Text zu Direkt+Fallback und Verweis auf Einstellungen — **`chat-view-pulse-settings.tsx`**.
- **`GET /api/status`:** festes **Fetch-Timeout (10 s)** — ohne Timeout blieb `fetch` bei ausgeschaltetem Dev-PC/LAN oft sehr lange hängen; die Meldung **Basis/Backend offline** erschien erst spät auf dem Handy — **`frontend/frontend/lib/api/status.ts`**.
- **§ H.0 / § H.1 (UX):** Installierte PWA (**standalone**): bei Wechsel in den **Hintergrund** **`/vault-lock`** → erneutes Öffnen verlangt **Entsperren**; **letzte Kachel-Ansicht** (`chat`, Einstellungen, …) in **`sessionStorage`** über App-Neustart; Posteingang **„Absender ins Telefonbuch“** (**`POST /api/contact-label`**); Puls **Ketten-IDs speichern** mit Eingabe-Normalisierung + **`isLikelyIotaHexId`** — **`dashboard.tsx`**, **`chat-view-main-content.tsx`**, **`chat-view-inbox-list.tsx`**, **`chat-view-inbox-panel.tsx`**, **`chat-view-pulse-settings.tsx`**.
- **Next Dev:** **`allowedDevOrigins`** im **Host-**/`host:port`-Format (Doku **Next 16**); **`NEXT_ALLOWED_DEV_ORIGINS`** aus **Root-`.env`** als volle URL wird normalisiert — **`frontend/next.config.mjs`**, **`docs/DEV-START.md`**, **`.env.example`**.
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

### Server / API

- **LoRa-Kompaktbild robust:** **`prepareImageForLoRaRobust`** in **`src/lora-progressive-image.ts`** — schrittweises Verkleinern bis LUMA+CHROMA unter Funk-Limits; **`POST /api/compact-blob-to-lora-wires`** nutzt Robust-Pfad (**`src/api-server.ts`**).

### Qualität / Tests

- **§ H.1a:** Vitest **`morg-pkg-import-utils.test.ts`**, **`inbox-partner-filter.test.ts`** (Partner/Richtung/Maske); **`workspace-projects-panel-storage.test.ts`** (`readWorkspaceTileSet` / `writeWorkspaceTileSet`).
- **§ H.1a:** Vitest **`slide-wire.test.ts`** (`parseSlideFragmentMessage`, `MORG_SLIDE_V1`); **`mesh-qr.test.ts`** (`parseMeshBundleFromQrText`); RTL **`dashboard-iota-transfer-card.test.tsx`** (Mock **`transferCoins`**, Erfolg/Fehler).
- **§ H.1a:** Vitest **`chat-view-messenger-transport.test.ts`**, **`chat-wald-connection.test.ts`**, **`mesh-contact-verify.test.ts`**, **`device-detect.test.ts`** (`prefersFileCameraCapture`, UA/Touch-Heuristik).
- **§ H.1a:** Vitest **`chat-view-send-utils.test.ts`** (LoRa-UTF-8, Mesh vs. Kompakt-Blob, Standard-Wire inkl. Audio/SOS/Kompaktbild); RTL **`dashboard-pwa-install-card.test.tsx`** (Haupt-Dashboard PWA-Karte, `matchMedia` standalone).
- **§ H.1a:** Vitest **`package-id-compare.test.ts`** (**`normalizePackageIdHex`**, **`shouldShowPackageIdMismatchBanner`**); **`morg-emergency-v1-text.test.ts`** (SOS-Marker bauen/strippen, Fake-Timer); **`inbox-load-error.test.ts`** (Offline-Heuristik, **`formatInboxLoadError`**).
- **§ H.1a:** Vitest **`frontend/frontend/lib/format-unknown-error.test.ts`** — **`formatUnknownError`** (Error, String, JSON-Objekt, leeres `{}`, Zirkelreferenz, Primitives).
- **§ H.3n / § H.1a:** Vitest **`frontend/frontend/lib/morg-sos-mesh-retry.test.ts`**, **`morg-sos-ack-wire.test.ts`** (Backoff, **`MORG_SOS_ACK_V1`**-Parse). **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** — Abgleich-Block **§ H.3n** mit Ist-Pfaden erweitert.
- **`TESTING.md`:** Ritual **5c** (Hybrid/API-Touch → auch **`test:unit`** / **`execute-command.test.ts`**); SOS-Abschnitt verweist auf SOS-Lib-Tests.
- **`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`:** Ist-Zeile um SOS-Vitest ergänzt.

### Dokumentation

- **Roadmap § C.0b nach grünem `check:pwa-desk:full`:** **`docs/ROADMAP-FAHRPLAN.md`** — „nächsten drei“ auf **§ H.1a**, Gerät **L1–L5**, dann **§ H.15 Stufe 2** ausgerichtet; **`docs/TEST-RUN-LOGBOOK.md`**, **`docs/OPERATIONS-SNAPSHOT-2026-03.md`**, **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** § 0 Verweis.
- **Mailbox SSOT + README:** **`docs/MESSAGING-MAILBOX-SSOT-SPEC.md`**; **`README.md`** Startliste Punkt 2 verweist darauf (neben **`MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`**).
- **`docs/ROADMAP-FAHRPLAN.md`:** **§ H.15 Stufe 2** (Handy-Smoke) nach **Schreibtisch-/PWA-/Mailbox-**Scheiben **hinten**; **§ C.0b**-Kette und „nächsten drei“ angepasst; Mailbox-Nachtrag **Persistent** / **`forceLegacyPlaintext`**.
- **§ H.0 / PWA:** **`docs/ONBOARDING-WALLET-UX-SPEC.md`** § **2.2.1** (installierte PWA: Hintergrund-Sperre, Kachel-Wiederherstellung); **`docs/HANDY-TEST-WINDOW.md`**, **`docs/PWA-HANDBUCH-OFFLINE.md`**, **`docs/OPERATIONS-SNAPSHOT-2026-03.md`**, **`docs/MESSENGER-UI-MODULARITY-STRATEGY.md`** — Abgleich mit Ist-Code Messenger.
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
