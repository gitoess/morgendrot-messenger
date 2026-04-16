# Phase A — Qualität: Baseline, Vitest, AppError (verbindlicher Plan)

**Status:** **Fahrplan-Pflicht** — ergänzt **`docs/ROADMAP-FAHRPLAN.md`** **§ H.1a**; **kein** Ersatz für **Playwright** (E2E) oder bestehende **`tsx`/`npm run test`**-Module.

**Verknüpft:** **`docs/ROADMAP-FAHRPLAN.md`** (**§ H.1b** Messenger-UI-Modularität), **`docs/MESSENGER-UI-MODULARITY-STRATEGY.md`**, **`docs/TEST-STRATEGY.md`**, **`TESTING.md`**, **`docs/CODE-SCHLANKHEIT-UND-HAERTUNGS-PRIORITAET.md`** (**§ H.13**).

---

## Ehrliche Bestandsaufnahme (Kritik — Stand einarbeiten)

| Thema | Befund |
|-------|--------|
| **TypeScript-Hygiene** | „Keine **`any`** per `rg`“ reicht **nicht**: in großen Hooks (**`use-chat-view-core`**) tauchen **`unknown` ohne Narrowing**, **Callbacks mit implizitem `any`**, **`as`-Casts** und **schwache Event-Typen** auf — das ist **noch nicht** „tiefe“ Hygiene. Gezielt: **`@typescript-eslint/no-explicit-any`**, **`noImplicitAny`** (über **`strict`** schon an), und **`unknown` nur mit Type Guards** weiterreichen. |
| **Unit-Tests** | **Ausgebaut:** u. a. **`compact-image-wire.test.ts`**, **`api-response-guard`**, **`api-simple-ok-envelope`**, **`api-unlock-envelope`**, **`api-fetch-text`** — Stand **Vitest** im Ordner **`frontend/`** laufend **>40** Tests (siehe **`npm run test:frontend-unit`**). **Weiterhin dünn:** **Send-Flow**-Hooks, **RTL** um Send-Trigger, **Sharp**-Pipeline nur serverseitig. |
| **Error Boundaries + zentrale UX-Feedback** | **Teilweise:** Root-**`app/error.tsx`**, **`show-app-error-toast.ts`**; **Toasts** u. a. **Shadow-Sweep**, **Mesh-Export/Import**, **lokaler Inbox-Purge** (Setup-Panel). **Fehlt noch:** breite Abdeckung aller Chat-Aktionen, **RTL**-Tests, ggf. segmentierte **`error.tsx`** unter **`/chat`**. |
| **`api.ts` → Zod-Envelope / `fetchApiText`** | **Großteil umgesetzt (2026-03):** sämtliche Fetch-Pfade in **`frontend/frontend/lib/api.ts`** nutzen **`fetchApiText`** + **`response.text()`** (kein **`response.json()`**); **`parseApiJsonEnvelope`** / **`parseOkEnvelopePassthrough`** / **`parseJsonObjectRecord`**; Catch → **`formatFetchFailureMessage`** (einheitlich mit **`executeCommand`**, inkl. **Timeout**). Kleine Helfer: **`api-fetch-text.ts`**, **`api-simple-ok-envelope.ts`**, **`api-unlock-envelope.ts`**. Rest: weiter **kleinschrittig** bei neuen Endpoints. |
| **Git + Realworld + Doku** | **Regelmäßig** (z. B. wöchentlich oder vor Tag): **Messenger** = **`npm run test:messages*`**; **Tickets/AccessKey** = nur bei Kachel-Arbeit **`npm run test:tickets-accesskey-realworld`** (Alias **`test:realworld`**) — getrennt festhalten laut **`TESTING.md`** (Commit-Message, **`docs/CHAT-PROTOKOLL-*`** oder Operations-Notiz); **kleine Commits** halten den Code **stabil** und **bisect-fähig**. |

**Reihenfolge (vereinbart):** Zuerst **Phase 1 abschließen** (Hotspots **tiefer** als nur `any`-Suche, Doku, **Baseline-Commit + ehrlicher Tag**). **Danach Phase 2 und Phase 3 bewusst parallel**, aber **langsam** und in **kleinen Schritten** (kein Big-Bang-Refactor).

---

## Kritik eingearbeitet (Kurz)

- **Phase 1** ist mehr als „nur Hotspots + Doku“: ein **annotierter Git-Tag** mit **Verifikationsliste** ist **explizit** Teil der Baseline (**git bisect**, Moral, Referenz).
- **Test-Runner:** **Eine** festgelegte Richtung — **Vitest** (nicht parallel Jest + tsx-Unit-Philosophie ohne Namen).
- **AppError:** Einheitliches Fehlerobjekt **unterstützt** Tests und Grenz-Validierung — Umsetzung **Phase 3**, minimale Typ-Skizze darf **Ende Phase 2** starten, wenn es Refactors spart.

---

## Festlegung: Unit-Tests mit Vitest

