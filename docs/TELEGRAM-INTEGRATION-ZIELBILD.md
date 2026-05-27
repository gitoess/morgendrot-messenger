# Telegram-Integration — Zielbild (Spez)

**Status:** Spezifikation + **Ist-Code** (**§ H.26** in **`docs/ROADMAP-FAHRPLAN.md`**).  
**Stand:** **2026-05-20** (Phase **B2 Long Polling** dokumentiert; Phase A + B2 **teilweise umgesetzt**).

**Zweck:** Telegram als **Zustellkanal** für (A) **Systemalarme**, (B2) **Eingang von Partnern per Long Polling** und (B3, geplant) **Kurz-Hinweise nach Send** — konfigurierbar über **Runtime**, ohne `TG_*` in `.env` auf dem Feldgerät.

**Strategie-Kontext:** Telegram ist **optionaler Zustellkanal** (**§ H.0-SIMPLE**). **IOTA** bleibt Archiv/Forensik (**`docs/TRANSPORT-AND-IOTA-LAYERS.md`**); Telegram ersetzt weder LoRa noch Tangle.

**Verwandt:** `scripts/telegram-webhook.ts`, `src/integrations/telegram-integration.ts`, `src/integrations/telegram-inbound-poll.ts`, **§ H.6e** / **§ H.20**, **§ H.16** (Telefonbuch).

---

## 1. Einordnung

### 1.1 Was Telegram ist — und was nicht

| | Telegram | LoRa / Mesh | IOTA (optionaler Notar) |
|---|----------|-------------|-------------------------|
| **Zweck** | Push + optionaler Rückkanal (Internet) | Einsatz-Chat ohne Internet | Verankerung / Forensik |
| **Inhalt** | Klartext (Bot-API) | Funk-Payloads | Chain/Mailbox |
| **Offline-Funk** | Meist nutzlos ohne Internet | **Primär** im Einsatz-Default | Nur wenn Boss aktiviert |
| **Simple Mode** | **Ausgeblendet** (Default Helfer) | **Sichtbar** | **Ausgeblendet** (`mesh-first`) |

**UI-Pflicht:** *„Telegram-Hinweis — keine Forensik-Kopie auf der Chain.“*

### 1.2 `.env` vs. Runtime

| Schicht | Konfiguration | Beispiele |
|---------|---------------|-----------|
| **Server / Deploy** | `.env`, Secret-Manager | `RPC_URL`, `PACKAGE_ID`, `MONITOR_DEVICES` |
| **Admin (Runtime)** | UI → `.morgendrot-runtime-config.json` | Bot-Token, Admin-Chat-ID, `inboundMode` |

**Ziel:** Endnutzer editieren **kein** `TG_*` in `.env`. Telegram-Secrets **nicht** über `setEnvKey` — eigener Endpunkt **`POST /api/integrations/telegram`**.

---

## 2. Kanäle und Phasen

| Phase | Kanal | Richtung | Status |
|-------|-------|----------|--------|
| **A** | Systemalarm (Monitor) | Server → Admin-Chat | **Ist** (Relay + Webhook-URL) |
| **B1** | Telefonbuch `telegramChatId` | Metadaten | **Teil-Ist** |
| **B2** | **Long Polling Eingang** | Partner → Morgendrot | **Ist** |
| **B3** | Notify nach Forensik-Send | Morgendrot → Partner | **Geplant** |

---

## 3. Kanal A — Systemalarm (Monitor)

| Aspekt | Wert |
|--------|------|
| **Auslöser** | `src/monitoring.ts` → `triggerAlarm()` |
| **Empfänger** | `adminChatId` in Runtime-Integration |
| **Transport** | `POST` Relay **`/morgendrot-telegram/alarm`** |
| **Ist** | `MONITOR_ALARM_WEBHOOK_URL` → Relay |

**JSON (Monitor → Relay):**

```json
{
  "device": "TEST-DEVICE",
  "message": "Testalarm von Morgendrot",
  "ts": 1741600861000,
  "level": 1
}
```

---

## 4. Phase B2 — Long Polling Eingang (Kern dieser Spez)

### 4.1 Problem

**Webhook** braucht öffentliche HTTPS-URL (Tunnel, VPS, Reverse-Proxy) — unpassend für **Boss-PC im Feld**, **Simple Mode** und **Mesh-First** (Internet optional).

**Lösung:** Der Morgendrot-Node **pollt** `api.telegram.org` per **`getUpdates`** (Long Polling). **Keine** eingehende Firewall-Regel nötig.

### 4.2 Modi (`inboundMode`)

| Wert | Verhalten |
|------|-----------|
| `off` | Kein Eingang (nur Kanal A ausgehend) |
| **`longPoll`** | **Default für Feld** — Hintergrund-Loop in Node |
| `webhook` | `POST /api/integrations/telegram/webhook` (nur mit erreichbarer URL) |

