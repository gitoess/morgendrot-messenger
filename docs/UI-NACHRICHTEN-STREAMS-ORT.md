# Wo sieht man Nachrichten und Streams in der UI?

## Alte Nachrichten (Posteingang / Mailbox)

Die **gespeicherten Nachrichten** (z. B. aus einem Test) kommen aus der **Mailbox** (on-chain) bzw. aus Chain-Events. Sie werden **nicht** in IOTA Streams (L0.5) gespeichert.

### Next.js-Dashboard (Frontend)

1. **Startseite** → Kachel **„Nachrichten“** öffnen.
2. Variante wählen: **„Privat“** oder **„Pinnwand“**.
3. Im Bereich **„Posteingang“** erscheinen die letzten Nachrichten (beim Öffnen werden 50 geladen).
4. **„Aktualisieren“** klicken, um die Liste neu vom Backend zu holen.

**Technik:** Die Chat-View ruft beim Öffnen `fetchInbox(50)` auf (Backend: `/inbox` → `/fetch`). Das Backend liest aus der **Mailbox** (MAILBOX_ID) oder aus Chain-Events. Wenn du mit derselben Instanz (gleiche MY_ADDRESS, MAILBOX_ID) getestet hast, sollten die Nachrichten hier erscheinen. Keine Nachrichten? Prüfen: PACKAGE_ID gesetzt, Backend verbunden, ggf. „Aktualisieren“ erneut klicken.

### Lite-UI (statische UI am API-Port)

- URL: z. B. `http://127.0.0.1:3342/` (gleicher Port wie die API).
- Tab **„Nachrichten“** (Chat): dort ebenfalls **Posteingang** mit Button **„Aktualisieren“** (und optional Package-ID eingeben). Gleiche Datenquelle (Mailbox/Chain).

---

## Streams-Nachrichten (IOTA Streams L0.5)

**Streams** = feeless Datenkanal (Heartbeat, Sensor, Audit). Das ist **nicht** derselbe Kanal wie der Chat-Posteingang.

### Wo sichtbar?

- **Nur in der Lite-UI** (`ui/index.html`), Tab **„Streams“** (Kachel „Streams – Feeless Datenkanal“).
  - Dort: Konfiguration (STREAMS_BRIDGE_URL, STREAMS_ANCHOR_ID), **„Publish (Senden)“**, **„Fetch (Empfangen)“**, **„Status“**.
  - Die **empfangenen Streams-Nachrichten** erscheinen in der Antwort des Befehls **„Fetch (Empfangen)“** (Befehlsausgabe unten auf der Seite), nicht in einer eigenen Nachrichtenliste.

- **Im Next.js-Dashboard** gibt es **keine** Streams-Kachel und keine Streams-Ansicht. Streams (Publish/Fetch) sind dort derzeit nicht integriert.

---

## Kurzfassung

| Was | Wo in der UI |
|-----|----------------|
| **Alte Nachrichten (Mailbox/On-Chain)** | Next: **Nachrichten → Privat oder Pinnwand → Posteingang** (Button „Aktualisieren“). Lite-UI: Tab Nachrichten → Posteingang. |
| **Streams-Nachrichten (L0.5)** | **Nur Lite-UI**: Tab **Streams** → „Fetch (Empfangen)“; Ergebnis in der Befehlsausgabe. Next: nicht vorhanden. |

Wenn vom Test „ein paar“ Nachrichten fehlen: dieselbe App-Instanz und Wallet nutzen, dann **Nachrichten → Posteingang → Aktualisieren**. Streams-Testnachrichten in der **Lite-UI** unter **Streams → Fetch** prüfen.

**Eine npm für alle UI-Daten (Nachrichten, Streams, Keys, Tickets):** `npm run seed:ui` – befüllt Posteingang, Streams, Keys und Tickets für die UI. Siehe `scripts/send-realworld-messages-and-streams.ts`. Alias: `npm run send:ui-messages`.