| Bereich | Konfiguration | Inhalt |
|---------|----------------|--------|
| **`frontend/`** | **Vitest** + **React Testing Library** (`environment`: **happy-dom** oder **jsdom**) | Reine Logik unter **`frontend/frontend/lib/`** (Wire, Payload, Dedup, …) zuerst; danach **komponentennahe** Tests. |
| **`src/`** (Node: **Sharp**, **fs**, reine Parser) | **Vitest** mit **`environment: 'node'`** | Neue Tests als **`src/**/*.test.ts`** (oder ein vereinbartes Suffix); **bestehende** `tsx scripts/test-*.ts` und **Realworld-Skripte** bleiben **Integrations-/E2E-nah** und werden **nicht** sofort abgeschafft. |

**Umsetzung:** Entweder **`vitest.workspace.ts`** im **Repo-Root** mit zwei Projekten (Frontend + Node), **oder** zuerst **`frontend/vitest.config.ts`** und in **einem zweiten Schritt** Root-/`src`-Projekt ergänzen — **ohne** zweiten Test-Runner (kein Jest).

**E2E unverändert:** **Playwright** (`npm run test:ui`, …).

---

## Phase 1 — Stabile Baseline (ca. 2–3 Tage)

1. **Hotspots:** `any` → `unknown` / konkrete Typen in **`use-chat-view-core.ts`**, **`frontend/frontend/lib/api.ts`**, zentrale **Send-Helfer** (kein Flächenbrand).
2. **Doku + `.gitignore`** auf Stand bringen; **`npm run sync:handbook`** (Handbuch mit README/Fahrplan konsistent halten).
3. **Verifikation vor Tag/Release-Claim** (mindestens; bei euch anpassen):
   - Root: **`npx tsc --noEmit`**
   - Frontend: **`cd frontend && npx tsc --noEmit`**, **`npm run lint`**, **`npm run check:circular`**, **`npm run test:unit`** (oder von Root: **`npm run test:frontend-unit`** statt letzterem)
   - Root: **`npm run validate:ui`**
   - Root: **`npm run test:smoke`** (oder dokumentierte Teilmenge)
   - **Tabelle + Reihenfolge:** **`TESTING.md`** § *Qualitätsritual vor Merge*; **CI-Spiegel (Frontend-Schritte):** **`.github/workflows/frontend-checks.yml`**
4. **Git:** ein **klarer Commit** (Message listet Kernänderungen).
5. **Optional `git tag -a`:** **Nur** mit **ehrlicher** Beschreibung — Tag-Text **muss** die **tatsächlich gelaufenen** Kommandos aus (3) nennen oder auf dieses Dokument verweisen. **Kein** Marketing-Claim ohne Laufnachweis.

**Beispiel-Tag-Message (Schema):** `Baseline 2026-04-02 — nach tsc (root+frontend), frontend lint+check:circular+vitest, validate:ui, test:smoke; Hotspot-Typing in chat-view-send/api; Doku/Handbuch-Sync.`

---

## Phase 2 — Test-Infrastruktur (ca. 4–6 Tage)

1. Vitest + RTL im **`frontend/`** anbinden (`package.json`, Config, ein erster grüner Test).
2. Unit-Tests für **reine** Funktionen: Bild-/Wire-Pipeline (soweit ohne echte Hardware testbar), Payload-Builder, Dedup, Metadaten-Normalisierung.
3. **`src/`**-Node-Projekt in Vitest anlegen oder nachziehen; kritische **reine** Hilfsfunktionen aus `src/` dort ablegen bzw. importieren und testen.

