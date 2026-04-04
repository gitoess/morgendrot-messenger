# Provisioning & „Code erzeugen“ – logischer Plan (UI, Rollen, Schritte)

**Ziel:** Morgendrot ist die **Boss-UI** (Coins, Nachrichten, Rebate, Geräte versorgen). Leere Maschinen/Türschlösser bekommen **passgenau erzeugte Konfiguration** („Code erzeugen“), damit sie ihrer Rolle gemäß arbeiten – ohne dass jede kleine Maschine den vollen Stack braucht. Alle Schritte logisch durchgeplant, alle Parteien durchgedacht.

---

## 1. Was das Projekt kann (Ist-Stand)

### 1.1 Technologie & Einsatzorte

| Bereich | Was das Projekt kann | Wo eingesetzt |
|--------|----------------------|---------------|
| **IOTA Rebased** | RPC, Objekte (Vault, Mailbox, AccessKey, Ticket), PTB, signAndExecute, Sponsored TX. | `chain-access.ts`, Move-Package `move-test/`. |
| **Move** | VaultRegistry, Mailbox, CommandRegistry, AccessKey, Ticket, use_ticket, purge_*, create_globals. | Smart Contracts; Deployment über API/CLI. |
| **Boss-UI** | Coins senden, Nachrichten, Keys/Tickets erstellen, Rebate (purge), Geräte verwalten, **Code ausgeben** (nur Arbeiter + Kommandant). | Lite-UI: Steuerung, Nachrichten, Lock (Keys/Tickets), Rebate, Setup, **Code ausgeben** (Schritte 1–3). |
| **Rollen** | `boss`, `kommandant`, `arbeiter`, `lock`, `monitor`, `messenger` (Rest). | `config.ts` ROLE; Hierarchy (BOSS_ADDRESS, KOMMANDANT_ADDRESSES, WORKER_ADDRESSES). |
| **Vault** | ECDH-Keys + optional Streams Anchor-ID; `/vault-save`, `/vault-onchain`. | Kommandant/Boss/Lock je nach Bedarf; siehe PROVISIONING-PLAN. |
| **Streams** | Heartbeat, optional OPEN/Befehle; HTTP-Bridge (Mock/LoRa). | Monitoring, Lock, Arbeiter; STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL. |
| **Tickets** | create_ticket, use_ticket (inkl. Sponsor), list-tickets, purge-ticket, transfer-ticket. | Boss erstellt; **Wärter** entwertet (use_ticket); **User** bekommt nur NFT/QR. |

**Rebased-Abgleich:** Das Projekt nutzt die Rebased-API (RPC, Objekte, PTB) wie in `@iota/iota-sdk` und den Move-Modulen abgebildet. Eine zentrale „Rebased-Dokumentation“ liegt nicht im Repo; die Semantik (Vault pro Owner, Mailbox, AccessKey, Ticket) ist im Move-Code und in `chain-access.ts` definiert. Für exakte API-Version: IOTA/GitHub (iotaledger) und ggf. Rebased-Release-Notes prüfen.

### 1.2 „Code erzeugen“ heute

- **Ort:** Steuerung → **Code ausgeben (Geräte-Provisioning)** (3 Schritte).
- **Rollen in der UI:** nur **Arbeiter** und **Kommandant** (Dropdown).
- **Ausgabe:** `.env`-Text (buildDeviceEnv), JSON (buildDeviceJson), QR (buildQrPayload).
- **Inhalt der .env:** RPC_URL, ROLE, ROLE_ID, MY_ADDRESS (optional), WALLET_MNEMONIC (optional), PACKAGE_ID, BOSS_ADDRESS, KOMMANDANT_ADDRESSES / WORKER_ADDRESSES, LOCK_ID, OPEN_COMMAND, CLOSE_COMMAND, ENABLE_HEARTBEAT, HEARTBEAT_INTERVAL_MS, SIGNER, REMOTE_SIGNER_URL, ENABLE_UI, ENABLE_PURGE, ENABLE_REPLAY_PROTECTION, ENABLE_PLAINTEXT_CHANNEL.
- **Fehlt in der generierten .env:** STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, VAULT_FILE, VAULT_REGISTRY_ID, MONITOR_DEVICES, MAILBOX_ID, COMMAND_REGISTRY_ID, Ticket-/Wärter-spezifische Werte.
- **Kein abgespeckter Code:** Es wird **kein** anderes Binary gebaut – nur **Konfiguration** (.env/JSON/QR). Jede Instanz = gleicher Morgendrot-Code, Unterschied = **.env** (ROLE, ROLE_ID, Features).

