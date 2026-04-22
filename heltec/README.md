# Heltec (LoRa / Meshtastic-Client)

Dieser Ordner dokumentiert die **Heltec-Hardware-Rolle** im Morgendrot-Kontext. **Firmware-Quellcode** liegt hier nicht – der Arbeitsplatz für Meshtastic-Patches ist [`../meshtastic/README.md`](../meshtastic/README.md).

## Rolle

- **LoRa-Transceiver**: **Standard ~868 MHz (EU)** oder **433 MHz „Cave Rescue Edition“** (eigene Board-/Antennen-Variante, siehe [`../meshtastic/PHASE-2-FIRMWARE-SPEC.md`](../meshtastic/PHASE-2-FIRMWARE-SPEC.md)); Firmware mit **band-spezifischem Profil**. Software-seitig: **eine** Messenger-Basis, **kein** zweiter Gerätetyp – nur **Ausbaustufe** (z. B. Relais ohne Host).
- Im **Messenger-Dashboard** (Next.js, Chrome/Edge): Anbindung per **Web Bluetooth** an den Heltec-Stick (`frontend/frontend/hooks/use-meshtastic-ble.ts`).
- Sendet/empfängt **PRIVATE_APP**-Binärpakete im Morgendrot-**Emergency Binary v2**-Format (sehr kleines Gesamtpaket → aktuell **240 B** Rohwire, siehe `src/messenger-nest/messenger-chain-wrap.ts`).

## Notfall / Erreichbarkeit (operativ)

Wer im Ernstfall **Gegenstelle** ist (Team, Gateway vs. offizielle Rettung) und welche Produktentscheidungen zum **Meshtastic-/LoRa-Notruf** gelten — **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**.

## Grenzen (Stand ohne Phase 2)

- **Kein** Transport vollständiger `MORG_LUMA_V1` / `MORG_CHROMA_V1`-Wires über Mesh-v2 (Wire viel größer als 240 B).
- UI: **„Für LoRa senden“** versucht **nur Funk**; **Online (IOTA)** nur nach **explizitem** zweiten Button (kein stiller Wechsel).

## Verbindung zum Host

- Physikalisch: **USB** zum Rechner / **CM4-Träger** (siehe [`../cm4/README.md`](../cm4/README.md)).
- Optional: **serielle Bridge** statt Browser BT → [`../lora-bridge/README.md`](../lora-bridge/README.md). **Kritische Einordnung USB vs. BLE (Durchsatz, Web Serial, NACK):** [`../docs/HELTEC-USB-SERIAL-VS-BLE-TRANSPORT.md`](../docs/HELTEC-USB-SERIAL-VS-BLE-TRANSPORT.md).

## Praxis

- Antenne: richtige Polarisation/Länge, in Höhlen oft schlechte Ausbreitung — **[EU-Funk & Einsatzprofile](../docs/LORA-EU-FUNK-HARDWARE-EINSATZPROFILE.md)**; weitere Konzepte in `docs/` allgemein.
- Strom/Akku: je nach Einsatzdauer; **kein** wasserdichtes „aktives Relais im Siphon“ hier spezifiziert – nur Geräte-Rolle **Funk-Knoten / BT-Peripherie**.

## Betrieb / wenn der Browser „nichts“ empfängt

- **Symptom:** anderes Gerät oder das Heltec-Display zeigt Traffic, **Morgendrot** bleibt leer / **RX:** im Messenger-Setup bewegt sich nicht.  
  **Erster Schritt:** Heltec **USB kurz trennen und wieder anstecken** (oder in der App **Trennen** → neu koppeln). Hängende **Web-Bluetooth-/GATT**-Zustände kommen vor und sind **nicht** immer ein reiner Software-Bug in der PWA.
- **Diagnose in der PWA:** Im Panel **Heltec / Meshtastic** nach **„Events:“** schauen (z. B. `onMessagePacket`, `onMeshPacket` müssen gebunden sein). Für **F12-Konsole:** `localStorage.setItem("morgendrot.meshRxDebug","1")`, Seite neu laden → Zeilen **`[morgendrot mesh]`** bei eingehenden Paketen. Details im Changelog und in **`docs/LORA-PC-FIRST-SMOKE.md`**.

## Nächste Ausbaustufe

- **Phase 2:** Chunking + Selective NACK, Relais-Smart-Buffer, Prioritäten, optional **Kabel-Hybrid / Siphon-Brücke** (RS485 oder differentieller Bus, Lackdraht-Szenario, LoRa↔Draht↔LoRa) + Standalone – [`../meshtastic/PHASE-2-FIRMWARE-SPEC.md`](../meshtastic/PHASE-2-FIRMWARE-SPEC.md) (**§7**).
- **Auto-Relais vs. Messenger (Zielbild):** Erkennung nur **sinnvoll mit Override** (USB kann Laptop sein); siehe **[`docs/MODULAR-KERN-ADAPTER-INTEROP.md`](../docs/MODULAR-KERN-ADAPTER-INTEROP.md)** § 2.
