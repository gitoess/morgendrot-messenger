# Wie geht das Ding ohne Internet?

## 1. Was bedeutet „offline“?

**„Offline“ heißt:**

- Kein WLAN
- Kein Mobilfunk
- Kein Zugang zur IOTA-Kette (RPC_URL nicht erreichbar)

**Trotzdem soll das System weiterarbeiten, z. B.:**

- Tür öffnen
- Alarm melden
- Status speichern
- Später synchronisieren, wenn Netz wieder da ist

---

## 2. Was Rebased / IOTA nicht offline kann

Rebased (wie jede echte Blockchain) braucht eine Verbindung zur Kette, um:

- Transaktionen zu senden (open, purge, create_key, Zahlung)
- Objekte zu prüfen (hasValidAccessKey, hasValidTicket)
- Events zu lesen (Nachrichten, Heartbeat)

**Ohne Verbindung zur Kette geht nichts On-Chain** – keine neue Nachricht, kein neuer Schlüssel, keine Live-Prüfung. Rebased alleine ist also nicht offline-fähig; es ist ein online-zentriertes System.

---

## 3. Wie Morgendrot trotzdem offline-fähig wird

Es gibt mehrere Bausteine – von „schon umgesetzt“ bis „möglich, aber mit Aufwand“.

---

### Möglichkeit A – Offline-Cache für AccessKeys (bereits umgesetzt)

**So funktioniert es im Code:**

- Wenn ein Sender **online** einen gültigen AccessKey hat → die App speichert ihn **im Speicher** (RAM) mit Ablaufzeit: `jetzt + OFFLINE_CACHE_TTL_MS`.
- **OFFLINE_OPEN_ENABLED** = true
- **OFFLINE_CACHE_TTL_MS** = z. B. 86400000 (24 Stunden)
- Bei „open“ prüft die App zuerst: Ist die Kette erreichbar?
  - **Ja** → Prüfung on-chain; bei gültigem Key wird wieder gecacht.
  - **Nein** (offline) → Prüfung nur im Cache: „Ist dieser Sender mit Ablaufzeit in der Zukunft eingetragen?“  
  - Ja → Relais/URL sofort ausführen (keine Kette nötig).  
  - Nein → „Kein gültiger Schlüssel im Cache – verweigert.“

**Beispiel:** Du hast einen Schlüssel für 30 Tage. Sobald du einmal online „open“ gemacht hast (oder der Lock deinen Key online geprüft hat), steht deine Adresse 24 Stunden im Cache. Strom/Netz weg → Tür geht trotzdem auf, solange die App läuft und die 24 h nicht um sind.

**Einschränkungen (was „fehlt“ oder anders ist):**

- **Cache nur im RAM:** Nach **Neustart** der App ist der Cache leer. Offline-OPEN funktioniert also nur, wenn die App durchläuft. Nach Neustart ohne Internet: erst wieder online gehen, dann funktioniert der Cache wieder.
- **Optional möglich:** Cache in eine Datei schreiben und beim Start laden (Persistenz) → Offline-OPEN auch nach Neustart, wenn vorher mal online war. (Aktuell nicht implementiert.)
- **used-Flag:** Wenn AccessKeys on-chain als „benutzt“ markiert werden, weiß der Lock offline davon nichts; er verlässt sich auf die Zeit (validUntil). Für reine TTL-Keys ohne „used“ ist das unkritisch.

**Aufwand für Persistenz:** ca. 1–2 Stunden (Cache in Datei schreiben/laden, TTL weiter prüfen).

---

### Möglichkeit B – Streams als Offline-Puffer (mittelschwer, sehr mächtig)

**Idee:**

- Streams-Kanäle sind append-only und können lokal gepuffert werden.
- Gerät (z. B. Heltec) ohne Netz → puffert Befehle lokal.
- Netz wieder da → gepufferte Befehle werden gesendet.
- Schloss empfängt Befehle per Streams (oder über Bridge).

**Beispiel:** Roboter sendet „open“ → kein Netz → puffert lokal → Netz wieder da → Schloss bekommt Befehl → öffnet.

**Was dafür fehlt / nötig ist:**