---

## 2. Alle Parteien – wer braucht was?

### 2.1 Boss (bereits umgesetzt)

- **Rolle:** Oberste Instanz.
- **Braucht:** Volles Morgendrot (UI + Backend), Wallet, optional Vault.
- **Macht:** Coins senden, Nachrichten, Keys/Tickets erstellen, Rebate, Geräte eintragen, **Code ausgeben** für alle anderen Rollen, Überwachung.
- **Code erzeugen:** Nicht nötig – Boss nutzt die bestehende App.

### 2.2 Kommandant (Hierarchie-Mitte)

- **Rolle:** Zwischen Boss und Arbeiter/Lock; Befehle weiterleiten, überwachen.
- **Braucht:** Fast vollen Code, **eingeschränkte Optionen** (.env): ROLE=kommandant, ROLE_ID≥14, BOSS_ADDRESS, WORKER_ADDRESSES, **VAULT_FILE** (immer), STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, optional ENABLE_MONITOR.
- **Macht:** Befehle von Boss empfangen, an Arbeiter weiterleiten, Überwachen, ggf. Heartbeat; Anchor-ID und Keys im Vault persistieren (`/vault-save`).
- **Verhalten:** Hören + Befehle weitergeben + optional Erfolg/Status melden. **Nicht** dasselbe wie Wärter (siehe unten).

### 2.3 Arbeiter (Maschine, Sensor)

- **Varianten (logisch):**
  - **Nur hören, stumm:** Befehle empfangen, keine Antwort (RoleID z. B. 12 = nur L).
  - **Hören + Heartbeat:** Befehle empfangen, Lebenszeichen senden (RoleID 14+ mit S-Bit).
  - **Hören + Befehle weitergeben + Erfolg melden:** ähnlich Kommandant, aber weniger Rechte (kein Key-Issue, kein Vault-Schreiben typisch).
- **Braucht:** Gleicher Code, **passgenau .env**: ROLE=arbeiter, ROLE_ID 12 oder 14, BOSS_ADDRESS, KOMMANDANT_ADDRESSES, STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, ENABLE_HEARTBEAT; **kein Vault** für reine Heartbeat-Maschine; Vault nur wenn verschlüsselte Rückmeldung nötig.

### 2.4 Türschloss / Lock (M2M)

- **Rolle:** physisches Gerät (Tor, Schranke, Schrank).
- **Braucht:** ROLE=lock, LOCK_ID, OPEN_COMMAND (oder OPEN_URL), BOSS_ADDRESS (oder AUTHORIZED_SENDERS), optional Streams, Replay-State, optional Vault (wenn verschlüsselte OPEN-Befehle).
- **Macht:** Hört auf OPEN, prüft AccessKey/Ticket, führt OPEN_COMMAND aus; optional Heartbeat.
- **Code erzeugen:** .env für **Lock** – heute **nicht** im Wizard als Rolle wählbar.

### 2.5 Monitor (nur Überwachung)

- **Rolle:** Nur Zuschauer.
- **Braucht:** ROLE=monitor (oder ENABLE_MONITOR=true), MONITOR_DEVICES, STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, MONITOR_STATE_FILE, optional MONITOR_ALARM_WEBHOOK_URL.
- **Macht:** Liest Heartbeats, prüft Offline, löst Webhook aus. **Kein Senden.**
- **Code erzeugen:** .env für **Monitor** – heute **nicht** im Wizard.

### 2.6 NFT/Tickets – drei verschiedene Parteien

