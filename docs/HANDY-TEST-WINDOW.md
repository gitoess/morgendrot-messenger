# Wann die Messenger-PWA am **Handy** testen?

**Zweck:** Eine **einzige** Referenz für Timing und Voraussetzungen — ergänzt **`docs/PWA-MANUAL-CHECKS.md`**, **`docs/HANDY-FIRST-STAGE2-CLIENT-SUBMIT-SMOKE.md`**, **`docs/TEST-RUN-LOGBOOK.md`**.

---

## Kurzantwort

**Erst am Handy testen, wenn:**

1. **Schreibtisch** — Root **`npm run test:smoke`**, **`npm run test:frontend-unit`**, **`npm run test:core`**, **`npm run test:h15-direct-submit`** sind **grün** (oder CI-Äquivalent). Siehe **`docs/TEST-RUN-LOGBOOK.md`** für den letzten dokumentierten Lauf.
2. **Messenger-Chain (optional, vor Messenger-Feldtest empfohlen):** **`npm run test:messages:single`** mit **entsperrter** API-Sitzung (UI-Unlock an **`npm run start:secrets`** / **`npm start`**, oder **`UNLOCK_PASSWORD`*** laut Skriptkopf / **`.env.example`**). Das reicht als **Schreibtisch-Gate für den Messenger** — **ohne** Ticket-Skript.  
   **Ticket-/AccessKey-Kachel** (eigener Zweck): nur bei Bedarf **`npm run test:tickets-accesskey-realworld`** (Alias **`test:realworld`**); **nicht** Teil des Messenger-Handy-Gates. Wenn nur die **IOTA-CLI** nicht zur **RPC_URL** passt, kann der Messenger-Lauf **grün** bleiben und der Ticket-Lauf rot — siehe **`docs/TEST-RUN-LOGBOOK.md`** („api version mismatch“).
3. **Gleiche Version** — Die URL, die du auf dem Telefon öffnest (HTTPS oder **localhost** nur am PC), entspricht dem **Build**, den du gerade verifiziert hast; sonst vergleichst du unterschiedliche Stände.
4. **Nach Deploy / vor Abgabe** — Zusätzlich Schreibtisch **`npm run check:pwa-desk`** bzw. bei Release **`check:pwa-desk:full`** (**`docs/PWA-MANUAL-CHECKS.md`**), dann am Gerät **L1–L5** (Install, Offline-Shell, Handbuch, …).
5. **Installierte PWA** — Wenn sich **Sperrverhalten** oder **Dashboard-Kachel-Persistenz** ändern: einmal **App schließen / Hintergrund** → erneut öffnen prüfen (**`/vault-lock`**, Unlock, ob die **letzte Kachel** wiederhergestellt wird) — **`docs/ONBOARDING-WALLET-UX-SPEC.md`** § 2.2.1.

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

*Stand: 2026-03-29 — Abgestimmt mit Fahrplan § H.0 / § H.2 / § H.15; § 2.2.1 in **`docs/ONBOARDING-WALLET-UX-SPEC.md`** (installierte PWA).*