**Ist (2026-03-28):** **`frontend/vitest.config.ts`**, Scripts **`npm run test:unit`** / Root **`npm run test:frontend-unit`**; Tests u. a. **`message-dedup`**, **`chat-view-send-utils`**, **`app-error`**, **`api-response-guard`**, **`compact-image-wire`**, **`api-simple-ok-envelope`**, **`api-unlock-envelope`**, **`api-fetch-text`**. **Ergänzt (2026-03):** RTL-Smokes **`components/ui/button.test.tsx`**, **`frontend/frontend/components/chat-view-transport-card.test.tsx`**, **`frontend/frontend/components/chat-view-send-panel.test.tsx`**; **`frontend/eslint.config.mjs`** (Messenger **`features/send` ↔ `features/inbox`**); **`npm run check:circular`** (madge); CI **`.github/workflows/frontend-checks.yml`**. **Ergänzt (2026-03-29, § H.3n / H.1a):** Lib-Tests **`morg-sos-mesh-retry.test.ts`**, **`morg-sos-ack-wire.test.ts`** (Backoff + **`MORG_SOS_ACK_V1`**-Parse, **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`**). **Ergänzt (§ H.1a):** **`format-unknown-error.test.ts`** (**`formatUnknownError`**, keine **`[object Object]`**-Leaks in UI-Zeilen); **`package-id-compare.test.ts`**, **`morg-emergency-v1-text.test.ts`**, **`inbox-load-error.test.ts`**; **`chat-view-send-utils.test.ts`**; RTL **`dashboard-pwa-install-card.test.tsx`**, **`dashboard-iota-transfer-card.test.tsx`**; **`chat-view-messenger-transport`**, **`chat-wald-connection`**, **`mesh-contact-verify`**, **`device-detect`**; **`slide-wire`**, **`mesh-qr`**; **`morg-pkg-import-utils`**, **`inbox-partner-filter`**, **`workspace-projects-panel-storage`**. **`src/`**-Vitest-Node folgt.

---

## Phase 3 — Defensive Schichten (ca. 5–7 Tage)

1. **`AppError`** (oder gleichwertig): `{ code, message, cause? }` + Mapper `unknown` → `AppError`.
2. **Zod** (o. ä.) an **Grenzen:** API-JSON zuerst, dann BLE-/LoRa-/Mesh-Payloads **schrittweise**.
3. **Error Boundaries** (Next/React) + **einheitliche** Nutzer-Feedback-Schicht (Toasts), Fehler nicht „verschlucken“.

**Ist (2026-03-28):** Grundmodule **`app-error.ts`**, **`api-response-guard.ts`**, **`api-fetch-text.ts`** (**`fetchApiText`**, **`formatFetchFailureMessage`**), **`client-log.ts`**. **`api.ts`:** durchgehend **Text + Envelope** (siehe Bestandsaufnahme). **Weiter:** Send/BLE/Mesh-Payloads schrittweise, **`clientLog`** in heißen Pfaden, mehr **Toasts** nur wo UX-Nutzen klar ist.

---

## Priorität

**Parallel zu § H.0 / § H.1**, **vor** breitem **Phase-B**-Mesh-Sprint. **Phase 1 zuerst vollständig** (siehe Baseline-Commit/Tag). **Phase 2 und 3** danach **parallel möglich** (Tests + Boundaries/Zod), aber **immer** in **kleinen Commits** — **kein** monolithischer Sprint.

---

## Einordnung: Notfall-System-Prioritäten (Muss / Soll / Kann)

| Stufe | Thema | Fahrplan |
|-------|--------|----------|
| **Muss** | TS-Hygiene (**tief**: `unknown`/Guards, nicht nur `any`-Freiheit), Grenz-Validierung, **AppError**, wachsende Tests (**Send/Bild** priorisieren), **sichtbare** Logs, **Error Boundaries + zentrale Fehler→Toast-Schicht** | **§ H.1a** Phasen 1–3; Logging: **`client-log.ts`** + Backend-**Winston** |
| **Soll** | Graceful Degradation (LoRa↓), Retry+Idempotenz, saubere **UI / Logik / Transport**-Trennung | Phase A/B; Retry an **Delayed-Queue / canonical_msg_ref** (**§ H.12**) |
| **Kann** | Heltec-MISRA-Style, komplexe Offline-PTB, HF-Dual-Band | Nach Phase-B-Kern oder eigene Hardware-Epics |

**Realistischer Ablauf:** Kurze **Qualitätsrunde** (Wochen statt „dann fertig“) **vor** großen neuen Features; **Belastungsläufe** (Bild/Audio/LoRa über Stunden) **parallel dokumentieren** in **`TESTING.md`**.

---

*Stand: 2026-03-29 — Abgleich mit Team-Plan „Baseline / Vitest / AppError“; Vitest+Grundmodule eingeführt; Bestandsaufnahme/Kritik und Parallelität Phase 2+3 ergänzt. **2026-03-28:** API-Client-Härtung (**`fetchApiText`**, keine **`response.json()`** im Messenger-API-Client (nur **`fetchApiText`** / Envelope)), erweiterte Vitest-Abdeckung, Toasts Setup/Shadow-Sweep. **2026-03-29:** Verifikationsliste um **`frontend/`** **`lint`**, **`check:circular`**, **`test:unit`** ergänzt; **`TESTING.md`** § *Qualitätsritual vor Merge*; CI **`frontend-checks`**. **PR-Vorlage:** **`.github/pull_request_template.md`**. RTL **`chat-view-send-panel.test.tsx`**. **`src/messenger-nest/README.md`:** Klarstellung „kein NestJS-Framework“. *

---

## Kurz für GitHub / Release-Notes (Copy-Paste)

**Titel-Vorschlag:** `feat(frontend): API fetch text + Zod envelope, shared fetch helper, setup toasts`

**Stichpunkte:**
- `frontend/frontend/lib/api-fetch-text.ts`: `fetchApiText`, `formatFetchFailureMessage` (Timeout + Offline-Text wie `executeCommand`).
- `api.ts`: alle bisherigen `fetch`+Antwort über `response.text()` + `parseApiJsonEnvelope` / `parseOkEnvelopePassthrough` / `parseJsonObjectRecord`; kein `response.json()` mehr.
- Vitest: u. a. `api-fetch-text`, `compact-image-wire`, Envelope-Parser.
- UI: Sonner-Toasts — Mesh Export/Import + QR-Fehler, lokaler Inbox-Purge; Shadow-Sweep (bereits zuvor).
- Doku: dieses Dokument + `TESTING.md` / README-Verweis.
