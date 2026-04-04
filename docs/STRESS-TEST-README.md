# Stresstests – API vs. KI

---

> **⚠️ WICHTIG (Disclaimer)**  
> **`npm run test:stress` ist kein KI-Stresstest.**  
> Er misst nur API/Infra (Status + /help). **API-Stabilität ≠ KI-Stabilität.**  
> Latenz **0 ms** gilt nur für diese leichten Endpoints – bei echter Ollama-Last sind **p95 2–8 s** realistisch.  
> Für KI-Last: **`npm run test:stress:ollama`** (Ollama + RAG, 300 s, parallel, mit Warm-Up).

---

## Was `npm run test:stress` misst

| Aspekt | Tatsächlich getestet |
|--------|----------------------|
| **Endpoints** | `GET /api/status` und `POST /api/command` mit `cmd: "/help"` |
| **Ollama / KI** | **Nein** – kein Aufruf von `/api/ai-copilot`, kein Modell-Load |
| **Latenz** | Roundtrip HTTP für leichte Antworten (Status, Hilfe-Text); lokal oft &lt;1 ms → Anzeige 0 ms (Rundung) |
| **Aussage** | API und Infrastruktur halten ~8+ Req/s ohne Fehler. **Nicht**: KI-Stabilität unter Last. |

**Fazit:** Die Zahlen sind korrekt für **diesen** Test – sie beschreiben **keinen** Ollama-Stresstest. Ein **p95 0 ms**-Ergebnis ist ohne diesen Kontext irreführend; mit Disclaimer (siehe oben) klar: nur API, keine KI.

---

## Warum 0 ms Latenz plausibel ist (hier)

- Kein Ollama, kein RAG, kein langer Prompt.
- Lokal: TCP + JSON + kurze Handler-Logik → oft unter 1 ms; `Math.round(x)` ergibt dann 0 ms.
- p95/p99 bei 0 ms heißt: Fast alle Requests waren in diesem Sub-Millisekunden-Bereich.

---

## Echter KI-Stresstest (Ollama)

Für **KI-Stabilität unter Last** braucht es einen separaten Test, der:

1. **`POST /api/ai-copilot`** mit echten Prompts aufruft (Ollama wird genutzt).
2. **Latenz** pro Request misst (Roundtrip inkl. Ollama).
3. **p50, p95, p99, Throughput (Req/s), Fehlerrate** ausweist.

### Realistische Erwartung (Orientierung)

| Modell | Req/s (ca.) | p95 (ca.) |
|--------|-------------|-----------|
| 7B (CPU) | 1,5–4 | 2–6 s |
| 7B (GPU, z. B. RTX 4090) | 4–15 | 0,5–2 s |
| 14B | 0,8–2,5 | 4–12 s |

### Ollama-Stress-Skript (umgesetzt)

- **`npm run test:stress:ollama`** → Dauer **300 s**, **6 parallel**, **Warm-Up 10**. Misst p50/p95/p99, Req/s, Fehlerrate, Latenz-Breakdown. Schwellen: p95 &lt; 6000 ms, Fehlerrate &lt; 0,5 %. Optionen: `--duration=300 --concurrent=6 --base=...`.

### Schwellen für KI-Stress

- p95 &lt; 4000 ms (7B), &lt; 8000 ms (14B).
- Fehlerrate &lt; 0,5 % unter Dauerlast.

### Optional: Real-World-Nähe

- 20–30 % der Requests mit langen Prompts (z. B. RAG + Few-Shot + FILE_TREE, 4k–8k Tokens).
- 10 % Edge-Cases (lange Adressen, ungültige Formulierungen).
- 5 % Doppel-Requests (Race-Condition-Check).

---

## Latenz-Breakdown

Die Antwort von `POST /api/ai-copilot` enthält bei Ollama-Pfad optional **`timings`**:

- `ragRetrievalMs` – Dauer RAG-Retrieval
- `ollamaCallMs` – Dauer Ollama-API-Call
- `postFilterMs` – Parsing/Post-Filter bis zur Antwort
- `totalMs` – Gesamt-Roundtrip

So siehst du, ob der Flaschenhals bei RAG, Ollama oder Post-Processing liegt. Der Ollama-Stress-Test gibt bei genügend Responses einen Ø-Breakdown aus.

## Regression nach Build (CI)

- **`npm run test:ai-critical`** → 20 Todeszonen + 17 kritische Dataset-Szenarien (ohne Ollama schnell, mit Ollama optional).
  - Für CI: nach jedem Build oder nach Few-Shot-/RAG-Updates ausführen, um Regression zu vermeiden.

## Kurzüberblick

| Test | Zweck | Ollama? |
|------|--------|---------|
| `npm run test:stress` | API/Infra unter Last (Status + /help) | Nein |
| `npm run test:stress:ollama` | KI-Stabilität, Latenz, Throughput (RAG + Ollama) | Ja |
| `npm run test:ai-critical` | Regression: Todeszonen + 17 kritische Szenarien | Optional |

Die **95,3 % (500er-Lauf)** bzw. **Todeszonen 20/20** sind für die **KI-Qualität** aussagekräftiger als die reinen Stress-Test-Zahlen.
