# Hardware – Übersicht (strikt getrennte Ordner)

Jede **physische Komponente** oder klar abgegrenzte **Funk-/Bridge-Schicht** hat einen **eigenen Ordner** mit eigener `README.md`. Keine Vermischung von Firmware-Notizen, Host-Rollen und App-Code in einem Topf.

| Ordner | Inhalt |
|--------|--------|
| **[`../heltec/`](../heltec/README.md)** | Heltec-Board (LoRa, Meshtastic-Client, Web Bluetooth vom Browser), Antenne, Gehäuse-Hinweise. **Kein** Anwendungs-Node-Code. |
| **[`../cm4/`](../cm4/README.md)** | Raspberry Pi **Compute Module 4** / Host: API, Next-UI, Wallet-Sitzung, USB/seriell zum Funk-Modul; **optional LTE** für die Basis (siehe unten). |
| **[`../meshtastic/`](../meshtastic/README.md)** | Meshtastic-/Firmware-Spezifikation; **Phase 2:** [`PHASE-2-FIRMWARE-SPEC.md`](../meshtastic/PHASE-2-FIRMWARE-SPEC.md) (433 Cave Edition, Buffer, Prioritäten, RS485, CM4-Fail-Safe). Mesh-v2: 240 B. |
| **[`../lora-bridge/`](../lora-bridge/README.md)** | **Software-Bridge** HTTP ↔ Serial/LoRa (eigenes Node-Projekt, nicht identisch mit Heltec-Ordner). |

## Frequenz-Strategie (LoRa / ISM)

Richtlinie für **Hardware-, Firmware- und Einsatzplanung** (mit [`docs/PROJECT-FOCUS-AND-PRIORITIES.md`](../docs/PROJECT-FOCUS-AND-PRIORITIES.md) abgestimmt):

| Stufe | Hardware-Aufwand | Rechtlicher Status | Taktischer Nutzen |
|--------|------------------|--------------------|-------------------|
| **868 MHz** | Null (Standard) | ISM (u. a. 1 % Duty Cycle je nach Region/Regeln) | Schneller Start, gute globale Verfügbarkeit und Community-Support |
| **433 MHz** | Gering (Modultausch + passende Antenne) | ISM (bessere Penetration, teilweise günstigeres Duty-Cycle-Regime je Region) | Stabilerer Link in feuchtem Fels, Höhlen und verwinkelten Umgebungen – **mittelfristiger Optimierungsweg** |
| **BOS (380–400 MHz)** | Hoch (Spezialmodul, angepasste Filter) | **Sondergenehmigung erforderlich** | Maximale Priorität und Airtime (kein normales ISM-Duty-Cycle-Limit) – **nur** für behördliche Einsätze, langfristige Option |

**Planungsregeln:**

- **868 MHz** bleibt der **Standard** für erste Tests und schnelle Entwicklung.
- **433 MHz** ist das **mittelfristige Ziel** für bessere Reichweite in realen Einsatzszenarien (Höhlen, Berge, feuchtes Gelände); Firmware-/Board-Wahl (z. B. Region EU_433) an [`meshtastic/PHASE-2-FIRMWARE-SPEC.md`](../meshtastic/PHASE-2-FIRMWARE-SPEC.md) und Datenblatt koppeln.
- **BOS-Frequenzen** nur als **langfristige** Option mit hohem rechtlichem und hardwareseitigem Aufwand; nicht als Default-Annahme in Software-Specs.

## Software-Bezug im Monorepo (Referenz, keine Duplikation)

| Thema | Pfad im Repo |
|--------|----------------|
| LoRa-Bild Phase 1 (Sender) | `src/lora-progressive-image.ts` |
| Mesh v2 Build/Decrypt | `src/messenger-nest/messenger-chain-wrap.ts` (`MESH_V2_MAX_BYTES`) |
| Messenger UI „Für LoRa senden“ | `frontend/frontend/components/views/chat-view.tsx` |
| LoRa-Empfänger / Fusion-API | `frontend/…/chat-message-body.tsx`, `POST /api/lora-progressive-fuse` |
| LoRa → IOTA Delayed Upload (Spec) | [`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`](../docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md) |
| Internet / LTE-Basis (SIM, Gateway) | Abschnitt **„Internet an der Basis“** in dieser Datei |
| Drohne / Ballon als „fliegender Messenger“ | [`docs/DRONE-RELAY-STRATEGY.md`](../docs/DRONE-RELAY-STRATEGY.md) |
| Wires für manuelle Tests | `scripts/print-lora-wires-for-ui-test.ts` |

## Internet an der Basis (SIM / LTE) – nur Gateway-Rolle

Der **CM4 hat keinen integrierten SIM-Slot**. Für eine **Basis-Station** am festen Standort (Höhleneingang, Lager, …), die **LoRa/Meshtastic** einsammelt und **Delayed Upload nach IOTA** ausführt, ist typisch:

| Baustein | Hinweis |
|----------|---------|
| **LTE/4G HAT** | z. B. Waveshare SIM7600 (oder vergleichbar) am Pi |
| **Externe Mobilfunk-Antenne** | Montage und Kabel wie Datenblatt |
| **SIM-Karte** | Nur an der **Basis**; **Vortrupp und Relais bleiben ohne SIM** (rein offline über LoRa, später ggf. `.morg-pkg`) |
| **WiFi** | Sinnvoller **Backup** zum LTE (LAN/WLAN, wenn verfügbar) |

**Einsatzlogik (Zielbild):** Wenn Internet erreichbar ist → **IOTA** als primärer Online-Pfad; **LoRa** bleibt **Offline-/Notfall-Fallback**. Die Basis kombiniert **Meshtastic/MQTT oder serieller Pfad** mit **Upload-Skript/Service** (siehe `docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`).

**Aufwand (grobe Größenordnung):** Hardware **mittel** (ca. 60–100 € + Aufbau 1–2 h); Software für **robustes Auto-Reconnect + Upload-Queue** **mittel** (oft mehrere Tage bis produktionsnah, abhängig von Monitoring und Fehlerfällen).

**Rollen:** **Basis** = CM4 + UI/IOTA/Gateway (optional LTE). **Vortrupp / Relais** = vor allem **Heltec** (+ ggf. **ESP32-CAM** für Bilder am Rand) – **kein Pi zwingend**. **Träger** (Drohne, Ballon, …) = physischer Montageort für **denselben** Messenger/Meshtastic-Stack, **keine** Sonder-Firmware dafür.

**Randbedingungen:** **Brownout-Schutz** und **sauberes Power-Management** gelten besonders für Basis (Pi + HAT + Funk) und Feldgeräte – mit Specs und Strombudget abstimmen.

Strategisch: **Meshtastic-First** (`docs/MESHTASTIC-BUILDING-BLOCKS.md`, `docs/PROJECT-FOCUS-AND-PRIORITIES.md`) – LTE löst nur den **Internet-Uplink** der Basis, nicht das Mesh-Protokoll.

---

## Was hier **nicht** liegt

- **Move-/IOTA-Logik** → `move-test/`, `src/chain-access.ts` usw.
- **Messenger-Bundles** → `exports/`, `deploy/`

Bei neuen Hardware-Bausteinen: **eigenen Unterordner** unter Repo-Root oder unter `hardware/` nur, wenn es ein **reines Dokumentations-Bundle** sein soll – aktuell sind `heltec/`, `cm4/`, `meshtastic/` **nebeneinander** auf Root-Ebene, indexiert durch diese Datei.
