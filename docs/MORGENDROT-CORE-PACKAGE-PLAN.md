# `@morgendrot/core` — Stufe‑1‑Plan (Monorepo, Module, Offline‑Queue, Vitest)

**Status:** Umsetzungsplan (Stufe **1** aus **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**).  
**Ziel:** Ein TypeScript‑Paket, das **PWA (Handy)**, **optionaler Morgendrot‑Node (`src/`)** und später **CM4 / Headless** dieselbe **Queue‑/IOTA‑Kernlogik** nutzen lässt — **ohne** React/Next im Paket.

**Abgrenzung zu `@morgendrot/shared`:** **`src/shared/`** bleibt für **kleine** isomorphe Helfer (wie heute `einsatz-role-templates`, ggf. künftig **nur** dünne Brücken). **`@morgendrot/core`** übernimmt **Messenger‑Kern**: Outbox‑Modell, Idempotenz‑Hilfen, PTB/TX‑Bau‑Schichten, Attestation‑Typen — siehe **`docs/MONOREPO-NEXT-AND-SHARED.md`**.

---

## 1. Betriebsmodi (alle mit demselben Core abdeckbar)

| Modus | Client | Morgendrot‑Node / Relay | Core nutzt |
|--------|--------|---------------------------|------------|
| **Handy + Server** | PWA | **An** (Gas, Archiv, `/api`) | Direct **oder** Relay je Schalter; Queue drain wahlweise über `/api` |
| **Handy only** | PWA | **Aus** | Queue + Signatur + **RPC** nur im Client |
| **PC only** | Next lokal | **Aus** (oder eingebettet) | Wie Handy only auf demselben Stack |
| **PC + Morgendrot‑Server** | Next | **An** | Wie heute übergangsweise; Core entkoppelt UI von „wo signiert wird“ |

Der Core liefert **keine** UI — nur **Datenmodelle, reine Funktionen, Ports (Interfaces)**. **Speicher** und **Netz‑Transport** sind **injectiert** (Adapter), damit Browser (`localStorage` / IndexedDB) und Node (`fs` / Speicher) gleiche Logik fahren.

---

## 2. Ordnerstruktur (Vorschlag)

Repo‑Root (neben `src/`, `frontend/`):

```
packages/
  morgendrot-core/
    package.json          # "name": "@morgendrot/core", "type": "module"
    tsconfig.json         # "module": "NodeNext", strict, lib ES2022 (+ ggf. "DOM" nur wenn unvermeidbar — besser vermeiden)
    vitest.config.ts
    README.md
    src/
      index.ts            # öffentliche Re-Exports (schmal halten)
      ports/
        storage.ts        # z. B. OfflineQueueStoragePort { load, save }
        clock.ts          # optional: now() für Tests
      queue/
        offline-mailbox/  # zuerst: aus frontend offline-queue.ts
          model.ts        # Typen + reine Validierung / Normalisierung
          state.ts        # enqueue, reorder, next clientOutSeq, dedup-Key — ohne fetch
          codec.ts        # JSON roundtrip, Größenlimits (MAX_ITEMS, …)
        README.md         # Abgrenzung zu settlement-queue, delayed-mirror
      iota/               # später: PTB-Helfer, RPC-Client-Port
      attestation/       # später: Typen + Kanonisierung (device time, flags)
```

**npm‑Verdrahtung (analog `@morgendrot/shared`):**

- Root **`package.json`:** `"@morgendrot/core": "file:packages/morgendrot-core"` (damit `src/` per `import '@morgendrot/core/queue/…'` auflöst — ggf. **`paths`** in Root **`tsconfig.json`** ergänzen, weil `rootDir` heute nur `src/` ist: **entweder** `rootDir`/`include` anpassen **oder** Core nur aus `frontend/` und Skripten importieren, bis Root‑TS angepasst ist).
- **`frontend/package.json`:** `"@morgendrot/core": "file:../packages/morgendrot-core"` + **`next.config.mjs`** `transpilePackages: ['@morgendrot/shared', '@morgendrot/core']` (Liste erweitern).
- **`turbopack.root`** bleibt Repo‑Parent — wie bei Shared, damit `file:`‑Links außerhalb von `frontend/` aufgelöst werden.

**Workspaces (optional):** Root `"workspaces": ["packages/*"]` vereinfacht `npm install` an einer Stelle — **nicht** zwingend, wenn ihr bei expliziten `file:`‑Dependencies bleibt.

---

## 3. Reihenfolge: welche Module zuerst?

| Priorität | Modul | Warum zuerst / später |
|-----------|--------|------------------------|
| **1** | **`queue/offline-mailbox/*`** | Bereits im Frontend (`offline-queue.ts`) mit klarer Domäne; **größter** Hebel für Handy‑first; **kein** IOTA‑SDK nötig für reine Datenlogik. |
| **2** | **`ports/storage` + `ports/clock`** | Minimale Schnittstellen, damit Vitest **In‑Memory** fahren kann. |
| **3** | **Device‑Zeit / Trust** (Typen + reine Funktionen) | Heute parallel: `src/shared/device-time-trust.ts` und `frontend/.../device-time-trust.ts` — **eine** kanonische Implementierung im Core, beide Seiten importieren. |
| **4** | **`iota/*`** (PTB bauen, Bytes, keine UI) | Erst wenn Queue‑Scheibe stabil; hängt von **`@iota/iota-sdk`** und Bundle‑Größe im Browser ab — schrittweise exportieren. |
| **5** | **`attestation/*`** | Baut auf **3** + Queue‑Metadaten (`timeIsTrusted`, `clientOutSeq`) auf — nach erster Outbox‑Integration. |

