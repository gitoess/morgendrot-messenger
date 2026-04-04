# Umsetzungsplan – Alle sinnvollen Punkte aus den letzten ~20 Nachrichten

**Stand:** März 2025. Priorisiert und mit kritischer Prüfung der drei Zusatzpunkte (HMAC, Non-Blocking Queue, transport im Heartbeat).

---

## A. Kritische Prüfung der drei Zusatzpunkte

### 1. HMAC-Handshake-Protokoll

**Idee:** Tiny hat keinen Private Key → Shared Secret mit dem Gateway. Gateway prüft: „Dieses Funk-Paket kommt wirklich von Tor 14.“ Wizard schreibt das Secret in C-Header (Tiny) und in die Gateway-Config (Raspi).

| Prüfung | Bewertung |
|--------|-----------|
| **Sinn** | **Ja.** Ohne Chain-Key ist geräteauthentifizierte Nachricht nur mit geteiltem Secret (HMAC) oder device-spezifischem Key möglich. HMAC(deviceId \| payload \| timestamp, secret) → Gateway verifiziert und weist Replay per Timestamp/Nonce ab. |
| **Sicherheit** | **Wichtig:** Der Wizard darf **keinen „kurzen Code“** (z. B. 6-stellig) erzeugen – der muss ein **kryptographisch starkes Secret** sein (z. B. 32 Bytes random, Base64 oder Hex). Sonst Brute-Force. Bezeichnung im UI: „Geräte-Secret“ (nicht „kurzer Code“). |
| **Wizard-Ausgabe** | Tiny: `identity.h` (oder JSON) mit `DEVICE_ID`, `GATEWAY_URL`, `DEVICE_SECRET` (oder `HMAC_SECRET`). Gateway: .env mit `TINY_DEVICE_SECRET_<deviceId>=<secret>` oder eine Datei `tiny-devices.json` (deviceId → secret). Pro Tiny ein eigenes Secret empfohlen. |
| **Implementierung** | Wizard: Bei Hardware-Typ „Embedded/Tiny“ Schritt „Geräte-Secret“: generieren (crypto.randomBytes(32)), anzeigen, in C-Header + Gateway-Config schreiben. Gateway: bei eingehender LoRa-Nachricht HMAC prüfen, dann verarbeiten. |

**Fazit:** Sinnvoll; „kurzer Code“ durch **starkes Geräte-Secret** ersetzen und im Plan so festschreiben.

---

### 2. Non-Blocking Queue (Settlement-Queue)

**Idee:** Der Raspi darf nicht einfrieren, wenn die IOTA-Chain mal 5+ Sekunden braucht. Asynchroner Hintergrund-Worker schaufelt die Queue leer, Frontend (UI) bleibt flüssig.

| Prüfung | Bewertung |
|--------|-----------|
| **Sinn** | **Ja.** Blockiert der Event-Loop auf RPC/signAndExecute, blockiert die ganze App (inkl. UI, weitere Lock-Anfragen). Standard-Lösung: Queue (Datei oder DB) + **Background-Worker** (setInterval oder dedizierter async Loop), der Batches liest, PTB baut, sendet, bei Erfolg Einträge entfernt. |
| **Design** | **Deferred-Settlement-Queue** (persistent, z. B. JSONL-Datei oder SQLite): Einträge = { deviceId, ticketId, eventId, timestamp, ggf. HMAC }. Worker: z. B. alle 10 s oder nach jedem neuen Eintrag: bis zu N Einträge lesen → PTB mit N× use_ticket → signAndExecute → bei Erfolg Einträge aus Queue löschen. Kein await im Haupt-Request-Flow. |
| **Fehlerbehandlung** | Bei RPC-Fehler: Einträge in Queue belassen, Retry mit Backoff. Optional: Max-Retries, dann in „failed“-Log verschieben und manuell prüfbar machen. |

**Fazit:** Sinnvoll und notwendig für brauchbare UX; im Plan als eigener Task „Deferred-Settlement-Queue + asynchroner Worker“.

---

### 3. „Mesh-ID“ / transport im Heartbeat

**Idee:** Im Dashboard sichtbar, wie die Nachricht ankam: `transport: "lora"` oder `transport: "internet"`.

| Prüfung | Bewertung |
|--------|-----------|
| **Sinn** | **Ja.** Ops können so erkennen: Heartbeat kam per LoRa (Tiny → Gateway → Streams) vs. direkt aus dem Internet (Node Lock mit Streams). Nützlich für Debug und Mesh-Monitoring. |
| **Feldname** | `transport` ist treffend. Werte z. B. `"lora"` \| `"internet"` (oder `"streams"` für direkt vom Node). Erweiterbar: später `"meshtastic"`, `"mqtt"` usw. |
| **Umsetzung** | **Sender-Seite:** Beim Senden des Heartbeats ein optionales Argument `transport?: 'lora' | 'internet'`. Node Lock/Arbeiter: default `"internet"` (oder weglassen = „direkt“). **Gateway:** Wenn Gateway einen Heartbeat von einem Tiny per LoRa empfängt und an Streams weiterleitet, setzt es `transport: "lora"`. **Monitor/Dashboard:** Anzeige des Feldes (Icon/Badge „LoRa“ vs. „Internet“). |

