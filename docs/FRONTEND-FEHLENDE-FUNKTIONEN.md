# Fehlende Funktionen im Frontend (Ordner `frontend`) – Liste & Übergabe-Prompt

Dieses Dokument listet alle **fehlenden oder unvollständigen** Funktionen gegenüber der Referenz-UI (`ui/index.html`) und dem Backend auf. Am Ende steht ein **kopierbarer Prompt** zur Weitergabe an Entwickler oder KI.

---

## 0. Neue UI (Dashboard + Views) – Was ist drin, was fehlt zentral

Die **aktuelle** UI ist das Next.js-Dashboard (`frontend/frontend/components/dashboard.tsx`) mit Views: ChatView, LockView, MonitorView, BossView, VaultView, SettingsView, ConfigView, plus SetupOverlay.

### 0.1 In der neuen UI vorhanden

- **Chat:** Senden (verschlüsselt/Klartext), Handshake, Connect, **Posteingang** (lädt über `/inbox` → Backend-Alias für `/fetch`, Antwort mit `data`). Nachrichtenformat `sender`/`text`/`isPlain` wird auf `from`/`content`/`encrypted` gemappt.
- **Lock:** Keys und Tickets (erstellen, übertragen, löschen), Liste über `/api/command` mit `/list-keys`, `/list-tickets`.
- **Monitor:** Geräte-Status über `/device-status`, Heartbeat senden, Intervall setzen; Konfiguration (MONITOR_DEVICES etc.) in MonitorProject nur in der ungenutzten Projekt-Variante – in der genutzten MonitorView keine Config-Formulare.
- **Boss:** Rollen setzen, Befehle senden; Pinnwand-Admin als Platzhalter.
- **Vault:** vault-save, vault-load, emergency-purge.
- **Einstellungen:** Status, IOTA-Transfer, **Backend neu starten**, Link zu Config.
- **Config (.env):** Alle Keys aus `GET /api/config` anzeigen und per `POST /api/config` setzen – damit sind **Streams/Mailbox** indirekt abgedeckt (MAILBOX_ID, USE_MAILBOX, ENABLE_PURGE, FETCH_LAST_ON_START, OPEN_STREAMS_ENABLED, STREAMS_ANCHOR_ID, STREAMS_TOPIC, STREAMS_LISTEN_ENABLED, STREAMS_BRIDGE_URL etc.).
- **Hilfe (?):** Button im Header lädt `GET /api/help` und zeigt den Backend-Hilfetext (inkl. Befehle wie /purge-handshake, /purge-msg, /fetch).
- **Setup:** Package-ID-Historie, RPC setzen, Node-Check, Package-ID wählen.

### 0.2 Fehlende zentrale Funktionen (keine eigene UI)

| Thema | Backend | In neuer UI | Wo trotzdem nutzbar |
|-------|---------|-------------|----------------------|
| **Streams / Mailbox** | MAILBOX_ID, USE_MAILBOX, STREAMS_*, OPEN_STREAMS_ENABLED | Kein eigener „Streams/Mailbox“-Bereich | **Config-View:** alle Keys setzbar (MAILBOX_ID, USE_MAILBOX, ENABLE_PURGE, STREAMS_ANCHOR_ID, …). |
| **Nachrichten laden mit Sender-Filter** | `/fetch N 0x…` (2. Arg = Sender) | Nur „Letzte 50“ ohne Filter | Hilfe „?“ zeigt Befehl; ggf. später in ChatView optionales Feld „Nur von 0x…“. |
| **Purge Handshake / Purge Nachricht** | `/purge-handshake`, `/purge-msg <nonce> [sender]` | Kein Button | Über **Hilfe „?“** Befehl sichtbar; Ausführung nur über zukünftigen „Befehl eingeben“-Dialog oder Config/CLI. |
| **Package-ID beim Inbox-Laden wechseln** | `/set-package-id` + `/fetch` | Inbox lädt immer aktuelle Package-ID | **SetupOverlay:** Package-ID wählen und setzen, danach Chat/Inbox nutzen. |
| **Adresse generieren / Package deployen** | `/api/generate-address`, `/api/deploy-package` | Keine Buttons | Nur über API/CLI oder spätere UI-Erweiterung. |
| **Boss-Provisioning (Handshake/Signer)** | `/api/start-boss-signer`, `/api/boss-provision-handshake` | Keine Buttons | Nur über API/CLI. |
| **Audit-Export / Gas-Check / Rebate-Liste** | `/api/audit-export`, `/api/gas-station-check`, `/api/rebate-candidates` etc. | Keine Views | Optional später in Einstellungen oder Monitor. |

