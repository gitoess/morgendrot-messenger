# Telegram-Integration — Zielbild (Spez)

**Status:** Spezifikation + **Ist-Code** (**§ H.26** in **`docs/ROADMAP-FAHRPLAN.md`**).  
**Stand:** **2026-06-16** (neu **§6 B4b** Boss-Gruppenalarm; zuvor 2026-05-20 Phase **B2 Long Polling**).

**Zweck:** Telegram als **Hinweis-Kanal** für (A) **Systemalarme**, (B2) **Eingang**, (B3) **1:1-Notify nach Send**, (B4b) **Einsatz-Gruppenalarm** — Runtime-Konfiguration, ohne `TG_*` in Helfer-`.env`.

**Strategie-Kontext:** Telegram ist **optional** (**§ H.0-SIMPLE**). **IOTA** = Archiv/Forensik (**`docs/TRANSPORT-AND-IOTA-LAYERS.md`**). **Langfristig:** Boss-Push (LAN → WebSocket → FCM/APNs) ergänzt Telegram — **§ H.6f**, **`docs/UI-API-PLAN.md`**.

**Verwandt:** `scripts/telegram-webhook.ts`, `src/integrations/telegram-integration.ts`, **§ H.16**, **§ H.36** (Team-Sync ≠ Telegram), **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** §9.3.

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
| **B3** | Notify nach Send (1:1) | Morgendrot → Partner | **Ist** |
| **B4a** | Mehrfach 1:1 (Composer) | Morgendrot → N Chat-IDs | **Ist** |
| **B4b** | **Boss-Gruppenalarm** (Einsatz-Gruppe) | Boss → **eine** Telegram-Gruppe | **Spec §6** — Code folgt |
| **B5** | Bot-Kommandos `/help`, `/status` | Partner → Bot | **Ist** |

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
| **Gruppen-Chats (Eingang)** | Nur explizit erlaubte Chat-IDs — kein offener Gruppen-Spiegel |
| **Gruppen-Chats (Ausgang B4b)** | **Spec §6** — eine Einsatz-Gruppe, nur Kurz-Hinweise |

---

## 5. Phase B3 — Notify nach Send (**Ist**)

| Aspekt | Wert |
|--------|------|
| **Auslöser** | Erfolgreicher Send **und** Nutzer-Opt-in (`morgendrot.telegramNotifyOnSend`) |
| **Empfänger** | `telegramChatId` aus Telefonbuch |
| **Transport** | API **`/api/integrations/telegram/notify`** → Relay **`/morgendrot-telegram/notify`** |
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

## 5.1 Phase B5 — Bot-Kommandos `/help`, `/status` (**Ist**)

| Aspekt | Wert |
|--------|------|
| **Auslöser** | Textnachricht `/help` oder `/status` (optional `@BotName`) |
| **Berechtigung** | Telefonbuch-`telegramChatId` **oder** `adminChatId` aus Runtime-Config |
| **Antwort** | Direkt `sendMessage` über Bot-Token (kein Relay) |
| **Journal** | Kommandos **nicht** im Posteingang — nur normale Partner-Texte |

**Code:** `src/integrations/telegram-bot-commands.ts`, Anbindung in **`ingestTelegramInboundUpdate`** (Long Poll + Webhook).

**Abnahme:** Bekannte Chat-ID sendet `/status` → Antwort mit Rolle/Modus; `/help` listet Kommandos; fremde Chat-ID → ignoriert.

**Backlog B5:** `/nodes`, `/qr`.

---

## 6. Phase B4b — Boss-Gruppenalarm (Einsatz-Telegram-Gruppe) (**Spec 2026-06-16**)

**Status:** **Spec** — Implementierung **nach** B3/B5-Stabilisierung; Roadmap **§ H.26 B4b**.  
**Zweck:** **Ein** Boss-Bot + **eine** zentrale Einsatz-Gruppe für **Kurz-Hinweise** an alle Helfer mit Telegram — **ohne** N Bots, **ohne** Chat-Vollspiegel, **ohne** E2EE-Behauptung.

### 6.1 Leitprinzipien (verbindlich)