**Fazit:** Sinnvoll; geringer Aufwand, klarer Nutzen. Im Plan: Heartbeat-Payload um `transport` erweitern, Gateway bei Weiterleitung setzen, UI anzeigen.

---

## B. Gesamtübersicht der sinnvollen Aufgaben (aus letzten ~20 Nachrichten)

Aus Konversation, LORA-MESH-DEFERRED-SETTLEMENT-KRITIK und PROVISIONING-UI-PLAN-LOGISCH zusammengeführt, priorisiert.

---

### Phase 1: Basis – Headless, Wizard-Rollen, Streams/Vault in Ausgabe

| # | Task | Kurzbeschreibung | Priorität |
|---|------|------------------|-----------|
| 1.1 | **Headless-Mode** | Bei `ENABLE_UI=false` keinen UI-Server starten; optional separater Entry `worker-headless.ts` (nur Listener + Heartbeat, ggf. Lock), ohne api-server/AI-Copilot. | Hoch |
| 1.2 | **Wizard: Rollen erweitern** | Im Provisioning-Wizard Rollen: Arbeiter, Kommandant, **Lock**, **Monitor**, **Wärter**, **User (nur NFT/QR)**. Pro Rolle nur relevante Felder. | Hoch |
| 1.3 | **DeviceProvisionParams + buildDeviceEnv/Json** | Neue Rollen unterstützen; **STREAMS_ANCHOR_ID**, **STREAMS_BRIDGE_URL**, **VAULT_FILE** (wo nötig), Lock/Monitor/Wärter-spezifische Variablen in Ausgabe. | Hoch |
| 1.4 | **API /api/provision-device** | `role`: arbeiter, kommandant, lock, monitor, wärter, user. Bei user: nur qrPayload/Explorer-Link, keine .env. | Hoch |
| 1.5 | **UI: Schritt Mission (Alltag)** | Optionaler Schritt „Mission / Alltag“ (nur Heartbeat, Heartbeat+Befehle, nur Ticket einlösen usw.). | Mittel |
| 1.6 | **UI: Schritt Hardware-Typ** | Auswahl: Desktop/Server \| IoT-Gateway (Raspi) \| **Embedded/Tiny**. Bei Tiny: Ausgabe C-Header/Token, kein Node-Paket. | Hoch (für Tiny-Story) |

---

### Phase 2: Tiny & Gateway – Identity, HMAC, LoRa

| # | Task | Kurzbeschreibung | Priorität |
|---|------|------------------|-----------|
| 2.1 | **Wizard: Hardware-Typ Tiny – Identity-Header** | Bei „Embedded/Tiny“ Ausgabe: `identity.h` (oder JSON) mit deviceId, roleId, gatewayUrl, **kein** privater Chain-Key. Optional: Platzhalter für Token/Secret. | Hoch |
| 2.2 | **Wizard: Geräte-Secret (HMAC) für Tiny** | Bei Tiny: Generierung **starkes Secret** (z. B. 32 Bytes); Ausgabe in C-Header (Tiny) + in Gateway-Config (.env oder tiny-devices.json). Doku: „Geräte-Secret“, nicht „kurzer Code“. | Hoch |
| 2.3 | **Gateway: HMAC-Verifikation** | Eingehende LoRa-Nachrichten (von Tiny): HMAC mit Geräte-Secret prüfen; nur bei gültiger Signatur weiterverarbeiten (Heartbeat weiterleiten, Offline-Bestätigung in Queue). | Hoch |
| 2.4 | **Meshtastic-MQTT-Bridge (oder Erweiterung LoRa-Bridge)** | Pi als Bridge: Meshtastic (MQTT/Serial) ↔ Morgendrot (Streams, Queue). Entweder Erweiterung von `lora-bridge/` um Meshtastic-Protokoll oder neues Modul. | Mittel (nach 2.1–2.3) |
| 2.5 | **Heartbeat: Feld `transport`** | Heartbeat-Payload um `transport: 'lora' \| 'internet'` erweitern. Node: default `internet`; Gateway bei Weiterleitung von LoRa: `lora`. Monitor/Dashboard: Anzeige. | Mittel |

---

### Phase 3: Deferred Settlement – Queue, Batch-PTB, Worker

