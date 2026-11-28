# Alpha-EXE — Morgendrot Messenger (Windows Portable)

**Stand:** 2026-11-28 · Scheibe A/B (Roadmap Block B Schritt 3) · UI = **Next-Messenger** (wie `npm run dm`)

## Was du bekommst

| Scheibe | Artefakt | Doppelklick |
|---------|----------|-------------|
| **A** | `exports/messenger-desktop-exe/Morgendrot-Messenger-Portable.exe` | Electron-Fenster |
| **B** | gleicher Build + klare Voraussetzungen | Start ohne `npm start` tippen |

**UI:** Electron öffnet **Next auf Port 3341** (Messenger-Dashboard) — **nicht** die Lite-UI (`ui/index.html` am API-Port). Intern startet `main.cjs` API (:3342) + `frontend` `dev:messenger:localhost` (:3341), analog zu `npm run dm`.

## Ehrliche Voraussetzungen (kein Schönreden)

Die Portable-`.exe` startet **Electron** und darin API + Next (`main.cjs`). Braucht weiterhin:

1. **Node.js** im PATH (wie bisher für `npm run dm`), und  
2. das **Morgendrot-Repo** mit `frontend/` (npm install dort + Root) — siehe `morgendrot-messenger-desktop/main.cjs` → `getRepoRoot()`.

Das ist **kein** vollständiger Offline-Installer mit eingebettetem Node (das wäre eine größere Scheibe C).

## Bauen

```bash
# Im Repo-Root: Dependencies Desktop inkl. electron-builder
cd morgendrot-messenger-desktop
npm install
npm run dist:win-portable
```

Oder Root: `npm run desktop:exe` (falls Script gesetzt).

Ausgabe: **`exports/messenger-desktop-exe/Morgendrot-Messenger-Portable.exe`**

## Test (Abnahme Scheibe A/B)

1. Node installiert (`node -v`).  
2. Repo mit gültiger `.env` / Tresor wie für `npm run dm`.  
3. Artefakt bauen falls fehlt: `npm run desktop:exe` → `exports/messenger-desktop-exe/Morgendrot-Messenger-Portable.exe`.  
4. **EXE nicht verschieben** — sie muss unter `exports/messenger-desktop-exe/` (im Repo-Baum) bleiben, damit `main.cjs` das Repo findet (`PORTABLE_EXECUTABLE_DIR` → 2 Ebenen hoch).  
5. Doppelklick Portable-EXE → „Messenger startet …“ → **Next-Messenger** (gleiche UI wie `npm run dm`).  
6. Tresor entsperren; kurz Posteingang/„Ich“ prüfen.  
7. Fenster schließen → API + Next sollen enden.

**Hinweis:** EXE = Start-Ritual fürs Repo (kein eingebettetes Node/Next-Bundle). Ports **3342** (API) und **3341** (Next) müssen frei sein — laufendes `npm run dm` vorher beenden.

**Wenn Doppelklick „nichts“ tut:** oft hängt noch eine alte Instanz ohne Fenster (Single-Instance-Lock). Task-Manager: `Morgendrot-Messenger*` beenden, dann erneut starten. Ab 2026-11-28: Repo-Suche auch über Portable-Exe-Pfad (kein stiller Crash mehr bei Temp-Entpackung).

## Alternativen ohne EXE-Build

- `morgendrot-messenger-desktop/Start-Messenger.bat` (nach `npm install` dort)  
- `npm start` im Desktop-Ordner  

## Nicht-Ziel jetzt

Code-Signing · Auto-Update · NSIS-Installer ohne Node · Einbettung kompletter Node-Runtime.
