# Meshtastic / LoRa-Erweiterungen (Morgendrot)

Dieser Ordner ist der **Arbeitsplatz für Firmware- und Protokollarbeit** rund um Meshtastic (Gerätetypisch z. B. **Heltec** – Hardware-Doku: [`../heltec/README.md`](../heltec/README.md), Host: [`../cm4/README.md`](../cm4/README.md), Gesamtindex: [`../hardware/README.md`](../hardware/README.md)). **Modularität, Auto-Relais vs. Messenger, Interop-Grenzen:** [`../docs/MODULAR-KERN-ADAPTER-INTEROP.md`](../docs/MODULAR-KERN-ADAPTER-INTEROP.md).

Die **App-/Node-Pipeline** erzeugt **zwei Klartext-Wires** (Luma + Chroma); sie ersetzt **kein** zuverlässiges Funkprotokoll für große Nutzlasten.

## Messenger-UI (Stand, nachvollziehbar)

| Element | Verhalten |
|---------|-----------|
| **„Für LoRa senden“** | Nur **Funk** (Mesh-Burst pro Wire), wenn Heltec per Web Bluetooth verbunden. |
| **Kein stiller Online-Fallback** | Schlägt Funk fehl oder kein Heltec → **nichts** gesendet; gelber Kasten mit **„Trotzdem über Online (IOTA) senden“** (explizite Bestätigung) oder **Abbrechen**. |
| **Empfänger** | `MORG_LUMA_V1` sofort S/W + Hinweis/Timeout; `MORG_CHROMA_V1` → Fusion (`/api/lora-progressive-fuse` oder Canvas-Fallback). Siehe `frontend/…/chat-message-body.tsx`. |
| **Manuelle UI-Tests** | `scripts/print-lora-wires-for-ui-test.ts`, Versand zweier Nachrichten über **Online-Pfad** (siehe unten). |

**Code:** `frontend/frontend/components/views/chat-view.tsx`, `src/lora-progressive-image.ts`, `src/api-server.ts` (`/api/lora-progressive-encode`, `/api/lora-progressive-fuse`).

## Phase 1 vs. End-to-end über Heltec (wichtig)

Im Backend ist **Mesh Emergency Binary v2** auf **`MESH_V2_MAX_BYTES = 240`** begrenzt (`src/messenger-nest/messenger-chain-wrap.ts` + `buildEmergencyBinaryV2`). Ein vollständiger `MORG_LUMA_V1`- oder `MORG_CHROMA_V1`-Wire (mehrere KB Klartext + Verschlüsselung) **passt nicht** in ein einzelnes v2-Paket.

**Folge:** Sender- und Empfänger-Logik (Messenger-UI, `/api/lora-progressive-encode`, Fusion `/api/lora-progressive-fuse`) sind **testbar**. Der Funkpfad splittet lange Klartexte (z. B. Luma/Chroma-Wires) seit **MF1** automatisch in mehrere Mesh-v2-Pakete (`[[MF1:mid=…:i=…:t=…:]]` + Nutzlast ≤175 B UTF-8 vor Verschlüsselung); der Browser setzt sie nach Decrypt wieder zusammen (`src/mesh-v2-fragment.ts`, `frontend/…/mesh-v2-fragment.ts`). **Zuverlässigkeit** (Selective NACK, Mesh-Priorität, Duty-Cycle auf dem Radio) bleibt Phase 2 / Firmware.

**Phase-2 / Firmware-Erweiterungen (Referenz, Meshtastic-First):** [`PHASE-2-FIRMWARE-SPEC.md`](./PHASE-2-FIRMWARE-SPEC.md) – zuerst **`docs/MESHTASTIC-BUILDING-BLOCKS.md`** lesen: Standard-Meshtastic nutzen; diese Spec nur für **optionale** Tiefe (433 Cave, Smart Buffer als Plan B, Priorität SOS > Bild, RS485, CM4-Fail-Safe, Energie).

**LoRa → IOTA (Delayed Upload, Custody-Kette, UI-Status):** [`../docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`](../docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md) – ergänzt Messenger/Node; Hop-Signaturen an **240-B-Limit** und Phase 2 gekoppelt.

## Was die Standard-Meshtastic-Firmware typischerweise nicht bietet

- **Selective NACK** nur für fehlende Teilstücke einer großen Nutzlast
- **Priorisierte Weiterleitung** „LUMA vor CHROMA“ auf allen Knoten
- **Einheitliches Chunking** mit gemeinsamer `msgId` + Sequenz über viele Hops inkl. Zustand „Bild unvollständig“
- **Adaptive SF/TX-Power pro Nachrichtentyp** (LUMA vs. CHROMA)
- **EU-Duty-Cycle-Buchführung** pro Gerät (Rolling-Window) gekoppelt an Batches

Ohne eine solche Schicht bleiben große Payloads anfällig für **Paketverlust** und **Airtime** – progressive Luma/Chroma im Klartext hilft inhaltlich (S/W zuerst), löst aber nicht automatisch die **physikalischen und rechtlichen Grenzen** von LoRa.

## Empfohlene Richtung (pragmatisch)

**Option A – Meshtastic-Firmware erweitern:** Routing/Mesh beibehalten, eigenes Modul (z. B. binäres Chunk-Protokoll mit Header, Priorität LUMA, NACK-Bitmap, begrenzte `msgId`-State-Maschine auf dem Gerät).

**Option B – Eigenes LoRa ohne Meshtastic:** volle Kontrolle, aber eigenes Routing/Retry.

## Bezug zum Morgendrot-Wire (App-Layer)

Bis Chunking existiert, ist ein Wire pro Phase definiert als:

```text
[[MORG_LUMA_V1:msgId=<8 hex>|len=<n>|<base64>]]
[[MORG_CHROMA_V1:msgId=<8 hex>|len=<n>|<base64>]]
```

`len` = Anzahl **Base64-Zeichen**. Firmware kann denselben JPEG-Bytestrom in **200-Byte-Nutzlast-Chunks** zerschneiden und die obige Zeichenkette erst **nach Reassembly** an die App liefern – oder ein **binäres** Parallelprotokoll definieren und nur das JPEG rekonstruieren.

## Nächste Schritte (wenn du flashen willst)

1. Offizielles **Meshtastic-Device-Repo** (passend zur Heltec-Variante) klonen und Build-Umgebung (PlatformIO/Arduino) einrichten.
2. Protokoll-Spec festhalten (Chunk-Header, NACK, Timeouts, max. Chunks pro Teilbild).
3. Prototyp: **nur LUMA-Chunks**, feste Chunk-Größe, einfache Sequenz + Gesamtanzahl, Reassembly + CRC auf einem Peer.
4. Danach CHROMA mit niedrigerer Queue-Priorität und Duty-Cycle-Limiter.

Keine fertige Firmware liegt in diesem Ordner; hier dokumentierst und versionierst du **eigene Patches, Specs und Build-Notizen**.
