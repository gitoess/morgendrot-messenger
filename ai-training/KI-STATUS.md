# KI-Copilot: Was sie hat – was noch geht

## Aktuell gefüttert (Stand)

| Quelle | Inhalt | Wo |
|--------|--------|-----|
| **APPLICATION_KNOWLEDGE** | Architektur, 4 Säulen, alle Befehle, Config, Abläufe, Move, API, Kacheln, PTB | Immer im System-Prompt |
| **HELP_START / HELP_CHAT** | Befehlsliste Terminal/UI | System-Prompt |
| **logic-chains.json** | Wenn-Dann-Regeln (z. B. nach /handshake → /vault-save, bei Fehler X → Y) | System-Prompt |
| **Few-Shot (Dataset)** | 3 Beispiele Frage → Antwort inkl. ACTION-Zeile aus `morgendrot-dataset.jsonl` | System-Prompt |
| **Kontext (UI)** | MY_ADDRESS, PACKAGE_ID, connected, role, **lastCommandResult**, **lastError** | User-Nachricht |
| **RAG (wenn Embeddings)** | Top-K ähnliche Chunks + 1-Hop (referenzierte Chunks) zu jeder Frage | Block „RELEVANTE DOKU“ im System-Prompt |
| **RAG-Quellen** | application_knowledge, tools_schema, **corrections** (priorisiert), **code_structure**, **readme**, **docs** (ENV, CONFIG-REFERENCE, SCHLOSS, VAULT-EINRICHTEN, FAMILIEN-ZUGANG), execution_trace | rag-chunks.json |
| **Intent-Matcher** | Viele Phrasen → direkte ACTION ohne Ollama | Vor dem LLM-Aufruf |

**Priorisierung:** Chunks mit `source: "corrections"` werden bei der RAG-Suche stärker gewichtet (Score × 1,35). **Antwort-Regeln** im Prompt: eine ACTION-Zeile, Adressen 0x+64 Hex, bei „Letzter Fehler“ darauf eingehen, Reihenfolge Säule 1→2→Aktion. **Few-Shot:** 5 diverse Beispiele (create-key, handshake, transfer-coins, create-key-and-notify, Fehler/RPC). **Logic-Chains:** create-ticket→list-tickets, list-keys→purge-key (abgelaufene), list-tickets→purge-ticket, create-key→vault-save, send→fetch, Fehler Wallet/503. **Intent-Matcher:** „erste schritte“, „schnellstart“, „einrichtung“, „wie fange ich an“ → Kurztext Säule 1→2→3→4. **Few-Shot:** 7 Beispiele (inkl. vault-save, list-keys→purge).

---

## Optional noch besser

- **Mehr Few-Shot:** In `ai-copilot.ts` werden 3 Zeilen aus dem Dataset geladen. Du kannst die Zahl erhöhen oder gezielt Szenarien in `morgendrot-dataset.jsonl` nach oben packen, die die KI oft verwechselt.
- **Größeres Modell:** Standard ist qwen2.5-coder:1.5b; für mehr Folgerung z. B. qwen2.5-coder:7b oder phi3:mini – mehr Ressourcen.
- **Weitere Doku in RAG:** In `build-rag-chunks.ts` können weitere Dateien eingelesen werden (z. B. `docs/SCHLOSS-EINRICHTEN.md`, `docs/CONFIG-REFERENCE.md`), dann `npm run prepare:rag` (bzw. `build:rag-embeddings` wenn schon gechunkt).
- **Mehr Wenn-Dann-Regeln:** `ai-training/logic-chains.json` um weitere Einträge ergänzen (z. B. „nach /create-ticket → /list-tickets vorschlagen“).
- **Execution-Traces füllen:** Erfolgreiche Transaktionen aus dem Explorer in `execution-traces.jsonl` eintragen – die KI lernt aus echten Abläufen (RAG).

---

## Kurz: Ist die KI „vollständig“ gefüttert?

**Ja für den Alltag:** Sie hat die komplette App-Doku, Befehle, Kontext, Fehlerrückmeldung, Logik-Ketten, Beispiele und optional RAG (inkl. Code-Struktur, README, Korrekturen).  
**Verbesserungspotenzial:** Größeres Modell, mehr Doku in RAG, mehr Beispiele/Traces und Regeln – je nach Bedarf.
