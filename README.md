# Morgendrot (Rebased Vault + purgeable messages)

Sicherer Messenger und M2M-Lock auf IOTA Rebased: ECDH P-256, AES-GCM, Vault (lokal/on-chain), purgebare Nachrichten/Handshakes, AccessKey-NFTs für Türschlösser. **SPOF = Seed** (ohne Seed keine Signatur; Wallet-Passwort für Vault/CLI). Nur bewährte Krypto; kein exec/shell bei Signatur oder OPEN_COMMAND; Replay-Schutz mit persistenter Nonce. **Alle Funktionen optional und in .env konfigurierbar** (`.env.example`); nach **`npm install`** wird **`.env`** aus **`.env.example`** angelegt, falls noch keine existiert (`postinstall` → `scripts/ensure-env.mjs`). Automatisierbare Schritte (Partner speichern, Package-ID aus Datei, Listener, Auto-Execute, Zahlungs-Trigger) sind ein- und abstellbar. **Für bestimmte Einsatzmöglichkeiten kannst du weniger Layer/Code nutzen** (Abschnitt 16). Beim Start erscheint ein Konfigurationsblock im Terminal.

**Einstieg (empfohlene Lese-Reihenfolge für neue Entwickler):**

1. **`docs/DEV-START.md`** — Lokales Setup, Rollen, die zwei Web-Oberflächen (**`frontend/`** = Next-Kundenprodukt, **`ui/`** = Boss-Werkstatt am API-Port), typische Ports und Startbefehle. **Backend vs. Client-IOTA (Handy-first):** **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`**, **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**, **`docs/MORGENDROT-CORE-PACKAGE-PLAN.md`** (`@morgendrot/core`), Fahrplan **§ H.15**. **ATAK/CoT (Backlog):** **`docs/ATAK-COT-INTEGRATION-ZIELBILD.md`**, Fahrplan **§ H.9**.
2. **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`** — Wenn du am Messenger, Posteingang oder Chat-Verlauf arbeitest: Datenfluss Chain → Backend → UI, Persistenz, zentrale Dateipfade; ergänzend **`docs/UI-NACHRICHTEN-STREAMS-ORT.md`** (wo Nutzer was sieht). **Klartext: Event vs. Mailbox (SSOT, UI-Schalter, API):** **`docs/MESSAGING-MAILBOX-SSOT-SPEC.md`**. **Serverseitige Messenger-Orchestrierung** (Plain Node/TS, **kein** NestJS-Framework): **`src/messenger-nest/README.md`**. Für andere Themen zuerst **`docs/architecture.mmd`** und **`docs/CONFIG-REFERENCE.md`** als Überblick.
3. **`TESTING.md`** — Smoke-Ablauf (`npm run test:smoke`), **§ *Qualitätsritual vor Merge*** (Root-`tsc`, `validate:ui`, `test:smoke`; im Ordner **`frontend/`** zusätzlich `lint`, `check:circular`, `tsc`, Vitest — wie **`.github/workflows/frontend-checks.yml`**) und manuelle Checklisten vor Merge oder Release. **Handy-first § H.15:** schneller Check **`npm run test:h15-direct-submit`** (Vitest nur Direkt-Submit-Frühabbrüche). **Chain-Realworld getrennt:** **Messenger** = **`npm run test:messages`** / **`npm run test:messenger`** / **`npm run test:messages:single`** (Chat-Kachel); **Tickets/AccessKey** = **`npm run test:tickets-accesskey-realworld`** (Event-/Schloss-Kachel; Kurzname **`test:realworld`**, gleiches Skript) — **nicht** Teil des Messenger-Smokes. Abschnitt *Smoke nach Merge*, Punkt 3 in **`TESTING.md`**. **Next-Client (API):** alle Aufrufe in **`frontend/frontend/lib/api.ts`** holen den Body per **`response.text()`** und prüfen ein **JSON-Mindest-Envelope** (Zod); gemeinsamer Fetch-Wrap **`frontend/frontend/lib/api-fetch-text.ts`** (`fetchApiText`, einheitliche Offline-/Timeout-Meldungen). Qualität/Fahrplan: **`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`** § H.1a; GitHub-PR-Stichpunkte am Ende derselben Datei.
4. **`docs/ONBOARDING-WALLET-UX-SPEC.md`** — Wallet/Session (Unlock, Vault, Credits vs. MIST), **Backlog L1–L6**, Verknüpfung **`docs/ROADMAP-FAHRPLAN.md` § H.0**. **Handy-first § H.15:** Smoke Stufe 2 **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**, Outbox/Sync Stufe 3 **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** § 8.
5. **`docs/RECOVERY-PHRASE-BACKUP.md`** — Recovery Phrase / Signer-Import sicher anzeigen (`SIGNER=sdk`, Vault-Backup), Szenario Geräteverlust.
6. **`docs/ROADMAP-FAHRPLAN.md`** (§ **H** = nächste Pakete, § **C** = Reihenfolge, **§ H.1a** Baseline/Vitest/AppError **`PHASE-A-QUALITY-BASELINE-AND-TESTS.md`**, **§ H.1b** Messenger-UI-Modularität **`docs/MESSENGER-UI-MODULARITY-STRATEGY.md`**, **§ H.6f** Android Foreground Service + minimale Sync-Ehrlichkeit **`docs/ANDROID-FOREGROUND-SERVICE-MINIMAL-SYNC.md`**, **§ H.7b** Feld-Architektur Backpack-Node/Heltec/Betriebsmodi, **§ H.10b** Boss/Arbeiter-Seed (Team vs. dezentral) **`docs/BOSS-WORKER-SEED-CUSTODY.md`**, **§ H.3m** LoRa/Notfall: keine volle IOTA-TX über Funk **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`**, **§ H.3n** SOS / **`MORG_EMERGENCY_V1`** **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`**, **§ H.10**–**H.14**, **§ H.15** (Handy-first / Client-IOTA), **§ H.16** (Telefonbuch, QR, Boss-LAN — **`docs/QR-CONTACT-SCHEMA-V2.md`**) u. a. → **`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`**, **`docs/OFFLINE-KARTEN-UND-GEODATEN-ZIELBILD.md`**, **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**, **`docs/MORGENDROT-HARDENING-V3-PRECISION.md`**) und **`docs/MACRO-OPERATIONAL-PATTERNS.md`** — Fahrplan, Heartbeat/Streams vs. LoRa, Betrieb (kein Pflicht-Coding).

**Inhalt:** Move-Package unter `move-test/`, Node/TS-Client unter `src/` (u. a. `wallet-bridge.ts`, `m2m-lock.ts`, `monitoring.ts`, `streams-adapter.ts`). **LoRa-Bridge** unter `lora-bridge/` – eigenes Projekt für HTTP ↔ LoRa-Mesh (Heltec/Meshtastic); siehe `lora-bridge/README.md`. **Hardware-Doku (strikt getrennt):** `hardware/README.md` → `heltec/`, `cm4/`, `meshtastic/`. **Raspi / ohne Next-Frontend:** `npm run pack:deploy` legt auf dem Desktop schlanke Ordner **`Morgendrot-Raspi-headless`** und **`Morgendrot-Raspi-lite-ui`** (ohne `frontend/`, ohne `node_modules`) an; Details **`deploy/README-DEPLOY-BUNDLES.md`**. **Messenger (zwei Editionen):** `npm run bundle:messenger` baut **`exports/Morgendrot-Messenger-standalone`** (`MESSENGER_EDITION=standalone`, Plug-and-Play) und **`exports/Morgendrot-Messenger-verkauf`** (`sales`, Kunden-UI mit Sweep-Hinweisen); Übersicht **`exports/README.md`**, Ablauf je Ordner in dessen `README.md`. **Standalone Smartphone / PWA (Next.js + API):** `npm run bundle:standalone-smartphone` → **`exports/morgendrot-standalone-smartphone/`** (volle `.env.example` aus dem Repo + PWA-Overrides, `postinstall` → `.env`; Bundle-`README.md`). Kurzüberblick **„Wanderer“-Abgabe:** **`docs/WANDERER-STANDALONE-BUNDLE.md`**. Abgabe an Tester/Käufer: **`.env`** pro Einsatz anpassen; **Seed/Vault-Passwort nur auf dem Gerät**, nicht auf dem Medium. **Optional (Boss):** Next **Steuerung → Boss-Modus → Export-Assistent** erzeugt eine **ZIP** mit vorgefüllter öffentlicher Handoff-`.env` (**`POST /api/standalone-smartphone-handoff-zip`**, Fahrplan **§ H.7**); das eigentliche Bundle weiter per Skript bauen. **Portable Version:** Ordner **`portable/`** ist **eigenständig** – nur diesen Ordner kopieren (inkl. src, scripts, package.json, .env.example). Einmalig **prepare.cmd** (npm install; `.env` wird bei Bedarf aus `.env.example` erzeugt), dann **start.cmd**. Optional: Node-ZIP als **node/** in portable/ legen, dann keine systemweite Installation nötig. **Funktionen testen:** **`npm run validate:ui`** (UI-Daten: alle refs in TREE), **`npm run test`** (Modultests), **`npm run test:kacheln`** / **`npm run test:all-tiles`** (Kacheln/Projekte mit 2 Wallets), **`npm run test:sortierstation`** (Szenario Autonome Sortierstation, 6 Stationen), **`npm run test:ai-coverage`** (KI-Befehl-Coverage, Intent ohne Ollama), **`npm run test:ai-copilot-api`** (API-Integration ohne Ollama), **`npm run test:ai-natural`** (100+ natürliche Sätze DE/EN). **Ollama optional:** Direktbefehle und Intent-Matcher (Kurzbefehle, natürliche Phrasen) funktionieren **ohne** Ollama; nur **Plan-Modus** („Als Plan“: Wunsch in mehrere Schritte zerlegen) und freie Formulierungen ohne Treffer brauchen Ollama. **`TESTING.md`** (Checkliste, Klartext-TX). **Listener & Whitelist:** Abschnitt 7.1. **Sicherheit & SPOF:** Abschnitt 8.

**Zwei Web-UIs:** **`ui/`** = Boss-Werkstatt (Alpine, über den API-Server), **`frontend/`** = Kunden-Produkt (Next.js). Beide nutzen **`/api/*`**. Beim ersten **Entsperren** (Next + Lite): **Tresor öffnen**, **Seed importieren** (`SIGNER=sdk`) oder **Neu anlegen** — siehe **`docs/ONBOARDING-WALLET-UX-SPEC.md`** §2.2. **Messenger-Editionen** (`standalone` / `sales`) betreffen die **Export-Bundles** unter **`exports/`**, nicht die Wahl der Oberfläche. Festgelegte Rollen, URLs und Feature-Fokus: **`docs/DEV-START.md`** → Abschnitt *Zwei Oberflächen: Boss-Werkstatt und Kunden-Produkt*.

**Sprachmemo im Next-Messenger (`frontend/`):** großer Button im Chat, Aufnahme + Encoding mit **ffmpeg/libopus** auf dem **Backend** (z. B. CM4 mit USB/MEMS-Mikro im Browser) – **nicht** auf Heltec/ESP32. **Aktueller Produktmodus:** Sprachmemo ist derzeit **Online/IOTA-only**; für Funk im Einsatzmodus primär **Kurztext/SOS-Text** (OS-Diktat: Windows `Win+H`, Android Tastatur-Mikrofon). Doku: **`docs/MESSENGER-SPRACHAUFNAHME.md`**.

**Rollen & „Zentrale“:** Der **Boss** ist die **Steuerungs- und Exportzentrale** (Kacheln kombinieren, Messenger/Geräte exportieren, Konfiguration) und **legt die Adressen für eingebundene Geräte an** (z. B. neue Keys, `MY_ADDRESS` pro Gerät in der jeweiligen `.env`) — hierarchisch sauber, ohne dass Geräte die Boss-Adresse selbst nutzen. **Technisch** hat jedes Gerät weiterhin eine **eigene** Node-Instanz mit **eigener** `.env`. Ein **Kommandant** (z. B. **Raspi** zwischen Boss und **Arbeitern**) kann lokale Endgeräte bündeln und nach oben anbinden. Eine **eine** dauerhaft laufende App für viele Endgeräte ist für **Orchestrierung/Status** denkbar; ob **Signaturen und Geheimnisse** dort gebündelt werden sollen, ist eine **offene Sicherheitsentscheidung** → **`docs/ARCHITECTURE-ROLES-AND-HUB.md`**, **`docs/DISCUSSION-OPEN.md`**.

**Starten:** **`npm start`** – Backend + Streams in einem Terminal. **`npm run dev`** – Backend + Next-UI. Details: **`docs/START-ANLEITUNG.md`**, **`docs/DEV-START.md`**.

**Next-Messenger (`frontend/`):** Entwicklung läuft mit **`next dev --webpack`** (siehe `frontend/package.json`), damit der **Meshtastic**-Client-Bundle einen kompatiblen **`util`**. Im Chat: **Klartext + „funk“** = Standard-Meshtastic-Text (**Broadcast** oder optional **Node-ID** `!…`), derzeit **ohne Sprachmemo-Anhänge**; optional **„LoRa + eigene Verankerung“** (Pfad 4, MVP): nach erfolgreichem Klartext-Funk automatisch **Klartext-Mailbox an die eigene Adresse** + optionale Forensic-Attestation — **ohne** Peer-ECDH; aktuell für **Kurztext + LoRa-Bildzweiteiler (LUMA/CHROMA)**. **S-ARQ (`MORG_SEG_V1`):** Posteingang kollabiert Segment-Zeilen zu **einer Leit-Zeile** pro Session; Anzeige über **`MorgSegV1ChatSink`** (Fortschritts-Raster, Luma-/Chroma-JPEG nach Reassembly, NAK optional über dieselbe Funk-Klartext-Route) — Spez **`docs/LORA-MORGENDROT-S-ARQ-SPEC.md`**. Entwurf für spaeteres LoRa->IOTA-Relay-Envelope: **`docs/MORG_TX_RELAY_V1-SPEC.md`**. **Import/Export (Posteingang):** enthält eine **R1 Rohdaten-Submit (Beta)**-Ansicht mit vereinfachtem Hauptpfad (**Builder -> signieren -> „Zu LoRa senden“**), automatischer Feldübernahme aus importierten Envelopes und optionalen Expertenblöcken statt doppelter Hauptaktionen; **R2 sponsored** bleibt bewusst Zukunfts-Backlog. **Verschlüsselt + „funk“** = Mesh v2 und braucht **/connect** wie bisher. **Funk + Foto:** bei **privat + verschlüsselt + „funk“** wird ein zuvor IOTA-kompaktes Bild **automatisch** per Backend in **LUMA+CHROMA** umgewandelt (`/api/compact-blob-to-lora-wires`); sonst **online** oder direkt unter Funk ein Bild wählen (dann sofort LoRa-Encode). **Routing-Fehler** der Firmware (z. B. `TOO_LARGE`, `NO_CHANNEL`) werden in der UI mit **Kurz-Tipp** erklärt; **`TIMEOUT` (3)** bei Broadcast wird nicht als harter Abbruch gewertet. Gesendete/empfangene **Mesh-Zeilen** optional **lokal** archiviert; Posteingang-Filter **„Nur LoRa/Mesh“** und **„Nur IOTA“** (reine Mailbox-Zeilen); **IOTA/Mailbox**-Partnerzeile nur Adressen mit mindestens einer solchen Zeile. **Privater Chat-Kopf:** Kurztext nur für Screenreader; **Posteingang:** **Pakete**/**Import/Export**-Menüs, Partner-Chips **löschbar**; **Boss:** **Einsatz-Profil** im Posteingang, eingebettet ohne langen Fließtext. Im Panel **„IDs zum Kopieren · Direkt-RPC · Funk“** ist Heartbeat im Messenger ausgeblendet; **Handshake -> Peer-Pub Auto-Fill** übernimmt ECDH-Peer-Pubs automatisch, während manuelle Key-/LoRa-Power-Eingriffe nur in Expertenoptionen erscheinen (im Messenger standardmäßig versteckt; Flag `morgendrot.dev.expertTools=1`). **`docs/MONOREPO-NEXT-AND-SHARED.md`** (Turbopack vs. Webpack).

**Übersicht:** **Funktionen-Übersicht** (alle Features) · 1 Move build & Deploy · 2 Konfiguration · 3 Rebased-Storage · 4 Messenger starten · 5 App auf PC2 · 6 Handshake · 7 Auto-Befehle & Schutz · 8 Passwort & Sicherheit · 9 Boss/Remote-Signer · 10 Terminal vs. UI (Tabs: Starte Projekt, Anfang, Vault, Chat, …) · 11 Vault & Purge (Move) · 12 M2M/AccessKey & Tickets · 13 Layer · 14 Skripte · 15 Ist-Stand · **16 Lean Layer** (minimaler Code pro Einsatzmöglichkeit).

**Provisioning-Profil (API):** **`docs/API-INITIAL-PROFILE.md`** — optionales Feld **`initialProfile`** (`metadata`, `validUntil`, Kontakte); Kritik/Erweiterungen **`docs/INITIAL-PROFILE-METADATA-AND-FUTURE-FIELDS-CRITIQUE.md`**; Kontakt-Übernahme **`POST /api/contact-labels/apply-initial-profile`**. **`POST /api/provision-device`:** optionaler Header **`Idempotency-Key`** (Doppelklick/Tiny-Secret) — **`docs/API-PROVISION-DEVICE-IDEMPOTENCY-SKIZZE.md`**, Code **`src/provision-idempotency-state.ts`**. **Einsatz-Vorlagen (Boss-PC):** **`docs/API-EINSATZ-ROLE-TEMPLATES.md`** (`GET/POST /api/einsatz-role-templates`). **Boss: Überblick & „was wohin“ (Orientierung):** **`docs/BOSS-ORIENTIERUNG.md`** — Lite-UI: **Dokumentation** (`/api/doc?name=…`); **Messenger-PWA:** **`/handbook`** (Markdown unter `public/handbook/`, Sync: **`npm run sync:handbook`**). Technik: **`docs/PWA-HANDBUCH-OFFLINE.md`**. **Rollenwechsel im Team (Sanitäter → Truppführer, Provisioning vs. Hierarchie, Trägerbild-Ist):** **`docs/ROLLENWECHSEL-TEAM-EINSATZ.md`**. **Dienst (Mainnet) vs. privat (Testnet), zwei Profile, keine Feature-Versprechen:** **`docs/DIENST-VS-PRIVAT-NETZ-PROFIL.md`**.

**LoRa / Heim-Gateway (Erzählung vs. Technik):** **`docs/HEIM-HELTEC-GATEWAY-NARRATIVE-CRITIQUE.md`**, **`lora-bridge/README.md`**.

**Änderungen & Betrieb (kurz):** **`CHANGELOG.md`**, **`docs/OPERATIONS-SNAPSHOT-2026-03.md`** (Ist/Lücken/Artefakte), **`docs/TEST-RUN-LOGBOOK.md`** (Smoke-/Test-Läufe). **Wann Messenger am Handy testen:** **`docs/HANDY-TEST-WINDOW.md`**. **Roadmap & Sitzungsprotokolle:** **`docs/ROADMAP-FAHRPLAN.md`** (**§ H** = nächste Arbeitspakete; **§ H.0** = Produkt/UX; **§ H.6f** = Android Foreground Service + minimale Sync-Ehrlichkeit — **`docs/ANDROID-FOREGROUND-SERVICE-MINIMAL-SYNC.md`**; **§ H.3g** = gebündelte Umsetzung `initialProfile`, Offline-Relay-Queue, Einsatzleitung/Rollen-Manager — **Teil 7a (Ist):** Client-Mailbox-Outbox in **`frontend/frontend/lib/api/offline-queue.ts`**, Opt-in **`localStorage`** `morgendrot.offlineMailboxQueue`, **`timeIsTrusted`** / monotones **`clientOutSeq`** (**§ H.6c**); **§ H.3m** = LoRa/Notfall vs. volle IOTA-TX (Gateway/Delayed Upload); **§ H.3n** = SOS / `MORG_EMERGENCY_V1` (Priorität, Basis); **§ H.10b** = Boss/Arbeiter-Seed-Custody; **§ H.12** = Sync/Source of Truth vs. **§ H.3g**/Delayed Upload; **§ H.7** / **§ H.7b** = Standalone-Abgabe / Backpack-Feldarchitektur; **C** = Reihenfolge; **E–G** Macro/Puls/Purge), **`docs/EINSATZLEITUNG-ROLLEN-MANAGER-CRITIQUE.md`** (Einsatz-Labels vs. Chain-`ROLE`, Provisioning-Maske, Handshake-Reihenfolge), **`docs/OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`** (Offline-Warteschlange, Profil-Payload), **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (Offline vs. IOTA, Idempotenz, CRDT-Grenzen), **`docs/UX-MESSENGER-INVENTORY.md`** (Messenger-UX: Ist vs. Wunsch, Wald-Check/Rolle/Toast u. a.), **`docs/CHAT-PROTOKOLL-2026-03-28.md`** (Abstimmung 2026-03-28; **Nachtrag 2026-03-29** Fahrplan/Sicherheit/LoRa; **Nachtrag 2026-03-30** Sync-Check & Mailbox-Offline-Outbox; **Nachtrag 2026-03-31** Android FG-Service **§ H.6f**; **Nachtrag 2026-04-15** Messenger-Realworld, Tickets/Gate, PWA **§ H.2**), **`docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`** (Review: IOTA→LoRa-Makros), **`docs/MACRO-BIDIRECTIONAL-SPEC.md`** (Wald↔Netz-Opcodes 0x40–0xB0, Backlog). **Phasen A/B/C und Meshtastic-First:** **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**.

