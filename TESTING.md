# Morgendrot – Funktions-Checkliste zum Testen

Alle Funktionen nacheinander testen und abhaken. Voraussetzung: Move-Package deployed, `create_globals` ausgeführt, `.env` mit PACKAGE_ID, VAULT_REGISTRY_ID, MAILBOX_ID, MY_ADDRESS (und ggf. PARTNER_ADDRESS). **Hinweis:** Nach **`npm install`** wird **`.env`** aus **`.env.example`** angelegt, falls noch keine existiert (`postinstall`).

**Fünf-Säulen-Strategie:** Siehe **docs/TEST-STRATEGY.md** (Unit, Move, Integration, KI-Validierung, Stresstest/Resilience). **Phase-A-Qualität (Baseline, Vitest, AppError):** **`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`** — **Fahrplan § H.1a**.

**Sicherheit, Vertrauen, schlanke Härtung (eigener Fahrplan, parallel zu Feature-Phasen):** **`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`** — **`docs/ROADMAP-FAHRPLAN.md`** § **H.10**; technische Layer-Bewertung weiter **`SECURITY-RATING.md`**.

**Offline-Karten / Geodaten (Zielbild, Backlog):** **`docs/OFFLINE-KARTEN-UND-GEODATEN-ZIELBILD.md`** — **`docs/ROADMAP-FAHRPLAN.md`** § **H.11** (mit **§ H.9** ATAK).

**Sync / Source of Truth (Offline vs. IOTA, Konflikte):** **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** — **`docs/ROADMAP-FAHRPLAN.md`** § **H.12** (mit Delayed-Upload-Spec und Offline-Queue-Kritik abgleichen).

**Merge-Ritual (Phase A, vor größeren PRs):** unten § **Qualitätsritual vor Merge** — deckt sich mit **`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`** Phase 1 und spiegelt **`.github/workflows/frontend-checks.yml`** (Frontend) plus Root-Smoke. **Pull Requests:** Checkliste in **`.github/pull_request_template.md`**.

**Protokoll (Architektur → Code, schrittweise):** Cold-Start / Geräte-Uhr — **`src/shared/device-time-trust.ts`** + Root-Test **`scripts/run-tests.ts`**; Spiegel **`frontend/frontend/lib/device-time-trust.ts`** + Vitest **`device-time-trust.test.ts`**; **`fetchStatus`** → **`pollClockHint`**; **`use-chat-view-api-status-poll`**: privater Chat → einmaliger **`navigator.geolocation.getCurrentPosition`** für **`hasTrustedGpsUtcFix`** (Nutzerdialog); Chat-Header **Warn-Banner**. Spec **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** §6; Fahrplan **§ H.6c**, **§ H.6e** (`.env` vs. Runtime). **Mailbox-Offline-Outbox (Entwicklung):** Opt-in **`localStorage.setItem('morgendrot.offlineMailboxQueue','1')`** — **`frontend/frontend/lib/api/offline-queue.ts`**, **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`** §5. *Nächster Schritt: Attestation-Queue mit „Zeit unsicher“ / Sparse-Luma.*

---

## Qualitätsritual vor Merge (Phase A)

**Ziel:** Gleiche Sicherheitsnetze wie in CI, plus Root-`tsc` und Modultests. Nach Änderungen unter **`frontend/frontend/`**, **`frontend/eslint.config.mjs`**, oder geteilten **`src/`**-Helfern **vor** Merge ausführen. **Optional `git tag -a`:** nur mit **ehrlicher** Kommandoliste — Schema in **`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`** Phase 1.

**Reihenfolge (lokal, Repo-Root):**

| # | Kommando | Zweck |
|---|-----------|--------|
| 1 | **`npx tsc --noEmit`** | Root-Typecheck |
| 2 | **`cd frontend`** dann **`npx tsc --noEmit`** | Next-/Messenger-`tsconfig` |
| 3 | **`npm run lint`** | ESLint Messenger-Baum (`features/send`↔`inbox`, …) |
| 4 | **`npm run check:circular`** | madge, Zyklen unter **`./frontend`** |
| 5 | **`npm run test:unit`** | Vitest (RTL + Lib-Tests); äquivalent von Root: **`npm run test:frontend-unit`** |
| 6 | *(zurück nach Root)* **`npm run validate:ui`** | UI-Referenzen |
| 7 | **`npm run test:smoke`** | `validate:ui` + **`npm run test`** (Modultests ohne Chain) |

**Inhaltliche** Änderungen an **`docs/BOSS-ORIENTIERUNG.md`** oder **`docs/PWA-HANDBUCH-OFFLINE.md`:** im Root **`npm run sync:handbook`** (oder **`npm run build`** im Ordner **`frontend/`** — **`prebuild`** sync’t). Siehe **`docs/PWA-HANDBUCH-OFFLINE.md`**.

---

## Smoke nach Merge (automatisch)

Empfohlene Reihenfolge ohne Chain:

1. **`npm run test:smoke`** — führt **`npm run validate:ui`** und **`npm run test`** aus (UI-Referenzen + Modultests). Optional danach **`npm run test:frontend-unit`** — Vitest im **Next-PWA** (`frontend/`: Dedup, Send-Validierung, `AppError`, API-Envelope/JSON-Guard, **`api-fetch-text`**, **`compact-image-wire`**, Kontakt-/Unlock-Envelope); siehe **`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`** § H.1a und Fuß „GitHub / Release-Notes“. **Frontend-Lint (Messenger-Grenzen):** im Ordner **`frontend/`** **`npm run lint`** — ESLint nur auf **`frontend/frontend/**/*.{ts,tsx}`** mit Regeln u. a. **`features/send` ↔ `features/inbox`** (`frontend/eslint.config.mjs`); bei größeren UI-Refactors oder vor Merge sinnvoll; in CI siehe **`.github/workflows/frontend-checks.yml`** (dort auch **`npm run check:circular`** / madge auf `./frontend`).
2. **Manuell:** Backend starten (`npm run start:secrets` oder `npm start`), **http://127.0.0.1:3342/** öffnen, Wallet entsperren, einen kurzen Befehl oder Tab prüfen.
3. **Mit Next:** `npm run dev` → **http://127.0.0.1:3341/** — Chat-Kachel: Credits-Balken erscheint, wenn **`MESSENGER_CREDITS_OBJECT_ID`** gültig ist und die API das Objekt lesen kann; Lock-Kachel: Statuszeile „Backend / Chat / Keys“. Optional: **`/handbook`** (Markdown-Handbuch; Produktion: SW-Cache) — siehe **`docs/PWA-HANDBUCH-OFFLINE.md`**. Vor Release/Feldtest: manuelle **PWA-Checks** (Install, Offline-Shell, Handbuch) — **`docs/PWA-MANUAL-CHECKS.md`** (Fahrplan **§ H.2**).
4. **Credits vs. MIST (kein Vermischen):** **`MESSENGER_CREDITS_OBJECT_ID`** bezieht sich auf **Messenger-Credits** (Tarif/Kontingent als Move-Objekt), **nicht** auf natives **Gas-Guthaben** (MIST) auf der Wallet. Kurz: **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`** §8. Smoke: **`GET /api/status`** (3342) — wenn Credits gesetzt und lesbar: Anzeige/Hinweise plausibel; in Support/UI nicht „Credits = IOTA“ gleichsetzen.
5. **Onboarding / Unlock (manuell):** Verifikations-Checkliste und Backlog **L1–L6** in **`docs/ONBOARDING-WALLET-UX-SPEC.md`** §3 und §6 — z. B. `locked` bis `/api/unlock`, bei **`SIGNER=sdk`** Mnemonic-Feld sichtbar; Shop-Adressfeld mit erwartbarem Verhalten bei **mit/ohne** `recipientIotaAddress` (Mint vs. Claim-Token).
6. **Recovery / Signer-Backup (optional):** Mit **`SIGNER=sdk`**, lokaler Vault **mit** gespeichertem Signer-Import — Einstellungen → **Wallet & Backup** → Passwort → Anzeige; API-Befehl **`/vault-show-signer-import`** (siehe **`docs/RECOVERY-PHRASE-BACKUP.md`**).

