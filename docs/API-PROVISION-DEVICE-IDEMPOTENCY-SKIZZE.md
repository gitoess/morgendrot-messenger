# Skizze: `POST /api/provision-device` — Doppel-POST & Idempotenz-Key

**Status:** **Umgesetzt (Kern)** — **`src/provision-idempotency-state.ts`**, eingebunden in **`POST /api/provision-device`** (`src/api-server.ts`); Boss-**Lite-UI** sendet **`Idempotency-Key`**. Details/Erweiterungen: **`docs/CODE-SCHLANKHEIT-UND-HAERTUNGS-PRIORITAET.md`** (§ **H.13**).

**Verknüpft:** **`docs/API-INITIAL-PROFILE.md`**, **`docs/BOSS-ORIENTIERUNG.md`**, **`docs/SYNC-SOURCE-OF-TRUTH-UND-KONFLIKTE.md`**, **`src/config.ts`** (`assignDeviceRoleInEnv`, `generateDeviceSecret`).

---

## 1. Problem (Ist-Zustand)

`POST /api/provision-device` ist **kein** Chain-Mint, aber **nicht** frei von Nebenwirkungen und **nicht** trivial bei Wiederholung:

| Risiko | Kurz |
|--------|------|
| **Doppelklick / Retry** | Client sendet denselben Wizard-Stand **zweimal** — ohne Key ist jede Antwort eine **neue** Berechnung. |
| **`deviceSecret` / Tiny** | Bei `generateDeviceSecret: true` erzeugt jeder Aufruf **`generateDeviceSecret()`** neu — zweiter POST **invalidiert** den ersten Secret im Kopf des Operators, falls der erste Response verloren ging. |
| **`assignDeviceRoleInEnv`** | Schreibt **Boss-`.env`** (Listen + `DEVICE_ROLES`). Wiederholung mit **gleichem** `(address, role)` ist **zustandsmäßig** weitgehend **deckungsgleich**; Wechsel der Rolle im zweiten POST ist **Absicht**, kein „Retry“. |
| **Keine IOTA-TX pro Klick** | Trotzdem können **andere** Flows (z. B. spätere Erweiterungen, externe Hooks) angebunden sein — Idempotenz-Disziplin **jetzt** verhindert Überraschungen. |

---

## 2. Ziel

- **Optionaler Idempotenz-Key** pro logischem „einmal dieses Gerät provisionieren“-Vorgang.
- **Wiederholung** mit **gleichem Key + gleichem canonischen Request**: **dieselbe** Antwort wie beim ersten Erfolg (**HTTP 200**, gleiche JSON-Payload), **ohne** neue Geheimnisse.
- **Gleicher Key, anderer Body**: **HTTP 409** mit klarer Fehlermeldung (Key bereits mit anderem Payload verbraucht).
- **Ohne Key**: bisheriges Verhalten (**best effort**) beibehalten oder in Doku als **„nicht idempotent“** kennzeichnen — Empfehlung: Boss-UI sendet **immer** Key, sobald implementiert.

---

## 3. API-Oberfläche (Vorschlag)

### 3.1 Key liefern (eine Variante wählen, nicht mischen ohne Absprache)

| Ort | Format | Länge |
|-----|--------|-------|
| **Header** `Idempotency-Key` | opaque string (z. B. UUID v4) | z. B. 8–128 sichtbare Zeichen, trim |
| **oder** JSON-Feld **`idempotencyKey`** | gleiche Semantik wie Header | gleich |

**Priorität (Vorschlag):** Wenn beides gesetzt ist und **nicht** identisch → **400** `idempotencyKey mismatch header vs body`.

**Zeichen:** Nur **ASCII** empfohlen (`[A-Za-z0-9._-]+`), um Encoding-Streit zu vermeiden.

### 3.2 Canonischer Request-Fingerprint

Für „ist es derselbe Retry?“ den **relevanten** JSON-Body **kanonisieren** und hashen:

1. JSON parsen.
2. **`idempotencyKey`** (falls nur im Body) für den Fingerprint **entfernen** (oder: Key nur aus Header, Body-Feld ignorieren für Hash).
3. **Sortierte** Objektschlüssel, Arrays in **fester** Reihenfolge (wie gesendet oder nach Spez-Sortierung — festlegen und testen).
4. Optional: **Normalisierung** von Booleans/Zahlen (`"true"` vs `true` — besser: Server validiert ohnehin und speichert Fingerprint **nach** Validierung aus **normalisiertem** Objekt).

Speichern: `sha256(canonicalUtf8)` → **`requestFingerprint`**.

### 3.3 Gespeicherter Erfolgs-Datensatz (pro Key)

