# Telegram-Integration — Zielbild (Spez)

**Status:** Spezifikation (Umsetzung **§ H.26** in `docs/ROADMAP-FAHRPLAN.md`).  
**Stand:** 2026-05-15  

**Zweck:** Telegram als **Zustellkanal** für (A) **Systemalarme** und optional (B) **Kurz-Hinweise an Kontakte** — konfigurierbar über die **App (Runtime)**, ohne dass Endnutzer `TG_*` in `.env` editieren müssen.

**Verwandt:** `scripts/telegram-webhook.ts` (Ist), `src/monitoring.ts` (Alarm-Webhook), **§ H.6e** / **§ H.20** (`.env` vs. Runtime), **§ H.16** (Telefonbuch).

---

## 1. Einordnung

### 1.1 Was Telegram bei Morgendrot ist — und was nicht

| | Telegram | IOTA / Mailbox / LoRa |
|---|----------|------------------------|
| **Zweck** | Push-Benachrichtigung an Menschen | Forensik / Nachweis / Funk |
| **Inhalt** | Klartext (Bot-API) | Verschlüsselt oder Pfad-4-Klartext mit eigener Semantik |
| **Empfänger** | Telegram-Chat-ID | Wallet-Adresse (`0x…`) |
| **Offline-Funk** | Meist **ohne** Internet nutzlos | LoRa/Mesh kann ohne Telegram laufen |

**Telegram ist kein Ersatz** für Chain-Speicherung. In der UI muss das klar sein: *„Telegram-Hinweis — keine Forensik-Kopie auf der Chain.“*

### 1.2 `.env` vs. Runtime (Roadmap-konform)

| Schicht | Konfiguration | Beispiele |
|---------|---------------|-----------|
| **Server / Deploy** | `.env`, Secret-Manager | `RPC_URL`, `PACKAGE_ID`, `MONITOR_DEVICES` |
| **Nutzer / Admin (Gerät)** | **Runtime** (UI → persistiert) | Bot-Token, eigene Chat-ID, Relay-URL |

**`.env` wird nicht global abgeschaffen** (**§ H.6e**, **§ H.20**). Für Telegram gilt: **`TG_BOT_TOKEN` / `TG_CHAT_ID` in `.env`** sind **Legacy-Fallback** für Deploy/Skripte; **Ziel** = Einstellungen in der App.

**Sicherheit:** `MONITOR_ALARM_WEBHOOK_URL` steht auf der **SETENV-Blocklist** — Telegram-Secrets dürfen **nicht** über `POST /api/config` / `setEnvKey` gesetzt werden. Eigener Endpunkt: **`POST /api/integrations/telegram`**.

---

## 2. Zwei Kanäle

### Kanal A — Systemalarm (Monitor)

| Aspekt | Wert |
|--------|------|
| **Auslöser** | `src/monitoring.ts` → `triggerAlarm()` (Offline, Sensor-Grenzen, Eskalation L2/L3) |
| **Empfänger** | **Admin-eigene** Chat-ID (`adminTelegramChatId` in Integrationen) |
| **Transport** | `POST` an Relay **`/morgendrot-telegram/alarm`** (oder Legacy-Pfad, siehe Migration) |
| **Ist** | `MONITOR_ALARM_WEBHOOK_URL` → `scripts/telegram-webhook.ts` |

**JSON (Monitor → Relay):**

```json
{
  "device": "TEST-DEVICE",
  "message": "Testalarm von Morgendrot",
  "ts": 1741600861000,
  "level": 1
}
```

**Telegram-Text (Relay formatiert, wie Ist):**

```text
⚠️ Morgendrot Alarm L1
Gerät: TEST-DEVICE
Zeit: 10.3.2026, 11:21:01
Meldung: Testalarm von Morgendrot
```

(`level` 2/3 → `L2` / `L3`; `ts` optional, sonst Server-Zeit `de-DE`.)

### Kanal B — Kontakt-Hinweis (optional, Phase B)

