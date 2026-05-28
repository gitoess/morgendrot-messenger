# Streams-Ausgabe und Nachrichten – Bedeutung & Fehlerbehebung

## Was bedeutet „[?] Streams Real-World 1 – 2026-03-16T15:08:51 …“?

Das sind **Streams-Nachrichten** (IOTA Streams L0.5), die du beim Klick auf **„Fetch (Empfangen)“** in der Lite-UI (Tab **Streams**) siehst.

- **„Streams Real-World 1“ / „Streams Real-World 2“** stammen vom Skript **`npm run seed:ui`** (oder `send:ui-messages`). Es sendet zwei Test-Texte per `/streams-publish`, damit in der Lite-UI unter Streams → Fetch etwas angezeigt wird.
- **Datum/Zeit** (z. B. 16.3.2026, 16:08:51) = Zeitpunkt, zu dem die Nachricht veröffentlicht wurde.
- **„[?]“** = in der Lite-UI oft ein Platzhalter/Icon für „Nachricht unbekannten Typs“ oder reiner Text-Eintrag. Die Nutzdaten sind der Text danach (z. B. „Streams Real-World 1 – …“).

**Kurz:** Das ist der **Beweis**, dass Streams-Publish und Fetch funktionieren – die beiden Einträge sind die Test-Nachrichten aus dem Seed-Skript.

### Lange JSON-Nachrichten

Unter **Streams → Nachrichten im Kanal** ist die Liste nur eine **Kurzvorschau**. Den **kompletten Inhalt** (alle Tags, `signals`, …) siehst du, wenn du bei der Nachricht **„Vollständiger Inhalt (JSON)“** aufklappst – dort wird das JSON **formatiert** (Zeilenumbrüche) in einem scrollbaren Bereich angezeigt.

---

## Nachrichten werden nicht angezeigt (Posteingang leer)

Wenn im **Posteingang** (Nachrichten → Privat/Pinnwand → Aktualisieren) nichts erscheint, prüfe nacheinander:

### 1. Backend und Konfiguration

- **Backend läuft:** z. B. `npm run start:secrets`, Wallet entsperrt.
- **MAILBOX_ID** in der .env gesetzt (0x + 64 Hex). Ohne MAILBOX liefert `/inbox` (→ `/fetch`) einen Fehler, und die UI zeigt entweder „Keine Nachrichten“ oder einen **Fehler beim Laden** (siehe unten).
- **PACKAGE_ID** gesetzt (0x + 64 Hex), **RPC_URL** zeigt auf die richtige Kette (Testnet/Mainnet).

### 2. Welche UI, welcher Port?

- **Next-UI:** Sie nutzt `NEXT_PUBLIC_API_BASE` (Voreinstellung oft `http://127.0.0.1:3342`). Wenn das Backend auf einem anderen Port läuft, muss diese Variable passen (z. B. in `.env.local`: `NEXT_PUBLIC_API_BASE=http://127.0.0.1:3342`).
- **Lite-UI:** Läuft direkt auf dem API-Port (z. B. `http://127.0.0.1:3342/`). Dort Posteingang → **Aktualisieren** klicken.

### 3. Fehlermeldung in der UI

Seit der Anpassung zeigt die **Next-UI** beim Laden des Posteingangs eine Meldung, wenn das Backend einen Fehler zurückgibt (z. B. „MAILBOX_ID fehlt“, „Kette nicht erreichbar“).  
→ Steht dort ein **Fehler beim Laden**, den Text lesen und .env / Backend / RPC entsprechend korrigieren.

### 4. Nachrichten wirklich auf der Chain?

- Mit **derselben** Instanz (gleiche MY_ADDRESS, MAILBOX_ID) gesendet und geladen?  
- Nach **Aktualisieren** gewartet? Die UI lädt beim Öffnen und bei Klick auf „Aktualisieren“; manchmal braucht die Chain ein paar Sekunden.
- **Gerade `seed:ui` oder `dev:with-seed` ausgeführt?** Wenn das Skript „OK“ für die Nachrichten meldet, kann das Backend beim ersten Abruf noch 0 liefern („Keine neuen Nachrichten auf der Chain gefunden“). Einfach **nochmal „Aktualisieren“** klicken; bei Bedarf ein paar Sekunden warten.

