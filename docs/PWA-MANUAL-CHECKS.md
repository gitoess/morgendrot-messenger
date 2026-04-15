# PWA – manuelle Prüf (Feldtest / Release)

**Zweck:** Abgleich mit **`docs/ROADMAP-FAHRPLAN.md`** § **H.2** (Priorität 1 aus der 8-Punkte-Liste: PWA-Realität). **Kein** Ersatz für automatische Tests — ergänzt **`TESTING.md`** (Smoke) um **Installation** und **Offline-Shell**. **Reihenfolge:** **`docs/ROADMAP-FAHRPLAN.md`** § **C.0b** — **§ H.2** vor **§ H.8** (Dienst/Testnet-Doku **`docs/DIENST-VS-PRIVAT-NETZ-PROFIL.md`**, ohne Profilwahl-Pflicht).

**Hintergrund:** **`docs/PWA-HANDBUCH-OFFLINE.md`** (was der Service Worker wirklich cached). **Größere Offline-Karten / Geodaten (Zielbild, Einsatz vs. Wanderer):** **`docs/OFFLINE-KARTEN-UND-GEODATEN-ZIELBILD.md`** (**Fahrplan § H.11**). **Wann nach diesen Checks am Smartphone weitermachen:** **`docs/HANDY-TEST-WINDOW.md`**.

---

## Vorprüfung am Schreibtisch (ohne Smartphone — **§ H.0 #5**)

Vor Feldtest oder Release: dieselbe Logik wie Handbuch-Sync, ohne Install-Prompt zu simulieren.

| # | Aktion | Erwartung |
|---|--------|-----------|
| A | Root: **`npm run build:pwa-icons`** | Nach Änderung an **`frontend/public/icon.svg`** — PNG/Manifest-Icons aktualisiert (**Roadmap § H.4**). |
| B | Root: **`npm run sync:handbook`** (oder nur **`frontend/`:** **`npm run build`**, dann sync’t **`prebuild`**) | Dateien unter **`frontend/public/handbook/`** entsprechen **`scripts/sync-pwa-handbook.mjs`**. |
| C | **`frontend/`:** **`npm run build`** | **`prebuild`** → Handbuch-Sync; **`next build`** ohne Fehler = PWA-Bundle inkl. SW/Manifest konsistent. |
| D | Bei Änderung an **`frontend/public/sw.js`:** **`VERSION`** (`morgendrot-sw-*`) erhöhen | Browser laden den neuen Service Worker; **`HANDBOOK_URLS`** muss zu den kopierten **`/handbook/*.md`** passen. |

### Automatisierte Vorprüfung (Root)

| Befehl | Entspricht | Dauer (typ.) |
|--------|------------|--------------|
| **`npm run check:pwa-desk`** | **A** + **B** (Icons aus `icon.svg`, Handbuch → `frontend/public/handbook/`) | kurz |
| **`npm run check:pwa-desk:full`** | **A** + **B** + **C** (`frontend/` → `prebuild` + **`next build`**) | länger — vor Release/Feldtest |

**D** bleibt **manuell** (Konstante in `sw.js` + danach L4/L5 am Browser).

**Hinweis:** Die **kurze Checkliste** unten (Install, Offline, …) bleibt **manuell** am Gerät — Tabelle A–D ersetzt sie nicht.

### Status-/Fehlermeldungen (Messenger ↔ API, **§ H.2** Punkt 6)

- Kanonische Nutzer-Strings für Fetch-**Timeout** und **Netzwerk/Offline**: **`frontend/frontend/lib/api-fetch-text.ts`** (`USER_MSG_FETCH_TIMEOUT`, `USER_MSG_FETCH_NETWORK_OFFLINE`, `userMessageIndicatesFetchNetworkFailure`).
- Inbox-Banner („Basis offline“) nutzt dieselbe Erkennung: **`frontend/frontend/features/inbox/inbox-load-error.ts`**.

### Protokoll (manuell pflegen)