| Aspekt | Wert |
|--------|------|
| **Auslöser** | Erfolgreicher **Forensik-Send** (IOTA/Mailbox/Mesh online) **und** Nutzer-Opt-in |
| **Empfänger** | `telegramChatId` aus **Telefonbuch**-Eintrag (**§ H.16**) |
| **Transport** | Backend → Relay **`/morgendrot-telegram/notify`** |
| **Inhalt** | Kurz-Vorschau (z. B. erste 200 Zeichen), **kein** Medien-Blob |

**JSON (Backend → Relay, kein Token im Body):**

```json
{
  "target_chat_id": "987654321",
  "message_preview": "Neue Morgendrot-Nachricht von 0xabc…",
  "sender_label": "Partner B"
}
```

**Telegram-Text (Vorschlag):**

```text
📩 Morgendrot
Von: Partner B
Neue Morgendrot-Nachricht von 0xabc…
```

**Fehler bei Telegram:** **nicht blockierend** — Forensik-Send gilt als erfolgreich, UI zeigt Hinweis „Telegram nicht zugestellt“.

---

## 3. Architektur

```text
┌─────────────────────────────────────────────────────────────────┐
│  Next-UI (Einstellungen → Integrationen → Telegram)               │
│  Telefonbuch (telegramChatId pro Kontakt, Phase B)                │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS (Session / entsperrt)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Morgendrot API (api-server)                                     │
│  POST /api/integrations/telegram  — speichern, testen           │
│  (optional) POST …/telegram/test-alarm | …/test-notify         │
└────────────┬───────────────────────────────┬────────────────────┘
             │                               │
             │ schreibt                      │ bei Alarm / Notify
             ▼                               ▼
┌────────────────────────┐    ┌──────────────────────────────────┐
│ .morgendrot-runtime-   │    │ Telegram-Relay (localhost)        │
│ config.json            │    │  POST /morgendrot-telegram/alarm  │
│  integrations: {       │    │  POST /morgendrot-telegram/notify │
│    telegram: { … }     │    │  Token nur aus geladener Config   │
│  }                     │    └──────────────┬───────────────────┘
└────────────────────────┘                   │
                                               │ HTTPS
                                               ▼
                                    api.telegram.org/bot…/sendMessage
```

**Regeln:**

1. **Browser** spricht **nur** die Morgendrot-API an — **nie** direkt `127.0.0.1:8787` (CORS, Token-Leak).
2. **Relay** akzeptiert nur **localhost** (+ optional Header `X-Morgendrot-Relay-Secret`).
3. **Bot-Token** verlässt den Server nur Richtung **Telegram-API**, nie in API-Responses an die UI (nach Speichern: maskiert `123456:ABC…****`).

---

## 4. Runtime-Konfiguration (Spez)

**Datei:** `.morgendrot-runtime-config.json` (bestehendes Muster, erweitert) — Pfad über `RUNTIME_CONFIG_FILE` überschreibbar.

**Vorschlag Schema:**

```json
{
  "signer": "sdk",
  "integrations": {
    "telegram": {
      "enabled": true,
      "botToken": "<secret — nur serverseitig, in API maskiert>",
      "adminChatId": "1156058618",
      "relayBaseUrl": "http://127.0.0.1:8787",
      "relaySecret": "<optional, random, für Relay-Auth>"
    }
  }
}
```

| Feld | Pflicht | Beschreibung |
|------|---------|--------------|
| `enabled` | nein | Master-Schalter; Default `false` bis Token gesetzt |
| `botToken` | Phase A | Von @BotFather; min. Länge / Format `digits:alphanumeric` |
| `adminChatId` | Phase A | Numerische Chat-ID für Alarme + „Test an mich“ |
| `relayBaseUrl` | nein | Default `http://127.0.0.1:8787` |
| `relaySecret` | nein | Wenn gesetzt: Header bei internen Relay-POSTs |

**Persistenz:** Schreiben bei **Speichern** in UI — **nicht** nur RAM (Neustart muss Config laden).

**Später:** Token in Vault / OS-Keychain (RN) — gleiche API-Oberfläche.

---

## 5. API (Haupt-Server)

### 5.1 `GET /api/integrations/telegram`

**Antwort (kein Klartext-Token):**

```json
{
  "ok": true,
  "enabled": true,
  "botTokenConfigured": true,
  "botTokenMasked": "123456789:AAH…xxxx",
  "adminChatId": "1156058618",
  "relayBaseUrl": "http://127.0.0.1:8787",
  "relayReachable": true
}
```