Nach **erstem** erfolgreichen Lauf (200):

| Feld | Inhalt |
|------|--------|
| `idempotencyKey` | wie übergeben |
| `requestFingerprint` | Hash des kanonischen Requests |
| `status` | `completed` |
| `completedAt` | ISO-Zeit |
| `responseJson` | **exakt** die gesendete Erfolgs-Payload (`envContent`, `jsonConfig`, `qrPayload`, `initialProfile`, `deviceSecretForGateway`, …) |

**Persistenz:** kleine JSON-Datei auf dem Boss-Rechner (analog **`voucher-claim-state.ts`**: Mutex + eine Datei unter Projektroot), z. B. `.morgendrot-provision-idempotency.json` — **nur Hashes/Keys** in Logs, **keine** Mnemonics speichern (Response enthält ggf. sensible Strings → Datei **chmod**/Hinweis in Doku wie bei Exporten).

**TTL (optional):** z. B. 30 Tage Einträge verfallen lassen, danach Key wiederverwendbar — explizit dokumentieren, sonst „für immer“ bis manuell purge.

### 3.4 Handler-Logik (Ablauf)

1. Key **abwesend** → heutige Logik (**kein** Lookup).
2. Key **vorhanden**:
   - Kein Eintrag → verarbeiten wie heute; bei **200** Eintrag schreiben.
   - Eintrag mit **gleichem** `requestFingerprint` → **200** mit gespeichertem `responseJson` (**kein** erneutes `generateDeviceSecret`, **kein** erneutes Schreiben der `.env` für rein idempotenten Replay — siehe 3.5).
   - Eintrag mit **anderem** Fingerprint → **409** `{ ok: false, error: '…', code: 'IDEMPOTENCY_KEY_REUSE' }`.

### 3.5 Nebenwirkungen beim Replay

- **Ideal:** Beim **Cache-Hit** **keine** erneute **`assignDeviceRoleInEnv`**-Schreibzyklen (vermeidet unnötige `.env`-Touches und Race mit parallelen Edits).
- **Minimal-Variante (MVP):** Replay liefert nur identische JSON; Nebenwirkungen **noch einmal** ausführen — **schlechter**, aber einfacher; für Doppelklick meist harmlos, wenn `assignDeviceRoleInEnv` idempotent bleibt. **Tiny-Secret** darf im MVP **nicht** neu erzeugt werden → Caching **Pflicht**, sobald `deviceSecretForGateway` vorkommt.

---

## 4. Antwort-Erweiterungen (optional, für Clients)

| Feld | Bedeutung |
|------|-----------|
| `idempotentReplay: true` | Antwort aus Cache (nur bei Key + Treffer) |
| `provisionRequestId` | serverseitig vergebene UUID pro **echter** Ausführung (nicht pro Replay) — für Support-Logs |

---

## 5. Was **kein** Idempotenz-Key ersetzt

- **Fachliche** Korrektheit von `initialProfile`, Rollen, Tickets — bleibt Validierung wie in **`src/initial-profile-provision.ts`**.
- **On-Chain**-Idempotenz (Credits, Mint) — eigene Regeln; dieser Key gilt **diesem HTTP-Vorgang** „ein Paket erzeugen“.

---

## 6. Testfälle (kurz)

1. Zwei POSTs, **gleicher** Key, **byte-identischer** Body → zweimal **200**, gleiche `envContent` / gleiches `deviceSecretForGateway`.
2. Gleicher Key, **geänderter** `role` oder `address` → zweiter **409**.
3. Tiny mit `generateDeviceSecret: true`, nur erster Response gespeichert → zweiter mit Key liefert **denselben** Secret.
4. Ohne Key → zweimal POST können **zwei** Secrets erzeugen (**Dokumentiertes** Risiko bis UI-Key Pflicht).

---

## 7. Umsetzung (Ist)

- **`src/provision-idempotency-state.ts`** — Mutex, Datei **`.morgendrot-provision-idempotency.json`** (in **`.gitignore`**), TTL **30 Tage**, Fingerprint = SHA-256 über **kanonisches JSON** ohne Top-Level-`idempotencyKey`.
- **`api-server.ts`** — nach Parse: Replay **200** + `idempotentReplay: true`; Konflikt **409** + `code: IDEMPOTENCY_KEY_REUSE`; bei Erfolg Speichern vor Antwort (innerhalb desselben Locks).
- **`ui/index.html`** — `provIdempotencyKey` bei Schritt 1→2 gesetzt, bei 2→1 geleert, bei 3→2 rotiert; **`provisionGenerate`** setzt Header **`Idempotency-Key`**.

---

*Stand: 2026-03-28 (Implementierung ergänzt)*
