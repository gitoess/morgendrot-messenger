# KI-Copilot: Bewertung der Verbesserungsvorschläge

**Ausgangslage:** RAG + Few-Shot + Tests; geschätzt 88–93 % korrekte Befehle bei Standard-Anfragen. Die restlichen 7–12 % sind bei lokalen Modellen typisch.

## 1. Re-Ranking für RAG (+4–7 % Trefferquote)

**Vorschlag:** Cross-Encoder (z. B. cross-encoder/ms-marco-MiniLM-L-6-v2), Top-10 → reranken → Top-3–4 im Prompt. Bibliothek: sentence-transformers (Python).

**Bewertung:** Macht fachlich Sinn. **Einschränkung:** sentence-transformers ist Python, der Stack ist Node/TS. Optionen:
- **A)** Kleiner Python-Service (z. B. FastAPI), der einen Re-Rank-Endpunkt anbietet; Node ruft ihn auf. Aufwand mittel, Abhängigkeit von Python.
- **B)** Re-Ranking in Node z. B. mit ONNX Runtime + exportiertem Cross-Encoder. Aufwand hoch.
- **C)** **Umgesetzt als Kompromiss:** RAG kann mehr Kandidaten abrufen (z. B. 10) und nur die Top-3 im Prompt verwenden (`RAG_TOP_K_RETRIEVE` > `RAG_TOP_K`). Kein echter Cross-Encoder, aber bessere Recall bei gleichem Token-Budget.

Echter Cross-Encoder-Re-Rank bleibt optional (z. B. später mit Python-Microservice).

---

## 2. Few-Shot auf 80–100 kürzen & strukturieren (+3–6 %)

**Vorschlag:** Duplikate entfernen, 20 häufigste + 20 Edge-Cases + 20 Ketten; Format: einheitlich JSON (thought + action).

**Bewertung:** Sinnvoll. Umgesetzt:
- Few-Shot-Loader nutzt bis zu 80 Beispiele (konfigurierbar).
- Ausgabe in den Beispielen wird einheitlich als JSON (thought, action, confidence) formatiert, wo möglich – so sieht das Modell durchgängig das gleiche Antwortformat.
- Duplikate: optional per Script (z. B. `scripts/curate-few-shot.ts`) oder manuell; im Loader wird eine feste, breit gestreute Index-Liste verwendet, die alle Kategorien abdeckt.

---

## 3. Confidence-Gate aggressiver (+3–5 %)

**Vorschlag:** Schwellwert 0.78–0.82 (statt 0.75); bei darunter: nicht ausführen, KI 3 Alternativen, User wählt per Button → Feedback-Loop.

**Bewertung:**
- **Schwellwert:** Default auf **0.80** angehoben (über `.env`: `AI_COPILOT_CONFIDENCE_THRESHOLD=0.80`). Empfohlener Bereich 0.78–0.82.
- **3 Alternativen + Button:** Erhöhter Aufwand (UI: Buttons, Backend: 2 weitere Ollama-Calls oder ein Call mit „3 Vorschläge“). Nicht umgesetzt; bei Bedarf als nächster Schritt.

---

## 4. Post-Filter & Retry (+2–4 %)

**Vorschlag:** Kein gültiges JSON / kein `/Befehl` → sofort „?“; bei ungültig oder confidence < 0.78 → Retry mit temperature 0.05, top_p 0.1 (max. 2×).

**Bewertung:** Sinnvoll. Umgesetzt:
- Bereits vorhanden: Post-Filter (nur erlaubte Befehle, `ALLOWED_AI_COMMANDS`), Fallback auf ACTION-Zeile.
- **Neu:** Ein **einmaliger Retry** mit `temperature: 0.05`, `top_p: 0.1`, wenn die erste Ollama-Antwort weder gültiges JSON noch eine erkennbare ACTION liefert. Kein zweiter Retry, um Latenz zu begrenzen.

---

## 5. Automatische Erweiterung (+2–5 % langfristig)

**Vorschlag:** Nach bestätigter Aktion: neuen Few-Shot-Eintrag anlegen, in `morgendrot-dataset.jsonl` anhängen, RAG periodisch neu indexieren (alle 5–10 Einträge).

**Bewertung:** Sinnvoll für kontinuierliche Verbesserung. Umgesetzt:
- **Endpoint:** `POST /api/ai-copilot-feedback` mit Body `{ "input": "User-Eingabe", "output": "ACTION: /cmd ... oder JSON" }`. Hängt eine Zeile in `ai-training/confirmed-actions.jsonl` an (Datum + input + output).
- **Weiterverarbeitung:** Periodisch (manuell oder Cron): `confirmed-actions.jsonl` in `morgendrot-dataset.jsonl` oder `realworld-dataset-additions.jsonl` übernehmen, dann `npm run build:rag-chunks` (und ggf. `build:rag-embeddings`). Optional: alle 5–10 neuen Einträge automatisch RAG neu bauen (später).

---

## Zusammenfassung

| Maßnahme              | Bewertung     | Aufwand (umgesetzt) | Status                          |
|-----------------------|---------------|----------------------|----------------------------------|
| Re-Ranking (Cross-Enc)| Sinnvoll (Py) | C: niedrig           | Option C: Top-K-Retrieve > Top-K |
| Few-Shot 80 + JSON    | Sinnvoll      | niedrig              | 80 Beispiele, Format JSON        |
| Confidence 0.80       | Sinnvoll      | niedrig              | Default 0.80                     |
| Post-Filter & Retry   | Sinnvoll      | niedrig              | 1× Retry low-temp                |
| Auto-Erweiterung      | Sinnvoll      | mittel               | Feedback-Endpoint + .jsonl       |

Die genannten Anpassungen sind eingebaut; Re-Ranking bleibt mit echtem Cross-Encoder optional (z. B. später mit Python).
