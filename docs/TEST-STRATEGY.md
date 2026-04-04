# Test-Strategie: 5 Säulen

Übersicht, wie die fünf Test-Säulen im Projekt abgedeckt sind.

---

## 1. Unit-Tests (Der Code-Check)

**Prüfung einzelner Funktionen in Isolation (ohne echte Chain).**

| Was | Status | Wo |
|-----|--------|-----|
| IOTA/Nanos-Umrechnung (iotaToMist, mistToDisplayIota, DE/EN) | ✅ | `npm run test` → chain-access (IOTA/MIST + Anzeige) |
| Vault: Roundtrip encrypt/decrypt, kurzes Payload abgelehnt | ✅ | `npm run test` → vault-local |
| **Vault: falsches Passwort abgelehnt** | ✅ | `npm run test` → decryptPayloadToUtf8 rejects wrong password |
| Crypto ECDH + AES-GCM Roundtrip | ✅ | `npm run test` → crypto-layer |
| Replay-State (monoton, pro Sender) | ✅ | `npm run test` → replay-state |
| Adress-Validierung (assertSafeAddress) | ✅ | `npm run test` + `npm run test:security` |
| Config: Maskierung, Blocklist (OPEN_COMMAND etc.) | ✅ | `npm run test` → config |

**Ziel:** Logik im Node.js-Code fehlerfrei. **Ausführung:** `npm run test`, `npm run test:security`.

---

## 2. Move-Smart-Contract-Tests (On-Chain-Sicherheit)

**Integriertes Test-Framework: `iota move test`.**

| Was | Status | Wo |
|-----|--------|-----|
| Framework eingebunden | ✅ | `npm run test:move` → `cd move-test && iota move test` |
| Tests in messaging.move (z. B. Berechtigung AccessKey, expires_at) | ⚠️ **0 Tests** | In `move-test/sources/messaging.move` sind aktuell keine `#[test]`-Funktionen. |

**Empfehlung:** In `messaging.move` oder einem Test-Modul `#[test]`-Funktionen ergänzen, z. B.:
- Nur Lock/Issuer darf AccessKey ausstellen; Adresse ohne Berechtigung kann keinen Key löschen.
- expires_at: Nach Ablauf kann nur noch purge (nicht mehr „open“).

**Ziel:** On-Chain-Logik formal prüfbar. **Ausführung:** `npm run test:move` (IOTA-CLI nötig).

---

## 3. Integration-Tests (Zusammenspiel App ↔ Chain)

**Test des Weges von der App bis zur Chain (Testnet).**

| Was | Status | Wo |
|-----|--------|-----|
| GET/POST Endpoints, alle Commands | ✅ | `npm run test:all-projects` (API_BASE), `npm run test:all-tiles` |
| Handshake senden, Connect, Nachricht an Partner | ✅ | `npm run test:messages`, `npm run test:scenarios` |
| Ticket/AccessKey-Flow (create, list, purge) | ✅ | `npm run test:tickets-keys`, `npm run test:realworld` |
| Kacheln (9 Tiles) mit 2 Wallets | ✅ | `npm run test:kacheln`, `npm run test:all-tiles` |
| Boss → Kommandant → Arbeiter (Nachricht) | ✅ | `npm run test:scenarios` |
| „Klick Senden → Event im Explorer“ | ✅ | Manuell / Staging; gleicher Pfad wie test:messages (Send + Fetch) |

**Voraussetzung:** Laufende Instanzen, Testnet, ggf. zwei Wallets. **Ziel:** Kommunikation Dashboard ↔ API ↔ Chain stabil.

---

## 4. KI-Validierung (Intent + RAG, Gehirn-TÜV)

**Intent-Map und RAG: richtiger Befehl, keine gefährlichen Halluzinationen.**

| Was | Status | Wo |
|-----|--------|-----|
| 50+ Befehle/Phrasen (Coverage) | ✅ | `npm run test:ai-coverage` |
| 100+ natürliche Sätze (DE/EN) | ✅ | `npm run test:ai-natural` |
| RAG-Retrieval (cosine, load, retrieve) | ✅ | `npm run test:rag` |
| POST /api/ai-copilot Vertrag | ✅ | `npm run test:ai-copilot-api` |
| **Gefährliche Formulierungen → kein gefährlicher Befehl** | ✅ | `npm run test:ai-dangerous` (siehe unten) |