| Datum | build:pwa-icons | sync:handbook | frontend build | Bemerkung |
|-------|-------------------|---------------|----------------|------------|
| 2026-03-28 | ✓ | ✓ (10 Dateien) | ✓ | **§ H.2** nach Fahrplan-Reihenfolge: **`npm run check:pwa-desk:full`** (A+B+C) grün; **`src/shared/*`** relative Imports ohne **`.js`-Suffix** für Turbopack (**Next 16.1.6**). **L1–L5** am Gerät separat. |
| 2026-03-29 | ✓ | ✓ (10 Dateien) | — | **§ C.0b / § H.2:** `npm run check:pwa-desk` (A+B) nach Fahrplan-Schritt; **C**/`check:pwa-desk:full` bei Release-Zyklus; **L1–L5** weiter am Gerät. |
| 2026-03-28 | ✓ | ✓ (8 Dateien) | ✓ | **§ C.0b / § H.2:** `check:pwa-desk` + `check:pwa-desk:full`; Handbook-Sync (**`PWA-HANDBUCH-OFFLINE.md`** u. a.); **`next-env.d.ts`** nach `next build`. |
| 2026-03-30 | ✓ | ✓ (7 Dateien) | ✓ | A–C; **D** zunächst ohne SW-Edit. |
| 2026-03-30 | — | ✓ (8 Dateien) | empfohlen | **D:** `VERSION` → **`morgendrot-sw-4`**; **`API-EINSATZ-ROLE-TEMPLATES.md`** in `sync-pwa-handbook` + `HANDBOOK_URLS` — nach Deploy: Handbuch einmal online öffnen (L4). |
| 2026-03-31 | ✓ | ✓ (8 Dateien) | ✓ | A–C nach § **H.2**-Folgeschritt (Punkt 6: Fetch-/Inbox-Offline-Texte an `api-fetch-text`); **D** nur bei `sw.js`-Edit. Root: **`npm run check:pwa-desk`** (= A+B), **`check:pwa-desk:full`** (+ C) — **`scripts/check-pwa-manual-desk.mjs`**; Lücken-Tabelle **Teil-Automatisierung**. |
| 2026-04-15 | ✓ | ✓ (8 Dateien) | — | **A+B** (`npm run check:pwa-desk`) nach Messenger-/Chain-Testrunde + Doku-Update; **C**/`full` bei nächstem Release-Zyklus. |
| 2026-04-16 | ✓ | ✓ (8 Dateien) | ✓ | **A+B+C** (`npm run check:pwa-desk:full`); Next **16.1.6**; **`frontend/next-env.d.ts`** → `./.next/types/routes.d.ts` nach Production-Build. Manuelle **L1–L5** (`§ H.2`) weiter separat. |
| 2026-04-28 | ✓ | ✓ (10 Dateien) | empfohlen | **§ H.15** Stufe 2–3 + **§ H.0** + **§ H.2:** neue Handbuch-Dateien (**`ONBOARDING-WALLET-UX-SPEC.md`**, **`RECOVERY-PHRASE-BACKUP.md`**); **`sw.js`** → **`morgendrot-sw-6`** + **`HANDBOOK_URLS`**; Doku **`HANDY-FIRST-STAGE2-*`**, **`SYNC-*`** § 8. **D** nach Deploy; **A+B** (`check:pwa-desk`) / bei Release **C** (`full`); **L1–L5** am Gerät. |

---

## Voraussetzungen

- Messenger-PWA gebaut oder im Dev-Modus: Root **`npm run dev`** → Next **http://127.0.0.1:3341/**, API wie in **`docs/DEV-START.md`**. (**`npm start`** allein startet **kein** Next — nur **3342**; siehe **`docs/DEV-START.md`** Tabelle oben.)
- **Chrome/Edge (Android/Desktop):** „Zum Startbildschirm hinzufügen“ / Install-Prompt ist plattformabhängig; **iOS Safari** hat andere Install-Regeln (Teilen → „Zum Home-Bildschirm“).

