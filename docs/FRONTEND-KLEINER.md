# Frontend kleiner bekommen

Aktuell: **Next.js + React + shadcn (Radix)** → `frontend/node_modules` ~450 MB. So bekommst du es kleiner:

---

## Option 1: Statisches HTML/JS (wie die alte UI) – **am kleinsten**

**Idee:** Kein Framework, nur eine oder wenige HTML/JS-Dateien, die die API per `fetch` ansprechen.

- **Größe:** Praktisch nur Quelldateien (KB bis wenige MB). Kein `frontend/node_modules` nötig.
- **Wo:** Z.B. `ui/` wiederbeleben mit `index.html` + `app.js` (oder ein kleines Build mit esbuild für ein einziges Bundle).
- **Vorteil:** Minimal, schnell, keine 450 MB.
- **Nachteil:** Kein React/Komponenten; alles per DOM/JS. Wartung und Erweiterung aufwendiger.

**Umsetzung (Kern):**

1. Neues Verzeichnis `ui/` (oder `frontend-static/`) mit:
   - `index.html` – Struktur, ein paar `<div>` für Status, Passwort-Dialog, Kacheln, Inhalt.
   - `app.js` – `fetch('/api/status')`, `fetch('/api/command', { method: 'POST', ... })`, DOM-Updates, einfache „Views“ per show/hide.
2. Build optional: z.B. `esbuild app.js --bundle --minify --outfile=dist/bundle.js` (ein kleines node/scripts-Build, kein großes Frontend-npm).
3. Auslieferung: Entweder Backend serviert `ui/` statisch (z.B. unter `/` oder `/ui`), oder ein beliebiger Static-Server. API weiter unter 127.0.0.1:3342.

Damit bist du **deutlich unter** die alte UI-Größe (die alte hatte auch kein 450-MB-node_modules).

---

## Option 2.5: Alpine.js + Tailwind CDN – **klein + komfortabel („Morgendrot-Lite“)**

**Idee:** Eine statische HTML-Datei, aber mit Alpine.js (ca. 15 KB per Script-Tag) für reaktiven State und einfache Bindung – kein npm, kein node_modules. Tailwind per CDN für das Layout.

- **Größe:** Nur die HTML-Datei(en) + Alpine/Tailwind vom CDN → praktisch KB.
- **Komfort:** State (z. B. `messages`, `loading`), `x-for`/`x-show`, Buttons mit `@click` – ähnlich komfortabel wie eine kleine App, ohne 450 MB.
- **Backend:** Unverändert; `fetch('http://127.0.0.1:3342/api/command', { method: 'POST', body: JSON.stringify({ cmd, args }) })`.

**Wichtig für die Inbox:**

- API-URL: `http://127.0.0.1:3342` (Port 3342), Pfad `/api/command`.
- Befehl zum Nachrichten laden: `cmd: '/inbox'` oder `cmd: '/fetch'`, `args: [20]` (Anzahl).
- Antwort: Backend liefert `{ ok, data: [...] }` oder `{ ok, messages: [...] }`; im Frontend also `data.data ?? data.messages` für die Liste.
- Alpine korrekt einbinden: z. B. `<script defer src="https://unpkg.com/alpinejs@3/dist/cdn.min.js"></script>` (nicht nur `unpkg.com`).

**Fehlerbehandlung:** `x-show="error"` mit `error`-Text setzen, wenn `!data.ok` oder `catch`.

**Sinn:** Ja – für „möglichst klein, aber genauso komfortabel“ ist diese Variante ein guter Mittelweg zwischen reiner Vanilla-Option 1 und Vite/Preact (Option 2).

**Umsetzung:** Die **Lite-UI** liegt unter `ui/index.html` (Alpine.js + Tailwind CDN). Der API-Server liefert sie aus: **http://127.0.0.1:3342/** nach Start mit `npm run start:secrets` (oder `npm run dev` ohne Frontend). Enthalten: alle Kacheln (Nachrichten, Zugang, Überwachung, Steuerung, Tresor), Passwort-Dialog, Hilfe (?), Einstellungen, Config (.env), Setup (Package-ID, RPC, Kette prüfen), Inbox, Befehle ausführen.

