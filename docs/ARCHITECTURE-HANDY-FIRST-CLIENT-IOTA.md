# Architektur: Handy-first, Client-Signatur, optionaler Morgendrot-Node

**Status:** Kanonisch **ab 2026-04-28** — ergänzt und ersetzt die frühere alleinige Primärleitlinie in **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** § 6 (jetzt **§ 7 historisch** dort).  
**Fahrplan:** **`docs/ROADMAP-FAHRPLAN.md`** **§ H.15**.

**Leitsatz (Produkt, gültig — Kurzfassung):**

1. **Messenger primär auf dem Handy** (Handy-first).  
2. **Local-first:** speichern, signieren, puffern **lokal** auf dem Gerät.  
3. **Direkt IOTA:** signierte Transaktionen **ohne zwingend** einen separaten Morgendrot-Node dazwischen (RPC konfigurierbar).  
4. **Morgendrot-Server/Node nur optional** — z. B. Sponsored Gas, Archiv, Komfort.

**Repo-Ist** bleibt bis zur schrittweisen Umsetzung (Stufen unten) teils **node-lastig**; das **widerspricht** dem Leitsatz **nicht**, sondern ist die dokumentierte **Übergangsphase** (siehe § 2 „Übergang“).

---

## 1. Zielbild (kurz)

| Pillar | Inhalt |
|--------|--------|
| **Handy-first** | Messenger läuft **primär** auf dem Smartphone (PWA / später native Hülle); keine Pflicht, einen **separaten** Morgendrot-Node-Rechner mitzuführen. |
| **Local-first** | Nachrichten **lokal speichern, signieren und puffern**; UI und Queue arbeiten **ohne** erreichbaren Morgendrot-Server. |
| **Direkt IOTA** | Das Gerät **sendet signierte Transaktionen** über konfigurierbare **`RPC_URL`** (öffentliche oder eigene Nodes) — **ohne** zwingenden Morgendrot-HTTP-Node dazwischen. |
| **Optionaler Node / Relay** | Morgendrot-**Node** (`src/`, `/api`) nur noch **opt-in**: z. B. **Sponsored Gas**, zentrale **Archivierung**, **Komfort**, **Boss-Werkstatt** (`ui/`), schwere Provisioning-Pfade. |

**App-Schalter (Produktanforderung):**

- **„Direkt ins IOTA senden“** — **Standard = an** (Client baut/signiert, Upload über RPC).
- **„Morgendrot Relay benutzen“** — **optional** (wenn konfiguriert: Befehle/Upload über `/api` oder dedizierten Relay-Endpunkt).

---

## 2. Kritische Einordnung (Missverständnisse vermeiden)

1. **„Kein Server“** — **falsch** als absolute Aussage: **Jede** Light-Client-Lösung spricht mit **RPC-Instanzen** (IOTA-Rebuilt-Nodes). Die neue Leitlinie meint: **kein Pflicht-Morgendrot-Node**, nicht „keine Netzdienste“.
2. **Credits / globale Guthaben** — weiterhin **Ledger-Sache**; lokal nur **ehrliche** Zustände („ausstehend / bestätigt“), siehe **`docs/MESSENGER-STRATEGIC-PRINCIPLES-LOCAL-FIRST-IDEMPOTENCY-PQ.md`** und **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (**§ H.12**).
3. **Threat-Model** — Schlüssel und Signatur im **Client** (Browser/native): anderes Risikoprofil als isolierter Node-Prozess; muss mit **§ H.10**, **`docs/ONBOARDING-WALLET-UX-SPEC.md`**, **`docs/MORGENDROT-HARDENING-V3-PRECISION.md`** verzahnt werden.
4. **Übergang** — **Repo-Ist** (2026-04) bleibt **Node-first** im Code, bis die Phasen unten umgesetzt sind. **Kein Big-Bang** ohne grüne Tests pro Scheibe.

---

## 3. Shared Core (`@morgendrot/core`)

**Zweck:** Eine **einzige** TypeScript-Basis für:

- IOTA-/Move-**PTB-Bau** und **Serialisierung** (wo möglich ohne Node-only APIs),
- **Signatur**-Orchestrierung (Adapter: SDK im Browser vs. Node),
- **Offline-Queue** (Zustände, `canonical_msg_ref`, Retry-Policy — align **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**),
- **Attestation / device-time**-Hilfen (shared mit **`src/shared/device-time-trust.ts`** wo sinnvoll).