- Echter Streams-Client auf Gerät (Heltec/ESP32) oder HTTP-Fallback zur Bridge.
- Lokaler Puffer (Queue auf dem Gerät).
- Synchronisation nach Offline-Zeit.

**Aufwand:** ca. 5–15 Stunden (Streams + Puffer).

---

### Möglichkeit C – Meshtastic / LoRa als Offline-Brücke (sehr mächtig, Hardware nötig)

**Idee:**

- Geräte (Schloss, Sensor, Handy) haben LoRa-Modul (Heltec, LilyGo, RAK).
- Mesh-Netz: Nachricht springt von Gerät zu Gerät (1–10 km, durch Wände).
- Kein Internet nötig – nur Funk.
- Morgendrot auf Pi/PC hört per MQTT oder Serial auf Meshtastic.

**Beispiel:** Internet weg → Sensor meldet „Einbruch!“ per Funk → Heltec im Wohnzimmer → Pi → Sirene + Telegram-Alarm.

**Was fehlt / nötig ist:**

- Meshtastic-Integration (MQTT-Listener).
- Parser für Befehle („open“, „alarm“).
- Optional: Status-OLED auf Heltec.

**Aufwand:** ca. 6–12 Stunden + 20–40 € pro Heltec.

**Hinweis:** Unter `lora-bridge/` gibt es bereits eine HTTP-Bridge (Morgendrot ↔ LoRa/Meshtastic). Siehe `lora-bridge/README.md`. **Notfall-Payload-Format (App-E2EE, Transport getrennt):** `lora-bridge/src/emergency-envelope.ts` und README-Abschnitt „Notfall-Umschlag v1“.

#### Meshtastic & Handy: Kurzüberblick (Abgleich mit Morgendrot)

| Thema | Meshtastic (Gerät/Firmware) | Morgendrot (IOTA / Vault / Bridge) |
|--------|------------------------------|-------------------------------------|
| **Handy-App** | Nicht zwingend: Web-Client (z. B. client.meshtastic.org) per USB/BT am PC, oder Gerät mit Display/Tasten. | Morgendrot-UI (Next) ist unabhängig; Funkweg geht über Node ↔ Bridge oder später natives Plugin. |
| **Gruppenkanal** | Symmetrisch: gemeinsamer **PSK** auf dem Kanal; wer den Key hat, liest mit. Key **nie** auf öffentlichen Standardkanälen (z. B. LongFast). | Zusätzlich: sensible Inhalte für **Morgendrot** idealerweise als **App-Ciphertext** (Schlüssel aus **online** IOTA-Handshake im Vault), siehe Emergency-Envelope `b`. |
| **DM 1:1 (Firmware ≥ 2.5)** | Transport-Schicht mit Public-Key-/TOFU-Logik; Details firmware- und clientabhängig. | **Identität „Tom“ für Morgendrot** = **IOTA-Adresse + Vault-Binding**, nicht nur Funkname. Backend: `meshNodeId` / `meshPublicKeyHex` in Kontakten, `GET /api/mesh-contact-lookup?nodeId=!…`, Mesh-Export `POST /api/contact-mesh-export-encrypted` (nur Metadaten, AES-GCM+scrypt). |
| **Schlüssel an Partner ohne Internet** | PSK oder Kanal-Link per **DM** an die **Node-ID** (nicht nur an einen frei wählbaren Namen); Reichweite = Mesh, typisch **hunderte Meter bis einige km**, stark von Gelände/Antenne/SF abhängig (keine feste „5 km“-Garantie). | Erster **kryptografischer** Anker oft **online** (IOTA); Funk dient als **Notfall-Transport** gemäß `emergency-envelope` / Bridge. |
| **„Wer ist Tom?“** | Anzeigename ist **selbst gewählt**; eindeutig ist die **Node-ID** (`!…`). TOFU: erst gesehener Key wird oft „festgepinnt“ – genaue Warn-UX („Key changed“) **clientabhängig**. | **Out-of-Band-Verifikation** (z. B. Kontrollfrage, geteiltes Geheimnis) bleibt sinnvoll; danach optional privaten Kanal per DM teilen. |

