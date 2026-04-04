# Meshtastic als Baukasten – Nutzung vs. eigene Erweiterungen

**Kontext:** Morgendrot ist ein **Notfall-/Krisen-Messenger**, **kein** Alltags-Chat. **IOTA Rebased** = primärer Pfad bei Verfügbarkeit; **LoRa/Meshtastic** = starker **Offline-Fallback**.  
**Leitlinie:** So **nah am Standard-Meshtastic** bleiben wie möglich; **eigenes Protokoll / großer Fork** nur, wenn es **fachlich nicht anders** geht.

Verknüpft: **`meshtastic/PHASE-2-FIRMWARE-SPEC.md`** (optionale Tiefe), **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**.

---

## 1. Gut nutzbar aus Meshtastic (1:1 oder fast nur Konfiguration)

| Bereich | Nutzen |
|---------|--------|
| **Mesh-Routing** | Standard; keine eigene Routing-Schicht planen. |
| **Text / kleine Nutzlasten** | Wie heute über PRIVATE_APP / bestehende Pfade. |
| **Store-and-Forward** | Meshtastic puffert und leitet weiter – **Default** statt eigenem „Smart Buffer“ auf dem Relais. |
| **MQTT-Gateway** | Knoten mit Internet kann Payloads an einen **MQTT-Broker** geben → Anbindung an **Morgendrot-Node/Skript** für **Delayed IOTA** (siehe LORA-Spec). |
| **Position / einfache Status** | Über bestehende Meshtastic-Features, soweit für den Einsatz reicht. |
| **Konfiguration** | Offizieller Client, Web-Client, ggf. **Module**-API von Meshtastic für **kleine** Erweiterungen. |

---

## 2. Überschaubarer Zusatzaufwand (App/Node, kleine Anpassungen)

| Bereich | Typischer Aufwand |
|---------|-------------------|
| **MORG\_*-Wires** (Bilder, Status, Marker) | **App- und Node-Layer** (bereits angelegt); kein Ersatz für Meshtastic-Transport. |
| **Mehrere Mesh-v2-Pakete pro Inhalt** | **Server/Client** splittet große Inhalte in **240-B-konforme** Bursts – **bevorzugt** gegenüber neuem Funkprotokoll. |
| **Airtime-Rohdaten** | Meshtastic/Firmware loggt/telemeterisch – **Auslesen** und in UI **darstellen** (Schätzung + Hinweis „approx.“). |
| **Delayed Upload MVP** | **MQTT oder serieller Gateway** + **kleines Skript / API** im Morgendrot-Node (Queue, Manifest, IOTA) – siehe LORA-Spec. |

---

## 3. Eigene Entwicklung schwer vermeidbar (wenn Anforderungen bestehen bleiben)

| Thema | Warum nicht Standard |
|-------|----------------------|
| **Custody-Kette (wer hat wann weitergeleitet)** | Meshtastic bietet das **nicht** als E2E-Nachweis; **MVP:** Gateway-Signatur + Metadaten (**LORA-Spec**); **volle Hop-Signatur:** nur bei Nachweis nötig → **kleines Firmware-Modul** / Phase-2-Referenz. |
| **Strikte Priorität SOS > Bild > Text** | Meshtastic behandelt Traffic **nicht** nach Morgendrot-Klassen → **Queue-Policy** in **App** und ggf. **minimalem** Firmware-Hook / Modul. |
| **Airtime-Warnung „~80 % ausgelastet“** | Rohdaten ja, **verständliche Schätz-UI** nein → **Messenger-UI** + ggf. Telemetrie-Parsing. |
| **LoRa → IOTA mit Hash/Ciphertext-Wahl + Manifest** | **Morgendrot-spezifisch** → **Gateway-Logik** (Node), nicht Meshtastic-Kern. |

---

## 4. Grobe Aufwands-Einschätzung (Orientierung, keine Messung)

| Anteil | Inhalt |
|--------|--------|
| **~70 %** | Meshtastic-Standard, Konfiguration, MQTT/Bridge, App-seitige Aufteilung, Node-Queue MVP – **wenn** diszipliniert beim Baukasten bleibt. |
| **~30 %** | Gezielte Erweiterungen: Custody (über MVP hinaus), Priorisierung, UI-Airtime, ggf. **optionale** Firmware-Patches aus **PHASE-2-FIRMWARE-SPEC**. |

**Korrektur zur Naivität:** „MQTT macht IOTA“ **automatisch** – **nein**; MQTT liefert nur **Transport zum Broker**, die **IOTA-Transaktion** bleibt **Morgendrot-Code**.

---

## 5. Ein Gerät, mehrere Ausbaustufen

- **Keine** getrennten „Gerätetypen“ in der Software: **dieselbe** Basis (Heltec + Meshtastic + Morgendrot-Anbindung).
- **Abgespeckt** = z. B. Relais **ohne** Host/Display; **voll** = mit CM4/Browser – **Rollenunterschied**, nicht andere Produktlinie.

---

*Dieses Dokument präzisiert die Nutzer-Vorgabe **Meshtastic-First** und setzt **PHASE-2-FIRMWARE-SPEC** als **optionale** Tiefe, nicht als Default-Pflicht.*
