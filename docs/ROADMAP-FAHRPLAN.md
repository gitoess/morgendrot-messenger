# Fahrplan Morgendrot (Arbeitsliste & Status)

**Zweck:** **Priorisierte** Lieferliste – nur was **Nutzen** bringt; **geringer Aufwand** oben.  
**Übergeordnet:** Phasen **A → B → C** in **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** (Meshtastic-First, kein Feature-Wildwuchs).  
**Stand:** 2026-03 / **aktualisiert 2026-03-28** — **§ H.18** TTS/STT (Barrierefreiheit / Freihand, Backlog); **§ H.17** Dashboard/Volldashboard vs. Boss-Ansicht (**Nachtrag**); **§ H.16** Telefonbuch / QR-Onboarding / Boss-LAN (**Nachtrag**); zuvor **2026-04-28** — **§ H.15** Handy-first / Client-IOTA / optionaler Node (**`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**, **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** § 6) — **§ H.6b–H.6f** Resilience, Cold-Start, Umzug-Zeitfenster, **Konfiguration (.env vs. Runtime)**, **Android FG-Service + minimale Sync-Ehrlichkeit** (**`docs/ANDROID-FOREGROUND-SERVICE-MINIMAL-SYNC.md`**, **§ H.6f**) — **§ C.0/C.0b** Gliederung + **kanonische Ausführungsreihenfolge** — **§ H.3n** SOS / **`MORG_EMERGENCY_V1`** **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** — **§ H.1b** Messenger-UI-Modularität **`docs/MESSENGER-UI-MODULARITY-STRATEGY.md`**; **§ H.12** Sync/Source-of-Truth **`SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**; **§ H.11** Offline-Karten **`OFFLINE-KARTEN-UND-GEODATEN-ZIELBILD.md`**; **§ H.10** Sicherheit/Vertrauen **`ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`**; **§ H.10b** Boss/Arbeiter-Seed (Team vs. dezentral) **`docs/BOSS-WORKER-SEED-CUSTODY.md`**; **§ H.3l** Spike **Web Serial Android** + USB/BLE-Doku **`HELTEC-USB-SERIAL-VS-BLE-TRANSPORT.md`** (Mesh/BLE zuerst); **§ H.3m** LoRa/Notfall: **keine** volle IOTA-TX über Funk, Gateway **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`**; **§ H.3k** modularer Kern/Adapter/Interop **`MODULAR-KERN-ADAPTER-INTEROP.md`**; **§ H.3j** EU-Funk/Hardware/Einsatzprofile **`LORA-EU-FUNK-HARDWARE-EINSATZPROFILE.md`**; **§ G** Verweis **`NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**; Lite-Messenger **Boss-Ausnahme** in **§ H.0 #1** / **`UI-ROLLEN-WORKSPACES.md`** § 5; **§ H.9** ATAK/CoT-Backlog (**`ATAK-COT-INTEGRATION-ZIELBILD.md`**); Backend vs. IOTA-RPC + **kein Hybrid-Signatur-Pfad** **`BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** § 6; **§ H.0**-Tabelle mit Status-Spalte; Box **„kompletter Plan?“** (Phase A/B/C, Heltec = B); **H.0:** Dashboard **„Erste Schritte“**, **`HELP_UI_INTRO`** in **`GET /api/help`**; **PWA:** **`docs/PWA-MANUAL-CHECKS.md`** (**§ H.2**); Onboarding **`docs/ONBOARDING-WALLET-UX-SPEC.md`**; Shop/Stripe **`docs/API-SHOP-SPEC.md`**, **`docs/STRIPE-TEST-SETUP.md`**, Credits/Shadow **`docs/CREDITS-SHADOW-SWEEP-AND-FULFILLMENT.md`**, Voucher **`docs/API-VOUCHER-CLAIM-SPEC.md`**, **`docs/VOUCHER-PRE-MINT-AND-SHOP.md`** §8; **`docs/OPERATIONS-SNAPSHOT-2026-03.md`**, **§ H.3c**, **§ H.3d**, **`TESTING.md`**; **Team-Rollenwechsel (Ist vs. Narrativ):** **`docs/ROLLENWECHSEL-TEAM-EINSATZ.md`**; **§ H.8:** zwei Installationen Dienst/Testnet (**`docs/DIENST-VS-PRIVAT-NETZ-PROFIL.md`**), Weiterarbeit **A→B**, Aufräumen = fortlaufend (**§ H.5**); **§ H.1a** Qualität/Baseline/Vitest/AppError **`PHASE-A-QUALITY-BASELINE-AND-TESTS.md`**; **§ H.14** Hardening V3 (**`docs/MORGENDROT-HARDENING-V3-PRECISION.md`**: PWA-Speicher, Lite-UI L2, Wipe, Idempotenz, PTB-Audit).  
**QR-Kontakt v2:** Spezifikation (optional Anchor, API-Basis, Gateway) → **`docs/QR-CONTACT-SCHEMA-V2.md`** (Implementierung später; siehe **H.3b**).  

**Nachtrag 2026-04-15:** Messenger-Realworld **`test:messages*`** — Abschnitt **`/vault-save`** nutzt Server-Sitzung nach UI-Unlock (kein `UNLOCK_PASSWORD_*` nötig); **`purge-handshake`**-Log bei fehlendem **`MAILBOX_ID`** als erwartbarer Noop gekennzeichnet; npm **`test:tickets-accesskey-realworld`** = Tickets/Keys (Alias zu **`test:realworld`**); Chain **`hasValidTicket`** / **`hasValidAccessKey`** mit **`normalizeAddress`** + Pagination, normalisierte IDs in **`getOwnedTickets`** / **`getOwnedAccessKeys`**; Ticket-Realworld-Skript Retries + ECONNREFUSED-Hinweis; **`npm run check:pwa-desk`** (**§ H.2** A+B). Siehe **`docs/CHAT-PROTOKOLL-2026-03-28.md`**.

**Nachtrag 2026-04-16:** **§ H.1b** — `pickInboxRawMessages` nach **`frontend/frontend/lib/inbox-pick-raw-messages.ts`** (Vitest); **`frontend/eslint.config.mjs`** ignoriert **`.next`** u. a. **§ H.2** — **`npm run check:pwa-desk:full`** (A+B+C) grün; **`frontend/next-env.d.ts`** verweist nach Production-Build auf **`./.next/types/routes.d.ts`**.

**Nachtrag 2026-04-16 (Mailbox „Persistent“ + Klartext-Pfad):** Umsetzung laut **`docs/MESSAGING-MAILBOX-SSOT-SPEC.md`**: UI-**Persistent**-Schalter (`localStorage` **`morgendrot.messagingPersistenceMode`**: `event` \| `mailbox`); **`forceLegacyPlaintext`** nicht mehr pauschal für Klartext erzwingen — nur bei Modus **„Schnell/Event“**; bei **„Anker/Mailbox“** `store_plaintext_message*` nutzen (`messenger-chain-wrap.ts`, `chain-access.ts`, ggf. Direct-Submit); **`use-chat-view-handle-send.ts`**, Transport-Karte, Vitest + **`TESTING.md`**-Ritual. **Reihenfolge:** Paket **vor** erneuten **LoRa-/Heltec-Feldtests** (**§ H.3**) einplanen; **LoRa** bewusst **hinten anstellen**, bis Mailbox-Sendepfad und Hybrid (**§ H.15**) konsistent sind.

**Nachtrag 2026-04-20 (Mesh-Interop + Forschung + UX):** **(1)** Feldtest **zweiter Morgendrot-Messenger** auf demselben Meshtastic-Kanal: **Empfang** älterer **Mesh v2 / PRIVATE_APP**-Nutzlasten bleibt möglich; **Produkt-Versand** verschlüsselt über App-LoRa ist abgeschaltet — **LUMA+CHROMA** im Composer nur **online + Verschlüsselung** oder **Funk + Pfad 4 (Klartext)** (siehe Nachtrag „verschlüsselter LoRa-Versand aus“ weiter unten). Fremdgerät ohne App: LongFast/Pfad 4 typischerweise sichtbar; Binary/v2 nicht als normaler Chat. **(2)** Backlog-Spike: **Offline-IOTA-Signatur** (Client) und **Übermittlung signierter Artefakte über LoRa** nur nutzlastarm/konzeptionell — Abgleich mit **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`** (**§ H.3m**), **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** § 6; keine volle TX über Funk. **(3)** Composer-**„Übertragung abbrechen“**: Abbruch an längeren `await`-Ketten (z. B. weiterhin `sendMeshV2WireBurst` **`beforeEachPacket`** wo im Code genutzt, Meshtastic-BLE, Mailbox).

**Nachtrag 2026-04-20 (S-ARQ UX):** **`MORG_SEG_V1`** im Next-Posteingang: **Kollaps** auf eine Leit-Zeile pro Session (`buildChatInboxRows`), **kein Roh-Wire** in der Sprechblase — **`MorgSegV1ChatSink`** (Ghost-Raster, JPEG nach Luma-/Chroma-Reassembly, NAK über Klartext-Mesh wie Composer). Spez/Wire: **`docs/LORA-MORGENDROT-S-ARQ-SPEC.md`**; Parser/Reassembly: `lora-sarq-parser.ts`, `lora-sarq-reassembly.ts`, `use-morg-seg-reassembly.ts`.

**Nachtrag 2026-03-28 (Unlock / Tresor L2):** **Next** (`frontend/frontend/components/dashboard.tsx`) und **Lite-UI** (`ui/index.html`): Modus **„Tresor öffnen“** vs. **„Neu anlegen“**, bei `SIGNER=sdk` Mnemonic/Secret **erst bei Bedarf** (Schaltfläche) oder wenn **`POST /api/unlock`** mit **`code: SIGNER_IMPORT_REQUIRED`** antwortet (`src/api-server.ts`). **Next-Tresor:** Checkbox **„Signer-Import mit speichern“** wie Lite (`vault-view.tsx`, `vault-commands.ts`). **Tests:** `frontend/frontend/lib/api/unlock-response-parse.ts` + **`unlock-response-parse.test.ts`**.

**Nachtrag 2026-04-28:** **Architektur-Pivot** — **Primärpfad** = Client-Signatur + **direkter IOTA-RPC-Upload** vom Handy (**local-first**, Offline-Queue); **Morgendrot-Node** nur noch **optional** (Relay, Sponsored Gas, Archiv, Komfort). Doku: **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** (§ 6 neu, § 7 historisch), **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**, Fahrplan **§ H.15**. Umsetzung **schrittweise**; **§ C.0b** (kein unkontrollierter Parallel-Bau zum Mesh-Kern).

**Merge-Ritual (Phase A):** **`TESTING.md`** § *Qualitätsritual vor Merge* — Root **`tsc`**, **`validate:ui`**, **`test:smoke`**; Ordner **`frontend/`** zusätzlich **`lint`**, **`check:circular`**, **`tsc`**, **`test:unit`**. **CI:** **`.github/workflows/frontend-checks.yml`**. **Handbuch:** nach Änderung an **`docs/BOSS-ORIENTIERUNG.md`** / **`PWA-HANDBUCH-OFFLINE.md`:** Root **`npm run sync:handbook`**.

**Reihenfolge ab 2026-03:** **Produkt/UX** (früher „später“) ist **jetzt vorangestellt** (**§ H.0**) – Handy-Einsatz, Entsperren und schlanke Oberfläche hängen daran; die **nummerierte 8-Punkte-Checkliste** (**§ A**) bleibt als **technische** Referenz (Bild/Audio … LoRa … Kabel-Bridge), wird aber **nicht** mehr strikt 1→8 abgearbeitet, wenn UX/Einsatz Vorrang hat. **Zuordnung § A ↔ § H:** siehe **§ A–H: Brücke** (unmittelbar unter dem Gesamtüberblick).

**Nächste konkrete Schritte:** Zuerst **§ C.0b** (Tabelle **Stufe 0–1**) **und** die **„nächsten drei“** am Schreibtisch. **Direkt danach** (ohne zuerst **§ H.15 Stufe 2** am Handy zu blockieren): **§ H.2** / **`check:pwa-desk`**, **§ H.1a**-Slices, Folge aus **`docs/MESSAGING-MAILBOX-SSOT-SPEC.md`**, **§ H.3n**-Abgleich, **§ H.0**-Feinschliff — nach Dringlichkeit wählen. **§ H.15 Stufe 2** (manuelles Smoke nach **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**) **bewusst nach hinten**, wenn Schreibtisch + diese Scheiben ritualstabil sind; dann **`docs/HANDY-TEST-WINDOW.md`**. Parallel wie **§ C.0b Stufe 1:** **§ H.0** + **§ H.1**; **§ I** nicht parallel zu Phase-A-Robustheit; **Phase B** erst nach C.0b **Stufe 3**-Voraussetzungen.

### Ist das der „komplette“ Plan? Heltec, Firmware, …

**Nein — absichtlich mehrstufig.** Dieses Dokument ist die **Arbeits- und Prioritätenliste**, nicht „alles ist erledigt“.

| Phase | Inhalt | Stand (Kurz) |
|--------|--------|----------------|
| **A** | Messenger-UI, Stabilität, PWA, Tests (**§ A**, **§ H.1–H.2**) | **Teils erledigt**, laufend (z. B. Fehlertexte, Regression). |
| **B** | Mesh v2, **Delayed LoRa → IOTA** (**§ H.3**), **Heltec/Meshtastic**-Integration (**§ A.7**, `meshtastic/`, Firmware) | **Nicht** abgeschlossen — eigenes Engineering (Spec **`LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**). |
| **C** | Gateway, Makros, erweiterte Custody (**§ E–G**, **§ I**) | **Backlog** — nach stabilem B-Kern. |

**Kurz:** Heltec **programmieren** / Firmware / vollständige Funk-Kette sind **Phase B**, nicht „alle Punkte schon grün“ in § A.

---

## Gesamtüberblick (ein Bild)