### 5.2 `POST /api/integrations/telegram`

**Body:**

```json
{
  "enabled": true,
  "botToken": "123456789:AAH…",
  "adminChatId": "1156058618",
  "relayBaseUrl": "http://127.0.0.1:8787"
}
```

- `botToken` weglassen = unverändert lassen (Update nur Chat-ID).
- Validierung: Chat-ID numerisch (ggf. führendes `-` für Gruppen).
- Nach Save: optional **Relay-Health** (`GET` oder Test-POST).

### 5.3 `POST /api/integrations/telegram/test-alarm`

Sendet Test-Payload Kanal A an Admin-Chat-ID (ohne Monitor).

### 5.4 `POST /api/integrations/telegram/test-notify` (Phase B)

Body: `{ "target_chat_id": "…" }` — Test Kanal B.

### 5.5 Kontakt-API (Phase B, Erweiterung)

Bestehend: `POST /api/contact-label` — zusätzliche Felder:

```json
{
  "address": "0x…",
  "label": "Partner B",
  "telegramChatId": "987654321"
}
```

`null` / leer = Feld löschen (analog `meshNodeId`).

---

## 6. Relay (Telegram-Brücke)

**Basis:** Evolution von `scripts/telegram-webhook.ts`.

### 6.1 Endpunkte

| Methode | Pfad | Body | Antwort |
|---------|------|------|---------|
| POST | `/morgendrot-telegram/alarm` | Kanal-A-JSON | `{ "ok": true }` |
| POST | `/morgendrot-telegram/notify` | Kanal-B-JSON | `{ "ok": true }` |

**Legacy (Übergang):** `POST /morgendrot-telegram` ohne Suffix = **alias** für `/alarm` (Monitor-Ist).

### 6.2 Implementierung

- **`fetch`** zu `https://api.telegram.org/bot${token}/sendMessage` — **kein** `node-telegram-bot-api` pro Request.
- Token aus **von Node geladener Integration** (beim Start `readRuntimeConfig()` + `applyIntegrations()`), Fallback `.env` `TG_BOT_TOKEN` / `TG_CHAT_ID` nur für Alarm-Kanal.
- **Kein** `bot_token` im Request-Body akzeptieren (400 + Log-Warnung).

### 6.3 Auth

- Request-IP: `127.0.0.1` / `::1` / `::ffff:127.0.0.1`.
- Optional: Header `X-Morgendrot-Relay-Secret` muss `integrations.telegram.relaySecret` entsprechen.

### 6.4 Betrieb

| Modus | Beschreibung |
|-------|----------------|
| **Manuell** | `npm run telegram-webhook` (wie heute) |
| **Optional später** | Node startet Relay-Child oder bindet Handler intern |

Bei UI-Save: `MONITOR_ALARM_WEBHOOK_URL` im laufenden Prozess auf `{relayBaseUrl}/morgendrot-telegram/alarm` setzen (nur intern, nicht über Blocklist-API).

---

## 7. UI (Next)

### 7.1 Einstellungen → Integrationen → Telegram (Phase A)

- Bot-Token (Passwort-Feld, Autocomplete off)
- Eigene Chat-ID + Link-Hilfe „@userinfobot“
- Relay-URL (Default vorausgefüllt)
- Schalter „Telegram-Alarme aktiv“
- Buttons: **Speichern**, **Test an mich**

**Hilfetext:** Bot bei @BotFather anlegen; für Alarme reicht **deine** ID — Partner-IDs kommen ins Telefonbuch (Phase B).

### 7.2 Telefonbuch / Kontakt (Phase B)

- Feld **Telegram Chat-ID** (optional)
- Im Composer: Checkbox **„Zusätzlich Telegram-Hinweis“** (Default aus)

### 7.3 Sende-Flow (Phase B)

```text
[Nutzer: Senden]
  → Forensik-Pfad (unverändert, await)
  → wenn telegramNotify && contact.telegramChatId:
        fire-and-forget POST intern → Relay /notify
        (Fehler nur Toast, kein Rollback)
```

---

## 8. Onboarding (Betrieb)

