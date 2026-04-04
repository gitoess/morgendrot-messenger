# LoRa-Mesh + Deferred Settlement – Kritische Prüfung

**Stand:** März 2025. Konzept vor Umsetzung geprüft.

---

## 1. Konzept: LoRa-Mesh als „Nervensystem“

| Aussage | Prüfung |
|--------|--------|
| Meshtastic nutzt LoRa, Daten „hüpfen“ von Gerät zu Gerät (Mesh). | **Korrekt.** Meshtastic ist LoRa-Mesh; Reichweite je Hop typisch hunderte Meter bis mehrere km (terrainabhängig). |
| Tiny-Arbeiter am Garagentor braucht kein WLAN; Status per LoRa. | **Korrekt.** Passt zur Architektur Edge (Pi mit Internet) vs. Tiny (nur Funk). |
| Jedes Gerät = Repeater, große Distanzen. | **Korrekt.** Mesh-Relay ist Standard bei Meshtastic. |

**Repo-Abgleich:** `docs/OFFLINE-FAEHIGKEIT.md` (Möglichkeit C) und `lora-bridge/` beschreiben LoRa/Meshtastic bereits. Die Bridge ist heute **HTTP ↔ LoRa** (Simulation oder Serial), **kein** Meshtastic-MQTT-Bridge. Meshtastic spricht MQTT/Serial – die „Meshtastic-MQTT-Bridge“ auf dem Pi ist also **geplante Erweiterung**, nicht Ist-Zustand.

---

## 2. Brücke: Edge-Gateway als „Dolmetscher“

