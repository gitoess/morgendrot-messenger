# Provisioning-Plan: Rollen, Code erzeugen, passgenau für jede Partei

**Ziel:** Morgendrot ist die **Boss-UI** (Coins, Nachrichten, Rebate, Geräte verwalten). Leere Maschinen/Türschlösser bekommen **abgespeckten** Morgendrot-Code bzw. **passgenau erzeugte Konfiguration** („Code erzeugen“), damit sie ihrer Rolle gemäß arbeiten – ohne dass jede kleine Maschine den kompletten Stack braucht.

---

## 1. Was das Projekt heute kann (Ist-Stand)

### 1.1 Technologie-Stack

| Komponente | Beschreibung |
|------------|--------------|
| **IOTA Rebased** | L1: Chain-Zugriff (RPC), Objekte (Vault, Mailbox, AccessKey, Ticket), PTB (Programmable Transaction Blocks). |
| **Move** | Smart Contracts unter `move-test/`: Vault, Mailbox, CommandRegistry, AccessKey, Ticket, use_ticket, purge, etc. |
| **Node/TypeScript** | `src/`: wallet-bridge, chain-access, m2m-lock, monitoring, streams-adapter, config, crypto, vault-local, replay-state. |
| **Lite-UI** | Ein Tab pro Kachel (Steuerung, Nachrichten, Lock, Überwachung, Streams, Setup, …); API auf API_PORT. |
| **Streams (L0.5)** | Feeless Kanal (Heartbeat, Befehle); optional über HTTP-Bridge (z. B. Mock, LoRa-Bridge). |

**Rebased-Dokumentation:** Das Projekt nutzt Rebased RPC, Move-Package (Deploy), Objekt-Modelle (Vault, Key, Ticket). Ein zentrales „Rebased-Handbuch“ liegt nicht im Repo; die Logik ist in `chain-access.ts`, `config.ts` und den Move-Modulen abgebildet. GitHub: IOTA Rebased Repos (z. B. iotaledger) – für genaue API-Version ggf. aktuelles Rebased-Docs prüfen.

### 1.2 Rollen im Code

| ROLE | Bedeutung | Typische Nutzung |
|------|-----------|------------------|
| **boss** | Oberste Instanz: Geräte verwalten, Befehle senden, Keys/Tickets erstellen, überwachen. | Dashboard, Coins, Nachrichten, Rebate, Provisioning. |
| **kommandant** | Zwischenglied: Senden + Überwachen, Befehle an Arbeiter weiterleiten. | Fast voller Code, eingeschränkte Optionen (.env). |
| **arbeiter** | Führt Befehle aus, sendet Heartbeat/Status. | Maschine, Sensor; mind. RoleID 14 (S-Bit) für Heartbeat. |
| **lock** | M2M-Schloss: hört auf OPEN, prüft AccessKey, führt OPEN_COMMAND/OPEN_URL aus. | Tür, Tor, Schranke. |
| **monitor** | Nur Überwachung: Heartbeats lesen, Offline-Alarm, Webhook. | Separater Rechner oder mit ENABLE_MONITOR in einer Instanz. |
| **messenger** | Chat/Partner; optional Lock/Monitor-Features. | Mensch mit Wallet; Keys/Tickets empfangen. |

### 1.3 Provisioning heute („Code ausgeben“)

- **Ort:** Steuerung → **Code ausgeben (Geräte-Provisioning)** (Schritte 1–3).
- **Ausgabe:** `.env`-Text (buildDeviceEnv), JSON (buildDeviceJson), QR (buildQrPayload).
- **Rollen in der UI:** nur **Arbeiter** und **Kommandant** (kein Lock, kein Monitor, kein „nur User“).
- **Enthalten in buildDeviceEnv:** RPC_URL, ROLE, ROLE_ID, MY_ADDRESS (optional), WALLET_MNEMONIC (optional), PACKAGE_ID, BOSS_ADDRESS, KOMMANDANT_ADDRESSES / WORKER_ADDRESSES, LOCK_ID, OPEN_COMMAND, CLOSE_COMMAND, ENABLE_HEARTBEAT, HEARTBEAT_INTERVAL_MS, SIGNER, REMOTE_SIGNER_URL, ENABLE_UI, ENABLE_PURGE, ENABLE_REPLAY_PROTECTION, ENABLE_PLAINTEXT_CHANNEL.
- **Nicht enthalten:** STREAMS_BRIDGE_URL, STREAMS_ANCHOR_ID (müssen manuell oder separat übergeben werden), VAULT_FILE / VAULT_REGISTRY_ID, MONITOR_DEVICES, Ticket-spezifische Parameter.