| Prinzip | Bedeutung |
|---------|-----------|
| **Ein Bot, eine Gruppe** | Pro Einsatz **eine** negative `chat_id` (Supergruppe) in Runtime — nicht pro Helfer ein Bot. |
| **Hinweis, nicht Inhalt** | Telegram zeigt nur *„Ereignis X — Details in Morgendrot“* — **kein** voller SOS-Text, **kein** Mailbox-Dump, **keine** Seeds/Keys. |
| **Nicht blockierend** | Wie B3: Telegram-Fehler ändern **nicht** den Erfolg von Funk / IOTA / LAN-Send. |
| **Telegram ≠ Team-Sync** | Gruppenbeitritt ersetzt **nicht** `MORG_TEAM_MEMBER_UPDATE_V1` (**§ H.36**) noch Telefonbuch-Merge. |
| **Optional** | Simple Mode / Helfer ohne Telegram: Wizard-Schritt **„Später“** — Morgendrot bleibt Pflichtkanal im Einsatz. |
| **Boss-only Auslöser** | Gruppenalarm nur Rolle **Boss** (ggf. **Kommandant** im Hauptprojekt) — nicht jeder Helfer. |

### 6.2 Abgrenzung: Telegram-Gruppe vs. Morgendrot-Gruppe

| | **Telegram Einsatz-Gruppe** | **Morgendrot Gruppenchat** | **Team-Sync (§ H.36)** |
|--|----------------------------|----------------------------|-------------------------|
| **Zweck** | Push-Hinweis ans Handy (Internet) | 1:1-Union / Funk Secondary | Kontakt-Roster boss-signiert |
| **Mitgliedschaft** | Manuell via **Einladungslink** | Lokal + ggf. Funk-Kanal | Ja/Nein im Posteingang |
| **Inhalt** | Klartext-Kurzzeile | Mesh / IOTA / verschlüsselt möglich | Wire `MORG_TEAM_MEMBER_UPDATE_V1` |
| **Konfiguration** | Runtime `einsatzGroupChatId` | UI Gruppe + Mitglieder-0x | IOTA + LAN |

### 6.3 Runtime-Konfiguration (Boss)

Erweiterung **`integrations.telegram`** in **`.morgendrot-runtime-config.json`**:

| Feld | Typ | Pflicht | Beschreibung |
|------|-----|---------|--------------|
| `einsatzGroupChatId` | string | nein | Negative Telegram-Gruppen-ID (z. B. `-1001234567890`) — Ziel für B4b |
| `einsatzGroupLabel` | string | nein | Anzeigename im UI (z. B. „Einsatz Team Alpha“) |
| `einsatzGroupInviteLink` | string | nein | `https://t.me/+…` — **nur** für Helfer-Onboarding, **kein** Geheimnis im Klartext-Chat |
| `einsatzGroupInviteLinkRotatedAt` | number | nein | Unix ms — Hinweis „Link ggf. neu vom Boss“ |
| `einsatzGroupAlarmEnabled` | boolean | nein | Master-Schalter B4b (Default **false** bis Boss aktiviert) |

**Boss-Setup (einmalig, außerhalb Morgendrot):**

1. Telegram-Gruppe anlegen (Supergruppe empfohlen).
2. **Boss-Bot** als **Admin** hinzufügen (Recht: **Nachrichten senden**).
3. Gruppe: **„Nur Admins können Nachrichten senden“** — Helfer **Leser**, Bot + Einsatzleitung **Schreiber**.
4. Permanenter **Einladungslink** erzeugen → in Runtime + optional Handoff-README.
5. Gruppen-`chat_id` ermitteln (Bot `@userinfobot` / `getUpdates` nach Testnachricht / Admin-Tool) → `einsatzGroupChatId`.

**Sicherheit Link:** Einladungslink = **Zugangsschlüssel**. Bei Leak: Link in Telegram **widerrufen** + neuer Link + Handoff/README aktualisieren.

### 6.4 Auslöser × Sendewege (Fan-out-Matrix)

B4b ist **zusätzlicher Ausgang** neben den Morgendrot-Primärwegen — **nie** Ersatz.

