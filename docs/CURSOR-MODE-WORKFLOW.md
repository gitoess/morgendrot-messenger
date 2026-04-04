# Cursor-Mode Workflow (KI voll integriert)

Damit die integrierte KI (Ollama) das Projekt wie Cursor „sieht“ und stabile Befehle vorschlägt, solltest du diesen Workflow nutzen.

## 1. Repo-Landkarte (optional, empfohlen)

Damit die KI weiß, **wo welche Funktion** liegt, ohne alle Dateien zu lesen:

```bash
npm run build:file-tree
```

- Scannt `.ts` und `.move` im Repo (ohne node_modules, .git, target).
- Schreibt `ai-training/FILE_TREE.json` (Pfad → Funktionsnamen). Wird **immer** als Kontext mitgeladen (klein).

## 2. Index: Codebase für RAG aufbauen

Alle relevanten Dateien werden in Chunks zerlegt und (bei Nutzung von Embeddings) als Vektoren abgelegt. Die KI bekommt bei jeder Anfrage die **Top-K** ähnlichsten Chunks als Kontext (nur bei Bedarf).

```bash
npm run build:rag-chunks
```

- Liest `codebase.md` (Repomix-Output, Root oder `ai-training/`).
- Schreibt Chunks nach `ai-training/rag-chunks.json`.
- **Top-K** ist auf **5** begrenzt (≈ 2500 Tokens bei ~500 Tokens/Chunk), passt in das Context-Fenster von Qwen2.5-Coder (8k–32k).

## 3. Sync: Aktuelle Umgebung in die KI „brennen“

Package-ID, eigene Adresse, Partner-Adresse aus `.env` werden in das **Modelfile** geschrieben. So kennt die KI die aktuellen Säule-1-Werte.

```bash
npm run sync-context
```

- Führt `npm run generate:modelfile` aus.
- Schreibt `docs/ollama-Modelfile`.
- **Hinweis:** Ein neues Modell erstellst du mit `npm run setup-ai` (inkl. `ollama create morgendrot-ai -f docs/ollama-Modelfile`). Beim normalen Entwickeln reicht Sync, wenn das Modell schon existiert.

## 4. Run: Dashboard mit KI starten

```bash
npm run dev
```

- Bereitet RAG vor (`prepare:rag`), generiert Modelfile, startet UI und API.
- Im Dashboard ist der AI-Copilot verfügbar (Ollama + optional Intent-Matcher).

## Kurzfassung (Copy-Paste)

```bash
# Repo-Landkarte (wo welche Funktion) – immer geladen
npm run build:file-tree

# Einmalig oder nach großen Code-Änderungen: RAG-Index
npm run build:rag-chunks

# Vor dem Start oder nach .env-Änderung: Kontext syncen
npm run sync-context

# Dashboard mit voll integrierter KI starten
npm run dev
```

## Modell-Empfehlung („100 % Cursor-Feeling“ offline)

- **Qwen2.5-Coder 7B** (RAM ≥ 8 GB): `ollama pull qwen2.5-coder:7b`
- **Qwen2.5-Coder 14B** (RAM > 16 GB): `ollama pull qwen2.5-coder:14b` – **größter Hebel:** +15–25 % Präzision & Reasoning-Tiefe gegenüber 7B. Für beste Qualität: Variante **Q5_K_M** oder **Q6_K** (z. B. `qwen2.5-coder:14b-q5_k_m`), falls in Ollama verfügbar.

Modelfile-Basis: `OLLAMA_MODEL_BASE=qwen2.5-coder:7b` (oder `:14b`) in `.env`. Standard im Skript ist `qwen2.5-coder:0.5b` (sparsam).

## Realistische Grenzen (ohne Hype)

- **Kontext:** Lokal typisch 32k–64k (Qwen), Cursor hat 3–6× mehr.
- **Reasoning:** Qwen 14B kommt Claude 3.5 Sonnet nahe, aber nicht gleich.
- **Index:** Cursor liest das Repo live; lokal nur statischer RAG + FILE_TREE (nach Änderungen neu bauen).
- **Fehlerquote:** Cursor ~2–5 %; lokal realistisch 5–15 % bei neuen oder sehr komplexen Anfragen.

**Fazit:** Mit Qwen2.5-Coder 14B + RAG + FILE_TREE + strengem JSON-Schema + 25–30 Few-Shot + Confidence-Gate (0.8) + Post-Filter erreichst du **~90 % Cursor-Gefühl** bei Programmier- und Projekt-Anfragen – lokal, kostenlos, offline.

## Siehe auch

- `docs/AI-COPILOT-PLAN.md` – Konzept
- `ai-training/RAG-SETUP.md` – RAG/Embedding-Setup
- `.morgendrot-rules` – Regeln für Identität, Format, Compliance (0x0748…)