Runtime-Feld: `integrations.telegram.inboundMode` in **`.morgendrot-runtime-config.json`**.

### 4.3 Ablauf (Ist-Code)

**Dateien:** `src/integrations/telegram-inbound-poll.ts`, `src/integrations/telegram-inbound.ts`, `src/integrations/telegram-journal.ts`.

```text
[Node-Start / Save Integration]
        │
        ▼
restartTelegramInbound()
        │
        ├─ inboundMode !== longPoll → Poll aus
        │
        └─ longPoll + botToken gesetzt
                │
                ▼
        deleteWebhook (drop_pending=false)
                │
                ▼
        Schleife:
          getUpdates(offset, timeout=25s, allowed_updates=[message])
                │
                ▼
        ingestTelegramInboundUpdate(update)
                │
                ├─ Chat-ID in Telefonbuch-Allowlist? → Journal + Posteingang
                └─ sonst → verwerfen (Log)
                │
                ▼
        lastUpdateId persistieren (Runtime-Config)
```

**Parameter (Ist):**

| Parameter | Wert |
|-----------|------|
| `GET_UPDATES_TIMEOUT_SEC` | 25 |
| `ERROR_BACKOFF_MS` | 5000 |
| `allowed_updates` | `["message"]` |
| Offset-Speicher | `integrations.telegram.lastUpdateId` |

### 4.4 Allowlist (Sicherheit)

Eingehende Nachrichten werden **nur** verarbeitet, wenn `chat.id` in **`getPhonebookTelegramChatIds()`**:

- Feld **`telegramChatId`** am Kontakt (`contact-labels.ts`)
- Kontakt-Schlüssel **`tg:<chatId>`**

Unbekannte Chat-IDs: **kein** Journal, **kein** Posteingang — nur optional Debug-Log.

### 4.5 Webhook vs. Long Poll

Beim Wechsel auf **`longPoll`** ruft der Node **`deleteWebhook`** auf (einmal pro Token), damit Telegram nicht parallel Webhook + Poll bedient.

Bei **`webhook`:** Long-Poll-Loop **stoppt** (`stopTelegramInboundPoll`).

### 4.6 UI / API

| Endpunkt | Zweck |
|----------|--------|
| `GET /api/integrations/telegram` | `inboundMode`, `inboundPollActive` (öffentlich) |
| `POST /api/integrations/telegram` | `inboundMode` setzen → `restartTelegramInbound()` |
| `POST /api/integrations/telegram/webhook` | Nur Modus `webhook` — Body = Telegram-Update |
| `GET /api/integrations/telegram/journal` | Journal-Einträge (Admin) |

**Einstellungen → Telegram:** Modus **Long Polling (empfohlen, kein Tunnel)** vs. Webhook.

### 4.7 Posteingang

Erlaubte eingehende Telegram-Texte erscheinen als **Merge-Zeilen** im Posteingang (Journal → UI). **Kein** Ersatz für Mesh- oder Mailbox-Zeilen — **zusätzlicher** Kanal für Partner mit Internet.

### 4.8 Abnahme Phase B2

- [ ] Integration: Token + `inboundMode=longPoll` → Status `inboundPollActive: true`
- [ ] Partner-Chat-ID im Telefonbuch → Text an Bot → Journal + Posteingang
- [ ] Unbekannte Chat-ID → keine Zeile
- [ ] Node-Neustart → Offset fortgesetzt, keine Doppel-Zeilen
- [ ] Wechsel `longPoll` → `webhook` → Poll stoppt
- [ ] **Simple Mode (Helfer):** Telegram-Einstellungen **nicht** sichtbar (**§ H.0-SIMPLE**)

### 4.9 Grenzen (ehrlich)

| Thema | Grenze |
|-------|--------|
| **Latenz** | Bis ~25 s + Netz (Long-Poll-Timeout) |
| **Batterie (Handy als Server)** | Poll läuft auf **Node/PC**, nicht PWA im Browser |
| **E2EE** | Telegram sieht **Klartext** — keine Signal-Behauptung |
| **Offline-Funk** | LoRa unverändert; Telegram parallel nur mit Internet |
| **Gruppen-Chats** | Nur explizit erlaubte Chat-IDs — kein Gruppen-Broadcast |

---

## 5. Phase B3 — Notify nach Send (geplant)

| Aspekt | Wert |
|--------|------|
| **Auslöser** | Erfolgreicher Forensik-Send **und** Nutzer-Opt-in |
| **Empfänger** | `telegramChatId` aus Telefonbuch |
| **Transport** | Relay **`/morgendrot-telegram/notify`** |
| **Fehler** | **Nicht blockierend** für IOTA/Mesh-Send |

