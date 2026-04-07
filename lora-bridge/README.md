# Morgendrot LoRa-Bridge

HTTP ↔ LoRa-Mesh Bridge für Morgendrot. Verbindet `STREAMS_BRIDGE_URL` mit Heltec/Meshtastic-Geräten.

## Schnellstart

```bash
cd lora-bridge
npm install
npm start
```

Morgendrot konfigurieren:

```env
STREAMS_BRIDGE_URL=http://localhost:9342
STREAMS_ANCHOR_ID=dein-anchor
OPEN_STREAMS_ENABLED=true
# Optional: Streams empfangen
STREAMS_LISTEN_ENABLED=true
```

## Modus

| Modus | LORA_BRIDGE_SIMULATION | Beschreibung |
|-------|------------------------|--------------|
| **Simulation** | true (Default) | Keine Hardware. Für Tests. Nachrichten in-memory. |
| **Serial** | false | LoRa über Serial-Port (Heltec/Meshtastic). |

## API (Morgendrot-kompatibel)

- **GET** `/?anchor=...` → `{ messages: [{ sender, payload, nonce }] }`
- **POST** `/` mit `{ anchor, payload }` → sendet an LoRa-Mesh (Legacy-JSON mit `anchor`/`payload`/`ts`)
- **POST** Notfall-Umschlag **v1** (Meshtastic rein als Transport, Schlüssel vorher online z. B. über IOTA):
  ```json
  {
    "anchor": "optional-für-streams-filter",
    "emergency": {
      "v": 1,
      "t": "text",
      "f": "0x…",
      "n": 1001,
      "b": "<base64 App-E2EE-Ciphertext>"
    }
  }
  ```
  - `t`: `"text"` (nur `b`) oder `"pay"` (zusätzlich `pay: { "to": "0x…", "amount": "1.5" }`, Testnet / vertrauensbasiert).
  - Gesamtgröße des JSON-Umschlags ≤ `LORA_MAX_PAYLOAD_BYTES` (Default 240). `b` max. 160 Bytes nach Base64-Dekodierung.
  - Die Bridge **entschlüsselt nicht**; Replay-Schutz: gleiche `f`+`n` wird dedupliziert.

Siehe `src/emergency-envelope.ts`.

- **POST** **Emergency v2 (binär, kompakt)** – Body:
  ```json
  {
    "emergencyV2": {
      "senderAddress": "0x…64hex…",
      "nonce": 42,
      "ciphertext": "<base64 Rohbytes App-E2EE>"
    }
  }
  ```
  Wire: 1 Byte Version `2`, 4 Byte `nonce` (uint32 BE), 32 Byte SHA-256(IOTA-Adresse), dann Ciphertext. Gesamtlänge ≤ `LORA_MAX_PAYLOAD_BYTES`. Siehe `src/emergency-binary.ts`.

**Operative Reichweite:** Wen ein Notfall über Funk/Kette **tatsächlich** erreicht und wie die **Brücke** zu professioneller Hilfe gedacht ist (kein Ersatz für 112) — **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**.

## HAL (Simulation / Serial)

| Modus | Umgebung | Treiber |
|-------|-----------|---------|
| `LORA_BRIDGE_SIMULATION=true` | Default | `SimLoraDriver` |
| `LORA_BRIDGE_SIMULATION=false` + `LORA_SERIAL_PORT` | PC, USB-UART | `SerialLoraDriver` (Rohbytes – **kein** Meshtastic-Protobuf; für Tunnel/eigene Firmware) |

**Web Bluetooth (Handy):** nicht in diesem Node-Paket – erfolgt im **Frontend** (separater Pfad), Bridge bleibt HTTP/Serial.

## Konfiguration (.env)

| Variable | Default | Beschreibung |
|----------|---------|--------------|
| LORA_BRIDGE_PORT | 9342 | HTTP-Port |
| LORA_BRIDGE_SIMULATION | true | Keine Hardware |
| LORA_SERIAL_PORT | – | COM3, /dev/ttyUSB0 (nur wenn Simulation=false) |
| LORA_BAUD_RATE | 115200 | Serial-Baudrate |
| LORA_MAX_PAYLOAD_BYTES | 240 | LoRa-Paketgröße |
| LORA_BRIDGE_API_KEY | – | Optional: API-Key für Auth |
| LORA_BRIDGE_CORS_ORIGINS | – | CORS (kommagetrennt) |
| MORGENDROT_GATEWAY_URL | – | Wenn gesetzt: empfangene LoRa-Nachrichten werden an dieses Morgendrot-Gateway weitergeleitet (POST /api/tiny-message). Für Tiny-Arbeiter (HMAC wird im Gateway geprüft). |

## Sicherheit

- **API-Key:** Optional `LORA_BRIDGE_API_KEY` – Morgendrot müsste dann `Authorization: Bearer <key>` senden (derzeit nicht im Morgendrot-Adapter).
- **Payload-Limit:** Max. 240 Bytes (LoRa-typisch).
- **CORS:** Einschränkbar über `LORA_BRIDGE_CORS_ORIGINS`.
- **Kein Shell:** Kein exec/spawn; nur HTTP + Serial.

## Hardware (zukünftig)

Für echte LoRa-Anbindung:

1. **Meshtastic:** Firmware auf Heltec, `serialport`-Node für Bridge.
2. **Eigene Firmware:** SX1276/8 über UART, Protokoll JSON oder binär.

## Tests

```bash
npm test
```

## Integration in Morgendrot

Das Projekt liegt unter `morgendrot/lora-bridge/`. Morgendrot konfigurieren:

```env
STREAMS_BRIDGE_URL=http://localhost:9342
```

Bridge starten: `npm run lora-bridge` (im Projektroot) oder `npm start` (in lora-bridge/).

---

## Meshtastic / Tiny-Gateway

- **Meshtastic:** Die Bridge kann mit Meshtastic-kompatiblen Geräten über **Serial** (USB) verbunden werden (`LORA_BRIDGE_SIMULATION=false`, `LORA_SERIAL_PORT=/dev/ttyUSB0`). Meshtastic-Firmware nutzt dasselbe Serial-Interface.
- **Tiny → Gateway:** Wenn **MORGENDROT_GATEWAY_URL** gesetzt ist (z. B. `http://192.168.1.10:3342`), leitet die Bridge jede empfangene LoRa-Nachricht an `POST /api/tiny-message` weiter. Das Morgendrot-Gateway (Raspi) prüft HMAC und verarbeitet Heartbeat (Streams mit `transport: lora`) oder Ticket-Bestätigung (Settlement-Queue).
- **Tiny-Payload:** JSON mit `deviceId`, `payload`, `timestamp`, `hmac` (vom Wizard erzeugtes Geräte-Secret).

## Geplante Erweiterungen

| Erweiterung | Wann sinnvoll | Aufwand |
|-------------|---------------|---------|
| **Serial-Treiber** (echte LoRa-Hardware) | Wenn Heltec/Meshtastic-Geräte vorhanden | 2–4 Tage: `serialport` + Meshtastic-API |
| **MQTT** (Meshtastic MQTT-Broker) | Wenn Meshtastic über MQTT statt Serial angebunden wird | Optional: MQTT-Client, Topic-Subscribe |
| **Rate-Limiting** | Wenn Bridge öffentlich erreichbar (Internet) | Wenige Stunden |

Bei lokalem Einsatz (localhost/LAN) sind beide optional.
