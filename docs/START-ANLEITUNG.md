# So startest du die App

## Ein Befehl zum Starten (Backend + Streams)

```bash
npm start
```

Startet Backend (API) und Streams in einem Terminal. Lite-UI: http://127.0.0.1:3342/

**Nur Backend:** `npm run start:backend`

## Mit Next.js-Frontend (Dashboard)

```bash
npm run dev
```

**Nicht** `npm start dev` – es gibt nur `npm run dev`.

- **Was passiert:** Zuerst wird die UI validiert, dann starten **zwei Prozesse** in einem Fenster:
  - **Backend (API)** auf Port **3342** (Wallet-Passwort eingeben, wenn gefragt)
  - **Next.js-Frontend** auf Port **3341**

- **Im Browser öffnen:**
  - **Next-UI (Dashboard, Zugang, Tickets, …):** http://127.0.0.1:3341/
  - **Lite-UI (einfache Oberfläche):** http://127.0.0.1:3342/

**Rollen der beiden UIs:** Next = geführtes **Kunden-Produkt**, Lite-UI (`ui/`) = **Boss-Werkstatt** (Admin, Batch, Exporte). Beide nutzen dieselbe API. Details: **`docs/DEV-START.md`** → *Zwei Oberflächen: Boss-Werkstatt und Kunden-Produkt*.

Wenn sich das Terminal „von selbst beendet“ oder die UI „failed to fetch“ / „Backend nicht erreichbar“ meldet, wurde das Backend beendet. Einfach erneut **`npm run dev`** im Projektordner ausführen, Wallet-Passwort eingeben (oder in der UI entsperren), dann in der UI **Aktualisieren** (Tickets/Keys) bzw. **Ticket einlösen** erneut versuchen.

## Alternative: Nur Backend (ohne Streams)

```bash
npm run start:backend
```

Dann nur API + Lite-UI unter http://127.0.0.1:3342/ – kein Streams, kein Next.js-Dashboard.

## Mit einmaligem Befüllen der UI (Keys, Nachrichten, Streams)

```bash
npm run dev:with-seed
```

Wie `npm run dev`, plus: Sobald die API läuft, wird einmal `seed:ui` ausgeführt.
