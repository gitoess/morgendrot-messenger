# Discord- & Matrix-Integration — Zielbild (Spez)

**Status:** Spezifikation (Umsetzung **§ H.28** in `docs/ROADMAP-FAHRPLAN.md`).  
**Stand:** 2026-05-21  

**Zweck:** Discord und Matrix als **optionale Zustellkanäle** für (A) **Systemalarme** und optional (B) **Kurz-Hinweise an Kontakte** — konfigurierbar über die **App (Runtime)**, analog **§ H.26** Telegram.

**Verwandt:** `docs/TELEGRAM-INTEGRATION-ZIELBILD.md`, **§ H.6e** / **§ H.20** (`.env` vs. Runtime), **§ H.16** (Telefonbuch), `src/monitoring.ts`.

---

## 1. Einordnung

Discord/Matrix sind **kein Ersatz** für IOTA, Mailbox oder LoRa-Forensik. In der UI: *„Discord/Matrix-Hinweis — keine Forensik-Kopie auf der Chain.“*

| | Discord / Matrix | IOTA / Mailbox / LoRa |
|---|------------------|------------------------|
| **Zweck** | Push an Menschen (Team-Kanal, Matrix-Raum) | Nachweis / verschlüsselter Chat / Funk |
| **Inhalt** | Klartext (API) | Verschlüsselt oder Pfad-4-Semantik |
| **Offline-Funk** | Ohne Internet nutzlos | LoRa/Mesh unabhängig |

---

## 2. Konfiguration (Runtime)

| Schicht | Wo | Beispiele |
|---------|-----|-----------|
| **Server / Deploy** | `.env` | `RPC_URL`, `PACKAGE_ID` |
| **Integration (Gerät)** | Runtime UI → persistiert | Discord Webhook/Bot-Token; Matrix Homeserver-URL, Access-Token, Default-Room |

**Secrets nicht** über `POST /api/config` / `setEnvKey` — eigene Endpunkte:

- `POST /api/integrations/discord`
- `POST /api/integrations/matrix`

---

## 3. Zwei Kanäle (pro Plattform)

### Kanal A — Systemalarm (Monitor)

| Plattform | Transport | Payload (Kurz) |
|-----------|-----------|----------------|
| **Discord** | Incoming Webhook **oder** Bot `POST …/channels/{id}/messages` | `{ device, message, ts, level }` |
| **Matrix** | `POST /_matrix/client/v3/rooms/{roomId}/send/m.room.message` | Text + optional `m.notice` |

Auslöser wie Telegram: Monitor (Offline, Sensor, Eskalation).

### Kanal B — Kontakt-Hinweis (optional)

| Plattform | Telefonbuch-Feld | Opt-in |
|-----------|------------------|--------|
| **Discord** | `discordWebhookUrl` oder `discordChannelId` | Composer/Kontakt-Checkbox, Default **aus** |
| **Matrix** | `matrixRoomId` (+ optional `@user:server`) | gleich |

Nach erfolgreichem IOTA/Mailbox-Send — **nicht blockierend** bei Fehler.

---

## 4. Nicht-Ziele

- Kein vollständiger Chat-Spiegel zwischen Morgendrot und Discord/Matrix.
- Kein Bot-Token im JSON pro Nachricht.
- Kein automatischer Parallelversand ohne Opt-in.
- Kein direkter Browser-`fetch` zu Discord/Matrix-APIs.

---

## 5. Umsetzungsreihenfolge (Vorschlag)

1. **Discord Phase A** — Webhook-Alarm (einfacher als Bot-Gateway).
2. **Matrix Phase A** — Room-Message für Alarme.
3. **Telefonbuch-Felder** + Phase B (Kontakt-Hinweis) für beide.
4. **UI** Einstellungen → Integrationen (Test senden, maskierte Secrets).

**Priorität:** Nach **§ H.26** Telegram Phase B; parallel zu **§ H.24** möglich.

---

*Implementierung folgt in `src/integrations/` (analog `telegram-runtime.ts`) — noch nicht begonnen.*
