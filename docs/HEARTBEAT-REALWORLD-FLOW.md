# Heartbeat über Streams – Real-World-Ablauf (Boss + Arbeiter in der UI)

So läuft ein **echter** Heartbeat in der Praxis ab: Boss und Arbeiter nutzen die **gleiche** Streams-Bridge und den **gleichen** Kanal (Anchor-ID). Der Arbeiter sendet „Ich bin da“, der Boss liest mit und erkennt Offline, wenn der Puls ausbleibt.

---

## Lite-UI im Browser öffnen

1. **Im Terminal (im Projektordner):**
   ```bash
   npm run start:secrets
   ```
   Oder nur API + Lite-UI ohne Next-Frontend: `npm run dev:lite`

2. **Warten**, bis im Terminal erscheint:
   ```text
   Morgendrot API: http://127.0.0.1:3342/api/status  Lite-UI: http://127.0.0.1:3342/
   ```
   Wenn Port 3342 belegt ist, weicht das Backend auf 3343 (oder 3344 …) aus – dann steht dort z. B. `3343` statt `3342`.

3. **Im Browser öffnen:** die angezeigte **Lite-UI-URL**, z. B.:
   - **http://127.0.0.1:3342/**  
   - oder **http://127.0.0.1:3343/** (wenn 3342 belegt war).

Ohne laufendes Backend öffnet sich die Adresse nicht – zuerst immer `npm run start:secrets` (oder `npm run dev:lite`) ausführen.

---

## Voraussetzungen

- **Streams-Bridge** läuft (z. B. **Mock:** `npm run streams-mock` → `http://127.0.0.1:9343`, oder LoRa-Bridge / eigener Service).
- **Boss:** eine Morgendrot-Instanz (UI + Backend), Rolle Boss (oder Kommandant).
- **Arbeiter:** eine zweite Instanz (anderes Gerät oder zweites Backend mit anderer `.env` / anderem Port), Rolle Arbeiter.

**Schnell-Demo mit Mock und Skript:** `npm run demo:heartbeat` startet die Mock-Bridge, erstellt einen Kanal und sendet als „Arbeiter“ Heartbeats. Die Ausgabe zeigt die nötigen Env-Variablen; Backend mit diesen starten, dann in der UI „Geräte-Status“ prüfen. Siehe Skript-Kommentar in `scripts/run-heartbeat-demo.ts`.

**RoleID und S-Bit für Heartbeat:** Ein Arbeiter, der nur hört (L), ist „stumm“ (z. B. ID 12 = 001100). Damit der Heartbeat beim Boss ankommt, muss das Gerät **senden** können → **S-Bit (Bit 1, Wert 2) zwingend**. Mindest-RoleID für einen sendefähigen Arbeiter: **14** (001110: BW+L+S). Beim Provisioning vergibt das Dashboard standardmäßig 14; nur mit 14 (oder höher) darf die WalletBridge den Heartbeat über Streams senden.

---

## Schritt für Schritt in der UI

### Teil 1: Boss (Kanal anlegen und überwachen)

1. **Streams-Kachel öffnen**
   - **Streams-Konfiguration:** `STREAMS_BRIDGE_URL` eintragen (z. B. `http://127.0.0.1:9343` bei Mock).
   - Auf **Setzen** klicken.

2. **Kanal erstellen**
   - Im Block **„Als Kanal-Inhaber – Kanal erstellen“** auf **Kanal erstellen** klicken.
   - Backend ruft die Bridge auf (`POST /streams/create`), bekommt eine **Anchor-ID** und speichert sie in `STREAMS_ANCHOR_ID` (und optional im Vault).
   - Optional: **Vault speichern**, damit die Anchor-ID gesichert ist.

3. **Anchor-ID an den Arbeiter weitergeben**
   - In **Steuerung → Code ausgeben**: Rolle **Arbeiter** wählen, **STREAMS_ANCHOR_ID** und **STREAMS_BRIDGE_URL** mit ausgeben (oder manuell kopieren und auf dem Arbeiter eintragen).

4. **Überwachung einrichten**
   - **Überwachungs-Kachel** öffnen.
   - **Ich überwache (Boss/Kommandant):**
     - **MONITOR_DEVICES:** Adresse des Arbeiters eintragen (Komma-getrennt bei mehreren), z. B. `0x1234…` (die `MY_ADDRESS` der Arbeiter-Instanz).
     - Auf **Setzen** klicken.
     - **ENABLE_MONITOR** aktivieren (Haken).
   - Optional: **Geräte-Status** klicken – anfangs „nie“ oder offline, bis der erste Heartbeat kommt.