### 8.1 Admin (einmalig)

1. Bei **@BotFather** `/newbot` → Token kopieren.
2. In Morgendrot **Integrationen** eintragen → **Speichern**.
3. In Telegram den Bot öffnen → **Start** tippen (sonst darf Bot nicht schreiben).
4. **@userinfobot** (oder ähnlich) → eigene **Chat-ID** kopieren → in Integrationen eintragen.
5. **Test an mich** — Nachricht wie Kanal A muss ankommen.
6. `npm run telegram-webhook` starten (oder Relay durch Node), `ENABLE_MONITOR=true`, `MONITOR_ALARM_WEBHOOK_URL=http://127.0.0.1:8787/morgendrot-telegram/alarm`.

### 8.2 Partner (für Kanal B)

1. Partner: Bot **Start**.
2. Partner: ID an Admin schicken (z. B. via @userinfobot).
3. Admin: ID im **Telefonbuch** beim `0x…`-Kontakt speichern.
4. Optional: **Test an Kontakt** aus Integrationen.

---

## 9. Sicherheit & Missbrauch

| Risiko | Maßnahme |
|--------|----------|
| Token in Browser-LocalStorage | Token **nur** serverseitig in Runtime-Datei; UI sendet einmalig beim Save |
| Offenes Relay auf LAN | Nur localhost + Secret; keine Bindung an `0.0.0.0` |
| `bot_token` pro Request | **Verboten** — ein Bot pro Installation |
| Telegram sieht Inhalt | UI-Warnung; keine E2E-Behauptung |
| Logs | Token in Logs **maskieren** (nur Prefix) |

---

## 10. Abnahme (Checklisten)

### Phase A

- [ ] Integrationen speichern ohne `.env`-`TG_*`
- [ ] Neustart Node: Alarm-Test funktioniert
- [ ] Monitor-Offline-Alarm löst Telegram aus
- [ ] `curl` Test an `/alarm` (siehe unten)
- [ ] `setEnvKey('TG_BOT_TOKEN')` abgelehnt
- [ ] API gibt Token nicht zurück (nur maskiert)

### Phase B

- [ ] Kontakt mit `telegramChatId` + Opt-in → Notify
- [ ] Kontakt ohne ID → IOTA ok, kein Notify
- [ ] LoRa-Send ohne Internet → IOTA/Mesh ok

### Manueller Test (Relay)

```bash
# Relay muss laufen (npm run telegram-webhook — nach Umsetzung: /alarm)
curl -s -X POST http://127.0.0.1:8787/morgendrot-telegram/alarm \
  -H "Content-Type: application/json" \
  -d "{\"device\":\"TEST-DEVICE\",\"message\":\"Testalarm von Morgendrot\",\"level\":1}"
```

---

## 11. Explizit nicht in Scope (H.26)

- Pinnwand → Telegram (siehe `docs/BROADCAST-PINNWAND.md` Backlog)
- Vollständiger Chat-Mirror (alle Nachrichten automatisch)
- Telegram als **einziger** Kanal ohne IOTA
- Gruppen-/Kanal-Broadcast ohne Kontakt-ID
- `node-telegram-bot-api` Long-Polling / Bot-Kommandos in Morgendrot

---

## 12. Migrationspfad vom Ist

| Ist | Ziel |
|-----|------|
| `TG_*` in `.env` | Fallback; UI-Runtime überschreibt beim Start |
| Ein Endpoint `/morgendrot-telegram` | + `/alarm`, + `/notify`; Legacy-Alias |
| Separates `npm run telegram-webhook` | Bleibt; liest Runtime **oder** `.env` |
| Keine UI | Integrationen-Panel Phase A |

---

## 13. Verweise

- Fahrplan: **§ H.26** in `docs/ROADMAP-FAHRPLAN.md`
- Sensor-Alarme (Betrieb): `docs/SENSOR-ALARME-EINRICHTEN.md` § 5 (Webhook)
- Konfiguration allgemein: **§ H.6e**, `docs/ROADMAP-FAHRPLAN.md`
- Ist-Code Relay: `scripts/telegram-webhook.ts`
- Monitor: `src/monitoring.ts` (`triggerAlarm`)