**Wichtig:** Es wird **kein anderer/abgespeckter Code** erzeugt – nur **Konfiguration** (.env/JSON/QR). Jede Instanz läuft mit dem **gleichen** Morgendrot-Code; Unterschied macht die **.env** (ROLE, ROLE_ID, Features ein/aus).

---

## 2. Parteien und was sie brauchen (logisch durchgespielt)

### 2.1 Boss (bereits umgesetzt)

- **Braucht:** Volles Morgendrot (UI + Backend), Wallet, Vault optional, Rechte (D-Bit etc.).
- **Macht:** Coins senden, Nachrichten, Keys/Tickets erstellen, Rebate, Geräte eintragen, **Code ausgeben** für Kommandant/Arbeiter/Lock, Überwachung (MONITOR_DEVICES, Geräte-Status).
- **Code erzeugen:** Nicht nötig – Boss nutzt die bestehende App.

### 2.2 Kommandant

- **Braucht:** Fast vollen Code, aber **eingeschränkte Optionen** (kein D-Bit, kein Key-Issue; S+L+BW für Senden/Überwachen). **Vault: zwingend Lesen + Schreiben** (siehe Vault-Definition unten).
- **Macht:** Befehle von Boss empfangen und an Arbeiter weiterleiten, Überwachen, ggf. Heartbeat senden; Anchor-ID und Keys im Vault persistieren (`/vault-save`).
- **Code erzeugen:** Gleicher Code wie Boss, **.env passgenau**: ROLE=kommandant, ROLE_ID≥14, BOSS_ADDRESS, WORKER_ADDRESSES, STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, **VAULT_FILE** (immer), ENABLE_MONITOR optional, ENABLE_UI=true/false je nach Einsatz.

**Entscheidung:** Kommandant hat immer vollen Vault-Zugriff (Lesen + Schreiben), damit er Streams Anchor-ID und Messaging-Keys sicher ablegen und wiederherstellen kann.

### 2.3 Arbeiter (Maschine, Sensor)

- **Varianten:**
  - **Nur hören, stumm (ID 12):** Befehle empfangen, keine Antwort (kein Heartbeat). Reiner Befehlsempfänger.
  - **Hören + Heartbeat (ID 14+):** Befehle empfangen, Lebenszeichen senden (S-Bit nötig).
  - **Hören + Befehle weitergeben + Erfolg melden:** Kommandant-ähnlich, aber mit weniger Rechten.
- **Braucht:** Minimaler Code oder gleicher Code mit **stark abgespeckter .env**: ROLE=arbeiter, ROLE_ID 12 oder 14, BOSS_ADDRESS, KOMMANDANT_ADDRESSES, STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, ENABLE_HEARTBEAT, LOCK_ID/OPEN_COMMAND wenn Tür. **Kein Vault** für reine Heartbeat-Maschine; **Vault** nur wenn verschlüsselte Rückmeldung nötig.
- **Code erzeugen:** .env (und optional QR) **passgenau**: nur die Keys, die diese Variante braucht (z. B. ohne VAULT_FILE, ohne ENABLE_UI wenn Headless).

### 2.4 Türschloss / Lock

- **Braucht:** ROLE=lock, LOCK_ID, OPEN_COMMAND (oder OPEN_URL), BOSS_ADDRESS (oder AUTHORIZED_SENDERS), Streams optional (OPEN_STREAMS_ENABLED), Replay-State, ggf. Vault für verschlüsselte OPEN-Befehle.
- **Macht:** Hört auf OPEN, prüft AccessKey/Ticket, führt OPEN_COMMAND aus; optional Heartbeat.
- **Code erzeugen:** .env für **Lock** (heute nicht in der UI als Rolle wählbar) – gleicher Code, Lock-spezifische Konfiguration.

### 2.5 Monitor (nur Überwachung)

- **Braucht:** ROLE=monitor oder ENABLE_MONITOR=true, MONITOR_DEVICES, STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, MONITOR_STATE_FILE, MONITOR_ALARM_WEBHOOK_URL optional.
- **Macht:** Liest Heartbeats vom Kanal, prüft Offline, löst Webhook aus.
- **Code erzeugen:** .env für **Monitor** (reiner Zuschauer) – kein Senden, nur Lesen.

### 2.6 NFT/Tickets – drei Parteien