| Ebene | Inhalt |
|--------|--------|
| **Projektphasen** | **A** Code/Stabilität/Messenger-UI → **B** Mesh v2 + **Delayed LoRa → IOTA** (MVP) → **C** Gateway/Makros/erweiterte Custody (siehe **`PROJECT-FOCUS-AND-PRIORITIES.md`**) |
| **LoRa / Funk** | Meshtastic-First; **§ A.7** Firmware; Phase-**B**-Kern: **`LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**; Inspiration LXMF: **`LORA-LXMF-RETICULUM-INSPIRATION.md`** (kein Stack-Wechsel) |
| **8 technische Punkte** | **§ A** (Tabelle): Stabilität Medien, Export, Shadow-Sweep, `chat-view`, PWA, Fehler/Status, Heltec/LoRa, Kabel-Bridge |
| **UX / Einsatz (neu Punkt 1)** | **§ H.0** – Wanderer/Lite, Kacheln nach Rolle, Unlock-/Seed-UX, Abgleich mit Standalone-Abgabe **H.7** |

---

## A–H: Brücke zum ursprünglichen 8-Punkte-Plan

**8 oder 9?** Die **ursprüngliche technische Checkliste** umfasst **8** nummerierte Punkte (**§ A**, **1–8**). **§ H.0** ist **kein** „neunter“ Punkt derselben Liste, sondern die **vorgezogene Produkt/UX-Spur** (Einsatz, Handy, Entsperren). Zusammen ergeben sich **9 Prioritätsfelder**, wenn man **H.0** + **§ A (1–8)** zählt — mit unterschiedlicher Rolle: **H.0** steuert **Reihenfolge und Fokus**, **§ A** bleibt die **technische** Spur (Medien bis Kabel-Bridge).

| § A | Thema (Kurz) | Verknüpfung im Fahrplan |
|-----|----------------|-------------------------|
| — | **Produkt/UX (vorgezogen)** | **§ H.0** — kann **§ A.1–8** überholen, wenn Feldtest/Abgabe drängt |
| **1** | Stabilität Bild + Audio | **§ H.1** (Regression, Tests), **§ C.1** Phase A |
| **2** | Einsatzprotokoll / Export (ZIP) | **Erledigt**; **§ H.1**, **`docs/EINSATZBERICHT-EXPORT.md`** |
| **3** | Shadow-Sweep in Next-UI | **Erledigt**; **§ H.1**, **`POST /api/shadow-sweep`** |
| **4** | `chat-view` + Send-Flow | **§ H.1** (Hooks, Struktur), Phase A |
| **5** | PWA (Manifest, SW) | **§ H.0** Punkt 5, **§ H.2**; Manifest mit **192/512 PNG** (`npm run build:pwa-icons`), **§ H.4** Checks |
| **6** | Fehlerbehandlung / Status | **§ H.2** (konsistente Meldungen), **§ A**-Tabelle, Package-ID-Banner |
| **7** | Heltec / LoRa Firmware | **§ H.3** Phase B, **`meshtastic/`**; Funk-Zeile im **Gesamtüberblick** |
| **8** | Kabel-Bridge | **§ H.2** (Backlog nach Stabilität), Phase B/C, spec-nah |

**Nicht in § A nummeriert, aber Phase-A-Betrieb:** Shop/Voucher/Credits (**§ H.3c**, **`docs/OPERATIONS-SNAPSHOT-2026-03.md`**) — Fulfillment und Konfiguration, parallel zur Medien-/PWA-Liste.

**Leselinie:** **§ C.1** (was wirklich zuerst) → **§ H.0** → **§ H.1** (Phase A technisch) → **§ H.2** (konkrete §-A-Punkte 5/6/8 als „Als Nächstes“) → **§ H.3** Phase B.

---

## A. 8-Punkte-Liste (Checkliste, technisch)

Die Nummern **1–8** bezeichnen weiterhin die **klassische** technische Liste (Medien bis Kabel-Bridge). Die **Reihenfolge der Umsetzung** startet mit **Produkt/UX** (**§ H.0**); die **Zuordnung zu § H** steht in **§ A–H: Brücke** oben.

| # | Thema | Aufwand | Stand / Hinweis (2026-03) |
|---|--------|---------|---------------------------|
| 1 | Stabilität Bild + Audio | — | Basis; bei Änderungen testen. |
| 2 | Einsatzprotokoll / Export (ZIP) | Mittel | **Erledigt:** vollständiger Posteingang, ZIP, `.zip.enc.json`, Decrypt-Seite → **`docs/EINSATZBERICHT-EXPORT.md`**. |
| 3 | Shadow-Sweep in Next-UI | Mittel | **Erledigt:** Setup-Panel (`chat-view-shadow-sweep.tsx`), POST `/api/shadow-sweep`. |
| 4 | Code-Struktur `chat-view` + Send-Flow | Hoch | **Stand 2026-03:** Core-Logik in Hooks ausgelagert; **Kopplung** bleibt hoch → **§ H.1b** **`docs/MESSENGER-UI-MODULARITY-STRATEGY.md`** (Feature-Ordner, Ports, `lib/api/`-Split unter **`frontend/frontend/lib/api/`**). **Neu:** ESLint send↔inbox, inbox↔attachments, madge **`check:circular`**, RTL Transport-Karte, CI **`frontend-checks`** — Details **§ H.1b** Absatz *Ist — Weitergang*. |
| 5 | PWA-Grundlage (Manifest, SW) | Mittel–Hoch | **Umgesetzt:** `frontend/app/manifest.ts` (inkl. **192×192** / **512×512** PNG + maskable), `frontend/public/sw.js`, `PwaServiceWorkerRegister`; Favicons `icon-light/dark-32x32.png`, `apple-icon.png` aus **`icon.svg`** via **`npm run build:pwa-icons`**. **Hinweis:** „Offline“ = v. a. gecachte statische Assets; API weiter online. **Offen:** manuelle Installations-Checks, optional Offline-Fallback-Seite. |
| 6 | Fehlerbehandlung / Status | Mittel | **Stand 2026-03:** Next-Messenger: Posteingang bei nicht erreichbarer Basis (Hinweis „Funk-Modus“), Partner-/Richtungsfilter, Eingang/Ausgang-Badges; Abgleich Package-ID Filter vs. `/api/status` → Banner „Jetzt updaten“ (**`docs/MESSENGER-PACKAGE-ID-BANNER.md`**, Checks in **`TESTING.md`**). Laufend verfeinern. |
| 7 | Heltec / LoRa Firmware | Hoch | Spez-lastig (`meshtastic/`). |
| 8 | Kabel-Bridge | Hoch | Spec-nah. |

---

## B. Ergänzende Linien (Kurz)

| Thema | Status |
|--------|--------|
| Basis vs. Vortrupp-UI | Geheimnisse serverseitig an der Basis. |
| Standalone-Smartphone-Bundle | `exports/morgendrot-standalone-smartphone/` (`npm run bundle:standalone-smartphone`). **Ist:** volle `.env.example` aus dem Hauptrepo + PWA-Block am Ende; `scripts/ensure-env.mjs` + `postinstall` → `.env` nach `npm install`; Details **Bundle-`README.md`** (im Export erzeugt). **Einsatz:** Boss passt **`.env`** pro Kunde/Test an (RPC, `PACKAGE_ID`, Partner/Boss-Adressen); Medium (SD/USB/ZIP) **ohne** Seed; Helfer: **Passwort/Seed nur auf dem Handy**. **Optional:** Next **Boss-Modus → Export-Assistent** + **`POST /api/standalone-smartphone-handoff-zip`** (ZIP mit Handoff-`.env` + README, ohne Secrets) — siehe **H.7**. |
| Posteingang 50 + „Weitere laden“ | Umgesetzt. |
| Messenger-UI: Offline-Headline, Partner-Strip, Package-ID-Banner | Umgesetzt; siehe **§A Tabelle Punkt 6**, **`TESTING.md`**, **`docs/MESSENGER-PACKAGE-ID-BANNER.md`**. |
| Opcodes / QoS | `src/shared/opcodes.ts` (`MacroOpcode`, **`MacroPriorityClass`**) – für spätere Sendewarteschlange. |
| Reticulum / **LXMF** (nur Inspiration) | Chunking/Priorität lesen, **kein** Stack-Wechsel → **`docs/LORA-LXMF-RETICULUM-INSPIRATION.md`**. |
| Doku / Policy | Hybrid, bidirektional, **TX vs. Streams §7**, LXMF-Inspiration – siehe **D.** |

---

## C. Priorisierte Reihenfolge (**was wirklich zuerst**)

### C.0 Vollständige Gliederung dieses Dokuments (alle Kapitel)

| Kapitel | Inhalt (Kurz) |
|---------|----------------|
| **§ A** | Technische **8-Punkte-Checkliste** (Medien, Export, Shadow, `chat-view`, PWA, Status, Heltec/LoRa, Kabel-Bridge) + Stand-Tabelle |
| **§ A–H: Brücke** | Zuordnung § A ↔ § H.0–H.3 |
| **§ B** | Ergänzende Linien (Standalone-Bundle, Opcodes, Doku) |
| **§ C** | **Priorisierte Reihenfolge** — **C.0** Gliederung, **C.0b** kritischer Pfad, **C.1** Pflichtpfad, **C.2** Schnelle Erfolge, **C.3** bewusst zurückgestellt |
| **§ D** | Verwandte Dateien (Index) |
| **§ E** | Macro-Backlog (nach B) |
| **§ F** | Heartbeat: Streams vs. LoRa |
| **§ G** | Notfall-Purge / Fern-Makro-Risiko |
| **§ I** | Zentralserver, Relay, DID — Narrativ vs. Ist (**I.0–I.5**) |
| **§ H.0** | Produkt/UX (Lite, Wanderer, Kacheln, Unlock, PWA-Realität) |
| **§ H.1** | Phase A: `chat-view`, Regression, Exports |
| **§ H.1a** | Baseline, Vitest, AppError |
| **§ H.1b** | Messenger-UI-Modularität (ESLint, madge, RTL) |
| **§ H.2** | Als Nächstes: PWA-Checks, Status, Kabel-Bridge-Backlog |
| **§ H.3** | **Phase B**-Kern (Mesh v2, Delayed LoRa→IOTA) |
| **§ H.3b–n** | Optional: QR v2, Betrieb, Meshtastic-Hops, Ops/Git, Vision Provisioning, **H.3g** Umsetzungspaket, **H.3h** Metadata, Heim-Heltec-Narrativ, EU-Funk, Kern/Adapter, USB-Serial/BLE (**H.3l**), **H.3m** Notfall/LoRa-Realität, **H.3n** SOS / **`MORG_EMERGENCY_V1`** (**`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`**) |
| **§ H.4** | Merge-/Qualitätscheck vor großen Merges |
| **§ H.5** | Git-Aufräumen |
| **§ H.6** | Ideen (nicht gebucht) |
| **§ H.6b** | **Handy-Only Resilience** — Sovereign-Node-, Sync-, Relay-Zielbild (**kritisch eingeordnet**) |
| **§ H.6c** | **Cold-Start & Funk-Realität** — Zeit ohne Internet, Teilbilder, Flash am Heltec, Kollisionen (**App vs. Firmware**) |
| **§ H.6d** | **Wann „Umzug“-Code** — Reihenfolge Core → PWA → RN/Expo vs. Phase B/C |
| **§ H.6e** | **Konfiguration** — `.env` (Node) vs. **Core-Konstanten** vs. **Runtime** (Handy: Storage/DB); keine falsche `.env`-Pflicht auf dem Gerät |
| **§ H.6f** | **Android** — Foreground Service + **ehrliche** Nutzererwartung; **kein** Modul-Zoo; PWA bleibt ohne FG — **`docs/ANDROID-FOREGROUND-SERVICE-MINIMAL-SYNC.md`** |
| **§ H.7** | Standalone Smartphone + **§ H.7b** Backpack-Feldarchitektur |
| **§ H.8** | Dienst vs. privat (Doku, zwei Installationen) |
| **§ H.9** | ATAK/CoT Backlog |
| **§ H.10** | Sicherheit/Schlankheit + **§ H.10b** Boss/Arbeiter-Seed-Custody |
| **§ H.11** | Offline-Karten Backlog |
| **§ H.12** | Sync / Source of Truth (mit B verzahnen) |
| **§ H.13** | Code-Schlankheit & Härtung |
| **§ H.14** | Hardening V3 (PWA-Speicher, Wipe, …) |
| **§ H.15** | **Handy-first / Client-IOTA / optionaler Node** — **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**, **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** |
| **§ H.16** | **Telefonbuch, QR (Ein/Aus), Boss-LAN-Onboarding** — Kontakte mit Klarnamen, QR-Fluss, Helfer installieren PWA ohne dauernd Boss-PC; **`docs/QR-CONTACT-SCHEMA-V2.md`** (**§ H.3b**) |
| **§ H.17** | **Dashboard-Begriffe** — `morgendrot_show_all_tiles` vs. `morgendrot_workspace_tile_set` vs. Chat-`bossView` vs. **`DeviceRadarView`**; Messenger-Zielbild Boss-only / Hauptrepo volle Kacheln; **`docs/UI-ROLLEN-WORKSPACES.md`** §6 |
| **§ H.18** | **TTS / STT (Spracheingabe & Vorlesen)** — optional nach **§ H.0**/**H.2**: Freihand/Feld ohne Tippen, Barrierefreiheit; **Privacy** (Cloud vs. on-device), **Offline**, EU-Daten; technisch Browser-**Web Speech API** vs. native Hülle — **`docs/MESSENGER-SPRACHAUFNAHME.md`** |

*Übergeordnete Leitplanke:* **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** (Phasen **A → B → C**).

### C.0b Kanonische Ausführungsreihenfolge (Stabilität, wenig Doppelarbeit)

**Prinzip:** Erst **Phase A** absichern, dann **Phase B** (Mesh + Delayed Upload), dann **Phase C** (Makros/Gateway). **Nicht** parallel: großer UI-Refactor (**§ H.1b**) und neuer **Mesh-Kern** in derselben Woche; **§ I**-Produktversprechen vor **B**; **Kabel-Bridge** (**§ A.8**) bewusst **nach** klarer Queue-/Sync-Semantik (**§ H.12**) oder mit Spec-Abgleich. **Ab 2026-04-28:** **§ H.15** (Client-IOTA, optionaler Node) in **kleinen Scheiben** parallel zu **§ H.0–H.2** **erlaubt**, solange **`TESTING.md`**-Ritual und **kein** unkontrollierter Cross-Refactor mit **Mesh-Kern** (**§ C.0b** weiter beachten).

**Operative Reihenfolge (einheitlich):** **§ C.0b** → **„nächsten drei“** (Schreibtisch) → **weitere Phase-A-Scheiben** (**§ H.2**, **§ H.1a**, Mailbox-Spec, **§ H.3n**, …) → **§ H.15 Stufe 2** Handy-Smoke **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** **zuletzt** (nicht vor den vorgenannten Punkten erzwingen).

| Stufe | Reihenfolge | Hinweis |
|-------|-------------|---------|
| **0 — Immer** | **§ H.4** (`tsc`, `validate:ui`, `test:smoke`; Frontend: `lint`, `check:circular`, Vitest laut **`TESTING.md`**) | Vor jedem größeren Merge; CI **`.github/workflows/frontend-checks.yml`**. |
| **1 — Phase A Kern** | **§ H.0** (UX-Lücken ohne Macro) ∥ **§ H.1** (Regression Sendepfad, keine manuellen Export-Edits) → **§ H.1a** (optional Baseline-Tag) → **§ H.1b** in **kleinen** Scheiben **∥ § H.15** (Stufen 0–2: Flags, `@morgendrot/core`-Skelett, erster Client-Submit — **`ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**) | **H.1b** / **H.15** nicht mit Phase-B-Mesh-Refactor kreuzen (**`MESSENGER-UI-MODULARITY-STRATEGY.md`**, **`docs/ROADMAP-FAHRPLAN.md`** § **C.0b**). |
| **2 — Phase A Rand** | **§ H.2** (zuerst **PWA-Manual-Checks**, dann Status/Fehler konsistent) → **§ H.8** nur Doku → **§ H.10** / **§ H.10b** parallel (Doku, kleines Budget) | **§ H.14** / **§ H.13** nur, wenn keine Konflikte mit denselben Modulen wie geplanter Mesh-Code. |
| **3 — Boss / Einsatz vor Offline-Queue** | **§ H.3g** in Reihenfolge **1 → 2 → 6** (API/Templates/Rollen-Manager); **3/4** (Lite/Next-Import) nach Bedarf; **Paket 7 voll** (**Offline-Relay-Queue** / Settlement, Boss ohne Internet) **erst**, wenn **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (**§ H.12**) für Queue-Design gelesen ist — idealerweise **gemeinsam** mit Start **Phase B** Delayed Upload. **Erlaubt parallel:** **Paket 7a** — schlanke **Client-Mailbox-Outbox** (`lib/api/offline-queue.ts`, Opt-in `morgendrot.offlineMailboxQueue`, Drain im Status-Poll) als **Vorbereitung** ohne Settlement-Doppelbau. | Verhindert doppelte **Settlement**-Queue ohne Idempotenz; Outbox ≠ Relay. |
| **4 — Phase B** | **Mesh v2** zuverlässig (Web-BT, **`TESTING.md`** Phase B) → **SOS / `MORG_EMERGENCY_V1`** (**§ H.3n**, Priorität **Flash**, Basis-Queue) **im** selben Strang wie **Delayed LoRa → IOTA MVP** (`LORA-IOTA-DELAYED-UPLOAD-SPEC`, **§ H.3m**, **§ H.7b**) → optional **§ H.3l** Serial-Spike **nach** Mesh-Stabilität | Kein volles Macro-Gateway (**§ E**) vorher. |
| **5 — Phase C** | **§ E** Makros / **§ G** nur mit Security-Review → **§ I** nur phasenweise produktifizieren | Narrativ ≠ Implementierung. |

**Aktuell sinnvolle „nächsten drei“ nach § C.0b (Schreibtisch zuerst; Stand Doku 2026-03-28):** **§ H.2 Schreibtisch** — **`npm run check:pwa-desk:full`** (A+B+C, Next Production-Build, **`[check-pwa-manual-desk] OK`**) **erfüllt**, sobald im **`docs/TEST-RUN-LOGBOOK.md`** / **`docs/PWA-MANUAL-CHECKS.md`** festgehalten; danach nicht dieselbe Scheibe blockieren. **Erledigt / ritualstabil:** **§ H.15 Stufe 4** (**`npm run test:h15-direct-submit`**, **`TESTING.md`** Zeile **5c**), **Mailbox-Persistent** (**`docs/MESSAGING-MAILBOX-SSOT-SPEC.md`** + Tests), **§ H.3n**-Abgleich + Vitest. **Die nächsten drei (ohne H.15-Stufe-2-Handy zuerst):** (1) **§ H.1a** — weitere **RTL**-Smokes oder kleine **`lib/`-Helfer**-Tests (Send-Flow nur kleinschrittig). (2) **§ H.0** + **§ H.2 Gerät** — **`docs/PWA-MANUAL-CHECKS.md`** **L1–L5** und installierte PWA (Hintergrund-Sperre, Kachel-Restore) gegen **`docs/HANDY-TEST-WINDOW.md`**. (3) **§ H.1b** nur in **kleinen** Scheiben (kein Kreuz mit Phase-B-Mesh). **§ H.15 Stufe 2** — manuelles Protokoll **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** § 2 **wenn** (1)/(2) sinnvoll und Deploy-Version = Gerät. **§ H.15 Stufe 3** vertiefende Konflikt-**UI** = Backlog. **Ergänzend erledigt (2026-03-28):** **§ H.3**-Vorlauf — Delayed-Mirror-Drain → Forensic **`mtx`**, LoRa/Tangle-**Persistenz**, Panel-Hinweise (**Betriebsrhythmus** unten). **Nach Messenger-Änderungen** **`check:pwa-desk`** / bei Release **`full`** wiederholen. **Kürzlich dokumentiert:** **2026-04-28** Primärleitlinie **`BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** § 6 + **`ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**. **Paket 7 voll** erst mit **§ H.12** / Phase B — **Paket 7a** Vorbereitung. **Phase B:** **`MORG-EMERGENCY-SOS-WIRE-SPEC.md`** (**§ H.3n**) vor Mesh-Kern-Eingriffen mit Code abgleichen.

**Nachtrag 2026-03-29 (§ H.0 / § H.1 / § H.2 — Messenger-PWA & Doku):** Installierte PWA: **Hintergrund → `/vault-lock`** (erneutes Öffnen → Passwort); **Dashboard** merkt sich die **letzte Kachel** (`sessionStorage`); Posteingang **Absender ins Telefonbuch**; Puls **Ketten-IDs** robuster (**Normalize** + Core-**`isLikelyIotaHexId`**); **Next-Dev** **`allowedDevOrigins`** Host-Format + **`.env`**-Hinweis (**`DEV-START`**). Protokolle: **`CHANGELOG.md`**, **`docs/TEST-RUN-LOGBOOK.md`**, **`docs/ONBOARDING-WALLET-UX-SPEC.md`** § 2.2.1, **`docs/HANDY-TEST-WINDOW.md`**, **`docs/MESSENGER-UI-MODULARITY-STRATEGY.md`**, **`docs/OPERATIONS-SNAPSHOT-2026-03.md`**. **Als Nächstes (Fahrplan):** **§ C.0b** + **„nächsten drei“** (Schreibtisch) wie oben; **dann** **`npm run check:pwa-desk`** vor Deploy, **§ H.1a**-Slices, Mailbox-Spec-Folge, **§ H.3n**-Abgleich; Feldtest **L1–L5** + Sperrverhalten am **installierten** Client (**§ H.2**); optional **`window.prompt`** → Modal (**H.0**). **§ H.15 Stufe 2 § 2** (Smoke **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**) **hinten**, wenn Schreibtisch + obige Scheiben durch sind.

**Nachtrag 2026-03-28 (Fahrplan-Reihenfolge Schreibtisch — Ritual `test:h15-direct-submit` → H.1b → H.2 full → H.3n; H.15-Stufe-2-Smoke hinten):** **`test:h15-direct-submit`**, **`test:smoke`**, **`check:pwa-desk:full`** protokolliert (**`TEST-RUN-LOGBOOK`**, **`PWA-MANUAL-CHECKS`**); **`src/shared/`** Importpfade für **Next 16 / Turbopack**; **§ H.1b** send↔attachments-ESLint; **§ H.3n** Abgleichszeile **`MORG-EMERGENCY-SOS-WIRE-SPEC.md`**. **§ H.15 Stufe 2 § 2** **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** — **zuletzt** (**nach** weiteren Schreibtisch-/PWA-/Mailbox-Scheiben), **`docs/HANDY-TEST-WINDOW.md`**.