5. **Backend als Monitor starten**
   - Damit der Boss die Heartbeats **liest**, muss die Boss-Instanz mit **ENABLE_MONITOR=true** und **MONITOR_DEVICES** (und **STREAMS_ANCHOR_ID**, **STREAMS_BRIDGE_URL**) **beim Start** laufen. Wenn du die Config erst in der UI setzt, **Backend einmal neu starten**, damit der Monitor-Loop startet.

---

### Teil 2: Arbeiter (Kanal beitreten und Heartbeat senden)

1. **Streams-Kachel öffnen**
   - **STREAMS_BRIDGE_URL** setzen (gleich wie beim Boss), z. B. `http://127.0.0.1:9343`.
   - **STREAMS_ANCHOR_ID** eintragen (vom Boss aus „Code ausgeben“ oder manuell übernommen).
   - Beides auf **Setzen** klicken.

2. **Kanal abonnieren**
   - Im Block **„Kanal beitreten – Kanal abonnieren“** auf **Kanal abonnieren** klicken.
   - Backend meldet sich bei der Bridge für diesen Kanal an (`POST /streams/subscribe`).

3. **Heartbeat aktivieren**
   - **Überwachungs-Kachel** öffnen.
   - **Ich sende Heartbeat (Gerät):**
     - **ENABLE_HEARTBEAT** aktivieren (Haken).
     - Optional: **Intervall (ms)** setzen (z. B. 30000) und **Intervall setzen** klicken.
   - **Heartbeat senden** klicken → sendet sofort einen Puls (für Test).
   - Im laufenden Betrieb: Backend startet die Heartbeat-Loop (alle X Sekunden) automatisch, wenn **ENABLE_HEARTBEAT** gesetzt ist und die Instanz z. B. als Lock/Arbeiter läuft.

4. **Backend-Konfiguration dauerhaft machen**
   - Damit der Arbeiter nach Neustart weiter Heartbeats sendet: **ENABLE_HEARTBEAT**, **STREAMS_ANCHOR_ID**, **STREAMS_BRIDGE_URL**, **HEARTBEAT_INTERVAL_MS** in der `.env` der Arbeiter-Instanz setzen (oder über UI setzen, dann wird `.env` geschrieben).

---

### Teil 3: Prüfen (Boss)

- **Überwachung → Geräte-Status** erneut aufrufen.
- Erwartung: Das Arbeiter-Gerät erscheint mit Status **online** und „zuletzt: &lt;Zeitpunkt&gt;“.
- Wenn der Arbeiter stoppt oder die Bridge nicht erreichbar ist: Nach Ablauf von **MONITOR_OFFLINE_TIMEOUT_MS** wechselt der Status zu **offline** und optional wird **MONITOR_ALARM_WEBHOOK_URL** ausgelöst.

---

## Ablauf in Kurzform

| Rolle   | Aktion in der UI |
|--------|-------------------|
| **Boss** | Streams: Bridge-URL setzen → **Kanal erstellen** → Anchor-ID per Code ausgeben weitergeben. Überwachung: MONITOR_DEVICES = Arbeiter-Adresse, ENABLE_MONITOR an. Backend ggf. neu starten. |
| **Arbeiter** | Streams: Bridge-URL + **STREAMS_ANCHOR_ID** (vom Boss) setzen → **Kanal abonnieren**. Überwachung: **ENABLE_HEARTBEAT** an, optional Intervall, **Heartbeat senden** (Test). |
| **Boss** | Überwachung → **Geräte-Status** → Gerät „online“ mit letztem Heartbeat-Zeitpunkt. |

---

## Technisch dahinter

- **Kanal:** Ein Kanal = eine Anchor-ID an der Bridge. Boss erzeugt sie mit `POST /streams/create`, Arbeiter nutzt dieselbe ID zum Abonnieren und zum Senden.
- **Heartbeat-Nachricht:** JSON `{ "type": "heartbeat", "device": "<MY_ADDRESS>", "ts": <timestamp> }` wird vom Arbeiter per `publish(anchorId, payload)` an die Bridge geschickt (feeless, kein On-Chain).
- **Boss:** Der Monitor-Loop pollt die Bridge (`GET ?anchor=...`), parst eingehende Nachrichten und ruft bei `type === 'heartbeat'` `recordHeartbeat(device)` auf → speichert Zeitstempel in **MONITOR_STATE_FILE**. **Geräte-Status** liest diese Daten + **MONITOR_OFFLINE_TIMEOUT_MS** und zeigt online/offline an.

Mit diesem Ablauf kannst du einen echten Heartbeat komplett in der UI durchspielen (Boss + Arbeiter).
