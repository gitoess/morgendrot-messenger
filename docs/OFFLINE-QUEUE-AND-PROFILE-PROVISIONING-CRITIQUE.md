# Offline-Boss-Warteschlange & Einsatz-Profil-Provisioning — kritische Einordnung

**Zweck:** Zwei eng verwandte Produktvorhaben **gegen Ist-Code** prüfen — **fehlerhafte Begriffsverknüpfungen** vermeiden, bevor implementiert wird.

**Verwandt:** **`docs/PROVISIONING-PAYLOAD-CRITIQUE.md`**, **`docs/EINSATZLEITUNG-ROLLEN-MANAGER-CRITIQUE.md`**, **`src/settlement-queue.ts`**, **`src/chain-access.ts`** (`mintMessengerCreditsBatchForRecipients`), **`src/api-server.ts`** (`POST /api/provision-device`), Roadmap **§ H.3f** / **§ H.3g**.

---

## Teil A: „Store-and-Forward“ (Boss/Relay offline, LoRa rein)

### Zielbild (verstanden)

Eingehende LoRa-/lokale Vorgänge sollen **nicht sofort** on-chain, sondern bei **fehlendem Internet** zwischengespeichert werden; sobald Verbindung steht, **nachziehen**.

### Kritischer Fehler in der naiven technischen Lösung

**Falsch:** Gespeicherte Transaktionen später mit **`mintMessengerCreditsBatchForRecipients`** „bündeln und pushen“.

**Warum falsch:** Diese Funktion **mintet Messenger-Credits-Objekte** für Empfänger-Adressen (Boss-signiert, festes Move-Entry) — sie ist **kein** generischer „Queue-Player“ für beliebige **TransactionBlock**-Entwürfe (Nachrichten, Handshakes, andere Calls). Missbrauch würde **falsche** On-Chain-Wirkung (Credits statt beabsichtigter Operation) oder kaputte PTBs riskieren.

**Richtiger Ansatz (konzeptionell):**

1. **Queue-Inhalt** eindeutig typisieren: z. B. `{ kind: 'use_ticket' | 'send_message' | …, payload … }` — **nicht** rohe PTB-Bytes ohne Version/Schema.
2. **Flush:** passende **`signAndExecute`**-Pfad pro Kind — analog zu bestehender **`settlement-queue.ts`** (JSONL, Worker, Batch-PTB für **Ticket-Settlement**).
3. **Watchdog:** Netzwerk-Check (Ping/RPC-Reachable) ist **unkritisch**; entscheidend sind **Idempotenz**, **Retry-Backoff**, **kein Doppel-Mint**.

### Was im Repo schon existiert

| Baustein | Rolle |
|----------|--------|
| **`settlement-queue.ts`** | Persistente **JSONL**-Queue, Intervall-Worker, **Batch** `batchUseTickets` — **Muster** für „später on-chain“, aber **nur** für Ticket-Use. |
| **`tiny-gateway.ts`** | Eigener Pfad Gateway/LoRa — nicht automatisch = „Boss-Offline-Queue für alles“. |
| **Messenger-PTB** | Diverse Entrypoints — eine **einzige** Flush-Funktion für „alles“ gibt es **nicht**. |

### Empfehlung

- **Neues** Modul z. B. `offline-relay-queue.ts` nach **Vorbild** Settlement-Queue: **Schema pro Operation**, **kein** Missbrauch von `mintMessengerCreditsBatchForRecipients`.
- **Credits** nur, wenn die **tatsächliche** ausstehende Operation ein **Credits-Mint** ist (selten in der gleichen Warteschlange wie LoRa-Nachrichten).

---

## Teil B: „Einsatz-Profil-Provisioning“ (`initialProfile` + IndexedDB)

### Zielbild (verstanden)

Bei **`POST /api/provision-device`** zusätzlich ein **JSON** (`initialProfile`: Kontakte + Rollen-Tags); **PWA** entpackt und schreibt in **IndexedDB**, Helfer sofort arbeitsfähig.

### Ist-Stand API

- **`/api/provision-device`** liefert u. a. `envContent`, `jsonConfig`, `qrPayload` — **kein** `initialProfile` (siehe **`api-server.ts`**).
- Kontakte im Messenger: **`/api/contact-labels`** (GET/POST), **serverseitige** Datei + Client-State — **nicht** standardmäßig **IndexedDB** im Next-Frontend (siehe Hooks `use-contact-directory`).

### Kritik / Verbesserung

1. **IndexedDB:** Aktuell **kein** zentrales „Telefonbuch in IndexedDB“ als Single Source — Einführung wäre **neues** Speichermodell + Sync mit API. Alternative: **`initialProfile`** beim ersten Start an **bestehende** API **`POST /api/contact-label`** (Schleife) oder **ein** Bulk-Endpoint — dann bleibt eine Quelle der Wahrheit.
2. **Vertrauen:** Unsigniertes JSON vom Boss-UI ist **OK** in geschlossenem Einsatz — für öffentliche Deployments **optional** signieren (Boss-Key) oder TLS-only.
3. **Bundle `Morgendrot-Messenger-verkauf`:** Enthält **`src/` + `ui/`** (Lite-UI), **kein** vollständiges Next-**`frontend/`** im Standard-Bundle (`bundle-messenger-standalone.ts`). „PWA“ im Kundenpaket = **vor allem Lite-UI**; Next-PWA ist **Hauptrepo**-Pfad — **zwei** Clients müssten ggf. **parallel** bedient werden.
4. **Rollen-Tags** („Einsatzleiter“): UI-Rolle kommt heute aus **`.env` / `ROLE`** — Profil-Tags wären **zusätzliche** Anzeige-Daten, keine Chain-Rolle ohne weiteres Move-Design (siehe **`docs/PROVISIONING-PAYLOAD-CRITIQUE.md`**).

### Empfehlung (gestuft)

| Stufe | Inhalt |
|-------|--------|
| **1** | `initialProfile` in **`provision-device`** optional; **Schema** (JSON Schema) + Max-Größe; Antwort enthält **`profileJson`** für Eintrag in **Export-ZIP** oder separater Datei neben `.env`. |
| **2** | Beim ersten Start (Lite-UI oder Next): **ein** Skript/Endpoint **`POST /api/contact-labels/bulk`** (intern) aus `initialProfile` — **IndexedDB** nur, wenn explizit gewünscht und offline-first spezifiziert. |
| **3** | Rollen-Tags nur als **Labels** im Kontaktverzeichnis, **nicht** als Ersatz für `ROLE` in der Chain-Hierarchie. |

---

## Bundle-Spiegelung (`exports/Morgendrot-Messenger-verkauf`)

**Quelle der Wahrheit:** das **Hauptrepo** (`src/`, `ui/`, …). Aktualisierung:

```bash
npm run bundle:messenger:sales
```

Manuelles Kopieren einzelner Dateien ist **fehleranfällig** — immer **Bundle-Skript** nutzen (siehe **`scripts/bundle-messenger-standalone.ts`**).

---

## Fahrplan

Kurz in **`docs/ROADMAP-FAHRPLAN.md` § H.3f`** ergänzt: Offline-Relay-Queue und Profil-Payload **nach** Klärung der **Queue-Semantik** (kein Credits-Mint-Fake) und **API-Schema**.

---

*Stand: Abgleich mit `settlement-queue.ts`, `chain-access.ts`, `api-server.ts` (`provision-device`), `bundle-messenger-standalone.ts`.*