### Next-Messenger Chat – manuelle Checkliste (Port 3341)

Voraussetzung: Root **`npm run dev`** (API + Next), Tresor entsperrt, Adresse/Package wie in **`docs/DEV-START.md`**.

- [ ] **Transport-Badges:** Pro Posteingangszeile die erwarteten Symbole (**🌍** Internet/IOTA, **📡** Mesh/LoRa, **📱** Ad-hoc): aus `transports` der Nachricht bzw. Fallback **Internet** bei `source !== 'mesh'`, **Mesh** bei `source === 'mesh'`.
- [ ] **.morg-pkg (IOTA-Kontext):** Nachricht, die über Mailbox/IOTA angekommen ist → Kontextmenü **„ECDH .morg-pkg speichern“**; Toolbar **Import** und **Gerät → .morg-pkg**; nach Import erscheinen Einträge lokal sinnvoll (Dedup).
- [ ] **Verifizierung / „Verifiziert“:** **Mesh:** Shield-Icon nur, wenn der Absender im Kontaktverzeichnis mit Mesh gebunden ist (**nicht** on-chain-Protokoll-Verankerung – die bleibt Spec/offen, siehe **`docs/PROTOCOL-ANCHOR-VERIFY-SPEC.md`**).
- [ ] **Gesperrter Tresor:** `.morg-pkg` Import/Export und verschlüsseltes Senden zeigen die erwarteten Fehlermeldungen (Keys/Vault); kein stiller Fehlschlag.
- [ ] **Klartext-Modus (Pinnwand/privat unverschlüsselt):** Umschalten sichtbar; Senden nur mit gültigem Empfängerfeld wo die UI es verlangt; Hinweise aus **`/api/status`** (Klartext-Kanal, Konfiguration) konsistent mit dem Chat-Header/Transport-Karte.

### SOS / `MORG_EMERGENCY_V1` (B1–B2, automatisiert + manuell)

- **Unit (Root):** `npm run test` — enthält **`morg-emergency-v1-text`** (prepend/strip) und **`morg-sos-mesh-retry`** (Backoff, Cap bei `jitterRatio: 0`).
- **B2 Verhalten:** Mesh-SOS (Text/Sprache) wiederholt bei Funkfehler bis zu **5×** mit steigender Wartezeit. **Zwischen** den Funk-Versuchen: verschlüsselter **`/send`** (Mailbox) — bei **Erfolg** werden **keine** weiteren Funk-Wiederholungen für diesen Snap ausgeführt (Basis erreicht, Airtime). **Abschalten Ack-Stop:** `localStorage.setItem('morgendrot.sosRetryStopOnServerAck','0')`. Nach **erfolgreichem** Funk (ohne vorherigen Mailbox-Ack) weiterhin **IOTA-Spiegel**; **Abschalten Spiegel:** `localStorage.setItem('morgendrot.sosIotaMirror','0')`.
- **Optional (Gateway/Mesh-Ack):** Statt vollen **`/send`** nach Funkfehler zuerst leichtes **`/sos-gateway-ack`** (nur SHA-256 über den Wire-UTF-8, **kein** Mailbox-Eintrag): `localStorage.setItem('morgendrot.sosUseDedicatedGatewayAck','1')`. Nach **erfolgreichem** Funk optional auf **`MORG_SOS_ACK_V1`** vom Peer warten (ms, gecappt): `localStorage.setItem('morgendrot.sosWaitMeshAckMs','8000')` (`0` = aus). Eingehendes SOS automatisch per Mesh-Ack bestätigen: `localStorage.setItem('morgendrot.sosAutoMeshAckReply','1')`. Details: **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** §8.
- **Anzeige:** Posteingang (Mailbox) und Mesh-Klartext nutzen dieselbe Normalisierung — Inhalt mit SOS-Marker erscheint mit Präfix **`[SOS]`** statt Roh-`[[MORG_EMERGENCY_V1:…]]`; **`MORG_SOS_ACK_V1`** → **`[SOS-Bestätigung · …]`**. **Automatisiert:** `npm run test:unit --prefix frontend` — `chat-message-display-normalize.test.ts` (u. a. **MORG_COMPACT_IMG_V1**, **MF1** unverändert).

### Phase B — Mesh / Web-BT (Heltec, Schritt für Schritt)

**Ziel:** Stabilität **Senden/Empfangen** über **Web Bluetooth** vor Serial-/Protokoll-Erweiterungen (Fahrplan **`docs/ROADMAP-FAHRPLAN.md`** § **H.3**, **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** Phase B). **Voraussetzung:** **Android + Chrome** (Web Bluetooth); Heltec mit **Meshtastic** und **gleichem Kanal/PSK** wie Gegenstelle; **Antenne** montiert.