**Wichtig:** Meshtastic-Verschlüsselung (Kanal/DM) und **Morgendrot-E2EE** sind **zwei Schichten**. Für maximale Klarheit: online IOTA-Handshake → Vault speichert Kontext → über Funk nur noch Umschlag mit `f` (Absender-Fingerprint) und `b` (Ciphertext).

**Operative Notfall-Erwartung:** Wen ihr im Ernstfall **wirklich** erreicht (Team vs. 112 vs. Fremd-Mesh) und welche **Brücken** realistisch sind — siehe **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`**.

---

### Möglichkeit D – Offline-Queue (lokale Datei als Befehlseingang) – bereits umgesetzt

**So funktioniert es:**

- **OFFLINE_QUEUE_FILE** = Pfad zu einer Datei (z. B. `.morgendrot-offline-queue`).
- Ein **anderes Programm oder Gerät** (z. B. Skript, Heltec über Serial, LoRa-Bridge) schreibt Zeilen in diese Datei.
- Format pro Zeile: `{"sender":"0x…","cmd":"open","nonce":123}`.
- Der Lock liest die Datei in einer Schleife (alle paar Sekunden), prüft pro Zeile:
  - Replay-Schutz (nonce),
  - AUTHORIZED_SENDERS (falls gesetzt),
  - **hasValidAccessKeyOrCached** (also on-chain oder aus dem Offline-Cache).
- Bei gültigem Befehl → OPEN ausführen.

**Das ist kein „Puffer für ausgehende Befehle“**, sondern ein **lokaler Eingang**: Befehle kommen von außen in die Datei (z. B. von einem Gerät ohne direkten Chain-Zugang). Der Lock kann dabei offline sein – er nutzt dann nur den Cache (Möglichkeit A) für die AccessKey-Prüfung.

**Beispiel:** Heltec empfängt per LoRa „open“ von einem Key-Holder → schreibt eine Zeile in die Offline-Queue-Datei auf dem Pi → Lock liest die Datei, prüft Sender im Cache → Tür auf.

---

### Möglichkeit E – Reine lokale Regeln (keine Kette, kein Streams)

**Idee:**

- Alle Keys und Regeln nur lokal (z. B. Vault / eigene Datei).
- „open“ kommt per Bluetooth oder WiFi-Direct → App prüft lokal (Key gültig? Zeit ok?) → Relais schaltet.
- Keine Chain-Prüfung → 100 % offline.

**Beispiel:** Handy ohne Netz → Bluetooth zum Schloss → Schloss prüft lokal gecachten Key → Tür auf.

**Was fehlt:**

- Bluetooth- oder WiFi-Direct-Integration in Morgendrot.
- Explizite „rein lokale“ Prüf-Logik (hasValidAccessKey nur aus lokaler Liste/Datei, ohne Kette).

**Aufwand:** abhängig von gewählter Technik.

---

## 4. Kurzüberblick

| Möglichkeit | Status | Beschreibung |
|-------------|--------|--------------|
| **A – Offline-Cache** | ✅ umgesetzt | Gültiger Key wird im RAM gecacht; bei Offline nur Cache-Prüfung. Kein Persistenz nach Neustart. |
| **D – Offline-Queue** | ✅ umgesetzt | Lokale Datei als Befehlseingang; Lock prüft mit hasValidAccessKeyOrCached (on-chain oder Cache). |
| **B – Streams-Puffer** | ⚠️ möglich | Puffer auf dem Gerät + Streams; Aufwand 5–15 h. |
| **C – Meshtastic/LoRa** | ⚠️ möglich | LoRa-Bridge + Notfall-Umschlag v1 (`lora-bridge/`); vollständige Meshtastic-Client-Integration + Parser nach Bedarf. |
| **E – Nur lokal** | ❌ nicht umgesetzt | Bluetooth/WiFi-Direct + rein lokale Key-Prüfung fehlen. |

**Sinn der Aussagen:** Die Einordnung „Rebased braucht immer Kette“ und „Offline heißt: kein Zugang zur Kette“ ist korrekt. Möglichkeit A ist bereits implementiert (Cache im RAM, kein „muss noch geschrieben werden“). Die Offline-Queue (D) ist ein lokaler Befehlseingang, der zusammen mit dem Offline-Cache sinnvoll „ohne Internet“ genutzt werden kann.
