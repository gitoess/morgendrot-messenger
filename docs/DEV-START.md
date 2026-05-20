# Entwicklung starten

**Git / „gestern ging es“:** Viele Änderungen landen nur im Working Tree ohne Commit — dann wirkt `git log` „alt“, obwohl täglich entwickelt wird. Rhythmus, Rollback, Messenger-Kernpfade: **`docs/ENTWICKLUNGS-RHYTHMUS-GIT.md`**.

## Wichtig: `npm start` ≠ Next auf Port 3341

| Befehl | Port **3342** (API + Lite-UI `ui/`) | Port **3341** (Next.js Messenger / „Standalone“-Dev) |
|--------|--------------------------------------|--------------------------------------------------------|
| **`npm start`** | **Ja** (Backend + Streams-Mock) | **Nein** — Next wird **nicht** gestartet. |
| **`npm run dev`** | **Ja** | **Ja** (parallel über `concurrently`) |

**Häufiger Irrtum:** Nur **`http://127.0.0.1:3342`** zu sehen ist **normal bei `npm start`**. Die **PWA/Messenger-Oberfläche** im Entwicklungsmodus ist **`http://127.0.0.1:3341`** und braucht **`npm run dev`**.

**Nicht verwenden:** `npm start dev` — das ist **kein** offizielles Script; das zweite Wort kann **`concurrently`** stören oder ignoriert werden. Richtig: **`npm run dev`**.

**Nur Next nachträglich:** Backend läuft schon → zweites Terminal: `cd frontend && npm run dev` (3341).

---

## Ein Befehl: Backend + UI (3341 + 3342)

```bash
npm run dev
```

- **Backend (API):** http://127.0.0.1:3342  
- **Next.js-UI:** http://127.0.0.1:3341  
- **Lite-UI / Boss-Werkstatt (Alpine + Tailwind):** http://127.0.0.1:3342/ – wird vom API-Server aus dem Ordner `ui/` ausgeliefert. Kein separates `npm install` für `ui/` nötig.

**Nur Lite-UI / Werkstatt testen (ohne Next):** **`npm start`**, dann **http://127.0.0.1:3342/**. Passwort-Dialog erscheint, wenn das Backend gesperrt ist. Bedeutung **Boss vs. Kunden-UI**: nächster Abschnitt.

### Handy im WLAN (Android / Chrome)

