# Entwicklung starten

## Ein Befehl: Backend + UI

```bash
npm run dev
```

- **Backend (API):** http://127.0.0.1:3342  
- **Next.js-UI:** http://127.0.0.1:3341 (wenn mit `dev:frontend` gestartet)  
- **Lite-UI / Boss-Werkstatt (Alpine + Tailwind):** http://127.0.0.1:3342/ – wird vom API-Server aus dem Ordner `ui/` ausgeliefert. Kein separates `npm install` für `ui/` nötig.

Zum Testen der **Lite-UI**: **`npm start`** ausführen, dann im Browser **http://127.0.0.1:3342/** öffnen. Passwort-Dialog erscheint, wenn das Backend gesperrt ist. Bedeutung **Boss vs. Kunden-UI**: nächster Abschnitt.

### Handy im WLAN (Android / Chrome)

- **`npm run dev`** startet Next nur auf **`127.0.0.1:3341`** — vom **anderen Gerät** im LAN erreichst du die Seite **nicht**. Verwende **`npm run dev:lan`**: Next lauscht auf **`0.0.0.0:3341`**, dann im Handy **`http://<PC-LAN-IP>:3341`** (z. B. `http://192.168.178.41:3341`).
- **„Nicht sicher“ / Warnung:** Bei **HTTP** (ohne TLS) zeigt Chrome das normal — **Fortfahren** wählen oder explizit **`http://`** nutzen (kein `https://` zur IP tippen).
- **API:** Läuft nur auf **127.0.0.1:3342** auf dem PC; die Next-App leitet **`/api`** per Rewrite weiter — du musst am Handy **keine** `NEXT_PUBLIC_*`-URL auf `localhost` setzen (das wäre das Handy selbst). Siehe `frontend/lib/api.ts` und `next.config.mjs`.
- **Firewall (Windows):** Erster Zugriff kann blockiert werden — Node.js für **private Netzwerke** erlauben oder eingehend **TCP 3341** (und ggf. 3342 nur wenn ihr direkt zur API testet) freigeben.
- **Next-Warnung „Cross origin … /_next/*“:** `frontend/next.config.mjs` lädt die **Root-`.env`** und erlaubt u. a. `localhost` / `127.0.0.1:3341`. Für **Handy per LAN-IP** in derselben **einen** `.env** (Projektroot): `NEXT_ALLOWED_DEV_ORIGINS=http://192.168.178.41:3341` (eigene IP; mehrere URLs kommagetrennt). **Keine** zweite `.env` unter `frontend/`.

## Zwei Oberflächen: Boss-Werkstatt und Kunden-Produkt

Das Repository bewusst **zwei Web-UIs** – das ist **kein** „kostenlos vs. kostenpflichtig“, sondern **Rolle vs. Rolle**. Die **Messenger-Editionen** (`MESSENGER_EDITION=standalone` oder `sales` in Export-Bundles unter `exports/`) steuern Inhalt und Texte der **ausgelieferten Messenger-Ordner**, nicht die Frage Alpine oder Next.

| Oberfläche | Ordner | Typische URL (lokal) | Zweck |
|-----------|--------|----------------------|--------|
| **Boss-Werkstatt** | `ui/` | http://127.0.0.1:3342/ (mit laufendem API-Server) | Administration und Expertenbedienung: Batch-Exporte, Messenger-Stapel, Paket-/Minting-Steuerung, tiefe `.env`-Pflege, Rebate-Tab, volle Befehls-Oberfläche. |
| **Kunden-Produkt** | `frontend/` (Next.js) | http://127.0.0.1:3341 (bei `npm run dev`) | Geführtes Nutzererlebnis: Messenger-Kachel, Chat, Status (z. B. Credits, Schloss/Tor), weniger „Werkstatt-Lärm“. |

**Keine Einheits-UI:** Es gibt **kein** aktives Ziel, Alpine und Next zu einer Oberfläche zu verschmelzen. Das spart Aufwand; stattdessen ist die Arbeitsteilung oben die feste Leitplanke.

**Eine Schnittstelle:** **`/api/*`** (z. B. `GET /api/status`, `POST /api/command`) ist die **gemeinsame** Schicht. Neue Fähigkeiten werden **zuerst** in `src/api-server.ts` und den dahinterliegenden Modulen (`wallet-bridge`, `chain-access`, …) umgesetzt; beide UIs sind nur Clients. So bleibt eine **Quelle der Wahrheit** auf dem Server.

**Wo neue Features landen (Vereinbarung):**

- **Messenger-Erlebnis** für Endnutzer (z. B. Credits-Anzeige, „Tank-Balken“, Chat-Feinschliff, Tor-/Lock-Status im Dashboard): **Priorität `frontend/`** (Next/React).
- **Admin, Bulk, Bundle-Schalter, Boss-only-Pfade:** **`ui/`** (Alpine).

**Entwicklerhinweis:** Für `npm run dev` laufen API (3342) und Next (3341) parallel; die Lite-UI bleibt zusätzlich unter **3342** erreichbar. Wer nur den schlanken Messenger testet, nutzt oft **`npm start`** und **3342**.

**Test-Routinen:** Schnellcheck nach größeren Änderungen, Playwright mit API, Chain-Hinweise und offene Next-Themen → **`docs/TESTING.md`** (Abschnitte *Smoke nach Merge*, *Playwright Lite/Messenger*, *Chain / Move-Paket*, *Roadmap Kunden-UI*).

**Rollen & Hub:** Boss als Steuerung/Export, Kommandant/Arbeiter, optionale zentrale Orchestrierung → **`docs/ARCHITECTURE-ROLES-AND-HUB.md`**; offene Sicherheitsfragen → **`docs/DISCUSSION-OPEN.md`**.

**Messenger exportieren (Boss-UI 3342):** Alle Optionen des Stapels erklärt → **`docs/MESSENGER-EXPORT-FIELDS.md`** (inkl. **Verlauf** = `.morgendrot-package-id-history`, **SIGNER** sdk/cli/remote).

**Onboarding, Wallet, Session** (Ist-Zustand, Lücken, Ziel-Spezifikation): **`docs/ONBOARDING-WALLET-UX-SPEC.md`**.

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