**Schritt 1 — Stack starten**

1. Root: API wie gewohnt (**`npm start`** oder **`npm run dev`** — siehe **`docs/DEV-START.md`**).
2. Next-Messenger: **`http://127.0.0.1:3341/`** (oder eure LAN-URL vom Handy aus — **HTTPS** bzw. gleiche Origin-Regeln für Web Bluetooth beachten).

**Schritt 2 — Koppeln**

1. Im Chat **Setup / Funk**: **Meshtastic verbinden** → Gerät wählen.
2. Bei Fehler: **Trennen** klicken (trennt GATT sauber), Heltec **kurz stromlos**, erneut verbinden.

**Schritt 3 — Kurztext (ein Wire)**

1. Transport **Funk/Mesh**, kurzer **verschlüsselter** Text ohne Anhang.
2. Erwartung: Status **Erfolg**; bei mehrteiligen v2-Bursts Fortschritt **„Mesh v2 x/y Pakete“**; zwischen Paketen kurze Pause (**ca. 80 ms**, `MESH_V2_BURST_INTER_PACKET_MS_DEFAULT` in **`frontend/frontend/lib/chat-view-mesh-send.ts`**).

**Schritt 4 — Empfang**

1. Zweites Gerät oder Gegenstation sendet; **Posteingang** zeigt **📡** / `source === 'mesh'`.
2. MF1-Fragmente: zusammengeführter Klartext ohne Dubletten.

**Schritt 5 — Bild (LUMA + CHROMA)**

1. Nur wenn Schritt 3–4 stabil: **Funk**, Bild anhängen, senden (zwei Phasen LUMA/CHROMA, jeweils ggf. mehrere v2-Pakete).
2. Bei Abbrüchen: zuerst **Abstand/LoRa**, dann BLE erneut koppeln; optional Pause zwischen Bursts in der Konstante erhöhen (nur zu Testzwecken).

**Schritt 6 — Regression**

1. **`npx tsc --noEmit`** im Ordner **`frontend/`** nach Mesh-Änderungen.
2. Spike **Web Serial Android** (**`docs/HELTEC-USB-SERIAL-VS-BLE-TRANSPORT.md`** § 5) **parallel** möglich — **blockiert** Mesh-MVP nicht.

**Posteingang: Richtung & Identität** — technische Referenz **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`**, UI-Ort **`docs/UI-NACHRICHTEN-STREAMS-ORT.md`**:

- [ ] **Alle / Eingang / Ausgang:** Gesendete Nachrichten erscheinen unter **Ausgang** und **Alle**; empfangene unter **Eingang** und **Alle** (nach Reload/Aktualisieren).
- [ ] **Selbstnachrichten** (an die eigene Adresse): in **allen drei** Filtern sichtbar.
- [ ] **Adresse:** Status liefert `myAddressFull` — Zuordnung Eingang/Ausgang darf nicht durch eine nur maskierte Kurzadresse allein fehlschlagen (siehe Architektur-Doku).

**Package-ID-Banner (Integration, 4 Checks)** — siehe **`docs/MESSENGER-PACKAGE-ID-BANNER.md`:**

- [ ] **1.** Posteingangs-Package-ID **leer** (Backend-Default): **kein** Banner, solange kein expliziter Filter gesetzt ist.
- [ ] **2.** Posteingangs-Feld = dieselbe ID wie **`/api/status`** → `packageId`: **kein** Banner.
- [ ] **3.** Posteingangs-Feld = **andere** gültige 0x64-Hex-ID als die Basis meldet: Banner **„Neue Protokoll-Version verfügbar“** erscheint unter dem Chat-Header.
- [ ] **4.** **„Jetzt updaten“**: Backend übernimmt Server-ID (`/set-package-id`), Posteingang lädt neu, Banner verschwindet (bei erfolgreichem Befehl).

**Messenger-Stapel (Boss-UI 3342):** Bedeutung aller Felder (Anzahl bis 2500/Lauf, PACKAGE-Verlauf, SIGNER) → **`docs/MESSENGER-EXPORT-FIELDS.md`**.

## Playwright Lite-UI & Messenger-UI

Die Projekte **`lite-ui`** und **`messenger-ui`** sprechen die **Lite-UI unter Port 3342** an. **Ohne laufende API** schlagen `page.goto` fehl oder Tests werden übersprungen.

**Ablauf:**

1. Terminal A: **`npm run dev:lite`** oder **`npm run start:secrets`** (API + statische `ui/` auf **3342**).
2. Terminal B: **`npm run test:ui:lite`** bzw. **`npm run test:ui:messenger`**  
   - Messenger-Suite: nur sinnvoll mit **`UI_VARIANT=messenger`** in der `.env` (Überschrift enthält „Messenger“).
3. Optional: **`UI_BASE_URL=http://127.0.0.1:3342`** setzen, wenn die UI auf einem anderen Host läuft.

**Hinweis:** `npm run test:ui` (Standard-Projekt **chromium**) nutzt per `playwright.config` oft **`npx serve ui` auf 3341** — das ist die **statische** `ui/` **ohne** API. Für echte API-Interaktion die Befehle oben mit laufendem Backend nutzen.

## Chain / Move-Paket (Abgleich)

- **`move-test`:** Bytecode mit **`cd move-test && iota move build`** erzeugen; **Publish** auf dem Netzwerk liefert eine neue **`PACKAGE_ID`** → in **`.env`** und ggf. **`.morgendrot-package-id`** eintragen.
- **Neue Entrypoints** (z. B. `store_plaintext_message_stored`, `purge_plaintext_mail_entry`, Messenger-Credits): Wenn die Node-App diese Aufrufe nutzt, muss das **deployte Package** dieselbe Logik enthalten — sonst schlagen Transaktionen fehl.
- **`MAILBOX_STORE_PLAINTEXT` / `MESSENGER_CREDITS_OBJECT_ID`:** `GET /api/status` liefert bei Widersprüchen **`configHints`** (z. B. `MAILBOX_ID` = `PACKAGE_ID`, fehlende Mailbox-ID trotz Klartext-Speicher-Flag). Next-Chat zeigt dieselben Hinweise.
- **Rebate-Liste:** `getMailboxRebateCandidates` paginiert Dynamic Fields (wie der Messenger-Fetch) und lädt Storage-Rebate in **50er-Batches** — große Mailboxen werden vollständiger erfasst.

## Roadmap Kunden-UI (Next)