**Technische Leitplanken:**

- Paket **ohne** React/Next-DOM; **Vitest** pro Modul.
- Workspace: z. B. `packages/morgendrot-core` mit **`"name": "@morgendrot/core"`** — Root-`package.json` **`workspaces`** ergänzen, wenn angelegt.
- **Node** und **Frontend** importieren dasselbe Paket; **`src/api-server`** darf schrittweise zum **Thin Relay** werden.

**Stufe‑1‑Detailplan (Ordner, Module, Queue, Tests):** **`docs/MORGENDROT-CORE-PACKAGE-PLAN.md`** — inkl. Betriebsmodi (Handy±Server, PC±Server) und Abgrenzung zu **`@morgendrot/shared`**.

---

## 4. Pragmatischer Umsetzungsplan (Stufen)

| Stufe | Inhalt | Erfolgskriterium (minimal) |
|-------|--------|----------------------------|
| **0 — Leitplanken** | Feature-Flag / Settings-Modell für **Direct vs Relay**; Telemetrie-Logs nur ohne Secrets; Handbuch-Zeile „was läuft wo“. | **Ist (Messenger-PWA):** Chat **→ Puls** — Modus **Direkt** vs. **Nur Morgendrot-API** (`localStorage` **`morgendrot.iotaSubmitMode`**); **`docs/PWA-HANDBUCH-OFFLINE.md`** § 5; Telemetrie unverändert beachten. |
| **1 — Core-Skelett** | Monorepo-Paket **`@morgendrot/core`**: reine Typen + **eine** PTB/TX-Hilfsfunktion aus `src/` **verschieben** (ohne Verhaltensänderung auf Node-Pfad). | Root + frontend `tsc`; Vitest im Paket grün. |
| **2 — Erster Client-Submit** | Ein **kontrollierter** Flow (z. B. kleine Nachricht / Test-PTB) **vom Browser** über Core → RPC; Node-Pfad bleibt Fallback. | **Ist:** Manuelles Protokoll **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**; **`TESTING.md`** (Verweis); Vitest **`frontend/frontend/lib/direct-iota-plain-submit.test.ts`** (Frühabbrüche); Merge-Ritual **`npm run test:unit`** im Ordner **`frontend/`**. |
| **3 — Offline-Queue** | Persistente Outbox auf dem Gerät; **Drain** bei Netz; **Idempotenz** / Dedup laut **§ H.12**; Konflikt mit bestehender **`offline-queue.ts`** **auflösen** (eine Wahrheit). | **Ist:** Kanonische Queue-Logik nur in **`@morgendrot/core`**; **`frontend/.../offline-queue.ts`** = dünner Browser-Adapter (keine zweite Settlement-Implementierung) — **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** § 8; **`npm run test:core`** / **`test:unit`** bei Änderungen. |
| **4 — Relay optional** | **„Morgendrot Relay“** nutzt bestehendes `/api` für Gas-Sponsor, Archiv, komplexe Befehle; **Direct** bleibt Default. | **Ist:** **`TESTING.md`** Qualitätsritual **5c** + **`npm run test:h15-direct-submit`**; Anhang § 4 in **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**. Boss-/Lite-UI unverändert an **`/api`**. |

**Parallelität:** **§ H.1b** (UI-Modularität) und **Phase B** (Mesh) **nicht** in derselben Woche wie große Core-Migration ohne Absprache — **`docs/ROADMAP-FAHRPLAN.md`** **§ C.0b**.

**Ist (Messenger-PWA, Mailbox):** PTB + Signatur im Browser laufen in **`@morgendrot/core`** (`signAndExecuteTransactionWithSigner`, …) — aufgerufen über **`trySubmitPlaintextMailboxViaDirectIota`** / **`trySubmitEncryptedMailboxViaDirectIotaFromPlaintext`**. Alle nutzerrelevanten Versandpfade (Composer, SOS-Mailbox-Fallback, B2-Spiegel, Delayed-Mirror-Drain, LUMA/CHROMA-Online-Bestätigung, Einsatzprotokoll-Anker) gehen zentral über **`frontend/frontend/lib/mailbox-send-hybrid.ts`** (**Direct zuerst**, **`/api`** als Fallback).

---

## 5. Verwandte Dokumente

