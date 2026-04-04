# Kritische Prüfung: Morgendrot-Vollzugsplan (Letzte Meile)

Bewertung der drei vorgeschlagenen Maßnahmen und was bereits existiert.

---

## 1. Locked-Corrections (Tag 1)

**Vorschlag:** `locked-corrections.jsonl` mit 17 Datensätzen, in `ai-copilot.ts` hart kodiert **immer** in den Prompt injizieren (unabhängig vom Such-Score). „Impfung gegen das Vergessen.“

### Was schon da ist
- **`ai-training/corrections.txt`** wird von `build-rag-chunks.ts` eingelesen und als Chunks mit **source: 'corrections'** in RAG geschrieben.
- In **`rag-retrieval.ts`** erhalten diese Chunks einen **CORRECTIONS_BOOST von 1.35** – sie werden bei der Vektorsuche stärker gewichtet, erscheinen aber nur, wenn sie unter die Top-K kommen.

### Kritik
| Punkt | Bewertung |
|-------|-----------|
| **Dopplung** | Wenn dieselben Inhalte **zusätzlich** fix im Prompt stehen und gleichzeitig über RAG kommen, doppelt sich Text → mehr Tokens, Risiko Widerspruch oder Redundanz. |
| **„17“** | Die Zahl ist willkürlich. `corrections.txt` wächst (derzeit ~17–20 relevante Zeilen). Ein „locked“-Set sollte ein **kleines, kuratiertes** Set sein (z. B. 5–10 „Goldene Regeln“), nicht 1:1 alle Zeilen aus corrections. |
| **Hart kodiert** | Pfad/Format in `ai-copilot.ts` fest zu verdrahten ist wartungsfeindlich. Besser: **eine Datei** (z. B. `locked-corrections.jsonl` oder ein Abschnitt in `corrections.txt`) lesen und **einmal** pro Anfrage als fester Block vor dem RAG-Text einfügen. |
| **Nutzen** | Ja: Regeln, die **niemals** vergessen werden dürfen (z. B. „Schritt 1: Package setzen → /set-package-id“, „Ticket an Adresse = /create-ticket mit recipient“), verdienen garantierte Präsenz im Prompt. |

### Empfehlung
- **Kern umsetzen:** Kleine, kuratierte Menge (z. B. 5–10 Einträge) aus `locked-corrections.jsonl` oder aus dem oberen Teil von `corrections.txt` **einmal** beim Aufbau des System-Prompts (vor RAG) einfügen.
- **Nicht:** Alle 17+ Zeilen aus corrections doppelt (RAG + Locked) reinziehen. Entweder „nur locked“ für die Top-Regeln oder RAG mit starkem Boost beibehalten und Locked auf echte Ausnahmen beschränken.
- **Format:** Eine Zeile pro Regel (z. B. `{ "input": "Schritt 1: Package setzen 0x…", "action": "/set-package-id" }` oder rein Text), Datei beim Start oder bei jeder Anfrage lesen (mit Cache), dann in `buildSystemPrompt()` oder direkt vor dem RAG-Block anhängen.

---

## 2. BM25-Turbo (Tag 2)

**Vorschlag:** Hybrid-Suche. BM25 (Keyword) als Vorauswahl; wenn Begriffe wie „Purge“ oder „IOTA“ vorkommen, passende Chunks nach oben. Erst wenn das fehlschlägt, Vektor-Embeddings.

### Was schon da ist
- **Nur Vektor-Retrieval** in `rag-retrieval.ts`: Embedding der Query via Ollama, Kosinus-Similarität mit Chunk-Embeddings, Top-K + optional 1-Hop.
- Kein BM25, keine Keyword-Suche, keine Hybrid-Logik.