**Weitere Dokumentation:** **`docs/MESSENGER-PACKAGE-ID-BANNER.md`** (Next-Messenger: Banner wenn Posteingangs-Package-ID ≠ Server; „Jetzt updaten“), **`docs/ROADMAP-FAHRPLAN.md`**, **`docs/PROTOCOL-CHANNELS-TX-VS-STREAMS.md`** (TX vs. Streams vs. Audit), **`docs/MACRO-OPERATIONAL-PATTERNS.md`**, **`docs/CHAT-PROTOKOLL-2026-03-28.md`**, **`docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`**, **`docs/MACRO-BIDIRECTIONAL-SPEC.md`**, **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**, **`docs/EINSATZBERICHT-EXPORT.md`**, **`docs/MESSENGER-SPRACHAUFNAHME.md`** (Chat: Mikrofon → Opus, ffmpeg, Höhlenrettung/CM4), **`docs/ARCHITECTURE-ROLES-AND-HUB.md`** (Boss, Kommandanten-Hub, Arbeiter), **`docs/ARCHITECTURE-PROVISIONED-AUTONOMY-RELAY.md`** (Zielbild: provisionierte Geräte-Identität, Gas-Sponsoring, Credits, E2E-Blind-Relay — Skelett, Abgleich mit Ist-Code), **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`** (PTB-/Größenlimits, Gas-Station-Risiko, PWA-Speicher, Sponsor-Workflow; **MIST vs. Credits**, Self-Pay, Offline-Buffer/Idempotenz/Ampel als Zielbild), **`docs/DEPLOY-SERVER-MESSENGER-ABGRENZUNG.md`** (kein separater „Messenger-Server-Ordner“: gleiche `src/`-App; was auf den Host; Messenger-only ≈ `.env`), **`docs/DISCUSSION-OPEN.md`** (offene Punkte, z. B. zentrale Signatur/SPOF), **`docs/MESSENGER-EXPORT-FIELDS.md`** (Messenger-Stapel in Boss-UI: Felder, Limits, SIGNER, PACKAGE-Verlauf), **`docs/AI-COPILOT-PLAN.md`** (AI-Copilot in Säule 3: Ollama + Qwen, Quick Start), **`docs/AI-COPILOT-LEAN-LINUX.md`** (Lean Linux/Industrie unter 500 MB, optional Fetch.ai). **KI & RAG:** **`ai-training/RAG-SETUP.md`** (RAG-Chunks, Embeddings, Abfrage-Flow), **`ai-training/Modelfile`** (Ollama-System-Prompt: Synonym-Tabelle, Logik-Baum, Sicherheits-Regel), **`ai-training/intents.json`**, **`ai-training/logic-tree.mmd`**, **`ai-training/drill-examples.txt`**, **`ai-training/security-checklist.md`**. **Diagramme:** **`docs/architecture.mmd`** (High-Level: UI, Node, Chain, Boss), **`docs/saeulen-befehlsfluss.mmd`** (4 Säulen + Befehlsfluss). **`docs/SCHLOSS-EINRICHTEN.md`** (Schloss Schritt für Schritt, wie für Freunde), **`docs/NOTFALL-DATENSPEICHER.md`** (Notfall-Datenspeicher: Testament, Patientenverfügung – verschlüsselt on-chain), **`docs/LEIHGERAETE-EINRICHTEN.md`** (Leihgeräte: Powerbank, Werkzeug – NFT + Purge), **`docs/SENSOR-ALARME-EINRICHTEN.md`** (Sensor-Alarme: Rauch, Wasser, Einbruch, Offline-Monitor), **`docs/CHAT-GRUPPE-EINRICHTEN.md`** (Dezentrale Chat-Gruppe: Pairwise, Broadcast), **`docs/FAMILIEN-ZUGANG.md`** (Familien-/Firmen-Zugang: Whitelist + Key), **`docs/CAR-SHARING-EINRICHTEN.md`** (Car-Sharing / E-Scooter: Zahlung → Freischaltung), **`docs/VAULT-EINRICHTEN.md`** (Vault: Schlüssel speichern, lokal & on-chain), **`docs/BOSS-MODUS.md`** (Boss-Modus: Maschinen ohne Wallet), **`docs/BROADCAST-PINNWAND.md`** (Pinnwand: Status/Alarm an alle, Klartext), **`docs/OFFLINE-CACHE.md`** (Offline-Fähigkeit des Locks: Cache, TTL, Sicherheit), **`docs/INDUSTRY-FEATURES.md`** (Industrie: Gas Station, Audit Blackbox, ZK-Roadmap, Multi-Sig, Euro-Orakel), **`docs/DESIGN-PRINCIPLES.md`** (7 Grundregeln, Flag-Zuordnung), **`docs/CONFIG-REFERENCE.md`** (alle Optionen mit Erklärung, inkl. ENABLE_MONITOR), **`docs/ENV-ERKLAERUNG.md`** (.env ganz einfach erklärt, wie für Freunde), **`TESTING.md`** (Checkliste), **`docs/SECRETS-OPTIONS.md`** (Secrets), **`docs/TICKET-REVIEW.md`** (Tickets), **`docs/ARCHITECTURE-CHECKS.md`** (Optionalität, Layer, SPOF), **`docs/STREAMS-INTEGRATION.md`** (Streams letzte Meile, Ablauf, Fallback), **`docs/PROJECT-RATING.md`** (Bewertung Logik/Sicherheit/Technik), **`SECURITY-RATING.md`** (Layer-Bewertung). **UI & Tests:** **`docs/UI-NACHRICHTEN-STREAMS-ORT.md`** (Wo Posteingang und Streams in der UI; Filter Eingang/Ausgang/Alle, Selbstnachrichten), **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`** (Chat-Verlauf, Datenfluss Mailbox/API/UI, Persistenz, Dateipfade — Referenz für Reviews/Handoff), **`docs/STREAMS-UND-NACHRICHTEN-FAQ.md`** (Bedeutung der Streams-Ausgabe, Nachrichten laden), **`docs/TEST-ARBEITER-KOMMANDANT-BOSS-BEWEIS.md`** (Beweis nach test:arbeiter-kommandant-boss), **`docs/BEGRIFFE-MOVE-REBASED.md`** (AccessKey, Ticket, Rebate, Gast ohne Wallet), **`docs/KRITIK-LKW-HAUSTUER-ERKENNUNG.md`** (LKW/Haustür-Erkennung: Ist vs. Beschreibung). .env: **`.env.example`**, **`docs/ENV-ERKLAERUNG.md`**.

---

## Funktionen-Übersicht (alle Features des Codes)

### Terminal-Befehle (Messenger)

| Befehl | Funktion |
|--------|----------|
| `/handshake 0x…` | Handshake an Adresse senden (ECDH-Key austauschen) |
| `/connect [0x…]` | Auf Handshake warten, Chat starten; Partner aus Datei laden wenn leer |
| `/fetch <n>` | Letzte N Nachrichten von der Chain laden (z. B. `/fetch 15`) |
| `hole letzten <n>` | Wie `/fetch` – natürliche Eingabe (z. B. `hole letzten 10`) |
| `/send-plain 0x… <Text>` | Klartext senden (ohne Handshake) |
| `/set-package-id 0x…` | Package-ID setzen und speichern |
| `/vault-save` | Messaging-Keys lokal speichern (VAULT_FILE) |
| `/vault-onchain` | Keys on-chain im VaultRegistry speichern |
| `/purge-handshake` | Handshake aus Mailbox löschen (ENABLE_PURGE) |
| `/purge-msg <nonce>` | Nachricht aus Mailbox löschen (ENABLE_PURGE) |
| `/emergency-purge` | Vault Notfall-Purge (enable + purge) (ENABLE_PURGE) |
| `/emergency-purge-key <keyId>` | AccessKey Notfall-Purge aktivieren (ENABLE_PURGE) |
| `/purge-key <keyId>` | AccessKey löschen (ENABLE_PURGE) |
| `/create-key <lock> <recipient> [ttl]` | Ein AccessKey-NFT ausstellen |
| `/create-keys <lock> <recipient> [ttl] [anzahl]` | Mehrere AccessKeys ausstellen |
| `/create-key-and-notify <lock> <recipient> [ttl] <Nachricht>` | **PTB:** Key + Klartext-Nachricht in einer TX (weniger Gas) |
| `/exit` | Beenden |
| `/help` | Befehlsliste anzeigen |

### Lock-Modus (ROLE=lock)

| Funktion | Beschreibung |
|----------|--------------|
| **Handshake-Empfang** | EcdhInit-Events an LOCK_ID sammeln (peerMap) |
| **Verschlüsselte OPEN-Befehle** | EncryptedMessage entschlüsseln, openWords prüfen |
| **Klartext-OPEN** | PlaintextMessage (wenn ENABLE_PLAINTEXT_CHANNEL) |
| **Broadcast-Pinnwand** | PlaintextMessage an BROADCAST_PINNWAND_ADDRESS (wenn ENABLE_BROADCAST_PINNWAND); nur Sender in BROADCAST_AUTHORIZED_SENDERS |
| **AccessKey-Prüfung** | hasValidAccessKey on-chain; Offline-Cache (OFFLINE_OPEN_ENABLED) |
| **Replay-Schutz** | Nonce pro Sender (acceptAndUpdate, REPLAY_STATE_FILE) |
| **Whitelist** | AUTHORIZED_SENDERS (optional) |
| **OPEN-Ausführung** | OPEN_COMMAND (spawn), OPEN_URL (GET), publishOpenViaStreams |
| **Öffnen-Wörter** | On-Chain (CommandRegistry) → AES-Datei → OPEN_COMMAND_WORDS |
| **Zahlungs-Trigger** | Bei Zahlung ≥ MIN_IOTA → OPEN (PAYMENT_TRIGGER_*) |
| **Offline-Queue** | Lokale Datei (OFFLINE_QUEUE_FILE) als Befehlseingang |
| **Streams-Listener** | Eingehende Nachrichten über HTTP-Bridge (STREAMS_LISTEN_ENABLED) |

### TypeScript-Module (src/)