Kurz: **Streams und Mailbox** sind nicht als eigene Kachel/Seite umgesetzt, aber alle zugehörigen **.env-Keys** (MAILBOX_ID, USE_MAILBOX, STREAMS_*, …) können in der **Config-View** gesetzt werden. Die Befehle **/purge-handshake** und **/purge-msg** haben in der neuen UI keine Buttons, stehen aber in der **Hilfe (?)**; Nutzung dann z. B. über ein künftiges „Befehl eingeben“-Feld oder extern.

---

## 1. Vollständige Checkliste: Was fehlt oder ist unvollständig

### 1.1 Nachrichten & Chat (ChatProject)

| Punkt | Status | Erwartung |
|-------|--------|-----------|
| **Fetch mit Package-ID-Auswahl** | Fehlt | Inbox soll optional eine **Package-ID** unterstützen: Dropdown/Liste aus `GET /api/package-id-history`. Vor „Letzte 20“: wenn andere Package-ID gewählt, zuerst `POST /api/command` mit `cmd: '/set-package-id'`, `args: [gewählteId]`, dann `/fetch` mit `args: ['20']`. |
| **Fetch mit optionalem Sender-Filter** | Fehlt | Optionales Eingabefeld „Nur von Sender (0x…)“; bei Ausfüllung `/fetch` mit `args: ['20', senderAdresse]` (Backend: zweiter Arg = Sender-Filter). |
| **Vault-Save Feedback** | Vorhanden | CommandForm zeigt Ergebnis – OK. |
| **Purge-Handshake Feedback** | Vorhanden | Button ruft executeCommand – Ergebnis-Anzeige unter dem Button ergänzen (wie bei CommandForm: Erfolg/Fehler). |

### 1.2 Schloss & Zugang (LockProject)

| Punkt | Status | Erwartung |
|-------|--------|-----------|
| **/emergency-purge-ticket** | Nur in VaultProject | Im LockProject (Tickets-Tab) ein **eigenes Formular** für `/emergency-purge-ticket` mit Feld Ticket-ID (0x…), analog zu `/emergency-purge-key`. |
| **/list-keys und /list-tickets Response** | Prüfen | Backend liefert vermutlich `{ ok, keys }` bzw. `{ ok, tickets }`. Frontend nutzt teils `response.data` – anpassen auf `response.keys` / `response.tickets`, falls die API so antwortet. |
| **Smart-Lock Konfiguration** | Fehlt | Für Variante „Smart-Lock Setup“: Formulare/Toggles für **ROLE**, **LOCK_ID**, **OPEN_COMMAND**, **OPEN_URL**, **OPEN_COMMAND_WORDS**, **PAYMENT_TRIGGER_ENABLED**, **OFFLINE_OPEN_ENABLED** (per `POST /api/config` mit key/value). |
| **Zahlungs-Trigger Konfiguration** | Fehlt | Für Variante „Zahlungs-Trigger“: Konfiguration **PAYMENT_TRIGGER_ENABLED**, **PAYMENT_TRIGGER_MIN_IOTA**, **PAYMENT_TRIGGER_POLL_MS**, **PAYMENT_TRIGGER_STATE_FILE**, ggf. Webhook – per Config-API setzen. |

### 1.3 Boss-Modus (BossProject)

| Punkt | Status | Erwartung |
|-------|--------|-----------|
| **Pinnwand-Verwaltung: echte Config** | Placeholder | Statt „Pinnwand-Name“/„Beschreibung“: **ENABLE_BROADCAST_PINNWAND** (Toggle), **BROADCAST_PINNWAND_ADDRESS** (Input 0x…), **BROADCAST_AUTHORIZED_SENDERS** (Input: kommagetrennte 0x…). Speichern per `POST /api/config` mit key/value. |
| **Boss-Signer: Hierarchie** | Placeholder | **ROLE** (boss/kommandant/arbeiter), **BOSS_ADDRESS**, **KOMMANDANT_ADDRESSES**, **WORKER_ADDRESSES** aus Config laden und per Config-API setzen. Aktuelle Werte von `GET /api/config` oder Status. |

### 1.4 Überwachung (MonitorProject)