**Bewusst nicht** in die erste Scheibe: volle **`chain-access.ts`**‑Kopie, **`api-server`**, Streams‑HMAC — das bleibt Node **oder** spätere Core‑Ports.

---

## 4. Offline‑Queue — der kritischste Teil (Vorgehen)

### 4.1 Problemstellung

- Es gibt bereits **`frontend/frontend/lib/api/offline-queue.ts`** (Mailbox‑Outbox, `localStorage`, Drain über **`sendMessage`**).
- Es gibt **andere** Queues (**Settlement**, **Delayed‑Mirror**, **LoRa→IOTA**) — **nicht** vermischen (**Kommentare im Code** sind schon gut).

### 4.2 Strategie: „Kern extrahieren, Nebenwirkungen draußen lassen“

1. **`model.ts`:** Typen `OfflineMailboxQueueItem`, Status‑Konstanten, Grenzen (`MAX_ITEMS`, …) 1:1 oder minimal bereinigt.
2. **`codec.ts`:** `normalizeOfflineMailboxItem`, Serialisierung/Deserialisierung **rein** (kein `window`).
3. **`state.ts`:**  
   - `allocateClientOutSeq(items)`  
   - `dedupeStableId(...)` (falls vorhanden)  
   - `enqueue(items, draftItem) → { items, item }`  
   - `markPendingForDrain`, `removeSent` — **alles ohne** `fetch` / `sendMessage`.  
4. **Frontend** (`offline-queue.ts`) wird zum **dünnen Adapter**: liest/schreibt `localStorage` über **`OfflineQueueStoragePort`**, ruft nach außen weiter `sendMessage` — **oder** später einen **„DirectIotaSubmitPort“**.

So ist der **Core** in Vitest **vollständig** testbar; die PWA behält nur **IO + Side‑Effects**.

### 4.3 Idempotenz und § H.12

- **`id`**, **`clientOutSeq`**, **`canonical_msg_ref`** (wenn eingeführt): im Core **eine** Definition von „gleicher logischer Sendung“.  
- Abgleich mit **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`** und **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** **pro PR**, sobald der Core mehr als MVP spiegelt.

### 4.4 Persistenz‑Roadmap (kurz)

| Phase | Speicher | Hinweis |
|-------|----------|---------|
| **A** | In‑Memory + `localStorage`‑Adapter (heute) | MVP‑Parität |
| **B** | IndexedDB‑Adapter (optional) | Größere Caps, gleiche Core‑API |
| **C** | Node: Datei/SQLite für CM4 | Gleiche `StoragePort` |

---

## 5. Erste Vitest‑Tests (konkret)

Im Paket **`packages/morgendrot-core`** (oder nach Anlage des Ordners):

| Testdatei | Inhalt |
|-----------|--------|
| **`queue/offline-mailbox/state.test.ts`** | Enqueue → `clientOutSeq` monoton; `MAX_ITEMS`‑Clamp; Duplikat‑`id` ersetzt oder verworfen (definiertes Verhalten). |
| **`queue/offline-mailbox/codec.test.ts`** | Roundtrip gültiger / ungültiger JSON; Legacy‑Einträge ohne `timeIsTrusted` → `false`. |
| **`queue/offline-mailbox/model.test.ts`** | Randwerte `MAX_PAYLOAD_CHARS`, fehlende Felder → `null`. |

**Nicht** im ersten Schritt: E2E gegen RPC — das bleibt **`test:smoke`** / Realworld‑Skripte.

**CI:** optionaler Job „`core` unit“ oder Einbindung in **`frontend-checks`** nur, wenn `npm run test:unit --prefix packages/morgendrot-core` stabil und schnell ist.

---

## 6. Konkrete Arbeitsscheiben (Reihenfolge)

1. **Scaffold** `packages/morgendrot-core` + `vitest` + erste leere `index.ts`. **Erledigt (2026-04-28):** Offline-Mailbox **model / codec / state** im Core + PWA-Adapter `frontend/.../offline-queue.ts` + Root **`npm run test:core`** + CI-Schritt in **`frontend-checks.yml`**.  
2. **`ports/storage.ts`** + In‑Memory‑Implementierung für Tests.  
3. **Move** reine Teile aus `offline-queue.ts` → Core (`model`, `codec`, `state`); Frontend importiert aus `@morgendrot/core` und **löscht** duplizierte Zeilen (Verhalten unverändert).  
4. **Root/Frontend** `package.json` + `transpilePackages` + **`npm install`** in `frontend/` → Lockfile commiten (**`docs/MONOREPO-NEXT-AND-SHARED.md`** beachten).  
5. **`device-time-trust`:** eine Quelle im Core, Frontend/Server stellen nur dünne Re‑Exports oder entfernen Duplikat (separate kleine Scheibe).  
6. **Doku:** diese Datei pflegen; **`docs/ROADMAP-FAHRPLAN.md`** § **H.15** bei Meilenstein „Core‑Scheibe 1 merged“ kurz aktualisieren.

---

## 7. Risiken / Leitplanken

- **Root `tsconfig.json`** umfasst aktuell nur **`src/**`** — Core unter `packages/` braucht **eigenes** `tsc` im Paket oder erweiterte Root‑Konfiguration; sonst nur Frontend+Vitest als Gate reicht für Stufe 1.  
- **Bundle‑Größe PWA:** IOTA‑SDK im Core früh importieren **erhöht** Client‑Bundle — erst **nach** Queue‑Scheibe messen (`next build` Analyse).  
- **Zwei Wahrheiten vermeiden:** Während der Migration kurzzeitig Core+Duplikat ok — **nach** Merge nur noch eine kanonische Queue‑Logik.

---

*Stand: 2026-04-28 — Stufe‑1‑Detailplan; Abgleich mit **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**.*
