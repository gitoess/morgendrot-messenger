# Ausführlicher UI-Prompt für KI / v0.dev / Builder.io

Dieses Dokument fasst **alle Kacheln, alle Funktionen und alle UI-Wünsche** des Morgendrot-Projekts zusammen, damit eine UI-KI (z. B. v0.dev, Builder.io, Cursor) ein neues, modernes Dashboard und Formular-UI generieren oder bewerten kann.

---

## 1. Kontext: Was ist Morgendrot?

- **Backend:** Node.js/TypeScript, REST-API unter `/api/command` (POST mit `{ cmd, args }`), weitere Endpoints: `/api/config`, `/api/status`, `/api/current-ids`, `/api/package-id-history`, `/api/connect-addresses`, `/api/chain-reachable`, `/api/ai-copilot`, `/api/ollama-ready`, `/api/list-keys`, `/api/list-tickets`, etc.
- **Domain:** IOTA/Stardust (Rebased) – Messaging, AccessKeys, Tickets, Lock (Schloss), Zahlungs-Trigger, Monitoring. Keine klassische Web-App mit Login; Nutzer bedient eine lokale Instanz (Wallet entsperrt, .env-Konfiguration).
- **Design-Prinzip:** **Formulare + Buttons zuerst**, KI nur als **Nice-to-have** (Expert-Modus „Freie Eingabe“). Jede Aktion soll **sichtbares Feedback** liefern (Erfolg/Fehler unter dem Button, Inbox für Nachrichten, Loading-Zustand).

---

## 2. Oberste Navigation & Start

- **Tabs:** „Alle Projekte“ (Dashboard), „Start ein Projekt“ (Kachel-Grid), dann pro Projekt ein Tab (z. B. „Nachrichten & Chat“, „Schloss & Zugang“).
- **Dashboard „Was möchtest du einrichten?“:** Grid mit **5 Setup-Karten** (nicht 4 – siehe unten). Jede Karte hat: Icon, Titel, Kurzbeschreibung, Button „Start“. Klick auf „Start“ öffnet ein **Popup zur Typ-Auswahl** (z. B. „Privat-Chat“ vs „Pinnwand“), danach wird das gewählte Projekt geöffnet.
- **System & Identität (⚙️ Setup):** Ein Button (z. B. „⚙️ Setup“) öffnet ein Overlay mit: **Netzwerk (RPC_URL)**, **Meine Adresse (MY_ADDRESS)**, **Package-ID (aktuell)**, **App/Version**, Hinweise zu früheren Package-IDs, Buttons „Alle .env anpassen“, „Node prüfen“, „Schließen“.

---

## 3. Die 5 Setup-Karten (Dashboard)

| Karte            | Icon  | Titel                     | Optionen im Popup (Typ wählen)                                                                 |
|------------------|-------|---------------------------|-------------------------------------------------------------------------------------------------|
| Nachrichten & Chat | 💬   | Nachrichten & Chat        | Privat-Chat (verschlüsselt), Pinnwand (Broadcast)                                              |
| Schloss & Zugang | 🔒   | Schloss & Zugang          | Smart-Lock Setup, AccessKey & Event-Ticket (NFT), Zahlungs-Trigger (Ladesäule)                 |
| Überwachung      | 👁️   | Überwachung & Steuerung   | Sensor-Zentrale, Geräte-Monitor, Heartbeat-Sender (dieses Gerät)                               |
| Boss-Modus       | 👑   | Boss-Modus                | Boss-Signer & Maschinen, Pinnwand-Verwaltung                                                   |
| Tresor & Notfall | 🛡️   | Tresor & Notfall          | Lokaler Tresor / On-Chain, Notfall-Löschung                                                    |

---

## 4. Start-Kacheln („Start ein Projekt“)

Wenn der Nutzer den Tab „Start ein Projekt“ wählt, erscheint ein **Kachel-Grid** mit **11 Bereichen**:

| ID               | Titel               | Kurzbeschreibung                                                                 | Icon / Farbe |
|------------------|---------------------|-----------------------------------------------------------------------------------|--------------|
| chat             | Chat mit Freunden   | Schreibe verschlüsselt oder offen                                                 | 💬 green     |
| ticket           | Tickets & Schlüssel | Festival, Gäste, Zugang. Objekt-Ownership, PTB (Key+Nachricht in einer TX)       | 🔑 blue      |
| heimnetzwerk     | Schloss & Tür       | Tür öffnen mit Schlüssel oder Geld                                                | 🔒 purple    |
| sensoralarme     | Sensor-Alarm        | Rauch, Wasser, Einbruch – Alarm!                                                  | 🔔 blue      |
| lieferkette      | Überwachung         | Prüfe Geräte auf Offline                                                          | 👁 purple    |
| heartbeat-geraet | Überwachtes Gerät   | Heartbeat senden – dieses Gerät wird vom Monitor erfasst                          | 📡 teal      |
| zahlung          | Zahlung & Freischaltung | Zahle → Roller/Ladesäule auf. Optional PTB (Key + Nachricht in einer TX)     | 🪙 green     |
| pinnwand         | An alle (Pinnwand)  | Meldung für alle sichtbar                                                         | 📢 purple    |
| vault            | Tresor & Notfall    | Geheime Daten sicher speichern                                                    | 🛡 purple    |
| boss             | Boss-Modus          | Steuere viele Geräte ohne Wallet. PTB: mehrere Aktionen in einer TX (Gas sparen) | 👑 green     |
| env              | .env anpassen       | Alle Parameter in einer Liste                                                     | ⚙ pink      |

Zusätzlich: **Lean Profile** (minimaler Code pro Einsatz) und ggf. **Export** (README + .env herunterladen).

---

## 5. Wizard – 4 Schnell-Kacheln (für KI-Kontext)

Ein Bereich „Wizard – KI pro Kachel“ mit **4 Tiles** (für freie Sprache / Slot-Filling, optional):

| Tile      | Kurzbezeichnung        | Beschreibung                                                                 |
|-----------|-------------------------|-------------------------------------------------------------------------------|
| nachricht | ✉️ Nachricht senden     | Verschlüsselte/Klartext-Nachrichten, Zahlungen (IOTA), Handshake, Connect, Fetch |
| zutritt   | 🔑 Zutritt gewähren     | AccessKeys erstellen, auflisten, übertragen, Notfall-Purge                   |
| tickets   | 🎫 Event/Tickets        | Tickets erstellen, einlösen, auflisten, übertragen, purgen                   |
| rebate    | 🧹 System aufräumen     | Vault sichern, Handshake/Nachricht/Key/Ticket purgen, Notfall-Purge          |

---

## 6. Alle Befehle mit Formularfeldern (Standard-UI)

Jeder Befehl soll als **Formular** mit beschrifteten Inputs und Button **„Ausführen“** umsetzbar sein. Nach Klick: **Loading** (z. B. „Läuft…“), danach **sichtbares Ergebnis** (Erfolg oder Fehlermeldung) unter dem Button.

### 6.1 Nachrichten & Chat

| Befehl        | Formularfelder (Label + Placeholder)                                                                 | Hinweis |
|---------------|-------------------------------------------------------------------------------------------------------|---------|
| /handshake    | Partner-Adresse (0x…)                                                                                 |         |
| /connect      | Adresse (0x… oder leer für .env)                                                                      |         |
| /send         | Nachricht (wird verschlüsselt an alle Partner gesendet)                                               |         |
| /send-plain   | Adresse (0x…), Text (Klartext-Nachricht)                                                               | Klartext im Explorer sichtbar |
| /fetch        | Package-ID (optional/aus Liste), Anzahl (1–100, z. B. 10), Sender (0x… oder leer)                     | Ergebnis in **Inbox** (siehe unten) |
| /set-package-id | Package-ID (0x… 64 Hex)                                                                             |         |
| /transfer-coins | Empfänger (0x…), Betrag (IOTA, z. B. 0.1)                                                           |         |
| /purge-handshake | (keine Felder)                                                                                     | Rebate |
| /vault-save   | (Passwort optional)                                                                                   |         |
| /vault-onchain | (optional)                                                                                          |         |

