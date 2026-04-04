# Aufräumen & sauberer Git-Commit (nach „Kern läuft“)

**Zweck:** Entscheidungshilfe: **was behalten**, was **nicht zurückbauen**, wie **committen** – ohne funktionsfähigen Code zu riskieren.

**Passt zum Fahrplan:** **`docs/ROADMAP-FAHRPLAN.md`** § **H.1** (Phase A: kleine Schritte, kein Groß-Rollback).

---

## 1. Macht der aktuelle Stand Sinn?

**Ja:** Dünne **`chat-view.tsx`** (nur Verdrahtung → Hook → `ChatViewMainContent`) entspricht dem Zielbild aus **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**. Die verbleibende Komplexität sitzt **konzentriert** in **`use-chat-view-core.ts`** – das ist **technische Schuld zum weiteren Zerlegen**, kein Grund für ein **Rollback** der Zerlegung.

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
| **`use-chat-view-core.ts` (~900+ Zeilen)** | **Nicht** wieder mit `chat-view.tsx` verschmelzen. Besser: **weitere** Extraktion in Hooks/Module (weitere Iterationen laut Fahrplan **H.1**). |
| **Shadow-Sweep** (`chat-view-shadow-sweep.tsx` im Setup-Panel) | **Umgesetzt** – POST `/api/shadow-sweep`; UX/Text weiter verfeinern nach Bedarf. |
| **Doppelte Kopien unter `exports/`** | In **`.gitignore`** (Standalone-Bundle) – **nicht** manuell pflegen; bei Release **`npm run bundle:…`** laut README. |
| **LXMF/Macro-Doks** | Nur Text – kein Laufzeit-Overhead; **behalten**. |

**Nicht sinnvoll:** „Alles in eine Datei“ für „weniger Dateien“ – erhöht Konflikte und bricht das Phase-A-Ziel.

---

## 4. Konkreter Commit-Plan (Schritte)

1. **`git status`** – sicherstellen: **keine** `.env` / Vault- / Secret-Dateien (siehe `.gitignore`).  
2. **Optional:** Änderungen in **zwei** Commits trennen – (A) nur **`docs/`** + ggf. **`README.md`**, (B) **`src/`** + **`frontend/`** – erleichtert Review.  
3. **Nicht committen:** `node_modules/`, `dist/`, gebündelte `exports/Morgendrot-*` / `exports/morgendrot-standalone-smartphone/` (sind ignoriert).  
4. **Vor Commit:** `npx tsc` (Root), bei Frontend-Touch: `npm run build` oder zumindest Lint im `frontend/` nach Bedarf.  
5. **Commit-Botschaft (Vorschlag):**  
   - *docs: roadmap, channel policy, LXMF inspiration, opcode registry notes*  
   - *feat(ui): messenger pulse status; api status heartbeat field; chat header*  
   - oder **ein** Merge-Commit mit erster Zeile: *chore: sync docs and messenger status after core stabilization*

---

## 5. Kurzfassung

- **Behalten:** gesamte Chat-Zerlegung, Voice, .morg-pkg, Inbox/Export, Puls-Zeile, Doku, Opcodes.  
- **Vereinfachen:** nur **weiter** refactoren (Core-Hook kleiner machen), nicht monolithisch zurück.  
- **Commit:** sauber getrennt nach Secrets/Build-Artefakten, optional Docs/Code getrennt.

---

*Bei Konflikt mit Produktentscheidungen immer **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** voranstellen.*
