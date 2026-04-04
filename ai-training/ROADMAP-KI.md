# KI-Roadmap: Sinn-Check & Automatisierung

## Macht das Sinn? – Kurzbewertung

### 1. Deep Code Indexing (Struktur-Wissen) ✅ Sinnvoll

- **Problem:** Flacher RAG sucht nur nach Wörtern. Code ist ein Graph: Move-Contract → Chain-Access → wallet-bridge → UI.
- **Lösung:** Chunks mit **Metadaten** (Dateipfad, Funktionsname, `dependsOn`, `usedBy`). Bei „Was passiert bei Fehler in der Gas-Station?“ folgt die KI dem Pfad: `gas-station.ts` → `runGasStationCheck` → `transferCoins` → Move/Config.
- **Aufwand:** Mittel. Beim Chunk-Build müssen Quellen (z. B. `src/gas-station.ts`, `move-test/sources/messaging.move`) geparst und Kanten (Funktion X ruft Y, Modul A importiert B) extrahiert werden. Optional: kleines Graph-Schema (Knoten = Chunk/Modul, Kanten = Abhängigkeiten) für Graph-RAG.

### 2. Chain of Thought / Wenn-Dann-Ketten ✅ Sinnvoll

- **Idee:** Training auf logischen Pfaden („Wenn /open → AUTHORIZED_SENDERS prüfen → PTB → danach /purge vorschlagen“). Die KI wird zum Architekten und schlägt proaktiv vor (z. B. „Handshake gemacht, Vault noch nicht gespeichert – soll ich /vault-save vorschlagen?“).
- **Umsetzung:** Bereits angelegt: Modelfile + 50 Szenarien (Säule 1→2→3→4, PTB-Regeln). Erweiterbar um explizite Wenn-Dann-JSONL-Zeilen (z. B. `{"if": "user did /handshake", "then_suggest": "/vault-save", "reason": "Keys lokal sichern"}`) und/oder System-Prompt-Erweiterung.

### 3. Agentic / „Terminal-Auge“ ✅ Sinnvoll, aber sicherheitskritisch

- **Feature:** KI liest Fehlermeldungen (z. B. „Insufficient Gas“), sucht im Code (z. B. GAS_BUDGET Zeile 42) und schlägt konkrete Korrektur vor („Soll ich auf 0.02 IOTA erhöhen?“).
- **Wert:** Self-Healing-Erlebnis. **Risiko:** KI darf nur **lesen** (Logs, Explorer, Dateien), keine automatische Code-/Config-Änderung ohne User-Bestätigung. Automatische Ausführung von Befehlen nur, wenn explizit gewünscht (z. B. „KI darf Korrektur anwenden“-Checkbox).

### 4. Graph-RAG ✅ Sinnvoll (nächste Stufe nach flachem RAG)

- **Idee:** Chunks nicht nur als Zettel, sondern mit Kanten („Funktion A in Move erzeugt Objekt B → in Säule 3 angezeigt → in Säule 4 /purge-key“). Bei Änderung in Move warnt die KI: „Achtung, das bricht Anzeige in Säule 3.“
- **Umsetzung:** Nach dem ersten RAG-Betrieb: Chunk-Metadaten um `references`/`affectedBy` erweitern; Abfrage „expandiert“ gefundene Chunks entlang der Kanten (Multi-Hop). Optional: Neo4j/Compose für echten Graph.

### 5. Autonomous Agentic Loops / Self-Healing ⚠️ Sinnvoll mit klaren Grenzen

- **Prozess:** KI schlägt /handshake vor → System führt aus → Fehler (z. B. ObjectNotFound) → KI liest Fehler und schlägt korrigierten Befehl vor (ohne erneute User-Frage).
- **Wert:** Weniger Rückfragen. **Grenze:** Nur für klar definierte Fehlerklassen (z. B. „ObjectNotFound → /connect noch nicht?“). Keine automatische Änderung von .env oder Code ohne Opt-in.

### 6. Fine-Tuning auf Execution Trace ✅ Sehr sinnvoll

- **Idee:** KI lernt aus **echten** Transaktionen (z. B. B4JV… aus dem Explorer): So sieht eine erfolgreiche PTB-Transaktion aus, typische Fehler, Gas-Werte.
- **Effekt:** Antworten passen zur echten Projekt-Historie, nicht zu generischen Beispielen. Umsetzung: Export von Explorer-Logs (oder API) → Bereinigung → JSONL für Instruction-Tuning oder als Few-Shot-Beispiele im Prompt.

