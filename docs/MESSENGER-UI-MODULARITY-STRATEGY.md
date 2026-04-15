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

**Erfolgskriterium:** Ordnerstruktur + grüne **`tsc`** (Root + **`frontend/`**) + **`npm run test:frontend-unit`** + **`npm run lint`** + **`npm run check:circular`** im Ordner **`frontend/`** + Root-**`test:smoke`** — gebündelt als **Qualitätsritual** in **`TESTING.md`** § *Qualitätsritual vor Merge*.

### Phase 2 — Kopplung reduzieren (ca. 2–4 Wochen, nach 1–2 erfolgreichen Scheiben)

- **ESLint** (`frontend/eslint.config.mjs`): **`features/inbox`** darf **`features/send`** und **`features/attachments`** nicht importieren; **`features/attachments`** darf **`features/inbox`** nicht importieren (gemeinsame Typen/Helfer über **`lib/`** oder **`shared/`**).  
- **Stärkste Kanten** identifizieren (z. B. gemeinsamer State zwischen **Send** und **Inbox**): **kleine Interfaces** („Port“) statt direkter Hook-zu-Hook-Imports.  
- **Vitest** für extrahierte **reine** Funktionen; für UI: **dünne RTL-Tests** auf kritische Trigger (siehe Phase-A-Doku).  
- **Kein** paralleles Großprojekt in denselben Mesh-BLE-Dateien wie **Phase B** — Zeitfenster mit **`PROJECT-FOCUS`** abstimmen.

**Erfolgskriterium:** Weniger **zyklische** Imports; neue Features landen **standardmäßig** unter `features/<name>/`.

### Phase 3 — Optional: internes Paket `@morgendrot/messenger-core`

- **Nur**, wenn ein **zweiter Consumer** real ist (z. B. **Lite-UI** ohne volles Dashboard, CLI-Tool, zweiter Entry-Point).  
- **Sonst:** Monorepo mit **klaren Ordnergrenzen** reicht — extrahiertes NPM-Paket ohne Consumer ist **mehr Build-Komplexität** als Nutzen.

---

## 5. Schritt für Schritt (operativ, **§ H.1b**)

**Prinzip:** Immer **eine vertikale Scheibe** (z. B. nur *attachments* oder nur *voice*), **kein** großer Umbau parallel zum **Mesh-Kern** (**Phase B**). Nach jeder Scheibe: Ritual unten — dann Merge oder nächste Scheibe.

### Stufe 0 — Scheibe wählen & Zeitfenster

1. **Thema festlegen** (ein Ordner aus § 3: z. B. `features/send/`, `features/inbox/`, `features/attachments/`).  
2. **Kollision prüfen:** Läuft parallel ein **Mesh-/BLE-/handle-send**-Großeingriff? Wenn ja — **warten** oder Scheibe verschieben (**`docs/ROADMAP-FAHRPLAN.md`** § **H.1b** / **§ C.0b**).  
3. **Ziel formulieren** (ein Satz): z. B. „Inbox-Filter-Helfer nach `lib/` verschieben, Imports nur anpassieren“.

### Stufe 1 — Ist verstehen (kurz)