- **`npm run dev`** startet Next nur auf **`127.0.0.1:3341`** — vom **anderen Gerät** im LAN erreichst du die Seite **nicht**. Verwende **`npm run dev:lan`**: Next lauscht auf **`0.0.0.0:3341`**, dann im Handy **`http://<PC-LAN-IP>:3341`** (z. B. `http://192.168.178.41:3341`).
- **„Nicht sicher“ / Warnung:** Bei **HTTP** (ohne TLS) zeigt Chrome das normal — **Fortfahren** wählen oder explizit **`http://`** nutzen (kein `https://` zur IP tippen).
- **API:** Läuft nur auf **127.0.0.1:3342** auf dem PC; die Next-App leitet **`/api`** per Rewrite weiter — du musst am Handy **keine** `NEXT_PUBLIC_*`-URL auf `localhost` setzen (das wäre das Handy selbst). Client-Aufrufe: Barrel **`frontend/frontend/lib/api.ts`** (`@/frontend/lib/api`), Basis-URL u. a. **`frontend/frontend/lib/api/api-base.ts`**; Rewrites in **`frontend/next.config.mjs`**.
- **Firewall (Windows):** Erster Zugriff kann blockiert werden — Node.js für **private Netzwerke** erlauben oder eingehend **TCP 3341** (und ggf. 3342 nur wenn ihr direkt zur API testet) freigeben.
- **Next-Warnung „Cross origin … /_next/*“:** `frontend/next.config.mjs` lädt die **Root-`.env`**; **`allowedDevOrigins`** nutzt **Host** / **`host:port`** (Next-16-Doku). Standard: `localhost`, `127.0.0.1` inkl. **`:3341`**. Für **Handy per LAN-IP** in derselben **Root-`.env`**: `NEXT_ALLOWED_DEV_ORIGINS=http://192.168.178.41:3341` (wird zu `192.168.178.41:3341` normalisiert; mehrere Einträge kommagetrennt). **Keine** zweite `.env` unter `frontend/`. **Dev neu starten**, damit `next.config` neu eingelesen wird.

#### Handy: gebaute Next-App (Production) + API

**Wichtig:** `build:next` / `start:prod:lan` sind im **Hauptrepo** als npm-Skripte im **Wurzelverzeichnis** `morgendrot\` definiert — **nicht** nur im Ordner `frontend\` (dort heißt der Build weiterhin `npm run build`; es gibt zusätzlich den Alias `build:next` = gleicher Ablauf wie `build`).

1. **PowerShell / Terminal** öffnen → ins Repo-Root wechseln:  
   `cd C:\Users\damast\Desktop\morgendrot` (Pfad anpassen).
2. **Einmalig bauen** (nach Code-Änderungen wiederholen):  
   `npm run build:next`  
   (entspricht `npm run build` im Ordner `frontend/` inkl. `prebuild` / Handbuch-Sync.)
3. **API + Next für WLAN** starten — **ein Terminal**, **ein** Befehl:
   `npm run start:prod:lan`  
   Das Tool **`concurrently`** startet darin **zwei Prozesse parallel** (du musst **kein** zweites Terminal öffnen):
   - **API:** `npm run start:secrets` → Morgendrot-Backend auf **127.0.0.1:3342** (wie gewohnt nur auf dem PC).
   - **Next (Production):** `next start` im Ordner `frontend/` auf **0.0.0.0:3341** — das ist der **fertige** Next-Server für den **bereits gebauten** Stand (`frontend/.next/` nach Schritt 2), **ohne** Hot-Reload (anders als `next dev`).  
   Vom Handy: **`http://<PC-LAN-IP>:3341`**. Browser-Anfragen an **`/api/...`** bearbeitet Next und leitet sie per Rewrite an **3342** weiter (`frontend/next.config.mjs`) — das passiert **auf dem PC**, das Handy spricht nur mit Port **3341**.
4. **PC-LAN-IP** ermitteln (z. B. `ipconfig` → „IPv4-Adresse“ des WLAN-Adapters).
5. **Handy** (gleiches WLAN): Chrome öffnen → **`http://<PC-LAN-IP>:3341`** (wirklich `http://`, nicht `https://` zur IP). Bei Bedarf **Windows-Firewall** für **TCP 3341** freigeben.
6. **Installieren:** Chrome-Menü → **„App installieren“** / **Zum Startbildschirm hinzufügen** (je nach Android-Version).
7. **Messenger nutzen:** App öffnen → Tresor **entsperren** wie am PC (siehe **`docs/ONBOARDING-WALLET-UX-SPEC.md`**).
8. **Fehler „failed to load chunk“ / `Loading chunk … failed`:** meist **alter Service-Worker + neuer `next build`** (Chunk-Hashes weichen ab). **Einmal:** Chrome → Seiteninfo → **Speicher/Daten löschen** für diese Origin (oder installierte PWA deinstallieren), danach Seite neu öffnen und neu installieren. Nach **`sw.js`‑Änderung** (Versionspräfix **`morgendrot-sw-*`** in `frontend/public/sw.js`) einmal **hart neu laden** bzw. Tab schließen, damit die neue **`/sw.js`** greift.

#### PWA nach USB-Abzug: „Keine Netzverbindung“ — Zielbild vs. heutiger Übergang

**Produkt-Zielbild** (Handy-first, optionaler Node): **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**, **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** § 6 — Messenger **primär** auf dem Handy, **local-first**, **direkt IOTA** möglich, Morgendrot-Node **optional**.

**Was heute noch dazwischenfunkt:** Viele PWA-Flows nutzen weiterhin **`/api`** auf dem **Morgendrot-Prozess** (Übergang), bis die Stufen in **`ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`** § 4 weitergezogen sind — das ist **Ist**, nicht Widerruf des Ziels.

- **`adb reverse tcp:3341 …`** leitet nur **mit USB** `127.0.0.1:3341` **auf dem Handy** zum PC. Ohne Kabel zeigt **`127.0.0.1`** auf **das Handy** → keine Basis → **„Keine Netzverbindung“** (erwartbar für diese Installations-URL).
- **Ohne USB, Heim-WLAN:** PWA von **`http://<PC-LAN-IP>:3341`** installieren; PC führt **`start:prod:lan`** aus, bis ihr **deployt** oder den **Direct-Pfad** vollständig nutzt.
- **Feld / ohne eigenen PC im Rucksack:** **Deploy** (HTTPS) oder später **vollständig** client-lastiger Betrieb laut Architektur-Doku — nicht `127.0.0.1` über USB.
- **Handbuch:** SW cacht **`/handbook/*.md`**; die **Next-Route** **`/handbook`** braucht für die Shell vorerst oft noch eine erreichbare Origin — **Offline-Grenze** während des Übergangs, kein Leitplanken-Widerruf.

**Schneller ohne Build (nur Entwicklung):** statt Schritt 2–3 **`npm run dev:lan`** im Root — gleiche LAN-URL, aber Hot-Reload; `NEXT_ALLOWED_DEV_ORIGINS` wie oben setzen, falls `/ _next /`-Cross-Origin-Warnungen auftreten.

## Zwei Oberflächen: Boss-Werkstatt und Kunden-Produkt

Das Repository bewusst **zwei Web-UIs** – das ist **kein** „kostenlos vs. kostenpflichtig“, sondern **Rolle vs. Rolle**. Die **Messenger-Editionen** (`MESSENGER_EDITION=standalone` oder `sales` in Export-Bundles unter `exports/`) steuern Inhalt und Texte der **ausgelieferten Messenger-Ordner**, nicht die Frage Alpine oder Next.

| Oberfläche | Ordner | Typische URL (lokal) | Zweck |
|-----------|--------|----------------------|--------|
| **Boss-Werkstatt** | `ui/` | http://127.0.0.1:3342/ (mit laufendem API-Server) | Administration und Expertenbedienung: Batch-Exporte, Messenger-Stapel, Paket-/Minting-Steuerung, tiefe `.env`-Pflege, Rebate-Tab, volle Befehls-Oberfläche. |
| **Kunden-Produkt** | `frontend/` (Next.js) | http://127.0.0.1:3341 (bei `npm run dev`) | Geführtes Nutzererlebnis: Messenger-Kachel, Chat, Status (z. B. Credits, Schloss/Tor), weniger „Werkstatt-Lärm“. |

**Keine Einheits-UI:** Es gibt **kein** aktives Ziel, Alpine und Next zu einer Oberfläche zu verschmelzen. Das spart Aufwand; stattdessen ist die Arbeitsteilung oben die feste Leitplanke.

**Eine Schnittstelle:** **`/api/*`** (z. B. `GET /api/status`, `POST /api/command`) ist die **gemeinsame** Schicht. Neue Fähigkeiten werden **zuerst** in `src/api-server.ts` und den dahinterliegenden Modulen (`wallet-bridge`, `chain-access`, …) umgesetzt; beide UIs sind nur Clients. So bleibt eine **Quelle der Wahrheit** auf dem Server.

**„Direkt zu IOTA“ vs. Morgendrot-Node:** **Zielbild (ab 2026-04-28):** **Client** baut/signiert **primär** und spricht **direkt** mit **IOTA-RPC**; der **Morgendrot-Node** ist **optional** (Relay, Gas, Komfort). **Repo-Ist** während der Migration: viele Flows noch über **`/api`** und den **Node-Prozess** — **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`**, **`docs/ARCHITECTURE-HANDY-FIRST-CLIENT-IOTA.md`**, Fahrplan **§ H.15**.

**Wo neue Features landen (Vereinbarung):**

- **Messenger-Erlebnis** für Endnutzer (z. B. Credits-Anzeige, „Tank-Balken“, Chat-Feinschliff, Tor-/Lock-Status im Dashboard): **Priorität `frontend/`** (Next/React).
- **Admin, Bulk, Bundle-Schalter, Boss-only-Pfade:** **`ui/`** (Alpine).

**Entwicklerhinweis:** Für `npm run dev` laufen API (3342) und Next (3341) parallel; die Lite-UI bleibt zusätzlich unter **3342** erreichbar. Wer nur den schlanken Messenger testet, nutzt oft **`npm start`** und **3342**.

**Boss: „Was kann ich wohin?“** — **`docs/BOSS-ORIENTIERUNG.md`**; Lite-UI **Steuerung** → Dokumentation-Buttons (`GET /api/doc?name=…`). **Messenger-PWA:** **`/handbook`** — Quellen sind **`docs/BOSS-ORIENTIERUNG.md`** und **`docs/PWA-HANDBUCH-OFFLINE.md`**; nach inhaltlichen Änderungen daran im Repo-Root **`npm run sync:handbook`** ausführen (Kopie nach **`frontend/public/handbook/`**), oder **`npm run build`** im Ordner **`frontend/`** ( **`prebuild`** sync’t). Details: **`docs/PWA-HANDBUCH-OFFLINE.md`**. Vor Release: **`docs/PWA-MANUAL-CHECKS.md`** (Install/Offline).

**Test-Routinen:** Schnellcheck nach größeren Änderungen, Playwright mit API, Chain-Hinweise und offene Next-Themen → **`docs/TESTING.md`** (Abschnitte *Smoke nach Merge*, *Playwright Lite/Messenger*, *Chain / Move-Paket*, *Roadmap Kunden-UI*).

**Rollen & Hub:** Boss als Steuerung/Export, Kommandant/Arbeiter, optionale zentrale Orchestrierung → **`docs/ARCHITECTURE-ROLES-AND-HUB.md`**; offene Sicherheitsfragen → **`docs/DISCUSSION-OPEN.md`**.

**Messenger exportieren (Boss-UI 3342):** Alle Optionen des Stapels erklärt → **`docs/MESSENGER-EXPORT-FIELDS.md`** (inkl. **Verlauf** = `.morgendrot-package-id-history`, **SIGNER** sdk/cli/remote).

**Onboarding, Wallet, Session** (Ist-Zustand, Lücken, Ziel-Spezifikation): **`docs/ONBOARDING-WALLET-UX-SPEC.md`**.

**Recovery / Signer-Backup anzeigen** (`SIGNER=sdk`, gespeicherter Vault-Import): **`docs/RECOVERY-PHRASE-BACKUP.md`**.

## Warum „UI offline“ / keine Passwortabfrage?

Das passiert, wenn das **Backend** nicht läuft oder mit Fehlercode beendet wurde. Die UI spricht mit der API unter 127.0.0.1:3342 – ohne laufendes Backend bleibt sie offline und zeigt kein Passwort-Dialog.

**Vorgehen:**

1. In einem **eigenen Terminal** nur das Backend starten:
   ```bash
   npm run start:secrets
   ```
2. Die ausgegebene Fehlermeldung prüfen (z. B. fehlende `.env`, oder bei `ENCRYPTED_ENV_FILE`: Passwortabfrage schlägt fehl, wenn kein TTY verfügbar ist).
3. Wenn du **verschlüsselte Env** nutzt (`ENCRYPTED_ENV_FILE`): Backend einmal allein starten, Passwort eingeben; danach kannst du `npm run dev` nutzen (Backend bleibt dann bis zum Neustart entschlüsselt im Speicher).

## „Batchvorgang abbrechen (J/N)?“

Unter Windows kann das erscheinen, wenn das Backend (oder ein anderes Programm) auf Eingabe wartet und die Konsole anders reagiert. Bei Fehlern zuerst **`npm start`** in einem separaten Terminal ausführen, um die echte Fehlermeldung zu sehen.

## Nur Backend oder nur Frontend

- **Backend + Streams (empfohlen):** `npm start` (API auf 127.0.0.1:3342, Streams-Mock auf 9343)
- **Nur Backend** (ohne Streams, z. B. Debug): `npm run start:backend` (API auf 127.0.0.1:3342)
- **Nur Frontend:** `npm run dev:frontend` (UI auf 127.0.0.1:3341; Backend muss separat laufen, sonst „offline“)

## Ein Befehl für alles (empfohlen)

```bash
npm start
```

- Startet **Backend (API)** auf Port 3342 und **Streams-Mock mit Speicherung** auf Port 9343 in einem Terminal.
- In der `.env`: `STREAMS_BRIDGE_URL=http://127.0.0.1:9343` (wird oft schon genutzt).
- **Nur Backend** (ohne Streams): `npm run start:backend`

## Warum ist der Ordner so groß? (Frontend ~450 MB+)

Die **Boss-Werkstatt** (`ui/index.html`, Alpine) bleibt **ohne** eigenes `node_modules` im Ordner `ui/` – sie wird vom API-Server ausgeliefert.

Das **Kunden-Produkt** ist Next.js + React + shadcn unter **`frontend/`** (viele Radix-UI-Pakete für Dialog, Button, Select, Tabs, …). Das zieht **frontend/node_modules** (~450 MB) nach sich. Das ist bei diesem Stack normal.

- **Build-Cache:** `frontend/.next` kann beim Entwickeln ~130 MB werden. Mit **`npm run clean`** löschen (oder Ordner manuell), dann ist der Cache weg; beim nächsten `npm run dev` wird er neu erzeugt.
- **.gitignore:** `.next` und `frontend/.next` sind ignoriert, damit der Build-Cache nicht ins Repo kommt.
- **Reduziert:** Ungenutzte schwere Pakete (recharts, embla-carousel, calendar, drawer, command, input-otp) wurden entfernt, um einige Megabyte zu sparen.