| Modul | Exportierte Funktionen / Aufgaben |
|-------|-----------------------------------|
| **config** | CFG, savePackageIdToFile, savePartnerToFile, getConfigDisplay |
| **chain-access** | getClient, isChainReachable, signAndExecute, getBalanceInMist, transferCoins, getSponsorGasCoins, sendEcdhInit, storeEncryptedMessage, storePlaintextMessage, purgeHandshake, purgeMessage, enableEmergencyPurgeVault, purgeVaultOnChain, createAccessKey, createAccessKeyAndSendPlain (PTB), enableEmergencyPurgeKey, purgeKey, createVaultOnChain, getVaultFromChain, getOpenWordsFromChain, getHandshakeFromMailbox, findPeerHandshake, findPeerHandshakeFrom, hasValidAccessKey, hasValidTicket, queryIncomingPayments, minIotaToMist |
| **crypto-layer** | generateKeyPair, deriveSharedSecret, deriveAesGcmKey, encryptMessage, decryptMessage |
| **vault-local** | saveVaultLocal, loadVaultLocal, loadVaultFromChainPayload, vaultFileExists, encryptVaultPayloadForChain, encryptUtf8ToPayload, decryptPayloadToUtf8 |
| **replay-state** | loadReplayState, saveReplayState, acceptAndUpdate |
| **streams-adapter** | getStreamsAdapter, setStreamsAdapter (IStreamsAdapter: startListening, publish) |
| **monitoring** | sendHeartbeat, startHeartbeatLoop, recordHeartbeat, recordSensor, checkOfflineAndAlarm, getMonitorStatus, runMonitorMode |
| **audit-log** | appendAuditEvent, readAuditEvents, exportAuditCsv, exportAuditPdfStream (optional: Hash in Streams bei AUDIT_STREAMS_ENABLED) |
| **gas-station** | runGasStationCheck (Boss: IOTA-Nachfüllung für WORKER_ADDRESSES; siehe docs/INDUSTRY-FEATURES.md) |
| **iota-eur-oracle** | getIotaEurRate, eurToIota, getCachedIotaEurRate (IOTA_EUR_ORACLE_URL; Zahlungs-Trigger in EUR) |
| **read-command-list** | loadOpenWordsFromFile (AES-256-GCM) |
| **load-secrets** | parseEnvText, loadEncryptedEnvIfConfigured |
| **read-password** | readPasswordMasked |
| **utils** | normalizeAddress, toEventBytes |
| **wallet-bridge** | setWalletPassword, getWalletPassword; startet Messenger oder Lock |
| **m2m-lock** | runLockMode |

### Move-Modul (messaging.move)

| Funktion | Zweck |
|----------|-------|
| **emit_ecdh_init** | Handshake-Event (öffentlich) |
| **send_encrypted_message** | Verschlüsselte Nachricht (Event) |
| **send_plaintext_message** | Klartext-Nachricht (Event) |
| **create_globals** | VaultRegistry, Mailbox, CommandRegistry anlegen |
| **create_command_registry** | CommandRegistry (Alt-Deployments) |
| **set_open_words** | Öffnen-Wörter pro lock_id (nur Lock-Adresse) |
| **create_vault** | On-Chain-Vault anlegen |
| **update_vault** | Vault aktualisieren |
| **enable_emergency_purge** | Vault Notfall-Purge aktivieren |
| **purge_vault** | Vault löschen |
| **store_ecdh_init** | Handshake in Mailbox (purgebar) |
| **purge_handshake** | Handshake aus Mailbox löschen |
| **store_encrypted_message** | Nachricht in Mailbox (purgebar) |
| **store_plaintext_message** | Klartext in Mailbox (purgebar) |
| **purge_message** | Nachricht aus Mailbox löschen |
| **create_access_key** | AccessKey-NFT ausstellen |
| **enable_emergency_purge_key** | AccessKey Notfall-Purge aktivieren |
| **purge_key** | AccessKey löschen |
| **create_ticket** | Ticket-NFT ausstellen |
| **use_ticket** | Ticket einlösen (Einlass) |
| **enable_emergency_purge_ticket** | Ticket Notfall-Purge aktivieren |
| **purge_ticket** | Ticket löschen |

### Skripte (npm run / npx tsx)

| Skript | Funktion |
|--------|----------|
| `npm install` | Installiert Abhängigkeiten; **`postinstall`** legt **`.env`** aus **`.env.example`** an, falls **`.env`** fehlt (`scripts/ensure-env.mjs`). |
| `npm run test` | Modultests (crypto, vault, replay, utils, load-secrets, read-command-list, chain-access, config) |
| `npm run validate:ui` | UI-Daten prüfen (alle refs in TREE) |
| `npm run bundle:messenger` | Messenger-Bundles unter `exports/`: **standalone** + **verkauf** (`MESSENGER_EDITION`); siehe `exports/README.md` |
| `npm run bundle:messenger:standalone` | Nur `exports/Morgendrot-Messenger-standalone/` |
| `npm run bundle:messenger:sales` | Nur `exports/Morgendrot-Messenger-verkauf/` |
| `npm run bundle:standalone-smartphone` | **Next.js + API** nach `exports/morgendrot-standalone-smartphone/` (PWA/Android); volle `.env.example` + `postinstall` → `.env`; siehe **`docs/WANDERER-STANDALONE-BUNDLE.md`**, Bundle-`README.md`, Fahrplan **§ H.7** |
| `npm run assemble:messenger-units` | Nach Stapel-Export: volle Messenger-Ordner bauen (`tsx scripts/assemble-messenger-units.ts <Run> sales\|standalone`) |
| `npm start` | Backend + Streams starten (empfohlen) |
| `npm run start:backend` | Nur Backend (ohne Streams); auch mit verschlüsselter Env-Datei (ENCRYPTED_ENV_FILE) |
| `npm run encrypt-env -- <eingabe> [ausgabe]` | Secrets-Datei verschlüsseln |
| `npm run boss-signer` | HTTP-Service für Remote-Signatur |
| `npm run boss-provision-handshake` | Handshake beim Boss-Provisioning senden |
| `npm run test:message` | Test-Nachricht schreiben |
| `npm run telegram-webhook` | Kleiner HTTP-Relay: Morgendrot-Monitor → Webhook → Telegram-Bot (`scripts/telegram-webhook.ts`, nutzt `TG_BOT_TOKEN`, `TG_CHAT_ID`, `TG_WEBHOOK_PORT`) |
| **KI / RAG** | |
| `npm run generate:modelfile` | Ollama-Modelfile aus APPLICATION_KNOWLEDGE erzeugen (ai-training/Modelfile) |
| `npm run build:rag-chunks` | RAG-Chunks bauen (APPLICATION_KNOWLEDGE, tools-schema, corrections, code_structure, intents, logic-tree, drill-examples, security-checklist → ai-training/rag-chunks.json) |
| `npm run build:rag-embeddings` | Embeddings für alle Chunks (Ollama nomic-embed-text); schreibt rag-chunks.json zurück |
| `npm run prepare:rag` | Chunks + Embeddings (wie bei dev, ohne App zu starten) |
| `npm run prepare:ai` | Modelfile + RAG vorbereiten |
| `npm run test:ai-coverage` | KI-Befehl-Coverage: alle Befehle mit Intent-Matcher (ohne Ollama); Kurzbefehle + natürliche Phrasen |
| `npm run test:ai-copilot-api` | POST /api/ai-copilot Integration (Intent-Matcher, optional Ollama aus) |
| `npm run test:ai-natural` | 100+ natürliche Sätze (DE/EN), alle Kacheln/Befehle |
| `npm run test:ai-dangerous` | KI „Gehirn-TÜV“: gefährliche Formulierungen → kein /emergency-purge |
| `npm run test:ai-realworld` | Real-World: KI-Phrase → POST /api/ai-copilot → Aktion ausführen (API + Wallet; mit Ollama auch Plan-Modus testbar) |
| `npm run test:rag` | RAG-Retrieval Unit-Tests (cosineSimilarity, loadRagChunks, retrieveRelevantChunks) |
| **KI-Modi** | **Intent-Matcher** (ohne Ollama): Kurzbefehle Setup/Handshake/Message/Access/Purge + natürliche Phrasen („sende nachricht … an 0x“, „schick klartext …“, „sende 1 iota an 0x“). **Ollama:** Einzelbefehl aus freier Formulierung. **Plan-Modus** (UI „Als Plan“ / API `options.planOnly`): Ollama zerlegt Wunsch in Schritte (CHECK_SETUP → HANDSHAKE → CREATE_KEY → …), UI zeigt Liste mit „Schritt ausführen“. Plan braucht Ollama. |
| `npm run test:security` | Sicherheit: setEnvKey-Blocklist, Adress-Validierung (kein Injection) |
| `npm run test:stress` | Stresstest: GET /api/status + POST /api/command (/help), 1 Min, p95 &lt; 2 s (API muss laufen) |
| `npm run test:move` | Move-Package-Tests (`cd move-test && iota move test`; IOTA-CLI nötig) |
| `npm run test:ui` | UI-Browser-Tests (Playwright). Vorher: App starten, ggf. `npm run test:ui:install` |
| `npm run test:replay-e2e` | E2E-Replay-Hilfe: zweimal „open“ an Lock senden (LOCK_ADDRESS setzen) |
| `npm run seed:ui` | **Eine npm für alle UI-Daten:** Keys, Tickets, Nachrichten (Posteingang), Streams befüllen, damit die UI sichtbar ist. Backend läuft, Wallet entsperrt. Alias: `npm run send:ui-messages`. |
| `npm run test:arbeiter-kommandant-boss` | Ablauf-Test: Arbeiter (Heartbeat alle 10 s) → Kommandant („Alles ok“ an Boss) → Boss (Anweisung) → Kommandant (Bestätigung an Pinnwand). ~65 s. Erfordert `ALLOW_TEST_ROLE_OVERRIDE=true` für Rollenwechsel. Beweis: `docs/TEST-ARBEITER-KOMMANDANT-BOSS-BEWEIS.md`. |
| `npm run test:boss-kommandant-nachrichten` | Zwei Backends (Boss + Kommandant): Streams, Klartext und verschlüsselt an Kommandant → Kommandant antwortet „alles ok“ → Boss sieht in der UI unter „Boss-Übersicht“ alle Nachrichten. `API_BOSS`, `API_KOMMANDANT` (z. B. 3342, 3343). |
| `npm run test:echte-tx` | Real-World: echte Keys, Tickets, Nachrichten, Heartbeat, Streams, Rebate auf IOTA. Gibt Explorer-Links und JSON-Beweis aus. |
| **Ein Befehl – App mit einem Terminal** | |
| `npm run dev` | **Backend + Next.js-UI** in einem Terminal: API (Port 3342) + Frontend (Port 3341). Öffnen: **Next-UI** im Browser: http://127.0.0.1:3341/ – **Lite-UI**: http://127.0.0.1:3342/ (Backend). |
| `npm run dev:with-seed` | Wie `dev`, plus **einmaliges Befüllen** der UI (Keys, Tickets, Nachrichten, Streams): wartet bis die API läuft, führt dann `seed:ui` aus. Danach: Nachrichten → Posteingang → „Aktualisieren“; Streams in der Lite-UI unter Streams → Fetch. Erklärung: **`docs/DEV-WITH-SEED-ERKLAERUNG.md`** (warum manchmal keine Nachrichten; Boss-Übersicht). |

### Optionale Modi (Pinnwand, Pairwise, Ameisen)

| Modus | Config | Beschreibung |
|-------|--------|--------------|
| **Broadcast-Pinnwand** | `ENABLE_BROADCAST_PINNWAND`, `BROADCAST_PINNWAND_ADDRESS`, `BROADCAST_AUTHORIZED_SENDERS` | Alle hören auf eine Adresse (Status/Alarm). Klartext – nur für nicht-sensible Meldungen. Sender-Whitelist Pflicht. |
| **Pairwise-Groups** | `ENABLE_PAIRWISE_GROUPS`, `PARTNER_ADDRESSES` | Mehrere Partner, jeder mit eigenem Handshake. Teurer (n TX pro Nachricht), sicherer. |
| **Ameisen (Boss)** | `ROLE=boss`, `KOMMANDANT_ADDRESSES` | Boss sendet an alle Kommandanten. `/connect` verbindet mit allen. |
| **Ameisen (Kommandant)** | `ROLE=kommandant`, `BOSS_ADDRESS`, `WORKER_ADDRESSES` | Empfängt von Boss, sendet an Arbeiter. |
| **Ameisen (Arbeiter)** | `ROLE=arbeiter`, `BOSS_ADDRESS`, `KOMMANDANT_ADDRESSES` | Lock-Modus; akzeptiert nur von Boss + Kommandanten (AUTHORIZED_SENDERS abgeleitet). |

**Rollen-Verwirrung?** `ROLE` (messenger / arbeiter / **lock** …) vs. `ROLE_ID` 0–63 (6 Rechte-Bits), Profil-Slots `profiles/id-00`…, Einsatz-Vorlagen: **`docs/ROLE-ROLE-ID-UND-VORLAGEN-ERKLAERUNG.md`**. Kurz: **Tür/Schloss = `ROLE=lock`**, nicht dasselbe wie „Helfer“-Chat (`messenger`).

**Sicherheit:** Pinnwand erfordert `BROADCAST_AUTHORIZED_SENDERS` (nicht leer). Replay-Schutz (Nonce) und AccessKey-Prüfung gelten unverändert. Keine neuen Krypto-Primitive. Details: **`docs/SECURITY-MODES.md`**.

### Konfigurations-Flags (Auswahl)

| Flag | Default | Beschreibung |
|------|---------|--------------|
| ENABLE_PLAINTEXT_CHANNEL | false | Klartext-Events erlauben |
| ENABLE_PURGE | true | Purge-Befehle erlauben |
| ENABLE_LISTENER | true | Events/Mailbox abfragen |
| FETCH_LAST_ON_START | 0 | Beim Start (nach /connect) die letzten N Nachrichten holen (Maschinen: z. B. 20) |
| ENABLE_FETCH_COMMAND | true | Befehl „hole letzten N“ / „/fetch N“ erlauben |
| ENABLE_AUTO_EXECUTE | true | Befehle ausführen (Kill-Switch) |
| ENABLE_HARDWARE_OPEN | true* | OPEN_COMMAND/OPEN_URL ausführen |
| ENABLE_REPLAY_PROTECTION | true* | Nonce pro Sender |
| OFFLINE_OPEN_ENABLED | false | OPEN mit gecachtem AccessKey erlauben |
| PAYMENT_TRIGGER_ENABLED | false | Bei Zahlung OPEN ausführen |
| SPONSOR_GAS_OWNER | – | **Sponsored Transactions:** Adresse, die Gas übernimmt (z. B. Boss/Vermieter). Mit SPONSORED_TRANSACTION_ENABLED und API-Body `sponsorForSender` kann ein Gast Key-Ausstellung ohne eigenes IOTA auslösen. |
| SPONSORED_TRANSACTION_ENABLED | false | Sponsored Transactions nutzen (SPONSOR_GAS_OWNER muss gesetzt sein). |
| STREAMS_LISTEN_ENABLED | false | Streams als Nachrichten-Eingang |
| STREAMS_BRIDGE_URL | – | HTTP-Bridge (z. B. LoRa-Bridge: `npm run lora-bridge` → `http://localhost:9342`) |
| USE_ENCRYPTED_DISCOVERY | false | (Geplant) Verschlüsselte Discovery |

\* wenn entsprechende Datei/Config gesetzt

---

## 1. Move build & Deploy

```powershell
cd move-test
iota move build
```

Publizieren mit `iota client publish ...`. Nach Deploy: **PACKAGE_ID** in `.env` eintragen.

### Shared Objects einmalig anlegen

```powershell
iota client call --package <PACKAGE_ID> --module messaging --function create_globals --gas-budget 10000000 --json
```

Aus dem `GlobalsCreated`-Event: **vault_registry_id** → `VAULT_REGISTRY_ID`, **mailbox_id** → `MAILBOX_ID`, **command_registry_id** → `COMMAND_REGISTRY_ID` in `.env`.  
**Bestehendes Deployment** (ohne CommandRegistry): Einmalig `create_command_registry` aufrufen; aus dem Event **CommandRegistryCreated** die **command_registry_id** in `.env` als `COMMAND_REGISTRY_ID` eintragen.

```powershell
iota client call --package <PACKAGE_ID> --module messaging --function create_command_registry --gas-budget 5000000 --json
```

Aus der Ausgabe/Events **CommandRegistryCreated** → `command_registry_id` in .env als `COMMAND_REGISTRY_ID`.

---

## 2. Konfiguration (.env)

**Erste Datei:** Beim ersten **`npm install`** im Repo-Root legt **`postinstall`** automatisch **`.env`** aus **`.env.example`** an, **wenn noch keine** `.env` existiert (keine Überschreibung). Anschließend Werte anpassen (RPC, PACKAGE_ID, …).

Beispiel:

```env
RPC_URL=https://api.testnet.iota.cafe
PACKAGE_ID=0x...
MAILBOX_ID=0x...
VAULT_REGISTRY_ID=0x...
DEFAULT_TTL_DAYS=30
DEFAULT_KEY_TTL_DAYS=30
MY_ADDRESS=0x...
PARTNER_ADDRESS=0x...
ROLE=messenger
```