| Partei | Beschreibung | Was sie bekommt | Was sie braucht (Code/Config) |
|--------|--------------|------------------|--------------------------------|
| **Boss (Ersteller)** | Erstellt und vergibt Tickets/Keys. | Volle App (bereits da). | – |
| **User (Käufer/Besucher)** | Hat nur das Ticket/Key als NFT – z. B. Besucher, Festival-Gast. | **Nur NFT/QR** (Objekt-ID, QR-Code, Explorer-Link). **Kein** Morgendrot-Code. | Kein Morgendrot; nur Objekt-ID / QR zum Vorzeigen am Gate. Im Wizard: eigene Kategorie „User (nur NFT/QR)“ – **Ausgabe nur QR/Link, kein .env**. |
| **Wärter (Gate/Einlass)** | Steht am Eingang, scannt/liest Ticket, **entwertet** (use_ticket). | **Morgendrot-Config** (gleicher Code), aber **nur** Ticket-Funktionen: use-ticket, list-tickets. | ROLE=messenger, RoleID 14 (S-Bit für Entwertungs-TX). Optional SPONSOR_GAS_OWNER + SPONSOR_GAS_PASSWORD (Boss zahlt Gas). **Nicht** Kommandant – Kommandant ist Hierarchie-Mitte; Wärter ist reines „Gate“, kein Befehl weiterleiten. |

**Klärung Wärter vs. Kommandant:**

- **Kommandant** = Hierarchie-Rolle: empfängt Befehle von Boss, leitet an Arbeiter/Lock weiter, hat Vault (Anchor-ID, Keys), kann überwachen.
- **Wärter** = **nur** Einlass: liest/scannt Ticket, ruft `/use-ticket` auf (Entwertung). Keine Key-/Ticket-Erstellung, kein Vault nötig (außer wenn Gate verschlüsselt kommunizieren soll). Kann dieselbe Person sein wie ein Kommandant, aber **logisch** sind es zwei verschiedene **Rollen** im System: einer „führt“ (Kommandant), einer „lässt ein“ (Wärter).

---

## 3. Was „Code erzeugen“ passgenau liefern soll

### 3.1 Pro Rolle nur die nötigen Schritte und Variablen

- **Arbeiter:** .env mit ROLE=arbeiter, ROLE_ID (12 oder 14), BOSS_ADDRESS, KOMMANDANT_ADDRESSES, PACKAGE_ID, RPC_URL, STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, ENABLE_HEARTBEAT, HEARTBEAT_INTERVAL_MS; optional LOCK_ID/OPEN_COMMAND wenn es eine Tür ist; **kein** VAULT_FILE standardmäßig.
- **Kommandant:** .env mit ROLE=kommandant, ROLE_ID≥14, BOSS_ADDRESS, WORKER_ADDRESSES, PACKAGE_ID, RPC_URL, **VAULT_FILE** (immer), STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, optional ENABLE_MONITOR, MONITOR_DEVICES.
- **Lock:** .env mit ROLE=lock, LOCK_ID, OPEN_COMMAND oder OPEN_URL, BOSS_ADDRESS (oder AUTHORIZED_SENDERS), PACKAGE_ID, RPC_URL, MAILBOX_ID, COMMAND_REGISTRY_ID; optional STREAMS_*, VAULT_FILE wenn verschlüsselte OPEN-Befehle.
- **Monitor:** .env mit ROLE=monitor, MONITOR_DEVICES, STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, MONITOR_STATE_FILE; optional MONITOR_ALARM_WEBHOOK_URL; **kein** MY_ADDRESS nötig wenn nur lesend.
- **Wärter:** .env mit ROLE=messenger, ROLE_ID=14, PACKAGE_ID, RPC_URL, MY_ADDRESS (Wärter-Wallet), optional SPONSOR_GAS_OWNER, SPONSOR_GAS_PASSWORD, SPONSORED_TRANSACTION_ENABLED; **kein** create-key/create-ticket, **kein** Vault standardmäßig.
- **User (nur NFT/QR):** **Kein** .env, **kein** Code. Ausgabe: QR-Code + Explorer-Link für das Ticket/Key-Objekt; Hinweis „Dieser User braucht kein Morgendrot, nur Wallet oder QR zum Vorzeigen.“

