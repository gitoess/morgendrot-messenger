## Änderung

<!-- Kurz: was & warum -->

## Checks (Messenger / `frontend/` berührt?)

- [ ] **`TESTING.md`** § *Qualitätsritual vor Merge* ausgeführt (oder CI grün: **`.github/workflows/frontend-checks.yml`** — inkl. `build` + `build:messenger`)
- [ ] Root: `npx tsc --noEmit`, `npm run validate:ui`, `npm run test:smoke` wo sinnvoll
- [ ] Dashboard-Shell geändert (`messenger-dashboard` / `projekt-dashboard` / `use-dashboard-session`): lokal **`npm run dev`** und **`npm run dev:messenger`** kurz angetestet
- [ ] Bei Änderungen an **`docs/BOSS-ORIENTIERUNG.md`** oder **`docs/PWA-HANDBUCH-OFFLINE.md`**: `npm run sync:handbook`

## Fahrplan / Doku

- [ ] Bei inhaltlichem Scope: **`docs/ROADMAP-FAHRPLAN.md`** oder betroffene Spec (z. B. **§ H.0-SIMPLE**, **`docs/POSITIONING.md`**)
