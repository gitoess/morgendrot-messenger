# Factory I/O + Morgendrot

Kurzbeschreibung, ob sich Morgendrot mit Factory I/O testen lässt und wie die Anbindung funktioniert.

---

## Passt das zusammen?

**Ja.** Morgendrot ist ein System für **digitale Zwillinge**, **Asset-Tracking** und **Live-Daten** (Streams, Überwachung, Heartbeats). Factory I/O ist eine **3D-Fabriksimulation** mit Sensoren und Aktoren. Die Kombination eignet sich gut, um:

- **Ohne echte Hardware** Szenarien zu testen: simulierte Förderbänder, Sensoren, Zähler liefern Daten.
- **Streams/Überwachung** mit echten Werten zu füllen: Tags aus Factory I/O werden als Nachrichten in einen Morgendrot-Kanal geschrieben; die Kachel „Überwachung“ bzw. „Streams“ zeigt sie.
- **Asset-Twin-Szenarien** durchzuspielen: z. B. ein Asset „Pumpe P-101“ einem Stream zuordnen und die Werte aus der Simulation als Live-Daten anzeigen.

Technisch nutzt Morgendrot eine **Streams-Bridge** (z. B. `streams-bridge-mock` oder LoRa-Bridge). Ein kleines **Feeder-Skript** liest periodisch die **Factory I/O Web-API** und veröffentlicht die Tag-Werte in diese Bridge – Morgendrot ändert sich nicht, es sieht nur „Geräte“ die Nachrichten senden.

---

## Voraussetzungen

- **Factory I/O** installiert (idealerweise **Ultimate Edition**).
- **Web-API in Factory I/O aktiviert:**
  - In Factory I/O Konsole: `app.web_server = True`
  - Standard-Port: **7410** (änderbar z. B. mit `app.web_server_url`).
- **Morgendrot:** Backend + eine Streams-Bridge laufen (z. B. `npm start` → Mock auf 9343).

---

## Anbindung (Feeder)

1. **Streams-Bridge starten** (läuft bereits bei `npm start` auf Port 9343).
2. **In Morgendrot:** In der UI unter **Streams** einen **Kanal erstellen** (oder bestehenden wählen). Die **STREAMS_ANCHOR_ID** dieses Kanals notieren bzw. in der Konfiguration setzen.
3. **Poll-Intervall (optional):** In der Lite-UI unter **Streams** → Abschnitt **„Factory I/O Feeder“** → Feld **„Poll alle (ms)“** (z. B. `10000` für 10 s oder `30000` für 30 s) eintragen und **Setzen** klicken. Der laufende Feeder liest den Wert vom Backend (ohne Neustart). **Hinweis:** Wenn `FACTORY_IO_POLL_MS` in der `.env` gesetzt ist, überschreibt das die UI (für Skripte/CI).

4. **Feeder starten** (liest Factory I/O und schreibt in die Bridge):

   ```bash
   # Optional: URLs anpassen
   set FACTORY_IO_URL=http://127.0.0.1:7410
   set STREAMS_BRIDGE_URL=http://127.0.0.1:9343
   set STREAMS_ANCHOR_ID=<deine-Anchor-ID-aus-Morgendrot>

   npm run factory-io-feeder
   ```

5. **Factory I/O** mit einer Szene starten und laufen lassen. Der Feeder pollt die Web-API in dem eingestellten Abstand, baut ein JSON aus allen Tag-Werten und sendet es als Nachricht an den Kanal. In Morgendrot unter **Streams** bzw. **Überwachung** (mit diesem Kanal) siehst du die eingehenden Werte.

### Umgebungsvariablen (Feeder)

| Variable | Default | Beschreibung |
|---------|--------|--------------|
| FACTORY_IO_URL | http://127.0.0.1:7410 | Basis-URL der Factory I/O Web-API. |
| STREAMS_BRIDGE_URL | http://127.0.0.1:9343 | URL der Morgendrot-Streams-Bridge. |
| STREAMS_ANCHOR_ID | (leer) | Anchor-ID des Kanals; **muss** gesetzt werden, damit der Feeder publiziert. |
| FACTORY_IO_POLL_MS | (UI/10000) | Abstand zwischen zwei Abfragen (ms). In der UI unter Streams einstellbar; **Env überschreibt** die UI. Min. 500, Default 10000. |
| MORGENDROT_API_URL | http://127.0.0.1:3342 | Backend, von dem `/api/config` gelesen wird (Poll-Intervall & Factory-URL aus UI). |
| FACTORY_IO_MAP_FILE | (optional) | Pfad zur Mapping-JSON; Standard: `./factory-io-map.json` wenn vorhanden. |
| FACTORY_IO_PUBLISH_ON_CHANGE | false | `1`/`true`: nur publizieren bei geänderten Tag-Werten (zusätzlich zu `publishOnChangeOnly` in der Map). |

Ohne **STREAMS_ANCHOR_ID** macht der Feeder nur Log-Ausgaben (kein Publish), damit du die Verbindung zu Factory I/O prüfen kannst.

---

## Ablauf im Überblick

```
Factory I/O (Szene läuft)  →  Web-API (Port 7410)
                                    ↑
                          factory-io-streams-feeder (pollt /api/tags)
                                    ↓
                          POST { anchor, payload } an Streams-Bridge (9343)
                                    ↓
                          Morgendrot: GET ?anchor=… → Nachrichten in UI (Streams/Überwachung)
```

Morgendrot selbst braucht **keine** Änderung: Es verwendet weiterhin `STREAMS_BRIDGE_URL` und `STREAMS_ANCHOR_ID`; die „Geräte“ sind in diesem Setup die vom Feeder erzeugten Nachrichten mit den Factory-I/O-Tag-Werten.

