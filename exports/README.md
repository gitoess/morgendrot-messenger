# Export-Ordner für Geräte

## Raspi (`Morgendrot-Raspi-headless` / `Morgendrot-Raspi-lite-ui`)

Die Boss-UI kann mit **„Export → Raspi …“** schreiben:

- `.env`, `config.json`, optional `template-….json`

**Wichtig:** Das sind **keine** lauffähigen Mini-Ordner. Auf dem Raspi brauchst du **zusätzlich** den **Anwendungscode** (z. B. vollständiges Morgendrot-Repo oder euren Deployment-Ordner mit `src/`, `ui/`, `package.json`). Dann die exportierten Dateien in dieses Projekt legen (oder `.env` ersetzen) und **`npm install`** + Start wie in der Haupt-`README`.

## Messenger-Bundles (`Morgendrot-Messenger-standalone` + `Morgendrot-Messenger-verkauf`)

Ziel: **ein Ordner pro Edition**, den du auf einen beliebigen PC kopierst – nach **`npm install`** läuft der Messenger (Lite-UI = `ui/` + API), optional **`npm run desktop`** (Electron).

**Hinweis zur Produktstrategie:** Die **Next.js-App** (`frontend/` im Hauptrepo, Kunden-Dashboard) ist **nicht** Teil dieser ZIP-Bundles; sie ist die separate **Kunden-Oberfläche** bei `npm run dev`. Boss-Administration (Batch, Exporte, tiefe Konfig) bleibt in **`ui/`** – siehe **`docs/DEV-START.md`** (*Zwei Oberflächen*).

| Ordner | `MESSENGER_EDITION` (in `npm start`) | Einsatz |
|--------|--------------------------------------|---------|
| `Morgendrot-Messenger-standalone` | `standalone` | Plug-and-Play, Boss-Export, Entwickler |
| `Morgendrot-Messenger-verkauf` | `sales` | Kunden: UI „Verkaufs-Messenger“, Fokus Schatten-Seed / Sweep (siehe README im Ordner) |

1. **Im Entwicklungs-Repo (einmal):**  
   `npm run bundle:messenger`  
   → legt **beide** Ordner unter `exports/` an (gleicher Code, unterschiedliche `package.json` / README / `.env.example`).  
   Optional nur eine Edition: `npm run bundle:messenger:standalone` bzw. `npm run bundle:messenger:sales`.

2. **Konfiguration (empfohlen: eigenständiger Messenger-Export):**  
   In der Boss-Lite-UI Abschnitt **„Messenger exportieren (ohne Geräte-Wizard)“** → Stapel erzeugt `exports/messenger-shipments/<Run>/u001…` mit reiner Messenger-`.env` (kein Arbeiter/Lock-Rauschen) + `boss-only/manifest.json` (Signer-Imports). **Felder & Limits:** **`docs/MESSENGER-EXPORT-FIELDS.md`**. Vollständige ZIP-Ordner: nach `npm run bundle:messenger` **`npm run assemble:messenger-units -- <Run> sales`** (oder `standalone`).  
   **Legacy:** Nach Geräte-Provisioning **„Export → Standalone- / Verkaufs-Ordner“** – kann weiterhin Lock/Listener aus dem gewählten Profil mitziehen; nur nutzen, wenn bewusst dieselbe `.env` wie für ein anderes Gerät gewünscht ist.

3. **Auf dem Ziel-PC:**  
   Den **gesamten** gewählten Ordner kopieren → darin **`npm install`** → **`npm start`** oder **`npm run desktop`**.

Die Ordner sind per `.gitignore` vom Repo ausgeschlossen (Größe + Secrets); bauen und verteilen lokal oder über eure Release-Pipeline.
