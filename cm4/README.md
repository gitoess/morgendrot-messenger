# Raspberry Pi Compute Module 4 (CM4) – Host-Rolle

Dieser Ordner beschreibt die **Host-Seite** (Linux, Node, ggf. Next-UI), **nicht** den LoRa-Chip auf dem Heltec.

## Typisches Setup (Messenger / Notfall-Endpunkt)

- **CM4** (oder vergleichbarer Pi) führt aus:
  - **Node-Backend** (`npm run start:secrets` / API auf konfiguriertem Port),
  - optional **Next.js** (`frontend/`, `npm run dev:frontend`),
  - **Wallet/Tresor**-Sitzung für `/api/command`, `/send`, Mesh-Build.
- **Heltec** hängt per **USB** am gleichen Host (oder am USB-Hub des Carriers) und erscheint dem Browser als **Bluetooth-GATT**-Gerät, wenn der Nutzer **Web Bluetooth** nutzt.

## Internet / LTE (nur Basis-Gateway)

Der CM4 hat **keinen eingebauten SIM-Slot**. Für eine **Basis-Station** mit automatischem **LoRa → IOTA (Delayed Upload)** ist ein **LTE/4G HAT** (z. B. SIM7600-Klasse) + **SIM** + **Außenantenne** üblich; **WiFi** ergänzt als Backup. **Vortrupp/Relais** nutzen diese SIM **nicht** – siehe **`hardware/README.md`** (Abschnitt „Internet an der Basis“).

## Strikt getrennt von

| Thema | Ordner |
|--------|--------|
| LoRa-Antenne, Meshtastic-Client-Firmware, Phase-2-Fail-Safe (Heartbeat → Heltec Standalone) | [`../heltec/`](../heltec/README.md), [`../meshtastic/PHASE-2-FIRMWARE-SPEC.md`](../meshtastic/PHASE-2-FIRMWARE-SPEC.md) |
| HTTP↔Serial-Bridge-Software | [`../lora-bridge/`](../lora-bridge/README.md) |

## Deploy-Hinweise

- Headless/Lite-Bundles: **`deploy/README-DEPLOY-BUNDLES.md`**, Root-**`README.md`** (Raspi-Pakete).
- Umgebungsvariablen: **`.env.example`**, API-Port / `NEXT_PUBLIC_API_BASE` für die UI.

## Tests ohne CM4-Hardware

- **Typecheck:** `npx tsc --noEmit` (Root + `frontend/`).
- **Automatisierte Modultests:** `npm run test` (Repo-Root).
- **E2E mit echtem Heltec/BT:** hier nicht automatisierbar; manuell im Browser mit gekoppeltem Stick.
