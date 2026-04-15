# Test-Lauflog (manuell gepflegt)

**Zweck:** Nachvollziehbare **Ist-Läufe** von Smoke-, Frontend-, Core- und Realworld-Kommandos — **kein** Ersatz für CI; dient **Boss/Release** und **Handy-Entscheid** (**`docs/HANDY-TEST-WINDOW.md`**).

**Regel:** Nach größeren Messenger-/Core-Änderungen oder vor **Handy-Feldtest** eine Zeile ergänzen.

---

## Einträge

| Datum | Umgebung | Kommandos / Notiz | Ergebnis |
|--------|-----------|---------------------|----------|
| **2026-04-28** | Repo lokal (Windows), API **3342** laut `.env`, Wallet **locked** | **`npm run test:smoke`** | **OK** — 36/36 Modulgruppen (`validate:ui` + `npm run test`). |
| **2026-04-28** | selbe | **`npm run test:frontend-unit`** | **OK** — Vitest 37 Dateien, 219 Tests. |
| **2026-04-28** | selbe | **`npm run test:core`** | **OK** — `@morgendrot/core` 14 Dateien, 51 Tests. |
| **2026-04-28** | selbe | **`npm run test:h15-direct-submit`** | **OK** — 3 Tests `direct-iota-plain-submit.test.ts`. |
| **2026-04-28** | selbe | **`npm run test:messages`** (Default, zwei APIs) | **Nicht ausgeführt** — `ECONNREFUSED :3343` (zweite Instanz fehlt). Hinweis im Skript: **`npm run test:messages:single`** oder `$env:SINGLE_WALLET='1'`. |
| **2026-04-28** | selbe | **`$env:SINGLE_WALLET='1'; npm run test:messages`** | **Teil OK** — Chain/help/connect-Checks; **Send/Handshake/Kompaktbild** ab **1d** mit `locked=true` fehlgeschlagen („Wallet entsperren“). **Vollständiger Lauf:** API starten, dann **UI-Unlock** oder **`UNLOCK_PASSWORD`** (siehe **`scripts/run-messages-chat-realworld.ts`** Kopfkommentar, **`.env.example`**). |
| **2026-04-28** | selbe | **`npm run test:realworld`** | **Abbruch erwartbar** — gleiche Ursache `locked=true` (Tickets/Keys brauchen entsperrte Session). |

---

## Nächste Pflege

- Nach erfolgreichem Realworld-Lauf mit Unlock: neue Zeile mit **OK** und ggf. Commit-Hash.
- CI: **`.github/workflows/frontend-checks.yml`** spiegelt Frontend-Unit; Root-Smoke lokal oder in eigener Pipeline pflegen.

---

*Stand: 2026-04-28 — Erste Zeilen aus Agent-Lauf.*
