# Fahrplan Morgendrot (Arbeitsliste & Status)

**Zweck:** **Priorisierte** Lieferliste – nur was **Nutzen** bringt; **geringer Aufwand** oben.  
**Übergeordnet:** Phasen **A → B → C** in **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** (Meshtastic-First, kein Feature-Wildwuchs).  
**Stand:** 2026-03 / **aktualisiert 2026-03-28** — **§ H.0**-Tabelle mit Status-Spalte; Box **„kompletter Plan?“** (Phase A/B/C, Heltec = B); **H.0:** Dashboard **„Erste Schritte“**, **`HELP_UI_INTRO`** in **`GET /api/help`**; **PWA:** **`docs/PWA-MANUAL-CHECKS.md`** (**§ H.2**); Onboarding **`docs/ONBOARDING-WALLET-UX-SPEC.md`**; Shop/Stripe **`docs/API-SHOP-SPEC.md`**, **`docs/STRIPE-TEST-SETUP.md`**, Credits/Shadow **`docs/CREDITS-SHADOW-SWEEP-AND-FULFILLMENT.md`**, Voucher **`docs/API-VOUCHER-CLAIM-SPEC.md`**, **`docs/VOUCHER-PRE-MINT-AND-SHOP.md`** §8; **`docs/OPERATIONS-SNAPSHOT-2026-03.md`**, **§ H.3c**, **§ H.3d**, **`TESTING.md`**.  
**QR-Kontakt v2:** Spezifikation (optional Anchor, API-Basis, Gateway) → **`docs/QR-CONTACT-SCHEMA-V2.md`** (Implementierung später; siehe **H.3b**).  

**Reihenfolge ab 2026-03:** **Produkt/UX** (früher „später“) ist **jetzt vorangestellt** (**§ H.0**) – Handy-Einsatz, Entsperren und schlanke Oberfläche hängen daran; die **nummerierte 8-Punkte-Checkliste** (**§ A**) bleibt als **technische** Referenz (Bild/Audio … LoRa … Kabel-Bridge), wird aber **nicht** mehr strikt 1→8 abgearbeitet, wenn UX/Einsatz Vorrang hat. **Zuordnung § A ↔ § H:** siehe **§ A–H: Brücke** (unmittelbar unter dem Gesamtüberblick).

**Nächste konkrete Schritte:** → **§ H.0** (Produkt/UX), dann **§ H.1 ff.** (§ I **nicht** parallel zu technischer Phase-A-Robustheit abarbeiten).

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
| 4 | Code-Struktur `chat-view` + Send-Flow | Hoch | **Stand 2026-03:** Core-Logik in Hooks ausgelagert; kein Dauer-Refactor ohne Nutzen. |
| 5 | PWA-Grundlage (Manifest, SW) | Mittel–Hoch | **Umgesetzt:** `frontend/app/manifest.ts` (inkl. **192×192** / **512×512** PNG + maskable), `frontend/public/sw.js`, `PwaServiceWorkerRegister`; Favicons `icon-light/dark-32x32.png`, `apple-icon.png` aus **`icon.svg`** via **`npm run build:pwa-icons`**. **Hinweis:** „Offline“ = v. a. gecachte statische Assets; API weiter online. **Offen:** manuelle Installations-Checks, optional Offline-Fallback-Seite. |
| 6 | Fehlerbehandlung / Status | Mittel | **Stand 2026-03:** Next-Messenger: Posteingang bei nicht erreichbarer Basis (Hinweis „Funk-Modus“), Partner-/Richtungsfilter, Eingang/Ausgang-Badges; Abgleich Package-ID Filter vs. `/api/status` → Banner „Jetzt updaten“ (**`docs/MESSENGER-PACKAGE-ID-BANNER.md`**, Checks in **`TESTING.md`**). Laufend verfeinern. |
| 7 | Heltec / LoRa Firmware | Hoch | Spez-lastig (`meshtastic/`). |
| 8 | Kabel-Bridge | Hoch | Spec-nah. |

---

## B. Ergänzende Linien (Kurz)