| Punkt | Status | Erwartung |
|-------|--------|-----------|
| **Echte Geräte-Daten** | Mock | Geräte-Liste aus Backend: z. B. **MONITOR_DEVICES** aus Config (kommagetrennte Adressen) parsen und anzeigen; oder eigenen Endpoint nutzen, falls vorhanden (z. B. Geräte-Status). |
| **Konfiguration** | Fehlt | Formulare/Inputs für **MONITOR_DEVICES**, **MONITOR_OFFLINE_TIMEOUT_MS**, **MONITOR_ALARM_WEBHOOK_URL**, **MONITOR_STATE_FILE**, **MONITOR_CHECK_INTERVAL_MS** – setzen per Config-API. |
| **Heartbeat-Sender** | Placeholder | **ENABLE_HEARTBEAT** (Toggle), ggf. **HEARTBEAT_INTERVAL_MS** – per Config setzen. |

### 1.5 System & Identität (SetupOverlay)

| Punkt | Status | Erwartung |
|-------|--------|-----------|
| **Package-ID-Historie** | Fehlt | `GET /api/package-id-history` aufrufen und **Liste früherer Package-IDs** anzeigen; Auswahl einer ID und Setzen per `executeCommand('/set-package-id', [id])`. |
| **RPC/Netzwerk setzen** | Fehlt | Eingabe für **RPC_URL** und Button „Setzen“ → `POST /api/config` mit key `RPC_URL` und value. |
| **„.env anpassen“-Button** | Placeholder | Soll zu einer **Config-Übersicht** führen (siehe 1.6), nicht nur Dialog schließen. |

### 1.6 .env / Config-Übersicht

| Punkt | Status | Erwartung |
|-------|--------|-----------|
| **Vollständige Config-Liste** | Fehlt | Eigene View/Seite „.env anpassen“: `GET /api/config` → Liste aller Keys mit Wert (maskiert). Pro Eintrag: Toggle (bei Bool) oder Input + „Setzen“ → `POST /api/config`. Gruppierung nach Kategorien (Netzwerk, Wallet, Rolle, Features, Monitor, …) optional. |

### 1.7 API & Datenmodell

| Punkt | Status | Erwartung |
|-------|--------|-----------|
| **/api/current-ids** | Optional | Falls `/api/status` keine MY_ADDRESS/PACKAGE_ID liefert: zusätzlich `GET /api/current-ids` für Anzeige in Setup. |
| **Notfall: /emergency-purge-all** | Prüfen | Backend könnte `/emergency-purge` (ohne „-all“) heißen – Befehl im VaultProject prüfen und ggf. an Backend anpassen. |

### 1.8 Optional (Nice-to-have)

- **Wizard / KI:** Kein „Freie Eingabe (KI)“-Toggle und kein AI-Copilot im Frontend – bewusst weggelassen; bei Bedarf später ergänzbar.
- **Export:** Button „README + .env herunterladen“ (wie in alter UI) – optional.
- **Klartext-Hinweis bei /send-plain:** Kurzer Hinweis „Nachricht ist im Explorer sichtbar“ oder Bestätigungs-Dialog vor dem Senden.

---

## 2. Kopierbarer Übergabe-Prompt

**Nachfolgenden Abschnitt unverändert kopieren und an Entwickler oder KI weitergeben.**

---

### Prompt: Fehlende Funktionen im Morgendrot-Frontend ergänzen

**Kontext:** Das Morgendrot-Frontend liegt im Ordner `frontend` (Next.js, React, Tailwind, Shadcn). Die API-Basis-URL ist `NEXT_PUBLIC_API_BASE` (Default: `http://127.0.0.1:3342`). Befehle werden über `POST /api/command` mit `{ cmd, args }` ausgeführt, Config über `GET/POST /api/config` (key/value).

**Auftrag:** Folgende Punkte im Frontend ergänzen oder anpassen, sodass alle genannten Funktionen nutzbar sind.

1. **Nachrichten & Chat (ChatProject / Inbox)**  
   - Inbox: **Package-ID-Auswahl** – `GET /api/package-id-history` laden, Dropdown/Liste anzeigen. Beim Klick auf „Letzte 20“ (bzw. 50/100): wenn eine andere als die aktuelle Package-ID gewählt ist, zuerst `executeCommand('/set-package-id', [gewählteId])`, danach `executeCommand('/fetch', ['20'])` (bzw. gewählte Anzahl).  
   - Inbox: **Optionales Feld „Nur von Sender“** (0x…) – wenn ausgefüllt, `/fetch` mit `args: [anzahl, senderAdresse]` aufrufen.  
   - Nach „Handshake löschen“ (purge-handshake): **sichtbares Ergebnis** (Erfolg/Fehlermeldung) unter dem Button anzeigen (analog zu CommandForm).

