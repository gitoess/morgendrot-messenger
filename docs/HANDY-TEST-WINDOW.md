# Wann die Messenger-PWA am **Handy** testen?

**Zweck:** Eine **einzige** Referenz für Timing und Voraussetzungen — ergänzt **`docs/PWA-MANUAL-CHECKS.md`**, **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**, **`docs/TEST-RUN-LOGBOOK.md`**.

---

## Kurzantwort

**Erst am Handy testen, wenn:**

1. **Schreibtisch** — Root **`npm run test:smoke`**, **`npm run test:frontend-unit`**, **`npm run test:core`**, **`npm run test:h15-direct-submit`** sind **grün** (oder CI-Äquivalent). Siehe **`docs/TEST-RUN-LOGBOOK.md`** für den letzten dokumentierten Lauf.
2. **Realworld (optional aber empfohlen vor Feldtest)** — **`npm run test:messages:single`** bzw. **`npm run test:realworld`** mit **entsperrter** API-Sitzung (UI-Unlock am laufenden **`npm run start:secrets`** / **`npm start`**, oder siehe Skriptköpfe zu **`UNLOCK_PASSWORD`*** in **`.env.example`** — **keine** Secrets in Git/Doku).
3. **Gleiche Version** — Die URL, die du auf dem Telefon öffnest (HTTPS oder **localhost** nur am PC), entspricht dem **Build**, den du gerade verifiziert hast; sonst vergleichst du unterschiedliche Stände.
4. **Nach Deploy / vor Abgabe** — Zusätzlich Schreibtisch **`npm run check:pwa-desk`** bzw. bei Release **`check:pwa-desk:full`** (**`docs/PWA-MANUAL-CHECKS.md`**), dann am Gerät **L1–L5** (Install, Offline-Shell, Handbuch, …).

**Nicht nötig** am Handy nach jedem reinen Doku- oder Backend-only-Commit, wenn sich **PWA / Puls / Direkt-IOTA** nicht geändert haben.

---

## Typische Reihenfolge (ein Abend)

| Schritt | Wo | Aktion |
|--------|-----|--------|
| 1 | PC | Merge-Ritual **`TESTING.md`** (inkl. **5c** bei Direkt-/Puls-Änderungen). |
| 2 | PC | **`npm run dev`** oder gebaute PWA — kurz im Desktop-Browser smoke. |
| 3 | Handy | **Gleiche** URL → Install / L1–L5 aus **`docs/PWA-MANUAL-CHECKS.md`**. |
| 4 | Handy | Nur wenn Direkt-IOTA relevant: **Puls** (RPC, Drain, Modus) wie **`HANDY-FIRST-STAGE2-…`**. |

---

*Stand: 2026-04-28 — Abgestimmt mit Fahrplan § H.2 / § H.15.*