### Kritik
| Punkt | Bewertung |
|-------|-----------|
| **Nutzen** | Hoch für stabile Trigger: „Purge“, „IOTA“, „Handshake“, „Ticket“ sind begriffsstark; BM25 kann solche Chunks zuverlässig nach oben bringen, auch wenn das Embedding sie verpasst. |
| **Aufwand** | Mittel: In Node gibt es **kein** BM25 in der Standard-API. Optionen: (a) schlanke Lib (z. B. `bm25` oder ähnlich) oder (b) einfache eigene Tokenisierung + TF/IDF-ähnlicher Score. Index: entweder beim **Build** (rag-chunks.json um Token-Listen erweitern) oder **zur Laufzeit** aus Chunk-Text. |
| **„Erst wenn das fehlschlägt“** | Formulierung ungenau. Typisch Hybrid: **BM25-Score und Vektor-Score kombinieren** (z. B. gewichtet addieren oder re-rank: BM25-Top-20, dann mit Vektor re-sortieren und Top-K nehmen). Ein reines „nur wenn BM25 fehlschlägt“ würde BM25 nur als Fallback nutzen – dann fehlt der Vorteil bei gemischten Anfragen. |
| **Token-Hygiene** | Chunks sind schon begrenzt (Top-K, ~1,5k Tokens). Hybrid ändert nur **welche** Chunks in die Top-K kommen, nicht die Obergrenze. |

### Empfehlung
- **Sinnvoll**, aber als **Hybrid** umsetzen: z. B. BM25-Score und Vektor-Score pro Chunk kombinieren (z. B. `0.4 * bm25_norm + 0.6 * cosine`), dann nach Gesamtscore sortieren und Top-K nehmen.
- **Implementierung:** (1) Beim RAG-Build oder beim ersten Laden: pro Chunk `text` tokenisieren (Split auf Leerzeichen/Zeichen, Stopwords optional), (2) bei Abfrage: BM25-Score für Query vs. alle Chunks (oder nur vs. eine Vorauswahl), (3) mit Vektor-Score fusionieren. Keine große neue Runtime-Dependency, wenn man eine minimale BM25-ähnliche Funktion selbst baut.
- **Priorität:** Nach Locked-Corrections; wenn die „Vergess“-Fälle damit schon abgedeckt sind, kann BM25 später kommen.

---

## 3. Todeszonen-Validierung (Tag 3)

**Vorschlag:** 20 kritische Tests (Race-Conditions, Gas-Logik); finaler Stress-Test; Ziel 137/137; fehlerhafter „Double-Purge“ oder unrentabler Rebate-Versuch muss von der KI mit „NEIN / Ökonomischer Warnhinweis“ abgelehnt werden.

### Was schon da ist
- **`run-ai-dangerous-tests.ts`:** Prüft, dass Formulierungen wie „lösche alles“, „purge all“ **nicht** zu `/emergency-purge` führen (Intent-Matcher + Copilot).
- **`run-stress-test.ts`:** Latenz/Last gegen `/api/status` und `/api/command` (p95, Fehlerrate).
- **`run-ai-dataset-scenarios.ts`:** 137 Szenarien aus `morgendrot-dataset.jsonl`; aktuell ~117 bestanden ohne Ollama, ~137 mit Ollama erreichbar, aber nicht garantiert.
- **Backend:** Purge/Rebate-Logik in `wallet-bridge.ts` und `chain-access.ts` (z. B. `purge-key`, `getMailboxRebateCandidates`); keine explizite „Double-Purge“- oder „Rebate-Ökonomie“-Prüfung in der KI.