- **PACKAGE_ID:** Wenn leer, wird automatisch aus `.morgendrot-package-id` gelesen (oder per `/set-package-id 0x…` in der App gesetzt).
- **PARTNER_ADDRESS:** Kann leer bleiben. Wird automatisch in **`.morgendrot-partner`** gespeichert, sobald du **`/connect 0x…`** nutzt oder einen **Handshake an eine Adresse** sendest. Beim nächsten Start (oder bei **`/connect`** ohne Adresse) wird dieser Partner aus der Datei gelesen. So musst du nicht bei vielen Partnern immer die .env anpassen – du schreibst den Partner einmal an, danach steht er als Standard bereit.
- **Optionale Dateien:** `PACKAGE_ID_FILE`, `PARTNER_ADDRESS_FILE` (Default: `.morgendrot-partner`) für andere Pfade.
- **Alle .env-Optionen** siehe **`.env.example`** (kommentiert): u. a. ENCRYPTED_ENV_FILE, COMMAND_REGISTRY_ID, OPEN_COMMAND_LIST_FILE/KEY, ENABLE_PLAINTEXT_CHANNEL, OPEN_STREAMS_ENABLED/STREAMS_ANCHOR_ID (Streams letzte Meile), **PAYMENT_TRIGGER_ENABLED/MIN_IOTA/POLL_MS/STATE_FILE** (Zahlungs-Trigger Lock), LISTENER_POLL_MS, REPLAY_STATE_FILE, ENABLE_LISTENER, ENABLE_AUTO_EXECUTE, AUTHORIZED_SENDERS, GAS_BUDGET, SIGNER/REMOTE_SIGNER_*, DEFAULT_KEY_TTL_DAYS. Poll-Intervalle haben ein Minimum (1 s), um RPC-Last zu begrenzen; TTL-Werte werden ganzzahlig geparst.

### .env-Beispiele (komplett)

**PC1 oder PC2 mit IOTA-Wallet installiert (nur Wallet-Passwort beim Start):**

```env
RPC_URL=https://fullnode.testnet.iota.cafe:443
PACKAGE_ID=0x...
MAILBOX_ID=0x...
VAULT_REGISTRY_ID=0x...
MY_ADDRESS=0x...
PARTNER_ADDRESS=0x...
ROLE=messenger
SIGNER=cli
```

**PC2 ohne CLI – nur Mnemonic (App signiert selbst):**

```env
RPC_URL=https://fullnode.testnet.iota.cafe:443
PACKAGE_ID=0x...
MAILBOX_ID=0x...
PARTNER_ADDRESS=0x...
ROLE=messenger
SIGNER=sdk
# MY_ADDRESS leer = wird aus Mnemonic abgeleitet
# WALLET_DERIVATION_PATH=   optional, z.B. m/44'/4218'/0'/0'/0'
```

**PC2 ohne CLI – Boss signiert (nur Adresse):**

```env
RPC_URL=https://fullnode.testnet.iota.cafe:443
PACKAGE_ID=0x...
MAILBOX_ID=0x...
MY_ADDRESS=0x...
PARTNER_ADDRESS=0x...
ROLE=messenger
SIGNER=remote
REMOTE_SIGNER_URL=https://boss.example:3340/sign
REMOTE_SIGNER_TOKEN=optional-token
```

**Lock (Schloss):**

```env
RPC_URL=https://fullnode.testnet.iota.cafe:443
PACKAGE_ID=0x...
MAILBOX_ID=0x...
ROLE=lock
LOCK_ID=0x...
MY_ADDRESS=0x...
VAULT_FILE=.morgendrot-vault
REPLAY_STATE_FILE=.morgendrot-replay-state
# OPEN_COMMAND=node relay-on.js
# OPEN_URL=https://smartlock.local/open
# Optional – Streams als letzte Meile: OPEN_STREAMS_ENABLED=true, STREAMS_ANCHOR_ID=…, STREAMS_BRIDGE_URL=http://localhost:9342 (LoRa-Bridge: npm run lora-bridge; siehe lora-bridge/README.md).
# Optional – Zahlungs-Trigger (z. B. Ladesäule): PAYMENT_TRIGGER_ENABLED=true, PAYMENT_TRIGGER_MIN_IOTA=0.001, PAYMENT_TRIGGER_STATE_FILE=.morgendrot-payment-state
# Factory I/O (Demos, nicht Messenger-Kern): env.factory-io.example, docs/FACTORY-IO-INTEGRATION.md
```

---

## 3. Rebased-Storage: Vault + Mailbox

Handshakes und Nachrichten laufen über **Events** und/oder **shared Mailbox** (mit TTL/Purge). Vault liegt als Child unter dem **shared VaultRegistry**, nicht als Owned Object. „Auto-Purge“ = nach Ablauf kann per Entry-Funktion gelöscht werden; Clients können das anstoßen.

---

## 4. Messenger starten

```powershell
npx tsx src/wallet-bridge.ts
```

Oder **start.cmd** (verwendet bei Vorhandensein `node\node.exe` im Ordner).

- **Eingabe beim Start:**  
  - **SIGNER=cli** (Standard, IOTA-Wallet installiert): Einmal **Wallet-Passwort (IOTA Rebased)** – maskiert (*). Wird für Vault und CLI-Signatur genutzt.  
  - **SIGNER=sdk:** Zuerst **Mnemonic (24 Wörter)** (maskiert), dann **Wallet-Passwort** (für Vault).  
  - **SIGNER=remote:** **Wallet-Passwort** (für Vault).  
- Danach erscheint die **Befehlszeile**.

**Logdateien:** Bei `ENABLE_FILE_LOGGING=true` (Standard) schreibt das Backend rotierende Logs unter **`logs/`** (Dateiname und Rotation: `LOG_MAX_FILES`, `LOG_MAX_SIZE` in `.env` / `docs/CONFIG-REFERENCE.md`). Chatverläufe als Klartext liegen dort nicht zentral – lokal vor allem im **Inbox-Cache** (siehe Notfall-Purge-Doku).

### Terminal-Befehle (Messenger)

| Befehl | Bedeutung |
|--------|-----------|
| **`/handshake 0x…`** oder **`send handshake to 0x…`** | Handshake an diese Adresse senden. |
| **`/connect 0x…`** | Auf Handshake von dieser Adresse warten, dann Chat starten. Ohne Adresse: letzter Partner (aus .env oder `.morgendrot-partner`). **Die genutzte Adresse wird automatisch in `.morgendrot-partner` gespeichert** – beim nächsten Mal reicht `/connect`. |
| **`/send-plain 0x… <Text>`** | **Nur Klartext** an diese Adresse senden – **kein Handshake nötig**. Empfänger kann beliebig sein (z. B. sich selbst, Wallet ohne App). Event im Explorer sichtbar. |
| **`/set-package-id 0x…`** | Package-ID setzen und in `.morgendrot-package-id` speichern (beim nächsten Start automatisch geladen). |
| **`/exit`** / **`/help`** | Beenden / Hilfe. |

Im Chat zusätzlich: `/vault-save`, `/purge-handshake`, `/purge-msg <nonce>`, `/vault-onchain`, `/emergency-purge`, `/emergency-purge-key <keyId>`, `/purge-key <keyId>`, `/create-key(s) <lock> <recipient> [ttl] [anzahl]`, `/create-key-and-notify <lock> <recipient> [ttl] <Nachricht>` (PTB), `/help`. **API:** POST `/api/command` mit Body `{ "cmd": "/create-key", "args": [...], "sponsorForSender": "0x…" }` nutzt Sponsored Transaction (SPONSOR_GAS_OWNER zahlt Gas).

---

## 5. Anleitung: App auf einem zweiten PC (PC2) nutzen

So richtest du die App auf **PC2** ein, damit PC1 und PC2 miteinander chatten können (oder PC2 als Lock dient).

### Verbindung mit nur Wallet-Passwort (wie PC1) – auch auf PC2 möglich

**Ja.** Wenn auf **PC2 ein IOTA Rebased Wallet (CLI)** installiert ist, kann sich PC2 **genau wie PC1** nur mit dem **Wallet-Passwort** verbinden – **kein Mnemonic**, keine Boss-URL. Beim Start erscheint einmal die Abfrage **„Wallet-Passwort (IOTA Rebased)“**; dieses Passwort wird für Vault (Entschlüsselung) und für die Signatur (CLI) genutzt. Voraussetzung: **SIGNER=cli** (oder weglassen, Standard ist cli), **MY_ADDRESS** = Adresse der auf PC2 eingerichteten Wallet, IOTA-CLI mit Keystore auf PC2 installiert.

### Was auf PC2 nötig ist – vier Varianten

| Variante | Auf PC2 nötig | Beim Start | .env (Auswahl) |
|----------|----------------|------------|----------------|
| **Wie PC1 (nur Passwort)** | Node.js, IOTA-CLI + Wallet (Keystore) installiert | **Nur Wallet-Passwort** (einmal, maskiert) | `SIGNER=cli`, `MY_ADDRESS=0x…` (deine Adresse) |
| **Nur Mnemonic (keine CLI)** | Node.js, Projektordner (optional portable Node in `node/`) | Mnemonic (24 Wörter) + Passwort (für Vault) | `SIGNER=sdk`, `MY_ADDRESS` kann leer sein |
| **Nur Adresse (Boss signiert)** | Node.js, Projektordner | Passwort (für Vault; Signatur macht Boss) | `SIGNER=remote`, `REMOTE_SIGNER_URL=…`, `MY_ADDRESS=0x…` |
| **Lock (Schloss)** | Node.js, ggf. IOTA-CLI nur für Key-Halter; Lock signiert nicht | Passwort (für Vault) | `ROLE=lock`, `LOCK_ID=…`, `VAULT_FILE=…` |

**Node.js „integrieren“ (nur Ordner):** Du kannst Node.js **in den Projektordner** legen, damit auf PC2 nichts systemweit installiert werden muss:

1. **Portable Node:** Von [nodejs.org](https://nodejs.org) die **ZIP-Version** (z. B. „Windows Binary (.zip)“) herunterladen, in den Morgendrot-Ordner entpacken, z. B. als Unterordner `node/` (dann: `node\node.exe`, `node\npm.cmd`).
2. Im Projektordner **`npm install`** einmal ausführen (auf einem Rechner mit Node/npm, z. B. PC1), dann den **kompletten Ordner** (inkl. `node_modules/` und optional `node/`) auf PC2 kopieren.
3. Auf PC2 starten:
   - **start.cmd** (im Projektordner): nutzt automatisch `node\node.exe`, falls vorhanden, sonst systemweites `node`. Einfach doppelklicken oder aus der Konsole aufrufen.
   - Oder manuell: `node\node.exe node_modules\tsx\dist\cli.mjs src\wallet-bridge.ts` (mit portablem Node) bzw. `npx tsx src/wallet-bridge.ts` (mit installiertem Node).

**CLI umgehen:** Mit **SIGNER=sdk** oder **SIGNER=remote** braucht PC2 **keine** IOTA-CLI:

- **SIGNER=sdk:** Beim Start fragt die App nach der **Mnemonic (24 Wörter)**. Daraus wird die Adresse und Signatur abgeleitet – alles im Prozess, keine CLI.
- **SIGNER=remote:** PC2 hat nur **MY_ADDRESS** und **REMOTE_SIGNER_URL**; der Boss (anderer Rechner) signiert.

**Kurz:**

- **PC2 wie PC1 (nur Passwort):** IOTA Rebased Wallet (CLI) auf PC2 installieren, **SIGNER=cli**, **MY_ADDRESS** setzen → beim Start nur **Wallet-Passwort** eingeben.
- **PC2 nur Ordner (ohne CLI):** **SIGNER=sdk** (Mnemonic eingeben) oder **SIGNER=remote** (Boss signiert). Ordner inkl. `node_modules/`, optional portable Node in `node/`.

### Was auf PC2 nötig ist (im Detail)

| Voraussetzung | Beschreibung |
|---------------|--------------|
| **Node.js** | LTS (z. B. 20.x/22.x) – **entweder** systemweit installiert **oder** portable Version im Projektordner (z. B. `node/`). |
| **Projekt** | Morgendrot-Ordner auf PC2 (Kopie oder Git-Klon), inkl. `npm install` (also `node_modules/`). |
| **IOTA CLI** | **Nur bei SIGNER=cli** nötig. Bei **SIGNER=sdk** (Mnemonic) oder **SIGNER=remote** (Boss) **nicht** nötig. |

### Schritte auf PC2

1. **Projekt auf PC2 haben**  
   - Entweder: Repo klonen (`git clone ...`) oder den kompletten Projektordner von PC1 auf PC2 kopieren.

2. **Abhängigkeiten installieren**  
   ```powershell
   cd morgendrot
   npm install
   ```

3. **.env**  
   - Nach `npm install` liegt `.env` in der Regel schon (Kopie von `.env.example`), sonst manuell anlegen. Werte anpassen.

4. **.env für PC2 ausfüllen**  

   **Gemeinsam für alle (Messenger):** RPC_URL (wie PC1), PACKAGE_ID (wie PC1), MAILBOX_ID, MY_ADDRESS (Adresse von PC2), PARTNER_ADDRESS (Adresse von PC1), ROLE=messenger.

   **Je nach Variante:**

   | Ziel | SIGNER | MY_ADDRESS | Sonstiges | Beim Start |
   |------|--------|------------|-----------|------------|
   | **Wie PC1 (nur Passwort)** | `cli` (oder weglassen) | Adresse von PC2-Wallet | IOTA-CLI + Wallet auf PC2 installiert | **Nur Wallet-Passwort** |
   | **Nur Mnemonic (keine CLI)** | `sdk` | leer (wird aus Mnemonic gesetzt) | optional WALLET_DERIVATION_PATH | Mnemonic + Passwort (Vault) |
   | **Boss signiert** | `remote` | Vom Boss vergebene Adresse | REMOTE_SIGNER_URL, ggf. REMOTE_SIGNER_TOKEN | Passwort (Vault) |

   **Lock:** ROLE=lock, LOCK_ID=0x…, MY_ADDRESS=0x…, VAULT_FILE=.morgendrot-vault, REPLAY_STATE_FILE=.morgendrot-replay-state. Siehe Abschnitt „2. Konfiguration“ → .env-Beispiele (Lock).

5. **App starten**  
   ```powershell
   npx tsx src/wallet-bridge.ts
   ```
   oder **start.cmd** (nutzt optional `node\node.exe` im Ordner).  
   - **SIGNER=cli (wie PC1):** Einmal **Wallet-Passwort (IOTA Rebased)** eingeben (maskiert) – für Vault und CLI-Signatur.  
   - **SIGNER=sdk:** Zuerst **Mnemonic (24 Wörter)** (maskiert), dann **Wallet-Passwort** (für Vault).  
   - **SIGNER=remote:** **Wallet-Passwort** (für Vault; Signatur macht der Boss).  
   - Danach: **`/connect 0x…`** mit Adresse von PC1 (oder leer → **PARTNER_ADDRESS** aus .env). Wenn PC1 schon Handshake geschickt hat, verbindet PC2 sofort.

### Kurz: Was PC2 mindestens braucht

- **Node.js** + **Projektordner** (mit `npm install`) + **.env** (RPC_URL, PACKAGE_ID wie PC1, MY_ADDRESS, PARTNER_ADDRESS).
- **Wallet auf PC2:** Entweder **(1)** IOTA Rebased Wallet (CLI) installiert → nur **Passwort** wie PC1 (**SIGNER=cli**), oder **(2)** nur **Mnemonic** (**SIGNER=sdk**), oder **(3)** nur **Adresse + Boss** (**SIGNER=remote**). Lock braucht keine Signatur, nur Vault + Passwort.

### Wer sendet zuerst den Handshake?

- **PC1** startet und tippt z. B. **`send handshake to 0x…(PC2)`** → Handshake liegt auf der Chain.  
- **PC2** startet und tippt **`/connect 0x…(PC1)`** → findet den Handshake, antwortet, Chat steht.  
Oder umgekehrt: PC2 sendet Handshake an PC1, PC1 macht `/connect`. Beide müssen nur dieselbe **PACKAGE_ID** und **RPC_URL** und die jeweilige Partner-Adresse kennen.

**Zwei Instanzen auf einem PC:** Nutze **zwei Projektordner** (z. B. Kopie des Ordners), in jedem eine eigene **.env** mit der **eigenen MY_ADDRESS** (Wallet 1 = 0x…, Wallet 2 = 0x…). Sonst haben beide dieselbe MY_ADDRESS → gesendete Nachrichten erscheinen mit sender = recipient und die andere Seite erhält sie nicht.

---

## 6. Handshake: Wie Wallet 1 Wallet 2 findet (Details)

- **Kein automatisches Discovery.** Beide kennen die Partner-Adresse (z. B. in .env: `PARTNER_ADDRESS=0x…`).
- **Ablauf:** Einer sendet zuerst einen **EcdhInit** (sein öffentlicher Key) an den Partner. Der andere findet den Eintrag in Mailbox oder Events, **antwortet** mit eigenem EcdhInit. Danach: gemeinsamer Shared Secret, Kanal offen.
- **Wo steht der Handshake?** Mit **MAILBOX_ID**: Shared Mailbox (Dynamic Field). Ohne: Chain-Events vom Typ `EcdhInit`.

### Boss erstellt Adressen: Kein separater Handshake nötig

Wenn der **Boss** (Remote-Signer) die Adressen für Maschinen anlegt, kann er den **Handshake beim Provisioning** mitsenden. Die Maschine braucht dann keinen eigenen Handshake-Schritt – nur **`/connect 0x…Partner`**.

**Skript auf dem Boss-Rechner:**

```bash
npx tsx scripts/boss-provision-handshake.ts --address 0x...A --partner 0x...B --pubkey <base64-pubkey-von-A>
```

- **`--address`**: Adresse, von der der Handshake gesendet wird (z. B. Maschine 1).
- **`--partner`**: Partner-Adresse (z. B. Maschine 2).
- **`--pubkey`**: Base64 des öffentlichen Keys (P-256), oder **`--pubkey-file <datei>`**.

Boss signiert mit Wallet/CLI für Adresse A. PubKey von A: vom Boss erzeugt oder von der Maschine einmalig übermittelt.

---

## 7. Auto-Befehle: „Wallet 1 sagt es, Wallet 2 führt aus“

**Ja – das ist möglich und ein starker Anwendungsfall.** Nach ECDH-Handshake können beide verschlüsselt kommunizieren; Wallet 2 hat einen Listener. Wenn Wallet 2 **empfangene Befehle automatisch ausführt** (z. B. „sende X coins“), kann Wallet 1 Wallet 2 fernsteuern – gewollt, aber **ohne Schutz** wäre jeder mit dem Shared Secret in der Lage, Wallet 2 komplett zu steuern.

**Aktuell:**  
- **Messenger:** Empfängt nur Nachrichten und **zeigt sie an** – es werden keine Befehle automatisch ausgeführt.  
- **Lock:** Führt **„open“** automatisch aus, aber nur wenn der Sender ein gültiges **AccessKey-NFT** hat (Berechtigung on-chain) und Replay-Schutz greift.

**Schutzmaßnahmen (eingebaut bzw. vorbereitet):**

| Stufe | Mechanismus | .env / Verhalten |
|-------|-------------|-------------------|
| **Listener an/aus** | Listener komplett ein- oder ausschaltbar | `ENABLE_LISTENER=false` → keine eingehenden Nachrichten (Messenger), Lock reagiert nicht auf OPEN. |
| **Kill-Switch** | Auto-Ausführung abschaltbar | `ENABLE_AUTO_EXECUTE=false` → Befehle werden nur geloggt, nichts ausgeführt. |
| **Hardware abschalten** | OPEN_COMMAND/OPEN_URL nicht ausführen | `ENABLE_HARDWARE_OPEN=false` → Relais/URL wird nicht aufgerufen, nur Log. |
| **Whitelist** | Nur bestimmte Sender dürfen Befehle auslösen | `AUTHORIZED_SENDERS=0x…,0x…` (kommagetrennt). Lock: zusätzlich zur AccessKey-Prüfung. |
| **Betrags-Limit** | Max. Summe pro Befehl (für „sende coins“) | `MAX_SEND_AMOUNT_IOTA=0.01` (vorbereitet für zukünftige Zahlungs-Befehle). |
| **Replay-Schutz** | Bereits aktiv | Nonce pro Sender, `REPLAY_STATE_FILE`. |
| **On-Chain-Berechtigung (Lock)** | Bereits aktiv | Nur Sender mit gültigem AccessKey-NFT können „open“ auslösen. |
| **Zahlungs-Trigger (Lock)** | Optional | `PAYMENT_TRIGGER_ENABLED=true`: Bei eingehender Zahlung an Lock-Adresse (≥ `PAYMENT_TRIGGER_MIN_IOTA`) wird OPEN_COMMAND/OPEN_URL ausgeführt. Replay-Schutz über `PAYMENT_TRIGGER_STATE_FILE`. Siehe `.env.example` und docs/STREAMS-INTEGRATION.md §8.3. |

**Empfehlung:** Listener komplett aus: `ENABLE_LISTENER=false` (kein Empfang, Lock reagiert nicht). Nur Anzeige, keine Ausführung: `ENABLE_AUTO_EXECUTE=false`. Für Lock: `ENABLE_AUTO_EXECUTE=true` nur, wenn die Tür wirklich automatisch öffnen soll. Optional `AUTHORIZED_SENDERS` setzen. Wenn später „sende X coins“ im Messenger kommt: dieselben Checks (ENABLE_LISTENER, ENABLE_AUTO_EXECUTE, AUTHORIZED_SENDERS, MAX_SEND_AMOUNT_IOTA) nutzen. **UI:** Beim Start mit `ENABLE_UI=true` erscheint rechts oben ein Sicherheitshinweis (Klick → Tabelle mit den drei Deaktivierungsoptionen).

---

### 7.1 Listener, Whitelist & Befehlsausführung (kurz & klar)

Ein Listener kann **Nachrichten (verschlüsselt oder Klartext) von vorher angegebenen Adressen** abfragen und danach **automatisch Befehle ausführen** – und das ist **sehr sicher umsetzbar**, wenn man es richtig macht.

**Wichtig:** Für **Klartext** (und für das *Empfangen* von Nachrichten) ist **kein Handshake nötig**. Du kannst Klartext an **beliebige Adressen** senden – an dich selbst, an Wallets ohne App, an jede 0x…-Adresse. Senden: **`/send-plain 0x… <Text>`** (ohne vorherigen Handshake). Optional: Statt oder zusätzlich einen **kleinen IOTA-/Nano-Betrag** mitsenden und als **Coin-Überweisung** nutzen (Nachricht als Übertragungsträger; Betrag z. B. minimal für Gas/Spam-Schutz).

**Ablauf:**

1. **Whitelist** Du gibst eine Liste vertrauenswürdiger Absender-Adressen an (optional).  
   - **Quelle:** `.env` → `AUTHORIZED_SENDERS=0x…,0x…` (kommagetrennt).  
   - Leer = keine zusätzliche Einschränkung (Lock prüft weiterhin AccessKey on-chain).  
   - Später optional: Whitelist aus Rebased-Vault oder Config (derzeit nur .env).

2. **Listener** Die App fragt regelmäßig die Chain nach neuen **Events**:
   - **EcdhInit** (Handshake),
   - **EncryptedMessage** (verschlüsselte Nachricht),
   - **PlaintextMessage** (nur wenn `ENABLE_PLAINTEXT_CHANNEL=true`).
   Es werden nur Events berücksichtigt, bei denen **recipient = eigene Adresse** (Lock: `LOCK_ID` / `MY_ADDRESS`) und – falls Whitelist gesetzt – **sender in AUTHORIZED_SENDERS** steht (Adressen werden normalisiert verglichen).

3. **Entschlüsseln / Lesen**  
   - **EncryptedMessage:** Entschlüsselung mit dem gemeinsamen ECDH-Shared-Secret (Handshake muss vorher stattgefunden haben).  
   - **PlaintextMessage:** Inhalt direkt lesbar (nur bei aktiviertem Klartext-Kanal).

4. **Befehl parsen** Der Inhalt wird als Befehl interpretiert:
   - **Lock:** Kommagetrennte Öffnen-Wörter (z. B. `open`, `öffnen`, `unlock`) aus `.env`, On-Chain (CommandRegistry) oder AES-Datei. Einfacher Text: `"open"` oder `"öffnen"`.  
   - Zukünftig z. B. JSON: `{"command": "open", "nonce": 123}` oder `"status"` – aktuell reicht Klartext wie `open`.

5. **Ausführen** Wenn der Befehl gültig ist und alle Prüfungen bestanden sind:
   - **Replay:** Nonce pro Sender wurde noch nicht verwendet (persistent in `REPLAY_STATE_FILE`, falls gesetzt).
   - **Whitelist:** Wenn `AUTHORIZED_SENDERS` gesetzt ist, muss der Sender in der Liste stehen.
   - **Lock:** Zusätzlich muss der Sender ein gültiges **AccessKey-NFT** für dieses Schloss besitzen.
   - Dann wird die Aktion ausgeführt: z. B. **OPEN_COMMAND** (Relais/Skript), **OPEN_URL** (HTTP GET), Log, oder zukünftig Purge, Coin senden usw.

**Beispiel Lock (.env):**

```env
ROLE=lock
LOCK_ID=0x...
MY_ADDRESS=0x...
VAULT_FILE=.morgendrot-vault
REPLAY_STATE_FILE=.morgendrot-replay-state

# Nur diese Adressen dürfen OPEN auslösen (zusätzlich zu AccessKey). Leer = jeder mit gültigem Key.
AUTHORIZED_SENDERS=0xabc...def,0x123...456

# Öffnen-Wörter (oder On-Chain / AES-Datei)
OPEN_COMMAND_WORDS=open,öffnen,unlock
OPEN_COMMAND=node scripts/relay-on.js
```

**Beispiel Ablauf (Lock):**

1. Key-Halter sendet Handshake an `LOCK_ID` → Lock speichert seinen öffentlichen Key.
2. Key-Halter sendet verschlüsselt `"open"` (oder bei `ENABLE_PLAINTEXT_CHANNEL=true` zusätzlich als Klartext-Event).
3. Lock empfängt Event (recipient = LOCK_ID), prüft: Sender in Whitelist (falls gesetzt), Replay-Nonce neu, AccessKey gültig.
4. Lock führt `OPEN_COMMAND` und/oder `OPEN_URL` aus und loggt `OPEN GRANTED`; optional zusätzlich Streams (OPEN_STREAMS_ENABLED) für letzte Meile.

**Sicherheit in Kürze:** Kein Shell bei Signatur und OPEN_COMMAND; Adressen validiert; Whitelist optional; Replay-Schutz; Lock zusätzlich AccessKey on-chain. Siehe Abschnitt 8 (Passwort & Sicherheit).

### 7.2 Letzte Nachrichten laden (Messenger)

**Variante A – Automatisch beim Start (Maschinen):** `FETCH_LAST_ON_START=20` → Beim Start nach `/connect` werden die letzten 20 Nachrichten von der Chain geladen und angezeigt. Ideal für Geräte nach Neustart oder Stromausfall.

**Variante B – Manuell auf Wunsch (Menschen):** Im Chat `hole letzten 15` oder `/fetch 15` tippen → die letzten 15 Nachrichten werden geladen und angezeigt. Wie „ältere Nachrichten laden“ in Messengern.

| Config | Default | Beschreibung |
|--------|---------|--------------|
| `FETCH_LAST_ON_START` | 0 | Anzahl Nachrichten beim Start (0 = aus) |
| `ENABLE_FETCH_COMMAND` | true | Befehl „hole letzten N“ / „/fetch N“ erlauben |

### 7.3 Lieferketten-Monitor (ROLE=monitor)

**Variante A – Sensor-Daten & Grenzwert-Alarm:** Geräte (Locks/Sensoren) senden Heartbeat und Sensordaten (Temp, Feuchte, Schock, GPS, Licht) via Streams. Der Monitor prüft Grenzwerte (z. B. `MONITOR_SENSOR_MAX_TEMP=8` für Kühlkette) und löst bei Überschreitung Alarm aus.

**Variante B – Multi-Geräte-Dashboard:** Mit `ENABLE_UI=true` und `ROLE=monitor` zeigt die UI eine Geräte-Tabelle (Status, letzte Aktivität, Sensorwerte, purgebar). API: `GET /api/monitor-status`.

**Variante C – Automatischer Purge bei Lieferung:** `MONITOR_PURGE_AFTER_DAYS=30` → Geräte, die seit 30 Tagen inaktiv sind, gelten als „Lieferung abgeschlossen“ und werden als purgebar markiert (Audit-Event). Purge selbst erfolgt im Messenger-Modus.

**Variante D – Audit-Log-Export:** `GET /api/audit-export?format=csv` oder `?format=pdf` → CSV/PDF für Behörden/Compliance.

**Variante E – Automatische Eskalation:** `MONITOR_ESCALATION_WEBHOOK_2` und `MONITOR_ESCALATION_WEBHOOK_3` → Nach X Minuten (MONITOR_ESCALATION_DELAY_MS) wird an Disponent/Chef eskaliert.

| Config | Default | Beschreibung |
|--------|---------|--------------|
| `MONITOR_DEVICES` | – | Kommagetrennte Geräte-Adressen (0x…) |
| `MONITOR_SENSOR_MAX_TEMP` | – | Max. Temperatur (°C), darüber → Alarm |
| `MONITOR_SENSOR_MIN_TEMP` | – | Min. Temperatur (°C), darunter → Alarm |
| `MONITOR_SENSOR_STATE_FILE` | – | Datei für letzten Sensor-Wert pro Gerät |
| `MONITOR_PURGE_AFTER_DAYS` | 0 | Nach X Tagen Inaktivität → purgebar (0 = aus) |
| `MONITOR_ESCALATION_WEBHOOK_2` | – | Webhook Level 2 (z. B. Disponent) |
| `MONITOR_ESCALATION_WEBHOOK_3` | – | Webhook Level 3 (z. B. Chef) |
| `MONITOR_ESCALATION_DELAY_MS` | 300000 | Abstand zwischen Eskalationsstufen (5 Min) |
| `AUDIT_LOG_FILE` | logs/audit.jsonl | Pfad für Audit-Log (CSV/PDF-Export) |

---

## 8. Ein Passwort & Sicherheit

- **Ein Passwort (SIGNER=cli):** Wallet-Passwort (IOTA Rebased) – für Vault (lokal/on-chain) und für die TX-Signatur (wird an die CLI übergeben). **PC1 und PC2** können sich so **nur mit diesem Passwort** verbinden, wenn auf dem Rechner das IOTA Rebased Wallet (CLI) installiert ist. `/vault-save` und `/vault-onchain` nutzen dasselbe Passwort. **Eingabe im Terminal ist maskiert** (*).
- **Krypto:** ECDH P-256, AES-GCM 256, HKDF, PBKDF2 310k. Signatur per `spawn('iota', ...)` ohne Shell; Adressen validiert. **OPEN_COMMAND** / **OPEN_URL** nur aus .env, spawn ohne Shell. Replay: monotone Nonce pro Sender, optional `REPLAY_STATE_FILE`.

### SPOF (Single Point of Failure) & Sicherheitsbedenken

**SPOF = Seed.** Ohne Seed (Mnemonic) keine Transaktions-Signatur; wer den Seed hat, kontrolliert die Adresse. Das Wallet-Passwort schützt Keystore (CLI) und Vault – Verlust bedeutet ohne Backup keinen Zugriff. Alle anderen Einstellungen (Listener, Auto-Execute, Zahlungs-Trigger, Whitelist) sind optionale Schalter, kein SPOF.

| Risiko | Erklärung | Empfehlung |
|--------|-----------|------------|
| **SPOF = Seed** | Ohne Seed (Mnemonic) keine TX-Signatur. Wer den Seed hat, kontrolliert die Adresse. | Seed sicher aufbewahren (z. B. Offline, getrennt vom Rechner); niemals teilen oder in .env/Code. |
| **SPOF = Wallet-Passwort** | IOTA Rebased Wallet-Passwort schützt Keystore (CLI) und wird für Vault-Entschlüsselung genutzt. Verlust = kein Zugriff auf Vault ohne Backup; Kompromittierung = Angreifer kann signieren, wenn er auch Zugriff auf den Rechner/Keystore hat. | Starkes Passwort; gleiches Passwort für Vault wie in der App genutzt – Verlust bedeutet: Vault von Chain mit neuem Passwort neu anlegen oder aus lokalem Backup. |
| **Vault ohne Seed** | Messaging-Keys (ECDH) können aus On-Chain-Vault + Passwort rekonstruiert werden. Wenn nur Vault kompromittiert wird (nicht Seed), kann jemand mit dem Passwort die gleichen Keys nutzen (Nachrichten mitlesen/imitieren). | Passwort und Seed getrennt schützen; Vault-Datei und REPLAY_STATE_FILE in geschütztem Verzeichnis (z. B. Berechtigungen einschränken). |
| **Remote-Steuerung** | Ohne ENABLE_LISTENER/ENABLE_AUTO_EXECUTE/AUTHORIZED_SENDERS könnte theoretisch jemand mit dem Shared Secret Befehle senden. | Lock: ENABLE_AUTO_EXECUTE nur true, wenn OPEN gewollt; optional AUTHORIZED_SENDERS; ENABLE_LISTENER=false zum Abschalten. |
| **Replay** | Alte „open“-Nachricht erneut gesendet. | REPLAY_STATE_FILE setzen (persistente Nonce pro Sender). |
| **Command-Injection** | Adressen/Befehle aus Nutzerinput in Shell oder OPEN_COMMAND. | Adressen strikt validiert (0x+hex/bech32); Signatur und OPEN_COMMAND per spawn ohne shell; OPEN_URL nur aus .env. |

**Kurz:** **SPOF = IOTA-Seed (Mnemonic) + IOTA-Wallet-Passwort.** Ohne Seed keine Signatur; ohne Wallet-Passwort kein Vault-Zugang (und bei SIGNER=cli keine Signatur). Alle anderen Optionen (Listener, Auto-Execute, Authorized Senders, Replay-Datei, Zahlungs-Trigger) sind keine SPOF, sondern abschalt- oder einschränkbar. Siehe auch **`docs/ARCHITECTURE-CHECKS.md`** (Optionalität, Layer, SPOF).

### Passwort-Prüfung: Wie weiß die App, dass es das echte Passwort ist?

Es gibt **keine explizite „Login“-Validierung**. Das Passwort wird erst beim ersten **Gebrauch** geprüft:

- **Vault (lokal oder on-chain):** `loadVaultLocal` / `loadVaultFromChainPayload` entschlüsselt mit AES-GCM. Falsches Passwort → **Entschlüsselung schlägt fehl** (Exception).
- **SIGNER=cli:** Beim ersten Signieren wird das Passwort an die IOTA-CLI übergeben. Falsches Passwort → **CLI meldet Fehler**.

Die App startet also erst, wenn die Vault-Entschlüsselung (oder Key-Generierung) erfolgreich war. Ein falsches Passwort führt zu sofortigem Abbruch.

### Maschine nur mit Adresse (Raspberry Pi, Lock, ohne Wallet): Wie „einloggen“?

Bei **SIGNER=remote** braucht die Maschine **kein Wallet** – der Boss signiert. Trotzdem braucht sie das **Vault-Passwort**, um die Messaging-Keys (ECDH) zu laden (für Entschlüsselung von „open“-Nachrichten).

**Optionen für unattended/Headless:**

| Option | Beschreibung |
|--------|--------------|
| **ENCRYPTED_ENV_FILE** | `process.env.WALLET_PASSWORD` in verschlüsselter Datei; beim Start (`npm start` oder `npm run start:backend`) → ein Passwort für die Secrets-Datei, darin steht `WALLET_PASSWORD=…`. |
| **UI / physischer Zugang** | Wenn jemand vor Ort ist: UI aufrufen (http://127.0.0.1:UI_PORT), Passwort-Overlay ausfüllen. |
| **Terminal-Session** | SSH auf die Maschine, App starten, Passwort per `readPasswordMasked` eingeben (maskiert). |

**Hinweis:** `WALLET_PASSWORD` in .env ist **nicht** per API setzbar (Blocklist). Für Headless: entweder in `.env.secrets.enc` (ENCRYPTED_ENV_FILE) oder manuell in .env eintragen – **nur** auf sicheren, vertrauenswürdigen Systemen.

### Optionen & Automatisierung (alles konfigurierbar)

| Was | Standard / Automatik | .env / Verhalten |
|-----|----------------------|------------------|
| Package-ID | Aus Datei laden, wenn PACKAGE_ID leer | `PACKAGE_ID_FILE`, `/set-package-id` speichert in Datei |
| Partner-Adresse | Aus Datei laden, wenn PARTNER_ADDRESS leer | `PARTNER_ADDRESS_FILE`, `/connect` und Handshake speichern Partner |
| Listener | An (Events/Mailbox abfragen) | `ENABLE_LISTENER=false` schaltet ab |
| Auto-Befehle ausführen | An (OPEN bei Lock) | `ENABLE_AUTO_EXECUTE=false` nur anzeigen, nicht ausführen |
| Whitelist Sender | Leer = keine Zusatz-Liste (Lock: AccessKey bleibt Pflicht) | `AUTHORIZED_SENDERS=0x…,0x…` |
| Zahlungs-Trigger | Aus | `PAYMENT_TRIGGER_ENABLED=true`, Mindestbetrag, State-Datei optional; nur wenn OPEN_COMMAND oder OPEN_URL gesetzt |
| Streams (Status) | Aus | `OPEN_STREAMS_ENABLED`, `STREAMS_LISTEN_ENABLED`, `STREAMS_ANCHOR_ID`, `STREAMS_BRIDGE_URL` (LoRa-Bridge optional). Ablauf & Fallback: **docs/STREAMS-INTEGRATION.md** §3a–3b. |
| Replay-Schutz | Aktiv wenn REPLAY_STATE_FILE gesetzt | `REPLAY_STATE_FILE`, `PAYMENT_TRIGGER_STATE_FILE` (Zahlungs-Digests); bei langer Laufzeit State-Datei ggf. rotieren/leeren |
| Poll-Intervalle | 3–15 s je nach Funktion | `LISTENER_POLL_MS`, `LOCK_COMMAND_POLL_MS`, `PAYMENT_TRIGGER_POLL_MS` (Minimum 1 s) |

---

## 9. Boss / Remote-Signer (Maschine nur mit Adresse)

**Idee:** Boss hält Wallet/Keys, Maschinen haben nur **ihre Adresse** + App. Zum Senden „pingt“ die Maschine den Boss: „Signiere diese TX für Adresse X.“

| Komponente | Wo | Beschreibung |
|------------|-----|--------------|
| Wallet | Beim Boss | CLI/Keystore für alle Adressen. |
| Signer-Service | Beim Boss | `npm run boss-signer` → HTTP: POST `/sign` mit `{ address, txBytesBase64 }`, liefert `{ signature }`. |
| App (Maschine) | Nur Adresse + .env | `SIGNER=remote`, `REMOTE_SIGNER_URL=https://boss.example:3340/sign`, evtl. `REMOTE_SIGNER_TOKEN=…`, `MY_ADDRESS=0x…`. |

- App baut TX, schickt Signatur-Anfrage an Boss; **Ausführung** der signierten TX per SDK (keine IOTA-CLI auf der Maschine).
- **Boss .env:** `PORT=3340`, `BOSS_SIGNER_TOKEN=…`, ggf. `WALLET_PASSWORD=…`. Boss braucht IOTA-CLI und Keystore.

**Ohne CLI:** **Lock** läuft ohne CLI (liest nur Chain, Vault + Passwort). **Messenger** braucht Signatur → CLI, SDK-Signer oder Boss.

**Boss: Adressen erstellen und verwalten**  
Der Boss legt Adressen für Maschinen im IOTA-CLI Keystore an (z. B. `iota client new-address`). Jede Maschine erhält ihre `MY_ADDRESS` in der .env. Der Boss-Signer signiert für beliebige Adressen, die im Keystore existieren. Mehrere Maschinen = mehrere Adressen, alle vom Boss verwaltet.

**Empfänger: aktiv vs. passiv**  
- **Aktiv:** Volles Wallet, App, kann jederzeit senden/empfangen, Handshake selbst initiieren.  
- **Passiv (nur Adresse):** Klartext (`/send-plain`) funktioniert an beliebige Adresse – kein Handshake nötig. Verschlüsselt: Boss nutzt `boss-provision-handshake`, Empfänger macht `/connect` selten; AccessKey-Empfänger kann Maschine mit `SIGNER=remote` sein (NFT landet on-chain, Boss signiert für „open“).

---

## 10. Terminal vs. UI

Beim Start gibt die App einen **Konfigurationsblock** aus (alle .env-Werte, maskiert wo nötig). Eine **optionale Offline-UI** (`ENABLE_UI=true`, `UI_PORT=3341`, `API_PORT=3342`) bietet:

- **Passwort-Overlay** – Wallet-Passwort in der UI statt Terminal
- **Tab-Navigation** – Starte Projekt (chronologische Anleitungen) + 9 Bereiche (Anfang, Vault, Chat, Schlüssel & Tickets, Schloss, Streams, Zahlung & Trigger, Monitoring, Einstellungen). Alle Projekt-`ref`s verweisen auf TREE-Einträge (validierbar mit **`npm run validate:ui`**).
- **Setzen/Kopieren** – Config-Werte in .env schreiben, Syntax kopieren
- **Toggles** – Booleans (ENABLE_*, USE_*) per Klick an/aus
- **Ausführen** – API-Befehle (/vault-save, /fetch, /create-key, …) direkt aus der UI
- **Abfragen** – findPeerHandshake, isChainReachable, getConnectAddresses, getConfigDisplay
- **Neustart** – Programm per Button neu starten
- **Hilfe** – „?“-Button mit Beschreibung pro Eintrag

### UI-Struktur (Tabs)

| Tab | Inhalt |
|-----|--------|
| **Starte Projekt** | Projekt-Karten mit chronologischen Schritten. **Lean Profile** (minimaler Code pro Einsatz) als erste Karte; pro Projekt optional „Minimaler Einsatzzweck“ (benötigte Module). |
| **1. Anfang & Verbindung** | MY_ADDRESS, RPC_URL, PACKAGE_ID, /set-package-id, /connect (Terminal), /handshake (API), boss-provision-handshake, findPeerHandshake, isChainReachable, /exit, /help |
| **2. Vault & Sicherheit** | VAULT_FILE, /vault-save, /vault-onchain, Purge-Befehle, ENABLE_PURGE, ENABLE_REPLAY_PROTECTION |
| **3. Nachrichten & Chat** | PARTNER_*, Gruppen, /send-plain, ENABLE_LISTENER, /fetch, ENABLE_AUTO_EXECUTE |
| **4. Schlüssel & Tickets** | /create-key, /create-keys, /create-key-and-notify (PTB), /emergency-purge-key, /purge-key, DEFAULT_KEY_TTL_DAYS |
| **5. Schloss & Hardware** | LOCK_ID, OPEN_COMMAND, OPEN_URL, ENABLE_HARDWARE_OPEN, OFFLINE_* |
| **6. Streams & Schnellkanal** | OPEN_STREAMS_ENABLED, STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, STREAMS_LISTEN_ENABLED |
| **7. Zahlung & Trigger** | PAYMENT_TRIGGER_*, SPONSOR_GAS_OWNER, SPONSORED_TRANSACTION_ENABLED |
| **8. Monitoring & Wartung** | ENABLE_HEARTBEAT, MONITOR_*, ENABLE_CHAIN_ANCHOR, LOG_* |
| **9. Einstellungen & Entwickler** | SIGNER (cli/remote/sdk), REMOTE_SIGNER_URL, GAS_BUDGET, ENABLE_UI, UI_PORT, API_PORT, getConfigDisplay |

**Reihenfolge für Einsteiger:** MY_ADDRESS → RPC_URL → PACKAGE_ID → /connect oder /handshake.

---

## 11. Vault & Purge (Move)

**Vault (VaultRegistry):**  
`create_vault`, `update_vault`, `enable_emergency_purge`, `purge_vault`.

**Mailbox:**  
`store_ecdh_init`, `purge_handshake`, `store_encrypted_message`, `purge_message`.

### Purge & Storage-Rebate (IOTA Rebased)

**Unnötige Assets im Projekt:** Coin-Objekte (Gas), Vault-Childs, Mailbox-Childs (Handshake/Message), AccessKey-NFTs. **Nicht purgebar:** Events (EcdhInit, EncryptedMessage) – bleiben in der TX-Historie, kosten keinen Storage.

| Methode | Was passiert? | Wer? | Rebate? | Wann? |
|--------|----------------|------|---------|-------|
| **Manuelles Purge** | `purge_vault`, `purge_message`, `purge_handshake`, `purge_key` aufrufen | Owner / Berechtigte | Ja (~90–99 %) | Aktiv aufräumen |
| **Auto-Purge nach TTL** | Nach `auto_purge_after_ms` kann (je nach Code) gelöscht werden | Jeder / Owner | Ja | Alte Nachrichten/Keys (z. B. 30 Tage) |
| **Notfall-Purge** | Owner setzt `purge_allowed = true`, danach sofort löschen | Nur Owner | Ja | Schlüssel kompromittiert |
| **Storage-Rebate (System)** | IOTA löscht sehr lange ungenutzte Objekte (~1–2 Jahre) | Automatisch | Ja an letzten Owner | Nur vergessene Objekte |

**CLI-Beispiele (ohne App):**

```powershell
# Mailbox: Einzelne Nachricht purgen (nonce = Message-Nonce)
iota client call --package <PACKAGE_ID> --module messaging --function purge_message --args <MAILBOX_ID> <recipient> <sender> <nonce> --gas-budget 5000000

# Vault: Notfall-Flag setzen, dann purgen
iota client call --package <PACKAGE_ID> --module messaging --function enable_emergency_purge --args <VAULT_REGISTRY_ID> --gas-budget 5000000
iota client call --package <PACKAGE_ID> --module messaging --function purge_vault --args <VAULT_REGISTRY_ID> <owner_address> --gas-budget 5000000

# AccessKey: Notfall-Purge aktivieren, dann Key löschen (keyObjectId aus AccessKeyCreated-Event)
iota client call --package <PACKAGE_ID> --module messaging --function enable_emergency_purge_key --args <ACCESS_KEY_OBJECT_ID> --gas-budget 5000000
iota client call --package <PACKAGE_ID> --module messaging --function purge_key --args <ACCESS_KEY_OBJECT_ID> --gas-budget 5000000

# Ticket: Besitzer aktiviert Emergency-Purge, dann löschen (Refund/Rückgabe). Oder nach Ablauf purgen.
iota client call --package <PACKAGE_ID> --module messaging --function enable_emergency_purge_ticket --args <TICKET_OBJECT_ID> --gas-budget 5000000
iota client call --package <PACKAGE_ID> --module messaging --function purge_ticket --args <TICKET_OBJECT_ID> --gas-budget 5000000
```

**In der App (Chat):** `/purge-handshake`, `/purge-msg <nonce>`, `/emergency-purge` (Vault), `/emergency-purge-key <keyObjectId>`, `/purge-key <keyObjectId>`.

**Messenger-Notfall-Purge (UI / `/emergency-purge`):** Entfernt den **Vault-Eintrag auf der Chain** und schreddert den **lokalen Klartext-Inbox-Cache** (`.inbox.enc`). Die **verschlüsselte Vault-Datei** auf dem Datenträger (z. B. `.morgendrot-vault`) wird **nicht** automatisch gelöscht – bei vollständiger Gerätereinigung manuell entfernen. Drei Umfänge in der UI (Voll / nur Cache / nur Sperren): siehe **`docs/NOTFALL-PURGE-MESSENGER.md`**. **Operative Notfall-Reichweite** (wen man per LoRa/IOTA erreicht, Brücken zu 112, Backlog Meshtastic-Klartext-SOS): **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**. **Zielbild** Vault in einem Bild / App-Icon zu tarnen (Steganographie): kritische Einordnung in **`docs/VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md`** (nicht Ersatz für Passwort/Backup; Release-Icons ≠ persönlicher Träger). **Einsatz-Ende, Purge vs. Shred, PDF/Chain-Redundanz:** **`docs/EINSATZ-VAULT-PURGE-PDF-REDUNDANZ-ZIELBILD.md`**. **Rettung/Einsatz:** Träger pro Rolle, Beschriftung, Organisation — **`docs/VAULT-TRAEGERBILD-EINSATZ-ORGANISATION.md`**.

---

## 12. M2M: NFT als digitaler Schlüssel (Tür / Zugang)

**AccessKey** = owned NFT für ein Schloss (`lock_id`), mit TTL und Notfall-Purge.

- **create_access_key(lock_id, recipient, ttl_days)** — Schlüssel ausstellen, an recipient übertragen.
- **enable_emergency_purge_key(key)** — Besitzer aktiviert sofortige Löschung.
- **purge_key(key)** — löschen (Besitzer, Issuer, nach Ablauf oder bei Emergency).

### Was ist „create-key“? Funktion und Nutzen

**Zweck:** Ein **AccessKey** ist ein **digitaler Schlüssel (NFT)** für ein bestimmtes **Schloss** (Tür, Gerät). Nur wer einen gültigen AccessKey für dieses Schloss besitzt, darf vom Lock die Aktion „open“ auslösen.

**Ablauf in Kurzform:**
1. **Issuer** (z. B. du als Besitzer des Schlosses) stellt einen Key aus: **`/create-key <lock> <recipient> [ttl]`**.
2. Der **recipient** erhält den Key als NFT (owned object) auf seiner Adresse.
3. **Lock** (Schloss mit `ROLE=lock`, `LOCK_ID = <lock>`) hört auf verschlüsselte „open“-Befehle.
4. Nur wenn der **Sender** einen gültigen AccessKey für dieses **lock** hat (gleiche lock_id, nicht abgelaufen), führt das Schloss „OPEN“ aus (optional OPEN_COMMAND/OPEN_URL).
5. Nach **TTL** (Tage) ist der Key abgelaufen; vorher kann der Besitzer ihn mit **`/emergency-purge-key`** + **`/purge-key`** notfallmäßig löschen (Rebate).

**Parameter:**

| Parameter | Bedeutung |
|-----------|-----------|
| **lock** | Adresse des Schlosses (meist = MY_ADDRESS der Lock-Instanz, also `LOCK_ID`). Der Key gilt nur für dieses eine Schloss. |
| **recipient** | Adresse, die den Key erhalten soll (Wallet des Nutzers oder eines Geräts). |
| **ttl** | Gültigkeit in **Tagen** (optional; sonst `DEFAULT_KEY_TTL_DAYS` aus .env). Nach Ablauf kann der Key gepurged werden, „open“ wird verweigert. |
| **anzahl** | Nur bei `/create-keys`: wie viele Keys in einem Rutsch ausgestellt werden (gleicher lock, recipient, ttl). |

**Beispiele:**

- Ein Key für Schloss `0x0748…` an Nutzer `0x671b…`, 30 Tage:  
  `/create-key 0x0748329ee31e531f5f13fa56b8f42f5173f5518c4dc00e9a090132b1d3c495c5 0x671bf669a858c97a1ca7ed3c5c31901ffb671ceea31e8fd706d0b6e2cb8a15c5 30`
- Fünf Keys, 90 Tage:  
  `/create-keys 0x0748… 0x671b… 90 5`

### Ablauf konkret: Wie öffnet der Nutzer (0x671b) das Schloss (0x0748)?

**Ausgangslage:** Das **Schloss** hat die Adresse **0x0748…** (z. B. ein Rechner/ESP mit `ROLE=lock`, `LOCK_ID=0x0748…`, `MY_ADDRESS=0x0748…`). Der **Nutzer** hat die Adresse **0x671b…** (z. B. die andere Morgendrot-Instanz als Messenger).

| Schritt | Wer | Was passiert |
|--------|-----|----------------|
| **1** | Du (Issuer, z. B. Schloss-Besitzer) | Du stellst einen Key aus: `/create-key 0x0748… 0x671b… 30`. Damit sagst du: „Schloss **0x0748** darf von Adresse **0x671b** geöffnet werden, 30 Tage gültig.“ Der Key landet als **NFT auf der Adresse 0x671b** (der Nutzer „besitzt“ ihn). |
| **2** | Schloss (0x0748) | Läuft mit `ROLE=lock`, `LOCK_ID=0x0748…`. Startet, fragt nach Passwort (Vault), hört dann auf **Handshakes** und auf verschlüsselte **„open“-Nachrichten** an Adresse 0x0748. |
| **3** | Nutzer (0x671b) | **Handshake an das Schloss:** z. B. `/handshake 0x0748…` oder im Chat mit dem Schloss (wenn das Schloss als Partner eingebunden ist) zuerst Verbindung herstellen. Dadurch kennt der Nutzer den Kanal zum Schloss (verschlüsselt). |
| **4** | Nutzer (0x671b) | Sendet **verschlüsselt** die Nachricht **„open“** (oder „öffnen“) **an 0x0748**. Das passiert z. B. im Chat, wenn 0x0748 als Partner eingebunden ist – dann tippt der Nutzer einfach `open` und sendet. |
| **5** | Schloss (0x0748) | Empfängt die verschlüsselte Nachricht. **Prüft on-chain:** Hat der **Sender (0x671b)** einen **gültigen AccessKey** für **lock_id = 0x0748** (und nicht abgelaufen)? Wenn **ja** → **OPEN GRANTED**, das Schloss führt optional **OPEN_COMMAND** oder **OPEN_URL** aus (z. B. Relais, Webhook). Wenn **nein** → „OPEN verweigert … hat keinen gültigen AccessKey“. |

**Kurz:** 0x0748 = das Schloss (die Tür/ das Gerät). 0x671b = der Nutzer, der den Key **besitzt**. Der Nutzer öffnet, indem er **erst Handshake mit dem Schloss** macht (damit verschlüsselte Kommunikation steht) und dann die **Nachricht „open“ an die Schloss-Adresse** sendet. Das Schloss prüft, ob der Absender (0x671b) einen gültigen AccessKey für dieses Schloss hat – nur dann wird geöffnet.

**Wer kann Keys ausstellen?** Jeder, der eine Transaktion signieren kann (z. B. der Schloss-Besitzer oder ein Admin). Der **Issuer** wird on-chain gespeichert; Issuer darf den Key später auch purgen (z. B. bei Verlust/Diebstahl).

**Hinweis:** Wenn die TX mit `(failure)` endet, prüfe Gas-Budget, ob lock/recipient gültige Adressen sind und ob das Move-Package aktuell deployed ist.

### Rollen

- **ROLE=messenger** (Standard): Chat, `/create-key(s)`, Purge usw.
- **ROLE=lock**: Diese Instanz = **Schloss**. `MY_ADDRESS` = Schloss-Adresse. Hört auf „open"; prüft **AccessKey**-NFT des Senders (lock_id, nicht abgelaufen) → bei gültigem Key „OPEN GRANTED" (optional OPEN_COMMAND/OPEN_URL).
- **ROLE=arbeiter**: Wie Lock; AUTHORIZED_SENDERS aus BOSS_ADDRESS + KOMMANDANT_ADDRESSES (falls nicht explizit).
- **ROLE=boss**: Messenger; `/connect` verbindet mit KOMMANDANT_ADDRESSES. Senden an alle.
- **ROLE=kommandant**: Messenger; `/connect` verbindet mit BOSS_ADDRESS + WORKER_ADDRESSES. `MY_ADDRESS` = Schloss-Adresse. Hört auf „open“; prüft **AccessKey**-NFT des Senders (lock_id, nicht abgelaufen) → bei gültigem Key „OPEN GRANTED“ (optional OPEN_COMMAND/OPEN_URL).

### Woher weiß das Schloss, dass „open“ = Tür öffnen? Befehlsliste

Das Schloss entschlüsselt die Nachricht und vergleicht den **Text** (kleingeschrieben) mit einer **Liste erlaubter Wörter**. Trifft eines zu (z. B. `open` oder `öffnen`) und der Sender hat einen gültigen AccessKey, wird die Öffnungs-Aktion ausgeführt (OPEN_COMMAND / OPEN_URL).

**Drei Quellen (Priorität):** Das Schloss lädt die Liste in dieser **Reihenfolge** – sobald eine Quelle gültige Werte liefert, wird sie genutzt:

1. **On-Chain (CommandRegistry)** – wenn `COMMAND_REGISTRY_ID` und `PACKAGE_ID` gesetzt sind und für diese Lock-Adresse Einträge existieren.
2. **AES-Datei** – wenn `OPEN_COMMAND_LIST_FILE` und `OPEN_COMMAND_LIST_KEY` (32-Byte-Hex) gesetzt sind und die Datei lesbar ist.
3. **.env** – sonst **`OPEN_COMMAND_WORDS`** (kommagetrennt, Kleinbuchstaben). Default: `open,öffnen`.

```env
OPEN_COMMAND_WORDS=open,öffnen,unlock,entriegeln
```

Es werden keine weiteren Befehle (z. B. „close“) ausgewertet; aktuell gibt es nur diese eine Aktion „Tür öffnen“.

### Wo die Befehlsliste liegen soll: lokal vs. On-Chain vs. lokale AES (umgesetzt)

| Variante | .env / Konfiguration | Beschreibung |
|----------|----------------------|--------------|
| **On-Chain** | `COMMAND_REGISTRY_ID`, `PACKAGE_ID` | Lock liest beim Start aus dem CommandRegistry (Dynamic Field pro lock_id). Nur die **Lock-Adresse** darf per Move `set_open_words` die Wörter setzen/ersetzen. |
| **AES-Datei** | `OPEN_COMMAND_LIST_FILE`, `OPEN_COMMAND_LIST_KEY` | Datei = 12 Byte IV + AES-256-GCM Ciphertext (Inhalt = kommagetrennte Wörter, z. B. `open,öffnen`). Key = 64 Hex-Zeichen (32 Bytes). |
| **Lokal (.env)** | `OPEN_COMMAND_WORDS` | Kommagetrennte Liste. Wird genutzt, wenn weder On-Chain noch AES-Datei konfiguriert sind. |

**On-Chain setzen:** Nach Deploy liefert `create_globals` (oder für Alt-Deployments `create_command_registry`) die **command_registry_id**. In .env: `COMMAND_REGISTRY_ID=0x…`. Die **Lock-Adresse** (z. B. LOCK_ID) ruft dann per Transaktion `set_open_words(registry, lock_id, words)` auf – `words` = kommagetrennte Bytes, z. B. `open,öffnen,unlock`. Beispiel CLI (Lock = Absender):

```powershell
# words als Hex der UTF-8-Bytes (z. B. "open,öffnen" → 6f70656e2c c3b66666 6e656e)
iota client call --package <PACKAGE_ID> --module messaging --function set_open_words --args <COMMAND_REGISTRY_ID> <LOCK_ID> <WORDS_HEX_OR_BCS> --gas-budget 5000000
```

*(Hinweis: Je nach CLI muss `words` als BCS-vector<u8> übergeben werden; ggf. kleines Skript nutzen, das die TX baut und signiert.)*

**AES-Datei erzeugen:** Inhalt = ein String, kommagetrennt (z. B. `open,öffnen`). 32-Byte-Key (64 Hex-Zeichen) wählen, z. B. `openssl rand -hex 32`. Mit AES-256-GCM verschlüsseln: 12 Byte IV (zufällig), dann Ciphertext inkl. 16-Byte-Tag. Datei = IV || Ciphertext. In .env: `OPEN_COMMAND_LIST_FILE=/pfad/zur/datei`, `OPEN_COMMAND_LIST_KEY=<64 Hex-Zeichen>`.

### .env für Lock

```env
ROLE=lock
LOCK_ID=0x...
MY_ADDRESS=0x...
PACKAGE_ID=0x...
VAULT_FILE=.morgendrot-vault
REPLAY_STATE_FILE=.morgendrot-replay-state
# OPEN_COMMAND=node relay-on.js
# OPEN_URL=https://smartlock.local/open
# OPEN_COMMAND_WORDS=open,öffnen,unlock,entriegeln
# Optional – On-Chain-Befehlsliste (Priorität vor AES/ENV): COMMAND_REGISTRY_ID=0x...
# Optional – AES-Datei: OPEN_COMMAND_LIST_FILE=/pfad/open-words.enc OPEN_COMMAND_LIST_KEY=<64 Hex>
# Optional – Streams letzte Meile: OPEN_STREAMS_ENABLED=true, STREAMS_LISTEN_ENABLED=true, STREAMS_ANCHOR_ID=… (docs/STREAMS-INTEGRATION.md §3a–3b)
# Optional – Zahlungs-Trigger: PAYMENT_TRIGGER_ENABLED=true, PAYMENT_TRIGGER_MIN_IOTA=0.001, PAYMENT_TRIGGER_STATE_FILE=.morgendrot-payment-state
```

### NFT (AccessKey) aus der App – konfigurierbar

| Einstellung | Wo |
|------------|-----|
| **Anzahl** | `/create-keys <lock> <recipient> [ttl] [anzahl]` |
| **TTL** | Parameter `ttl` oder `.env` **DEFAULT_KEY_TTL_DAYS** |
| **Notfall-Purge** | Move: `enable_emergency_purge_key` + `purge_key` (Key-Besitzer) |

- **`/create-key <lock> <recipient> <ttl>`** — ein Schlüssel.
- **`/create-keys <lock> <recipient> [ttl] [anzahl]`** — mehrere; fehlt `ttl`, wird `DEFAULT_KEY_TTL_DAYS` verwendet.

Beispiel: 5 Schlüssel, 90 Tage:  
`/create-keys 0x…Lock 0x…User 90 5`

**Auslagern:** Für komplexe Policies (viele Schlösser, Auto-Verlängerung) eigenes Tool/Skript mit denselben Move-Calls – Chain-API bleibt gleich.

### Tickets (optional, Einlass / Veranstaltung)

**Ticket** = purgbares, zeitgebundenes NFT für Einlass (event_id = Gate/Veranstaltung). Einmalnutzung durch `used`-Flag; nach Einlass kann das Ticket nicht erneut genutzt werden.

**Move-Funktionen:**

| Funktion | Bedeutung |
|----------|-----------|
| **create_ticket**(event_id, valid_from_ms, valid_until_ms, metadata, recipient) | Issuer (sender) stellt Ticket aus; es wird an recipient transferiert. metadata = vector&lt;u8&gt; (z. B. Sitzplatz, Kategorie). |
| **use_ticket**(ticket, event_id) | Nur Besitzer (hält das Ticket-Objekt). Prüft: event_id stimmt, jetzt im Zeitfenster, !used. Setzt danach used = true. |
| **enable_emergency_purge_ticket**(ticket) | Nur Besitzer; setzt purge_allowed = true (Rückgabe/Refund). |
| **purge_ticket**(ticket) | Nur Owner kann das Objekt übergeben. Erlaubt: !used (Refund), purge_allowed (Emergency), oder now &gt; valid_until_ms (Rebate nach Ablauf). |

**TS (chain-access.ts):** **hasValidTicket(client, packageId, ownerAddress, eventId)** – liefert true, wenn ownerAddress ein gültiges, ungenutztes Ticket für eventId besitzt (Zeitfenster, used === false). Für Gate/Einlass: zuerst hasValidTicket prüfen, dann Besitzer kann use_ticket aufrufen.

**DLT/Blockchain – Ticket im Wallet:** Ja. Tickets und AccessKeys sind **on-chain NFTs** (Owned Objects). Bei `create_ticket` bzw. `create_access_key` wird das Objekt per `transfer::transfer(..., recipient)` an die Empfänger-Adresse übertragen. Der Empfänger **besitzt** das Ticket/Key in seinem Wallet (seine Adresse = Owner on-chain). Vollständig DLT – kein zentraler Server. Ticket teilen = Objekt-ID weitergeben oder `/transfer-ticket` an neue Adresse. Siehe **`docs/TICKET-FEATURES.md`**.

**Ablauf (kurz):** (1) Veranstalter/Issuer ruft create_ticket auf (event_id = Gate-Adresse, valid_from/valid_until in ms, recipient = Käufer). (2) Am Einlass: Gate prüft hasValidTicket(Käufer, event_id). (3) Käufer signiert use_ticket(ticket, event_id) (z. B. per App/QR) → used = true. (4) Optional: ungenutztes Ticket zurückgeben = enable_emergency_purge_ticket + purge_ticket; oder nach Event-Ende purge_ticket (Rebate).

**CLI-Beispiele (Zeiten in Millisekunden, z. B. valid_from = 0, valid_until = jetzt + 7 Tage):**

```powershell
# Ticket ausstellen (metadata z. B. leeres vector<u8> oder BCS-kodiert)
iota client call --package <PACKAGE_ID> --module messaging --function create_ticket --args <EVENT_ID> <VALID_FROM_MS> <VALID_UNTIL_MS> <METADATA_BCS> <RECIPIENT> --gas-budget 5000000

# Einlass: Besitzer ruft use_ticket auf (Ticket-Objekt als Argument)
iota client call --package <PACKAGE_ID> --module messaging --function use_ticket --args <TICKET_OBJECT_ID> <EVENT_ID> --gas-budget 5000000

# Refund: Besitzer aktiviert Emergency, dann purge
iota client call --package <PACKAGE_ID> --module messaging --function enable_emergency_purge_ticket --args <TICKET_OBJECT_ID> --gas-budget 5000000
iota client call --package <PACKAGE_ID> --module messaging --function purge_ticket --args <TICKET_OBJECT_ID> --gas-budget 5000000
```

Details und Sicherheitsbewertung: **`docs/TICKET-REVIEW.md`**.

### M2M-Ablauf (Kurz)

1. Schloss startet mit `ROLE=lock`, `LOCK_ID=0x…`.
2. Issuer stellt Keys aus: `/create-key 0x…Lock 0x…User 30` oder `/create-keys … [anzahl]`.
3. Key-Halter: Handshake an Schloss, dann verschlüsselt „open“ senden.
4. Schloss prüft AccessKey (lock_id, expires_at_ms) → OPEN ausführen.
5. Notfall: Issuer/Besitzer ruft `purge_key` / `enable_emergency_purge_key` auf.

### On-Chain-Vault + Purge (App)

- `/vault-onchain` — Keys on-chain speichern (TTL).
- `/emergency-purge` — Notfall-Purge Vault (enable + purge).
- `/purge-handshake`, `/purge-msg <nonce>` — Mailbox aufräumen (Storage-Rebate).
- `/emergency-purge-key <keyObjectId>` — AccessKey: Notfall-Purge aktivieren (nur Besitzer).
- `/purge-key <keyObjectId>` — AccessKey löschen (nach Emergency, Ablauf oder als Issuer; Rebate ~90–99 %). `keyObjectId` aus AccessKeyCreated-Event oder Explorer.

**Hinweis:** Wenn „No function was found with function name enable_emergency_purge_key“ (oder `purge_key`) erscheint, wurde das Move-Package **vor** Hinzufügen dieser Funktionen deployed. Dann: `move-test` neu bauen, Package erneut publizieren und die neue **PACKAGE_ID** in .env eintragen.

### Warum manche Chat-Befehle „nicht verfügbar“ sind

Einige Befehle brauchen in der **.env** gesetzte Werte oder Parameter. Fehlt etwas, zeigt die App eine klare Meldung statt „Unbekannter Befehl“. Hier die Erklärungen:

---

**„VAULT_FILE nicht gesetzt – /vault-save nicht verfügbar.“**

- **Befehl:** `/vault-save`
- **Bedeutung:** Mit `/vault-save` speicherst du deine **Messaging-Keys** (ECDH-Keypair) **lokal** in einer Datei – verschlüsselt mit deinem Wallet-Passwort. So bleiben die Keys über Neustarts gleich, und der Shared Secret mit dem Partner bleibt stabil (sonst würden bei jedem Start neue Keys erzeugt und der Partner müsste neu handshaken).
- **Warum VAULT_FILE nötig ist:** Die App muss wissen, **wo** die Vault-Datei liegen soll. Ohne `VAULT_FILE` gibt es keinen Zielpfad; der Befehl wird deshalb abgelehnt.
- **Was tun:** In der .env setzen, z. B. `VAULT_FILE=.morgendrot-vault`. Die Datei wird im Projektordner angelegt (oder im angegebenen Pfad). Optional kannst du einen absoluten Pfad angeben.

---

**„MAILBOX_ID nicht gesetzt – /purge-handshake nicht verfügbar.“**

- **Befehl:** `/purge-handshake`
- **Bedeutung:** Handshakes können **entweder** nur als **Events** auf der Chain liegen (dann nicht purgebar) **oder** in einer **shared Mailbox** (purgebar). `/purge-handshake` löscht den Handshake-Eintrag zwischen dir und dem aktuellen Chat-Partner **in der Mailbox** und gibt Storage-Rebate zurück.
- **Warum MAILBOX_ID nötig ist:** Purge geht nur gegen das **Mailbox-Objekt** (shared object). Dessen ID steht in `MAILBOX_ID`. Ohne Mailbox gibt es keinen purgebaren Handshake – nur Events.
- **Was tun:** Einmalig `create_globals` auf der Chain ausführen, aus dem Event **mailbox_id** auslesen und in .env eintragen: `MAILBOX_ID=0x…`. Zusätzlich muss das Move-Package die Mailbox-Funktionen nutzen (z. B. `store_ecdh_init` statt nur `emit_ecdh_init`).

---

**„Verwendung: /purge-msg <nonce> (Nonce aus Event/Explorer).“**

- **Befehl:** `/purge-msg` **ohne** Nonce (z. B. nur `/purge-msg` eingegeben)
- **Bedeutung:** `/purge-msg` löscht **eine konkrete Nachricht** aus der Mailbox (Storage-Rebate). Jede Nachricht hat eine **Nonce** (z. B. Zeitstempel beim Senden). Die Nonce identifiziert die Nachricht eindeutig (zusammen mit Sender/Empfänger).
- **Warum die Nonce nötig ist:** Die Move-Funktion `purge_message` erwartet `(mailbox, recipient, sender, nonce)`. Ohne Nonce weiß die App nicht, welche Nachricht gepurged werden soll.
- **Was tun:** Nonce aus dem **Explorer** oder aus den **Events** der Chain holen (bei `EncryptedMessage` steht `nonce` im Event). Beispiel: `/purge-msg 1772547397119`.

---

**„MAILBOX_ID nicht gesetzt – /purge-msg nicht verfügbar.“**

- **Befehl:** `/purge-msg <nonce>` mit gültiger Nonce, aber **ohne** Mailbox-Konfiguration
- **Bedeutung:** Wie bei `/purge-handshake`: Purge von Nachrichten geht nur, wenn die Nachrichten in der **Mailbox** liegen (nicht nur als Events). Dann kann man sie gezielt per Nonce löschen.
- **Warum MAILBOX_ID nötig ist:** Die Move-Funktion arbeitet auf der Mailbox (shared object). Ohne `MAILBOX_ID` gibt es keinen Zugriff auf dieses Objekt.
- **Was tun:** Wie oben: `MAILBOX_ID` in .env setzen (aus `create_globals`-Event). Wenn du nur Events nutzt (ohne Mailbox), sind Nachrichten nicht purgebar – dann ist der Befehl in dieser Konstellation nicht nutzbar.

---

**„VAULT_REGISTRY_ID nicht gesetzt – /vault-onchain nicht verfügbar.“**

- **Befehl:** `/vault-onchain`
- **Bedeutung:** Mit `/vault-onchain` speicherst du deine **verschlüsselten Messaging-Keys** **on-chain** im **VaultRegistry** (shared object). So kannst du von einem anderen Gerät aus mit demselben Passwort die Keys laden, ohne eine lokale Vault-Datei zu kopieren.
- **Warum VAULT_REGISTRY_ID nötig ist:** Das VaultRegistry ist ein shared Object auf der Chain. Seine **Objekt-ID** muss in `VAULT_REGISTRY_ID` stehen, damit die App die Move-Calls `create_vault` / `update_vault` an das richtige Objekt richten kann.
- **Was tun:** Einmalig `create_globals` ausführen, aus dem Event **vault_registry_id** auslesen und in .env eintragen: `VAULT_REGISTRY_ID=0x…`. Ohne dieses Objekt gibt es keinen on-chain Vault – der Befehl bleibt dann deaktiviert.

---

## 13. Layer-Trennung (Code)

| Layer | Datei |
|-------|--------|
| Crypto | `crypto-layer.ts` — ECDH, AES-GCM (ohne Chain) |
| Chain | `chain-access.ts` — einzige Stelle für alle IOTA-TXs (RPC, signAndExecute, sendEcdhInit, storeEncryptedMessage, purge*, createAccessKey, getVaultFromChain, getHandshakeFromMailbox, findPeerHandshake, hasValidAccessKey, queryIncomingPayments) |
| Vault | `vault-local.ts` — Keys mit Passwort speichern/laden, loadVaultFromChainPayload |
| Befehlsliste (AES) | `read-command-list.ts` — Öffnen-Wörter aus AES-verschlüsselter Datei laden |
| Replay | `replay-state.ts` — Nonce pro Sender |
| Messenger | `wallet-bridge.ts` — Befehle, Handshake, Chat |
| Lock | `m2m-lock.ts` — Handshakes, „open“, AccessKey-Prüfung, OPEN_COMMAND/OPEN_URL |
| Passwort | `read-password.ts` — maskierte Eingabe |
| Secrets (optional) | `load-secrets.ts` — verschlüsselte Env-Datei (PBKDF2 + AES-GCM wie Vault) |
| **Tickets** (optional) | Move: `Ticket`, create_ticket, use_ticket, purge_ticket. TS: `chain-access.ts` → hasValidTicket(owner, event_id). Siehe `docs/TICKET-REVIEW.md`. |

---

## 14. Skripte

| Skript | Zweck |
|--------|--------|
| `npm run boss-signer` | HTTP-Service für Remote-Signatur (POST `/sign`). |
| `npm run boss-provision-handshake` | Handshake beim Boss-Provisioning senden (--address, --partner, --pubkey). |
| `npm start` / `npm run start:backend` | App starten; mit ENCRYPTED_ENV_FILE: Passwort für Secrets-Datei beim Start. |
| `npm run encrypt-env -- <eingabe.txt> [ausgabe.enc]` | Erzeugt verschlüsselte Secrets-Datei (gleiche Krypto wie Vault). |

### Keys/Passwörter nicht in .env (Betriebsrisiko verringern)

Vollständige Gegenüberstellung: **`docs/SECRETS-OPTIONS.md`** (Option A/B/C; **C** = Doppler & Co., kritische RAM-Grenzen).

- **Option A – Rebased:** Verschüsselte Blobs on-chain; ein Passwort beim Start entschlüsselt. .env ohne Secrets; RPC beim Start nötig.
- **Option B – Verschlüsselte .env (umgesetzt):** Secrets in verschlüsselter Datei; .env bleibt ohne sensible Werte.

**Option B – Schritt für Schritt:**

1. **Secrets-Datei anlegen** (Klartext, nur lokal): z. B. `secrets.txt` mit einer Zeile pro Variable:
   ```
   REMOTE_SIGNER_TOKEN=dein-token
   OPEN_COMMAND_LIST_KEY=0123456789abcdef...
   ```
2. **Verschlüsseln:**  
   `npx tsx scripts/encrypt-env.ts secrets.txt .env.secrets.enc`  
   Passwort eingeben (wird für PBKDF2 + AES-GCM genutzt, wie beim Vault).
3. **.env anpassen:** Alle **nicht-sensiblen** Werte in .env (RPC_URL, PACKAGE_ID, ROLE, …). Zusätzlich:  
   `ENCRYPTED_ENV_FILE=.env.secrets.enc`  
   Die sensiblen Werte stehen **nur** in `secrets.txt` (danach löschen oder sicher aufbewahren) bzw. in `.env.secrets.enc`.
4. **App starten:**  
   `npm start` (oder `npm run start:backend`).  
   Beim Start wird nach dem **Secrets-Passwort** gefragt; danach läuft die App wie gewohnt mit allen Variablen aus .env + entschlüsselter Datei.

---

## 15. Ist-Stand (Checkliste, kurz)

| Thema | Stand |
|-------|--------|
| Hardware (OPEN) | OPEN_COMMAND / OPEN_URL, spawn ohne Shell |
| Verschlüsselung M2M | ECDH P-256, AES-GCM, Handshake + Nachrichten on-chain |
| Vault | Lokal + On-Chain, TTL + Emergency-Purge |
| Öffnen-Befehlsliste | Drei Quellen: On-Chain (CommandRegistry), AES-Datei, .env (OPEN_COMMAND_WORDS); Priorität siehe Abschnitt 12 |
| Replay / Auto-Befehle-Schutz | Nonce pro Sender; AccessKey (Lock); ENABLE_AUTO_EXECUTE, AUTHORIZED_SENDERS, MAX_SEND_AMOUNT_IOTA; Zahlungs-Trigger optional (PAYMENT_TRIGGER_*, Replay via STATE_FILE) |
| Tickets (optional) | create_ticket, use_ticket, purge_ticket; hasValidTicket in TS; siehe Abschnitt 12 und docs/TICKET-REVIEW.md |
| Secrets ohne .env (optional) | Option B: ENCRYPTED_ENV_FILE, encrypt-env; Option A (Rebased); Option C (Doppler/VPS) in docs/SECRETS-OPTIONS.md |
| Modular (ENABLE_*) | USE_MAILBOX, ENABLE_REPLAY_PROTECTION, ENABLE_HARDWARE_OPEN, ENABLE_FILE_LOGGING |
| SPOF, Krypto | **SPOF = Seed + Wallet-Passwort**; nur bewährte Krypto; kein exec/shell (siehe Abschnitt 8) |
| Test-Checkliste | **`TESTING.md`** – alle Funktionen nacheinander testen und abhaken |
| Sicherheitsbewertung | **`SECURITY-RATING.md`** – Bewertung der Layer (Sicherheit/Logik) |

Weitere Details: Quelldateien, **`.env.example`** (alle Optionen), **`docs/`** (SECRETS-OPTIONS, TICKET-REVIEW).

---

## 16. Lean Layer / Minimaler Code pro Einsatzmöglichkeit

**Für bestimmte Aufgaben kannst du weniger Layer und Code nutzen.** Nicht jeder Einsatz braucht Messenger, Chat, UI oder Streams. Die Haupt-App ist modular – viele Funktionen sind per ROLE und ENABLE_* abschaltbar. Für ressourcenarme Geräte (ESP, Raspberry Pi) oder minimale Deployments gilt:

| Einsatzmöglichkeit | Benötigt (minimal) | Optional |
|--------------------|--------------------|----------|
| **Lock-only** | config, crypto, chain-access, vault-local, m2m-lock, read-command-list, replay-state, utils | Streams, API/UI |
| **Chat** | config, crypto, chain-access, vault-local, wallet-bridge (Messenger), replay-state, utils | Streams, Mailbox, API/UI |
| **Ticket ausstellen** | config, crypto, chain-access, vault-local, wallet-bridge (create-key), utils | API/UI |
| **Monitor (Offline-Alarm)** | config, chain-access, wallet-bridge (ROLE=monitor), utils | Streams, Webhook |
| **Fetch only** | config, crypto, chain-access, vault-local, wallet-bridge (fetch), utils | API/UI |
| **Vault** | config, crypto, chain-access, vault-local | API/UI |
| **Boss-Signer** | boss-signer.ts (Standalone-Skript) | – |
| **Zahlungs-Trigger** | wie Lock + PAYMENT_TRIGGER_* | – |

**Praktisch:** Die Haupt-App mit `ROLE=lock` oder `ROLE=monitor` deckt alle Fälle ab – du schaltest nur ab, was du nicht brauchst (ENABLE_UI=false, STREAMS_LISTEN_ENABLED=false, etc.). Ein separater **tur/**-Ordner (Lock-only, ohne Messenger) war früher im Repo – aktuell nicht enthalten. Bei Bedarf: ROLE=lock in der Haupt-App genügt; für minimalen Footprint könnte tur wiederhergestellt werden.

**Sicherheitshinweis (Code-Generator):** Ein „Erstelle Basiscode für Projekt XX“-Feature, das Code aus Nutzereingabe generiert, wäre **kritisch** (Template-Injection, unsichere Ausgabe). Stattdessen: feste Templates (z. B. tur/) kopieren oder die obige Tabelle nutzen – keine dynamische Code-Generierung. Die UI zeigt pro Projekt den „Minimalen Einsatzzweck“ (Lean Profile) als Dokumentation, keine Datei-Erzeugung.