2. **Schloss & Zugang (LockProject)**  
   - Im Bereich Tickets: **Formular für `/emergency-purge-ticket`** mit Feld Ticket-ID (0x…), gleiche UX wie bei `/emergency-purge-key`.  
   - **list-keys / list-tickets:** Prüfen, ob die API `{ ok, keys }` bzw. `{ ok, tickets }` zurückgibt; falls ja, im Frontend `response.keys` / `response.tickets` verwenden statt `response.data`.  
   - **Smart-Lock Setup (Variante):** Konfiguration per Config-API anbinden: ROLE, LOCK_ID, OPEN_COMMAND, OPEN_URL, OPEN_COMMAND_WORDS, PAYMENT_TRIGGER_ENABLED, OFFLINE_OPEN_ENABLED (Toggle oder Input + „Setzen“).  
   - **Zahlungs-Trigger (Variante):** Konfiguration PAYMENT_TRIGGER_ENABLED, PAYMENT_TRIGGER_MIN_IOTA, PAYMENT_TRIGGER_POLL_MS, ggf. STATE_FILE/Webhook – per Config-API setzen.

3. **Boss-Modus (BossProject)**  
   - **Pinnwand-Verwaltung:** Placeholder ersetzen durch echte Config: ENABLE_BROADCAST_PINNWAND (Toggle), BROADCAST_PINNWAND_ADDRESS (Input 0x…), BROADCAST_AUTHORIZED_SENDERS (Input, kommagetrennte 0x…). Speichern mit `POST /api/config`.  
   - **Boss-Signer:** ROLE, BOSS_ADDRESS, KOMMANDANT_ADDRESSES, WORKER_ADDRESSES aus Config laden und editierbar machen (Input + Setzen).

4. **Überwachung (MonitorProject)**  
   - **Geräte-Liste:** Nicht mehr Mock – MONITOR_DEVICES aus Config (kommagetrennte Adressen) laden/parsen und anzeigen; falls es einen API-Endpoint für Geräte-Status gibt, diesen nutzen.  
   - **Konfiguration:** MONITOR_DEVICES, MONITOR_OFFLINE_TIMEOUT_MS, MONITOR_ALARM_WEBHOOK_URL, MONITOR_STATE_FILE, MONITOR_CHECK_INTERVAL_MS per Config-API setzbar machen.  
   - **Heartbeat-Sender:** ENABLE_HEARTBEAT (Toggle), ggf. HEARTBEAT_INTERVAL_MS per Config.

5. **Setup-Overlay (System & Identität)**  
   - **Package-ID-Historie:** `GET /api/package-id-history` aufrufen, Liste anzeigen, Auswahl einer ID und Setzen per `executeCommand('/set-package-id', [id])`.  
   - **RPC setzen:** Eingabefeld RPC_URL + Button „Setzen“ → `POST /api/config` mit key `RPC_URL`.  
   - Button „.env anpassen“ soll zur **Config-Übersicht** (siehe Punkt 6) navigieren oder ein Overlay öffnen.

6. **Config-Übersicht (.env anpassen)**  
   - Eigene View/Route „.env anpassen“ (oder Modal): `GET /api/config` → alle Keys mit Werten (maskiert) anzeigen. Pro Eintrag: bei Bool-Typ Toggle, sonst Input + „Setzen“ → `POST /api/config`. Optional: Gruppierung (Netzwerk, Wallet, Rolle, Features, Monitor, …).

7. **Sonstiges**  
   - Falls `/api/status` keine MY_ADDRESS/PACKAGE_ID liefert: in Setup zusätzlich `GET /api/current-ids` nutzen und anzeigen.  
   - Im VaultProject prüfen, ob der Notfall-„Alles löschen“-Befehl `/emergency-purge` oder `/emergency-purge-all` heißt und an das Backend anpassen.

**Design:** Bestehende Komponenten (CommandForm, Input, Label, Button, Tabs, Dialog) und Stil (Tailwind/Shadcn) beibehalten. Jede Aktion soll klares Feedback liefern (Erfolg/Fehler unter dem Button oder als Toast).

---

*Ende des Übergabe-Prompts.*

---

## 3. Kurzreferenz: Relevante API-Endpoints

- `POST /api/command` – Body: `{ cmd, args, silentFetch? }` – für alle Befehle (/fetch, /set-package-id, /handshake, …).  
- `GET /api/status` – Status (Rolle, Verbindung, ggf. Adresse/Package).  
- `GET /api/current-ids` – MY_ADDRESS, PACKAGE_ID (falls nicht in status).  
- `GET /api/config` – Config-Liste.  
- `POST /api/config` – Body: `{ key, value }` – Config setzen.  
- `GET /api/package-id-history` – Liste früherer Package-IDs.  
- `GET /api/list-keys`, `GET /api/list-tickets` – optional mit `?owner=0x…`.
