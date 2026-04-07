# PWA – manuelle Prüf (Feldtest / Release)

**Zweck:** Abgleich mit **`docs/ROADMAP-FAHRPLAN.md`** § **H.2** (Priorität 1 aus der 8-Punkte-Liste: PWA-Realität). **Kein** Ersatz für automatische Tests — ergänzt **`TESTING.md`** (Smoke) um **Installation** und **Offline-Shell**.

**Hintergrund:** **`docs/PWA-HANDBUCH-OFFLINE.md`** (was der Service Worker wirklich cached).

---

## Voraussetzungen

- Messenger-PWA gebaut oder im Dev-Modus: Root **`npm run dev`** → Next **http://127.0.0.1:3341/**, API wie in **`docs/DEV-START.md`**.
- **Chrome/Edge (Android/Desktop):** „Zum Startbildschirm hinzufügen“ / Install-Prompt ist plattformabhängig; **iOS Safari** hat andere Install-Regeln (Teilen → „Zum Home-Bildschirm“).

---

## Checkliste (kurz)

| # | Prüfung | Erwartung |
|---|---------|-----------|
| 1 | **Install** | App lässt sich als installierbare PWA hinzufügen (Manifest + SW aktiv; in Dev ggf. nur über Menü — normal). |
| 2 | **Start vom Icon** | Nach Installation öffnet die App **ohne** Adresszeilen-Fokus auf die Messenger-Oberfläche (kein harter Fehler beim Start). |
| 3 | **Offline-Shell** | Flugmodus / Netz aus: zuvor besuchte **statische** Assets (**`/_next/static/*`**) und App-UI oft noch nutzbar; **`/api/*`** bleibt offline **nicht** zuverlässig (Hinweis „offline“ / Fehler ist ok). |
| 4 | **Handbuch offline** | Einmal **`/handbook`** mit Netz laden, dann offline: Markdown-Inhalt der kopierten Dateien (**`BOSS-ORIENTIERUNG.md`**, **`PWA-HANDBUCH-OFFLINE.md`**) lesbar, sofern SW-Cache greift — siehe **`frontend/public/sw.js`** (`HANDBOOK_URLS`, `VERSION`). |
| 5 | **Icons nach SVG-Änderung** | Wenn **`frontend/public/icon.svg`** geändert wurde: **`npm run build:pwa-icons`** (Manifest/PNG) — **`docs/ROADMAP-FAHRPLAN.md`** § **H.4**. |

---

## Optional (Backlog)

- Dedizierte **Offline-Fallback-Seite** (eigene Route) — nur wenn Produkt das verlangt; aktuell: statische Shell + begrenzte Offline-Nutzung.

---

*Bei Änderungen am Service Worker: **`VERSION`** in **`frontend/public/sw.js`** erhöhen, damit Clients den neuen Worker ziehen.*
