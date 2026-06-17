# Telegram-Integration — Zielbild (Spez)

**Status:** Spezifikation + **Ist-Code** (**§ H.26** in **`docs/ROADMAP-FAHRPLAN.md`**).  
**Stand:** **2026-06-17** (§6.11 Helfer-Flow Handoff-first; zuvor 2026-06-16 §6 B4b).

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
| **Team-Member-Update (§ H.36)** | IOTA + LAN + Funk-Ping | **Optional** | Kurz-Hinweis in Telegram-Gruppe — **kein** Roster |
| **Telegram-Gruppen-Link (§3.5)** | `MORG_TELEGRAM_ALARM_GROUP_V1` | **Nein** (1:1) | Systemkarte §7.4; Handoff = Primärweg §6.6 |
| **Handoff / Provisioning** | ZIP + Extras-JSON | **Nein** (Broadcast) | Link im ZIP; Wizard Schritt 2 |
| **Pinnwand / Broadcast** | Online IOTA | **Backlog** | **`docs/BROADCAST-PINNWAND.md`** — nicht B4b v1 |
| **Handshake / Connect** | IOTA / API | **Nein** | **§ H.27** — Badge/Inbox, kein Telegram |

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

### 6.6 Helfer-Flow — Übersicht (verbindlich)

| Phase | Wann | Kanal | Regel |
|-------|------|--------|--------|
| **A — Erst-Handoff** | Boss provisioniert **vor** dem Feld | Link im ZIP/README (+ optional QR im Wizard) | **Primärweg** für neue Helfer |
| **B — Späterer Wechsel** | Boss legt Gruppe neu an / Link rotiert | `MORG_TELEGRAM_ALARM_GROUP_V1` (**§6.7**, Spec **`docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md`** §3.5) | IOTA + LAN + Funk-Ping; Systemkarte im Posteingang |
| **C — Nachholen** | Helfer hat Schritt übersprungen | Einstellungen → „Telegram-Alarmgruppe“ | Link aus lokalem Cache oder neues Update |

**Immer:** Beitritt **optional** — kein Zwang. Telegram = **Hinweis-Kanal**, Inhalte in Morgendrot.

**Niemals:** Automatisches Beitreten zur Telegram-Gruppe ohne Nutzer in der **Telegram-App** (Bot-API erlaubt das nicht).

### 6.6.1 Erst-Handoff (Primärweg)

**Boss (vor oder während Export):**

1. Telegram-Gruppe + Bot-Admin (§6.3).
2. Permanenter Einladungslink in Runtime **`einsatzGroupInviteLink`**.
3. Beim Handoff-Export: Link in **`README-HANDOFF.txt`** + maschinenlesbar in **`.morgendrot-handoff-extras.json`** (B4b.2):

```json
{
  "telegramAlarmGroup": {
    "label": "Einsatz Team Alpha",
    "inviteLink": "https://t.me/+AbCdEfGh"
  }
}
```

**Helfer (Wizard Schritt 2 — direkt nach Handoff-Import, § H.36):**

| UI | Verhalten |
|----|-----------|
| **Titel** | „Telegram-Alarmgruppe (empfohlen)“ |
| **Text** | „Für wichtige Alarmierungen (SOS, Team-Update): der Einsatz-Gruppe beitreten. Nur Hinweise — Inhalte bleiben in Morgendrot.“ |
| **QR** | Aus `inviteLink` generiert (analog Install-QR) |
| **Button** | **„Gruppe beitreten“** → `window.open(inviteLink)` / `tg://join?invite=…` |
| **Checkbox** | **„Link beim Öffnen dieses Schritts anzeigen“** (`morgendrot.telegramOpenInviteOnStep`, Default aus) — **nicht** „automatisch beitreten“ (technisch unmöglich) |
| **Sekundär** | **„Später“** · **„Nicht interessiert“** → `localStorage` `morgendrot.telegramAlarmGroupDismissed` |

**Skip:** Schritt ausblenden, wenn Handoff **kein** `inviteLink` enthält **und** Boss noch keine Gruppe konfiguriert hat.

**Weitergabe des Links (Priorität neben Handoff):**

| Kanal | Eignung | Grenze |
|-------|---------|--------|
| **Handoff ZIP (Primär)** | **Beste** für Erststart | Link semi-öffentlich in ZIP — bei Leak Link rotieren |
| **QR im Wizard / Einsatzleitung** | **Beste** visuell | Bildschirm oder Ausdruck |
| **Boss-LAN / WLAN-QR** | **Gut** vor Ort | Nur im WLAN |
| **IOTA / Team-Update Wire** | **Gut** für spätere Änderung | Vollständiger Link im Wire (≤4 KiB) |
| **Funk (LoRa)** | **Nur Ping** | *„Neue Telegram-Gruppe — in App öffnen“* — **kein** voller Link |

#### 6.6.2 Nicht empfohlen: Manuelle Suche

| Methode | Bewertung |
|---------|-----------|
| Gruppe **öffentlich** suchen | ❌ Selten gewollt; OPSEC |
| Gruppenname ohne Link | ❌ Fehleranfällig |
| Negative **`chat_id`** an Helfer | ❌ **Nur** Boss-Runtime |

#### 6.6.3 UI-Ort (Boss + Helfer)