### 3.2 UI: „Code erzeugen“-Button und Wizard

- **Rollen im Wizard erweitern:** Nicht nur Arbeiter/Kommandant, sondern Auswahl:
  - Arbeiter (Option: nur Heartbeat / Heartbeat + Befehle ausführen)
  - Kommandant (Vault immer dabei)
  - Lock (Tür/Schrank)
  - Monitor (nur Überwachung)
  - Wärter (Gate – nur Ticket einlösen)
  - User (nur NFT/QR) → **kein** .env, nur QR/Explorer-Link
- **Pro Rolle:** Nur die für diese Rolle relevanten Felder anzeigen (z. B. Lock: LOCK_ID, OPEN_COMMAND; Monitor: MONITOR_DEVICES; Wärter: keine WORKER_ADDRESSES).
- **STREAMS_ANCHOR_ID + STREAMS_BRIDGE_URL** in die generierte .env aufnehmen (aus Boss-CFG oder User-Eingabe im Wizard).
- **Vault:** Kommandant immer VAULT_FILE; Lock/Arbeiter/Wärter optional (Checkbox oder „nur wenn nötig“).

---

## 4. Notwendige Schritte (Reihenfolge)

| # | Schritt | Beschreibung | Priorität |
|---|---------|--------------|-----------|
| 1 | **Rollen im Provisioning-Wizard erweitern** | Dropdown/Auswahl: Arbeiter, Kommandant, **Lock**, **Monitor**, **Wärter (Gate)**, **User (nur NFT/QR)**. Bei User: kein .env, nur QR/Explorer-Link. | Hoch |
| 2 | **DeviceProvisionParams + buildDeviceEnv/buildDeviceJson erweitern** | Neue Rollen: `lock`, `monitor`, `wärter` (als messenger mit RoleID 14), `user` (nur QR – kein env). Pro Rolle nur die relevanten Variablen ausgeben. STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, VAULT_FILE (bei Kommandant immer), MAILBOX_ID, COMMAND_REGISTRY_ID wo nötig. | Hoch |
| 3 | **API /api/provision-device erweitern** | role akzeptieren: `arbeiter`, `kommandant`, `lock`, `monitor`, `wärter`, `user`. Bei `user`: keine .env generieren, nur qrPayload/Explorer-Link für ausgewähltes Ticket/Key. | Hoch |
| 4 | **UI: Schritt 1 – Rollenauswahl** | Alle Rollen anzeigen; bei Lock zusätzlich LOCK_ID, OPEN_COMMAND; bei Monitor MONITOR_DEVICES; bei Wärter kurzer Hinweis „Nur use-ticket, list-tickets“; bei User „Nur NFT/QR – kein Code“. | Hoch |
| 5 | **UI: Schritt 2 – Seed-Methode** | Bei **User (nur NFT/QR)** überspringen oder durch „Ticket/Key auswählen“ ersetzen → Ausgabe nur QR + Link. | Mittel |
| 6 | **UI: Schritt 3 – Export** | Bei User: nur „QR anzeigen“ / „Explorer-Link kopieren“; bei allen anderen: .env, JSON, QR wie bisher. | Mittel |
| 7 | **Kurzer Rollen-Text im Wizard** | Pro Rolle 1–2 Sätze: „Dieses Gerät braucht: …“ (z. B. Kommandant: „Vault, Streams, Befehle weiterleiten.“; Wärter: „Nur Tickets einlösen, optional Boss zahlt Gas.“). | Mittel |
| 8 | **Optional: UI-Filter pro Rolle** | Wenn gleiche Lite-UI für alle läuft: pro ROLE nur die passenden Kacheln anzeigen (z. B. Wärter nur Lock-Kachel mit use-ticket/list-tickets). Bereits teilweise über ROLE denkbar; ggf. ROLE_ID oder neues Flag. | Niedrig |

---