| Thema | Status |
|--------|--------|
| Basis vs. Vortrupp-UI | Geheimnisse serverseitig an der Basis. |
| Standalone-Smartphone-Bundle | `exports/morgendrot-standalone-smartphone/` (`npm run bundle:standalone-smartphone`). **Ist:** volle `.env.example` aus dem Hauptrepo + PWA-Block am Ende; `scripts/ensure-env.mjs` + `postinstall` → `.env` nach `npm install`; Details **Bundle-`README.md`** (im Export erzeugt). **Einsatz:** Boss passt **`.env`** pro Kunde/Test an (RPC, `PACKAGE_ID`, Partner/Boss-Adressen); Medium (SD/USB/ZIP) **ohne** Seed; Helfer: **Passwort/Seed nur auf dem Handy**. **Später optional:** Boss-UI „Export-Assistent“ (ZIP + vorgefüllte `.env` aus Formular) – siehe **H.7**. |
| Posteingang 50 + „Weitere laden“ | Umgesetzt. |
| Messenger-UI: Offline-Headline, Partner-Strip, Package-ID-Banner | Umgesetzt; siehe **§A Tabelle Punkt 6**, **`TESTING.md`**, **`docs/MESSENGER-PACKAGE-ID-BANNER.md`**. |
| Opcodes / QoS | `src/shared/opcodes.ts` (`MacroOpcode`, **`MacroPriorityClass`**) – für spätere Sendewarteschlange. |
| Reticulum / **LXMF** (nur Inspiration) | Chunking/Priorität lesen, **kein** Stack-Wechsel → **`docs/LORA-LXMF-RETICULUM-INSPIRATION.md`**. |
| Doku / Policy | Hybrid, bidirektional, **TX vs. Streams §7**, LXMF-Inspiration – siehe **D.** |

---

## C. Priorisierte Reihenfolge (**was wirklich zuerst**)

### C.1 Pflichtpfad (größter Nutzen)

1. **Produkt/UX (Einsatz & Messenger)** – schlanke UI, verlässliches Entsperren, optional nur Messenger-Kacheln („Wanderer“), Seed/Passwort-UX wo nötig (**§ H.0**). *Vorziehen gegenüber rein technischer Feinarbeit, wenn Feldtest oder Handy-Abgabe drängt.*  
2. **Phase A** (technisch) – Stabilität, `chat-view`, kleine Schritte, `tsc`/Tests (**§ H.1**).  
3. **Phase B** – zuverlässiges Mesh v2, **Delayed LoRa → IOTA** (MVP laut Spec).  
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

