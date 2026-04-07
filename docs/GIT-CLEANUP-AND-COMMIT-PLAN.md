# Aufräumen & sauberer Git-Commit (nach „Kern läuft“)

**Zweck:** Entscheidungshilfe: **was behalten**, was **nicht zurückbauen**, wie **committen** – ohne funktionsfähigen Code zu riskieren.

**Passt zum Fahrplan:** **`docs/ROADMAP-FAHRPLAN.md`** § **H.1** (Phase A: kleine Schritte, kein Groß-Rollback).

---

## 1. Macht der aktuelle Stand Sinn?

**Ja:** Dünne **`chat-view.tsx`** (nur Verdrahtung → Hook → `ChatViewMainContent`) entspricht dem Zielbild aus **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**. Die Chat-Logik ist in **`use-chat-view-core.ts`** (Orchestrierung) und viele **`use-chat-view-*.ts`**-Hooks aufgeteilt — **kein** Monolith in einer Datei; weiteres Zerlegen des Cores nur bei **klarem** Nutzen (siehe Fahrplan **§ A Punkt 4**).

---

## 2. Behalten (Refactorings & Features – **nicht** zurückbauen)

| Bereich | Warum behalten |
|---------|------------------|
| **Chat-View-Zerlegung** | `chat-view.tsx` + `chat-view-main-content.tsx` + viele `chat-view-*.tsx` + Hooks (`use-chat-view-*.ts`) – **Wartbarkeit**, klarer Send-/Inbox-Pfad. |
| **Voice** (`chat-view-voice-record.tsx`, Voice-State im Core-Hook) | Dokumentiertes Produktfeature (Sprachmemo, LoRa-tauglich) – **`docs/MESSENGER-SPRACHAUFNAHME.md`**. |
| **Datei-Import / .morg-pkg** | Toolbar + `use-chat-view-morg-pkg-actions.ts` + Bundle – Sneakernet/Offline-Story. |
| **Posteingang** | Pagination, Exporte – bereits stabil. |
| **Chat-Header „Puls an Basis“** | Streams/Heartbeat-Status ohne Chat-Spam. |
| **Doku** | `ROADMAP-FAHRPLAN`, `PROTOCOL-CHANNELS-TX-VS-STREAMS`, Opcodes, LXMF-Inspiration, Macro-Specs – **Repo-Wahrheit** für KI/Team. |
| **`src/shared/opcodes.ts`** | Zentrale Registry – kein Entfernen. |

---

## 3. Vereinfachen / später – **kein** großes „Zurück auf Monolith“

| Thema | Empfehlung |
|--------|------------|
| **`use-chat-view-core.ts`** | **Nicht** wieder mit `chat-view.tsx` verschmelzen. **Kein** Dauer-Refactor ohne Nutzen — Send-Pfad bleibt über **`use-chat-view-send-flow`** / **`use-chat-view-handle-send`**; siehe **§ H.1** / **§ A Punkt 4**. |
| **Shadow-Sweep** (`chat-view-shadow-sweep.tsx` im Setup-Panel) | **Umgesetzt** – POST `/api/shadow-sweep`; UX/Text weiter verfeinern nach Bedarf. |
| **Doppelte Kopien unter `exports/`** | In **`.gitignore`** (Standalone-Bundle) – **nicht** manuell pflegen; bei Release **`npm run bundle:…`** laut README. |
| **LXMF/Macro-Doks** | Nur Text – kein Laufzeit-Overhead; **behalten**. |

**Nicht sinnvoll:** „Alles in eine Datei“ für „weniger Dateien“ – erhöht Konflikte und bricht das Phase-A-Ziel.

---

## 4. Konkreter Commit-Plan (Schritte)

1. **`git status`** – sicherstellen: **keine** `.env` / Vault- / Secret-Dateien (siehe `.gitignore`).  
2. **Optional:** Änderungen in **zwei** Commits trennen – (A) nur **`docs/`** + ggf. **`README.md`**, (B) **`src/`** + **`frontend/`** – erleichtert Review.  
3. **Nicht committen:** `node_modules/`, `dist/`, gebündelte `exports/Morgendrot-*` / `exports/morgendrot-standalone-smartphone/` (sind ignoriert).  
4. **PWA-Handbuch:** Nach Änderung an **`docs/BOSS-ORIENTIERUNG.md`** oder **`docs/PWA-HANDBUCH-OFFLINE.md`:** **`npm run sync:handbook`** (Root) und **`frontend/public/handbook/`** mitcommitten — sonst ist **`/handbook`** in der PWA veraltet (oder `next build` mit **`prebuild`**).  
5. **Vor Commit:** `npx tsc` (Root), bei Frontend-Touch: `npm run build` oder zumindest **`frontend/`:** `npx tsc --noEmit` nach Bedarf.  
6. **Commit-Botschaft (Vorschlag):**  
   - *docs: roadmap, channel policy, LXMF inspiration, opcode registry notes*  
   - *feat(ui): messenger pulse status; api status heartbeat field; chat header*  
   - oder **ein** Merge-Commit mit erster Zeile: *chore: sync docs and messenger status after core stabilization*

---

## 5. Kurzfassung

- **Behalten:** gesamte Chat-Zerlegung, Voice, .morg-pkg, Inbox/Export, Puls-Zeile, Doku, Opcodes.  
- **Vereinfachen:** punktuell (Hilfsfunktionen, DRY), **kein** sinnloses „Core-Hook kleiner um jeden Preis“ — Fahrplan **§ A Punkt 4**.  
- **Commit:** sauber getrennt nach Secrets/Build-Artefakten, optional Docs/Code getrennt.

---

*Bei Konflikt mit Produktentscheidungen immer **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** voranstellen.*