4. **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`** und **`docs/FRONTEND-API-MODULARITY.md`** für betroffene Pfade lesen (oder nur die betroffenen Abschnitte).  
5. Optional: **`npm run check:circular`** im Ordner **`frontend/`** *vor* der Änderung — Basislinie, falls später ein neuer Zyklus auftaucht.

### Stufe 2 — Struktur (Phase 1 aus § 4)

6. **Feature-Heimat:** Code nur unter dem gewählten `features/<name>/` (oder **`lib/`** / **`lib/api/`** für reine Helfer) anlegen oder dorthin **verschieben** — **Verhalten unverändert**, vor allem **keine** Logikänderung in derselben PR, wenn möglich.  
7. **API:** Neue oder verschobene Aufrufe über **`lib/api/<domäne>.ts`** spiegeln; öffentlicher Einstieg für App-Code weiterhin **`@/frontend/lib/api`** (**`frontend/frontend/lib/api.ts`**).  
8. **Imports:** Relative Pfade konsolidieren; **keine** neuen Verstöße gegen **`frontend/eslint.config.mjs`** (aktuell: **send**↔**inbox**, **inbox**↔**attachments**, **attachments**→**inbox**). Wenn eine **neue** problematische Kante messbar wird → erst **Umweg** über `lib/` / gemeinsame Typen, **dann** optional Regel in ESLint nachziehen (**Roadmap** „Als Nächstes“ (b)).

### Stufe 3 — Kopplung (Phase 2 aus § 4, nur wenn nötig)

9. **Stärkste Kante:** Wo importiert Send noch Inbox (oder umgekehrt)? **Port** (kleines Interface / Callback-Props) oder Verschiebung von **reiner** Logik nach **`lib/`** — weiterhin **kleine** Diff.  
10. **Tests:** Pro extrahierter **reiner** Funktion oder kritischem UI-Trigger mindestens **ein** Vitest / RTL-Slice (**`docs/PHASE-A-QUALITY-BASELINE-AND-TESTS.md`**, **§ H.1a**).

### Stufe 4 — Qualitätsgitter (vor Merge)

Im Ordner **`frontend/`** bzw. Repo-Root wie in **`TESTING.md`** § *Qualitätsritual vor Merge*:

| # | Befehl | Zweck |
|---|--------|--------|
| 1 | `npx tsc --noEmit` (Root) | Root-Types |
| 2 | `cd frontend` → `npx tsc --noEmit` | Next-/Messenger-`tsconfig` |
| 3 | `npm run lint` | ESLint inkl. Feature-Grenzen |
| 4 | `npm run check:circular` | madge, keine neuen Zyklen unter `./frontend` |
| 5 | `npm run test:unit` | Vitest |
| 6 | (Root) `npm run validate:ui` + `npm run test:smoke` | UI-Refs + Modultests |

CI-Spiegel: **`.github/workflows/frontend-checks.yml`**.

### Stufe 5 — Abschluss

11. **PR-Text:** eine Zeile *Scheibe* + *kein paralleler Mesh-Kern*; bei großen Dateien **Kurzbegründung** (§ 3 „Weiche Budgets“).  
12. **`docs/FRONTEND-API-MODULARITY.md`** oder dieses Dokument **eine Zeile** ergänzen, wenn sich eine **neue** Konvention ergibt.

**„Als Nächstes“ (Roadmap, klein):** (a) weiterer RTL-/Vitest-Slice **Send-Panel** / Inbox-Rand (**§ H.1a**); (b) ESLint-Zonen nur bei **messbaren** neuen Querimports; (c) optional: Imports auf **`@/frontend/lib/api`** vereinheitlichen (kosmetisch) — siehe **`docs/ROADMAP-FAHRPLAN.md`** § **H.1b** *Als Nächstes*.

---

## 6. Was absichtlich *nicht* in diesem Dokument steht

- **Vollständige** Trennung von **Backend** (`src/`) und **Frontend** — hier nur **Messenger-UI** im Next-`frontend/`.  
- **Ersetzen** der **API-Fassade** durch Microservices — nicht Ziel.

---

*Stand: 2026-03-29 — in den Fahrplan aufgenommen als **§ H.1b**; Erfolgskriterium an Merge-Ritual (**`TESTING.md`**) und CI **`frontend-checks`** angeglichen. **§ 5 Schritt-für-Schritt** ergänzt 2026-04-15.*

**Fortschritt 2026-04-15:** Messenger-Chain-Realworld **`test:messages*`** + Smoke/Vitest grün; **§ H.1b Stufe 2–3:** **`pickInboxRawMessages`** → **`lib/inbox-pick-raw-messages.ts`**, Re-Export in **`features/inbox/inbox-map-messages.ts`**, **`lib/api/inbox.ts`** importiert **`pick`** aus **`lib/`**; Vitest **`lib/inbox-pick-raw-messages.test.ts`**. Nächste Scheibe: bei messbaren Querimports ESLint nachziehen oder weiter **`lib/`**-Helfer — nicht parallel Mesh-Kern (**`docs/ROADMAP-FAHRPLAN.md`** § **H.1b** „Als Nächstes“).

**Fortschritt 2026-04-28:** **§ H.1b** Mini-Scheibe — **`SettingsWalletSessionCard`** in **`frontend/frontend/components/views/settings-wallet-session-card.tsx`** (aus **`settings-view.tsx`**); Verweis in **`frontend/frontend/features/README.md`**.