### 6.2 Zutritt / AccessKey & Tickets

| Befehl                  | Formularfelder                                                                                       |
|-------------------------|------------------------------------------------------------------------------------------------------|
| /create-key             | Lock-/Event-Adresse (Schloss oder Einlass-Gate 0x…), Empfänger-Adresse (0x…), Gültigkeit Tage (optional, z. B. 30) |
| /create-keys            | Lock-Adresse, Empfänger, TTL (Tage), Anzahl (z. B. 50)                                                |
| /create-key-and-notify  | Lock-Adresse, Empfänger, TTL (optional), Nachricht (Klartext)                                        |
| /create-ticket          | Event-ID (0x…), Gültig ab (ms), Gültig bis (ms), Metadata (Hex optional), Empfänger                  |
| /transfer-key           | Key-ID (0x…), Neuer Besitzer (0x…)                                                                   |
| /transfer-ticket        | Ticket-ID, Neuer Besitzer                                                                            |
| /purge-key              | Key-ID (0x…)                                                                                         |
| /emergency-purge-key    | Key-ID (0x…)                                                                                         |
| /use-ticket             | Ticket-ID (0x…), Event-ID (0x…)                                                                      |
| /purge-ticket           | Ticket-ID (0x…)                                                                                      |
| /emergency-purge-ticket | Ticket-ID (0x…)                                                                                      |
| /purge-msg              | Nonce (z. B. 123)                                                                                    |
| /list-keys              | Owner (0x… oder leer für MY_ADDRESS)                                                                 |
| /list-tickets           | Owner (0x… oder leer für MY_ADDRESS)                                                                 |

### 6.3 Konfiguration (Toggle oder Setzen)

- Viele Einträge sind **Config-Werte** (z. B. ENABLE_PLAINTEXT_CHANNEL, USE_MAILBOX, ROLE, LOCK_ID, OPEN_COMMAND, OPEN_URL, MONITOR_DEVICES, PAYMENT_TRIGGER_ENABLED, …) mit **Toggle** (An/Aus) oder **Setzen**-Button und optional **Hilfe (?)**.

---

## 7. Spezialbereiche der UI

### 7.1 Inbox (Nachrichten)

- **Obligatorisch:** Ein Bereich **„Posteingang (IOTA Events)“** / **„Nachrichten (letzte N)“** mit:
  - **Überschrift** (z. B. „Posteingang (IOTA Events)“)
  - **Liste** (`<ul>` oder `<div>`) für geholte Nachrichten (Sender, Text, ggf. Klartext-Badge)
  - **Button** „Letzte 20 holen“ (bzw. „🔄 Aktualisieren“)
- Die Daten kommen von der API (`/api/command` mit `cmd: '/fetch'`, `args: ['20']`); Response enthält `messages: [{ sender, text, isPlain? }]`. Diese Liste **muss** in der UI angezeigt werden (kein „ausgeführt“ ohne sichtbare Liste).

### 7.2 Chat-Projekt (Nachrichten & Chat)

- **Säulen-Modell** (optional als Abschnitte): Säule 1 (Anfang & Verbindung), Säule 2 (Partner, Handshake, Connect), Säule 3 (Aktivität: Senden, **Inbox**, Fetch-Buttons), Säule 4 (Vault, Purge, Rebate).
- **Empfänger-Zeile**, **Eingabefeld + Button „Senden“**, Buttons **„Letzte 20“**, **„50“**, **„100“**.
- **Package-ID für Fetch** (Dropdown aus History oder Eingabe).
- Optional: **AI-Copilot** (Eingabe + „Fragen“), nur als **Expert-Option** (Standard: ausgeblendet, Toggle „Freie Eingabe (KI)“).

