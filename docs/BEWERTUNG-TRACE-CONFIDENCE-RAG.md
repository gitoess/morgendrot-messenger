# Bewertung: Trace-Generator, Confidence-Filter, RAG-Token-Hygiene

Kurze Prüfung der drei Lösungen und Umsetzungsstand.

---

## 1. Trace-Generator („Die 100 Pfade“)

**Vorschlag:** Statt 1000 blind zu testen: 100 gezielte Logik-Ketten. 10 Szenarien × 10 Adress-Varianten. Output: traces mit `[Bedingung] → [Aktion] → [Ergebnis]`. KI lernt Kausalität, ohne Gas zu verbrauchen.

**Bewertung:** **Sinnvoll.**  
- Reduziert Zufallstests; fokussiert auf typische Abläufe (Gast → Zahlung → Key → Rebate).  
- Synthetische Traces ohne echte Chain-TX: kein Gas, reproduzierbar, gut für RAG.  
- 100 Einträge sind überschaubar und passen in RAG (Chunk-Batches).

**Umsetzung:**  
- Skript `scripts/generate-logic-traces.ts` (Aufruf: `npm run build:logic-traces`) erzeugt 100 Einträge: 10 Szenarien × 10 Adress-Varianten, Format `summary: "Bedingung: … Aktion: … Ergebnis: …"`, Ausgabe `ai-training/logic-traces.jsonl`.  
- `build-rag-chunks.ts` liest `logic-traces.jsonl` und erzeugt Chunks mit `source: "logic_trace"`.  
- So lernt die KI Kausalität (z. B. „nach Zahlung → /create-key → Key ausgestellt“) ohne echte Chain-TX.

---

## 2. Confidence-Filter (0,75-Gate, Säule 3/4)

**Vorschlag:** Wenn `confidence < 0.75` → UI zeigt Buttons (Vorschläge), führt Befehl nicht blind aus. Sonst „Just do it“.

**Bewertung:** **Bereits umgesetzt.**  
- **Backend:** `AI_COPILOT_CONFIDENCE_THRESHOLD` Default **0,75** (config.ts).  
- **Logik:** `autoExecute = confidence >= threshold` (ai-copilot.ts).  
- **UI:** Wenn `data.autoExecute === true` → Befehl wird automatisch ausgeführt. Wenn `false` → es wird nur der **Vorschlag** mit **„✅ Ja, ausführen“** und **„❌ Nein“** angezeigt, kein Auto-Run.

Damit entspricht das Verhalten dem gewünschten Confidence-Filter; der Schwellwert 0,75 ist konfigurierbar (z. B. `.env`: `AI_COPILOT_CONFIDENCE_THRESHOLD=0.75`).

**Optional:** Wenn die KI ein Feld `suggestions: ["/send-plain", "/send"]` liefern würde, könnte die UI bei Gelb explizit „Meintest du: A oder B?“ anzeigen. Dafür müsste das Modell-Prompt und die Antwortstruktur erweitert werden.

---

## 3. RAG-Token-Hygiene (Top-3 Chunks, &lt; 4.000 Tokens)

**Vorschlag:** Nur Top-3 Chunks aus der Knowledge-Basis laden. Gesamtkontext unter 4.000 Tokens („Sweet Spot“ für Qwen2.5-Coder).

**Bewertung:** **Sinnvoll.**  
- Weniger Chunks = weniger Tokens, oft schneller und fokussierter.  
- 3 Chunks × ~500 Wörter ≈ 1.500 Tokens RAG; mit System-Prompt (~800) und Few-Shot (~1.000) bleibt man gut unter 4k.  
- **Risiko:** Bei sehr spezifischen Fragen fehlt evtl. der treffende Chunk, wenn er auf Platz 4–5 liegt. Top-3 ist ein guter Default; bei Bedarf auf 5 erhöhen (z. B. `RAG_TOP_K=5`).

**Umsetzung:**  
- `RAG_TOP_K` ist konfigurierbar. Default auf **3** gesetzt (config.ts + rag-retrieval.ts).  
- Wer mehr Kontext braucht: `RAG_TOP_K=5` oder `7` in `.env`. So bleibt der Kontext typisch unter 4.000 Tokens.

---

## Kurzfassung

| Lösung | Sinnvoll? | Stand |
|--------|-----------|--------|
| Trace-Generator (100 Pfade) | Ja | Neu: Skript + logic-traces.jsonl + Einbindung in RAG |
| Confidence 0,75 + Buttons | Ja | Bereits umgesetzt (Threshold 0,75, UI zeigt Buttons bei Gelb) |
| RAG Top-3 | Ja | Default auf 3 setzbar; 5 weiterhin per Env wählbar |