- **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** — Stufe **2** (manuelles Smoke-Protokoll + Verweis auf Vitest).  
- **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** — Ist vs. Ziel, **§ 7** historisch.  
- **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (**§ H.12**, **§ 8** Outbox vs. andere Queues).  
- **`docs/MESSENGER-STRATEGIC-PRINCIPLES-LOCAL-FIRST-IDEMPOTENCY-PQ.md`**.  
- **`docs/DEV-START.md`** — Ports/Rewrites solange Übergang Node+PWA.  
- **`docs/WANDERER-STANDALONE-BUNDLE.md`** — Abgabe-Erzählung anpassen, wenn Bundle **ohne** Pflicht-Node verkürzt wird.

---

## 6. Weiterarbeit: Richtung „Handy-only“ / kein Morgendrot-PC im Betrieb

**Zwei Ziele nicht vermischen:**

| Stufe | Was „ohne PC“ hier heißt | Technisch |
|--------|---------------------------|-----------|
| **A — Sofort (Betrieb)** | Kein **Entwicklungs-PC** im Raum; Messenger nutzbar vom Handy aus | Morgendrot **deployed** (HTTPS): Next + API auf Server/VPS **oder** anderem dauerhaft laufenden Host. PWA von dieser URL installieren. Der **Morgendrot-Prozess** kann noch da sein — nur nicht auf deinem Laptop. |
| **B — Produkt-Zielbild** | **Kein** Morgendrot-Node als **Pflicht**; Handy **primär** mit RPC + lokaler Queue | Schritte unten; deckt sich mit **§ 4** Stufen **2→3→4** + Erweiterungen (Lesen, verschlüsselt, Peering). |

### Reihenfolge für **B** (Node optional, wirklich „Handy-first“)

1. **Ketten-/Mailbox-Kontext ohne laufenden Node-Dialog** — Heute hängt der Direct-Klartext-Pfad u. a. an Snapshot/Flags aus **`/api/status`**. Alles, was dafür nötig ist, muss **einmalig** beschaffbar und **auf dem Gerät persistiert** werden (Puls/Settings erweitern, bis kein „erst Basis anpingen“ nötig ist).
2. **Klartext-Mailbox client-only verifizieren** — **`trySubmitPlaintextMailboxViaDirectIota`** + Outbox/Drain (**`offline-queue.ts`**, **`@morgendrot/core`**) auf einem Referenzprofil **Handy/Schreibtisch** nach **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** grün bekommen.
3. **Verschlüsselter Sendepfad** — gleiches Muster wie Klartext: PTB bauen + signieren in **`@morgendrot/core`**, Ausführung über **RPC**; **`executeCommand`/`/send`** nur noch Fallback/Relay.
4. **Empfang ohne `/api/fetch`** — Inbox aus der Kette/RPC lesen (owned objects / dokumentierte Read-Pfade), Pagination + Dedup mit **§ H.12** / **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** § 8. **Ist (Stufe 1–2):** `fetchMailboxInboxRpcRows` (**`@morgendrot/core`**) sammelt Klartext (`PlainMsgKey`) und/oder verschlüsselte Mailbox-Objekte (`MsgKey`); **`tryFetchDirectMailboxInboxViaIota`** entschlüsselt im Browser (Chat-ECDH wie Direkt-Senden), wenn **Direkt-Mailbox-Drain** an und Mailbox ohne Credits; Klartext-Zweig wie zuvor ohne Drain-Zwang. **`use-chat-view-inbox`:** **RPC vor API** — bei gültigem Direkt-Pfad Fullnode zuerst, **`/inbox`** parallel nur ergänzend; gleicher Dedup-Schlüssel → Chain. Reine **Event**-Pfade (ohne DOF) folgen.
5. **Peering (Handshake/Connect)** — **Ist (2026-06):** Hybrid **Direkt-RPC vor API** (`handshake-send-hybrid`, `connect-hybrid`, `fetchHandshakeOffers` / `findPeerHandshake`); **Peering-QR** (`mp`/`mc`, optional `u`/`p` für RPC/Package); Standalone ohne Relay (`messenger-standalone-relay.ts`). **Relay-Modus** bleibt opt-in. **Offen:** On-Chain-**Purge** von Handshake-Angeboten ohne `/purge-handshake`-API.
6. **Abgabe & Erwartungshaltung** — **Ist (2026-06):** **`docs/WANDERER-STANDALONE-BUNDLE.md`** Variante **B** (APK, Handoff lokal, Peering-QR, Smoke **4b–4f**); Dashboard-Hinweis ohne „`npm run dev`“-Pflicht im Standalone. **Offen:** Event-only-Posteingang ohne DOF; **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** manuell abnehmen.

