# Messenger-UI: Modularität — Ist-Analyse & realistischer Plan

**Zweck:** Ehrliche Einordnung, warum der Next-Messenger **funktional** ist, aber **nicht** im gewünschten Sinne **entkoppelt**; verbindlicher **Fahrplan-Anker** (**`docs/ROADMAP-FAHRPLAN.md`** **§ H.1b**).  
**Nicht-Ziel:** Zeilenzahl-Religion (z. B. „10 000 Zeilen“) oder Big-Bang-Refactor in wenigen Tagen.

**Verknüpft:** **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** (Phase A), **`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`**, **`docs/MODULAR-KERN-ADAPTER-INTEROP.md`** (Kern vs. Adapter — Funk/Transport), **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`**.

---

## 1. Was schiefgelaufen ist (kurz & ehrlich)

| Befund | Präzisierung |
|--------|----------------|
| **Feature-Druck hat oft gewonnen** | Neue Themen (Voice, Luma/Chroma, Shadow-Sweep, `.morg-pkg`, Export, …) wurden **zuerst** in die **bestehenden** großen Einstiegspunkte gelegt (`use-chat-view-core`, `handle-send`, `api.ts`, `chat-view.tsx`) — das ist der **schnellste Weg** zu einem Demo- oder Feldtest-„grün“. |
| **„Viele Dateien“ ≠ modular** | Hooks und Komponenten wurden **ausgelagert** (Lesbarkeit, Wiederverwendung), aber **gemeinsamer State**, **implizite Reihenfolgen** und **API-Querschnitt** blieben **zentriert**. Ergebnis: **hohe Kopplung** trotz Dateisplit. |
| **Keine harte Architektur-Regel** | Es fehlte eine **durchsetzbare** Vereinbarung: *wo* lebt ein Feature dauerhaft, *wer* darf wen importieren, *was* ist eine **stabile Schnittstelle** (Types/Ports) — nicht nur „neue Datei anlegen“. |
| **Kein Vorwurf** | Typisches Muster bei **langen**, **risikoreichen** Projekten: Geschwindigkeit vor Grenzziehung. Der Code **läuft**; die **Struktur** holt die **Schulden** später ein (Regressionen, Review-Zeit, Onboarding). |

**Kernaussage:** Modularität meint hier **klare Grenzen und Schnittstellen**, nicht nur **mehr Dateien**.

---

## 2. Was noch gut behebbar ist

**Ja** — solange man **kleine, getestete Scheiben** fährt und **Phase B (Mesh-Kern)** nicht mit **flächigem UI-Umbau** kollidiert.

**Nicht behebbar „kostenlos“:** Ein **3-Tage-Monster-Refactor** ohne Verhaltens-Tests erhöht das Risiko überproportional.

---

## 3. Verbesserte Leitregeln (statt nur „X Zeilen“)

Statt einer starren **„max. 300 Zeilen“**-Grenze (oft kontraproduktiv bei einem klar begrenzten State-Machine-Block):

| Regel | Sinn |
|--------|------|
| **Feature-Heimat** | Jedes größere Thema hat einen **eindeutigen Ordner** unter `frontend/frontend/` (z. B. `features/send/`, `features/inbox/`). **Neues** Feature: **erst** Ordner + **README-Zeile** („was gehört hierhin“), **dann** Code. |
| **Weiche Budgets + Begründung** | Dateien **> ~400 Zeilen** oder **> ~50 Zeilen** neue Logik pro PR: im PR **kurz begründen** oder splitten. Ausnahmen ok, **Wiederholung** nicht. |
| **API-Schicht** | Kein Monolith-Zwang: Ziel ist **`lib/api/`** mit **Domänen-Dateien** (`messenger-fetch.ts`, `contacts.ts`, …) und **einem dünnen Re-Export** — nicht zwingend „nur eine Zeile pro Funktion“ in `api.ts`. |
| **Import-Richtung** | `features/*` **darf nicht** untereinander **Kreise** bauen; geteilte Typen in `features/_shared` oder `lib/messenger-types.ts` — Details schrittweise mit ESLint-`import/no-restricted-paths` o. Ä., wenn stabil. |
| **Tests pro Scheibe** | Jede extrahierte **Einheit** (reine Funktion oder Hook mit klarem Port): **mindestens ein** Vitest — siehe **`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`**. |

**Ordner-Beispiele** (anpassen, wenn ein Bereich noch nicht existiert — kein leeres `beacon/`-Grab):

- `features/send/` — Versand, Payload, Timeouts, Online/Funk-Verzweigung (Anteil aus `handle-send` / Send-Hooks).  
- `features/inbox/` — Merge, Filter, Laden, Dedup-Anzeige.  
- `features/attachments/` — Pick, Ingest, Kompaktbild, LoRa-Stufen.  
- `features/voice/` — Aufnahme, Opus-Pfad.  
- `features/export/` — Einsatzprotokoll / ZIP / verwandte UI.  
- **`features/beacon/`** oder **`features/location/`** — **nur** anlegen, wenn **Spec/Backlog** aktiv bearbeitet wird (sonst **nicht** leere Hülsen pflegen).

---

## 4. Drei Phasen (realistisch, an eure Lage angepasst)

### Phase 1 — Struktur sichtbar machen (ca. 1–2 Wochen, parallel zu kleinen Fixes)

- **Feature-Ordner** anlegen und **bestehende** Dateien **verschieben** (Imports anpassen), **ohne** Verhalten zu ändern — idealerweise **eine vertikale Scheibe** pro Woche (z. B. nur **attachments** oder nur **voice**), damit Git **bisect-fähig** bleibt.  
- **Leichte** Konvention dokumentieren (dieses Dokument + **ein** Absatz in **`MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`** oder Diagramm).  
- **`api.ts`:** erste Aufteilung in **`lib/api/*.ts`** + Re-Export (bereits vorhandene Helfer wie `api-fetch-text` bleiben unter `lib/`). **Inventar und Konvention:** **`docs/FRONTEND-API-MODULARITY.md`**.

**Erfolgskriterium:** Ordnerstruktur + grüne **`tsc`** + **`npm run test:frontend-unit`** + Smoke-Teilmenge wie in **`TESTING.md`**.

### Phase 2 — Kopplung reduzieren (ca. 2–4 Wochen, nach 1–2 erfolgreichen Scheiben)

- **Stärkste Kanten** identifizieren (z. B. gemeinsamer State zwischen **Send** und **Inbox**): **kleine Interfaces** („Port“) statt direkter Hook-zu-Hook-Imports.  
- **Vitest** für extrahierte **reine** Funktionen; für UI: **dünne RTL-Tests** auf kritische Trigger (siehe Phase-A-Doku).  
- **Kein** paralleles Großprojekt in denselben Mesh-BLE-Dateien wie **Phase B** — Zeitfenster mit **`PROJECT-FOCUS`** abstimmen.

**Erfolgskriterium:** Weniger **zyklische** Imports; neue Features landen **standardmäßig** unter `features/<name>/`.

### Phase 3 — Optional: internes Paket `@morgendrot/messenger-core`

- **Nur**, wenn ein **zweiter Consumer** real ist (z. B. **Lite-UI** ohne volles Dashboard, CLI-Tool, zweiter Entry-Point).  
- **Sonst:** Monorepo mit **klaren Ordnergrenzen** reicht — extrahiertes NPM-Paket ohne Consumer ist **mehr Build-Komplexität** als Nutzen.

---

## 5. Was absichtlich *nicht* in diesem Dokument steht

- **Vollständige** Trennung von **Backend** (`src/`) und **Frontend** — hier nur **Messenger-UI** im Next-`frontend/`.  
- **Ersetzen** der **API-Fassade** durch Microservices — nicht Ziel.

---

*Stand: 2026-03-28 — in den Fahrplan aufgenommen als **§ H.1b**.*
