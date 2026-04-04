# RAG-Setup (Langzeitgedächtnis) – konkrete Schritte

RAG = Retrieval-Augmented Generation: Doku/Code in Vektoren speichern, bei jeder Anfrage die relevanten Abschnitte suchen und in den Prompt einbauen.

---

## 1. Dokumentenquelle

- **Primär:** `src/ai-copilot-context.ts` → `APPLICATION_KNOWLEDGE` (ein großer String).
- **Zusätzlich:** `ai-training/tools-schema.md`, `README.md` (13 Schritte, Befehle), ggf. `docs/*.md`.
- **Chunks:** Abschnitte nach Überschriften oder feste Länge (z. B. 300–600 Zeichen) mit Überlappung.

**Code-Zusammenfassung (Repomix-Taktik):** Damit die KI das ganze Projekt auf einmal sieht (Importe, Abhängigkeiten), eine einzige strukturierte Textdatei erzeugen und in den RAG-Build füttern:
1. `npx repomix` (oder `repomix` nach Anleitung des Tools) – packt das Repo (.ts, .move, .md, .json, …) in eine Datei.
2. Output als `codebase.md` im Projektroot oder unter `ai-training/codebase.md` ablegen.
3. `npm run build:rag-chunks` ausführen – die Chunks aus `codebase.md` (source: `codebase`) werden automatisch eingebaut.
4. Optional: `npm run build:rag-embeddings` für Embeddings.
Die KI sieht dann die Code-Zusammenfassung über RAG und kann Importe/Abhängigkeiten mit den 4 Säulen verknüpfen.

---

## 2. Embeddings erzeugen

**Option A: Ollama (integriert)**

```bash
ollama run nomic-embed-text   # einmalig Modell laden
npm run build:rag-embeddings  # berechnet Embeddings für alle Chunks, schreibt rag-chunks.json zurück
```

- Verwendet `OLLAMA_URL` und `RAG_EMBEDDING_MODEL` (Default: nomic-embed-text).
- Ollama-API: `POST /api/embed` mit `{ "model": "nomic-embed-text", "input": "<text>" }`.
- Chunks ohne `embedding` werden ergänzt; bestehende bleiben unverändert.

**Option B: Externer Embedding-Service**

- Eigenes Skript: Chunk → OpenAI/Cohere/Sentence-Transformers → `embedding` in `rag-chunks.json` schreiben (gleiches JSON-Format).

---

## 3. Vektorspeicher

**Einfach (ohne DB):**

- Datei `rag-chunks.json`: `[{ "id": "1", "text": "...", "embedding": [...] }, ...]`
- Bei Abfrage: Embedding der Frage berechnen, Kosinus-Ähnlichkeit zu allen Chunks, Top-K (z. B. 5) auswählen.

**Mit Datenbank:**

- **pgvector** (PostgreSQL): Tabelle `doc_chunks(id, source, text, embedding vector(768))`, Index für ANN-Suche.
- **Chroma / LanceDB / Qdrant**: Lokal, gut für Prototypen.

---

## 4. Abfrage-Flow (implementiert)

1. **Nutzerfrage** an `POST /api/ai-copilot` (wie bisher).
2. **RAG (wenn aktiv):** `src/rag-retrieval.ts` lädt Chunks aus `ai-training/rag-chunks.json` (nur Chunks mit `embedding`). Frage wird per Ollama `/api/embed` embeddet, Kosinus-Similarität zu allen Chunks, **Top-K** (Config: `RAG_TOP_K`, Default 5).
3. **1-Hop (Graph-RAG):** Zu den Top-K-Chunks werden alle **referenzierten** Chunks (`references`) hinzugefügt (bis `RAG_EXPAND_REFERENCES`, Default an). So fließt Kontext aus verknüpften Modulen (z. B. wallet-bridge → chain-access) mit ein.
4. **Prompt:** System-Prompt + Block „RELEVANTE DOKU (RAG)“ mit den gefundenen Chunk-Texten (max. 6000 Zeichen) + Nutzerfrage.
5. **LLM:** Ollama Chat wie bisher. RAG ist optional; wenn keine Chunks mit Embeddings vorhanden sind, läuft der Copilot ohne RAG.

---

## 5. Integration in Morgendrot (umgesetzt)

- **Kein separater Endpoint:** RAG läuft automatisch in `askAiCopilot`, wenn `ai-training/rag-chunks.json` existiert und mindestens ein Chunk ein Feld `embedding` hat.
- **Config:** `.env` optional: `RAG_EMBEDDING_MODEL=nomic-embed-text`, `RAG_TOP_K=3` (Default, Token-Hygiene; bei Bedarf 5 oder 7), `RAG_EXPAND_REFERENCES=true`.
- **Status:** `GET /api/ai-options` enthält `ragAvailable: true/false`.

---

## 6. Chunk-Skript (Vorstufe)

Ein kleines Skript kann:

1. `APPLICATION_KNOWLEDGE` nach `---` oder Zeilenumbrüchen in Abschnitte zerlegen.
2. Jeden Abschnitt als Chunk mit `id` und `text` in `ai-training/rag-chunks.json` schreiben (ohne Embeddings).
3. Später: separates Skript oder Build-Step ruft Ollama/API pro Chunk auf und fügt `embedding` hinzu.

**Automatisierung**

- `npm run build:rag-chunks` erzeugt `ai-training/rag-chunks.json` (inkl. Chunks aus `APPLICATION_KNOWLEDGE`, `tools-schema.md` und optional `corrections.txt`).
- Beim **Dev-Start** werden die RAG-Chunks automatisch neu gebaut (`npm run dev` führt `build:rag-chunks` aus).
- **Feedback-Schleife:** Lege `ai-training/corrections.txt` an – eine Zeile pro Korrektur im Format `Frage oder falsche Annahme | richtige Antwort`. Zeilen mit `#` sind Kommentare. Nach Änderung: `npm run build:rag-chunks` und `npm run build:rag-embeddings` (damit die Korrektur in RAG und bei der Suche priorisiert wird).
- **Deep Code / Graph:** Chunks haben optional `file`, `function`, `references` (siehe `code_structure`-Chunks aus `src/*.ts`). Optional: `ai-training/execution-traces.jsonl` – eine JSON-Zeile pro Transaktion, z. B. `{"txId":"0x…","summary":"/handshake + /vault-save","outcome":"success"}`. Werden als Chunks `source: "execution_trace"` eingebaut.

### Alles automatisch (empfohlen)

**Ein Befehl:** `npm run dev`  
– Baut Doku, UI, Modelfile, **RAG-Chunks** und versucht **Embeddings** (wenn Ollama läuft).  
– Ist Ollama nicht erreichbar: App startet trotzdem, RAG läuft dann ohne Embeddings.

Optional für RAG mit Embeddings: einmal `ollama run nomic-embed-text` (Modell laden), danach reicht wieder nur `npm run dev`.

### Manuell (optional)

| Befehl | Bedeutung |
|--------|-----------|
| **`npm run prepare:rag`** | Chunks bauen + Embeddings (wie bei dev, ohne App zu starten). |
| **`npm run build:rag-chunks`** | Nur Chunks bauen (z. B. nach Änderung an corrections.txt). |
| **`npm run build:rag-embeddings`** | Nur Embeddings nachziehen (Ollama muss laufen). |
| **`ollama run nomic-embed-text`** | Embed-Modell einmalig laden. |

---

## 7. Checkliste

| Schritt | Status | Hinweis |
|--------|--------|--------|
| Dokumentenquelle definieren | ✅ | APPLICATION_KNOWLEDGE, tools-schema, corrections, code_structure, execution_trace |
| Chunking | ✅ | build-rag-chunks.ts |
| Embedding-Modell | ✅ | Ollama nomic-embed-text, build:rag-embeddings |
| Chunks + Embeddings speichern | ✅ | rag-chunks.json mit Feld `embedding` |
| Abfrage: Frage → Embedding → Suche | ✅ | rag-retrieval.ts, Kosinus, Top-K |
| 1-Hop (Graph) | ✅ | expandWithReferences in rag-retrieval |
| Prompt = System + RAG-Chunks + Frage | ✅ | ai-copilot.ts |
| End-to-End testen | ✅ | „Wie lösche ich alte Keys?“ → RAG liefert relevante Chunks, Copilot antwortet |

Mit diesem Aufbau kannst du RAG schrittweise einbauen, ohne die bestehende KI-Architektur zu ersetzen.

---

## 8. KI weiter verbessern

| Maßnahme | Wirkung |
|----------|--------|
| **RAG_TOP_K=5** (Default) | Token-Hygiene: ~2.500 Tokens RAG; Platz für FILE_TREE + Few-Shots im 8k-Fenster. Bei Bedarf auf 7–10 erhöhen. |
| **OLLAMA_MODEL=qwen2.5-coder:1.5b** (Standard) oder **qwen2.5-coder:7b** | Coder-Modell für besseres Verständnis und Folgen von 3-Schritte-Logik. Mehr RAM bei 7b. |
| **corrections.txt** | Falsche Antworten korrigieren: eine Zeile `Frage \| richtige Antwort`. Chunks werden bei Suche stärker gewichtet. |
| **PROJECT_LOGIC.md** | Wird als Quelle `project_logic` gechunkt und bei Relevanz leicht geboostet. Nach Änderung: `npm run build:rag-chunks` und `npm run build:rag-embeddings`. |
| **logic-chains.json** | Wenn-Dann-Regeln („Nach /create-key: /vault-save vorschlagen“). Erweiterbar ohne Code-Änderung. |
| **morgendrot-dataset.jsonl** | Few-Shot-Beispiele; Indizes in `ai-copilot.ts` (FEW_SHOT_INDICES). Neue Zeilen verbessern Antwortmuster. |