### **B.2b — LoRa-Fluent-Bildkodierung lokal (12 KB, ohne PC/Server)**

**Ziel:** Anhang **Flüchtig (LoRa)** — LUMA+CHROMA bis **12 000 B** JPEG-Paar — **vollständig auf dem Gerät** kodieren; **kein** Pflicht-`POST /api/lora-progressive-encode` (Sharp/Node).

| Schicht | Ort | Rolle |
|---------|-----|--------|
| **Policy + Wire** | **`@morgendrot/core/image`** | Harte Limits (`FLUENT_LORA_JPEG_PAIR_TOTAL_MAX_BYTES`), progressive Wire (`MORG_LUMA_V1` / `MORG_CHROMA_V1`), Such-/Robust-Policy (`encodeLoraFluentRobustWithPolicy`) — **transportneutral**, Vitest. |
| **`ImageEncodePort`** | **`frontend/frontend/lib/image-encode/`** | Port-Typ + **`encodeLoRaFluentAutark`**: Standard-Backend **WASM** (Canvas + **`@jsquash/jpeg`** / MozJPEG); optional **Relay** nur bei `localStorage` **`morgendrot.imageEncodeRelayFallback`** = **`1`** → bestehendes **`/api/lora-progressive-encode`**. |
| **Ingest** | **`chat-view-attachment-ingest.ts`** | Mesh/Pfad‑4: **`encodeLoRaFluentAutark`** statt API-first; IOTA-Kompakt (`compactImageEncode`) bleibt **separater** Scheiben-Backlog. |
| **Funk-Send** | **`sendLoraImageViaMorgSegV1`** usw. | Unverändert client-lokal nach vorhandenen Wires. |

**Messpunkt:** Große Rohbilder → Warnung „auf dem Gerät verkleinert“; Funk-Bild-Anhang **ohne** erreichbaren Morgendrot-Node testbar (Capacitor/PWA). ### **B.2c — IOTA-Kompaktbild lokal (`MORG_COMPACT_IMG_V1`, 11 800 B Netto)**

**Ziel:** Online/IOTA-Anhang — ein Blob (Luma-WebP + Chroma-PNG) — **auf dem Gerät**; **kein** Pflicht-`POST /api/compact-image-encode`.

| Schicht | Ort | Rolle |
|---------|-----|--------|
| **Blob + Policy** | **`@morgendrot/core/image`** | `packVaultImageBlob`, `encodeIotaCompactFitChain`, Presets wie `VaultImagePipeline` |
| **`ImageEncodePort.encodeIotaCompact`** | **`frontend/…/image-encode/`** | WASM: Canvas + **`@jsquash/webp`** (Luma) + PNG (Chroma); Relay optional wie B.2b |
| **Ingest / .morg-pkg** | **`chat-view-attachment-ingest.ts`**, **`use-chat-view-morg-pkg-actions.ts`** | **`encodeIotaCompactAutark`** |

**Messpunkt Schreibtisch:** Vitest Ingest + Core-Policy. **Gerät (später):** Abschnitt **„Bild-Kodierung autark (LoRa + IOTA)“** in **`TESTING.md`** — gemeinsam mit **§ H.25a**-Feldtest, nicht vor Schreibtisch-Grün blockieren.

**Operator-UX (parallel, keine Blockade für B.2–B.4):** Telefonbuch mit Klarnamen, QR zum Einlesen/Teilen von Adressen und Installations-URLs, Boss-LAN-Szenario (Helfer scannen QR am Boss-PC → PWA installieren) — **kritische** Einordnung (HTTPS, Same-Origin, § H.12 Kontakt-Wahrheit, QR-Schema **§ H.3b**) in **`docs/ROADMAP-FAHRPLAN.md`** § **H.16**.

**Messpunkt:** **B.2–B.5** (Send, Inbox, Peering, QR) sind im Code für den privaten Online-Chat **ohne** laufenden Morgendrot-Node vorgesehen; **Feldabnahme** (Smoke **4b–4f**) und **H.6f** (Android-Hintergrund) folgen laut Fahrplan. **A** bleibt parallel für Teams, die **deployen** wollen.

---

*Stand: 2026-05-28 — **§ 6 B.2b/B.2c** Bild-Encode lokal (LoRa + IOTA, `ImageEncodePort`, WASM); zuvor 2026-04-28: erste Fassung, Reihenfolge Handy-only vs. Deploy.*