| Partei | Was sie bekommt | Was sie braucht (Code/Config) |
|--------|------------------|-------------------------------|
| **Boss (Ersteller)** | Volle App. Erstellt Keys/Tickets, vergibt an User/Gates. | Bereits vorhanden. |
| **User (Käufer/Besucher)** | Nur **NFT/QR** (Key oder Ticket) – z. B. in Wallet-App oder als QR-Code. **Kein** Morgendrot-Code. | Kein Morgendrot; nur Objekt-ID / QR zum Vorzeigen am Gate. Im Wizard als eigene Kategorie mit **keinem** Code-Output, nur QR/Explorer-Link. |
| **Wärter (Gate/Einlass)** | Liest/scannt Ticket, **entwertet** (use-ticket). | **ROLE=messenger**, **RoleID 14** (BW+L+S): Standard-Binary, UI zeigt nur Ticket-Funktionen (use-ticket, list-tickets). S-Bit erlaubt Senden der Entwertungs-TX. Keine eigene ROLE=gate. Optional: SPONSOR_GAS_OWNER=Boss, damit Boss Gas zahlt (aktuell use_ticket ohne Sponsor – siehe PROVISIONING-KRITIK-UND-VAULT-DEFINITION.md). |

**Entscheidung:** Wärter = messenger mit ID-14-Vorlage; Ticket-User explizit im Wizard, Ausgabe nur QR/Link (kein config).

---

## 3. Vault-Definition (klar, einheitlich)

**Vault** = sicherer Speicher (lokal: VAULT_FILE, optional on-chain: VAULT_REGISTRY_ID) für:
- **ECDH-Messaging-Keys** (Handshake/Chat mit Partnern),
- optional **Streams Anchor-ID** (Sidecar, verschlüsselt),
- Kontext **Package-ID** (Sidecar, Klartext).

Der Vault ist **kein** „Filter“ für Purge: purge-handshake / purge-msg / purge-key / purge-ticket löschen konkrete Objekte (nach ID/Nonce); es gibt keine Logik „Inhalt des Vaults bleibt bei Purge erhalten“. Kommandant braucht Schreibzugriff, um Anchor-ID und Keys mit `/vault-save` zu **persistieren** (nicht „vor Purge schützen“). Siehe **PROVISIONING-KRITIK-UND-VAULT-DEFINITION.md**.

---

## 4. Vault: Wer liest/schreibt?

| Partei | Vault lesen | Vault schreiben/speichern |
|--------|-------------|----------------------------|
| **Boss** | Ja (Nachrichten entschlüsseln, Keys speichern). | Ja (vault-save, vault-onchain). |
| **Kommandant** | Ja (wenn verschlüsselt mit Boss/Arbeitern). | Optional (wenn er selbst Nachrichten verschlüsselt sendet). |
| **Arbeiter** | Nur wenn verschlüsselte Rückmeldung. | Eher nein (nur Heartbeat/Klartext). |
| **Lock** | Ja (verschlüsselte OPEN-Befehle entschlüsseln). | Nein (nur Empfang). |
| **Monitor** | Nein. | Nein. |
| **User (NFT)** | Kein Morgendrot. | – |
| **Wärter** | Optional (wenn Gate verschlüsselt kommuniziert). | Eher nein. |

**Konsequenz für „Code erzeugen“:** Kommandant **immer** VAULT_FILE (und optional VAULT_REGISTRY_ID). Bei Arbeiter/Lock/Monitor/Wärter: Vault nur wenn nötig (z. B. Lock für verschlüsselte OPEN-Befehle); sonst weglassen.

---

## 5. „Code erzeugen“ – was fehlt heute, was soll passgenau sein?

### 5.1 Heute

- **Button „Code ausgeben“** erzeugt nur **Arbeiter** und **Kommandant** (2 Rollen).
- **Inhalt:** buildDeviceEnv baut feste Zeilen; **STREAMS_ANCHOR_ID**, **STREAMS_BRIDGE_URL** fehlen in der generierten .env (User muss sie manuell eintragen oder aus anderem Schritt übernehmen).
- **Lock, Monitor, „nur User“, Wärter** sind **nicht** als eigene Auswahl im Wizard.
- **Kein abgespeckter Code:** Es wird **kein** anderes Binary/Tarball erzeugt – nur Konfiguration. „Abgespeckt“ heißt aktuell: **dieselbe Codebasis**, andere .env (ENABLE_UI=false, ROLE=lock, etc.).

### 5.2 Gewünscht (dein Wunsch)

1. **„Code erzeugen“-Button** (evtl. umbenennen oder erweitern): Ausgabe **passgenau** für die gewählte **Rolle** und **Einsatzart**.
2. **Rollen im Wizard erweitern:** Nicht nur Arbeiter/Kommandant, sondern z. B.:
   - **Arbeiter** (wie heute; Option: nur Heartbeat / Heartbeat + Befehle ausführen).
   - **Kommandant** (wie heute; Option: Vault ja/nein).
   - **Lock** (Tür/Schrank): LOCK_ID, OPEN_COMMAND, BOSS_ADDRESS, Streams, optional Heartbeat.
   - **Monitor** (nur Überwachung): MONITOR_DEVICES, STREAMS_*, MONITOR_STATE_FILE.
   - **Wärter (Gate):** Nur Einlass – use-ticket, list-tickets; keine Key/Ticket-Erstellung.
   - **User (nur NFT/QR):** Kein Code – nur Hinweis „User bekommt nur NFT/QR (Wallet oder ausgestellt als QR)“; kein Morgendrot auf dem Gerät.
