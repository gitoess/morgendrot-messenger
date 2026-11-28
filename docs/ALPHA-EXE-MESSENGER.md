# Alpha-EXE — Morgendrot Messenger (Windows Portable)

**Stand:** 2026-11-27 · Scheibe A/B (Roadmap Block B Schritt 3)

## Was du bekommst

| Scheibe | Artefakt | Doppelklick |
|---------|----------|-------------|
| **A** | `exports/messenger-desktop-exe/Morgendrot-Messenger-Portable.exe` | Electron-Fenster |
| **B** | gleicher Build + klare Voraussetzungen | Start ohne `npm start` tippen |

## Ehrliche Voraussetzungen (kein Schönreden)

Die Portable-`.exe` startet **Electron** und darin das bekannte Backend (`main.cjs`). Das Backend braucht weiterhin:

1. **Node.js** im PATH (wie bisher für `npm start`), und  
2. das **Morgendrot-Repo** (oder Standalone-Ordner mit `src/start-with-secrets.ts`) **neben** bzw. als Elternordner der Desktop-App — siehe `morgendrot-messenger-desktop/main.cjs` → `getRepoRoot()`.

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
4. Doppelklick Portable-EXE → Fenster „Backend startet …“ → Lite-UI.  
5. Chat öffnen (Tresor entsperren); kurz Posteingang/„Ich“ prüfen.  
6. Fenster schließen → Backend soll enden.

**Hinweis:** Die EXE startet Backend aus dem **Repo** (kein eingebettetes Node). Frontend-Änderungen (z. B. Profilbild B) siehst du in der EXE erst, wenn das gestartete Backend/UI denselben Stand lädt — bei Dev oft parallel `npm run dm` klarer zum Feature-Check; EXE = Start-/Pack-Ritual.

## Alternativen ohne EXE-Build

- `morgendrot-messenger-desktop/Start-Messenger.bat` (nach `npm install` dort)  
- `npm start` im Desktop-Ordner  

## Nicht-Ziel jetzt

Code-Signing · Auto-Update · NSIS-Installer ohne Node · Einbettung kompletter Node-Runtime.