### 5. Schnellcheck per API

Im Browser oder mit curl:

```http
POST http://127.0.0.1:3342/api/command
Content-Type: application/json

{"cmd": "/inbox", "args": ["50"]}
```

- Antwort `ok: true` und `data`/`messages` als Array → Backend liefert Nachrichten; wenn die UI trotzdem leer ist, liegt es an der Anzeige oder an `NEXT_PUBLIC_API_BASE`.
- Antwort `ok: false` und `message`: z. B. „MAILBOX_ID fehlt“, „Kette nicht erreichbar“ → zuerst diese Punkte in .env und beim Backend beheben.

---

## Streams-Nachrichten löschen

- **Im Mock / über die App:** Befehl **`/streams-purge`** leert den aktuellen Kanal (STREAMS_ANCHOR_ID) auf der Bridge. Danach liefert **Fetch** wieder „Keine neuen Nachrichten“, bis erneut gepublished wird.
- **API:** `POST /api/command` mit `{"cmd": "/streams-purge", "args": []}`.
- **Hinweis:** Nur die **Bridge** (bzw. der Mock) speichert die Nachrichten. `/streams-purge` ruft die Bridge mit `?anchor=…&purge=1` auf und leert dort den Kanal.

---

## „Jedes Mal frisch von Streams holen“ – wie läuft es wirklich?

**Ablauf:**

- Jeder Klick auf **Fetch (Empfangen)** bzw. jeder Aufruf **`/streams-fetch`** holt die Daten **neu von der Bridge** (GET `STREAMS_BRIDGE_URL?anchor=…`). Das Backend **cacht** die Streams-Nachrichten nicht; jede Abfrage ist eine frische Anfrage an die Bridge.
- **Speicherung** passiert nur **auf der Bridge** (beim Mock: RAM oder Datei `.streams-mock-data.json` bei `STREAMS_MOCK_PERSIST=1`). Ohne diese Ablage gäbe es keine „Historie“ – Publish würde die Nachricht nur versenden, und ein späterer Fetch könnte sie nicht mehr liefern.

**Vorteile der Speicherung auf der Bridge:**

- **Historie:** Mehrere Geräte oder wiederholte Fetches sehen dieselben Nachrichten (z. B. nach Neustart oder zweitem Tab).
- **Entkopplung:** Sender und Empfänger müssen nicht gleichzeitig online sein; Empfänger kann „nachziehen“.
- **Einfache API:** Ein einfacher GET reicht; die Bridge kapselt das eigentliche Streams-Protokoll (L0.5).

**Nachteile:**

- **Speicher:** Alte Nachrichten bleiben, bis sie gelöscht werden (z. B. mit `/streams-purge`).
- **Abhängigkeit:** Ohne laufende Bridge (oder mit leerem/geleerten Kanal) liefert Fetch nichts.

**Alternativ (ohne Speicherung auf der Bridge):**  
Eine „ephemerale“ Bridge, die nur weiterleitet und nichts speichert, würde bedeuten: Kein Nachziehen, kein wiederholtes Abrufen alter Nachrichten – nur was genau in dem Moment ankommt, wäre sichtbar. Für Demos und Tests ist die aktuelle Variante (Bridge speichert, bei Bedarf mit Purge) meist sinnvoller.

---

## Kurz

| Thema | Bedeutung / Aktion |
|------|---------------------|
| **„[?] Streams Real-World 1/2 …“** | Test-Streams vom Skript `seed:ui`; Beweis, dass Streams Fetch funktioniert. |
| **Streams löschen** | `/streams-purge` leert den aktuellen Kanal auf der Bridge. |
| **Nachrichten erscheinen nicht** | MAILBOX_ID + PACKAGE_ID + RPC prüfen; Fehler in der UI lesen; gleiche Instanz & „Aktualisieren“; bei Bedarf `/inbox` per API testen. |