### 7.3 Monitor (Lieferkette / Überwachung)

- **Tabelle:** Gerät, Status, Zuletzt, Sensor, Purgebar.
- Links: Audit CSV, Audit PDF.
- Konfiguration: Geräte-Adressen, Timeout, Alarm-Webhook, State-Datei, Check-Intervall.

### 7.4 Schloss (Heimnetzwerk)

- Schritte: Identität/Rolle (ROLE=lock), Öffnen-Aktion (OPEN_COMMAND / OPEN_URL), Trigger-Wörter, Bezahlschranke (optional), Offline-Funktion, etc.
- Formulare für /create-key, /list-keys, /purge-key in diesem Kontext.

### 7.5 Zahlung & Trigger

- Konfiguration: PAYMENT_TRIGGER_ENABLED, MIN_IOTA, Webhook, State-Datei.
- Optional: „Key nach Zahlung ausstellen“ (Schloss-Adresse, Empfänger, Tage), Zahlung simulieren, Anleitung.

### 7.6 Boss-Modus

- Rolle (boss/kommandant/arbeiter), Adressen (BOSS_ADDRESS, KOMMANDANT_ADDRESSES, WORKER_ADDRESSES), Berechtigungen (keyIssue, revokeDown, commandDown). Rest wie andere Kacheln, aber mit Hierarchie-Filter.

### 7.7 .env / Einstellungen

- Liste aller Konfigurationskeys mit aktuellem Wert (maskiert), Toggle oder „Setzen“, Hilfe-Button. Gruppierung nach Kategorien (Netzwerk, Package, Wallet, Rolle, Features, Listener, Hardware, Streams, Zahlung, Monitor, Signer, Gas, UI, …).

---

## 8. KI als Nice-to-have

- **Standard:** KI-Bereich **ausgeblendet** (nur Formulare + Buttons sichtbar).
- **Toggle:** „Freie Eingabe (KI) – für Power-User“. Wenn aktiviert: Eingabefeld + „Fragen“-Button, Antwortbereich mit Vorschlag (Befehl + „Ja, ausführen“ / „Nein“). Nach Ausführung: **Ergebnis** (lastCommandResult / lastCommandError) unter dem Vorschlag anzeigen.
- **Wizard-Modal:** Optionales Modal mit 4 Tiles (Nachricht, Zutritt, Tickets, Aufräumen); pro Tile: Eingabe → KI schlägt Befehl vor → „Ja, ausführen“ → gleiches Feedback wie oben.

---

## 9. Technische Anforderungen

- **API-Basis-URL:** konfigurierbar (z. B. `http://127.0.0.1:3342`).
- **Befehl ausführen:** `POST /api/command` mit `{ cmd: string, args: string[], silentFetch?: boolean }`. Response: `{ ok, message?, error?, messages? }`. Bei `/fetch` und `ok`: `messages` Array für die Inbox.
- **Weitere Endpoints:** GET `/api/status`, GET `/api/current-ids`, GET `/api/config`, GET `/api/package-id-history`, POST `/api/config` (key/value), GET `/api/connect-addresses`, GET `/api/chain-reachable`, GET `/api/list-keys`, GET `/api/list-tickets`, POST `/api/ai-copilot` (message, context, options).
- **Responsive:** Desktop-first, nutzbar auf Tablet.
- **Theming:** Dark/Light oder System; klare Kontraste, lesbare Schrift.
- **Barrierefreiheit:** Semantisches HTML, Labels für Inputs, Fokus-States, ggf. aria-label für Listen (z. B. Inbox).

---

## 10. Konkreter Generierungs-Prompt (für v0.dev / Builder.io)

**Kurzversion zum Copy-Pasten:**