### 7. Feedback-Schleife (corrections.txt) ✅ Sinnvoll und gut automatisierbar

- **Ablauf:** Bei falscher KI-Antwort speichert die UI (oder ein „Korrektur“-Button) die Korrektur in `ai-training/corrections.txt` (oder JSONL). Beim nächsten `npm run build:rag-chunks` werden diese Einträge **priorisiert** (z. B. als eigene Chunks mit `source: "corrections"` und höherem Gewicht bei der Suche, oder als Zusatz zum System-Prompt).
- **Effekt:** Die KI wird mit der Zeit projektspezifisch korrekter.

---

## Zusammenfassung

| Stufe | Kurz | Sinn | Aufwand |
|-------|-----|-----|--------|
| RAG (Doku) | Sie weiß alles | ✅ | Gering (bereits vorbereitet) |
| Metadaten / Deep Code | Datei, Funktion, Abhängigkeiten | ✅ | Mittel |
| Chain of Thought | Wenn-Dann, 13 Schritte | ✅ | Teilweise im Modelfile/Dataset |
| Graph-RAG | Chunks mit Kanten | ✅ | Mittel–hoch |
| Agentic (Logs lesen) | Terminal-Auge | ✅ | Mittel, Lesen nur |
| Self-Healing-Loop | KI korrigiert nach Fehler | ✅ mit Grenzen | Mittel |
| Trace-Training | Echte TX-Logs | ✅ | Mittel |
| corrections.txt | Feedback-Schleife | ✅ | Gering |

**„RAG = Wissen, Logik-Pfade = Verstand, Log-Zugriff = Augen, Trace = Beherrschung“** – treffend. Nächste sinnvolle Schritte: (1) RAG mit Metadaten + optional corrections priorisieren, (2) Wenn-Dann-Regeln im Modelfile/Dataset ausbauen, (3) Log-/Explorer-Lesezugriff für die KI (read-only) vorschlagen.

---

## Automatisierung: RAG-Chunks erneut bauen

- **Bereits möglich:** `npm run build:rag-chunks` (manuell).
- **Automatisch beim Dev-Start:** Siehe unten (Integration in `dev`-Script).
- **Mit Korrekturen:** `build-rag-chunks.ts` liest `ai-training/corrections.txt` (falls vorhanden) und hängt jede Zeile als Chunk mit `source: "corrections"` an. Format: eine Zeile pro Korrektur, z. B. `Frage oder falsche Annahme | richtige Antwort` (Pipe als Trenner). Zeilen mit `#` werden ignoriert. Bei der Suche können diese Chunks später höher gewichtet werden.

---

## Umgesetzt (Stand Implementierung)

- **Deep Code Indexing:** Chunks haben Metadaten `file`, `function`, `references`. `scripts/build-rag-chunks.ts` erzeugt zusätzlich `code_structure`-Chunks aus `src/wallet-bridge.ts`, `chain-access.ts`, `api-server.ts`, `ai-copilot.ts`, `ai-intent-matcher.ts`, `gas-station.ts` (Dateipfad + Funktionsnamen + Referenzen auf andere Module).
- **Chain of Thought:** `ai-training/logic-chains.json` mit Wenn-Dann- und Bei-Fehler-Regeln. Wird beim Start in den System-Prompt des AI-Copilots geladen („WENN-DANN-REGELN“).
- **Agentic (Terminal-Auge):** Kontext `lastCommandResult` und `lastError` – die UI sendet das Resultat/den Fehler des zuletzt ausgeführten Befehls an `/api/ai-copilot`; die KI bekommt „Resultat des letzten Befehls“ und „Letzter Fehler“ im Prompt und kann konkrete Korrekturen vorschlagen.
- **Execution-Trace:** Optional `ai-training/execution-traces.jsonl` (eine JSON-Zeile pro TX mit `txId`, `summary`, `outcome`) wird beim Build als Chunks `source: "execution_trace"` eingelesen.
- **Graph-RAG (Datenmodell):** Chunk-Typ hat `references?: string[]`; Code-Struktur-Chunks verlinken auf andere Module. 1-Hop-Erweiterung bei der Abfrage bleibt optional (wenn RAG-Retrieval eingebaut wird).