**Negativ-Tests („Gehirn-TÜV“):** Formulierungen wie „lösche alles“, „purge all“, „alle Keys löschen“ (ohne Objekt-ID) dürfen **nicht** zu `/emergency-purge` oder einem pauschalen Purge führen. Stattdessen: null, Hilfe oder konkrete Anleitung (z. B. /list-keys dann /purge-key mit ID).

**Ziel:** KI schlägt niemals versehentlich einen gefährlichen Befehl vor. **Ausführung:** `npm run test:ai-coverage`, `npm run test:ai-natural`, `npm run test:ai-dangerous`.

---

## 5. Hardware- & Stresstests (Resilience)

**Ausfallsicherheit, Last, Offline-Verhalten.**

| Was | Status | Wo |
|-----|--------|-----|
| API unter Last (Status + Command) | ✅ | `npm run test:stress` (p95, Fehlerrate) |
| **Internet/Chain 30 s weg** | ⚠️ Manuell | Kein autom. Test; siehe TESTING.md „Resilience“. |
| **Schloss öffnet via Cache, wenn Chain nicht erreichbar** | ⚠️ Manuell | OFFLINE_OPEN_ENABLED + Cache; Verhalten im Log prüfen. |

**Manuell prüfbar:**
- Chain aus (RPC nicht erreichbar): Listener/API antworten definiert (z. B. „Kette nicht erreichbar“), kein Absturz.
- Lock mit OFFLINE_OPEN_ENABLED: Bei vorher gecachtem AccessKey kann „open“ auch ohne Chain ausgeführt werden (Cache).

**Ziel:** System friert nicht ein; Offline-Cache wie spezifiziert. **Ausführung:** `npm run test:stress`; Resilience manuell oder in Staging.

---

## Randfälle: RAG/Kontext & Zahlungs-Timing

### 1. „Gedächtnis-Stau“ (RAG-/Kontext-Überlastung)

**Szenario:** Nachrichten-Verlauf (Säule 3) wächst auf z. B. 10.000 Nachrichten. Würde die KI den gesamten Verlauf ins Kontext-Fenster laden, wird sie langsam oder „vergisst“ den Anfang (z. B. Handshake).

**Aktueller Stand:** Die KI bekommt **keinen** kompletten Chat-Verlauf. Pro Anfrage werden nur die **aktuelle Nutzerfrage** und ein kurzer **Kontext** (MY_ADDRESS, PACKAGE_ID, connected, role, lastCommandResult, lastError) an Ollama geschickt. RAG liefert nur die Top-Chunks zur Frage (begrenzt, z. B. 6000 Zeichen). Ein Verlauf mit 10.000 Nachrichten wird also **nicht** en bloc an die KI übergeben.

**Falls später** ein „Konversations-Verlauf“ an die KI übergeben wird: **Rolling Window** verwenden (nur die letzten N Nachrichten, z. B. 20) oder einen **Summarizer** (alte Nachrichten gekürzt zusammenfassen). In `src/ai-copilot.ts` ist dafür vorbereitet: Kontext enthält nur `lastCommandResult`/`lastError`, kein `messageHistory`. Sollte `messageHistory` ergänzt werden, auf z. B. **20 Einträge** begrenzen (Konstante/Config).

---

### 2. Zahlungs-Timing (Asynchronität, Doppelbuchung)

**Szenario:** Nutzer sendet IOTA, die RPC-Node antwortet 10 Sekunden verzögert. Die Wallet zeigt „Geld weg“, das Dashboard noch „Warte auf Zahlung“. Nutzer klickt erneut auf Senden → Risiko Doppel-OPEN.

**Lösung (bereits umgesetzt):** **Idempotenz** über `PAYMENT_TRIGGER_STATE_FILE`. Jede verarbeitete Zahlung wird anhand eines **Digests** (TX-Referenz) in einer Datei geführt. Beim Polling gilt: `if (processed.has(digest)) continue;` – bereits bekannte Zahlungen werden **nicht** erneut ausgelöst. Keine Doppelbuchung, auch wenn die gleiche Zahlung mehrfach in der Abfrage erscheint oder der Nutzer zweimal zahlt, weil die Anzeige verzögert ist.

**Konfiguration:** `PAYMENT_TRIGGER_STATE_FILE` setzen (z. B. `./payment-trigger-state.txt`), damit die verarbeiteten Digests persistent sind und nach Neustart weiter gelten.