---

## Echtzeitdaten & „fehlende Verbindungen“

### Wie „live“ sind die Daten?

Der Feeder arbeitet **per Abfrage (Polling)** an der Factory-I/O-Web-API (`GET /api/tags`). Das ist **kein Millisekunden-Push** aus der Simulation, sondern: so oft wie `FACTORY_IO_POLL_MS` (z. B. alle 10 s) siehst du einen **aktuellen Snapshot**. Für Demo und Überwachung reicht das meist; für harte Echtzeit (Safety-PLC) wäre eher **OPC UA / direkte SPS-Anbindung** nötig.

### Warum „weiß“ Morgendrot nicht, welcher Schalter was bedeutet?

Factory I/O liefert nur **technische Tags** (Namen, IDs, Werte). Morgendrot interpretiert die Szene **nicht automatisch** – es gibt keine eingebaute Fabrik-Logik. Die **Semantik** („dieser Sensor = Stau“, „dieser Aktor = Weiche Süd“) musst du **selbst definieren**:

1. **Mapping-Datei (empfohlen)**  
   Lege im Projektroot **`factory-io-map.json`** an (Vorlage: **`scripts/factory-io-map.example.json`**). Dort ordnest du Tag-Namen oder UUIDs festen **Signalen** zu, z. B. `nameContains: "Left conveyor"` → `signal: "conveyor_left"`.  
   Der Feeder schreibt in jede Stream-Nachricht zusätzlich ein Objekt **`signals`**:  
   `{ "conveyor_left": { "value": true, "factoryTagName": "…", "factoryTagId": "…", … }, … }`  
   So kannst du in Auswertungen, Skripten oder späterer UI gezielt auf **`signals.stau_sensor`** usw. reagieren – das ist die „Verbindung“ zwischen Schalter und Bedeutung.

2. **Nur bei Änderung publizieren**  
   Setze in der Map `"publishOnChangeOnly": true` oder die Env-Variable **`FACTORY_IO_PUBLISH_ON_CHANGE=1`**: Dann geht nur eine neue Nachricht in den Stream, wenn sich **irgendein** Tag-Wert geändert hat (wirkt weniger „Rauschen“, etwas näher an Ereignissen).

3. **Tag-Namen herausfinden**  
   Mit laufender Factory-I/O-Web-API z. B.:  
   `curl -s http://127.0.0.1:7410/api/tags`  
   oder einmal Feeder im Dry-Run (ohne `STREAMS_ANCHOR_ID`) – die Logzeile zeigt den Anfang des JSON.

4. **Automatische Aktionen in Morgendrot** (fortgeschritten)  
   Wenn ein bestimmtes **Signal** eine **Chat-Nachricht**, **Heartbeat** oder einen **Befehl** auslösen soll, brauchst du eine **kleine Middleware** (eigenes Skript): z. B. alle paar Sekunden Stream fetchen, JSON parsen, bei `signals.alarm.value === true` → `POST /api/command` mit `/send` oder externe Webhook. Das ist bewusst **nicht** im Kern-Feeder, damit die Kette übersichtlich bleibt.

---

## Ohne Ultimate Edition / ohne Web-API

Falls du nur die **Modbus & OPC Edition** hast: Factory I/O arbeitet dort als **OPC-Client** (verbindet sich zu einem OPC-Server, z. B. einem PLC). Eine Anbindung an Morgendrot wäre dann möglich, indem du einen kleinen **OPC-UA-Server** (z. B. in Node mit `node-opcua`) betreibst, Factory I/O mit diesem Server verbindest und ein separates Skript die Werte aus dem OPC-Server liest und in die Streams-Bridge schreibt. Das ist aufwendiger; für erste Tests reicht die Web-API (Ultimate) plus Feeder.

---

## Szenario: Autonome Sortierstation

Ein durchgängiger Ablauf (Paket kommt an → Verifikation → Sortierung → Incident → Wartung → Warenausgang) deckt **alle 6 Stationen** und viele Kacheln ab:

| Station | Säule | Aktionen (Beispiele) |
|--------|--------|----------------------|
| 1. Wareneingang | Asset-Twin & Vault | `create-asset`, `link-nfc-asset`, `list-assets`, Vault |
| 2. Prozess-Monitoring | Streams & Überwachung | `streams-status`, `streams-fetch`, `heartbeat`, `device-status`, Monitor-API |
| 3. Berechtigungs-Check | Schlüssel & Tickets | `create-key` (Lager_Süd), `list-keys`, `create-ticket`, `has-valid-ticket` |
| 4. Incident-Management | Nachrichten | `send` (Alarm an Techniker), `fetch`, `inbox` |
| 5. Wartung & Rollen | Steuerung | Config ROLE, copyable-ids (OPEN_COMMAND), Streams-Verlauf |
| 6. Warenausgang & Rebate | IDs & Verlauf | `purge-asset`, `rebate-candidates`, `package-id-history`, `streams-anchor-history`, `audit-events` |

**Automatischer Test:** `npm run test:sortierstation` (Backend muss laufen). Optional: zweite Instanz (z. B. Port 3345) und `API_BASE_B` für den Nachrichten-Test (Techniker empfängt Alarm). Env: `STREAMS_BRIDGE_URL`, `STREAMS_ANCHOR_ID`, `UNLOCK_PASSWORD`.

---

## Siehe auch

- **Streams:** `docs/STREAMS-INTEGRATION.md`
- **LoRa-Bridge (ähnliches Muster):** `lora-bridge/README.md`
- Factory I/O Web-API: [docs.factoryio.com/manual/web-api](https://docs.factoryio.com/manual/web-api)