### Ist es genauso komfortabel wie die jetzige neue UI?

| | **Neue UI (Next + React + shadcn)** | **Morgendrot-Lite (Alpine + Tailwind CDN)** |
|---|--------------------------------------|---------------------------------------------|
| **Für Nutzer (Bedienung)** | Kacheln, Dialoge, Tabs, klare Navigation, Passwort-Dialog, Hilfe „?“ | **Gleich möglich** – dieselben Abläufe, Buttons, Listen, Formulare. Sieht mit Tailwind sehr ähnlich aus. |
| **Funktionen** | Chat, Lock, Monitor, Boss, Vault, Config, Setup, Restart | **Gleich möglich** – dieselbe API (127.0.0.1:3342), dieselben Befehle. Du baust nur die Oberfläche in HTML/Alpine nach. |
| **Entwicklung** | Komponenten (Button, Dialog, Select …), TypeScript, klare Struktur, neuer Screen = neue Datei | **Weniger Komfort:** Keine vorgefertigten Komponenten – Dialoge, Tabs, Formulare schreibst du selbst (HTML + Tailwind + Alpine). Kein TypeScript, mehr Copy-Paste beim Erweitern. |
| **Barrierefreiheit / Fokus** | Radix/shadcn bringt ARIA, Fokus, Tastatur mit | Du musst es selbst einbauen oder bewusst weglassen. |
| **Größe** | ~450 MB node_modules | Praktisch nur die HTML/JS-Dateien (KB). |

**Kurz:** Für **Nutzer** kann es genauso komfortabel sein (gleiche Abläufe, gleiches Design möglich). Für **dich beim Bauen** ist es weniger komfortabel: keine fertigen Bausteine, mehr Handarbeit pro Screen/Formular. Ob ihr es so baut, ist eine Abwägung **Größe + Einfachheit der Deployment-Struktur** vs. **Komfort beim Weiterentwickeln**.

---

## Option 2: Leichtes Framework – **Vite + Preact (oder Alpine)**

**Idee:** Next durch Vite ersetzen, React durch Preact (oder ganz ohne React, z.B. Alpine.js).

- **Größe:** Grob **100–200 MB** `node_modules` statt 450 MB.
- **Vite:** Schneller Build, weniger Overhead als Next.
- **Preact:** React-API, aber viel kleiner; oft ohne große Anpassung nutzbar.
- **Alpine.js:** Sehr klein, kein React; etwas andere Mentalität (HTML-zentriert).

**Nachteil:** Bestehende Next/React/shadcn-UI müsste migriert werden (neues Projekt unter z.B. `frontend-vite/`, Komponenten nachziehen oder vereinfachen).

---

## Option 3: Next beibehalten, aber schlanker

**Idee:** Im aktuellen Next-Projekt nur noch das Nötigste nutzen.

- **Preact-Adapter:** In Next.js mit `next.config` Preact statt React nutzen → einige MB weniger.
- **Radix reduzieren:** Nur die wirklich genutzten Komponenten behalten (Dialog, Button, Input, Label, Select, Switch, Tabs), Rest und zugehörige Pakete entfernen. Spart weitere Megabyte, aber kein radikaler Sprung.
- **Ergebnis:** Eher 350–400 MB statt 450 MB, kein großer Gewinn.

---

## Empfehlung

- **Wenn Größe das wichtigste ist:** **Option 1** (statisches HTML/JS, ggf. mit kleinem esbuild-Bundle). Kein großes node_modules, Repo und Platte bleiben klein.
- **Wenn du Komponenten/React-ähnliche Struktur willst, aber kleiner:** **Option 2** (Vite + Preact oder Alpine) – einmalige Migration, danach ~100–200 MB.

Wenn du möchtest, kann als nächster Schritt **Option 1** konkret ausgearbeitet werden: Struktur für `ui/index.html` + `ui/app.js`, welche API-Calls, und wie das Backend die Dateien ausliefert (oder ein Mini-Build-Skript).