| Ereignis | Primär (Morgendrot) | B4b Gruppen-Hinweis | Anmerkung |
|----------|---------------------|---------------------|-----------|
| **SOS / Hilferuf** | Funk Klartext + Online Klartext (**§9.3**) | **Ja** (Kurz) | Volltext **nur** Funk/IOTA; Telegram: *„Hilferuf — Details in Morgendrot“* |
| **Composer-Send + Opt-in B3** | Funk / online / … | **Nein** (1:1) | B3 bleibt **Einzel**-`telegramChatId`; Gruppe nicht pro Chat-Nachricht spammen |
| **Boss „Team alarmieren“** | — | **Ja** | Manuell Einsatzleitung; Template wählbar |
| **Monitor-Alarm (Kanal A)** | Relay `/alarm` → `adminChatId` | **Optional** | Separate Schalter: Admin **oder** auch Einsatz-Gruppe |
| **Team-Member-Update (§ H.36)** | IOTA + LAN + Funk-Ping | **Optional** | Hinweis *„Neues Mitglied — bitte in App bestätigen“* — **kein** Roster im Klartext |
| **Pinnwand / Broadcast** | Online IOTA | **Backlog** | **`docs/BROADCAST-PINNWAND.md`** — nicht B4b v1 |
| **Handshake / Connect** | IOTA / API | **Nein** | **§ H.27** — Badge/Inbox, kein Telegram |
| **Handoff / Provisioning** | ZIP / QR / WLAN-QR | **Nein** | Nur **Link-Weitergabe** im README, kein Auto-Join |

**Sendepfad-UI (Composer):** Die vier Modi **funk / online / telegram / adhoc** (**`docs/TRANSPORT-AND-IOTA-LAYERS.md`**) betreffen **Nachrichteninhalt**. B4b ist **paralleler System-Hinweis** — nicht der Composer-Transport „telegram“.

**LAN / Boss-Push (Zukunft):** Wenn Basis-URL = Boss-LAN, kann derselbe Hinweis **zusätzlich** per WebSocket/FCM an die App — unabhängig von Telegram (**§ H.16**, **`docs/UI-API-PLAN.md`**).

### 6.5 Hinweistexte (Templates)

Platzhalter: `{teamLabel}`, `{eventType}`, `{bossShort}`, `{seq}`.

| `eventType` | Beispiel (max. ~280 Zeichen) |
|-------------|------------------------------|
| `sos` | `{teamLabel}: Hilferuf ({bossShort}). Details in Morgendrot öffnen — nicht 112.` |
| `team_update` | `{teamLabel}: Team-Update #{seq}. Bitte in Morgendrot bestätigen.` |
| `boss_alarm` | `{teamLabel}: Wichtiger Hinweis von Einsatzleitung. Morgendrot prüfen.` |
| `monitor` | `{teamLabel}: Systemalarm — {device}. Morgendrot/Monitor prüfen.` |

**Verboten im Text:** Mnemonic, Keys, volle SOS-Lage, `.env`-Inhalte, Einladungslink **nicht** in Gruppennachrichten wiederholen (Link nur onboarding-seitig).

### 6.6 Helfer: der Gruppe beitreten

Die App kann **nicht** im Namen des Nutzers einer Telegram-Gruppe beitreten — nur **Telegram** (App oder Web) kann das. Morgendrot **zeigt** den Link und **öffnet** ihn.

#### 6.6.1 Empfohlen: Permanenter Einladungslink

| Schritt | Wer | Aktion |
|---------|-----|--------|
| 1 | Boss | Telegram → Gruppe → **Link einladen** → permanenten Link kopieren |
| 2 | Boss | Link in Runtime + optional **QR** in Einsatzleitung / Handoff |
| 3 | Helfer | Link antippen oder QR mit **Telegram-App** scannen → **Beitreten** |

**Warum best:** Schnell, keine Suche, funktioniert bei **privater** Gruppe.

**Weitergabe des Links (nach Priorität):**

| Kanal | Eignung | Grenze |
|-------|---------|--------|
| **QR in Einsatzleitung / Wizard** | **Beste** | Braucht Bildschirm oder Ausdruck |
| **Handoff `README-HANDOFF.txt`** | **Gut** für Neulinge | ZIP kann weitergegeben werden — Link ist semi-öffentlich |
| **Boss-LAN / QR Install** | **Gut** im WLAN | Nur vor Ort |
| **IOTA Klartext / Mailbox** | **Möglich** | Link lang; nur wenn nötig, besser Kurztext *„Link beim Boss“* |
| **Funk (LoRa)** | **Schlecht** | Airtime — **kein** voller `t.me/+…` Link; Funk: *„Telegram-Gruppe: Link beim Boss / QR scannen“* |
| **Ausgedruckt am Einsatzbrief** | **Gut** | Offline-fähig |

#### 6.6.2 Nicht empfohlen: Manuelle Suche