### Kritik
| Punkt | Bewertung |
|-------|-----------|
| **137/137** | Realistisch nur **mit** Ollama und stabilem Modell. Ohne Ollama scheitern weiterhin Hilfe- und Ablauf-Szenarien (Intent-Matcher trifft sie nicht). Ziel „137/137“ also **kontextabhängig** (mit Ollama als Ziel formulierbar). |
| **20 kritische Tests** | Konkret unklar: Welche Race-Conditions, welche Gas-Logik? Vorschlag: Tests explizit definieren, z. B. „Doppelter purge-key für dieselbe ID“, „purge-handshake ohne MAILBOX_ID“, „purge-ticket für nicht-ownertes Ticket“, „Gas-Budget überschritten“. Das sind vor allem **Backend-/API-Tests** (erwarteter Fehler oder Ablehnung), plus wenige **KI-Tests** („User sagt: purge key 0x123 zweimal“ → KI soll zweites Mal ablehnen oder klären). |
| **KI: NEIN / Ökonomischer Warnhinweis** | Heute lehnt die KI nur indirekt ab (z. B. keine ACTION bei „lösche alles“). Eine explizite Regel „Bei erneutem Purge-Vorschlag für dieselbe ID: NEIN mit Hinweis“ oder „Rebate nur vorschlagen wenn ENABLE_PURGE und Objekt rebateable“ wäre **Prompt/RAG oder Intent-Matcher**. Sinnvoll, aber: (1) Doppel-Purge erfordert Kontext („gleiche ID wie zuvor“), also Konversation oder State. (2) „Unrentabler Rebate“ ist domänenspezifisch (Storage Rebate, Objekt-Ownership) – besser als **Backend-Validierung** (API gibt Fehler), KI kann dann Fehlermeldung erklären. |

### Empfehlung
- **20 kritische Tests:** Liste festlegen (z. B. 10 Backend: doppelter Purge, Purge ohne ID, Rebate ohne MAILBOX; 10 KI: gefährliche Phrasen, mehrdeutige Purge-Anfragen). Bestehende `run-ai-dangerous-tests` erweitern und neues Script `run-todeszonen-tests.ts` für Backend + KI.
- **137/137:** Als Ziel „mit Ollama“ setzen; ohne Ollama weiter 93–95 % als realistisch dokumentieren.
- **Double-Purge / Rebate-Warnung:** (a) **Backend:** Doppelter Aufruf purge-key für gleiche ID kann idempotent oder mit klarer Meldung „bereits gelöscht“ antworten. (b) **KI:** Im Prompt/RAG festhalten: „Purge nur mit konkreter Objekt-ID; bei unsicherer oder doppelter Aktion: NEIN oder Rückfrage.“ Todeszonen-Regeln in RAG oder in locked-corrections aufnehmen.

---

## Zusammenfassung

| Maßnahme | Sinnvoll? | Risiko / Aufwand | Priorität |
|----------|-----------|-------------------|-----------|
| **Locked-Corrections** | Ja, als **kleines** fixes Set | Dopplung mit RAG vermeiden; Format aus Datei, nicht hart 17 Zeilen im Code | 1 |
| **BM25-Turbo (Hybrid)** | Ja | Aufwand mittel (BM25 in Node); Klarstellung: Hybrid = Score-Fusion, nicht „nur Fallback“ | 2 |
| **Todeszonen-Validierung** | Ja, aber konkreter | 20 Tests definieren; 137/137 nur mit Ollama als Ziel; Double-Purge/Rebate teils Backend, teils KI-Prompt | 3 |

**Reihenfolge:** Zuerst Locked-Corrections (minimal, klare „Never forget“-Regeln), dann Todeszonen-Tests konkretisieren und erweitern, dann optional BM25-Hybrid für stabilere Keyword-Treffer.

---

## Umsetzungsstand (nach Vollzug)

| Maßnahme | Status | Umsetzung |
|----------|--------|-----------|
| **Tag 1 Locked-Corrections** | ✅ | `ai-training/locked-corrections.jsonl` (9 Regeln + 2 Todeszonen), `loadLockedCorrections()` in `ai-copilot.ts` vor RAG injiziert. |
| **Tag 2 BM25-Hybrid** | ✅ | `rag-retrieval.ts`: BM25-Score (tokenize, docFreq, bm25Score) + Normalisierung, Fusion 0.4×BM25 + 0.6×Cosine, dann Top-K. |
| **Tag 3 Todeszonen** | ✅ | `scripts/run-todeszonen-tests.ts` (20 Tests), `npm run test:todeszonen`; Todeszonen-Regeln in `locked-corrections.jsonl`; `npm run test:vollzugsplan-final` = Todeszonen + Dataset (Ziel 137/137 mit Ollama). |