Vereinbarung laut **`docs/DEV-START.md`** (*Zwei Oberflächen*): **Neues Messenger-KUX** primär in **`frontend/`**, Boss/Batch in **`ui/`**. Offene oder nächste Bausteine können z. B. sein: weitere Felder aus **`/api/status`**, Inbox-Verbesserungen, Schloss-spezifische Live-Signale — immer zuerst API erweitern, dann Next.

---

## Automatische Modultests (ohne Chain/CLI)

- **Ausführung:** `npm run test` bzw. `npx tsx scripts/run-tests.ts`
- **Getestet:**  
  - **crypto-layer:** ECDH Keypair, Shared Secret, AES-GCM Roundtrip  
  - **vault-local:** encryptUtf8ToPayload / decryptPayloadToUtf8 Roundtrip, Ablehnung zu kurzer Payload  
  - **replay-state:** acceptAndUpdate (monoton, pro Sender), load/save in Temp-Datei  
  - **load-secrets:** parseEnvText (KEY=VALUE, Kommentare, Quotes)  
  - **read-command-list:** loadOpenWordsFromFile (IV + AES-GCM, 64-Hex-Key), Ablehnung kurzer Key  
  - **chain-access:** buildHandshakeTransaction + assertSafeAddress (gültige 0x64-Hex, Ablehnung ungültiger Adresse)  
  - **config:** getConfigDisplay maskiert sensible Werte (z. B. REMOTE_SIGNER_TOKEN)