| Methode | Bewertung |
|---------|-----------|
| Gruppe **öffentlich** suchen | ❌ Selten gewollt; OPSEC |
| Gruppenname ohne Link | ❌ Fehleranfällig |
| Negative **`chat_id`** an Helfer | ❌ **Nur** Boss-Runtime — Helfer brauchen die ID **nicht** |

#### 6.6.3 UI (Boss + Helfer)

| Ort | Inhalt |
|-----|--------|
| **Einstellungen → Telegram → Einsatz-Alarmgruppe** (Boss) | Link einfügen, QR anzeigen, Test an Gruppe, `einsatzGroupAlarmEnabled` |
| **Helfer-Wizard** (§ H.36 P0, Schritt optional) | Hinweis + QR/Link + **„In Telegram öffnen“** + **„Später“** |
| **Handoff README** | Abschnitt *Telegram-Alarmgruppe (optional)* mit Link |

**Copy (Helfer):** *„Nur für Benachrichtigungen — alle wichtigen Inhalte bleiben in Morgendrot.“*

**Deep-Link:** Button ruft `window.open(inviteLink)` bzw. `tg://join?invite=…` — Fallback wenn Telegram nicht installiert: Store-Hinweis.

### 6.7 Eingang (B2) in der Gruppe

**v1 Default:** **Kein** Posteingang-Spiegel aus der Einsatz-Gruppe — nur **Boss → Gruppe** (Ausgang).

| Option | v1 | Später |
|--------|-----|--------|
| Helfer schreibt in Gruppe → Morgendrot | **Aus** | Backlog nur mit Allowlist + „Nur Admins schreiben“ erzwingen |
| Bot liest Gruppe (`getUpdates`) | **Aus** für Gruppen-ID | Optional `/status` in Gruppe |

Wenn später Gruppen-Eingang: `einsatzGroupChatId` in Allowlist **zusätzlich** zu 1:1-IDs — weiterhin **kein** Vollspiegel.

### 6.8 API & Code (Soll)

| Baustein | Vorschlag |
|----------|-----------|
| **Send** | `sendTelegramEinsatzGroupHint({ eventType, preview?, seq? })` in `telegram-integration.ts` |
| **API** | `POST /api/integrations/telegram/group-alarm` (Boss-gated) |
| **SOS** | Nach Dashboard-SOS / Fan-out: optional B4b parallel (**`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`**) |
| **Journal** | Richtung `out`, `chatId` = Gruppe, `kind: 'einsatz_group_hint'` |
| **Tests** | Vitest: fehlende `einsatzGroupChatId` → skip; Fehler → Hauptsend unverändert |

### 6.9 Implementierungsphasen

| Phase | Lieferumfang |
|-------|----------------|
| **B4b.0** | Runtime-Felder + Boss-UI (Link, QR, Test, Schalter) |
| **B4b.1** | `group-alarm` API + Templates §6.5 + manueller „Team alarmieren“ |
| **B4b.2** | SOS-Fan-out + optional Team-Update-Hinweis; Handoff-README-Feld |
| **B4b.3** | Helfer-Wizard-Schritt (§ H.36); Monitor → Gruppe optional |

### 6.10 Offene Punkte (Freeze vor Code)

1. Kommandant im Messenger-Bundle: Gruppenalarm **nur Boss** oder auch Kommandant?  
2. Einladungslink im verschlüsselten Handoff (`handoff.morg.enc`) — ja/nein?  
3. Rate-Limit pro Stunde für Gruppen-Hinweise (Anti-Spam bei SOS-Retries)?

**Nächster Schritt:** B4b.0 Boss-UI + Runtime-Schema — ohne Änderung am B3-1:1-Pfad.

---

## 7. Architektur (Gesamt)

```text
┌─────────────────────────────────────────────────────────────────┐
│  Next-UI — Integrationen → Telegram (Expert / Boss)            │
│  Telefonbuch: telegramChatId (B1) · Einsatz-Gruppe (B4b)       │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Morgendrot API (api-server)                                     │
│  /api/integrations/telegram  — save, test, inboundMode          │
│  /api/integrations/telegram/group-alarm  — B4b (geplant)        │
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
│  /notify (B3)          │                 │
│  /group-alarm (B4b)    │                 ▼
└───────────┬────────────┘       api.telegram.org
            └──────────────────► sendMessage / getUpdates
```

**Regeln:**

