# KI-Kontext und Sicherheit (Struktur, Confidence, RAG)

Kurze Prüfung der drei Säulen: Repo-Skeleton, Confidence-Schranke, RAG-Token-Hygiene.

---

## 1. Repo-Skeleton (FILE_TREE)

**Idee:** Die KI bekommt nur ein Inhaltsverzeichnis (welche Funktion in welcher Datei), nicht 200k Tokens Code – sie „weiß“, wo sie suchen muss.

**Ist-Zustand im Repo:**
- **Skript:** `scripts/generate-file-tree.ts` (TypeScript, nicht .js)
- **Aufruf:** `npm run build:file-tree`
- **Ausgabe:** `ai-training/FILE_TREE.json` – Array von `{ path, functions }` (nicht ein großer String)
- **Regex:** Move: `(?:public\s+)?(?:entry\s+)?fun\s+(\w+)`, TS: `export\s+(?:async\s+)?function\s+(\w+)`
- **Ignoriert:** `node_modules`, `.git`, `target`, `dist`, `build`, `.next`, `*.d.ts`
- **Nutzung:** `ai-copilot.ts` lädt `loadFileTree()` und baut daraus die Zeichenkette „REPO-LANDKARTE (Funktionen pro Datei)“; wird in `loadHiddenContext()` jeder Ollama-Anfrage vorangestellt.

**Fazit:** Sinnvoll und **bereits umgesetzt**. Ein zusätzliches `generate-file-tree.js` mit flachem `{ map: repoMap }` ist nicht nötig – das bestehende TS-Skript liefert das erwartete Format und wird vom Copilot genutzt.

---

## 2. Confidence-Schranke & Fallback (Grün/Gelb/Rot)

**Idee:** Schwelle z. B. 0,75; unterhalb keine Auto-Ausführung, sondern Nachfrage („Meintest du …?“) oder klare Ablehnung.

**Ist-Zustand:**
- **Config:** `AI_COPILOT_CONFIDENCE_THRESHOLD` in `config.ts` (Default **0,8**; optional auf 0,75 gesetzt)
- **Logik in `ai-copilot.ts`:**
  - `confidence >= threshold` → **Grün:** `autoExecute: true`, UI führt Befehl aus
  - `confidence < threshold` → **Gelb:** nur Vorschlag, Nutzer muss bestätigen
  - Kein gültiges JSON / keine action / Off-Topic → **Rot:** Fallback-Parsing oder klare Ablehnung
- **Prompt:** Antwort nur als JSON mit `thought`, `action`, `confidence` – reduziert Floskeln.

**Empfehlung:** Default 0,75 ist etwas großzügiger (mehr „Grün“ bei leichten Formulierungen). Ein explizites Feld `suggestions: ["/send-plain", "/send"]` würde die UI für „Gelb“ verbessern („Meintest du: … oder …?“), erfordert aber Anpassung im Modell-Prompt und in der Antwort-Struktur.

---

## 3. RAG-Hygiene (Token-Limit, Top-K)

**Idee:** Top-K auf 5 begrenzen → ca. 5 Chunks × ~500 Wörter ≈ 2.500 Tokens; plus FILE_TREE (~1.000) und Few-Shots (~1.000) passt in ein 8k-Fenster (z. B. Qwen).

**Ist-Zustand:**
- **`src/rag-retrieval.ts`:** `DEFAULT_TOP_K = 5`; `topK = options?.topK ?? CFG.RAG_TOP_K ?? DEFAULT_TOP_K`
- **`config.ts`:** `RAG_TOP_K` Default **5** (min 1, max 20)
- **Comment im Code:** „Token-Hygiene: Top-K (Default 5) ≈ max. 2500 Tokens“

**Fazit:** Sinnvoll und **bereits so umgesetzt**. In der Doku stand teils „Default 7“ – wurde auf „5“ vereinheitlicht.

---

## Kurzfassung

| Punkt | Sinnvoll? | Umsetzung |
|--------|-----------|-----------|
| Repo-Skeleton | Ja | Bereits da: `generate-file-tree.ts` → `FILE_TREE.json`, wird im Copilot geladen |
| Confidence 0,75 + Fallback | Ja | Threshold konfigurierbar (Default 0,8; auf 0,75 änderbar); Grün/Gelb/Rot-Logik vorhanden |
| RAG Top-K = 5 | Ja | Default 5 in Code und Config; Doku angepasst |

Damit sind Struktur (FILE_TREE), Zwang zum JSON und die Confidence-Prüfung bereits die gewünschten Sicherheits- und Kontext-Stellschrauben.
