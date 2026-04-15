# Test-Lauflog (manuell gepflegt)

**Zweck:** Nachvollziehbare **Ist-Läufe** von Smoke-, Frontend-, Core- und Realworld-Kommandos — **kein** Ersatz für CI; dient **Boss/Release** und **Handy-Entscheid** (**`docs/HANDY-TEST-WINDOW.md`**).

**Regel:** Nach größeren Messenger-/Core-Änderungen oder vor **Messenger-Handy-Feldtest** eine Zeile ergänzen — idealerweise **`test:messages*`** getrennt von Ticket-Läufen (**`test:tickets-accesskey-realworld`** / Alias **`test:realworld`**), weil letztere **eine andere Kachel** sind und **nicht** zum Messenger-Smoke gehören.

---

## Einträge

| Datum | Umgebung | Kommandos / Notiz | Ergebnis |
|--------|-----------|---------------------|----------|
| **2026-03-29** | Repo lokal (Windows), nach Messenger-PWA-/Puls-/Dashboard-UX | Root: **`npm run test:smoke`** (36/36); **`cd frontend`**: **`npx tsc --noEmit`**, **`npm run lint`**, **`npm run test:unit`** (41 Dateien, 232 Tests) | **OK** — § **H.0/H.1/H.2**-Scheibe (PWA **standalone** → **`/vault-lock`** bei Hintergrund; **`sessionStorage`** letzte Kachel; Posteingang **Telefonbuch**; Puls **Ketten-IDs**-Normalize); **`next.config`** **`allowedDevOrigins`** Host-Format (**`DEV-START`**). Feldtest: **`HANDY-TEST-WINDOW`**, **`PWA-MANUAL-CHECKS`**. |
| **2026-03-28** | Repo lokal (Windows), Fahrplan-Paket **§ H.15 → § H.2** (Reihenfolge) | Root: **`npm run test:h15-direct-submit`**, **`npm run test:smoke`**; **`npm run check:pwa-desk:full`** (A+B+C); **`cd frontend`**: **`npm run lint`**, **`npm run lint:feature-boundaries`**, **`npm run test:unit`** (41 Dateien, 232 Tests) | **OK** — H.15-Vitest (3), Smoke 36/36, Next **16.1.6** Production-Build; ESLint inkl. Feature-Grenzen; Vitest grün. **§ H.15 Stufe 2 § 2** (Browser/Testnet, Basis stop/start, Moduswechsel) bleibt **manuell** — **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**. |
| **2026-03-28** | Repo lokal (Windows), nach TS-Kleinfix | **`cd frontend`**: **`npx tsc --noEmit`**, **`npm run lint`**, **`npm run check:circular`**, **`npm run test:unit`** (40 Dateien, 226 Tests); Root: **`npm run test:core`**, **`npm run test:h15-direct-submit`**, **`npm run test:smoke`** | **OK** — Frontend-`tsc` grün; Lint + madge grün; Vitest/Core/H.15/Smoke grün. Root **`npx tsc --noEmit`** weiterhin TS6059 (`rootDir` nur `src/` vs. `packages/morgendrot-core`) — bekannt; Qualität über Frontend-`tsc` + Core-Tests. |
| **2026-03-28** | API **:3342**, Windows, `.env`; Status vor Connect bereits `connected=true` / `locked=false` | **`npm run test:smoke`** | **OK** — 36 bestanden, 0 fehlgeschlagen (`validate:ui` + `npm run test`). |
| **2026-03-28** | selbe, `SINGLE_WALLET=1` | **`npm run test:messages:single`** | **OK** — Abschnitte **1**–**7** vollständig (kompaktes Bild, Handshake/Connect, `/send`/`/fetch`, Filter, Klartext, `purge-handshake`, `/vault-save`, `hasLocal`; Hinweiszeile Ticket-Skript am Ende). |
| **2026-03-28** | selbe | **`npm run test:frontend-unit`** | **OK** — 37 Testdateien, 219 Tests, ~6 s. |
| **2026-03-28** | selbe | **`npm run test:core`** | **OK** — 14 Dateien, 51 Tests (`@morgendrot/core`). |
| **2026-03-28** | selbe | **`npm run test:h15-direct-submit`** | **OK** — 3 Tests `direct-iota-plain-submit.test.ts`. |
| **2026-04-28** | Repo lokal (Windows), API **3342** laut `.env`, Wallet **locked** | **`npm run test:smoke`** | **OK** — 36/36 Modulgruppen (`validate:ui` + `npm run test`). |
| **2026-04-28** | selbe | **`npm run test:frontend-unit`** | **OK** — Vitest 37 Dateien, 219 Tests. |
| **2026-04-28** | selbe | **`npm run test:core`** | **OK** — `@morgendrot/core` 14 Dateien, 51 Tests. |
| **2026-04-28** | selbe | **`npm run test:h15-direct-submit`** | **OK** — 3 Tests `direct-iota-plain-submit.test.ts`. |
| **2026-04-28** | selbe | **`npm run test:messages`** (Default, zwei APIs) | **Nicht ausgeführt** — `ECONNREFUSED :3343` (zweite Instanz fehlt). Hinweis im Skript: **`npm run test:messages:single`** oder `$env:SINGLE_WALLET='1'`. |
| **2026-04-28** | selbe | **`$env:SINGLE_WALLET='1'; npm run test:messages`** | **Teil OK** — Chain/help/connect-Checks; **Send/Handshake/Kompaktbild** ab **1d** mit `locked=true` fehlgeschlagen („Wallet entsperren“). **Vollständiger Lauf:** API starten, dann **UI-Unlock** oder **`UNLOCK_PASSWORD`** (siehe **`scripts/run-messages-chat-realworld.ts`** Kopfkommentar, **`.env.example`**). |
| **2026-04-28** | selbe | **`npm run test:realworld`** | **Abbruch erwartbar** — gleiche Ursache `locked=true` (Tickets/Keys brauchen entsperrte Session). |
| **2026-04-28** | API **:3342**, `locked=false` (UI-Unlock), `SINGLE_WALLET=1` | **`npm run test:messages:single`** | **OK** — vollständiger Ablauf laut Skript (Einrichtung **1**–**7**: kompaktes Bild `/send-plain`, Handshake/Connect, `/send`/`/fetch`, Filter, Klartext, `purge-handshake`-Noop ohne `MAILBOX_ID`, `/vault-save`, `hasLocal`). |
| **2026-04-28** | selbe, Wallet entsperrt | **`npm run test:realworld`** | **Teil OK** — Ticket (1) Mint OK; (2) **FAIL** — **Client/Server api version mismatch** (IOTA-CLI ≠ RPC-API); (4) `hasValidTicket` **false** (Folge). **Maßnahme:** CLI-Version an **`RPC_URL`**-Server anpassen (**`TESTING.md`** Smoke, Punkt 3). |

