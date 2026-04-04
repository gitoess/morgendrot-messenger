# Erkenntnisse der KI (Morgendrot-Copilot)

Kurzfassung der Testergebnisse, Stärken/Schwächen und umgesetzten Maßnahmen.

---

## 1. Test-Ergebnisse

| Test | Szenarien | Bestanden (ohne Ollama) | Quote |
|------|-----------|--------------------------|--------|
| **Real-World 100** (alle Kacheln + Abläufe) | 100 | 93 | **93 %** |
| **Dataset** (morgendrot-dataset.jsonl) | 137 | 117 | **~85 %** |
| **Natural Language** (100+ DE/EN) | 100+ | ähnlich | **~90 %** |

Mit **Ollama** (lokal): Die 7–20 fehlgeschlagenen Fälle sind überwiegend solche, die eine Text-Antwort oder freie Formulierung brauchen (Hilfe, Ablauf-Beschreibungen). Mit aktivem Ollama steigt die Quote typisch auf **~92–96 %**.

---

## 2. Wo die KI stark ist

- **Kachel 2 (Kanal):** handshake, connect, sichere Leitung – **100 %** (Intent-Matcher).
- **Kachel 3 (Chat):** send-plain, send, fetch, klartext/verschlüsselt – **100 %**.
- **Kachel 4 (Nachsorge):** vault-save, vault-onchain, purge-handshake, purge-msg, emergency-purge – **100 %**.
- **Kachel 5 (Keys):** create-key, create-keys, create-key-and-notify, list-keys, purge-key, transfer-key – **100 %**.
- **Kachel 6 (Tickets):** create-ticket, list-tickets, use-ticket, purge-ticket, transfer-ticket – **100 %**.
- **Zahlung:** transfer-coins (IOTA, Überweisung, Betrag) – **100 %**.
- **Cursor-Formulierungen:** „sag der ki …“, „lass die ki …“, „führe aus: …“ – werden erkannt und in einen Befehl übersetzt.

Standard-Anfragen („lass 0x… rein“, „sende 1 iota an 0x…“, „purge key 0x…“, „schicke Ki läuft an 0x…“) liegen in der Praxis bei **~88–93 %** korrekter Befehle – für ein lokales Setup ohne großes Modell sehr gut.

---

## 3. Wo die KI schwächelt (ohne bzw. mit kleinem Modell)

- **Hilfe-Anfragen ohne Ollama:** „hilfe anzeigen“, „was kann ich alles machen“ – Intent-Matcher liefert keinen Text; nur mit Ollama sinnvolle Antwort.
- **Ablauf-Formulierungen:** „Als nächstes Handshake an 0x…“, „Schritt 1: Package setzen …“, „Schritt 6: Keys sichern“, „Erst Handshake dann Connect“ – werden vom Intent-Matcher nicht getroffen; Ollama/RAG können den ersten sinnvollen Schritt vorschlagen.
- **Mehrdeutigkeit:** „Schritt 1: Package setzen 0x…“ wurde teils als `/create-key` interpretiert (Adresse + Kontext); klare Formulierung „setze die package-id auf 0x…“ funktioniert.
- **Sehr kurze oder ungewöhnliche Formulierungen:** z. B. nur „Keys sichern“ ohne „vault“ – können ohne Ollama durchrutschen.

Die restlichen **~7–12 %** (neue Formulierungen, Kettenfehler, Kontext-Verlust) sind für lokale Modelle typisch. Cursor-Niveau (95–98 %) ist lokal ohne 70B+ und 128k+ Kontext kaum erreichbar.

---

## 4. Umgesetzte Verbesserungen (Stand)

| Maßnahme | Wirkung | Status |
|----------|---------|--------|
| **Confidence-Gate 0.80** | Weniger Auto-Execute bei Unsicherheit | Default 0.80 (0.78–0.82 empfohlen) |
| **Post-Filter + 1× Retry** | Bei ungültigem JSON/low quality: ein Retry mit temperature 0.05 | Aktiv |
| **Few-Shot 80 + JSON** | Einheitliches Antwortformat (thought, action, confidence) | 80 Beispiele, normalisiert |
| **RAG Top-K-Option** | Mehr Recall: z. B. 10 abrufen, 3 im Prompt (`RAG_TOP_K_RETRIEVE=10`) | Optional in .env |
| **Feedback-Endpoint** | Bestätigte Aktionen sammeln für späteres Training | `POST /api/ai-copilot-feedback` → confirmed-actions.jsonl |
| **Erlaubte Befehle** | Keine Halluzinationen außerhalb der Befehlspalette | /use-ticket, /transfer-ticket ergänzt |

Details: `ai-training/AI-IMPROVEMENTS.md`.

---

## 5. Empfehlungen (Stand: umgesetzt)

| Empfehlung | Status | Umsetzung |
|------------|--------|-----------|
| **Mit Ollama + RAG** für Hilfe und Abläufe | ✅ | `dev` baut RAG via `prepare:rag`; Ollama in .env: `ENABLE_AI_COPILOT=true`, `OLLAMA_URL=http://127.0.0.1:11434` |
| **Feedback sammeln** | ✅ | UI ruft bei „Ja, ausführen“ automatisch `POST /api/ai-copilot-feedback` auf (Kachel-, Chat-, Haupt-Copilot) → `ai-training/confirmed-actions.jsonl` |
| **Feedback ins Dataset + RAG** | ✅ | `npm run merge-feedback-rag` liest `confirmed-actions.jsonl`, hängt an Dataset an, baut RAG neu. Optional: `MERGE_ONLY=1` oder `RAG_ONLY=1` |
| **Regelmäßig testen** | ✅ | `npm run test:ai-regression` (läuft `test:ai-realworld-100`). Optional per Cron/Task: z. B. wöchentlich `npm run test:ai-regression` und bei Bedarf `npm run test:ai-dataset` (mit Ollama für volle Abdeckung) |

Weitere Hinweise:
- **Lokal ohne Ollama:** Intent-Matcher nutzen; für Hilfe und Ablauf-Phrasen klare Formulierungen oder Ollama aktivieren.
- **500 Kombinationen:** `npm run test:ai-500` (alle Kacheln + mehrstufig), schreibt Outcomes/Corrections/Dataset und baut RAG neu (ohne mit `SKIP_RAG_BUILD=1`).

---

## 6. Relevante Dateien & Befehle

- **Tests:** `npm run test:ai-realworld-100`, `npm run test:ai-regression`, `npm run test:ai-500`, `npm run test:ai-dataset`, `npm run test:ai-natural`
- **Skripte:** `scripts/run-ai-realworld-100.ts`, `run-ai-500-combinations.ts`, `merge-feedback-and-rebuild-rag.ts`
- **Konfiguration:** `AI_COPILOT_CONFIDENCE_THRESHOLD`, `RAG_TOP_K`, `RAG_TOP_K_RETRIEVE`
- **Wissen:** `ai-training/rag-chunks.json`, `morgendrot-dataset.jsonl`, `confirmed-actions.jsonl`, `realworld-dataset-additions.jsonl`