**JSON (Backend → Relay):**

```json
{
  "target_chat_id": "987654321",
  "message_preview": "Neue Morgendrot-Nachricht …",
  "sender_label": "Partner B"
}
```

Composer-Checkbox **„Telegram-Hinweis“** — Default **aus**.

---

## 6. Architektur (Gesamt)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Next-UI — Integrationen → Telegram (Expert / Boss)            │
│  Telefonbuch: telegramChatId (B1)                               │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Morgendrot API (api-server)                                     │
│  /api/integrations/telegram  — save, test, inboundMode          │
│  /api/integrations/telegram/webhook  — optional (Modus webhook) │
└────────────┬───────────────────────────────┬────────────────────┘
             │                               │
             ▼                               ▼
┌────────────────────────┐    ┌──────────────────────────────────┐
│ .morgendrot-runtime-   │    │ telegram-inbound-poll.ts (B2)     │
│ config.json            │    │  loop: getUpdates → ingest        │
└────────────────────────┘    └──────────────┬───────────────────┘
                                             │
┌────────────────────────┐                 │
│ Relay :8787            │◄── Monitor ─────┤
│  /alarm  (A)           │                 │
│  /notify (B3)          │                 ▼
└───────────┬────────────┘       api.telegram.org
            └──────────────────► sendMessage / getUpdates
```

**Regeln:**

1. Browser **nur** Morgendrot-API — **nie** direkt Relay oder `api.telegram.org`.
2. **Bot-Token** nie in API-Response (nur maskiert).
3. **Kein** `bot_token` im Notify-Body.

---

## 7. Runtime-Konfiguration (Schema)

```json
{
  "integrations": {
    "telegram": {
      "enabled": true,
      "botToken": "<secret>",
      "adminChatId": "1156058618",
      "relayBaseUrl": "http://127.0.0.1:8787",
      "relaySecret": "<optional>",
      "inboundMode": "longPoll",
      "lastUpdateId": 123456789
    }
  }
}
```

| Feld | Phase | Beschreibung |
|------|-------|--------------|
| `enabled` | A | Master-Schalter |
| `botToken` | A | @BotFather |
| `adminChatId` | A | Alarme + Test |
| `inboundMode` | **B2** | `off` \| `longPoll` \| `webhook` |
| `lastUpdateId` | **B2** | Persistierter Poll-Offset (serverseitig) |

---

## 8. Onboarding

### 8.1 Admin

1. Bot bei **@BotFather** → Token in **Integrationen**.
2. **`inboundMode`:** **Long Polling** (Feld ohne Tunnel).
3. Eigene Chat-ID → **Test an mich**.
4. Relay starten (`npm run telegram-webhook` o. Ä.) für Kanal A.

### 8.2 Partner (Eingang B2)

1. Partner: Bot **Start**.
2. Chat-ID an Admin (z. B. @userinfobot).
3. Admin: ID im **Telefonbuch** (`telegramChatId` oder Kontakt `tg:…`).
4. Partner schreibt Bot → Zeile im Posteingang (wenn Poll läuft).

---

## 9. Sicherheit

| Risiko | Maßnahme |
|--------|----------|
| Token in Browser | Nur serverseitig in Runtime-Datei |
| Offenes Relay | localhost + optional `relaySecret` |
| Spam an Bot | **Allowlist** nur Telefonbuch-Chat-IDs |
| Telegram ≠ Forensik | UI-Warnung; **§ H.0-SIMPLE** — kein Pflichtkanal |

---

## 10. Explizit nicht in Scope

- Vollständiger Chat-Mirror (alle Sends automatisch)
- Telegram als **einziger** Kanal ohne LoRa
- Pinnwand → Telegram (**`docs/BROADCAST-PINNWAND.md`** — separates Backlog)
- Bot-Kommandos / Inline-Menüs in Morgendrot
- **Pflicht** in Simple Mode / Einsatz-Default

---

## 11. Migrationspfad

| Ist (2026-05) | Ziel |
|---------------|------|
| `TG_*` in `.env` | Legacy-Fallback Deploy |
| Nur `/alarm` | + Long Poll **B2** + `/notify` **B3** |
| Webhook-only-Doku | **Long Poll** als Feld-Default in Spez |

---

## 12. Verweise

- Fahrplan: **§ H.26** in **`docs/ROADMAP-FAHRPLAN.md`**
- Strategie: **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**, **§ H.0-SIMPLE**
- Code Poll: **`src/integrations/telegram-inbound-poll.ts`**
- Code Ingest: **`src/integrations/telegram-inbound.ts`**
- Monitor: **`src/monitoring.ts`**
- Relay-Ist: **`scripts/telegram-webhook.ts`**