| Aussage | Prüfung |
|--------|--------|
| Pi = einziges Gerät mit Internet; Meshtastic-MQTT-Bridge. | **Sinnvoll.** Pi empfängt LoRa (via USB-Meshtastic-Node oder Serial), übersetzt in Streams/Chain. |
| Empfang: Pi bekommt LoRa-Signal (z. B. „Tor blockiert“). | **Korrekt.** |
| Verarbeitung: Lokales LLM (Ollama) auf dem Pi analysiert. | **Plausibel.** `config.ts` hat bereits `ENABLE_AI_COPILOT`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`. Kleine Modelle (qwen2:0.5b, 1.5b) laufen auf Pi 4/5. Optional, nicht zwingend für MVP. |
| IOTA-Anker: Pi schiebt als feeless IOTA Stream auf die Chain. | **Richtig.** Streams für Heartbeat/Alarm ist feeless; Boss sieht es im Dashboard. |

**Hinweis:** „Feeless“ gilt für **Streams** (Nachrichten/Heartbeat). L1-Transaktionen (z. B. use_ticket, Rebate) sind nicht feeless (Gas).

---

## 3. Konkreter Nutzen – Tabelle

| Szenario | Ablauf | Bewertung |
|----------|--------|-----------|
| Heartbeat | Tiny sendet alle 30 s Status per Funk. | **Korrekt.** Kein WLAN/SIM, 0 € laufende Kosten. |
| Befehl (Notfall) | Boss → Internet → Gateway → LoRa → Tor. | **Korrekt.** Tor erreichbar auch bei ausgefallenem lokalen Netz. |
| Rechte-Check | Gateway prüft roleId lokal; sendet nur GO/NO-GO per Funk. | **Korrekt und sicher:** Private Key bleibt am Gateway. |

---

## 4. Deferred Settlement (aufgeschobene Abwicklung)

### Ablauf

1. **Aktion (lokal):** LKW-Fahrer entwertet Ticket am Garagentor per LoRa (Meshtastic). Tor hat kein Internet.
2. **Bestätigung (Mesh):** Tor prüft lokal roleId + Ticket-Token, öffnet, sendet **Bestätigung** per Funk an den Raspi.
3. **Sammelbecken:** Raspi speichert Bestätigung lokal („Vault“).
4. **Ankern (online):** Bei Internet schiebt der Raspi gesammelte Bestätigungen als **Batch-TX (PTB)** auf die IOTA-Chain.

### Kritik und Präzision

| Punkt | Bewertung |
|-------|-----------|
| **„Signierte Bestätigung“ vom Tor** | **Begriff klären.** Du schreibst: „Private Key verlässt nie das Gateway.“ Dann kann das **Tor (Tiny)** keine Chain-Signatur erzeugen. Die Bestätigung vom Tor sollte **geräteauthentifiziert** sein (z. B. HMAC mit gemeinsamem Secret oder device-spezifischer Key), damit das Gateway prüfen kann: „Kommt wirklich von Gerät 14.“ Nicht „signiert“ im Sinne von IOTA-Wallet-Signatur. |
| **„Vault“ als Sammelbecken** | **Namenskonflikt.** Im Morgendrot-Code heißt **Vault** der **Schlüsseltresor** (ECDH-Keys, Streams Anchor). Das Sammelbecken für Offline-Bestätigungen ist etwas anderes. Besser: **„Offline-Bestätigungs-Puffer“** oder **„Deferred-Settlement-Queue“** (Datei/DB auf dem Pi), damit keine Verwechslung mit `VAULT_FILE`/`/vault-save` entsteht. |
| **Batch-PTB für 50 Entwertungen** | **Konzept stimmt.** IOTA Rebased erlaubt viele Befehle in einem PTB (bis 1024); eine Gas-Gebühr für die ganze TX. Im Repo existiert **kein** Batch-`use_ticket`; aktuell nur einzelne Aufrufe. Für Deferred Settlement braucht es: PTB mit **mehreren** `use_ticket`-MoveCalls (oder eine Move-Funktion „batch_use_ticket“, falls vorhanden). Implementierungsaufwand: PTB-Builder erweitern. |
| **Beweissicherung / Ausfallsicherheit** | **Sinnvoll.** Kryptografisch gesicherte Kette (device-HMAC + später on-chain) und Unabhängigkeit von öffentlicher Infrastruktur sind valide Ziele. |

---

## 5. Technische Konformität

| Thema | Prüfung |
|-------|--------|
| **Ollama auf dem Pi** | Plausibilitätsprüfung („Ist das Ticket gültig? Zeitstempel ok?“) ist mit kleinen Modellen machbar. Optional für MVP. |
| **Meshtastic Store & Forward** | Store & Forward existiert: **nur auf privaten Kanälen**, nicht auf dem öffentlichen LongFast-Kanal. Server-Knoten braucht **PSRAM** (z. B. T-Beam v1+, T3S3, **Heltec V4**). **Heltec V3** hat laut Meshtastic-Doku oft **kein** PSRAM – für S&F-Server also ggf. ungeeignet; als Client/Repeater nutzbar. Nachrichten „warten im Mesh, bis Gateway abholt“ – korrekt, wenn ein S&F-fähiger Knoten (mit PSRAM) im Mesh ist und für den Pi-Knoten speichert. |

---

## 6. Hardware-Integration

| Aussage | Präzision |
|--------|------------|
| Lilygo T-Beam, Heltec V3, 30–50 €, Meshtastic-kompatibel. | T-Beam (v1+) und Heltec **V3** sind gängig; für **Store & Forward als Server** wird PSRAM benötigt (z. B. Heltec **V4**, T-Beam Supreme). Im Wizard vorkonfigurierbar – sinnvoll als Option „Hardware-Typ: Tiny (LoRa/Meshtastic)“. |

---

## 7. Fazit: Macht das Sinn?

**Ja.** Das Konzept ist stimmig:

- LoRa-Mesh als Off-Grid-Nervensystem für Tiny-Arbeiter.
- Edge-Gateway (Pi) als einziger Internet-Knoten, Meshtastic-MQTT-Bridge (noch zu bauen), Ollama optional.
- Rechte-Check am Gateway, Key nicht auf dem Tiny.
- Deferred Settlement: Offline-Bestätigungen im **Offline-Bestätigungs-Puffer** (nicht „Vault“), später Batch-PTB auf die Chain.

**Vor Umsetzung klären:**

1. **Begriffe:** „Signatur“ vom Tor = Geräte-Authentifizierung (HMAC/Device-Key), nicht Chain-Signatur. „Vault“ für Offline-Queue vermeiden → „Deferred-Settlement-Queue“ / „Offline-Bestätigungs-Puffer“.
2. **Code:** Batch-`use_ticket` (PTB mit N MoveCalls) fehlt noch; Deferred-Settlement-Queue (Persistenz auf dem Pi) fehlt noch; Meshtastic-MQTT-Anbindung (oder Erweiterung der bestehenden LoRa-Bridge um Meshtastic-Protokoll) ist geplant, nicht fertig.
3. **Hardware:** Store & Forward nur mit PSRAM-Knoten (z. B. Heltec V4, T-Beam v1+); Heltec V3 für reine Client/Repeater-Rolle.

Damit ist das Konzept **kritisch geprüft und umsetzbar**; die obigen Präzisierungen sollten in der Umsetzung (Doku + Code) berücksichtigt werden.