- **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** – Phase A/B/C.  
- **`docs/MACRO-OPERATIONAL-PATTERNS.md`** – Hop/QoS/ACK/Akku, Heartbeat/Streams.  
- **`docs/PROTOCOL-CHANNELS-TX-VS-STREAMS.md`** – TX vs. Streams vs. Audit; DID/Twin/Gas; **§7 festgeschriebene Kanal-Policy**.  
- **`docs/LORA-LXMF-RETICULUM-INSPIRATION.md`** – LXMF-Ideen vs. Luma/Chroma + Mesh-v2, ohne Reticulum-Ökosystem.  
- **`docs/MACRO-BIDIRECTIONAL-SPEC.md`** – Wald↔Netz-Opcodes.  
- **`docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`** – Gateway, Interpreter.  
- **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/EINSATZBERICHT-EXPORT.md`**, **`docs/MESSENGER-PACKAGE-ID-BANNER.md`** (Package-ID-Banner, Abgleich mit `/api/status`).  
- **`docs/UX-MESSENGER-INVENTORY.md`** – Abgleich Wunsch-UX (Login, Rollen, Wald-Check, PWA) vs. Ist  
- **`docs/PWA-MANUAL-CHECKS.md`** – Manuelle PWA-Prüf (Install, Offline-Shell, Handbuch); **§ H.2**  
- **`docs/ONBOARDING-WALLET-UX-SPEC.md`** – Session, Vault, Unlock, Credits vs. MIST; Backlog L1–L6; Verknüpfung **§ H.0 #4**  
- **`docs/RECOVERY-PHRASE-BACKUP.md`** – Recovery/Sicher anzeigen (`/vault-show-signer-import`, Settings **Wallet & Backup**)  
- **`docs/PROVISIONING-PAYLOAD-CRITIQUE.md`** – Provisioning-Payload & Identity-Credits: Ist vs. Vision, **§ H.3f**  
- **`docs/CHAT-PROTOKOLL-2026-03-28.md`** (Abstimmungen inkl. Standalone-Abgabe, `.env`)  
- **`docs/GIT-CLEANUP-AND-COMMIT-PLAN.md`** – vor großem Commit lesen  
- **§ I** – Zentralserver, Relay, DID, Anonymität: **I.0** Kurz-Zielbild (Basis / Server / IOTA), **I.1 ff.** Kritik & Reihenfolge  
- **`docs/QR-CONTACT-SCHEMA-V2.md`** – Kontakt-QR **v2** (kompakt: `b`/`g`/`s` u. a.); v1 bleibt gültig; Code-Import folgt bei Bedarf  
- **`docs/SECRETS-OPTIONS.md`** – Option C: externe Secret-Manager (Doppler, …); kritische Grenzen  
- **`docs/MESHTASTIC-HOP-LIMIT-AND-BRIDGE.md`** – Hop-Limit/TTL, Brücken, Re-Broadcast-Sturm-Risiko  
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
- **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** – Phase C-Tabelle (Ergänzung Verweis **§ I**).

---

## H. Nächste Arbeitspakete (**weiter im Fahrplan**)

Ziel: **Produkt/UX** und **Einsatzfähigkeit** (Handy, Entsperren, schlanke Oberfläche) **vor** oder **parallel zu schmalen technischen Schritten** klären; **Phase A** technisch abschließen, dann **Phase B** (LoRa/IOTA-MVP) – ohne unnötige Großthemen dazwischen.

### H.0 Jetzt zuerst – Produkt/UX (früher „später“, jetzt **Punkt 1**)

| # | Paket | Status (2026-03) | Hinweis |
|---|--------|-------------------|---------|
| 1 | **Lite / Messenger-Modus** | **Teilweise erledigt** | **`/api/status` → `uiVariant`**; Dashboard erzwingt **Messenger-Kachelset** bei `UI_VARIANT=messenger`; **`workspace-projects-panel`**. Siehe **`docs/FRONTEND-KLEINER.md`**, **`docs/UI-ROLLEN-WORKSPACES.md`** (volle rollen-basierte Workspaces = Backlog). |
| 2 | **„Wanderer“-Abgabe** | **Doku/Bundles** | **`npm run bundle:standalone-smartphone`** → **`exports/morgendrot-standalone-smartphone/`**; Abgleich **§ H.7**. |
| 3 | **Kacheln nach Rolle** | **Teilweise** | **Arbeiter/Lock:** Action Center + „alle Kacheln“; **Boss/Kommandant:** Geräte-Radar — siehe **`dashboard.tsx`**, Spec **`docs/UI-ROLLEN-WORKSPACES.md`** (weitere Verdichtung offen). |
| 4 | **Unlock- & Secret-UX** | **L2 teilweise** | Spez **`docs/ONBOARDING-WALLET-UX-SPEC.md`**. **Erledigt:** signer-spezifischer Unlock-Dialog; Shop-Tooltip; Recovery **Wallet & Backup**. **Neu:** „**Erste Schritte**“-Hinweis im Dashboard (Handbuch, Einstellungen); **`GET /api/help`** mit **`HELP_UI_INTRO`**. **Offen:** geführter Wizard / **H.7** Export-Assistent. |
| 5 | **PWA-Realität** | **Doku + Checks** | **`docs/PWA-MANUAL-CHECKS.md`**, **§ H.2**; optional Offline-Fallback-Seite Backlog. |

**Teil erledigt (2026-03-28):** Chat **Wald-Check** (grün/blau/rot) + **Rollenzeile**; Toast bei Basis-Wiederherstellung; **`docs/UX-MESSENGER-INVENTORY.md`** aktualisiert; **Onboarding/Wallet:** **`docs/ONBOARDING-WALLET-UX-SPEC.md`**, README-Einstieg, Unlock-Dialog **signer-abhängig**, Shop-Tooltip; **Recovery:** **`docs/RECOVERY-PHRASE-BACKUP.md`**, **`/vault-show-signer-import`**, Einstellungen **Wallet & Backup**.

*Abgrenzung:* Keine neuen **Macro-/Gateway**-Features hier – nur Bedienung, Sichtbarkeit, Rollen-UI und Einsatz-Abgabe.

### H.1 Phase A – Code-Qualität & Messenger-UI (technisch)

| # | Paket | Hinweis |
|---|--------|---------|
| 1 | **`chat-view`** + Phase-A-UI | Refactor der Kern-Logik **abgeschlossen** (Hooks wie oben). **PWA:** siehe **§ A.5** / **H.2**. Bei weiteren UI-Änderungen: **`frontend`: `npx tsc --noEmit`**, Root **`npx tsc`**, **`npm run validate:ui`**, **`npm run test`**. |
| 2 | **Regression** Bild/Audio/LoRa-Sendepfad | Bei Änderungen an Chat/Send kurz manuell oder E2E prüfen. |
| 3 | **Exports** | Keine manuellen Edits in **`exports/Morgendrot-Messenger-*`** – Bundle aus **`src/`** / `frontend/` bauen (`MESSENGER-BUNDLE-SOURCE-OF-TRUTH`). |

### H.2 Als Nächstes – aus 8-Punkte-Liste (nach Stabilität)

| Priorität | # | Thema |
|-----------|---|--------|
| 1 | **5** | **PWA:** Manifest + SW + **PNG-Icons** (§A.5). **Manuelle Checks:** Checkliste **`docs/PWA-MANUAL-CHECKS.md`** (Install, Offline-Shell, Handbuch-Cache, Icons nach `icon.svg`). **Optional:** Offline-Fallback-Seite, SW erweitern. Bei **Änderung von `icon.svg`:** `npm run build:pwa-icons` erneut ausführen. |
| 2 | **6** | Fehlermeldungen/Status konsistent (laufend). |
| 3 | **8** | **Kabel-Bridge** (hoch, spec-nah) – siehe §A.8; Backlog, nicht parallel zu Phase-B-Kern. |

### H.3 Phase B – wenn A „genug“ stabil ist

| Paket | Quelle |
|--------|--------|
| **Mesh v2** zuverlässig (Senden/Empfangen, Web-BT) | `PROJECT-FOCUS` Phase B, Tests/Handbuch |
| **Delayed LoRa → IOTA MVP** | **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** – Queue, Gateway, Custody |
| **Kein** paralleler Start: volles Macro-Gateway, Reticulum, DID/Twin-Produkt | Nur Doku/Specs pflegen |
| **Globales Relay / „jede Basis → ein VPS“** | **Nicht** vor Phase-B-Kern; Einordnung **§ I** – erst Trust-/Gateway-Spec, dann Phase C |

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
| **6** | **Rollen-Manager (Boss-Werkstatt)** | `ui/`: Templates (Einsatz-Rolle → Chain-`ROLE`/`roleId`); Medic/Scout als **Labels**, nicht als neue Chain-Enums. | **1**, **2** |
| **7** | **Offline-Relay-Queue (Boss ohne Internet)** | Eigenes Modul nach Vorbild **`settlement-queue.ts`**; **kein** Missbrauch von `mintMessengerCreditsBatchForRecipients`; typisierte Einträge + Flush. | **`docs/OFFLINE-QUEUE-AND-PROFILE-PROVISIONING-CRITIQUE.md`** |
| **8** | **Doku & Git** | Nach jedem größeren Schritt: **`README.md`** (Links), **`docs/ROADMAP-FAHRPLAN.md`** (Statuszeile), **`docs/OPERATIONS-SNAPSHOT-2026-03.md`** bei Betriebsrelevanz; Commit ohne Secrets (**`docs/GIT-CLEANUP-AND-COMMIT-PLAN.md`**). | Laufend |

**Priorität für die nächste Implementierung (wenn gestartet):** typischerweise **1 → 2 → 6** (API + Persistenz + Boss-UI), parallel Doku; **7** wenn LoRa/Offline-Boss konkret wird; **3/4** wenn Endnutzer-PWA im Fokus ist.

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

### H.7 Einsatz-Abgabe **Standalone Smartphone** (Ist) & Backlog

**Zielbild Einsatz:** Boss erzeugt Bundle → gibt es per SD/USB/ZIP an Helfer → Installation (`npm install` im Bundle-Root + `frontend/`) → **`.env`** liegt vor (oder nach `npm install` aus Vorlage) → Boss hat **öffentliche** Parameter pro Auslieferung gesetzt → Helfer tippt **Seed/Vault-Passwort nur auf dem Gerät** → Verbindung zu eurem RPC/Server wie konfiguriert.

| Thema | Status |
|--------|--------|
| **Technik** | Skript `scripts/bundle-standalone-smartphone.ts`; **keine** `.env` mit Secrets im Archiv; **`.env.example`** = Hauptrepo + Override-Block (`ENABLE_UI`, `SIGNER=sdk`, …). |
| **Manuelle Anpassung** | Pro Kunde/Test: **`.env`** editieren (z. B. `PACKAGE_ID`, `RPC_URL`, `BOSS_ADDRESS` / Partner) — **sinnvoll und ausreichend** für erste Einsätze. |
| **Geheimnisse** | **Nie** Seed oder Vault-Passwort auf das Medium schreiben; nur lokale Eingabe auf dem Telefon. |
| **Backlog (optional)** | **Boss-Export-Assistent** in der Werkstatt: Formular → ZIP + fertige **`.env`** (ohne Secrets) + Kurz-README — **Komfort**, kein Blocker für Feldtests. |

---

*Bei Konflikt mit `PROJECT-FOCUS-AND-PRIORITIES.md` gewinnen die **Phasen A/B/C** dort; dieser Fahrplan priorisiert **Inhalt und Reihenfolge** innerhalb der Projektentscheidungen.*