1. Browser **nur** Morgendrot-API — **nie** direkt Relay oder `api.telegram.org`.
2. **Bot-Token** nie in API-Response (nur maskiert).
3. **Kein** `bot_token` im Notify-Body.

---

## 8. Runtime-Konfiguration (Schema)

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
      "lastUpdateId": 123456789,
      "einsatzGroupChatId": "-1001234567890",
      "einsatzGroupLabel": "Einsatz Team Alpha",
      "einsatzGroupInviteLink": "https://t.me/+AbCdEfGh",
      "einsatzGroupAlarmEnabled": false
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
| `einsatzGroupChatId` | **B4b** | Negative Gruppen-ID — Ziel Gruppenalarm |
| `einsatzGroupLabel` | **B4b** | Anzeigename im UI |
| `einsatzGroupInviteLink` | **B4b** | Einladungslink für Helfer-Onboarding (§6.6) |
| `einsatzGroupAlarmEnabled` | **B4b** | Gruppen-Hinweise aktiv |

---

## 9. Onboarding

### 9.1 Admin (Bot + Poll)

1. Bot bei **@BotFather** → Token in **Integrationen**.
2. **`inboundMode`:** **Long Polling** (Feld ohne Tunnel).
3. Eigene Chat-ID → **Test an mich**.
4. Relay starten (`npm run telegram-webhook` o. Ä.) für Kanal A.

### 9.2 Partner (Eingang B2, 1:1)

1. Partner: Bot **Start**.
2. Chat-ID an Admin (z. B. @userinfobot).
3. Admin: ID im **Telefonbuch** (`telegramChatId` oder Kontakt `tg:…`).
4. Partner schreibt Bot → Zeile im Posteingang (wenn Poll läuft).

### 9.3 Einsatz-Alarmgruppe (B4b, Helfer)

1. Boss: Gruppe + Bot-Admin + Einladungslink (§6.3).
2. Boss: Link/QR in Runtime + optional Handoff-README.
3. Helfer: **In Telegram öffnen** (Wizard oder Einstellungen) — **Später** möglich.
4. **Kein** Auto-Join aus Morgendrot; Telegram-App erforderlich.

---

## 10. Sicherheit

| Risiko | Maßnahme |
|--------|----------|
| Token in Browser | Nur serverseitig in Runtime-Datei |
| Offenes Relay | localhost + optional `relaySecret` |
| Spam an Bot | **Allowlist** nur Telefonbuch-Chat-IDs (+ ggf. Gruppe B4b später) |
| Einladungslink geleakt | Link in Telegram widerrufen; README/Handoff aktualisieren (§6.3) |
| Telegram ≠ Forensik | UI-Warnung; **§ H.0-SIMPLE** — kein Pflichtkanal |

---

## 11. Explizit nicht in Scope

- Vollständiger Chat-Mirror (alle Sends automatisch)
- Telegram als **einziger** Kanal ohne LoRa
- Pinnwand → Telegram (**`docs/BROADCAST-PINNWAND.md`** — separates Backlog)
- **Pflicht** in Simple Mode / Einsatz-Default
- Mehrere Bots pro Einsatz (nur **ein** Boss-Bot + **eine** Einsatz-Gruppe)

---

## 12. Migrationspfad

| Ist (2026-05) | Ziel |
|---------------|------|
| `TG_*` in `.env` | Legacy-Fallback Deploy |
| Nur `/alarm` | + Long Poll **B2** + `/notify` **B3** + **B4b** Gruppenalarm (Spec §6) |
| Webhook-only-Doku | **Long Poll** als Feld-Default in Spez |

---

## 13. Verweise

- Fahrplan: **§ H.26** in **`docs/ROADMAP-FAHRPLAN.md`**
- **B4b Spec:** **§6** (dieses Dokument)
- Team-Sync (≠ Telegram): **`docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md`** § **H.36**
- SOS Fan-out: **`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`** §9.3
- Sendewege: **`docs/SENDEWEGE-KANAL-MAILBOX-UEBERSICHT.md`**, **`docs/TRANSPORT-AND-IOTA-LAYERS.md`**
- Strategie: **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`**, **§ H.0-SIMPLE**
- Code Poll: **`src/integrations/telegram-inbound-poll.ts`**
- Code Ingest: **`src/integrations/telegram-inbound.ts`**
- Monitor: **`src/monitoring.ts`**
- Relay-Ist: **`scripts/telegram-webhook.ts`**
