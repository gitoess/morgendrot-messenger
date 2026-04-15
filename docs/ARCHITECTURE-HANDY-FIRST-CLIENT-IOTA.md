# Architektur: Handy-first, Client-Signatur, optionaler Morgendrot-Node

**Status:** Kanonisch **ab 2026-04-28** — ergänzt und ersetzt die frühere alleinige Primärleitlinie in **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** § 6 (jetzt **§ 7 historisch** dort).  
**Fahrplan:** **`docs/ROADMAP-FAHRPLAN.md`** **§ H.15**.

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
| **4 — Relay optional** | **„Morgendrot Relay“** nutzt bestehendes `/api` für Gas-Sponsor, Archiv, komplexe Befehle; **Direct** bleibt Default. | Beide Modi in `TESTING.md`-Ritual; keine Regression Boss-UI. |

**Parallelität:** **§ H.1b** (UI-Modularität) und **Phase B** (Mesh) **nicht** in derselben Woche wie große Core-Migration ohne Absprache — **`docs/ROADMAP-FAHRPLAN.md`** **§ C.0b**.

---

## 5. Verwandte Dokumente

- **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`** — Stufe **2** (manuelles Smoke-Protokoll + Verweis auf Vitest).  
- **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** — Ist vs. Ziel, **§ 7** historisch.  
- **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** (**§ H.12**, **§ 8** Outbox vs. andere Queues).  
- **`docs/MESSENGER-STRATEGIC-PRINCIPLES-LOCAL-FIRST-IDEMPOTENCY-PQ.md`**.  
- **`docs/DEV-START.md`** — Ports/Rewrites solange Übergang Node+PWA.  
- **`docs/WANDERER-STANDALONE-BUNDLE.md`** — Abgabe-Erzählung anpassen, wenn Bundle **ohne** Pflicht-Node verkürzt wird.

---

*Stand: 2026-04-28 — erste Fassung nach Architektur-Pivot.*