**Nachtrag 2026-04-28 (Umsetzungstranche H.15 + H.0 + H.2 + Folge):** **Stufe 2** = Smoke-Doku + Vitest; **Stufe 3** = **`SYNC-*`** § 8 + § 8.1 (Backoff) + Adapter-Kommentar **`offline-queue.ts`**; **Stufe 4** = **`TESTING.md`** Ritual **5c** + **`npm run test:h15-direct-submit`** + Anhang **`HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** § 4; **H.0** = **Wallet & Session**; **H.2** = Handbuch **`sw-6`**; **§ H.1b** = **`settings-wallet-session-card.tsx`**. Details **`CHANGELOG.md`** [Unreleased], **`docs/OPERATIONS-SNAPSHOT-2026-03.md`**.

**Nachtrag 2026-04-28 (Tests & Handy):** **`docs/TEST-RUN-LOGBOOK.md`** (Smoke/Frontend/Core/H.15 grün; Realworld mit Unlock nachziehen); **`docs/HANDY-TEST-WINDOW.md`** — **Handy erst**, wenn Schreibtisch grün **und** deploybare URL **gleicher** Version; optional **`test:messages*`** / **`test:realworld`** mit entsperrter API.

**Nachtrag 2026-04-20 (LoRa-Basis nach Feldtest, nächste Prioritäten):**

1. **LoRa unverschlüsselt (Bild + Sprache) robust machen** (**H.3 / H.18 Schnittmenge**): vorhandenen LUMA/CHROMA- und Sprachmemo-Pfad für **Klartext-Funk** stabilisieren (Retry, Vorschau, Fehlermeldungen, Größenlimits), bevor neue Kryptopfad-Varianten gebaut werden.
2. **LoRa-„verschlüsselt“ klar trennen in zwei Modi** (**H.3 Architekturentscheidung**):
   - **Modus A (Meshtastic Channel-Crypto):** Funkverschlüsselung wird vom Mesh-Kanal übernommen (PSK/256bit im Meshtastic-Ökosystem, vom Nutzer/Team eingerichtet).
   - **Modus B (Morgendrot E2E / Mesh v2):** App-seitige Ende-zu-Ende-Semantik mit bestehender Handshake-/Schlüssel-Logik.
   - **Leitplanke:** Kein „dritter Mischmodus“. UI muss die Modi explizit benennen.
3. **IOTA lokal signieren + LoRa-Transport + spätere Tangle-Verankerung** (**H.15 + H.3m/H.12**): als **verzögerte Verankerung** behandeln (Outbox/Queue + Gateway/onlineer Knoten), nicht als „vollständige IOTA-TX direkt über LoRa“. Priorisiert nach stabiler LoRa-Basis (Punkt 1) und klarer Kryptotrennung (Punkt 2).

**Konkrete nächsten drei Tickets (ab sofort):**
- **Ticket A (H.3):** Unverschlüsselte LoRa-Bild-/Sprachsendung UX-stabil (Senden, Anzeige, Retry, klare Limits).
- **Ticket B (H.3):** Transportkarte/Composer mit expliziter Auswahl „Klartext“, „Meshtastic-Kanal verschlüsselt“, „Morgendrot E2E (Mesh v2)“.
- **Ticket C (H.15/H.12):** Spez/Implementationsskizze „lokal signierte IOTA-Nachricht -> LoRa Delayed Transport -> spätere Tangle-Verankerung“ (Queue, Idempotenz, Zustandsanzeige).

**Umsetzungsphasen für Sprache (ergänzt 2026-04-20):**
- **Phase 1 (jetzt, H.18):** **STT/TTS-Hybrid** bevorzugen: Senden per Sprache-zu-Text, Empfangen optional per Vorlesen-Button neben Textnachrichten. Ziel: robuste Feldnutzung mit niedriger Latenz und ohne Funk-Stream-Sonderprotokoll.
- **Phase 2 (mittelfristig, Ticket A):** Audio-Chunking als separates Funkprotokoll (`transferId`, `chunkIndex`, ACK/Bitmap, Reassembly-Buffer, Retry/Timeout). Airtime-Risiko explizit beachten (mehrsekündige Memo kann Mesh deutlich blockieren); der Composer nutzt dafür keinen abgeschalteten Mesh-v2-E2E-Burst — Chunking ist die vorgesehene Funkvariante.

**Nachtrag 2026-04-20 (Produkt — verschlüsselter LoRa-Versand aus):** Der aktive **Versand** über App-seitiges Mesh v2 / **PRIVATE_APP** ist im Produkt abgeschaltet; **Funk** ist **Klartext** (inkl. Pfad 4); **Ende-zu-Ende-Verschlüsselung** nur über den **Online/IOTA**-Transport. **Empfang** älterer Mesh-v2-Nachrichten bleibt möglich. Die frühere Composer-**Delayed-Mirror**-UI (**„Nur LoRa“** vs **„LoRa + Tangle“**, **`morgendrot.delayMirrorToIota`**) ist entfernt; Hintergrundtechnik/Mirror-Drain kann für Alt-Nachrichten noch existieren (siehe **historisch** unten).

**Nachtrag 2026-03-28 (historisch — § H.3 Vorlauf — Delayed Mirror + Forensic):** **`localStorage`** **`morgendrot.delayMirrorToIota`** hält die Composer-Wahl **„Nur LoRa“** vs **„LoRa + Tangle“**. Nach **erfolgreichem Mirror-Drain** (`use-chat-view-mirror-delay.ts`): **Forensic-Attestation** je gespiegeltem Eintrag (bei **mehreren** Sends: stille Einreichung bis zum letzten, dann Statuszeile), Manifest **`mirrorMailboxTxDigest`** / Wire **`mtx`** (`@morgendrot/core` **`attestation/queue`**, **`forensic-mailbox-attestation.ts`**); **`onDelayMirrorPlaintext`** setzt **`mtx`** mit. **Send-Panel:** kurzer Hinweis *ohne Tangle keine Attestation* + Button **„Später verankern: auf ‚LoRa + Tangle‘ wechseln“**; **Erfolgstexte** unterscheiden LoRa-only vs. geplanter Tangle-Spiegel (`use-chat-view-handle-send.ts`). Vitest: **`queue.test.ts`** (`mtx`-Parse).

**Nachtrag 2026-03-28 (§ H.3 — Pfad 4 „LoRa + eigene Verankerung“):** Vier-Pfad-Architektur — **Pfad 4** = Meshtastic-**Klartext** (LongFast, **kein** Mesh-v2/Peer-ECDH), danach automatisch **`sendPlaintextMailboxHybrid`** an **eigene MY_ADDRESS** (Mailbox/Tangle) mit Marker **`[[MORG_PATH4_SELF_ARCHIVE_V1]]`** + Outbound-Nonce (`frontend/frontend/features/send/mesh-path4-self-archive.ts`); optionale **Forensic-Attestation** (silent). **UI:** Checkbox **„LoRa + eigene Verankerung“** im Send-Panel (privat, Klartext, **funk**); **`localStorage`** **`morgendrot.meshSelfArchiveAfterLoRa`**; bei **Verschlüsselung an** oder **Transport ≠ funk** wird die Option automatisch ausgeschaltet. **Ist:** Kurztext + LoRa-Bildzweiteiler (**LUMA/CHROMA**) über den vorhandenen Bildpfad; **Backlog:** robustes Chunk/ACK-Protokoll, engere Verzahnung mit Offline-Warteschlange, Kurz-Eintrag in **`docs/MESSENGER-CAPABILITIES-OVERVIEW.md`** und **`TESTING.md`** § Funk/Smoke.

**Nachtrag 2026-04-21 (Pfad 4 Queue-Operationalisierung):** Core-Queue kann jetzt **Priorität pro Eintrag** (`priority`) mit Legacy-Fallback `100`; Drain sortiert nach **`priority -> createdAt -> clientOutSeq`**. Pfad‑4-Self‑Mirror nutzt einen einheitlichen Dispatcher (Text/Bild) mit Queue-Fallback und setzt Prioritäten: **Text=20**, **LUMA=50**, **CHROMA=60**. Für Bild-Mirror wird die LoRa-`msgId` in Queue-Metadaten (`threadId`/`lastError`-Tag) mitgeführt, damit spätere Verankerung eindeutig zum gesehenen Funkbild zugeordnet bleibt. **Handshake/Connect bleiben Echtzeit-Kommandos** (derzeit nicht Teil der Offline-Mailbox-Queue).

**Nachtrag 2026-04-21 (CI-Stabilisierung Frontend):** `Frontend checks` auf `main` um **Typecheck-Fehler** bereinigt (`use-chat-view-handle-send.ts`, `use-meshtastic-ble.ts`): fehlende SOS-Retry-Imports/`partner`-Bindung ergänzt, Pfad‑4-Retry-Zieltyp auf `number | 'broadcast'` angehoben, BigInt-Literale für ES-Ziel ersetzt und dynamischer Transport für `MeshDevice` typisiert. Lokal erfolgreich gegen die Pipeline gespiegelt: `@morgendrot/core test:unit`, `frontend lint`, `frontend check:circular`, `frontend tsc --noEmit`, `frontend test:unit`.

**Nächster Roadmap-Schritt (direkt umsetzbar):** Feld-/Smoke-Fokus statt neuer Feature-Breite: (1) **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** als aktuelle Stage-2-Checkliste durchlaufen, (2) Ergebnis in **`docs/TEST-RUN-LOGBOOK.md`** protokollieren, (3) nur bei reproduzierbaren Funklücken den offenen Block **„Pfad-4 Bildtransfer Chunk + Bitmap-ACK“** starten.

**Nachtrag 2026-03-28 (Stabilität/UX, laufend):** Meshtastic-Echo-Dedup weiter gehärtet (Packet-ID + normalisierter Text, weniger doppelte LoRa-Zeilen), **sticky reconnect** nach einmaligem Verbinden (stille Wiederverbindung statt manuell pro Nachricht), Senden mit **„Übertragung abbrechen“** (Hook-Cancel), Posteingang-Partner als persistente Memory-Liste (**einmalig, dedupliziert**), sowie Pfad‑4-Bild-Guard gegen Meshtastic-Textgrenze (~512B) mit klarer UI-Meldung statt später Laufzeitwarnung.

**Roadmap-Ticket (Schritt B, noch nicht implementiert):** **Pfad-4 Bildtransfer-Protokoll „Chunk + Bitmap-ACK“** als separates Modul (kein Hook-Spaghetti): (1) **Frame-Skizze:** `IMG_INIT` (transferId, part=luma/chroma, chunkTotal, imageHash), `IMG_CHUNK` (transferId, chunkIndex, payload, payloadCrc16), `IMG_ACK` (transferId, windowStart, bitmapMissing), `IMG_DONE`/`IMG_ABORT`. (2) **Chunking:** konservativ ~80–100 B Netto statt Maximalgrenze; adaptive Fenstergröße. (3) **Zuverlässigkeit:** selektive Retries auf Basis Bitmap-ACK (kein ACK pro Einzelchunk), Timeout + Max-Retry + Abbruchgrund. (4) **Receiver-Reassembly:** Zustand je `transferId` (ttl, dedup), erst bei vollständigem Satz dekodieren; danach Self-Mirror an MY_ADDRESS + Attestation (silent). (5) **Tests/Smoke:** Vitest für Framing/CRC/Retry-State-Machine + Funk-Smoke-Checkliste in `TESTING.md`.
**Prioritätsentscheid 2026-04-21:** Bilddatei-Versand über Funk (LUMA/CHROMA + Chunk/ACK) wird **bewusst nach hinten** gestellt. Erst Text-/Queue-/IOTA-Flows stabilisieren, Regressionen schließen und Single-Messenger-Feldtests konsolidieren; Bildpfad erst danach wieder aufnehmen.

**Roadmap-Ticket (Diskussionsstand 2026-04-21, vor Implementierung):** **LoRa -> IOTA Relay Envelope (`MORG_TX_RELAY_V1`)** als zweistufiges Modell mit klarer Trennung:
- **R1 (`submit-ready`, wallet-loser Relay):** Sender erzeugt vollständig signierte, submit-fähige Payload; LoRa transportiert via S-ARQ; Relayer prüft Envelope (`networkId`, `createdAt`, `expiresAt`, `nonce`, Signatur) und reicht unverändert an Node ein; ACK über LoRa mit `txId`/Status.
- **R2 (`sponsored`, Gasstation/Builder-Service):** Sender überträgt signierten Intent (nicht final submit-ready); Relayer/Service übernimmt Gas-Sponsoring und ggf. Finalisierung/Submit unter separater Policy.
- **Leitplanken:** TTL-Dilemma (Zeitfenster großzügig + Ablaufprüfung), Gas-Problem (R1 nur mit Sender-Gas; sonst R2), Datenmenge (S-ARQ-Chunking Pflicht).
- **UI-Impuls (Backlog):** explizite Aktion **„An IOTA-Netzwerk weiterleiten“** mit Statuszuständen (`ready`, `needs sponsor`, `expired`, `invalid signature`, `submitted`).
- **UI-Ergaenzung (Backlog):** unter dem Composer optionales Vorschau-Feld **„Verschluesselter Funk-Block“** (nur Kopie/Weiterleitung, nicht Klartext) und optionaler Proof-Anhang (`payloadHash`, `senderSig`, spaeter `txDigest`) fuer forensische Nachvollziehbarkeit.
- **Wichtig:** Erst nach abgeschlossenem Stage-2-/Feldtestpfad weiter ausbauen; zunächst Spez + Akzeptanzkriterien, dann Implementierung.

**Roadmap-Ticket (neu, 2026-04-21):** **Wanderer-Proof + Late-Anchor fuer abgelaufene Relay-Objekte**
- **Sicherheitsannahme:** reine Handy-Uhr ist nicht beweiskraeftig (manipulierbar). Fuer belastbaren Nachweis werden mehrere Zeitquellen protokolliert (`userTimestamp`, optional `gpsTimestamp`) plus monotoner lokaler Zaehler.
- **Statusmodell (Queue/Archiv):**
  - `pending` = aktiv in Sendewarteschlange (Retry/Backoff).
  - `expired_local_proof` = fuer Zielpfad abgelaufen, aber lokal signiert als Beleg konserviert (kein Hard-Delete).
  - `anchored_late` = spaeter als Belegdokument on-chain verankert (heutiger Submit, alter signierter Inhalt als Payload).
- **Late-Anchor-Logik:** bei Reconnect nicht alte ungültige Operation blind einreichen; stattdessen neuen Container erzeugen, der den alten signierten Envelope unverändert einschließt (forensischer Nachtrag).

**Acceptance-Kriterien (verbindlich)**
- **Statusmodell**
  - Abgelaufene Einträge werden nicht gelöscht, sondern nach `expired_local_proof` verschoben.
  - `pending` bleibt für Retry; nur `anchored_late` markiert abgeschlossenen spaeten Nachtrag.
- **UI-Texte**
  - `pending`: „Wartet auf Verbindung / erneuter Versuch.“
  - `expired_local_proof`: „Nicht im Tangle verankert (Zeit abgelaufen), lokal signiert vorhanden.“
  - `anchored_late`: „Verspätet verankert: urspruenglich signierter Inhalt als Beleg hinterlegt.“
  - Bei Reconnect-Prompt: „Nachricht abgelaufen. Als verspätetes Logbuch-Dokument verankern?“
- **Datenfelder**
  - Pflicht je Proof-Eintrag: `status`, `createdAt`, `expiresAt`, `payloadHash`, `senderSig`, `monotonicSeq`.
  - Zeitkontext: `userTimestamp` immer, `gpsTimestamp` optional; plus `timeIsTrusted`.
  - Late-Anchor-Ergebnis: `lateAnchorTxDigest` (wenn erfolgreich) + `lateAnchoredAt`.
- **Tests**
  - Unit: Expiry-Übergang `pending -> expired_local_proof` ohne Datenverlust.
  - Unit: Late-Anchor erzeugt neuen Container, der Original-Payload-Hash unverändert referenziert.
  - Unit: Replay-/Idempotenzschutz über `nonce` bleibt bei Late-Anchor erhalten.
  - UI-Test: korrekte Status-Badges (⏳ / 📜 / ✅📜) und Prompt-Flow.
  - Integrations-/Smoke-Test: Offline erstellen -> Expiry -> Reconnect -> Late-Anchor -> Log/Status sichtbar.

**Strategische Doku-/Git-Pushes (nach Merge oder sinnvoller Paketgrenze):** **`git push`**; **`CHANGELOG.md`** [Unreleased] (Messenger-Zeile); **`README.md`** (Next-Messenger-Absatz **Funk**); **`docs/TEST-RUN-LOGBOOK.md`** nach **`npm run test:unit`** / **`test:smoke`**; **`docs/OPERATIONS-SNAPSHOT-2026-03.md`** bei betriebsrelevanten UI-Pfaden; **`docs/MESHTASTIC-BUILDING-BLOCKS.md`** oder **`docs/LORA-PC-FIRST-SMOKE.md`** nur wenn Funk-Smoke-Checkliste sich ändert; Export-Spiegel **`exports/Morgendrot-Messenger-verkauf/…`** nur bei bewusstem Bundle-Release (nicht bei jedem UI-Tweak).

**Betriebsrhythmus (regelmäßig, strategisch merken):** Nach abgeschlossenen Paketen **`git push`** zum Remote (Branch-Tip nicht nur lokal); **Schreibtisch** in Batches: Root **`npm run test:smoke`**, **`cd frontend`** **`npm run test:unit`**, bei § **H.15**-Touch **`npm run test:h15-direct-submit`** (**`TESTING.md`** Zeile **5c**) — kurz **`docs/TEST-RUN-LOGBOOK.md`** ergänzen. **Handy-Feldtest** nur laut **`docs/HANDY-TEST-WINDOW.md`** / **`docs/PWA-MANUAL-CHECKS.md`**. **Mailbox:** PTB+Signatur im Browser + **Hybrid** (`mailbox-send-hybrid.ts`) für Composer, SOS, Spiegel, Mirror, Lora-Online, Protokoll-Anker — **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** Ergänzung. **Forensic-Attestation (Bild → Mailbox → Manifest → Direct-Anker, UI „Attestation wird verankert…“):** **`forensic-mailbox-attestation.ts`** + **`use-chat-view-handle-send`** (kompaktes Bild **oder** LUMA+CHROMA bei Transport **„online“**); Opt-out **`localStorage`** **`morgendrot.forensicImageMailboxAttestation`** = **`0`**. **LoRa → Tangle (historisch; Composer-UI entfernt 2026-04-20, vormals Stand 2026-03-28):** **`chat-view-send-panel`** — Radio **„Nur LoRa“** vs **„LoRa + Tangle“** (Delayed Mirror), **persistiert** (`morgendrot.delayMirrorToIota`); Marker für **LUMA/CHROMA** und Mesh-Anhänge (**`use-chat-view-handle-send`**); nach **Mirror-Drain** Attestation inkl. **`mtx`** (siehe Nachtrag oben). **Nächste Scheibe (Handy-first):** **§ H.2** Schreibtisch (**`check:pwa-desk` / `full`**) erledigt → **§ H.1a** + **L1–L5** am Gerät (**`PWA-MANUAL-CHECKS`**, **`HANDY-TEST-WINDOW`**); Mailbox-Spec und **§ H.6c**-Sync-Sicht bei Bedarf; Feldtest LoRa+Tangle am Referenzgerät. **§ H.15** Stufe **2** (Smoke **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**) **hinten anstellen** — nicht vor den Schreibtisch-Prioritäten erzwingen.

### C.1 Pflichtpfad (größter Nutzen)

**Leitplanke:** **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** (Phasen **A → B → C**, Anti-Feature-Creep) — hier nur die **operative** Reihenfolge.

1. **Produkt/UX (Einsatz & Messenger)** – schlanke UI, verlässliches Entsperren, optional nur Messenger-Kacheln („Wanderer“), Seed/Passwort-UX wo nötig (**§ H.0**). *Vorziehen gegenüber rein technischer Feinarbeit, wenn Feldtest oder Handy-Abgabe drängt.*  
2. **Phase A** (technisch) – Stabilität, `chat-view`, kleine Schritte, `tsc`/Tests (**§ H.1**).  
3. **Phase B** – zuverlässiges Mesh v2, **Delayed LoRa → IOTA** (MVP laut Spec). **LoRa-/Heltec-Feldarbeit** (**§ H.3**, **`HANDY-TEST-WINDOW`**) nach **Mailbox-Paket** (**Persistent**-Schalter, Wegfall pauschalen **`forceLegacyPlaintext`** — **`docs/MESSAGING-MAILBOX-SSOT-SPEC.md`**, **§ H.15** / **§ H.1**) **hinten anstellen**, wenn obiges Paket durch Ritual abgesichert ist.  
4. **Phase C / Macro-Epic** – erst danach: Gateway, Interpreter, Opcodes aus Spec (kein Parallel-Bau zu B).

### C.2 Schnelle Erfolge (**wenig Aufwand**, klarer Nutzen)

| Maßnahme | Aufwand | Nutzen |
|----------|---------|--------|
| **`MacroPriorityClass`** in `opcodes.ts` bei Implementierung der Sende-/Macro-Queue nutzen | gering (API schon da) | Saubere Priorität ohne Hex-Umnummerierung. |
| **Heartbeat-Doku** für Teams: wann Streams, wann nicht (siehe **F**) | sehr gering | Weniger falsche Erwartung „Messenger = Heartbeat-Chat“. |
| **Chat-Header: „Puls an Basis“** (Streams bereit/fehlt, Heartbeat an/aus, Intervall, S-Bit-Hinweis) | umgesetzt | `chat-view-chat-header.tsx`, GET `/api/status` liefert `heartbeat` + `streams`. |
| **`/heartbeat` + Streams** nur aktivieren, wenn `STREAMS_BRIDGE_URL` + Anchor da sind (bestehend) | kein neuer Code | Boss sieht „online“ ohne neue Features. |
| **QR-Kontakt v2** | Spez nur (**`docs/QR-CONTACT-SCHEMA-V2.md`**) | Einheitliche Felder für Anchor/API/Gateway vor Implementierung; verhindert RPC-vs.-API-Verwechslung. |
| **Projekt-Doku verlinken** (dieser Fahrplan + `MACRO-OPERATIONAL-PATTERNS`) | gering | Onboarding — **Ist:** **`README.md`** Einstiegspunkt **6**; siehe auch **`docs/PWA-MANUAL-CHECKS.md`**. |

### C.3 Bewusst **nicht** vor B priorisieren

- Volle **bidirektionale Macro-Pipeline** (0x40–0xB0), **Geofence/Totmann**, **OTA-DFU**, **Mesh-Map-UI** – bleiben **Backlog** (`docs/MACRO-BIDIRECTIONAL-SPEC.md`, `docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`).  
- **Remote-Voll-Purge per Makro** – siehe **G** (hohes Risiko; kein Sprint ohne Sicherheitskonzept).

---

## D. Verwandte Dateien

- **`docs/ANDROID-FOREGROUND-SERVICE-MINIMAL-SYNC.md`** – Android: Foreground Service + minimale Sync-Ehrlichkeit (**§ H.6f**); PWA-Grenzen.
- **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** – Phase A/B/C.  
- **`docs/MESSENGER-UI-MODULARITY-STRATEGY.md`** – Messenger-UI: Feature-Ordner, Kopplung, API-Split (**§ H.1b**).  
- **`docs/MACRO-OPERATIONAL-PATTERNS.md`** – Hop/QoS/ACK/Akku, Heartbeat/Streams.  
- **`docs/PROTOCOL-CHANNELS-TX-VS-STREAMS.md`** – TX vs. Streams vs. Audit; DID/Twin/Gas; **§7 festgeschriebene Kanal-Policy**.  
- **`docs/LORA-LXMF-RETICULUM-INSPIRATION.md`** – LXMF-Ideen vs. Luma/Chroma + Mesh-v2, ohne Reticulum-Ökosystem.  
- **`docs/MACRO-BIDIRECTIONAL-SPEC.md`** – Wald↔Netz-Opcodes.  
- **`docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`** – Gateway, Interpreter.  
- **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/EINSATZBERICHT-EXPORT.md`**, **`docs/MESSENGER-PACKAGE-ID-BANNER.md`** (Package-ID-Banner, Abgleich mit `/api/status`).  
- **`docs/MESSAGING-MAILBOX-SSOT-SPEC.md`** – Mailbox als persistenter Kanal (Ist vs. Ziel), **„Persistent“**-Schalter Event vs. Mailbox-Anker; **§ H.12** / **§ H.15**.  
- **`docs/UX-MESSENGER-INVENTORY.md`** – Abgleich Wunsch-UX (Login, Rollen, Wald-Check, PWA) vs. Ist  
- **`docs/PWA-MANUAL-CHECKS.md`** – Manuelle PWA-Prüf (Install, Offline-Shell, Handbuch); **§ H.2**  
- **`docs/VAULT-BEGRIFFE-MESSAGEN-vs-TRESOR.md`** – Chatverlauf vs. Vault-Blob vs. Passwortmanager (ein Container)  
- **`docs/VAULT-STEGANOGRAPHIE-TRAGERBILD-ZIELBILD.md`** – Vault in Bildern / Icon als Träger: Zielbild, Risiko-Check, Build-Pipeline (`build:pwa-icons`); **kein** Kern-Feature  
- **`docs/EINSATZ-VAULT-PURGE-PDF-REDUNDANZ-ZIELBILD.md`** – Einsatz-Ende: Shred vs. Append, Offline/Online, PDF/Chain-Archiv (kritisch)  
- **`docs/VAULT-TRAEGERBILD-EINSATZ-ORGANISATION.md`** – Rettung/Einsatz: vorgefertigte Träger pro Rolle, generierte Beschriftung, Organisation statt Tarn-Narrativ  
- **`docs/ROLE-ROLE-ID-UND-VORLAGEN-ERKLAERUNG.md`** – `ROLE` vs `ROLE_ID` (0–63), Lock vs Messenger vs Arbeiter, Vorlagen  
- **`docs/ROLLENWECHSEL-TEAM-EINSATZ.md`** – Einsatz: Rollenwechsel (Provisioning/`ROLE_ID` vs. Boss-`DEVICE_ROLES`, Trägerbild-Zielbild vs. Ist)  
- **`docs/DIENST-VS-PRIVAT-NETZ-PROFIL.md`** – Dienst/Mainnet vs. privat/Testnet (Zielgruppe „Interessierte“); zwei Kontexte = Vault **+** `.env`, keine NACK/RS485-Produktclaims
- **`docs/WANDERER-STANDALONE-BUNDLE.md`** – „Wanderer“-Abgabe: `bundle:standalone-smartphone`, Boss→Helfer, optional zwei Ordner (**§ H.0 #2**, **§ H.7**)  
- **`docs/ONBOARDING-WALLET-UX-SPEC.md`** – Session, Vault, Unlock, Credits vs. MIST; Backlog L1–L6; Verknüpfung **§ H.0 #4**  
- **`docs/RECOVERY-PHRASE-BACKUP.md`** – Recovery/Sicher anzeigen (`/vault-show-signer-import`, Settings **Wallet & Backup**)  
- **`docs/PROVISIONING-PAYLOAD-CRITIQUE.md`** – Provisioning-Payload & Identity-Credits: Ist vs. Vision, **§ H.3f**  
- **`docs/CHAT-PROTOKOLL-2026-03-28.md`** (Abstimmungen inkl. Standalone-Abgabe, `.env`)  
- **`docs/GIT-CLEANUP-AND-COMMIT-PLAN.md`** – vor großem Commit lesen  
- **§ I** – Zentralserver, Relay, DID, Anonymität: **I.0** Kurz-Zielbild (Basis / Server / IOTA), **I.1 ff.** Kritik & Reihenfolge  
- **`docs/QR-CONTACT-SCHEMA-V2.md`** – Kontakt-QR **v2** (kompakt: `b`/`g`/`s` u. a.); v1 bleibt gültig; Code-Import folgt bei Bedarf  
- **`docs/SECRETS-OPTIONS.md`** – Option C: externe Secret-Manager (Doppler, …); kritische Grenzen  
- **`docs/MESHTASTIC-HOP-LIMIT-AND-BRIDGE.md`** – Hop-Limit/TTL, Brücken, Re-Broadcast-Sturm-Risiko  
- **`docs/LORA-EU-FUNK-HARDWARE-EINSATZPROFILE.md`** – EU868/Subband P, Antennen, USB, Rollen & Szenarien; **§ H.3j**
- **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`** – keine volle IOTA-TX über LoRa; Gateway/Delayed Upload; **§ H.3m**
- **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** – SOS / **`MORG_EMERGENCY_V1`**, Priorität Flash, Basis-Queue, Duty-Cycle; **§ H.3n**  
- **`docs/MODULAR-KERN-ADAPTER-INTEROP.md`** – Kern vs. Adapter, Auto-Modus, Interop-Grenzen; **§ H.3k**  
- **`docs/HELTEC-USB-SERIAL-VS-BLE-TRANSPORT.md`** – Serial vs. BLE, Web Serial, NACK/Turbo-Mythen; **§ H.3l**
- **`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`** – Vertrauen, Lieferkette, Keystore-Pfad, Abgrenzung „Regierungs-Niveau“; **§ H.10**
- **`docs/BOSS-WORKER-SEED-CUSTODY.md`** – Boss speichert Worker-Seed? Team- vs. Dezentral-Modus, Threat Model, UX-Pflicht; **§ H.10b**
- **`docs/OFFLINE-KARTEN-UND-GEODATEN-ZIELBILD.md`** – Vektor/Raster, PWA-Speicher, Wanderer vs. Einsatz, LoRa-Layer; **§ H.11** (mit **§ H.9** ATAK)
- **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** – Offline/Online, Idempotenz, CRDT-Grenzen, Mehrgeräte; **§ H.12**; **§6** Geräte-Uhr + Mesh-Payload (**Ist**); **`src/shared/device-time-trust.ts`**  
- **§ H.6e** (in diesem Dokument) — `.env` (Node) vs. **Core-Konstanten** vs. **Runtime** (Handy-Storage)
- **§ H.6f** (in diesem Dokument) — Android Foreground Service + minimale Sync-Ehrlichkeit — **`docs/ANDROID-FOREGROUND-SERVICE-MINIMAL-SYNC.md`**
- **`docs/MESSENGER-STRATEGIC-PRINCIPLES-LOCAL-FIRST-IDEMPOTENCY-PQ.md`** – Local-First vs. Ledger, Idempotenz **Ende-zu-Ende**, PQ/Agility **ohne** Kurzschluss  
- **§ H.6b** (in diesem Dokument) — Handy-Only Resilience: Sovereign Node, Burst-Sync on Open, Cable-First, optionales Gas-Relay (**kritische Caveats** zu Heltec-Flash, Serial-Baud, CM4/Boss)  
- **§ H.6c** — Cold-Start/Zeit, Teilbilder/Sparse, Flash-Verlust, Mesh-Stau (**App vs. Firmware**)  
- **§ H.6d** — **Wann** Code für gleitenden „Umzug“ Handy-only: Core → PWA → Phase B → RN/Expo vs. Firmware B+
- **`docs/CODE-SCHLANKHEIT-UND-HAERTUNGS-PRIORITAET.md`** – Schlankheit/Härtung: korrigierte Top-Dateien, Claim-Routen; **§ H.13**
- **`docs/API-PROVISION-DEVICE-IDEMPOTENCY-SKIZZE.md`** – `POST /api/provision-device`: Doppel-POST, Idempotency-Key (Skizze)
- **`docs/MORGENDROT-HARDENING-V3-PRECISION.md`** – PWA-Verschlüsselung, Lite-UI L2, Wipe, Idempotenz, PTB-Audit; **§ H.14**
- **`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`** – Baseline-Commit/Tag, Vitest-Strategie, AppError; **§ H.1a**
- **`docs/CREDITS-PURCHASE-ONCHAIN-CRITIQUE.md`** – Kauf/Credits on-chain: Server ohne Käufer-DB?, Grenzen „reines IOTA“  
- **`docs/WANDERER-REDEEM-PROVISIONING-FLOW.md`** – Voucher A–D vs. Ist-Code; „Shadow“-Begriff vs. `shadow-sweep`  
- **`docs/VOUCHER-PRE-MINT-AND-SHOP.md`** – Pre-Mint auf Chain, Shop-Fulfillment vs. blindes Relay, Papier-QR  
- **`docs/SPONSORING-AND-CREDITS-DOUBLE-FLOOR.md`** – Sponsor/Gas-Station-Schichten vs. Credits; Ist-Code (`gas-station.ts` vs. Blog)  
- **`docs/MESSAGING-CREDITS-STORAGE-AND-PURGE-POLICY.md`** – Credits nach Größe, Storage, Nutzer-Purge vs. Server-TTL, Rebate-Idee  
- **`docs/API-SHOP-SPEC.md`**, **`docs/STRIPE-TEST-SETUP.md`**, **`docs/CREDITS-SHADOW-SWEEP-AND-FULFILLMENT.md`**, **`docs/OPERATIONS-SNAPSHOT-2026-03.md`**

---

## E. Macro-Backlog (Kurzfassung)

Nach Phase-B-Kern: **Registry** (`src/shared/opcodes.ts`) → **Gateway** → **Interpreter** → einzelne Makros; Details und Szenarien nur in den verlinkten Docs pflegen, nicht alles parallel implementieren.

---

## F. Heartbeat – sinnvolle Umsetzung (**IOTA** vs. **LoRa**)

| Pfad | Wie | Wann sinnvoll |
|------|-----|----------------|
| **Streams (feeless, „Internet“)** | Bereits: **`/heartbeat`** → JSON auf **`STREAMS_ANCHOR_ID`** via Bridge (`messenger-command-handler.ts`). Braucht **S-Bit**, `STREAMS_BRIDGE_URL`, Anchor. | Basis/Boss soll **„Gerät lebt“** sehen, solange Uplink da ist. **Nicht** jede Heartbeat als Chat-Nachricht. |
| **IOTA Mailbox** | Optional später: minimaler Klartext-/Status-Tick **nur** wenn Streams nicht gewünscht; meist **teurer/schwerer** als Streams für reinen Puls. | Nur wenn strategisch nötig. |
| **LoRa / Mesh** | **Kein** Ersatz für denselben Streams-Heartbeat: anderes Medium. Sinnvoll: **seltene**, **kleine** „OK“- oder **Macro-Ping**-Nutzlaste (eigenes Konzept, Airtime) – **nach** Macro-Basis. | Wald ohne Internet: **Delayed Upload**, **Mailbox** bei Kontakt zur Basis; dedizierter LoRa-Heartbeat = **Phase Macro**, nicht MVP-Pflicht. |

**Messenger-UI:** Eher **eine** kompakte Stelle (Status / Einstellung „Puls an Basis“) als volle **Kachel** wie in der Boss-**Werkstatt**, wenn ihr Chat schlank halten wollt – siehe **`docs/MACRO-OPERATIONAL-PATTERNS.md`** §7.

---

## G. Notfall-Purge / „Purge-Button“ per Befehl – **kritisch**

### Was der Code **schon** kann

- **`/emergency-purge`** (CLI/API): Vault **on-chain** Notfall-Purge (PTB), wenn `ENABLE_PURGE` und `VAULT_REGISTRY_ID`; lokaler **Inbox-Klartext-Cache** wird geschreddert (`messenger-command-handler.ts`).  
- **`POST /api/clear-local-history`**: nur **lokaler Inbox-Cache** (`.inbox.enc`), kein vollständiger Vault-Chain-Purge.  
- **UI „Notfall“**: `VaultView` + `emergencyPurge()` – inkl. Scope-Wahl (`full` / `local_cache` / `lock_session`).

**Operative Reichweite (wer wird im Ernstfall erreicht, Brücken zu 112, LoRa/Meshtastic-Backlog):** nicht hier — siehe **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**.

### Fern-Befehl / Makro „alles löschen“

| Aspekt | Bewertung |
|--------|-----------|
| **Wunsch** | Einsatzleitung soll Gerät aus der Ferne **wischen** (verlorenes Handy). |
| **Risiko** | **Destruktiv**, irreversibel; Spoofing/Kompromittierung der Basis → **Massenverlust**. |
| **Makro** | Erst sinnvoll mit: **signiertem** IOTA-Befehl, **Allowlist** Absender, optional **zweite Bestätigung** (Code, zeitlich begrenzt), **Audit-Log**. → **Phase Macro**, nicht „schnell nachziehen“. |
| **Geringer Aufwand / sicherer** | Gerät physisch oder **SSH/Terminal** am Node: bestehendes **`/emergency-purge`**. Boss erreicht Gerät **online** über bestehende **API**, sofern **ohnehin** vertrauenswürdig und abgesichert (nicht öffentliches Internet ohne Auth). |

**Fazit fürs Projekt:** **Nicht** als Quick-Win priorisieren. In den Fahrplan als **optionales Phase-C-Thema** mit **Security-Review**; bis dahin: **lokaler** Purge + dokumentierte **Operatoren-Prozedur**.

---

## I. Zentralserver, „blindes Relay“, DID, Anonymität – **kritische Einordnung**

**Zweck:** Das gleiche Narrativ (VPS = „Cloud-Zentrale“, jede Basis leitet anonym weiter, DID-Register, Tangle = Archiv) **sauber** von **Ist**, **nahe Roadmap** und **Vision** trennen – damit **Phase A → B → C** nicht durch Marketing-Vollbau gebrochen wird.

### I.0 Zielbild: **Basis als Tor**, **Server als Dirigent**, **IOTA als Archiv**

Kurzfassung für Partner- und Betriebstexte (ohne Marketing-Garantien):

| Rolle | Aufgabe |
|--------|---------|
| **Basis vor Ort** (Heltec/Host) | **Durchgangstor / Gateway:** Nachrichten typisch nur **kurz** puffern (Sekunden bis Minuten), bis Weiterleitung ins Internet oder erneuter Versuch (siehe **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**). **Kein** Soll, „alles dauerhaft lokal zu horten“. |
| **Morgendrot-Server** (z. B. VPS) | **Koordinator / Wegweiser:** API, Konfiguration, optional Streams-Bridge, Monitoring – **kein** zentrales **Datengrab** für alle Chatverläufe. Was **dauerhaft** auf dem Server liegt, ist **Betriebspolicy** (u. a. Metadaten für Sitzung/Anzeige, Logs). |
| **IOTA Rebased** (Mailbox / Events) | **Archiv / persistente Beweisspur** für das, was **on-chain** ankommt – die **Speicherlast der Inhalte** liegt hier **dezentral** im Netzwerk, nicht auf dem kleinen VPS. |

**Ehrliche Caveats:** Sind **`ENABLE_PLAINTEXT_CHANNEL`**, **`MAILBOX_STORE_PLAINTEXT`** oder ähnliche Optionen aktiv, kann **Inhalt** zusätzlich oder im Klartext in der Chain landen – das muss in **Betriebsdoku** und **UI** erkennbar sein. **Server-Logs**, **RPC-Limits** und **Bridge-Kosten** skalieren **nicht** automatisch mit „beliebig vielen Nutzern“ – Unterhalt und Architektur separat planen.

### I.1 Was **sinnvoll** ist (und zum Projekt passt)

| Idee | Einordnung |
|------|------------|
| **VPS / Hetzner als „Morgendrot-Server“** | **Sinnvoll** als **Betriebsort** für API, optional **Streams-Bridge**, Monitoring, Boss-UI – **sofern** TLS, Auth, Härtung; **kein** Muss für reines P2P-Lab am Schreibtisch. |
| **Tangle/Mailbox als dezentrales Archiv, Server eher Konfig/Wegweiser** | **Passt** zur bestehenden **Mailbox-/Event-Logik** – der Server **ersetzt** keine unbegrenzte zentrale Nachrichten-DB; viel liegt **on-chain** bzw. an **Streams/Bridge**. |
| **Basis = kurzzeitiger Cache bis Upload** | **Passt** zu **Delayed Upload** / Einsatzrealität – siehe **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**. |
| **End-to-End-Verschlüsselung, fremde Relais sehen „Datensalat“** | **Richtung stimmt** für **euren** verschlüsselten Pfad – **aber:** Klartext-Kanäle, Logs, Monitoring und **Betreiber** müssen **explizit** genannt werden (keine falsche „total anonym“-Garantie). |
| **Öffentliche IOTA-Nodes + optional Sponsor/Gas („Cloud-Relay“)** | **Sinnvoll** als **Produktwahl**: **Autarkie** (eigener oder Boss-RPC) vs. **Komfort** (Gas-Station / Sponsor nur **opt-in**) — **§ H.6b**, **`docs/SPONSORING-AND-CREDITS-DOUBLE-FLOOR.md`**, **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`**. |

### I.2 Was **so noch nicht** stimmt oder **überzeichnet** ist

| Narrativ-Claim | Realität im Projekt |
|----------------|---------------------|
| **„Zentrales Register aller DIDs“** | **DID-Produkt (did:iota:…)** ist **nicht** Morgendrot-Standard – Identität ist v. a. **0x-Adresse + Vault**; siehe **`docs/PROTOCOL-CHANNELS-TX-VS-STREAMS.md`** §3. |
| **„Jede Morgendrot-Basis leitet blind an **euren** Server“** | **Meshtastic-First** = Mesh/Routing im **Ökosystem**; ein **globales „anonymes Relay zu genau einem VPS“** wäre **eigenes Gateway-/Trust-Modell** (Whitelist, Abuse, Incentive) – **Phase C / Macro / Gateway**, nicht Default. |
| **„Zehntausende Verbindungen ohne weiteres“** | **Skalierung** hängt von Last, Bridge, Kosten – **kein** automatisches Produktversprechen. |
| **„Notfall 0x40 legt Identität für Rettung offen“** | **Opcodes/Makros** in Specs – **kein** fertiger **MVP** für Rettungs-Stufen; **Phase C** + **Security/Privacy-Review**. |

### I.3 **Beste Lösung** (Reihenfolge, nicht alles auf einmal)

1. **Jetzt (Phase A):** Stabilität, `chat-view`, Tests; **keine** neue „Anonymitätsstufe“-UI ohne **technische + rechtliche Spez** (sonst falsche Erwartung).  
2. **Phase B:** **Mesh v2 + Delayed LoRa → IOTA MVP** – das ist der **tragfähige Kern**, bevor globale Relay-Fantasien implementiert werden.  
3. **Phase C:** **Gateway / Interpreter / Makros** – hier erst **optional** ein **föderiertes Relay** oder **erweiterte Identitäts-/Notfall-Policies** – mit **`docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`**, **`docs/MACRO-BIDIRECTIONAL-SPEC.md`**.  
4. **DID/Twin als „Luxus-Spur“:** nur **abgestimmt** mit **`PROTOCOL-CHANNELS-TX-VS-STREAMS.md`**, nicht parallel zum Mesh-MVP überladen.

### I.4 Konkrete **Fahrplan-Verpflichtung** (was wir tun / nicht tun)

| Aktion | Wann |
|--------|------|
| **Anonymitäts-/Notfall-Stufen als UI** | **Nur** nach **Kurz-Spec** (Datenfluss, Empfänger, Audit, Rettungsfall) – **nicht** als Ad-hoc-Schalter in **Phase A**. |
| **„Zentralserver-Roll“** in Doku | Optional: **Betriebskapitel** (VPS = Bridge/API, **kein** alleiniger DID-Gott) – **kein** Pflichtsprint vor **H.2 PWA**. |
| **Relay-Narrativ prüfen** | Bei jeder **öffentlichen** Texte: **Ist vs. Vision** kennzeichnen (verhindert Investoren-/Behörden-Missverständnis). |

### I.5 Verwandte Dateien

- **`docs/PROTOCOL-CHANNELS-TX-VS-STREAMS.md`** – DID/Twin/Gas, Kanal-Policy §7.  
- **`docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`**, **`docs/MACRO-BIDIRECTIONAL-SPEC.md`** – Gateway, Opcodes, **nach Phase B**.  
- **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`** – Notfall: Gegenstellen, 112-Brücke, Entscheid **kein** Pflicht-Klartext-Meshtastic-SOS (Backlog).  
- **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** – Phase C-Tabelle (Ergänzung Verweis **§ I**).

---

## H. Nächste Arbeitspakete (**weiter im Fahrplan**)

Ziel: **Produkt/UX** und **Einsatzfähigkeit** (Handy, Entsperren, schlanke Oberfläche) **vor** oder **parallel zu schmalen technischen Schritten** klären; **Phase A** technisch abschließen, dann **Phase B** (LoRa/IOTA-MVP) – ohne unnötige Großthemen dazwischen.

### H.0 Jetzt zuerst – Produkt/UX (früher „später“, jetzt **Punkt 1**)

| # | Paket | Status (2026-03) | Hinweis |
|---|--------|-------------------|---------|
| 1 | **Lite / Messenger-Modus** | **Teilweise erledigt** | **`/api/status` → `uiVariant`**; bei `UI_VARIANT=messenger` erzwingt das Dashboard **Messenger-Kachelset** (Nachrichten + Tresor) für **alle Rollen außer `boss`**; **`boss`** kann **Volldashboard** wählen. **`workspace-projects-panel`**, „Erste Schritte“-Karte mit rollenabhängigem Lite-Text. Siehe **`docs/FRONTEND-KLEINER.md`**, **`docs/UI-ROLLEN-WORKSPACES.md`** § 5 (volle rollen-basierte Workflows = Backlog). |
| 2 | **„Wanderer“-Abgabe** | **Doku erledigt (2026-03)** | Kanon: **`docs/WANDERER-STANDALONE-BUNDLE.md`** (Bundle bauen, Boss→Helfer, optional zwei Ordner). **`npm run bundle:standalone-smartphone`** → **`exports/morgendrot-standalone-smartphone/`**; technische Details **§ H.7**. |
| 3 | **Kacheln nach Rolle** | **Teilweise (2026-03)** | **Arbeiter/Lock:** Action Center + „alle Kacheln“; **Boss/Kommandant:** Geräte-Radar bei Volldashboard. **Neu:** rollenbezogene Hinweise im Panel **„Arbeitsbereich & Projekte“** + Kurzzeilen in Action Center / Radar — **`dashboard.tsx`**, **`workspace-projects-panel.tsx`**, Spec **`docs/UI-ROLLEN-WORKSPACES.md`** (Workflow-Tiefe = Backlog). |
| 4 | **Unlock- & Secret-UX** | **L2 weiter (2026-03-28)** | Spez **`docs/ONBOARDING-WALLET-UX-SPEC.md`**. **Erledigt:** signer-spezifischer Unlock-Dialog; Shop-Tooltip; Recovery **Wallet & Backup**; **„Erste Schritte“** + **`GET /api/help`**. **Neu (2026-03-28):** Next + Lite **„Tresor öffnen / Neu anlegen“**, Mnemonic bei `SIGNER=sdk` **progressiv** + API-**`SIGNER_IMPORT_REQUIRED`**; Next-Tresor **Signer-Import mit speichern**; Vitest **`unlock-response-parse`**. **Neu (2026-03-28):** dritter Einstieg **Seed importieren** (Next + Lite); **H.7** Export-Assistent (ZIP) im Boss-Modus. **Offen:** geführter Wizard; optional **Mnemonic per Knopf erzeugen**. |
| 5 | **PWA-Realität** | **Doku + Checks (2026-03)** | **`docs/PWA-MANUAL-CHECKS.md`** — manuelle Feldprüf + **Vorprüfung am Schreibtisch** (Build/Icons/Handbuch); **§ H.2**; optional Offline-Fallback-Seite Backlog. |

**Teil erledigt (2026-03-28):** Chat **Wald-Check** (grün/blau/rot) + **Rollenzeile**; Toast bei Basis-Wiederherstellung; **`docs/UX-MESSENGER-INVENTORY.md`** aktualisiert; **Onboarding/Wallet:** **`docs/ONBOARDING-WALLET-UX-SPEC.md`**, README-Einstieg, Unlock-Dialog **signer-abhängig**, Shop-Tooltip; **Recovery:** **`docs/RECOVERY-PHRASE-BACKUP.md`**, **`/vault-show-signer-import`**, Einstellungen **Wallet & Backup**.

*Abgrenzung:* Keine neuen **Macro-/Gateway**-Features hier – nur Bedienung, Sichtbarkeit, Rollen-UI und Einsatz-Abgabe.

**Neu / Backlog (2026-04-16):** **Meshtastic-Klartext** im Chat (Standard-**LongFast**-Text): **Broadcast** oder Ziel-**Node-ID** (`!` + Hex) ohne `/connect`; **Mesh v2** (verschlüsselt) weiter mit Handshake/Wallet. **Adressbuch:** optionales Feld **Meshtastic Node-ID** pro 0x-Kontakt. **Next-Dev:** `npm run dev` nutzt **`--webpack`** (Shim für `@meshtastic/core` + `util.formatWithOptions`; Turbopack-Alias bricht Server-Bundles). **UI-Backlog:** stärkere visuelle Trennung **IOTA/Mailbox** vs. **LoRa/Meshtastic** (Tabs/Accordion, weniger „alles in einer Karte“) → **§ H.1b** Modularität / Inventar **`docs/UX-MESSENGER-INVENTORY.md`**.

**Signatur / IOTA (aktualisiert 2026-04-28):** **Primär** = **Client-Signatur** + **direkter RPC-Upload** vom Handy (**local-first**, Offline-Queue); **Morgendrot-Node** = **optional** (Relay, Gas, Archiv). Doku: **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** § 6, **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**, **§ H.15**. Zusätzlich weiterhin **Handbuch-Hinweis** auf **eigenständiges IOTA-Wallet** als organisatorischen Notfall-Beacon.

### H.1 Phase A – Code-Qualität & Messenger-UI (technisch)

| # | Paket | Hinweis |
|---|--------|---------|
| 1 | **`chat-view`** + Phase-A-UI | Refactor der Kern-Logik **abgeschlossen** (Hooks wie oben). **PWA:** siehe **§ A.5** / **H.2**. Bei weiteren UI-Änderungen: **`frontend`: `npx tsc --noEmit`**, Root **`npx tsc`**, **`npm run validate:ui`**, **`npm run test`**. |
| 2 | **Regression** Bild/Audio/LoRa-Sendepfad | Bei Änderungen an Chat/Send kurz manuell oder E2E prüfen. |
| 3 | **Exports** | Keine manuellen Edits in **`exports/Morgendrot-Messenger-*`** – Bundle aus **`src/`** / `frontend/` bauen (`MESSENGER-BUNDLE-SOURCE-OF-TRUTH`). |

### H.1a Phase A — Baseline, Vitest, AppError (verbindlich, vor Phase-B-Schwerpunkt)

**Doku:** **`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`** — dreiphasiger, **kontrollierter** Ausbau (kein Wildwuchs).

| Phase | Inhalt (Kurz) |
|-------|----------------|
| **1 — Baseline** | Hotspot-Typing (`use-chat-view-core`, `api.ts`, Send-Helfer); Doku/`.gitignore`; **`npm run sync:handbook`**; **Commit**; optional **`git tag -a`** **nur** mit **Verifikationsliste** (`tsc` root + frontend, `validate:ui`, `test:smoke` — im Detail in der Doku). |
| **2 — Vitest** | **Festgelegt:** **Vitest** als **einziger** neuer Unit-Runner: **RTL + Vitest** in **`frontend/`**; **`src/`** mit **`environment: 'node'`** (Sharp/FS, reine Parser). **Playwright** + **`tsx`/`npm run test`** bleiben parallel. |
| **3 — Defensive Schicht** | **`AppError`**-Konzept; **Zod** an API/Mesh-Grenzen schrittweise; **Error Boundaries** + **einheitliche** Toasts. |

**Priorität:** Mit **§ H.1**-Tabelle oben verzahnen; **blockiert Phase B** nicht, solange keine großen parallelen Refactors in denselben Mesh-Dateien.

### H.1b Messenger-UI — Modularität (Grenzen statt Zeilenzahl)

**Volltext (Ist-Kritik, Leitregeln, 3 Phasen):** **`docs/MESSENGER-UI-MODULARITY-STRATEGY.md`**. **Operativ:** dieselbe Datei **§ 5** *Schritt für Schritt* (Stufen 0–5 + Qualitätsgitter).

| Phase | Inhalt (Kurz) |
|-------|----------------|
| **1 — Struktur** | Feature-Ordner (`features/send`, `inbox`, `attachments`, `voice`, `export`, …); **bestehende** Dateien **verschieben** mit **minimaler** Logikänderung; **`lib/api/`** in Domänen splitten + Re-Export; **vertikale Scheiben** (nicht alles auf einmal). |
| **2 — Kopplung** | Kleine **Ports/Interfaces** zwischen Send/Inbox/Attachments; **Vitest** pro extrahierter Einheit; **kein** Kreuz-Refactor mit **Phase-B-Mesh-Kern** in derselben Woche ohne Absprache. |
| **3 — Paket (optional)** | **`@morgendrot/messenger-core`** nur bei **zweitem echten Consumer** (Lite-UI, CLI, …); sonst **Ordner im Monorepo** reichen. |

**Nicht-Ziel:** Big-Bang in 3 Tagen; starre „max. 300 Zeilen“ ohne Ausnahmelogik — siehe Strategie-Doku.

**Verzahnung:** **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** Phase A; **`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`**; **`docs/MODULAR-KERN-ADAPTER-INTEROP.md`** (Funk/Transport vs. UI-Modularität).

**Ist — Weitergang Phase 1/2 (2026-03):** Durchsetzbare Grenzen: ESLint **`no-restricted-imports`** für **`features/send` ↔ `features/inbox`**, **`features/inbox` → `features/attachments`**, **`features/attachments` → `features/inbox`** (`frontend/eslint.config.mjs`, Ziel **`npm run lint`**); **`npm run check:circular`** (madge auf `./frontend`, in CI siehe **`.github/workflows/frontend-checks.yml`**); Vitest + RTL: `components/ui/button.test.tsx`, **`frontend/frontend/components/chat-view-transport-card.test.tsx`** (Sendepfad/Partner), **`chat-view-send-panel.test.tsx`** (Composer/Senden); vollständige lokale Reihenfolge: **`TESTING.md`** § *Qualitätsritual vor Merge*.

**Als Nächstes (klein, empfohlen):** (a) § **H.1a** weiterer RTL-/Vitest-Slice am **Send-Panel** / Inbox-Rand, wenn Mesh-Kern nicht parallel stark bewegt wird; (b) weitere ESLint-Zonen nur ergänzen, wenn **messbare** neue Querimports auftauchen (z. B. **send**↔**attachments**); (c) optional relative Barrel-Imports in **`frontend/frontend/`** auf **`@/frontend/lib/api`** vereinheitlichen (rein kosmetisch).

**Nachgezogen (2026-03-30):** Vitest **`chat-view-send-utils.test.ts`** (LoRa-Dual-Wire UTF-8-Limit, Funk vs. IOTA-Kompaktblob); Messenger **Export-Gate** bei unsicherer Gerätezeit; **LoRa-Mesh-v2**-Fortschrittszeile in der Anhang-Leiste (**`loraMeshProgressLine`**). **API-Barrel** nur noch **`@/frontend/lib/api`** (`frontend/frontend/lib/api.ts`); Dashboard-Endpunkte in **`lib/api/dashboard-rest.ts`** + **`CommandResponse`**-Typen; **`getStatus`**-Kompatibilität (`data`/`messages`) für Setup/Inbox. **Projekt-/Dashboard-Komponenten** importieren **`@/frontend/lib/api`** direkt (**§ H.2** Vorprüfung + Lückentabelle in **`docs/PWA-MANUAL-CHECKS.md`** ergänzt). **Nachgezogen (2026-03-31):** Vitest **`einsatz-role-templates.test.ts`** — Parser **`parseEinsatzRoleTemplatesResponse`** für **`GET/POST /api/einsatz-role-templates`** (**§ H.1a**, stützt **§ H.3g** Paket **2**/UI **6**). **Nachgezogen (gleicher Monat):** **`get-status-compat.test.ts`** — **`mapApiStatusFetchOkToLegacyGetStatusResponse`** (`getStatus`/`fetchStatus`-Mapping für Dashboard).

### H.2 Als Nächstes – aus 8-Punkte-Liste (nach Stabilität)

| Priorität | # | Thema |
|-----------|---|--------|
| 1 | **5** | **PWA:** Manifest + SW + **PNG-Icons** (§A.5). **Manuelle Checks:** Checkliste **`docs/PWA-MANUAL-CHECKS.md`** (Install, Offline-Shell, Handbuch-Cache, Icons nach `icon.svg`). **Optional:** Offline-Fallback-Seite, SW erweitern. Bei **Änderung von `icon.svg`:** `npm run build:pwa-icons` erneut ausführen. |
| 2 | **6** | Fehlermeldungen/Status konsistent (laufend). **Ist 2026-03:** Timeout/Offline-Fetch-Nutzertexte zentral **`api-fetch-text`**; Inbox-Offline-Heuristik **`inbox-load-error`** darauf abgestimmt (**`docs/PWA-MANUAL-CHECKS.md`** § Status-/Fehlermeldungen). |
| 3 | **8** | **Kabel-Bridge** (hoch, spec-nah) – siehe §A.8; Backlog, nicht parallel zu Phase-B-Kern. |

### H.3 Phase B – wenn A „genug“ stabil ist

| Paket | Quelle |
|--------|--------|
| **Mesh v2** zuverlässig (Senden/Empfangen, Web-BT) | `PROJECT-FOCUS` Phase B; manuelle Schritte **`TESTING.md`** § *Phase B — Mesh / Web-BT*; Code: sauberes **BLE-Trennen**, **Burst-Pause** zwischen v2-Paketen (`MESH_V2_BURST_INTER_PACKET_MS_DEFAULT`) |
| **Pfad 4 — LoRa + eigene Verankerung (Klartext, MVP)** | **Ist (2026-03-28):** LongFast-Klartext, danach **`sendPlaintextMailboxHybrid`** an **MY_ADDRESS** + optional Forensic; Marker **`MORG_PATH4_SELF_ARCHIVE_V1`**; **Backlog:** LUMA/CHROMA ohne ECDH, Doku **`MESSENGER-CAPABILITIES-OVERVIEW.md`**, Smoke in **`TESTING.md`**. |
| **Delayed LoRa → IOTA MVP** | **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** – Queue, Gateway, Custody; **Abgleich** mit **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (**§ H.12**); **Realität Notfall/Funk:** **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`** (**§ H.3m**); **SOS-Wire:** **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** (**§ H.3n**). **Client-Vorarbeit (Ist, 2026-03-28):** lokale Mirror-Warteschlange + Drain, Radio **Nur LoRa / LoRa+Tangle** mit Persistenz, Forensic-Attestation nach erfolgreichem Mirror inkl. **`mtx`** — **kein** Ersatz für vollständiges MVP/Gateway laut Spec. |
| **Kein** paralleler Start: volles Macro-Gateway, Reticulum, DID/Twin-Produkt | Nur Doku/Specs pflegen |
| **Globales Relay / „jede Basis → ein VPS“** | **Nicht** vor Phase-B-Kern; Einordnung **§ I** – erst Trust-/Gateway-Spec, dann Phase C |
| **EU-Funk / Hardware / Einsatzprofile (Doku)** | **`docs/LORA-EU-FUNK-HARDWARE-EINSATZPROFILE.md`** — EU868/Subband-P-Einordnung, eine HF-Kette, Kanal-/Gateway-Abstimmung, Antenne/USB/LNA/PA-Grenzen, Szenarien (Höhle, Krise, Wandern, professionelle Einsätze); **keine** Rechtsberatung |
| **Modularer Kern, Adapter, Auto-Modus, Interop (Doku)** | **`docs/MODULAR-KERN-ADAPTER-INTEROP.md`** — Kern vs. Transport- vs. Funk-Adapter; Auto-Detection **mit Override**; realistische „volle“ Interop; BOS/HSM als **Rand**, nicht Kern-Fork-Pflicht |
| **USB-Serial vs. Web-BT (Doku + später Code)** | **`docs/HELTEC-USB-SERIAL-VS-BLE-TRANSPORT.md`** — Durchsatz/OTG/Web-Serial-Matrix; Meshtastic-Protokoll vs. `lora-bridge`-Rohserial; Transport-Interface statt `if (USB)`-Wildwuchs; **Vorbereitung:** Spike **Web Serial auf Android** (**§ H.3l**, **ohne** Blockade für Mesh/BLE) |
| **Offline-Karten / Geodaten (Zielbild)** | **`docs/OFFLINE-KARTEN-UND-GEODATEN-ZIELBILD.md`** — Wanderer (Basis) vs. Einsatzpaket; **§ H.11**; **nach** Phase-B-Kern, mit **§ H.9** ATAK verzahnbar |
| **Ad-hoc / Smartphone-Direct (BLE)** | **Nach** Phase-B-Kern (Mesh/Web-BT zuverlässig): Sendepfad **`adhoc`** in der UI ist **Platzhalter** — **direktes** Handy-zu-Handy-BLE (**nicht** Web-BT→Heltec→LoRa). Konzept/Daten: **`bleUuid`** im Vault, Advertising/Scan; vgl. Hinweise in **`use-chat-view-handle-send.ts`** / Transport-Karte. **Abgrenzung:** **`docs/MESSENGER-CAPABILITIES-OVERVIEW.md`** (**funk** = Meshtastic, **adhoc** = BLE-Direct, noch offen). |

### H.3b Optional (Doku, kein Sprint-Zwang)

| Thema | Hinweis |
|--------|---------|
| **QR-Kontakt Schema v2** | **Erledigt (Doku):** **`docs/QR-CONTACT-SCHEMA-V2.md`** – optionale Felder `s` (Streams-Anker), `b` (Morgendrot-API-Basis), `g` (Gateway); Trennung zu `u` (IOTA-RPC). **Implementierung** (Parser/UI/Setup): erst bei Bedarf, nicht vor **H.1**-Stabilisierung zwingend. |
| **Betrieb: VPS vs. lokal** | Kurztext: was API/Bridge **darf** und **nicht** verspricht (Metadaten, Logs); verhindert falsche „Anonymitäts-Garantie“. |
| **Öffentliche Narrative** | Checkliste **§ I.4** – **Ist / Vision** kennzeichnen. |

### H.3c Betrieb: Secret-Manager & Self-Pay (kleine Schritte, 2026-03)

| Schritt | Status / nächste Aktion |
|---------|-------------------------|
| **Secret-Manager (Doppler, Vault, …)** | **Doku:** **`docs/SECRETS-OPTIONS.md`** Option C — kritische Einordnung (Festplatte vs. RAM/Prozess; GitHub Secrets ≠ Server-Tresor); **`deploy/README-DEPLOY-BUNDLES.md`** verweist auf VPS-Start. **Code:** nicht nötig — `doppler run -- npm start` o. Ä. setzt `process.env`. |
| **Self-Pay optional** | **Policy:** `ENABLE_MESSENGER_SELF_PAY` **default `false`** — keine stillen MIST-Abbuchungen; siehe **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`**, **`docs/CONFIG-REFERENCE.md`**, **`.env.example`**. **Code:** Flag ist **vorbereitet**, Auswertung wenn Self-Pay implementiert wird. |
| **Voucher-Claim (Shop-Link)** | **Stufe 1 (Ist):** **`POST /api/voucher-claim`** — nur **Idempotenz** (`.morgendrot-voucher-claim-state.json`). **`ENABLE_VOUCHER_CLAIM_API`**. **Offen (Stufe 2):** Move-**Burn/Mint** bzw. Wallet-Provisioning an denselben Flow koppeln — **`docs/API-VOUCHER-CLAIM-SPEC.md`**. |
| **Shop (Stripe, All-in-One)** | **Stufe 2 (teilweise):** Checkout, Webhook, Session-Claim, optional **Credits-Mint** (`ENABLE_SHOP_CHAIN_MINT`, Empfänger-Adresse im Checkout), **Notify-Webhook** (`SHOP_CLAIM_NOTIFY_*`) — **`docs/API-SHOP-SPEC.md`**, Code **`src/api/shop/`**, **`src/api/iota/shop-fulfillment.ts`**, Test **`docs/STRIPE-TEST-SETUP.md`**. **Offen:** SMTP im Core (bewusst extern über Notify); Admin-UI „Credits schenken“ nur indirekt über **`/api/provision-device`** / Boss — siehe **`docs/CREDITS-SHADOW-SWEEP-AND-FULFILLMENT.md`**. |
| **Später** | CI-Deploy: Secrets nur aus Store injizieren; kein Klartext in Artefakten; kombinierbar mit Option B auf Edge-Geräten. |

**Kleine nächste Schritte (ohne großen Code):**

1. **VPS / Runbook:** `doppler run -- npm start` (oder **gleichwertiges** Tool) im **Runbook** **testen** — Ziel: reproduzierbarer Start **ohne** Sponsor-Secrets in Klartext-Dateien auf der Platte.
2. **Wenn Self-Pay gebaut wird:** `ENABLE_MESSENGER_SELF_PAY` im **Sendepfad auswerten** und **UI-Hinweis vor Abbuchung** (kein stiller MIST-Verbrauch ohne Zustimmung).
3. **Testen Credits ≠ MIST:** Smoke wie **`TESTING.md`** (Abschnitt *Smoke nach Merge*, Punkt **4**) — `GET /api/status`, Credits-Anzeige vs. Begriffsverwechslung mit nativem Gas; Doku **`docs/MESSENGER-OPERATIONAL-LIMITS-AND-GAS-POLICY.md`** §8.

### H.3d Meshtastic: Hop-Limit, manuelles Relay, Brücken (Doku)

| Thema | Kurz |
|--------|------|
| **7-Hop-/TTL-Verhalten** | Paket mit Hop-Budget **0** wird **lokal** noch angezeigt, aber **nicht** weitergefloodet — Schutz vor Dauerlast, kein „unendlich weit“ im selben Flood. |
| **Handy/PC als Relay** | Empfang + **neu** senden = neues Budget; **Nachteil:** Verzögerung, **doppelte** Funklast, **Dedup** in der App nötig. |
| **Naives Re-Broadcast** | Fast immer **Broadcast-Storm**-Risiko → **nicht** als Standard. |
| **ROUTER/REPEATER, Kanal, Leistung** | Sinnvoll für Stabilität und **weniger Seitenlärm**; **kein** echtes „MeshCore-Routing“ in Meshtastic nachbauen. |
| **Zwei Heltecs seriell (Brücke)** | Oft **stabilste** Weg für **7+7** Hops auf **getrennten** Funksegmenten; siehe kritische Einordnung **`docs/MESHTASTIC-HOP-LIMIT-AND-BRIDGE.md`**. |

### H.3e Lücken, Verbesserungen, Betrieb (**Git**, **Logs**, Artefakte)

Zentrale Übersicht (regelmäßig aktualisieren): **`docs/OPERATIONS-SNAPSHOT-2026-03.md`**.

| Thema | Kurz |
|--------|------|
| **Git** | Keine Secrets committen (`.env`, Stripe-Keys); State-Dateien Shop/Voucher in **`.gitignore`**; vor großen Commits **`docs/GIT-CLEANUP-AND-COMMIT-PLAN.md`**. |
| **Logs** | **`logs/`** bei **`ENABLE_FILE_LOGGING`** (Winston, Rotation); operative Ereignisse auch in Konsole; keine Claim-Tokens / Mnemonics in Support-Logs. |
| **Shop/Voucher-State** | `.morgendrot-shop-*.json`, `.morgendrot-voucher-claim-state.json` — nur auf Fulfillment-Host, **Backup** bei Produktion. |
| **Noch offen (Produkt)** | Voucher-Claim **Stufe 2** (Move an `/api/voucher-claim`); optionale **dedizierte** Admin-Route „Credits schenken“ (aktuell: Provision-Flow); **Mehrinstanz**: Shop-State-Datei → DB bei horizontaler Skalierung. |
| **PWA-Handbuch (`frontend/public/handbook/`)** | Quelle: **`docs/BOSS-ORIENTIERUNG.md`**, **`docs/PWA-HANDBUCH-OFFLINE.md`**. Nach **jeder inhaltlichen Änderung** dieser Dateien: im Repo-Root **`npm run sync:handbook`** ausführen (oder **`npm run build`** im Ordner **`frontend/`** — **`prebuild`** sync’t automatisch). Ohne Sync ist die PWA unter **`/handbook`** veraltet. |

### H.3f Vision: Provisioning-Payload & „Identity-Credits“ (Doku, keine Phase-B-Pflicht)

**Kontext:** Produktidee — beim Setup nicht nur Seed, sondern **Kontakt-/Rollen-/Kanal-Metadaten**; **Credits-Objekt** als Anker für **Einsatz-Kontext** (nicht nur Zähler).

| Aspekt | Kurz |
|--------|------|
| **Kritik / Ist-Abgleich** | **`docs/PROVISIONING-PAYLOAD-CRITIQUE.md`** — `EcdhInit` hat **kein** freies Metadaten-Feld; `MessengerCredits` hat **keine** Rollen-/Kanal-Felder; Rollen kommen aus **`.env`** / Export. |
| **Risiko** | Öffentliche Chain-Objekte + Profildaten → **Privacy**; Credits mit Profil **mischen** → Upgrade-/Gas-Komplexität. |
| **Nächste sinnvolle Stufe** | **Stufe A** (ohne Move): Boss-**Export**/Vault-JSON für **lokales** Einsatzprofil; **Stufe B/C** erst nach Architektur-Review — **nicht** vor Mesh-MVP blockieren. |
| **Verwandt** | **`docs/ARCHITECTURE-PROVISIONED-AUTONOMY-RELAY.md`**, **`docs/WANDERER-REDEEM-PROVISIONING-FLOW.md`** |
| **Offline-Boss / `initialProfile`** | **`docs/OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`** — Warteschlange **nicht** mit `mintMessengerCreditsBatchForRecipients` verwechseln; Profil-Payload vs. Kontakt-API / Lite-UI vs. Next-PWA. |
| **Einsatzleitung UI (Rollen-Manager, Provisioning-Maske)** | **`docs/EINSATZLEITUNG-ROLLEN-MANAGER-CRITIQUE.md`** — Medic/Scout vs. Chain-`ROLE`; Handshake braucht Pubkey; Kanal „Sektor Nord“ = Profil-Tag bis Mehrkanal-Modell klar ist. |
| **Metadata / Zukunftsfelder (Präsenz, SOS, Waypoints, …)** | **`docs/INITIAL-PROFILE-METADATA-AND-FUTURE-FIELDS-CRITIQUE.md`** — welche Idee gehört zu **Profil** vs. **Laufzeit** vs. **Nachrichtenprotokoll**; **`metadata`** + **`validUntil`** in API (v1). |
| **„Heim-Heltec“ ohne Pi / ohne App (nur Relay)** | **`docs/HEIM-HELTEC-GATEWAY-NARRATIVE-CRITIQUE.md`** — LoRa→WLAN plausibel; **kein** beliebiger POST „an Shimmer“ = Chain; Settlement = **Morgendrot/Bridge/Wallet/Sponsor**-Pfad. |

### H.3g Umsetzungspaket: `initialProfile`, Offline-Relay-Queue, Einsatzleitung (nicht vergessen)

**Ziel:** Alle diskutierten Bausteine **gebündelt** auf der Roadmap halten — **Reihenfolge** und **Abhängigkeiten** explizit.

| # | Arbeitspaket | Kurzinhalt | Abhängigkeit |
|---|----------------|------------|--------------|
| **1** | **API `initialProfile` + Schema** | **`Ist (2026-03):** `POST /api/provision-device` optional `initialProfile` (v1: Kontakte, **`metadata`** flach, **`validUntil`**); Validierung **`src/initial-profile-provision.ts`** — **`docs/API-INITIAL-PROFILE.md`**, Erweiterungs-Kritik **`docs/INITIAL-PROFILE-METADATA-AND-FUTURE-FIELDS-CRITIQUE.md`**. Lite-UI/Next-Import siehe Pakete 3–4. | **`docs/PROVISIONING-PAYLOAD-CRITIQUE.md`**, **`docs/OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`**, **`docs/API-INITIAL-PROFILE.md`**, **§ H.3h** |
| **2** | **Boss-Worker / Persistenz** | **`Ist:`** `GET/POST /api/einsatz-role-templates`, Datei **`.morgendrot-einsatz-templates.json`** — **`docs/API-EINSATZ-ROLE-TEMPLATES.md`**. | API **1** |
| **3** | **Lite-UI-Import** | **`Ist:`** `POST /api/contact-labels/apply-initial-profile` + **`roleTags`** in Kontaktdatei; Provisioning-Schritt **„Kontakte ins Boss-Telefonbuch übernehmen“** — Next-PWA später. | **1**, **2** |
| **4** | **Next-PWA-Import** | **`Ist:`** Einstellungen → **Einsatz-Profil** (JSON / Datei); `applyInitialProfileProvisioning` + automatische Warteschlange `localStorage` + Banner; Telefonbuch zeigt **`roleTags`**. IndexedDB bewusst nicht — **eine** Quelle (Backend-Datei). | **1**–**3** |
| **5** | **Handshake-Subflow in der Maske** | **`Ist (2026-03):`** Lite-UI Provisioning Schritt 3: optional Partner + ECDH-Pubkey (Base64) → `POST /api/boss-provision-handshake` nach erfolgreichem `provision-device` — **`ui/index.html`** (`sendProvisionHandshake`). | **`docs/EINSATZLEITUNG-ROLLEN-MANAGER-CRITIQUE.md`** |
| **6** | **Rollen-Manager (Boss-Werkstatt)** | `ui/`: Templates (Einsatz-Rolle → Chain-`ROLE`/`roleId`); Medic/Scout als **Labels**, nicht als neue Chain-Enums. **Next-PWA (2026-03):** Einstellungen → **Einsatz-Rollen-Vorlagen** (JSON, `GET/POST /api/einsatz-role-templates`) wenn **`ROLE`** `boss` oder `messenger`. | **1**, **2** |
| **7** | **Offline-Relay-Queue (Boss ohne Internet)** | **Voll:** Eigenes Modul nach Vorbild **`settlement-queue.ts`**; **kein** Missbrauch von `mintMessengerCreditsBatchForRecipients`; typisierte Einträge + Flush; **Sync-Regeln** **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (**§ H.12**). **Vorbereitung (2026-03, Next-PWA):** **`frontend/frontend/lib/api/offline-queue.ts`** — lokale **Mailbox**-Outbox bei fehlgeschlagenem `/send`/`/send-plain` (Opt-in **`morgendrot.offlineMailboxQueue`**), **kein** Ersatz für Relay/Settlement; Idempotenz/`canonical_msg_ref` später mit § **H.12** verzahnen. | **`docs/OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`** |
| **8** | **Doku & Git** | Nach jedem größeren Schritt: **`README.md`** (Links), **`docs/ROADMAP-FAHRPLAN.md`** (Statuszeile), **`docs/OPERATIONS-SNAPSHOT-2026-03.md`** bei Betriebsrelevanz; Commit ohne Secrets (**`docs/GIT-CLEANUP-AND-COMMIT-PLAN.md`**). **`docs/ROLLENWECHSEL-TEAM-EINSATZ.md`** ergänzt (2026-03-28): klare Trennung Provisioning vs. Fern-Push vs. Trägerbild-Ist. | Laufend |

**Priorität für die nächste Implementierung (wenn gestartet):** typischerweise **1 → 2 → 6** (API + Persistenz + Boss-UI), parallel Doku; **7 voll** wenn LoRa/Offline-Boss + § **H.12** konkret werden; **7a** (Client-Mailbox-Outbox) kann **vorher** die Resilienz des Messenger-„Online“-Pfads verbessern; **3/4** wenn Endnutzer-PWA im Fokus ist.

### H.3h Erweiterungen rund um `initialProfile` (Checkliste vs. Umsetzung)

**Doku:** **`docs/INITIAL-PROFILE-METADATA-AND-FUTURE-FIELDS-CRITIQUE.md`**.

| Thema | Kurz |
|--------|------|
| **Metadata-Container (`metadata`)** | **Ist (v1):** flache String-Werte, validiert in **`src/initial-profile-provision.ts`** — kein automatisches „App lernt alles“; komplexe Daten als JSON-String in einem Key. |
| **`validUntil`** | **Ist:** optional mitvalidiert; **Client-Logik** (Purge nach Ablauf) = Backlog. |
| **Präsenz / Akku / `lastSeen`** | **Nicht** nur statisches Profil — **Laufzeit** (Heartbeat, Streams, Mesh). |
| **Sichtbarkeit / `teamId`** | Feld in Metadata möglich — **Durchsetzung** = gesonderte Policy/API. |
| **SOS / `isEmergency`** | **Nachrichten-**Schicht, nicht `initialProfile`. |
| **Waypoints** | Konvention: JSON in **`metadata`** oder später Schema v2. |
| **Paket 5** (Handshake-Subflow) | **Erledigt (Lite-UI):** siehe **§ H.3g** Zeile **5**; Next-PWA optional später. |

### H.3i Heim-Heltec / „transparenter Gateway“-Erzählung (Marketing vs. Technik)

| Thema | Kurz |
|--------|------|
| **Zielbild** | Heltec zu Hause: **LoRa rein → IP (WLAN)**; Bewohner **ohne** Morgendrot-UI, idealerweise **ohne** Wallet-Bedienung. |
| **Kernkorrektur** | Chain-Settlement = **signierte TX / definiertes Gateway** (`lora-bridge`, Morgendrot-API) — **nicht** beliebiger HTTP-Post an eine öffentliche Node-URL. |
| **Doku** | **`docs/HEIM-HELTEC-GATEWAY-NARRATIVE-CRITIQUE.md`**; Ist: **`lora-bridge/README.md`**, **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**. |
| **Offen** | Firmware-Header (**`MORG`**), Sicherheit (TLS/API-Key), Sponsor-Queue — eigene Arbeitspakete bei Produktreife. |

### H.3j LoRa / EU-Funk: Subbänder, Hardware, Einsatzprofile (Doku, Phase-B-Vorbereitung)

| Thema | Kurz |
|--------|------|
| **Zweck** | Einheitliche **technische** und **rollenbezogene** Einordnung für Feldtests und Marketing — **ohne** Zulassungs- oder Reichweite-Garantie. |
| **Nutzergruppen** | Privat/Wanderer, Freundesgruppen, Hilfsorganisationen, professionelle Einsatzkräfte; **taktische oder sicherheitsrelevante** Szenen nur **sachneutral** (Behörden/Organisationen), kein „Kampfprodukt“-Narrativ. |
| **Szenarien** | Nicht nur **Höhle**, sondern **Katastrophe/Blackout**, **professionelle SAR-Übungen**, **Wandern** — gleicher Funk-Baukasten, unterschiedliche **Topologie** und **Schulung**. |
| **Technik** | Subband **P** vs. restliches EU868; **kein** echtes gleichzeitiges Dual-Band auf einem SX1262; **nur** mesh-weite „Turbo“-Kanäle mit **abgestimmten** Empfängern/Gateways; **Antenne vor Watt**; **USB/UART** Handy↔Heltec; **keine** sinnvolle LoRa-Nutzung der **LTE-Handyantenne**; externe LoRa-Antenne statt RF-Switch am Smartphone. |
| **Doku** | **`docs/LORA-EU-FUNK-HARDWARE-EINSATZPROFILE.md`** — Verweise auf **LORA-IOTA-Delayed-Upload-Spec**, **MESHTASTIC-BUILDING-BLOCKS**, **MESHTASTIC-HOP-LIMIT-AND-BRIDGE**, **NOTFALL-REICHWEITE**, **heltec/README**. |

### H.3k Modularer Kern, Adapter, Auto-Modus, Interoperabilität (Doku, Zielbild)

| Thema | Kurz |
|--------|------|
| **Kern** | Messenger-/Chain-Semantik, Vault, Emergency-Envelope — **ohne** Pflicht zu jedem Funkstack. |
| **Adapter** | Meshtastic/BT/Serial, `lora-bridge`, MQTT (Spec); **BOS** = **externes** Funk-Subsystem + Schnittstelle, nicht „Softwareschalter“ auf ISM-Hardware. |
| **Auto-Detection** | Sinnvoll als **Vorschlag** + **Override** (USB kann Laptop sein; ohne Display ≠ immer gewünschtes Relay); Umsetzung **Firmware + Host**, siehe **`docs/MODULAR-KERN-ADAPTER-INTEROP.md`**. |
| **Interop** | Schichtweise (Mesh-Kanal, Envelope-Version, APIs); **kein** Anspruch auf weltweite Plug-and-Play-Interop ohne Abstimmung. |

### H.3l USB-Serial vs. BLE zum Heltec (Doku; Code Phase B optional)

| Thema | Kurz |
|--------|------|
| **Priorität** | **Stabilität Phase B (Mesh / Web-BT)** geht **vor** Serial-Produktivcode. Serial-Spike ist **Vorbereitung**, blockiert **keinen** Mesh-MVP. |
| **Zweck** | Kritische Einordnung: wann **UART/USB** echten Mehrwert bringt (Durchsatz Handy↔Radio, Debug-Logs), wo **Behauptungen zu stark** sind (NACK **zwingend** Kabel, Feld-Flash vom Handy, „nur USB“ für Akku/Turbo). |
| **Ist-Code** | **Web Bluetooth** im Frontend (`use-meshtastic-ble.ts`); **Serial** auf dem **PC** in **`lora-bridge`** — **kein** Web-Serial in der PWA bisher. |
| **Nächste Code-Schritte (wenn priorisiert)** | Transport-Abstraktion (BLE vs. Serial) **oberhalb** Meshtastic-Payload; **Geräte/Browser-Matrix** für Web Serial / OTG; Meshtastic-konformes Serial-Protokoll **nicht** mit `lora-bridge`-Rohpfad verwechseln. |
| **Arbeitspaket (Spike)** | **„Spike: Web Serial auf Android“** — siehe Tabelle unten und **`docs/HELTEC-USB-SERIAL-VS-BLE-TRANSPORT.md`** § 5. Ziel: auf **Ziel-Handys** klären, ob **USB-OTG + Web Serial** als **Highspeed-Kanal** für **große Daten zum Heltec** taugt, **bevor** das Protokoll fest darauf zugeschnitten wird. |
| **CM4-Hinweis** | **CM4 ≠ Android.** Dort kein „Web Serial“-Spike nötig: typisch **Linux UART** / bestehende **`lora-bridge`**-Serial (`serialport`). Optional separater Mini-Spike: **Durchsatz/Baud** Pi↔Heltec — nicht dieselbe API wie im Browser. |
| **Doku** | **`docs/HELTEC-USB-SERIAL-VS-BLE-TRANSPORT.md`**. |

**Spike „Web Serial auf Android“ — Schritte (manuell, Ergebnis dokumentieren):**

| # | Schritt | Erfolgskriterium (minimal) |
|---|---------|------------------------------|
| **1** | **Zielgeräte festhalten** (Handymodell(e), Android-Version, Chrome-Version, USB-C-Kabel/OTG-Adapter). | Liste in **`docs/HELTEC-USB-SERIAL-VS-BLE-TRANSPORT.md`** § 5.1 oder Team-Notiz; reproduzierbar. |
| **2** | Prüfen, ob **`navigator.serial`** auf dem Gerät **existiert** und eine Seite mit **HTTPS/lokal** den Prompt öffnen darf. | Ja/Nein pro Gerät; Screenshots oder Kurzlog. |
| **3** | Heltec per **USB-OTG** verbinden; im Chrome-Dialog **CDC-ACM** / passenden COM-Port wählen (Gerätebezeichnung je nach Firmware). | Port öffnet sich **ohne** Kernel-Fehler; ggf. nur **Lesen** von Boot-Logs als Rauchtest. |
| **4** | **Durchsatz-Rauchtest:** definierte Bytefolge (z. B. **16–64 KB** in Chunks) **schreiben** und Roundtrip oder **Echo** messen (kleines **Test-HTML** im Repo optional später). | Grobe **KB/s** und **Latenz** notieren; mit **gleichem** Payload **BLE**-Pfad vergleichen (wenn möglich). |
| **5** | **Fazit:** „Serial taugt / taugt nicht / nur Gerät X“ für **Bild-/Chunk-Pfad**; **Blocker** (Permissions, Chrome-Build, Strom, Kabel) listen. | Absatz in § 5.2; **kein** Pflicht-Produktcode vor diesem Fazit. |

**Kritische Einordnung:** Der Spike misst vor allem **Handy↔Heltec**. **LoRa-Airtime** bleibt unabhängig davon der oft größere Engpass — Fazit trotzdem wertvoll für **host-seitige** LUMA-/NACK-Schleifen.

### H.3m LoRa, Notfall & IOTA — Realitätscheck (**Doku**, Phase-B-Grundlage)

| Aspekt | Kurz |
|--------|------|
| **Zweck** | Die Erwartung „**volle IOTA-TX** über **LoRa**“ von der **machbaren** Architektur trennen: **kompakte** Funknutzlast → **Basis/Gateway** → **volle TX** / Verankerung (**Delayed Upload**). |
| **Kern** | **Nein:** komplette signierte PTB **roh** über ein LoRa-Paket (Größe, Fragment-Verlust). **Ja:** SOS/Beacon/Hash + Metadaten über Funk; **Internet-Kante** baut und sendet die **schwere** Chain-Arbeit. |
| **Verweise** | **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`** — Payload-Limits, MQTT/Gateway, Vertrauen, Risiken, **Nächste Schritte** (direkter RPC von der Basis, `MORG_EMERGENCY_V1`-Zielbild, Brücke zu realen Notfallkanälen). **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`** (112, Leitstelle). |
| **Priorität** | Mit **Phase B** / **§ H.7b** lesen; **kein** separates Epic — Inhalt in **Queue-, Parser- und Gateway-Design** einspeisen. |

### H.3n SOS / `MORG_EMERGENCY_V1` — Wire, Priorität, Basis (**Zielbild**, Phase B)

| Aspekt | Kurz |
|--------|------|
| **Zweck** | **Sofort-Hilferuf** über LoRa: **höchste App-Priorität** (`MacroPriorityClass.Flash`), **Wiederholung mit Backoff**, kompaktes **Emergency-Wire**; **Basis** erkennt Flag und **priorisiert** IOTA-Upload + optional Webhook/SMS (**kein** Ersatz für 112 ohne Vereinbarung). |
| **Doku** | **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** — Idealbild, **Korrekturen** (Meshtastic priorisiert nicht von selbst; **keine** volle IOTA-Signatur über Funk; **Duty Cycle**; Sprache = Hash/Chunks), Abgrenzung normale Nachrichten vs. Emergency, Phasen B1–B4. |
| **Ist-Code (Messenger)** | **B1+B2:** UI-SOS, `MORG_EMERGENCY_V1` (**§7** Freeze), Mesh-Flash-Burst, **Backoff-Retry** + **Mailbox-Ack stoppt Funk** (`morg-sos-mesh-retry`, `/send` zwischen Versuchen; Opt-out `localStorage`), **IOTA-Spiegel** nach reinem Funk-Erfolg, einheitliche **`[SOS]`**-Anzeige (Vitest: `chat-message-display-normalize`). |
| **Bezug** | **`emergency-binary-wire.ts`** (v2, Byte `0x02`), **`src/shared/opcodes.ts`**, **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`**, **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**, **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**, **`docs/MESHTASTIC-BUILDING-BLOCKS.md`** §3. |
| **Priorität** | **Phase B** zusammen mit Mesh v2 + Delayed Upload — **nicht** vor **§ C.0b** Stufe 4-Voraussetzungen; **nicht** parallel zu großem **§ H.1b**-Refactor ohne Absprache. |

### H.4 Kurz-Check vor jedem größeren Merge

- **`npx tsc`** (Root)  
- **`frontend`:** **`npx tsc --noEmit`** (Next-TS)  
- **`npm run test`** oder gezielte Skripte aus **`TESTING.md`**  
- Bei Messenger-UI: **`npm run validate:ui`** wenn refs/TREE betroffen  
- Nach Änderung an **`frontend/public/icon.svg`:** **`npm run build:pwa-icons`** (PNG/Manifest-Icons aktualisieren)
- Nach Änderung am **PWA-Handbuch** in **`docs/`** (Quelle für **`/handbook`**): **`npm run sync:handbook`** im **Repo-Root** — siehe **§ H.3e** Zeile **PWA-Handbuch** (oder nur **`frontend/`** neu bauen; **`prebuild`** sync’t).

### H.5 Aufräumen & Git-Commit (nach stabilem Kern)

Was behalten, was nicht zurückbauen, Commit-Reihenfolge: **`docs/GIT-CLEANUP-AND-COMMIT-PLAN.md`**.

**Kleine Hygiene (Phase A, ohne Feature-Umbau):** **`.gitignore`** bei neuen lokalen Artefakten aktualisieren; **tote Dateien** nur entfernen, wenn sie wirklich unreferenziert sind (kein Raten); **Kommentare** nur streichen, wenn sie eindeutig überholt sind. **Kein** großes Neu-Zerlegen von **`use-chat-view-core.ts`** ohne Nutzen — siehe **§ A Punkt 4**.

### H.6 Zukünftige Ideen (**nicht** gebucht, nur merken)

| Idee | Anmerkung |
|------|-----------|
| **Boss-/Basis-Management-Dashboard** („wer ist aktiv“, Rechte per Klick) | Braucht klare **Quelle der Wahrheit** (Chain vs. Server-`.env`); sonst nur UI-Schein. Konkretere gebuchte Pakete: **§ H.3g** + **`docs/EINSATZLEITUNG-ROLLEN-MANAGER-CRITIQUE.md`**. |
| **Narrative** (Root-of-Trust-Signatur, Admin-QR → Boss, NFT = Basis) | Teilweise **Zielbild**; gegen Code prüfen (**`docs/ARCHITECTURE-ROLES-AND-HUB.md`**, **`docs/BOSS-MODUS.md`**) bevor es in öffentliche Texte wandert. |
| **Ack-/Quittungs-Begriffe trennen** (Produkt + Doku) | **Mesh-Peer** (z. B. `MORG_SOS_ACK_V1`) ≠ **Basis/Gateway-Digest** (leichtes Log, Airtime-Stop) ≠ **Mailbox/on-chain** (starker Boss/Archiv-Pfad). Keine Leitstellen-Garantie aus dem falschen „ACK“. |
| **SOS Zielbild §5** (öffentlich / privat) | Schrittweise: Marker-Daten für Typ + **eine** Koordinate (Policy), getrennt vom verschlüsselten Morgendrot-Body; **EXTERNER HELFER**-Darstellung ausbauen — **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`**, **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**. |
| **E2E-IOTA-Quittung vs. Digest-Stop** | **Tangle-verankerte** Rückbestätigung + schlanker Burst = **eigenes** Priorität‑1-Ziel; optionale Digest-/Gateway-Hooks **ersetzen** das narrativ **nicht** — siehe **§ H.6b**, **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`**. |
| **`@morgendrot/core` / geteilter TS-Kern** | Wire, Hash, Retry, Opcodes **eine** Bibliothek für Handy + optional Laptop — Schrittweise aus **`src/shared`** + Frontend-Spiegel konsolidieren (**§ C.1** Prio‑1‑Reihe). |
| **`.env` vs. Runtime-Konfig** | `.env` ist auf dem **Handy** nach Build kaum änderbar; Core braucht **keinen** `.env`-Loader. | **§ H.6e** — Node bleibt `.env`, App = **Storage/DB** + injizierbare Defaults. |

### H.6b **Handy-Only Resilience** (Vorschlag — **kritisch eingeordnet**, kein harter Architektur-Bruch)

**Ausgang:** Drei Säulen — (1) **Smartphone = Sovereign Node** (100 % Signieren/Verschlüsseln/TX-Erstellung via Shared Core), (2) **Heltec = reines Funk-Modem** + **Burst-Sync beim App-Öffnen**; Heltec puffert im Flash (**LittleFS**); Ziehung per **USB-Serial (hohe Baud)** oder **BLE-Batch**; **Kabel-First** im Notfall, (3) **App → öffentliche IOTA-Nodes**; **Server = optionales Sponsor-/Gas-Relay** nur bei expliziter Einstellung (**Komfort vs. Autarkie**).

**Was wir übernehmen (Zielbild, mit bestehender Vision vereinbar):**

| Element | Einordnung |
|--------|------------|
| **Local-First / optionaler Server** | Entspricht bereits **§ I**, **§ H.7b**, **`docs/MESSENGER-STRATEGIC-PRINCIPLES-LOCAL-FIRST-IDEMPOTENCY-PQ.md`** — Server bleibt **Erweiterung**, nicht Pflicht. |
| **Burst-Sync / „on open“, kein blindes Background-Polling** | Deckt sich mit **§ H.12** (`SYNC-SOURCE-OF-TRUTH-…`), **§ A.8** Kabel-Bridge, **§ H.3l** — **richtige** Priorität für Android/iOS-Realität. |
| **Cable-First als Reihenfolge** | Sinnvoll als **Einsatz-Default** (USB-OTG / Station), **parallel** zu Web-BT — nicht als **Ausschluss** von BLE (Wanderer ohne Kabel). |
| **Gas / Sponsor nur opt-in** | Passt zu **§ I.1**, **`docs/SPONSORING-AND-CREDITS-DOUBLE-FLOOR.md`**, `gas-station` — UI/Policy: **Autarkie** default, **Komfort** explizit. |
| **Weniger „Intelligenz“ auf dem Heltec** | Konsistent mit **Meshtastic-Standard-Firmware** + App-seitiger Queue/Priorität — **kein** Pflicht-Sprint für Custom-Firmware. |

**Kritik / Grenzen (damit kein falsches „final pivot“-Versprechen entsteht):**

| Punkt | Bewertung |
|--------|------------|
| **„Heltec puffert autonom im LittleFS“** | Mit **Stock-Meshtastic** ist das **kein** Morgendrot-spezifischer Ringpuffer ohne **eigene Firmware** oder **definierten** Seitenkanal — Umsetzung = **Phase B+** mit Spec (**`docs/HELTEC-USB-SERIAL-VS-BLE-TRANSPORT.md`**, ggf. `lora-bridge`), nicht kurzfristig als erledigt behaupten. |
| **921 600 Baud + Handy-USB** | **OTG**, Treiber, **Web Serial auf Android** (Coverage, Hersteller) — **§ H.3l** Spike; **Boss/CM4** bleibt realistischer **Erst-Anker** für Serial-Turbo. |
| **100 % TX nur auf dem Handy** | **Akku**, **Offline-RPC**, Wallet-/MIST-UX, **Rate-Limits** öffentlicher Nodes — technisch erstrebenswert, **Produkt** muss **degradierte Modi** (Mailbox über Basis, Delayed Upload) **weiter** erlauben (**§ H.7b** „LoRa-only-Minimum“). |
| **CM4/Boss „wegdefinieren“** | **Widerspricht** Einsatzrealität (**§ H.7b**): Backpack-Node bleibt **sinnvolle** Rolle; das Ziel ist **optional**, nicht **entfernt**. |

**Operative Verdichtung (Fahrplan, ohne Phasen zu sprengen):** **§ C.0b** beibehalten — **Phase A** stabil, dann **Phase B** Mesh + Delayed Upload; **Handy-Only**-Härtung als **Querschnitt**: Shared Core, Sync-on-Open-Semantik, direkter RPC-Pfad wo sicher, Gas optional — **§ H.6b** bei jedem größeren Transport-/Queue-Refactor mitlesen.

**Siehe auch:** **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`**, **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**, **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** §8, **`docs/SPONSORING-AND-CREDITS-DOUBLE-FLOOR.md`**.

### H.6c **Cold-Start, Teilbilder, Flash-Risiko, Mesh-Stau** (bisher zu dünn — **Abgleich** mit Zielbild)

**Kontext:** Architektur-Doku (**§ H.6b**) reicht nicht, wenn **Wanderer** Gerät **erst nach** Funkloch/Unfall einschalten oder wenn **Luma/Attestation** nur **teilweise** ankommt. Hier: **was sinnvoll ist**, **wo** (App / Core / Firmware), **was** Stock-Meshtastic **nicht** automatisch löst.

| Thema | Problem (Kurz) | Sinnvolle Richtung | **App/Core (nächste Wochen–Monate)** | **Firmware / Phase B+** |
|--------|----------------|--------------------|----------------------------------------|---------------------------|
| **1. Cold-Start / Zeit** | Ohne Internet: **unsichere Systemzeit** → IOTA-/Log-Zeitstempel und „letzte Teamposition“ sind **interpretierbar falsch**. | **Handy** liefert Referenz (HTTP `Date`, **Geolocation**-`timestamp`, später Indexer); **Heltec ohne GPS** keine UTC-Magie. **Attestation/signierte Exports:** optional **Queue** mit `timeTrust !== high` + **monotonischer `outSeq`** bis Finalisierung — **nicht** jeden Chat-Tick blockieren (UX). | **Schritt 1–4 (Ist):** `device-time-trust` + `pollClockHint` + Banner; **privater Chat:** einmaliger **Geolocation**-Probe für `hasTrustedGpsUtcFix` (Browser-Dialog); bei **`deviceTimeTrustWarn`** zusätzliche Nutzer-Bestätigung vor **Einsatz-Exporten**; **LoRa:** Sende-Fortschritt LUMA/CHROMA (**Mesh v2**-Pakete) in der UI; **Mailbox-Offline-Outbox (§ H.3g 7a):** je Eintrag **`timeIsTrusted`** (= `DeviceTimeTrustLevel` **high** beim Enqueue, aus `!deviceTimeTrustWarn`), UI-Hinweis in der Warteschlangen-Banner-Zeile; monotonische **`clientOutSeq`** (Gerät-lokal) für Ausgangs-Reihenfolge / spätere Attestation. **Nächster Schritt:** Attestation-**Queue**/`timeTrust` außerhalb reiner Bestätigungsdialoge; Empfangs-Badge/Decoder (**Badge + Kompakt-Luma-Fallback** siehe Zeile **Teil-Nachrichten**); Base64-Padding/Progress-Prozent weiter. | Hardware-Mix **`docs/LORA-EU-FUNK-HARDWARE-EINSATZPROFILE.md`**. |
| **2. Teil-Nachrichten / Fragmentation** | Von **Luma** o. ä. kommen nur **Teile** an (Bewegung, Akku, Störung). | **„Halbes Bild besser als keins“**: Sparse-/Progressive-Anzeige; **„~65 % geladen“** genügt für Rettungs-Orientierung. | **Quick-Win (Woche 4–8):** Decoder tolerant (Padding neutral); UI-Badge **unvollständig** (**Ist 2026-03:** LoRa nur-Luma; Kompaktbild **`reconstructCompactImageToDataUrlWithMeta`** + Luma-Fallback bei abgeschnittenem Blob / leerem oder defektem Chroma, **`tryExtractTruncatedCompactLumaWebp`**); **`@morgendrot/core`** ohne Firmware-Wartezeit. | Funk = paketweise; **App** = Reassembly + Anzeige. |
| **3. Physische Sicherung (verlorenes Heltec)** | Gerät im Wald: **Puffer** kann **fremde** oder **eigene** Chunks enthalten; Auslesen des Flash **ohne** Auth. | **Defense in depth:** **App-Layer:** privater **Mesh-v2**-Pfad = **verschlüsselte** Nutzlast über LoRa (**`/mesh-build-v2`**), **kein** Klartext in den Airtime-Bytes — **Ist** für verschlüsselten Chat. **Lücke:** Meshtastic kann **Metadaten**/interne Queues trotzdem halten → Threat Model; **kein** Ersatz durch Forderung „Meshtastic verschlüsselt LittleFS“. | Minimale **Retention**, Bonding; **Zusätzliche** App-Verschlüsselung um den v2-Blob ist meist **redundant**; sinnvoll ist **Policy** + ggf. **Klartext-Pfade** meiden. | **LittleFS-Firmware-Crypto** = Phase **B+/C** mit Spec. |
| **4. Broadcast-Sturm / Kollision** | Viele **SOS + Luma** gleichzeitig → **Airtime-Kollaps**. | **Stau-Management:** Backoff, **Zufalls-Jitter**, **Priorität** (SOS vor Bild), **serielle** Entlastung mehrerer Sender — **zuerst in der App**; Mesh-weit **„10 s warten“** nur wo **Meshtastic/Region** es hergibt. | Erweitern: globale **Sende-Governor**-Policy (mehrere Bilder / mehrere Nutzer), Anbindung an **`MacroPriorityClass`**, **`morg-sos-mesh-retry`**-Philosophie; Leitplanken **`docs/MESHTASTIC-HOP-LIMIT-AND-BRIDGE.md`**, **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`**. | **Firmware-seitiges** congestion-aware Scheduling = **eigene** Firmware oder tiefe Meshtastic-Kenntnis — **Phase B+** mit Messung, **nicht** als Sofort-Pflicht für **Standard-Firmware**. |

**Abgleich mit euren Phasen-Ideen (Kurz):**

| Eure Bezeichnung | Einordnung im Fahrplan |
|-------------------|-------------------------|
| **Handy-Core 4–8 Wochen** (`@morgendrot/core`, Queue, direkter IOTA, Attestation, BLE-Pull) | Entspricht **§ C.1** + **§ H.6b** + **§ H.12** + Start **§ H.3** — **inkrementell**, nicht „alles in einem Branch“. |
| **RN + Expo** | **Neue Laufzeit** neben PWA: **sinnvoll**, wenn **Core-Schnitt** oder **klare API-Grenze** steht — **nicht** in derselben Woche wie großer **§ H.1b**- oder Mesh-Kern-Wechsel (**§ C.0b**). **Vorsicht:** **Web Serial** / **Cable-First** und **BLE-Batch** früh gegen **Expo managed vs. prebuild/bare** prüfen — sonst **RN + native Module** evaluieren (**§ H.3l**). |
| **Phase 2 Mobilität** (Super-Node, STT/TTS, Trust, Tauri-Boss) | Deckt sich mit **§ H.3** (Mesh), **§ H.9**, **§ H.10**, Boss-Pfade **§ I** — **nach** stabilem Mesh-/Upload-MVP, sofern nicht **§ C.3** verletzt. |
| **Phase 3 Server nur Boss** | Bereits **§ I** + **§ H.6b** — **opt-in**, keine Pflicht-Infrastruktur. |

### H.6d **Wann Code für den „Umzug“ auf Handy-only?** (Zwischenfrage — **kanonische Antwort**)

**Kurz:** Es gibt **keinen** sinnvollen **Big-Bang-Umzug**-Tag. Stattdessen **gleitende** Lieferungen, die die Vision (**§ H.6b**) ohne Bruch von **Phase A → B** erreichen.

| Zeitfenster | Was **konkret** codiert wird | Bedingung |
|--------------|----------------------------|------------|
| **Jetzt bis ~8 Wochen (parallel Phase A)** | **`@morgendrot/core`**: **`src/shared`** extrahieren; **Zeit** (H.6c): Modul + `pollClockHint` + Banner + **GPS-Probe** (privater Chat) + **Export-Gate** bei unsicherer Uhr; **Teilbild-/Sparse-Luma:** Sende-Fortschritt (**Mesh v2**) in der App **(2026-03)** — Empfangs-Badge (LoRa+Kompakt, 2026-03) / Decoder (~Padding, Fortschritt %) weiter; **Konfiguration** (H.6e): Core-**Konstanten** + Runtime-**Storage**, **keine** schwere `.env`-Abhängigkeit im Core-Paket. | **§ H.4**-Ritual; **§ H.2** / **§ H.1b** nicht blockieren. |
| **Mesh-/Delayed-Upload-Fenster (Phase B, § C.0b Stufe 4)** | **Pull-Burst-Sync**-Semantik, BLE/Serial-Transport, **Retry/Congestion** weiter verfeinern — **Handy** bleibt **Orchestrator**, Heltec **Modem**. | **Mesh v2** stabil genug für **`TESTING.md`** Phase B; **§ H.12** für Queue/Quelle der Wahrheit gelesen. |
| **React Native + Expo** | **Port** der stabilen Core-API + **native** BLE/STT/TTS — **eigener** Meilenstein. | **Entweder** nach erstem **publishierbaren** `core`-Paket **oder** mit **explizit** abgeteilter Person/Woche (sonst reißt **§ C.0b**). **Expo:** Hardware-Pfade **vor** Produktentscheid validieren (**§ H.6d** Tabelle Phasen). |
| **Firmware-Tiefe (LittleFS-Crypto, „Stau“ im Radio)** | Nur nach **Spec + Threat Model**; typ. **Phase B+/C**. | **Nicht** vor App-seitigem Stau-Management und ohne Messaufbau. |

**Fazit:** Der **löwenanteil „Handy-only“**-Logik (Signieren, Queue, IOTA-Client, Anzeige) gehört in die **nächsten 4–8 Wochen** als **Core + PWA-Verbesserungen** — der **Produkt-Umzug** auf **RN/Expo** ist **danach oder parallel mit eigener Kapazität**, nicht als Ersatz für **§ C.0b**-Reihenfolge.

### H.6e **Konfiguration: `.env`, Core-Konstanten, Runtime (Handy)** — **kritisch eingeordnet**

**Frage:** Ist **`.env`** ein Muss — oder geht es anders / besser?

| Schicht | Zweck | Morgendrot **Ist** / **Empfehlung** |
|---------|--------|-------------------------------------|
| **`.env` (Node / Boss / Deploy)** | Statische Parameter für **`npm start`**, RPC, `PACKAGE_ID`, Feature-Flags — **ohne** Secrets im Git | **Pragmatischer Standard** für **Backpack-Node** und **Standalone-Bundle** (**`docs/WANDERER-STANDALONE-BUNDLE.md`**, **`docs/SECRETS-OPTIONS.md`**). **Kein** „religiöses Muss“ in der Theorie, in der **Praxis** weiter die **einfachste** Betriebs-Schicht. |
| **Core (`@morgendrot/core` / `src/shared`)** | Protokoll- und Produkt-**Konstanten** (Magic Bytes, Ports, Zeitzonen-Schwellen, Default-Retry) | **Kein** paralleler `.env`-Loader im Core — **Konstanten im Code** + **injectierbares** `MorgendrotContext`/Options-Objekt zum Start (Tests, RN, Firmware-Simulation). Reduziert „Umzug“-Reibung. |
| **Runtime (PWA / RN)** | Vom Nutzer änderbar: RPC-Override, Sponsor-URL, … | **`.env` reicht auf dem Handy nicht** (Build-Zeit, Feld nicht editierbar): **localStorage** (**Ist**), später **SQLite**/Settings-DB. **Zielbild:** ein **Konfigurationsobjekt** aus Persistenz + sichere Defaults aus dem Core. |
| **CI / Stores** | Echte Geheimnisse (Signing Keys, API-Token) | **Plattform-Secrets** (GitHub Actions, Play/App Store Connect) — **nie** im Repo. |

**Kurz:** **`.env`** bleibt für **Server/Node/Boss** optimal; für **resilientes Handy-only** ist die **Kombination** **Core-Konstanten + Runtime-Storage** nötig — nicht `.env` ersetzen, sondern **ergänzen** (**§ H.7** Bundle bleibt `.env`-basiert für erste Auslieferung).

### H.6f **Android: Foreground Service + minimale Sync-Ehrlichkeit** (Zielbild — **Doku 2026-03**)

**Zweck:** Mittelweg aus Chat-Review: **(1)** Auf **Android** mit **nativer Schale** ein **Foreground Service** + **ehrliche Notification** gegen aggressives App-Management — **ohne** Modul-Theater („Power-Sovereignty“, „Sequence-Tracker™“). **(2)** **Mehrteil-/Vollständigkeitslogik** bleibt **schlank** in den **bestehenden** Messenger-/Mesh-Pfaden (**§ H.6c** Teilbilder, **§ H.3g 7a** Outbox), **nicht** als zweites Settlement-Universum (**§ H.12**).

| Aspekt | Festlegung |
|--------|------------|
| **PWA/Browser** | **Kein** Foreground Service — gleiches **Nutzerversprechen** über Status, Handbuch, Outbox-Opt-in (**§ H.0**, **§ H.2**). |
| **Native Android** | FG-Service + Stopp-Regeln (Akku-Schwelle, Ladezustand, optional Inaktivität) + SOS-Benachrichtigung (**§ H.3n**) — **nach** Wahl einer Hülle (Capacitor / eigenes Kotlin-Modul); siehe **`docs/ANDROID-FOREGROUND-SERVICE-MINIMAL-SYNC.md`**. |
| **Kein OS-Watchdog** | Kein **periodisches** „alle 2–5 Min aufwecken“ als **Ersatz** für Transport — FG-Service **ersetzt** nicht **BLE/WebView**-Limits. |

**Ist im Hauptrepo:** Spezifikation und Fahrplan-Verweis — **kein** `android/`-Tree; Umsetzung = **eigener Meilenstein** (**§ C.0b**, nicht parallel zu großem Mesh-Kern ohne Absprache).

### H.7 Einsatz-Abgabe **Standalone Smartphone** (Ist) & Backlog

**Zielbild Einsatz:** Boss erzeugt Bundle → gibt es per SD/USB/ZIP an Helfer → Installation (`npm install` im Bundle-Root + `frontend/`) → **`.env`** liegt vor (oder nach `npm install` aus Vorlage) → Boss hat **öffentliche** Parameter pro Auslieferung gesetzt → Helfer tippt **Seed/Vault-Passwort nur auf dem Gerät** → Verbindung zu eurem RPC/Server wie konfiguriert.

| Thema | Status |
|--------|--------|
| **Technik** | Skript `scripts/bundle-standalone-smartphone.ts`; **keine** `.env` mit Secrets im Archiv; **`.env.example`** = Hauptrepo + Override-Block (`ENABLE_UI`, `SIGNER=sdk`, …). |
| **Manuelle Anpassung** | Pro Kunde/Test: **`.env`** editieren (z. B. `PACKAGE_ID`, `RPC_URL`, `BOSS_ADDRESS` / Partner) — **sinnvoll und ausreichend** für erste Einsätze. |
| **Geheimnisse** | **Nie** Seed oder Vault-Passwort auf das Medium schreiben; nur lokale Eingabe auf dem Telefon. |
| **Boss-Handoff (optional)** | **Next → Steuerung → Boss-Modus → Export-Assistent** + **`POST /api/standalone-smartphone-handoff-zip`**: ZIP mit **`morgendrot-standalone-handoff.env`** + **`README-HANDOFF.txt`** (ohne Secrets). Bundle weiter mit **`npm run bundle:standalone-smartphone`** bauen — **Komfort**, kein Blocker für Feldtests. |
| **Einstieg „Wanderer“** | **`docs/WANDERER-STANDALONE-BUNDLE.md`** — Narrativ H.0 #2 + Verknüpfung zu **§ H.8** (zwei Ordner Dienst/Test). |
| **Feld: Backpack + Betriebsmodi** | **§ H.7b** — Referenzarchitektur (Node im Rucksack, Heltec, PWA); **Degraded / Delayed Upload** = Zielbild Phase B, nicht vollständig implementiert. |

### H.7b Feld-Architektur: **Backpack-Node**, Heltec, PWA — **Zielbild & Grenzen**

**Zweck:** Die Diskussion aus **Chat/Abstimmung (2026-03)** in **eine** kanonische Stelle bringen — **ohne** alle Szenarien als fertiges Produkt zu behaupten. Ergänzt **§ H.0**, **§ H.3**, **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`**, **`docs/WANDERER-STANDALONE-BUNDLE.md`**, **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (**§ H.12**).

#### Hardware-Kombination (typisch)

| Rolle | Komponente | Kurz |
|--------|-------------|------|
| **„Gehirn“ (Backend)** | Kleiner **Linux-Host** im Rucksack (**Backpack-Node**): führt den **Morgendrot-Node** (`npm start` / API-Port) aus — **Vault, `/api/*`, IOTA-SDK, Signatur** (siehe **`src/messenger-nest/README.md`**: **Plain Node/TS**, **kein** NestJS-Framework). **Referenz-Hardware:** **CM4** oder **günstiger Pi Zero 2 W**; **sehr kleine** Boards (z. B. Luckfox-Klasse) nur mit **RAM-/BSP-Absicherung** und ggf. **abgespecktem** Deploy — nicht als Drop-in ohne Messung. |
| **„Stimme“ (Funk)** | **Heltec V3** (o. ä.; optional **T-Beam** mit GPS): **Meshtastic** / LoRa. **Zwei Anbindungen:** (a) **USB/Serial/UART** an den Linux-Host (**Pi↔Heltec**, vgl. **`docs/HELTEC-USB-SERIAL-VS-BLE-TRANSPORT.md`**, **`lora-bridge`**); (b) **Web Bluetooth** vom **Handy** zum Heltec (**Ist** im Next-Frontend — **§ H.3l**). |
| **„Display“ (UI)** | **Smartphone** mit **PWA**: spricht per **WLAN** mit dem Backpack-Node (typ. **Hotspot** des Hosts; **API-Basis** muss zur erreichbaren IP zeigen). |

**WLAN-Reichweite** Handy↔Backpack ist **eng** (2,4 GHz, kleine Antenne): **Faustwerte** nur zur Einordnung — **vor Ort messen** (Topografie, Gehäuse, Last).

#### Betriebsmodi (Flexibilität — **Ist** vs. **Ziel**)

| Modus | Datenfluss (idealisiert) | **Ist / Hinweis** |
|--------|----------------------------|-------------------|
| **Online** | **Ziel:** Handy → **RPC / IOTA** (Direct); **optional:** Handy → Morgendrot-Node → **RPC / IOTA** (Relay) | **Übergang:** viele Flows noch **Node-first** im Code — **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`**, **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**. |
| **Hybrid (Nahbereich)** | Handy → Node (WLAN) + **Mesh** über Heltec (Serial **oder** Web-BT vom Handy) | **Teilweise Ist** (Mesh/Web-BT, Node signiert); **Serial-Host-Pfad** Produktivcode = Phase B optional (**§ H.3l**). |
| **Entfernt / „LoRa-only“-Minimum** | Handy → **Web-BT** → **eigenes** Heltec → **LoRa-Mesh** (**ohne** WLAN zum Node) | **Zielbild:** eingeschränkter **Degraded Mode** — **kein** vollständiger Ersatz für alle IOTA-/Vault-Flows ohne weiteren Architektur-Schritt; **verzögerte Verankerung** nur im Rahmen von **Delayed LoRa → IOTA** / **Sync-Regeln** (**Spec § H.12**), **nicht** als pauschales „stellvertretend signieren“ ohne **Custody-/Vertrauensmodell**. |

**Kapazität / Last:** „X Personen pro Node“ nur mit **Messung** (Nachrichtenlast, gleichzeitige RPC); kleiner AP + SoC kann bei vielen WLAN-Clients **instabil** werden — **Stresstest** statt feste Marketingzahl.

#### Energie & Betrieb

- **Backpack-Node + WLAN-Hotspot + Funk** ziehen **dauerhaft** Strom; **kleine** Zellen reichen oft nur **wenige Stunden** — **Powerbank (häufig 10–20 Ah-Klasse)** realistischer für **Tagesnutzung**; **gemessen** dokumentieren, nicht raten.

#### Qualitätssicherung (Ritual)

- Änderungen an **Sendepfad, Queue, Transport, IOTA-Grenzen** — zwingend **Merge-Ritual** (**`TESTING.md`** § *Qualitätsritual vor Merge*) bzw. CI **`.github/workflows/frontend-checks.yml`**, damit **Funk** und **Mailbox-Logik** sich nicht gegenseitig regressieren.

### H.8 Dienst (Mainnet) vs. privat (Testnet) — **zwei Installationen**, Doku, **kein** Sofort-Coding

**Zielgruppe:** vor allem **Interessierte** / Labore; **Einsatzhelfer** typisch **ein** Profil nach Vorgabe.

| Frage | Empfehlung |
|--------|------------|
| **Abgleich 2026-03-31 (§ C.0b Stufe 2)** | **§ H.2** → **§ H.8** → **§ H.10** / **§ H.10b** — Kreuzverweis in **`docs/DIENST-VS-PRIVAT-NETZ-PROFIL.md`** (Einleitung) und Stand **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**; weiterhin **kein** Pflicht-In-App-Profilwahl-Sprint. |
| **Machen zwei getrennte Installationen am meisten Sinn?** | **Ja (pragmatisch):** zwei Arbeitsverzeichnisse (oder zwei Portable-Bundles), je eigene **`.env`** (`RPC_URL`, `PACKAGE_ID`, …) und eigener **`VAULT_FILE`**-Pfad; zwei Starter/Icons (z. B. „EINSATZ“ / „TEST“). **Wenig** Kern-Code, **hohe** Trennschärfe — siehe **`docs/DIENST-VS-PRIVAT-NETZ-PROFIL.md`** (§ 2, § 5). |
| **Alles „ganz hinten“ dokumentieren — reicht das?** | **Ja:** Fahrplan **§ H.8** + genannte Doku; **kein** eigener Implementierungs-Sprint nötig, solange kein Bedarf nach **In-App-Profilwahl** (wäre mehr Aufwand, siehe § 5 dort). |
| **Gleich im Code umsetzen (Start-Dialog Testnet/Mainnet)?** | **Nein als Priorität** vor **Phase A**-Stabilität und vor **§ H.0/H.1** (siehe **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**). Optional später als Produktentscheidung — nicht parallel zum Mesh-MVP erzwingen. |

**Aufräumarbeiten „fertig“?** Es gibt **kein** einmaliges „alles erledigt“: **`docs/GIT-CLEANUP-AND-COMMIT-PLAN.md`** + **§ H.5** beschreiben **laufende** Hygiene (keine Secrets, sinnvolle Commits, `tsc`/Tests vor größeren Merges). Der **architektonische** Aufräum-Stand (Chat-Hooks, keine sinnlosen Rollbacks) ist dort als **„behalten“** festgehalten — weiteres Aufräumen nur **punktuell** mit Nutzen (**§ A Punkt 4**).

**Wie weitermachen (Reihenfolge):**  
1. **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** — Phasen **A → B → C** einhalten.  
2. **`§ H.0`** (Produkt/UX, Messenger schlank, Entsperren) und **`§ H.1`** (Phase A technisch: Stabilität, Tests, kleine UI-Fixes) **sowie § H.1a** (**Baseline + Vitest + AppError** — **`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`**).  
3. **`§ H.2`** — PWA-Checks, Status/Fehlermeldungen, Kabel-Bridge nur wenn Kapazität.  
4. **Phase B** erst bei „A genug stabil“ — Mesh v2, **Delayed LoRa → IOTA** laut Spec.  
5. **Nicht** parallel: volles Macro-Gateway, **§ I**-Narrative als Pflichtsprint, oder **Testnet/Mainnet-Profil-UI** ohne konkreten Bedarf.  
6. **§ H.10** (Sicherheit/Vertrauen/Schlankheit): Stufe 0–1 aus **`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`** **nebenbei** — **ohne** Phase B zu verdrängen.  
7. **§ H.11** (Offline-Karten/Geodaten): nur bei **Bedarf** nach Phase-B-Kern — **`docs/OFFLINE-KARTEN-UND-GEODATEN-ZIELBILD.md`**.  
8. **§ H.12** (Sync/Source of Truth): bei **Queue-/Multi-Gerät-Design** mitlesen — **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**; umsetzen **im Rahmen** Delayed-Upload + Offline-Queues.  
9. **§ H.13** (Schlankheit & Härtung): korrigierte Datei-/API-Namen, Idempotenz/PTB/Outbox — **`docs/CODE-SCHLANKHEIT-UND-HAERTUNGS-PRIORITAET.md`**; **kein** Feature-Wildwuchs, **Wartbarkeit** (`api-server` entzerren) vor „neue Wunder-Datei“.  
10. **§ H.14** (Hardening V3): PWA-Speicher verschlüsseln, Lite-UI-Onboarding L2, Client-Wipe, Idempotenz-Review, **`maxTxBytes`**-Audit — **`docs/MORGENDROT-HARDENING-V3-PRECISION.md`**.

### H.9 ATAK / Cursor-on-Target (CoT) — **Backlog**, nach stabilen Kernpfaden

**Ziel:** Morgendrot-Lageinformationen (Position, Status, optional Bilder/Metadaten) für **ATAK**-Nutzer sichtbar machen — **zwei** geplante Anbindungen: **CoT über UDP** (Multicast/Unicast im Einsatznetz) **und** **Einspielung über einen TAK Server** (Verteilung, TLS, Gruppen).

| Aspekt | Hinweis |
|--------|---------|
| **Priorität** | **Nach** Phase-A-Robustheit und **Phase B** (LoRa/IOTA-MVP), sofern kein dringender Kundenauftrag — kein Parallel-Sprint zu **§ H.0–H.2**. |
| **Spec** | **`docs/ATAK-COT-INTEGRATION-ZIELBILD.md`** (Zielbild, Sicherheit, Mapper/Gateway — **ohne** Implementationspflicht). |
| **Verwechslung vermeiden** | „Direkt zu IOTA“ vs. lokaler Node: **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`**. |
| **Offline-Karten** | **`docs/OFFLINE-KARTEN-UND-GEODATEN-ZIELBILD.md`** (**§ H.11**) — Basiskarte vs. Einsatzpaket; ergänzt Lage/CoT, **ersetzt** keine UDP/TAK-Spec. |

### H.10 Sicherheit, Vertrauen, schlanke Härtung (eigener Track, **blockiert** A/B/C **nicht**)

| Aspekt | Kurz |
|--------|------|
| **Abgleich 2026-03-31 (§ C.0b)** | **§ H.2** → **§ H.8** → **§ H.10** / **§ H.10b** — **`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`** (Einleitung + Schritte **A**) um **C.0b**-Einordnung und Prioritätenliste **A** ergänzt. |
| **Zweck** | Realistische **Roadmap** für **transparentere** Lieferkette, **klarere** Sicherheitsansprüche, optional **Keystore/HSM** — **ohne** Behauptung behördlicher Zulassung. |
| **Doku** | **`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`** — Ist-Review (Stichprobe), Stufen 0–5, **nächste logische Schritte** A–D. |
| **Bezug** | **`SECURITY-RATING.md`**, **`docs/SECRETS-OPTIONS.md`**, **`docs/MODULAR-KERN-ADAPTER-INTEROP.md`**, **`docs/CODE-SCHLANKHEIT-UND-HAERTUNGS-PRIORITAET.md`** (**§ H.13** — konkrete Härtungs-/Schlankheits-Checkliste). |
| **Priorität** | **Parallel** zu **§ H.0–H.2** und **Phase B** nur mit **kleinem** Zeitbudget; **kein** Ersatz für Mesh-/IOTA-MVP. |

#### H.10b Boss / Arbeiter: Seed-Custody (Policy, **kein** Implementationszwang)

| Aspekt | Kurz |
|--------|------|
| **Abgleich 2026-03-31 (§ C.0b)** | **`docs/BOSS-WORKER-SEED-CUSTODY.md`** — Einleitung um **§ H.10b** / **C.0b**-Reihenfolge und **Stand** ergänzt (**parallel** zu **§ H.10**). |
| **Frage** | Soll der **Boss** Worker-**Seeds** (Wiederherstellung) **dauerhaft** mitschreiben — oder **nur** der Arbeiter? |
| **Doku** | **`docs/BOSS-WORKER-SEED-CUSTODY.md`** — Team-Modus (Einsatz) vs. **Dezentral-Modus** (Default-Empfehlung), E2E/Escrow-Präzisierung, Alternativen (Papier, Shamir, Neu-Identität), UX-Pflicht. |
| **Bezug** | **`docs/ONBOARDING-WALLET-UX-SPEC.md`**, **`docs/RECOVERY-PHRASE-BACKUP.md`**, **`docs/WANDERER-STANDALONE-BUNDLE.md`**, **`ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`** § 6. |

### H.11 Offline-Karten & Geodaten (Zielbild, **Backlog**)

| Aspekt | Kurz |
|--------|------|
| **Zweck** | **Optional** zum Messenger-Kern: **Vektor-Basis** (klein), **Einsatzpakete** (größer, nach Provisioning), **Live-Layer** (minimal über Funk/Online); **Wanderer** vs. **Einsatzkraft** differenziert. |
| **Doku** | **`docs/OFFLINE-KARTEN-UND-GEODATEN-ZIELBILD.md`** — kritische Korrekturen (Cache-Eviction, Lizenz, WGS84, LoRa-Payload). |
| **Priorität** | **Nach** Phase-B-Kern (Mesh, Delayed IOTA) und **parallel** nur mit klarem Bedarf — **nicht** vor **H.0–H.2**-Stabilität erzwingen. |
| **ATAK** | Lage-Layer weiter **§ H.9** / **`docs/ATAK-COT-INTEGRATION-ZIELBILD.md`**; Karten-Doku **ergänzt**, **ersetzt** keine CoT-Spec. |

### H.12 Sync: Source of Truth & Konflikte (Doku, Phase B/C-Vorbereitung)

| Aspekt | Kurz |
|--------|------|
| **Zweck** | **Festhalten**, wie **Mesh/Offline** und **IOTA** zusammenspielen **ohne** Mythos „CRDT löst alles“; **pro Vorgang** Autorität (Chain vs. Queue vs. UI). |
| **Doku** | **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** — Verknüpfung zu **`LORA-IOTA-DELAYED-UPLOAD-SPEC`**, **`OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE`**, **`SECURITY-RATING`**. |
| **Umsetzung** | **Dedup** (`canonical_msg_ref`), typisierte **Offline-Queues**, **Mehrgeräte-Politik** — **im** Delayed-Upload-MVP und **separaten** Boss-Relay-Queue (**§ H.3g**) konkretisieren, nicht als **Parallel-Epik** zur Spec. |
| **Priorität** | **Mit** Phase B **Delayed Upload** lesen und **beim Implementieren** anwenden; **kein** Blocker vor erstem Mesh-Smoke. |

### H.13 Code-Schlankheit & Härtung (Priorität, **kein** Parallel-Epik)

| Aspekt | Kurz |
|--------|------|
| **Zweck** | **Besserer** Code statt nur **mehr** Code: klare Grenze **lokal vs. chain-bestätigt**, **Idempotenz** pro Vorgang, **PTB-Limits** zuverlässig, **`api-server.ts`** langfristig **wartbarer** (Auszüge nach **`src/api/*`**). |
| **Doku** | **`docs/CODE-SCHLANKHEIT-UND-HAERTUNGS-PRIORITAET.md`** — korrigierte Pfade (`wallet-bridge`, `chain-access`, **kein** `messenger-logic.ts`), echte Claim-Routen, Doku-Set statt „ein Gesetzbuch“. **`docs/API-PROVISION-DEVICE-IDEMPOTENCY-SKIZZE.md`** — `provision-device` + Idempotenz-Key. |
| **Bezug** | **§ H.12**, **§ H.3g**, **`voucher-claim-state.ts`**, **`chain-access.ts`** (`maxTxBytes`), Frontend-Hooks (**`chat-view-messenger-transport`**, Inbox/Delayed-Queue). |
| **Priorität** | **Mit** Phase A/B und Delayed Upload **verzahnen**; **§ H.10** bleibt Sicherheits-/Schlankheits-**Track** — **H.13** ist die **konkrete** Umsetzungs-Checkliste dazu. |

### H.14 Hardening V3 — PWA-Speicher, Lite-UI L2, Wipe, Idempotenz, PTB (Arbeitspaket)

| Aspekt | Kurz |
|--------|------|
| **Zweck** | **`docs/ONBOARDING-WALLET-UX-SPEC.md`** operationalisieren: **Browser-Speicher** schützen (PBKDF2 + AES-GCM), **Lite-UI**-Erststart (**L2**), **PWA Emergency Wipe**, **Idempotenz** (Provisioning vs. Voucher getrennt), **128-KiB-PTB**-Audit in **`chain-access.ts`**. |
| **Doku** | **`docs/MORGENDROT-HARDENING-V3-PRECISION.md`** — Master-Prompt mit **Leitplanken** (kein HSM-Mythos im Browser, Lite-UI ≠ PWA). |
| **Bezug** | **§ H.0** (#4), **§ H.13**, **`provision-idempotency-state.ts`**, **`voucher-claim-state.ts`**, **`docs/PWA-MANUAL-CHECKS.md`**, **`docs/CODE-SCHLANKHEIT-UND-HAERTUNGS-PRIORITAET.md`**. |
| **Priorität** | **Mit Phase A / § H.0–H.2**; **parallel** zu **§ H.13**; **blockiert Phase B** nicht — außer bei direkten Konflikten in denselben Modulen. |

### H.15 Handy-first — Client-Signatur, direkter IOTA-Upload, optionaler Morgendrot-Node

**Gültig ab:** **2026-04-28** (ersetzt die **alleinige** Primärleitlinie aus **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** § 6 vor diesem Datum; historischer Text = **§ 7** dort).

| Aspekt | Kurz |
|--------|------|
| **Zweck** | Messenger **primär** auf dem Handy; **local-first** (speichern, signieren, puffern); **direkter** Versand signierter TX an **IOTA-RPC** ohne **Pflicht**-Morgendrot-Node; Node/Relay **opt-in** (Gas, Archiv, Komfort). |
| **App-Schalter** | **„Direkt ins IOTA senden“** = **Standard an**; **„Morgendrot Relay benutzen“** = optional. |
| **Technik** | Shared **`@morgendrot/core`** (IOTA-Logik, Queue, Attestation-Hilfen); Offline-Queue + Delayed Upload **verzahnt** mit **§ H.12** — **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**, Umsetzung Stufe **1:** **`docs/MORGENDROT-CORE-PACKAGE-PLAN.md`**. |
| **Priorität** | **Stufenweise** (**Stufe 0–4** in Architektur-Doku); **parallel** zu **§ H.0–H.2** in kleinen Scheiben **erlaubt**; **nicht** unkontrolliert parallel zum **Mesh-Kern** (**§ C.0b**). |
| **Risiko** | Custody/Threat-Model im Browser — mit **§ H.10**, **§ H.14**, **`MESSENGER-STRATEGIC-PRINCIPLES-LOCAL-FIRST-IDEMPOTENCY-PQ.md`** abstimmen. |

### H.16 Telefonbuch, QR (Einlesen/Anzeigen) & Boss-LAN-Onboarding (**Produkt / § H.0**, parallel zu **§ H.15**)

**Nachtrag 2026-03-28:** Bündelt Wunschbild und **kritische** Leitplanken; **blockiert** § **H.15** B.4 (Fetch per RPC) **nicht**, sollte aber **vor** großflächiger Kontakt-UI mit **§ H.12** (eine Wahrheit: lokale Labels vs. Chain vs. `initialProfile`) und **§ H.3b** (**`docs/QR-CONTACT-SCHEMA-V2.md`**) verzahnt werden.

| Aspekt | Kurz |
|--------|------|
| **Telefonbuch / Klarnamen** | **Ist:** Adressen tauchen an mehreren Stellen auf (`initialProfile` / API, lokale Labels **`.morgendrot-contact-labels.json`**, Chat-Empfängerfeld, Puls-Ketten-IDs **ohne** Namenskontext). **Risiko:** doppelte oder widersprüchliche „Wahrheiten“, schlechte Offline-Erfahrung. **Ziel:** **ein** kanonischer Kontakt-Speicher im Client (z. B. `localStorage`/IndexedDB), optional später Sync mit Server **nur** mit klarer Autorität (**§ H.12**). **Bezug H.15:** gespeicherte **Peer-Pub** (ECDH) pro Kontakt an Telefonbuch-Zeile hängen, statt nur freies Puls-Feld. |
| **QR: Adresse einlesen & anzeigen** | **Lesen:** Kamera / `@capacitor-mlkit/barcode-scanning` (bereits im Stack) → Kontakt anlegen oder Chat füllen. **Anzeigen:** QR mit **mindestens** installierbarer **PWA-URL** + optional Anker/Profil — Feldinhalt an **`docs/QR-CONTACT-SCHEMA-V2.md`** (**§ H.3b**) koppeln, damit nicht „RPC-URL“ und „Messenger-API-URL“ verwechselt werden. **Boss:** gleicher QR-Flow für Einladungs-/Installationslinks wie für Helfer-Kontakte. |
| **Boss-PC im lokalen WLAN** | **Szenario:** Boss läuft im LAN (`next dev --hostname 0.0.0.0` / deployter Host); Helfer scannen **QR am Bildschirm** → PWA/Seite öffnet sich → **Installieren** → Messenger auf dem Handy. **Danach:** Helfer brauchen den Boss-PC **nicht mehr**, um die **App zu öffnen** — klar kommunizieren, dass **Keys, RPC, ggf. Relay** trotzdem verstanden und ggf. einmalig provisioniert sein müssen (kein stiller „alles erledigt“-Trugschluss). **Kritisch:** **HTTPS** vs. **http://LAN-IP** (PWA-Install, Mixed Content, Android Cleartext); **Same-Origin** zur API; **Build-/Versions-Pin** (Helfer-Build = Boss-Build); optional **Captive-Portal**-Fall (nur WLAN, kein Internet) von „echtem“ Deploy trennen. **Doku:** **`docs/DEV-START.md`**, **`docs/PWA-HANDBUCH-OFFLINE.md`**, **`docs/WANDERER-STANDALONE-BUNDLE.md`**, **`docs/BOSS-ORIENTIERUNG.md`**. |
| **Priorität** | **Nach** oder **parallel** zu kleinen **§ H.0–H.2**-Scheiben; **nicht** vor kritischem **Mesh-Kern** (**§ C.0b**) großflächig mit UI-Refactor kreuzen. **Nächster technischer Block** laut Architektur: weiter **§ 6.B.4** (**Inbox/Fetch per RPC**, **`ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**) — Telefonbuch/QR **ergänzen** Onboarding, ersetzen Fetch-Arbeit **nicht**. |

### H.17 Dashboard, „Volldashboard“ & Platzhalter-Kacheln (**Produkt / § H.0**)

**Nachtrag 2026-03-28 — Begriffe strikt trennen (Code ≠ Marketing-Wort):** „Volldashboard“ wurde umgangssprachlich für **mehrere Schichten** benutzt. Kanonisch:

| Begriff (UI / Doku) | Speicher / Code | Was passiert |
|---------------------|------------------|----------------|
| **Volle Oberfläche** (Einstellungen) | `localStorage` **`morgendrot_show_all_tiles`** | Nur **Arbeiter/Lock:** Kachel-Grid statt nur Action Center einblenden. **Kein** Bezug zu Chat oder Radar. |
| **Arbeitsbereich „Volldashboard“** (Panel „Arbeitsbereich & Projekte“) | `localStorage` **`morgendrot_workspace_tile_set`** = **`full`** | Gegenstück zu **„Messenger-Projekt“** (`messenger`): bei **`full`** sieht **Boss** u. a. **alle** Dashboard-Kacheln; bei **`UI_VARIANT=messenger`** darf nur **Boss** auf **`full`** wechseln (andere Rollen: erzwungen schlank). |
| **Geräte-Radar** | Komponente **`DeviceRadarView`** in **`dashboard.tsx`** | Eigene **Kachel/Sektion** oben auf dem **Haupt-Dashboard** — Daten **`GET /api/monitor-status`**. Sichtbar nur, wenn Arbeitsbereich **`full`** **und** (im Messenger-Bundle) nur **`role === 'boss'`**; im **Morgendrot-Hauptprojekt** (`UI_VARIANT` nicht Messenger) zusätzlich **`kommandant`** mit **`full`** (Flotten-Monitoring). **Nicht** „das Volldashboard“ = Radar; Radar ist **ein Teil** des **`full`**-Layouts. |
| **Chat → Boss-Übersicht** (`bossView`) | React-State im Messenger, Flag an **`/inbox`** | **Separates** Feature: Posteingang lädt für **Boss** optional Nachrichten **an Kommandanten-Adressen** mit (Backend: `messenger-command-handler.ts`). **Kein** Ersatz für Arbeitsbereich **`full`** und **kein** Radar. **Produkt (2026-03):** Nutzen für schlanken Messenger **unklar** — im Bundle **`UI_VARIANT=messenger`** UI-Schalter **ausgeblendet**; Hauptprojekt behält Option für Feldtests. **Backlog:** „Helfer-Edition“ (mehr als Wanderer, weniger als Boss). |

**Zielbild Messenger-Distribution (Boss):** Kacheln fokussieren auf **Nachrichten**, **Pinnwand**, **Tresor**, **Notfall** + Boss-only-Einstellungen (z. B. Helfer anlegen) — **Morgendrot-Hauptrepo** behält **alle** Kacheln zum Weiterentwickeln (**`UI_VARIANT`** / Deploy trennt Bundle). Siehe **`docs/UI-ROLLEN-WORKSPACES.md`** § 5–6.

**Ist (2026-03-28) — Scheibe 1:** Bei **`UI_VARIANT=messenger`** + **Boss** + Arbeitsbereich **`full`** zeigt **`dashboard.tsx`** nur die Kacheln **`chat`**, **`vault`**, **`boss`** (+ bestehendes **Geräte-Radar**); Zugang (`lock`) und Überwachung (`monitor`) entfallen. Arbeitsbereich **`messenger`** unverändert (Nachrichten + Tresor). Nächste Scheiben: weitere Boss-only-Einstiegspunkte / „Helfer-Edition“ (**Backlog**).

**Platzhalter-Kacheln:** über **`WorkspaceProjectsPanel`** / Rolle ausblendbar; kein Blocker **§ C.0b**.

### H.18 TTS / STT — Text-to-Speech & Speech-to-Text (**Produkt / § H.0**, Backlog)

**Sinnvoll?** **Ja, bedingt** — vor allem für **Einsatz ohne freie Hände** (Helm, Handschuhe), **Sehschwäche** (eingehende Nachrichten vorlesen), und **schnelle Diktat-Eingabe** statt Tippen. **Nicht** Ersatz für SOS-Protokoll oder LoRa-Priorität; ergänzt die bestehende **Sprachmemo**-Spur (**`docs/MESSENGER-SPRACHAUFNAHME.md`**).

| Aspekt | Kurz |
|--------|------|
| **Nutzen** | Barrierefreiheit; Freihand; kürzere Bedienkette neben **Opus-Memo** (weiterhin kanonisch für Funk-taugliche Sprache). |
| **Risiken** | **STT:** Daten an Drittanbieter (Cloud) vs. **on-device** (Qualität, Modellgröße). **TTS:** gleiches Thema + Latenz. **Offline:** Browser-**Web Speech API** oft eingeschränkt ohne Netz. |
| **Technik (Idee)** | PWA: `SpeechRecognition` / `speechSynthesis` wo verfügbar; native Schicht (**§ H.6f**) für zuverlässigeres STT/TTS; **kein** automatisches Senden ohne Nutzerbestätigung. |
| **Priorität** | **Nach** stabiler Phase-A-Sendepfad und klarer **SOS-/Notfall-Doku**; **parallel** zu **§ H.16** möglich, **nicht** vor kritischem Mesh-Kern (**§ C.0b**) großflächig kreuzen. |

---

*Bei Konflikt mit `PROJECT-FOCUS-AND-PRIORITIES.md` gewinnen die **Phasen A/B/C** dort; dieser Fahrplan priorisiert **Inhalt und Reihenfolge** innerhalb der Projektentscheidungen.*
