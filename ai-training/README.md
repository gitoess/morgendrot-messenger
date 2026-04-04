# Morgendrot KI-Training & Modelfile

Dieser Ordner enthält das **„Lehrbuch“** (Dataset), die **Logik-Matrix** (Ollama Modelfile) und die **Werkzeug-Beschreibung** (Function-Calling-Grundlage) für den Morgendrot-Assistenten (Qwen 0.5B / Ollama).

---

## 1. Dataset (JSONL) – „Lehrbuch“

- **Datei:** `morgendrot-dataset.jsonl`
- **Format:** Eine Zeile pro Beispiel, JSON mit `instruction`, `input`, `output`.
- **Inhalt:** ~50 Szenarien in drei Kategorien:
  - **Direkte Befehle:** z. B. „Lass Gast 0x123 rein“ → `/create-key <LOCK_ID> 0x123 30`
  - **Logische Ketten / PTB:** z. B. „Stelle Ticket aus und sag Bescheid“ → `/create-key-and-notify …`
  - **Fehler-Szenarien:** z. B. „RPC ist rot“ → „Prüfe Säule 1: RPC_URL, MY_ADDRESS, PACKAGE_ID“
- **Nutzen:** Instruction-Tuning für kleine Modelle, Simulation von 50 Test-Szenarien bis die PTB- und Säulen-Logik sitzt.

---

## 2. Modelfile (Ollama) – Logik-Matrix

- **Datei:** `Modelfile`
- **Basis:** `qwen2.5-coder:1.5b` (empfohlen: `ollama pull qwen2.5-coder`)
- **Inhalt:** Feste Regeln im SYSTEM-Prompt:
  - **Regel 1:** Ohne Säule 1 (MY_ADDRESS, PACKAGE_ID) keine Säule 2/3.
  - **Regel 2:** Ohne Säule 2 (Handshake/Connect) keine verschlüsselte Nachricht (/send).
  - **Regel 3:** Pro Antwort nur eine ACTION-Zeile; PTB für Key+Nachricht: `/create-key-and-notify`.
  - **Regel 4:** Nach Objekterstellung Säule 4 vorschlagen (Purge/Rebate).
- **Befehlssyntax:** Kurzreferenz für /create-key, /send-plain, /transfer-coins, /purge-key, /fetch, etc.

### Modell erstellen und nutzen

```bash
# Im Projektroot
ollama create morgendrot-qwen -f ai-training/Modelfile

# In .env (oder Umgebung)
OLLAMA_MODEL=morgendrot-qwen
```

Die App verwendet dann dieses Modell, wenn `ENABLE_AI_COPILOT=true` und `OLLAMA_URL` gesetzt sind.

---

## 3. Function Calling – Werkzeug-Verständnis

- **Datei:** `tools-schema.md`
- **Inhalt:** Beschreibung der „Funktionen“ als Code-Schnittstelle:
  - `create_key(lock, recipient, ttl_days?)`
  - `send_plain(recipient, text)` / `send_encrypted(text)`
  - `transfer_coins(recipient, amount_iota)`
  - `purge_key(key_id)`, `list_keys(owner?)`, …
- **Zweck:** Die KI „sieht“ Parameter-Typen (0x-Adresse, Zahl, Text) und Abhängigkeiten (Säule 1/2). Grundlage für späteres echtes Function Calling oder bessere Prompt-Ergänzung.

---

## 4. RAG (Langzeitgedächtnis)

- **Konkrete Schritte:** Siehe **`ai-training/RAG-SETUP.md`** (Dokumentenquelle, Chunking, Embeddings, Vektorspeicher, Abfrage-Flow, Integration).
- **Chunk-Build:** `npm run build:rag-chunks` erzeugt `ai-training/rag-chunks.json` aus APPLICATION_KNOWLEDGE und tools-schema (ohne Embeddings). Embeddings danach per Ollama/API hinzufügen (siehe RAG-SETUP.md).
- **Effekt:** Anfragen wie „Wie lösche ich alte Keys?“ → Suche in Doku-Chunks → Antwort aus echten Schritten.

---

## 5. Simulation / Test (50 Szenarien)

- **Skript:** `npm run test:ai-dataset` (bzw. `npx tsx scripts/run-ai-dataset-scenarios.ts`).
- Liest `morgendrot-dataset.jsonl`, sendet jedes `input` an den AI-Copilot, vergleicht die Antwort mit der erwarteten ACTION-Zeile aus `output`.
- **Ohne Ollama:** Nur Intent-Matcher + Direktbefehle (schnell). **Mit Ollama:** Volle Simulation, wenn `OLLAMA_URL` gesetzt ist.
- Ziel: PTB-Logik und Säulen-Abhängigkeiten fehlerfrei (eine ACTION pro Antwort, richtiger Befehl).

---

## Kurzüberblick

| Artefakt            | Datei                     | Zweck                                      |
|---------------------|---------------------------|--------------------------------------------|
| Lehrbuch (Dataset)  | `morgendrot-dataset.jsonl`| Instruction-Tuning, 50 Szenarien           |
| Logik-Matrix        | `Modelfile`               | Ollama-System-Prompt, 4 Säulen + Syntax    |
| Function Calling    | `tools-schema.md`         | Werkzeug-Parameter und Abhängigkeiten     |
| RAG-Setup           | `RAG-SETUP.md`            | Konkrete Schritte: Chunks, Embeddings, Abfrage |
| Test 50 Szenarien   | `npm run test:ai-dataset` | Skript: `scripts/run-ai-dataset-scenarios.ts` |
| RAG-Chunks bauen    | `npm run build:rag-chunks`| Erzeugt `rag-chunks.json` (ohne Embeddings) |