---

## Checkliste (kurz)

| # | Prüfung | Erwartung |
|---|---------|-----------|
| 1 | **Install** | App lässt sich als installierbare PWA hinzufügen (Manifest + SW aktiv; in Dev ggf. nur über Menü — normal). |
| 2 | **Start vom Icon** | Nach Installation öffnet die App **ohne** Adresszeilen-Fokus auf die Messenger-Oberfläche (kein harter Fehler beim Start). |
| 3 | **Offline-Shell** | Flugmodus / Netz aus: zuvor besuchte **statische** Assets (**`/_next/static/*`**) und App-UI oft noch nutzbar; **`/api/*`** bleibt offline **nicht** zuverlässig (Hinweis „offline“ / Fehler ist ok). |
| 4 | **Handbuch offline** | Einmal **`/handbook`** mit Netz laden, dann offline: Markdown-Inhalt der in **`HANDBOOK_URLS`** eingetragenen Dateien (u. a. **`BOSS-ORIENTIERUNG.md`**, **`API-EINSATZ-ROLE-TEMPLATES.md`**, **`PWA-HANDBUCH-OFFLINE.md`**) lesbar, sofern SW-Cache greift — siehe **`frontend/public/sw.js`**. |
| 5 | **Icons nach SVG-Änderung** | Wenn **`frontend/public/icon.svg`** geändert wurde: **`npm run build:pwa-icons`** (Manifest/PNG) — **`docs/ROADMAP-FAHRPLAN.md`** § **H.4**. |

### Lücken / nur am Gerät (nicht im CI ersetzbar)

| # | Thema | Stand / nächste Aktion | Teil-Automatisierung (CI / Schreibtisch) |
|---|--------|-------------------------|------------------------------------------|
| L1 | **Install (#1)** | Chrome/Edge „App installieren“ bzw. Android-Menü; **iOS Safari**: Teilen → „Zum Home-Bildschirm“ — einmal pro Zielgerät prüfen. | Playwright deckt **kein** OS-Install-Prompt ab; Messenger-Smoke: **`e2e/messenger-ui.spec.ts`** (Dashboard sichtbar), nur wenn **`UI_BASE_URL`** Next Messenger. |
| L2 | **Start vom Icon (#2)** | Nach L1: Kaltstart, kein harter JS-Fehler; ggf. Rollen-Dashboard vs. Messenger-Pfad. | Nur Gerät / manueller Kaltstart vom Icon. |
| L3 | **Offline-Shell (#3)** | Flugmodus: erwartbar, dass **`/api/*`** fehlschlägt; prüfen, ob Shell/`/_next/static` noch sinnvoll reagiert (kein weißer Screen). | Nutzer-Strings Timeout/Offline: Vitest **`api-fetch-text`** + **`inbox-load-error`**; kein Ersatz für echtes Flugmodus-Verhalten. |
| L4 | **Handbuch offline (#4)** | Einmal **`/handbook`** online laden, dann offline — inhaltliche Lesbarkeit; Abgleich mit **`HANDBOOK_URLS`** in **`frontend/public/sw.js`**. | **`npm run check:pwa-desk`** synchronisiert Quellen; SW-Cache-Verhalten = Browser. |
| L5 | **Service-Worker-Update (Tabelle D)** | Bei jedem bewussten **`sw.js`-Edit:** Konstante **`VERSION`** (`morgendrot-sw-*`) erhöhen und erneut L3/L4 testen. | Kein Skript — nur Review der **`VERSION`**-Zeile im Diff. |

---

## Optional (Backlog)

- Dedizierte **Offline-Fallback-Seite** (eigene Route) — nur wenn Produkt das verlangt; aktuell: statische Shell + begrenzte Offline-Nutzung.

---

*Bei Änderungen am Service Worker: **`VERSION`** in **`frontend/public/sw.js`** erhöhen, damit Clients den neuen Worker ziehen.*