- **Nicht getestet (Simulation/Manuell):** Echte Chain-Calls (getVaultFromChain, hasValidAccessKey, hasValidTicket), IOTA-CLI, Remote-Signer, Lock/Messenger-E2E.
- **RAG:** `npm run test:rag` – Unit-Tests für rag-retrieval (cosineSimilarity, expandWithReferences, loadRagChunks, retrieveRelevantChunks mit Mock).
- **AI-Copilot API-Vertrag:** `npm run test:ai-copilot-api` – Integration: askAiCopilot mit Intent-Matcher (Transfer-Coins, Handshake, Create-Key, Hilfefrage).
- **KI Gefährliche Formulierungen:** `npm run test:ai-dangerous` – „Gehirn-TÜV“: Formulierungen wie „lösche alles“, „purge all“, „vault komplett löschen“ dürfen **nicht** zu /emergency-purge führen.
- **KI Real-World:** `npm run test:ai-realworld` – Phrase (z. B. „sende nachricht ‚ki läuft‘ an 0x…“) an /api/ai-copilot, Vorschlag (z. B. /handshake) per /api/command ausführen. Voraussetzung: App läuft, Wallet entsperrt.
- **KI Plan-Modus (Ollama):** In der UI „Als Plan (mehrere Schritte)“ aktivieren, Wunsch eingeben (z. B. „Richte alles für Gast 0x… ein und schick ihm einen Schlüssel für 2 Tage“). Ollama zerlegt in Schritte; pro Schritt „Schritt ausführen“ möglich. Voraussetzung: ENABLE_AI_COPILOT, OLLAMA_URL, Ollama läuft; API/App laufen.
- **KI Real-World alle Kacheln:** `TARGET_ADDRESS=0x<64 Hex> npm run test:ai-all-tiles-realworld` – Alle Kacheln/Funktionen (Anfang, Kanal, Chat, Nachsorge, Keys, Tickets, Hilfe) mit natürlichen Phrasen → KI → echte TX. Holt `packageId`/`myAddress` aus `/api/current-ids`, optional `UNLOCK_PASSWORD`, optional zweite Adresse per `/api/generate-address` (Boss). Optional: `LOCK_ID=0x…`, `API_BASE=http://127.0.0.1:3342`.
- **Festival Real-World:** `npm run test:festival-realworld` – Szenario Festivalbetreiber: KI-Befehle für Handshake, Connect, 2× create-ticket (Metadaten: fiktive Namen, Sitzplatz, Preis), Einladung per send-plain an Wallet `0x2070…eb8`. Optional: `UNLOCK_PASSWORD=…`, `API_BASE=…`, `EVENT_ID=0x…` (sonst Platzhalter).
- **Sicherheit:** `npm run test:security` – setEnvKey-Blocklist (OPEN_COMMAND, OPEN_URL, … nicht per API setzbar), Adress-Validierung (ungültige/unsichere Werte abgelehnt).
- **Stresstest:** `npm run test:stress` – GET /api/status und POST /api/command (/help) gegen laufende API; Dauer und Base per `--duration`, `--base`; Schwellen p95 &lt; 2 s, 0 % Fehler.
- **Move:** `npm run test:move` – `iota move test` im Ordner move-test (IOTA-CLI nötig; aktuell keine #[test]-Funktionen in messaging.move).
- **UI-Browser:** `npm run test:ui` – Playwright-Tests (Standard: statisches `serve ui` auf 3341, **ohne** API). Für **API + Lite-UI auf 3342** siehe Abschnitt **Playwright Lite-UI & Messenger-UI** oben. Ggf. `npm run test:ui:install` (Chromium).
- **Smoke:** `npm run test:smoke` – `validate:ui` + Modultests (schneller Gate nach größeren Änderungen).
- **E2E Replay:** `npm run test:replay-e2e` – sendet zweimal „open“ an LOCK_ADDRESS (siehe Abschnitt E2E Replay).
- **Simulation OPEN_COMMAND:** `OPEN_COMMAND="node scripts/simulate-open-env-check.js"` setzen; Lock mit „open“ auslösen. Bei Erfolg wird `.open-env-check-result` mit `OPEN_SENDER` und `ok: true` geschrieben (Exit 0).

---

## Kacheln-Test (9 Tiles, 2 Wallets)

- **Ausführung:** `npm run test:kacheln` (oder `npm run test:all-tiles`).
- **Voraussetzung:** Zwei laufende Morgendrot-Instanzen mit unterschiedlichen MY_ADDRESS; Instanz A mit gültiger PACKAGE_ID (0x + 64 Hex).
- **Konfiguration:** Datei **`.env.kacheln`** im Projektroot (wird automatisch geladen):
  - **Wallet 1** (UI z. B. http://127.0.0.1:3341/): API standardmäßig **3342** → `API_BASE_A=http://127.0.0.1:3342`
  - **Wallet 2** (UI z. B. http://127.0.0.1:3344/): API auf **3345** setzen → `API_BASE_B=http://127.0.0.1:3345`
- **Zweite Instanz starten:** In einem zweiten Ordner/Kopie oder mit gesetzten Ports: `UI_PORT=3344 API_PORT=3345` (und eigene .env mit zweiter MY_ADDRESS, gleiche PACKAGE_ID z. B. per `/set-package-id` aus Instanz A).
- Optional: `UNLOCK_PASSWORD=…` in .env.kacheln, dann werden beide Wallets vor den Tests entsperrt; sonst ggf. Freigaben im UI bestätigen.

---

## Unverschlüsselte Testnachricht (lokal, ohne Chain)

**Hinweis:** On-Chain werden Nachrichten immer verschlüsselt (E2E). Zum Testen des Schreibvorgangs ohne Verschlüsselung und ohne Chain kannst du eine **lokale Klartext-Nachricht** in eine Datei schreiben.

### Anleitung

1. **Im Projektordner** (z. B. `c:\Users\damast\Desktop\morgendrot`) im Terminal ausführen:

   ```bash
   npm run test:message
   ```
   Schreibt die Standard-Testnachricht nach `test-message.txt`.

2. **Eigene Nachricht:**

   ```bash
   npm run test:message -- "Hallo, das ist mein Test"
   ```
   oder direkt:
   ```bash
   npx tsx scripts/write-test-message.ts "Deine Nachricht"
   ```

3. **Andere Datei:** Umgebungsvariable setzen, dann Aufruf wie oben:
   ```bash
   set TEST_MESSAGE_FILE=logs\meine-testnachricht.txt
   npm run test:message -- "Test"
   ```
   (PowerShell: `$env:TEST_MESSAGE_FILE="logs\meine-testnachricht.txt"`)

4. **Prüfen:** Inhalt von `test-message.txt` ansehen (Zeile = Timestamp + Nachricht). Jeder Aufruf **hängt** eine Zeile an.

Das Skript nutzt keine Chain und keine Verschlüsselung; es dient nur dazu, das „Schreiben einer Nachricht“ (lokal) zu verifizieren.

---

## Optional: Klartext-Kanal (Test/Demo)

Verschlüsselte Nachrichten bleiben unverändert (E2E). Zusätzlich kann ein **öffentlicher Klartext-Kanal** ein- oder ausgeschaltet werden.

- **Vorteile:** Bestehendes System bleibt sicher (verschlüsselt); bewusst öffentlicher Kanal für Test/Demo; Explorer zeigt Klartext sofort.
- **Aktivierung:** In `.env` setzen: `ENABLE_PLAINTEXT_CHANNEL=true`
- **Verhalten:** Beim Senden wird weiterhin verschlüsselt gespeichert/gesendet; **zusätzlich** wird ein Klartext-Event emittiert (gleiche Nachricht, gleicher Nonce). Im Chat erscheinen empfangene Klartext-Events mit dem Präfix `[Klartext]`.
- **Hinweis:** Nach Contract-Update (neue Funktionen `send_plaintext_message` / `store_plaintext_message`) Package neu deployen.

---

## Klartext-TX testen (End-to-End)

So testest du den optionalen Klartext-Kanal (Events im Explorer sichtbar, Lock kann „open“ auch aus Klartext ausführen).

**Wichtig:** Für Klartext (und für Nachrichten insgesamt beim *Empfang*) ist **kein Handshake nötig**. Du kannst Klartext an **beliebige Adressen** senden – an dich selbst, an Wallets ohne App (wo gar kein Handshake möglich ist). Optional: **kleinen IOTA-/Nano-Betrag** mitsenden und als **Coin-Überweisung** nutzen (Nachrichtenträger).

### Voraussetzungen

- Move-Package **neu gebaut und deployed** (mit `send_plaintext_message` / `store_plaintext_message`).
- Mindestens eine Instanz (Messenger). Zum Testen reicht **eine** App: z. B. Klartext **an die eigene Adresse** senden und im Explorer prüfen. Optional: Lock oder zweiter Messenger.

### 1. Klartext-Kanal aktivieren

In **beiden** .env (Messenger + Lock):

```env
ENABLE_PLAINTEXT_CHANNEL=true
```

Optional (Lock): Whitelist setzen, damit nur bestimmte Sender OPEN auslösen können:

```env
AUTHORIZED_SENDERS=0x...KeyHolderAdresse
```

### 2. Messenger: Nachricht senden

- Messenger starten: `npx tsx src/wallet-bridge.ts`
- Handshake zu Partner/Lock: `/handshake 0x…` bzw. `/connect 0x…`
- Im Chat eine Nachricht eingeben und absenden (z. B. `Hallo` oder `open`).

**Erwartung:** Es wird wie bisher **verschlüsselt** gesendet; **zusätzlich** wird ein **PlaintextMessage**-Event emittiert (gleiche Nachricht, gleicher Nonce).

### 4. Explorer prüfen

- Im [Explorer](https://explorer.iota.org) (Testnet) die letzte TX der eigenen Adresse öffnen.
- Unter **Events** nach `PlaintextMessage` suchen (Module: `messaging`).
- Dort sollten `sender`, `recipient`, `text` (Klartext) und `nonce` sichtbar sein.

### 5. Lock: OPEN per Klartext

- Lock mit `ENABLE_PLAINTEXT_CHANNEL=true` und ggf. `AUTHORIZED_SENDERS` starten.
- Key-Halter sendet **verschlüsselt** `open` (wie bisher) → Lock entschlüsselt und führt OPEN aus.
- **Zusätzlich:** Key-Halter kann (wenn du eine zweite TX nur für Klartext machst) **nur** ein Klartext-Event senden. Dafür müsstest du aktuell die gleiche App nutzen (sie sendet immer beides, wenn der Kanal an ist).  
  **Erwartung:** Lock empfängt auch **PlaintextMessage**-Events; wenn der Inhalt ein Öffnen-Wort ist (z. B. `open`) und Sender AccessKey + Whitelist (falls gesetzt) + Replay OK hat → Log: `OPEN GRANTED [Klartext]` und OPEN_COMMAND/OPEN_URL wird ausgeführt.

### 6. Chat: Klartext anzeigen

- Zwei Messenger mit `ENABLE_PLAINTEXT_CHANNEL=true`, Handshake zwischen beiden.
- Einer sendet eine Nachricht.
- Beim anderen erscheint die **entschlüsselte** Nachricht wie gewohnt und **zusätzlich** eine Zeile mit Präfix `[Klartext]` (gleicher Inhalt, aus dem Event). So siehst du, dass der Klartext-Kanal ankommt.

### Kurz-Checkliste

- [ ] Move build + Deploy mit neuen Entry-Funktionen
- [ ] **Ohne Handshake:** `/send-plain 0x… Text` (z. B. an eigene Adresse) → im Explorer `PlaintextMessage` sichtbar
- [ ] Optional: `ENABLE_PLAINTEXT_CHANNEL=true` in .env (Messenger + Lock) für zusätzlichen Klartext beim Chat
- [ ] Lock: OPEN (verschlüsselt oder Klartext) → `OPEN GRANTED` bzw. `OPEN GRANTED [Klartext]`
- [ ] Optional: `AUTHORIZED_SENDERS` gesetzt → nur diese Adressen können OPEN auslösen
- [ ] Optional: Kleinen IOTA-Betrag mitsenden und als Coin-Überweisung (Nachrichtenträger) nutzen

---

## So gehst du vor (Schritt für Schritt)

1. **Terminal** im Projektordner öffnen: `c:\Users\damast\Desktop\morgendrot`
2. Pro **Abschnitt** (Voraussetzungen → 1 → 2 → …) die Punkte der Reihe nach abarbeiten.
3. Wenn etwas **erledigt** ist: in dieser Datei `- [ ]` durch `- [x]` ersetzen.
4. Bei **Fragen oder Fehlern**: Stopp, Fehlermeldung notieren – dann können wir gezielt weitermachen.

---

## Voraussetzungen (einmalig)

- [x] **Move:** `cd move-test && iota move build` erfolgreich *(im Ordner move-test ausführen!)*
- [ ] **Deploy:** Package publiziert, PACKAGE_ID in .env (oder .morgendrot-package-id)
- [ ] **Shared Objects:** `create_globals` aufgerufen, VAULT_REGISTRY_ID + MAILBOX_ID in .env
- [ ] **IOTA-CLI + Wallet** (bei SIGNER=cli) auf diesem Rechner installiert, MY_ADDRESS = Wallet-Adresse

---

## 1. Start & Konfiguration

- [x] **Start:** `npx tsx src/wallet-bridge.ts` (oder `start.cmd`) startet ohne Absturz
- [x] **Passwort:** Bei SIGNER=cli erscheint „Wallet-Passwort (IOTA Rebased):“ und Eingabe ist maskiert (*)
- [x] **Konfigurationsblock:** Nach Start werden .env-Werte angezeigt (sensible maskiert)
- [x] **Befehls-Hinweis:** /handshake, /connect, /set-package-id, /exit, /help werden ausgegeben

---

## 2. Terminal-Befehle (vor Chat)

- [x] **/help** — zeigt Befehlsliste
- [x] **/set-package-id 0x…** — setzt PACKAGE_ID und speichert in .morgendrot-package-id (beim nächsten Start geladen)
- [x] **send handshake to 0x…** (oder **/handshake 0x…**) — sendet Handshake an Adresse; Partner wird in .morgendrot-partner gespeichert
- [x] **/connect 0x…** — wartet auf Handshake von dieser Adresse, dann Chat startet (oder /connect ohne Adresse = letzter Partner aus .env/.morgendrot-partner)
- [x] **/exit** — beendet die App

---

## 3. Handshake & Chat (zwei Instanzen / zwei PCs)

- [x] **PC1:** Handshake an PC2 senden: `/handshake 0x…PC2` oder `send handshake to 0x…PC2`
- [x] **PC2:** `/connect 0x…PC1` — findet Handshake, Chat startet
- [x] **Nachricht senden:** Freitext eingeben, Enter → wird verschlüsselt gesendet
- [x] **Nachricht empfangen:** Auf der anderen Seite erscheint die entschlüsselte Nachricht
- [x] **Partner gespeichert:** Nach /connect oder Handshake an Adresse steht diese in .morgendrot-partner

---

## 4. Chat-Befehle (im Chat-Modus)

- [ ] **/vault-save** — (wenn VAULT_FILE gesetzt) fragt „Keys in lokalen Vault speichern? (j/n)“; bei j werden Keys in VAULT_FILE gespeichert
- [ ] **/purge-handshake** — (wenn Mailbox) purgt Handshake in der Mailbox
- [ ] **/purge-msg &lt;nonce&gt;** — (wenn Mailbox) purgt Nachricht mit dieser Nonce
- [ ] **/vault-onchain** — (wenn VAULT_REGISTRY_ID) speichert Vault on-chain (TTL)
- [ ] **/emergency-purge** — (wenn VAULT_REGISTRY_ID) Notfall-Purge Vault
- [ ] **/emergency-purge-key &lt;keyObjectId&gt;** — AccessKey: Notfall-Purge aktivieren (Besitzer)
- [ ] **/purge-key &lt;keyObjectId&gt;** — AccessKey löschen (Rebate ~90–99 %)
- [ ] **/create-key &lt;lock&gt; &lt;recipient&gt; [ttl]** — erstellt einen AccessKey-NFT für Schloss an recipient
- [ ] **/create-keys &lt;lock&gt; &lt;recipient&gt; [ttl] [anzahl]** — mehrere Keys (ttl optional, DEFAULT_KEY_TTL_DAYS)
- [ ] **/help** — zeigt Chat-Befehle
- [ ] **/exit** (oder `exit`) — verlässt Chat, zurück zur Befehlszeile

---

## 5. Lock (ROLE=lock)

- [ ] **.env Lock:** ROLE=lock, LOCK_ID=0x…, MY_ADDRESS=0x… (Schloss-Adresse), VAULT_FILE und REPLAY_STATE_FILE gesetzt
- [ ] **Start Lock:** `npx tsx src/wallet-bridge.ts` (oder nur tur-Ordner) — Passwortabfrage, dann „Schloss aktiv … Warte auf Handshakes und open-Befehle“
- [ ] **Handshake an Schloss:** Von einem Key-Halter Handshake an LOCK_ID senden
- [ ] **AccessKey:** Für denselben Key-Halter einen Key ausstellen: `/create-key 0x…Lock 0x…KeyHolder 30`
- [ ] **„open“ senden:** Key-Halter sendet verschlüsselt „open“ (oder „öffnen“) an das Schloss
- [ ] **OPEN GRANTED:** Schloss loggt „OPEN GRANTED“, optional OPEN_COMMAND/OPEN_URL ausgeführt
- [ ] **Ohne AccessKey:** Sender ohne gültigen Key → „OPEN verweigert … hat keinen gültigen AccessKey“
- [ ] **Replay:** Gleiche Nonce erneut → „OPEN abgelehnt (Replay)“ (wenn REPLAY_STATE_FILE gesetzt)

---

## 6. Signer-Varianten (optional)

- [ ] **SIGNER=sdk:** .env SIGNER=sdk, MY_ADDRESS leer; Start: zuerst Mnemonic (24 Wörter, maskiert), dann Passwort; Verbindung und Senden funktionieren ohne IOTA-CLI
- [ ] **SIGNER=remote:** .env SIGNER=remote, REMOTE_SIGNER_URL=…, MY_ADDRESS=0x…; Boss-Service läuft; App sendet TX zum Signieren an Boss, Ausführung per SDK

---

## 7. Boss-Skripte (optional)

- [ ] **Boss-Signer:** `npm run boss-signer` startet HTTP-Service (POST /sign); mit REMOTE_SIGNER_URL erreichbar
- [ ] **Boss-Provision-Handshake:** `npx tsx scripts/boss-provision-handshake.ts --address 0x…A --partner 0x…B --pubkey <base64>` sendet Handshake von A an B (Boss signiert)

---

## 8. Schutz-Optionen (sicherheitsrelevant)

- [ ] **ENABLE_LISTENER=false** — Listener aus; Lock reagiert nicht auf OPEN, Messenger empfängt keine neuen Nachrichten (nach Neustart)
- [ ] **ENABLE_AUTO_EXECUTE=false** — Lock: „open“ nur geloggt, nicht ausgeführt
- [ ] **AUTHORIZED_SENDERS=0x…** — Nur diese Adresse(n) dürfen Auto-Befehle auslösen (Lock: zusätzlich AccessKey)
- [ ] **REPLAY_STATE_FILE** gesetzt — Replay-Schutz persistent; nach Neustart keine doppelte OPEN-Nonce

---

## 9. Sicherheit & SPOF (siehe README Abschnitt Sicherheit)

- [ ] **SPOF verstanden:** Seed (bzw. Zugang zum Wallet) = einziger SPOF; Wallet-Passwort schützt Vault und CLI-Signatur
- [ ] **Kein Shell bei Signatur:** Signatur erfolgt über `spawn('iota', ...)` ohne shell
- [ ] **OPEN_COMMAND/OPEN_URL:** Nur aus .env, kein Nutzerinput; spawn ohne shell
- [ ] **Adressen:** Nur 0x+hex oder bech32, validiert (kein Command-Injection)

Wenn du eine Zeile abgehakt hast, ersetze `- [ ]` durch `- [x]` in dieser Datei.

---

## Welche Tests fehlen noch? (Empfehlung)

**Bereits gut abgedeckt:** Modultests (`npm run test`), UI-Refs (`validate:ui`), KI-Intent + natürliche Sprache (`test:ai-coverage`, `test:ai-natural`), API + Commands (`test-all-projects-full`), 9 Kacheln + Szenarien mit 2 Wallets (`test:all-tiles`, `test:scenarios`), Ticket/Key-Flow (`test:tickets-keys`), verbleibende Lücken (`test:remaining`). Siehe **scripts/TEST-COVERAGE.md** und **scripts/TEST-PLAN-REITER.md**.

**Sinnvolle Ergänzungen (Priorität):**

| Priorität | Was | Warum |
|-----------|-----|--------|
| **Hoch** | **RAG-Retrieval Unit-Test** | ✅ **Umgesetzt:** `npm run test:rag` (scripts/run-rag-retrieval-test.ts). Testet cosineSimilarity, expandWithReferences, loadRagChunks mit Fixture, retrieveRelevantChunks mit Mock-Embedding. |
| **Hoch** | **POST /api/ai-copilot** (Integration) | ✅ **Umgesetzt:** `npm run test:ai-copilot-api` (scripts/run-ai-copilot-api-test.ts). Ruft askAiCopilot mit gleichem Vertrag wie die API; prüft Transfer-Coins, Handshake, Create-Key, Hilfefrage, leere Nachricht (Intent-Matcher, ohne Ollama). |
| **Mittel** | **Intent-Matcher Randfälle** | Die 11 fehlschlagenden Phrasen in `test:ai-coverage` gezielt angehen (Synonyme wie „package setzen auf“, „ecdh schlüsseltausch“, „backup der keys“, „zutritt für 0x…“, `/create-keys` vs. `/create-key`, `/emergency-purge-key`) – entweder Matcher erweitern oder Erwartung anpassen. |
| **Mittel** | **Move-Package-Tests** | Falls im Move-Projekt (`move-test/`) Tests existieren oder hinzugefügt werden: in CI/`npm run test` erwähnen oder separater Befehl `npm run test:move`. |
| **Niedrig** | **UI-Browser-Tests** | Playwright/Cypress für kritische Flows (Passwort-Overlay, Tab „Chat“, Befehl ausführen). `validate:ui` prüft nur Daten, nicht Klick/Submit. |
| **Niedrig** | **Ollama/RAG E2E (optional)** | Stichprobe mit `ENABLE_AI_COPILOT=true` und `OLLAMA_URL`: 3–5 Phrasen an `askAiCopilot` mit `useOllama: true`, prüfen auf ACTION oder sinnvollen Text. Nur wenn Ollama in CI/Umgebung läuft. |
| **Niedrig** | **Sicherheits-Tests** | Zusätzlich zu setEnvKey-Blocklist: Prüfen, dass Nutzerinput nie in OPEN_COMMAND/OPEN_URL landet; Adress-Validierung bei allen Befehlen (z. B. ungültige 0x…). |

**Nicht zwingend:** Last-/Stress-Tests, vollständige E2E mit echter Chain in CI (bereits realworld-Skripte für manuell/Staging). **POST /api/restart** bewusst nicht automatisiert.

---

## Sicherheit, Stresstest, was noch fehlt

### Sicherheit (bereits getestet vs. sinnvolle Ergänzungen)

| Thema | Bereits abgedeckt | Noch sinnvoll |
|-------|-------------------|----------------|
| **OPEN_COMMAND / OPEN_URL** | `npm run test`: `setEnvKey` blocklist – OPEN_COMMAND, OPEN_URL, REMOTE_SIGNER_*, WALLET_PASSWORD dürfen nicht per API gesetzt werden. | Optional: expliziter Test, dass bei OPEN-Ausführung nur Werte aus .env verwendet werden (kein Nutzerinput). Code ist bereits so: `executeOpenAction` nutzt nur `CFG.OPEN_COMMAND` / `CFG.OPEN_URL`; spawn mit `shell: false`. |
| **Adress-Validierung** | `npm run test`: `buildHandshakeTransaction('invalid', …)` wirft; nur 0x+64 Hex oder bech32 erlaubt. | **test:security:** Weitere ungültige Werte (Shell-Metazeichen, zu kurz/lang, Sonderzeichen) → alle müssen abgelehnt werden. |
| **Config** | Zeilenumbrüche in setEnvKey-Werten verboten; sensible Werte in getConfigDisplay maskiert. | – |
| **Replay** | acceptAndUpdate: gleiche Nonce pro Sender abgelehnt; Replay-State-Datei mit chmod 600. | Optional: E2E Replay (zwei gleiche OPEN-Nonce) nur manuell/Staging. |
| **Befehls-Argumente** | Adress-Args laufen über chain-access → `assertSafeAddress`. Ungültige Adresse → Fehler vor Chain-Call. | Optional: Integrationstest POST /api/command mit ungültiger Adresse → 500/Fehlermeldung, kein Aufruf von OPEN. |

**Empfehlung:** `npm run test:security` ausführen (siehe unten). Damit sind Blocklist + Adress-Validierung abgedeckt.

---

### Stresstest (Last / Stabilität)

Es gibt **keine** eingebauten Stresstests. So kannst du sie ergänzen:

1. **Einfach (ohne Tool):**  
   Schleife z. B. 100–500× `GET /api/status` oder `POST /api/command` (z. B. `/help`) gegen laufende Instanz; prüfen auf Absturz und konsistente Antwortzeiten. Beispiel (PowerShell):  
   `1..100 | % { Invoke-RestMethod -Uri http://127.0.0.1:3342/api/status }`

2. **Mit k6 oder Artillery:**  
   - **k6:** Script mit mehreren virtuellen Usern, die in Schleife `/api/status`, `/api/command` (z. B. `/help`) aufrufen; Lauf 1–5 Minuten, Schwellenwerte für p95 Latenz und Fehlerrate.  
   - **Artillery:** Ähnlich; YAML-Szenario für die gleichen Endpunkte.

3. **Was sinnvoll zu belasten ist:**  
   - API: `/api/status`, `/api/config`, `/api/command` (nur unkritische Befehle wie `/help`).  
   - **Nicht** in Dauerlast: echte Chain-Calls (Handshake, Send, Create-Key), Wallet-Passwort, OPEN_COMMAND-Ausführung.

4. **Ziel:**  
   Kein Absturz, keine Speicher-Lecks über viele Requests, Antwortzeiten unter akzeptablem Schwellenwert (z. B. p95 &lt; 2 s für /api/status).

**Resilience (Hardware/Offline):** Was passiert, wenn das Internet 30 s weg ist? Öffnet das Schloss via Cache, wenn die Chain nicht erreichbar ist? Dafür gibt es **keine** automatisierten Tests. Manuell prüfbar: RPC_URL auf ungültig setzen oder Netz trennen; Lock mit `OFFLINE_OPEN_ENABLED=true` – zuvor gecachter AccessKey sollte „open“ auch ohne Chain erlauben (siehe **docs/TEST-STRATEGY.md**, Säule 5).

---

### Übersicht: Was noch gemacht werden kann

| Priorität | Was | Aufwand | Hinweis |
|-----------|-----|---------|--------|
| **Hoch** | **Sicherheits-Tests** | Gering | `npm run test:security` (Blocklist + Adress-Validierung). Siehe Abschnitt oben. |
| **Mittel** | **Adress-Validierung erweitern** | Gering | Bereits in test:security: mehrere ungültige Adressen (Metazeichen, Länge). |
| **Mittel** | **Move-Package-Tests** | Mittel | Falls in `move-test/` Tests existieren: in CI oder `npm run test:move` einbinden. |
| **Mittel** | **Stresstest-Skript** | Mittel | Einmaliges k6/Artillery-Skript für /api/status und /api/command (/help); in README/TESTING erwähnen. |
| **Niedrig** | **UI-Browser-Tests** | Hoch | Playwright/Cypress für Passwort-Overlay, Chat-Tab, Befehl ausführen. `validate:ui` prüft nur Daten. |
| **Niedrig** | **Ollama/RAG E2E** | Niedrig | Optional; nur wenn Ollama in Umgebung läuft. |
| **Niedrig** | **E2E Replay-Schutz** | Mittel | ✅ **Doku + Skript:** Siehe Abschnitt „E2E Replay (manuell)“ unten; `npm run test:replay-e2e` sendet zweimal „open“ (Hinweis: je neue Nonce; echter Replay = gleiche Nonce nur manuell prüfbar). |

---

## E2E Replay (manuell)

**Ziel:** Prüfen, dass der Lock bei **gleicher Nonce** ein zweites Mal „OPEN abgelehnt (Replay)“ loggt.

**Voraussetzung:** Lock mit `REPLAY_STATE_FILE` gesetzt (z. B. `./replay-state.json`), Key-Halter mit gültigem AccessKey.

**Ablauf (manuell):**

1. **Lock starten:** `ROLE=lock`, `REPLAY_STATE_FILE` in .env, `npx tsx src/wallet-bridge.ts`.
2. **Key-Halter:** Verbindung zum Lock (Handshake + Connect), einmal **„open“** senden → im Lock-Log: **OPEN GRANTED**.
3. **Echter Replay** = dieselbe Nonce ein zweites Mal an den Lock liefern. Die App erzeugt pro Send eine **neue** Nonce; daher kannst du „open“ zweimal senden und siehst zweimal OPEN GRANTED (verschiedene Nonces). Um **Replay** zu testen, müsstest du dieselbe Chain-Nachricht (gleiche Nonce) erneut an den Lock bringen (z. B. durch Re-Use derselben TX oder ein Test-Tool). **Unit-Test** deckt ab: `acceptAndUpdate(state, sender, sameNonce)` → `accepted: false`.
4. **Optional:** `npm run test:replay-e2e` – sendet zweimal `/send-plain` „open“ an die Lock-Adresse (Sender-API). Im Lock-Log siehst du zwei OPENs (mit unterschiedlichen Nonces). Dient als Smoke-Check „Lock empfängt zwei Opens“; für echten Replay siehe Schritt 3.