---

## Bekannte Störung: „Client/Server api version mismatch“ (nur Ticket-/AccessKey-Skript)

- **Symptom:** **`npm run test:tickets-accesskey-realworld`** (Alias **`test:realworld`**) bricht bei **personalisiertem Ticket** / weiteren PTB-Schritten ab; Node/SDK und **IOTA-CLI** erwarten dieselbe **Wire-/API-Version**.
- **Lösung:** Auf dem Rechner die **IOTA-CLI** installieren/aktualisieren, die zur **`.env`**-**`RPC_URL`** passt (`iota client …` / Release-Notes des Netzes); **Ticket-Skript** erneut ausführen.
- **Abgrenzung:** **`npm run test:messages:single`** = **Messenger** (primär **Node-API**) — kann **grün** sein, während der **Ticket-Lauf** rot ist (CLI-Pfad). Messenger-Qualität **nicht** an den Ticket-Lauf koppeln.

---

## Nächste Pflege

- Nach CLI-Angleichung: **`test:tickets-accesskey-realworld`** erneut und Zeile oben **OK** ergänzen (inkl. Commit-Hash optional).
- CI: **`.github/workflows/frontend-checks.yml`** spiegelt Frontend-Unit; Root-Smoke lokal oder in eigener Pipeline pflegen.

---

*Stand: 2026-03-28 — u. a. Smoke + `test:messages:single` OK; Messenger/Ticket-Läufe getrennt.*