## 5. Offene Punkte / Fragen an dich

1. **Wärter = eigenes Gerät oder dasselbe wie Kommandant?**  
   Wenn der Wärter **dasselbe** Gerät wie der Kommandant ist (eine Person, eine Instanz), reicht eine Rolle „Kommandant mit Ticket-Funktionen“. Wenn der Wärter ein **separates** Gerät am Eingang ist (z. B. nur Tablet zum Scannen), dann brauchen wir **Wärter** als eigene Ausgabe (ROLE=messenger, RoleID 14, nur Ticket-UI). Soll beides möglich sein („Kommandant + Wärter“ kombiniert vs. „nur Wärter“)?

2. **User (nur NFT/QR): Woher kommt die Objekt-ID?**  
   Für „User bekommt nur QR“ muss der Boss zuerst ein Ticket (oder Key) erstellen und an den User vergeben. Soll der Wizard so funktionieren: „Rolle: User (nur NFT/QR)“ → **Schritt: Ticket/Key auswählen** (z. B. aus zuletzt erstellten oder Eingabe Objekt-ID) → Ausgabe = QR + Explorer-Link für genau dieses Objekt? Oder soll der Boss das Ticket separat erstellen und den QR woanders (z. B. Lock-Kachel „Zuletzt erstellt“) ausgeben?

3. **Lock in der gleichen .env wie Arbeiter?**  
   Heute hat der Arbeiter optional LOCK_ID, OPEN_COMMAND. Soll **Lock** eine **eigene** Rolle im Wizard sein („Türschloss“), die eine reine Lock-.env ausgibt (ohne WORKER_ADDRESSES, mit COMMAND_REGISTRY_ID, MAILBOX_ID), oder reicht „Arbeiter mit LOCK_ID/OPEN_COMMAND“ und wir benennen die Option nur um („Arbeiter (Tür/Schloss)“)?

4. **Rebased-Dokumentation:**  
   Soll im Projekt eine kurze **Referenz** (z. B. `docs/REBASED-MOVE-REFERENZ.md`) angelegt werden, die Objekttypen (Vault, Mailbox, AccessKey, Ticket), Move-Funktionen und die genutzte SDK-Version festhält – für Abgleich mit offizieller Rebased-Doku/GitHub?

5. **Abgespeckte Builds (später):**  
   Soll es irgendwann **feste Templates** (z. B. ZIP „morgendrot-lock-only“, „morgendrot-monitor-only“) geben, oder bleibt es bei **ein Binary, viele .env**?

---

## 6. Kurzfassung

- **Boss-UI** ist da; **Code erzeugen** liefert heute nur **Arbeiter** und **Kommandant** mit .env/JSON/QR; **STREAMS_*** und **Vault** fehlen in der Ausgabe; **Lock, Monitor, Wärter, User (nur NFT/QR)** fehlen als Rollen.
- **Vorgehen:** (1) Rollen im Wizard auf **Lock, Monitor, Wärter, User (nur NFT/QR)** erweitern. (2) **DeviceProvisionParams** und **buildDeviceEnv/buildDeviceJson** pro Rolle anreichern (inkl. STREAMS_*, VAULT wo nötig). (3) API **provision-device** für neue Rollen und für User nur QR/Link. (4) UI-Schritte anpassen (Rollenauswahl, bei User kein .env). (5) Doku und Rollen-Texte im Wizard.
- **Wärter** = Gate, nur use-ticket/list-tickets, ROLE=messenger, RoleID 14; **Kommandant** = Hierarchie-Mitte, Vault, Befehle weiterleiten. Beides kann auf einem Gerät laufen, sind aber logisch verschiedene Rollen.
- Offene Fragen: Wärter getrennt oder kombiniert mit Kommandant; woher User-QR (aus Wizard oder woanders); Lock als eigene Rolle vs. Arbeiter mit LOCK_ID; Rebased-Referenz-Dokument; spätere Lean-Builds.

Wenn du die offenen Punkte (Abschnitt 5) beantwortest, können die Schritte aus Abschnitt 4 1:1 umgesetzt werden.