| # | Task | Kurzbeschreibung | Priorität |
|---|------|------------------|-----------|
| 3.1 | **Offline-Bestätigungs-Puffer (Queue)** | Persistente Queue (z. B. JSONL oder SQLite): Einträge = deviceId, ticketId, eventId, timestamp, ggf. HMAC-Signatur. Kein Begriff „Vault“ (Vault = Schlüsseltresor). Name: „Deferred-Settlement-Queue“ / „SettlementQueue“. | Hoch |
| 3.2 | **Asynchroner Settlement-Worker** | Hintergrund-Worker (non-blocking): Liest Batch aus Queue, baut PTB mit mehreren `use_ticket`, führt signAndExecute aus; bei Erfolg Einträge entfernen. Kein Blockieren des Event-Loops; Retry/Backoff bei Fehlern. | Hoch |
| 3.3 | **Batch use_ticket (PTB)** | PTB mit mehreren MoveCalls `use_ticket` (oder batch_use_ticket falls in Move vorhanden). chain-access: Funktion z. B. `batchUseTicket(ticketIds, eventId, ...)` oder Loop über use_ticket im PTB. | Hoch |
| 3.4 | **Gateway: Eintrag in Queue bei Offline-Bestätigung** | Wenn Gateway von Tiny (per LoRa) eine bestätigte Entwertung erhält (HMAC-verifiziert): Eintrag in Settlement-Queue schreiben; Worker übernimmt später. | Hoch |

---

### Phase 4: Optional – Ollama, Store & Forward, Doku

| # | Task | Kurzbeschreibung | Priorität |
|---|------|------------------|-----------|
| 4.1 | **Ollama auf Pi (optional)** | Plausibilitätsprüfung von Offline-Daten („Ticket gültig? Zeitstempel ok?“) mit kleinem Modell. Bereits Config (OLLAMA_*); nur Nutzung in Gateway-Pipeline. | Niedrig |
| 4.2 | **Store & Forward (Meshtastic)** | Nur auf privaten Kanälen; Server-Knoten mit PSRAM. Doku anpassen (Heltec V4 / T-Beam v1+ für S&F-Server). | Niedrig |
| 4.3 | **Doku: Rebased-Referenz, Lora/Deferred** | Kurze Referenz Move-Objekte/SDK; LORA-MESH-DEFERRED-SETTLEMENT-KRITIK und dieser Umsetzungsplan verlinken. | Niedrig |

---

## C. Abhängigkeiten und Reihenfolge

- **1.1 Headless** kann früh umgesetzt werden (unabhängig).
- **1.2–1.6** Wizard/Rollen/API/UI: untereinander abhängig, als Block sinnvoll.
- **2.1–2.3** Tiny Identity + HMAC: Voraussetzung für sicheres Tiny-Gateway; 2.2 (Secret) mit 2.1 (Identity-Header) zusammen im Wizard.
- **2.4** Meshtastic-Bridge baut auf 2.3 (HMAC) und ggf. 2.5 (transport) auf.
- **2.5** transport im Heartbeat: jederzeit einbaubar, geringer Aufwand.
- **3.1–3.4** Deferred Settlement: 3.1 Queue + 3.2 Worker + 3.3 Batch-PTB zuerst; dann 3.4 Gateway schreibt in Queue.

Empfohlene Reihenfolge für einen ersten lauffähigen Pfad:

1. **Headless** (1.1)  
2. **Wizard Rollen + Hardware-Typ + Tiny Identity + Geräte-Secret** (1.2–1.6, 2.1–2.2)  
3. **Heartbeat transport** (2.5)  
4. **Settlement-Queue + Worker + Batch use_ticket** (3.1–3.3)  
5. **Gateway: HMAC + Eintrag in Queue** (2.3, 3.4)  
6. **Meshtastic-Bridge** (2.4) wenn LoRa-Hardware im Fokus ist  

---

## D. Kurzfassung der Prüfung der drei Zusatzpunkte

| Punkt | Sinn? | Anpassung / Hinweis |
|-------|-------|----------------------|
| **HMAC-Handshake** | Ja | Secret = kryptographisch stark (z. B. 32 Bytes), nicht „kurzer Code“. Wizard schreibt in C-Header + Gateway-Config. |
| **Non-Blocking Queue** | Ja | Asynchroner Worker, der Settlement-Queue leerschaufelt; UI blockiert nicht. Retry/Backoff bei RPC-Fehler. |
| **transport im Heartbeat** | Ja | Feld `transport: 'lora' \| 'internet'`; Gateway setzt `lora` bei Weiterleitung; Dashboard anzeigen. |

Damit ist der Umsetzungsplan vollständig und die drei Zusatzpunkte sind sinnvoll; die genannten Präzisierungen sind im Plan berücksichtigt.
