# Heltec (LoRa / Meshtastic-Client)

Dieser Ordner dokumentiert die **Heltec-Hardware-Rolle** im Morgendrot-Kontext. **Firmware-Quellcode** liegt hier nicht – der Arbeitsplatz für Meshtastic-Patches ist [`../meshtastic/README.md`](../meshtastic/README.md).

## Rolle

- **LoRa-Transceiver**: **Standard ~868 MHz (EU)** oder **433 MHz „Cave Rescue Edition“** (eigene Board-/Antennen-Variante, siehe [`../meshtastic/PHASE-2-FIRMWARE-SPEC.md`](../meshtastic/PHASE-2-FIRMWARE-SPEC.md)); Firmware mit **band-spezifischem Profil**. Software-seitig: **eine** Messenger-Basis, **kein** zweiter Gerätetyp – nur **Ausbaustufe** (z. B. Relais ohne Host).
- Im **Messenger-Dashboard** (Next.js, Chrome/Edge): Anbindung per **Web Bluetooth** an den Heltec-Stick (`frontend/frontend/hooks/use-meshtastic-ble.ts`).
- Sendet/empfängt **PRIVATE_APP**-Binärpakete im Morgendrot-**Emergency Binary v2**-Format (sehr kleines Gesamtpaket → aktuell **240 B** Rohwire, siehe `src/messenger-nest/messenger-chain-wrap.ts`).

## Grenzen (Stand ohne Phase 2)

- **Kein** Transport vollständiger `MORG_LUMA_V1` / `MORG_CHROMA_V1`-Wires über Mesh-v2 (Wire viel größer als 240 B).
- UI: **„Für LoRa senden“** versucht **nur Funk**; **Online (IOTA)** nur nach **explizitem** zweiten Button (kein stiller Wechsel).

## Verbindung zum Host

- Physikalisch: **USB** zum Rechner / **CM4-Träger** (siehe [`../cm4/README.md`](../cm4/README.md)).
- Optional: **serielle Bridge** statt Browser BT → [`../lora-bridge/README.md`](../lora-bridge/README.md).

## Praxis

- Antenne: richtige Polarisation/Länge, in Höhlen oft schlechte Ausbreitung → siehe Rettungs-Konzepte in `docs/` (allgemein), nicht in diesem Ordner wiederholen.
- Strom/Akku: je nach Einsatzdauer; **kein** wasserdichtes „aktives Relais im Siphon“ hier spezifiziert – nur Geräte-Rolle **Funk-Knoten / BT-Peripherie**.

## Nächste Ausbaustufe

- **Phase 2:** Chunking + Selective NACK, Relais-Smart-Buffer, Prioritäten, optional **Kabel-Hybrid / Siphon-Brücke** (RS485 oder differentieller Bus, Lackdraht-Szenario, LoRa↔Draht↔LoRa) + Standalone – [`../meshtastic/PHASE-2-FIRMWARE-SPEC.md`](../meshtastic/PHASE-2-FIRMWARE-SPEC.md) (**§7**).