3. **Pro Rolle nur die nötigen Keys** in der .env (und in JSON/QR): z. B. Lock ohne ENABLE_HEARTBEAT wenn nicht gewünscht; Monitor ohne MY_ADDRESS wenn nur lesend; Wärter ohne create-key/create-ticket.
4. **Optionale „abgespeckte“ Distribution:**  
   - **Variante A (minimaler Aufwand):** Weiter nur **.env + JSON + QR** ausgeben; gleicher Code überall; Unterschied nur Konfiguration.  
   - **Variante B (später):** Feste **Templates** (z. B. Lock-only-Build, Monitor-only) als ZIP/Tarball zum Download – **ohne** dynamische Code-Generierung aus User-Input (Sicherheit: keine Template-Injection). README §16 Lean Layer nennt bereits Lock-only, Monitor, etc.

### 5.3 Getroffene Entscheidungen (Kurz)

- **Kommandant Vault:** Immer Lesen + Schreiben (Persistenz von Anchor-ID und Keys).
- **Wärter:** ROLE=messenger, RoleID 14; keine ROLE=gate; UI nur Ticket-Funktionen.
- **Abgespeckter Code:** One Binary, Steuerung über .env/config; keine separaten Builds.
- **Ticket-User:** Explizit im Wizard; Ausgabe = QR/Explorer-Link, **kein** Code.

### 5.4 Konkrete Schritte (Reihenfolge zum Abarbeiten)

| Schritt | Aufgabe | Priorität |
|---------|---------|-----------|
| **1** | **Rollen im Provisioning-Wizard erweitern:** Dropdown/Auswahl: Arbeiter, Kommandant, **Lock**, **Monitor**, **Wärter (Gate)**. „User (nur NFT/QR)“ als reine Info (kein .env). | Hoch |
| **2** | **buildDeviceEnv / buildDeviceJson erweitern:** Pro Rolle nur die relevanten Variablen ausgeben. Für **Lock:** ROLE=lock, LOCK_ID, OPEN_COMMAND, BOSS_ADDRESS, STREAMS_*, ENABLE_HEARTBEAT optional; für **Monitor:** ROLE=monitor, MONITOR_DEVICES, STREAMS_ANCHOR_ID, STREAMS_BRIDGE_URL, MONITOR_STATE_FILE; für **Wärter:** ROLE=messenger (oder neuer Eintrag „gate“?), PACKAGE_ID, RPC_URL, MY_ADDRESS, nur Befehle use-ticket, list-tickets. | Hoch |
| **3** | **STREAMS_ANCHOR_ID + STREAMS_BRIDGE_URL** in die generierte .env aufnehmen (wenn Boss bereits einen Kanal hat; aus CFG oder User-Eingabe im Wizard). | Hoch |
| **4** | **Vault:** Kommandant immer VAULT_FILE in Ausgabe; Lock optional (nur lesen); Arbeiter/Monitor/Wärter standardmäßig ohne Vault. | Mittel |
| **5** | **UI: „Code erzeugen“ klar machen:** Kurzer Text pro Rolle („Dieses Gerät braucht: …“); Hinweis bei User: „Nur NFT/QR, kein Morgendrot-Code“. | Mittel |
| **6** | **Wärter:** Kein ROLE=gate; Vorlage ROLE=messenger + RoleID 14; UI nur Ticket-Kachel (use-ticket, list-tickets). Optional: Sponsor für use_ticket (Boss zahlt Gas) – siehe Kritik-Dokument. | Mittel |
| **7** | **Optional – Lean-Builds/Templates:** Feste Ordner (z. B. portable-lock, portable-monitor) oder ZIP aus vordefinierten Dateien (kein User-Input in Code-Generierung) wie in README §16. | Niedrig |

---

## 6. Kritische Prüfung & offene technische Punkte

Siehe **PROVISIONING-KRITIK-UND-VAULT-DEFINITION.md** für:
- exakte **Vault-Definition** (kein Purge-Filter im Code),
- Prüfung der vier Entscheidungen gegen den Code,
- **Lücke Wärter/Gas:** use_ticket nutzt aktuell keinen Sponsor (Boss zahlt nicht automatisch) – entweder Sponsor ergänzen oder dokumentieren, dass Wärter Gas braucht bzw. vom Boss betankt wird.

Die getroffenen Entscheidungen (Kommandant Vault immer, Wärter messenger+14, One Binary, Ticket-User im Wizard mit QR) sind übernommen; die Begründung für den Kommandant-Vault wurde auf „Persistenz von Anchor-ID und Keys“ vereinheitlicht.