| Ort | Inhalt |
|-----|--------|
| **Einstellungen → Telegram → Einsatz-Alarmgruppe** (Boss) | Link, QR, Test an Gruppe, Schalter `einsatzGroupAlarmEnabled`; **„In Handoff mitgeben“** (Default an wenn Link gesetzt) |
| **Helfer-Wizard Schritt 2** (§ H.36) | §6.6.1 — nur wenn Link aus Handoff/Update |
| **Einstellungen → Telegram** (Helfer, Expert) | Nachholen: letzter bekannter Link + „Beitreten“ |
| **Posteingang-Systemkarte** | Späterer Link-Wechsel (§6.7) |

**Deep-Link:** Fallback ohne Telegram-App → Store-Hinweis, Link kopierbar.

### 6.7 Späterer Gruppen-Wechsel (Boss → alle Helfer)

Wenn Boss die Gruppe **nach** dem Erst-Handoff anlegt oder den Einladungslink **rotiert**:

1. Boss speichert neuen Link in Runtime (§6.3).
2. Boss sendet **`MORG_TELEGRAM_ALARM_GROUP_V1`** an Team-Mailbox (Wire: **`docs/TEAM-MEMBER-UPDATE-WIZARD-SPEC.md`** §3.5).
3. **Parallel:** LAN-Push wenn erreichbar; Funk nur **`MORG_TEAM_UPDATE_PING_V1`** mit Hinweis `kind: telegram_group`.
4. Optional: B4b Kurz-Hinweis **in** die Telegram-Gruppe selbst (nur wer schon drin ist).

**Empfänger — Systemkarte (Posteingang):**

| Feld | Wert |
|------|------|
| **Titel** | `Neue Telegram-Alarmgruppe` |
| **Text** | „Einsatzleitung hat eine Alarmgruppe eingerichtet: {label}.“ |
| **Aktionen** | **Gruppe beitreten** · **Später erinnern** · **Nicht interessiert** |

**Kein** Telefonbuch-Merge — anders als `MORG_TEAM_MEMBER_UPDATE_V1`. Link wird lokal in `morgendrot.telegramAlarmGroupPending` gecacht.

**Transport:** IOTA = Persistenz; LAN = Zustellung; Funk = Ping only (**§8** in Team-Spec).

### 6.8 Eingang (B2) in der Gruppe

**v1 Default:** **Kein** Posteingang-Spiegel aus der Einsatz-Gruppe — nur **Boss → Gruppe** (Ausgang).

| Option | v1 | Später |
|--------|-----|--------|
| Helfer schreibt in Gruppe → Morgendrot | **Aus** | Backlog nur mit Allowlist + „Nur Admins schreiben“ erzwingen |
| Bot liest Gruppe (`getUpdates`) | **Aus** für Gruppen-ID | Optional `/status` in Gruppe |

Wenn später Gruppen-Eingang: `einsatzGroupChatId` in Allowlist **zusätzlich** zu 1:1-IDs — weiterhin **kein** Vollspiegel.

### 6.9 API & Code (Soll)

| Baustein | Vorschlag |
|----------|-----------|
| **Send** | `sendTelegramEinsatzGroupHint({ eventType, preview?, seq? })` in `telegram-integration.ts` |
| **API** | `POST /api/integrations/telegram/group-alarm` (Boss-gated) |
| **SOS** | Nach Dashboard-SOS / Fan-out: optional B4b parallel (**`docs/MORG-EMERGENCY-SOS-WIRE-SPEC.md`**) |
| **Journal** | Richtung `out`, `chatId` = Gruppe, `kind: 'einsatz_group_hint'` |
| **Tests** | Vitest: fehlende `einsatzGroupChatId` → skip; Fehler → Hauptsend unverändert |

### 6.10 Implementierungsphasen

| Phase | Lieferumfang |
|-------|----------------|
| **B4b.0** | Runtime-Felder + Boss-UI (Link, QR, Test, Schalter, „In Handoff mitgeben“) |
| **B4b.1** | `group-alarm` API + Templates §6.5 + manueller „Team alarmieren“ |
| **B4b.2** | Handoff: `README-HANDOFF.txt` + `.morgendrot-handoff-extras.json`; SOS-Fan-out optional |
| **B4b.3** | Helfer-Wizard Schritt 2 (§6.6.1); Wire `MORG_TELEGRAM_ALARM_GROUP_V1` + Posteingang-Systemkarte §6.7 |
| **B4b.4** | Monitor → Gruppe optional; Einstellungen Helfer-Nachholen |

### 6.11 Offene Punkte (Freeze vor Code)

1. Kommandant im Messenger-Bundle: Gruppenalarm **nur Boss** oder auch Kommandant?  
2. Einladungslink in **`handoff.morg.enc`** — **ja** (Klartext-Metadaten im README reicht für v1; extras.json nur unverschlüsselt).  
3. Rate-Limit pro Stunde für Gruppen-Hinweise (Anti-Spam bei SOS-Retries)?  
4. **`tgSeq`** eigene Monotonie vs. gemeinsame `seq` mit Team-Updates? → **eigene `tgSeq`** (§3.5 Team-Spec).

**Nächster Schritt:** B4b.0 Boss-UI + Runtime-Schema — Handoff-Felder in B4b.2 vorbereiten (Doku-only bis Export-Code).

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

1. **Erststart:** Link aus Handoff → Wizard Schritt 2 (§6.6.1) — **Später** / **Nicht interessiert** möglich.
2. **Später:** Systemkarte „Neue Telegram-Alarmgruppe“ (§6.7) oder Einstellungen.
3. **Kein** Auto-Join; Telegram-App erforderlich für Beitritt.
4. Checkbox **„Link beim Öffnen anzeigen“** ≠ automatischer Gruppenbeitritt.

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
