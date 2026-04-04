# Morgendrot Messenger (Desktop)

Eigenständiges **Desktop-Fenster** (Electron): startet das Backend mit `UI_VARIANT=messenger`.

- **Entwicklung:** Ordner `morgendrot-messenger-desktop` liegt **im** Repo; `main.cjs` findet den Code **eine Ebene darüber** (Hauptprojekt).
- **Verteilung:** Nach `npm run bundle:messenger` liegt `main.cjs` **neben** `src/` in `exports/Morgendrot-Messenger-standalone/` – dort **`npm run desktop`** ohne übergeordnetes Repo.

## Einmalig

```bash
cd morgendrot-messenger-desktop
npm install
```

Voraussetzungen im **Hauptprojekt** (`..`): `npm install`, funktionierende `.env` (u. a. `ENABLE_UI=true`, Wallet/Secrets wie gewohnt).

## Start

```bash
npm start
```

Unter Windows geht auch ein Doppelklick auf **`Start-Messenger.bat`** (nach `npm install`).

## Verknüpfung unter Windows

1. Rechtsklick auf `morgendrot-messenger-desktop` → **Verknüpfung erstellen**.
2. Eigenschaften der Verknüpfung:
   - **Ziel:** `C:\Pfad\zu\nodejs\npm.cmd` (oder `npm.cmd` aus dem PATH; bei Bedarf vollen Pfad zu `npm.cmd` eintragen).
   - **Argumente:** `start`
   - **Ausführen in:** vollständiger Pfad zu `morgendrot-messenger-desktop`.

Oder **Ziel:** `cmd.exe` mit Argumenten `/c cd /d "C:\…\morgendrot-messenger-desktop" && npm start`.

Beim **Schließen des Fensters** wird das gestartete Backend beendet (Windows: Prozessbaum per `taskkill`).

## Hinweise

- Technisch dasselbe Backend wie Morgendrot; nur die Oberfläche ist auf Messenger reduziert.
- Läuft bereits eine **andere** Morgendrot-Instanz, kann der API-Port hochzählen (3343, …). Die App erkennt den Port an der Log-Zeile `Lite-UI: http://127.0.0.1:…/`.
- Der Ordner `morgendrot-messenger` (npm-Launcher ohne Electron) bleibt optional für reine Kommandozeilen-Nutzung.