```
Erstelle ein modernes, responsives Dashboard für eine lokale IOTA-Messaging- und Zugangskontroll-App (Morgendrot).

- Start: Überschrift „Was möchtest du einrichten?“ und 5 Karten im Grid:
  1) Nachrichten & Chat (💬) – Optionen: Privat-Chat, Pinnwand
  2) Schloss & Zugang (🔒) – Optionen: Smart-Lock, AccessKey & Ticket, Zahlungs-Trigger
  3) Überwachung (👁️) – Optionen: Sensor-Zentrale, Geräte-Monitor, Heartbeat-Sender
  4) Boss-Modus (👑) – Optionen: Boss-Signer, Pinnwand-Verwaltung
  5) Tresor & Notfall (🛡️) – Optionen: Lokaler Tresor, Notfall-Löschung

Jede Karte: Icon, Titel, Kurzbeschreibung, Button „Start“. Klick öffnet Popup zur Typ-Auswahl, danach Projektansicht.

- Projekt „Nachrichten & Chat“ enthält:
  - Formular „Nachricht senden“: Empfänger (0x…), Text, Button „Senden“
  - Bereich „Posteingang (IOTA Events)“: Überschrift, leere Liste, Button „Letzte 20 holen“
  - Formulare für Handshake (Partner 0x…), Connect, Fetch (Anzahl, optional Sender), Set Package-ID, Transfer Coins (Empfänger, Betrag)
  - Jedes Formular: klare Labels, Placeholders, Button „Ausführen“; nach Klick Loading („Läuft…“), darunter Ergebnis (Erfolg/Fehler)

- Projekt „Zutritt gewähren“ (Schlüssel & Tickets):
  - Formulare: Create Key (Lock-Adresse, Empfänger, Tage), Create Keys (Lock, Empfänger, TTL, Anzahl), Transfer Key (Key-ID, Neuer Besitzer), Purge Key (Key-ID), List Keys (Owner optional)
  - Create Ticket (Event-ID, Gültig ab/bis ms, Metadata, Empfänger), Use Ticket, Transfer Ticket, Purge Ticket, List Tickets

- Projekt „System aufräumen“ (Rebate): Vault sichern, Purge Handshake, Purge Message, Purge Key/Ticket mit Objekt-ID

- Oberer Bereich: Button „⚙️ Setup“ öffnet Overlay mit: Netzwerk (RPC), Meine Adresse, Package-ID, Version, „.env anpassen“, „Node prüfen“

- Design: Tailwind + Shadcn (oder vergleichbar), dunkles Theme optional, klare Typografie, Karten mit Hover, Formulare mit konsistenten Abständen und Fehleranzeige unter Buttons.
```

---

## 11. Zusammenfassung der Kernforderungen

1. **Formulare zuerst:** Jeder Befehl über beschriftete Inputs + „Ausführen“, kein Zwang zur freien Sprache.
2. **Inbox zwingend:** Bereich „Posteingang (IOTA Events)“ mit Liste + „Letzte 20 holen“; Inhalt = Response von `/fetch`.
3. **Feedback überall:** Nach jeder Ausführung sichtbares Ergebnis (Erfolg/Fehler) unter dem Button, bei Fetch zusätzlich Inbox befüllen.
4. **KI optional:** Toggle „Freie Eingabe (KI)“; Standard aus, nur bei Aktivierung Eingabe + Vorschlag + „Ja, ausführen“.
5. **5 Dashboard-Karten + 11 Start-Kacheln** wie oben; Wizard mit 4 Tiles optional.
6. **API-Anbindung:** Alle Aktionen über REST (`/api/command` etc.); keine Annahme über Backend-Sprache/Framework im Frontend.

Mit diesem Prompt kann eine UI-KI ein neues Frontend (z. B. React + Tailwind + Shadcn) vorschlagen, das alle Kacheln und Funktionen abdeckt und die genannten UX-Prinzipien einhält.
