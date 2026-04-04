# IOTA Streams – Integration in Morgendrot

**In einfachen Worten:** Streams ist wie ein **schneller, günstiger Zusatzkanal**. Die normale Kette (Rebased) bleibt für alles Wichtige zuständig: Wer darf was, Schlüssel, Löschen, Zahlung. Streams übernimmt nur den **schnellen Transport** zum Gerät – z. B. „Tür auf“ in unter einer Sekunde, fast ohne Kosten. Du ersetzt also nichts, du ergänzt: Berechtigung und Kontrolle auf der Kette, Übertragung zum Gerät schnell und günstig.

**Wann lohnt sich Streams?** Wenn du Echtzeit brauchst (z. B. Schranke, Roboter-Stopp) oder viele Nachrichten (z. B. Sensordaten) und die normale Kette dafür zu langsam oder zu teuer wäre.

---

Konkret und realistisch: Wie ein **Streams-ähnlicher Kanal** (feeless, niedrige Latenz, metadatenarm) dein bestehendes System **ergänzt**, ohne es zu ersetzen. Wo es eingreift, was weiterhin Rebased macht, und wie du es minimal einbaust.

**Erweiterung (Kanalwahl, DID/Twin, Gas):** **`docs/PROTOCOL-CHANNELS-TX-VS-STREAMS.md`** – wann **TX vs. Streams vs. Audit**, und kritische Einordnung von DID-, Twin- und Gas-Station-Narrativen.

---

## 1. Dein System heute (Kurz)

| Komponente | Rolle |
|------------|--------|
| **Rebased + Move** | Vault, Mailbox, AccessKey, Tickets, Purge – Berechtigung und Speicher on-chain. |
| **ECDH + AES-GCM** | Handshake, Shared Secret, verschlüsselte Nachrichten. |
| **Listener** | Pollt Events (EncryptedMessage, PlaintextMessage), recipient = Lock/Messenger. |
| **M2M Lock** | Open-Words, Replay, AUTHORIZED_SENDERS, hasValidAccessKey → bei Erfolg **executeOpenAction(sender)**. |
| **executeOpenAction** | `OPEN_COMMAND` (spawn) und/oder `OPEN_URL` (GET) – die „letzte Meile“ zum Gerät. |

Stärken: Berechtigung (AccessKey, Whitelist), Purge, Replay-Schutz, eine klare Stelle für die letzte Meile (`OPEN_COMMAND` / `OPEN_URL`).

---

## 2. Schwächen, die Streams abfedern kann

| Schwäche | Streams-Nutzen |
|----------|----------------|
| **Metadaten-Leak** | Sender/Empfänger on-chain sichtbar; bei vielen Polls/Events mehr Tracking. Streams: Kanal-ID statt Adressen, weniger direktes Adress-Tracking. |
| **Latenz** | Rebased: TX + Block/Event-Poll (typ. 1–5 s). Streams: oft < 1 s, gut für „open“ und Heartbeats. |
| **Kosten bei hoher Frequenz** | Viele Nachrichten = viele TXs/Gas. Streams: feeless bzw. nur Anchor-TX alle paar Minuten, skaliert für viele Nachrichten. |

Streams **ersetzt** bei uns weder Handshake, noch AccessKey, noch Purge – es übernimmt dort, wo **Transport** billig und schnell sein soll.

---

## 3. Warum Streams ergänzt (nicht ersetzt)

- **Rebased bleibt** für: Handshake, Shared Secret, Vault, AccessKey-Prüfung, Purge, Zahlungs-Trigger, Berechtigungslogik.
- **Streams (oder Streams-ähnlich)** für: schneller, feeless, metadatenarmer **Transport** für Befehle/Status (z. B. „OPEN“, Heartbeats, Sensor-Streaming).

Kombination = Berechtigung und Kontrolle on-chain, Übertragung zum Gerät günstig und schnell.

---

## 3a. Warum „letzte Meile“ mit Streams?

**Rebased bleibt** für alles Kritische & Sichtbare: Handshake, AccessKey-NFT, Berechtigungs-Prüfung, Zahlung, Purge.

**Streams übernimmt** die schnelle, feeless, private Kommunikation danach: „open“, „status“, „heartbeat“, „bin da“, „lade mit 22 kW“ usw.

| Vorteil | Erklärung |
|---------|-----------|
| **Latenz** | Von 1–10 s (Rebased TX + Poll) auf < 1 s |
| **Kosten** | Fast 0 – nur Anchor-TX einmalig, danach feeless |
| **Metadaten-Schutz** | Kanal-ID statt Sender/Empfänger on-chain; weniger Tracking |
| **Offline-Puffer** | Bridge (z. B. LoRa) kann puffern; Gerät holt nach |

---

## 3b. Konkreter Ablauf (wie es in der Praxis läuft)

### Einmaliger Setup (pro Schloss / Gruppe)

1. **Wallet 1 (Schloss/Gate)** und **Wallet 2 (Nutzer/Auto)** machen normalen ECDH-Handshake auf Rebased.
2. Danach erstellt **Wallet 1** (oder ein Kommandant) einen Streams-Kanal.
3. **Seed für den Kanal:** z. B. aus Handshake abgeleitet oder zufällig.
4. **Anchor-TX auf Rebased** (kleine TX, einmalig).
5. **Nutzer (Wallet 2)** abonniert den Kanal (kennt nur Channel-Address).

### Normalbetrieb

1. **Nutzer sendet „open“ per Streams** (feeless, < 1 s).
2. **Schloss-Listener** empfängt Streams-Nachricht → prüft on-chain (Rebased): AccessKey gültig? Nonce ok?
3. Wenn ja → **OPEN_COMMAND** / **OPEN_URL** ausführen.
4. **Schloss sendet per Streams zurück:** „OPEN GRANTED“, „Tür offen seit 5 s“.
5. **Nutzer sieht Status sofort** (OLED, App, Auto-Display).

### Fallback bei Streams-Ausfall

Wenn Streams nicht geht → **Fallback auf normale Rebased-Nachricht** (verschlüsselt).

| Flag | Bedeutung |
|------|-----------|
| **STREAMS_LISTEN_ENABLED=true** | Lock empfängt „open“ auch von Streams (zusätzlich zu Rebased). |
| **STREAMS_LISTEN_ENABLED=false** | Lock hört nur auf Rebased (EncryptedMessage/PlaintextMessage). |
| **OPEN_STREAMS_ENABLED=true** | Lock sendet nach OPEN GRANTED zusätzlich Status auf Streams-Kanal. |

Rebased und Streams laufen **parallel** – bei Streams-Ausfall nutzt der Nutzer weiterhin verschlüsselte Rebased-Nachricht; Lock prüft weiterhin AccessKey on-chain.

---

## 4. Fünf Varianten – Bewertung für dein Setup

### Variante 1: Streams als „letzte Meile“ (empfohlen)

| Aspekt | Inhalt |
|--------|--------|
| **Wo eingebaut** | Statt oder **zusätzlich** zu `OPEN_COMMAND` / `OPEN_URL`: bei **OPEN GRANTED** eine Nachricht auf einen Streams-Kanal schreiben; Gerät (z. B. Heltec/ESP32) liest den Kanal und schaltet Relais/OLED. |
| **Was Streams übernimmt** | Transport von „OPEN“ (und ggf. kurzen Status) zum Gerät: feeless, < 1 s. |
| **Was Rebased weiter macht** | Handshake, Shared Secret, AccessKey-Prüfung, Replay, Purge, Vault – unverändert in `m2m-lock.ts` (Listener + Validierung). |
| **Vorteile** | Geringe Latenz und Kosten an der letzten Meile; Gerät braucht nur Streams-Client (kein RPC); Metadaten-Schutz am Kanal. |
| **Aufwand** | Mittel: neues Modul „Streams-Client“ (oder Skript), Config (z. B. Kanal/Anchor), Aufruf aus **executeOpenAction** (oder direkt danach). |

**Konkreter Einbau (Code) – umgesetzt:**

- **Config** (`config.ts`): `OPEN_STREAMS_ENABLED` (boolean), `STREAMS_ANCHOR_ID`, `STREAMS_TOPIC`. In der Konfigurationsanzeige und in `.env.example` eingetragen.
- **Stub** (`m2m-lock.ts`): `publishOpenViaStreams(sender)` – wird aus `executeOpenAction(sender)` aufgerufen, sobald `OPEN_STREAMS_ENABLED` und `STREAMS_ANCHOR_ID` gesetzt sind. Aktuell nur Log-Ausgabe; hier die echte Streams-Publish-Logik (z. B. mit @iota/streams oder API-spezifisch) einbauen. Payload z. B. `OPEN` oder `{ command: 'OPEN', sender: '…', ts }`.
- **Stelle:** Nach AccessKey- und Replay-OK ruft der Lock weiterhin `executeOpenAction(sender)` auf; darin laufen nacheinander OPEN_COMMAND, OPEN_URL und `publishOpenViaStreams(sender)`.
- **Abhängigkeit:** IOTA Streams-Repo ist archiviert (Apr 2024); v2.0 war nicht Stardust-kompatibel. Für eine lauffähige Implementierung: Streams auf IOTA-1.x oder ein Rebased-taugliches Streaming-Angebot nutzen; der Stub bleibt die Einbaustelle.

---

### Variante 2: Streams für Sensor-Streaming

| Aspekt | Inhalt |
|--------|--------|
| **Eingbau** | Gerät (Sensor) schreibt Messwerte in einen Streams-Kanal; Pi/PC liest den Kanal. |
| **Streams** | Hohe Frequenz (z. B. Temp, GPS), feeless. |
| **Rebased** | Bei Schwellwert/Alarm eine **einzige** Rebased-TX (z. B. Alarm-Event, Purge, Zugangs-Revoke). |
| **Vorteil** | Skalierung für viele Messwerte; Rebased nur für kritische Aktionen. |
| **Aufwand** | Niedrig–Mittel; eher neues Geräte-Skript + ggf. kleines Aggregator-Skript; Morgendrot-Code kaum geändert (nur wenn du „bei Schwellwert → Rebased-TX“ in der App abbilden willst). |

---

### Variante 3: Streams als Backup-Kanal

| Aspekt | Inhalt |
|--------|--------|
| **Eingbau** | Wenn Rebased-TX oder RPC fehlschlägt (Congestion, Ausfall): Fallback „OPEN“ (oder Status) per Streams senden. |
| **Streams** | Backup-Transport. |
| **Rebased** | Primärkanal; Logik (AccessKey, Replay) unverändert – nur der **Versand** weicht bei Fehler auf Streams aus. |
| **Vorteil** | Höhere Resilienz. |
| **Aufwand** | Niedrig: Fehlerbehandlung im Sender (Messenger/Key-Halter), optional zweiter Pfad „bei Fehler → Streams senden“. Lock-Seite kann unverändert bleiben, wenn das Gerät sowohl Rebased-Events (über Pi) als auch Streams-Kanal lesen kann. |

---

### Variante 4: Streams für anonyme Heartbeats

| Aspekt | Inhalt |
|--------|--------|
| **Eingbau** | Gerät sendet periodisch „online“ in einen Streams-Kanal (ohne Adresse/Identität im Kanal). |
| **Streams** | Nur Heartbeats; wenig Metadaten. |
| **Rebased** | Echte Befehle, Berechtigung, Purge. |
| **Vorteil** | Offline-Alarm (Timeout → Purge/Warnung) ohne Metadaten-Leak bei Heartbeats. |
| **Aufwand** | Niedrig; eigenes kleines Modul/Skript; Lock/Messenger nur um „Timeout + Reaktion“ erweiterbar. |

---

### Variante 5: Hybrid (Streams Chat/Status + Rebased Berechtigung)

| Aspekt | Inhalt |
|--------|--------|
| **Eingbau** | Echtzeit-Chat/Status über Streams; Berechtigung und Zahlung on-chain (Rebased). |
| **Vorteil** | Maximale Flexibilität. |
| **Aufwand** | Hoch (5–10 h); stärkere Architektur-Entscheidungen (wer ist Author/Subscriber, wie wird Berechtigung mit Kanal verknüpft). Für dein jetziges System weniger prioritär als Variante 1. |

---

## 5. Empfehlung: Variante 1 umsetzbar machen

- **Architektur:** Unverändert. Rebased + Listener + AccessKey + Replay bleiben die **einzige** Quelle der Wahrheit für „OPEN erlaubt“. Streams ist nur ein **weiterer Ausgabekanal** an der letzten Meile.
- **Konfiguration (optional, vorbereitet):** Z. B. in `config.ts`:
  - `OPEN_STREAMS_ENABLED` (boolean)
  - `STREAMS_ANCHOR_ID` / `STREAMS_TOPIC` (oder API-spezifisch)
  - Weitere Streams-Parameter nur bei Bedarf.
- **Code-Stelle:** `m2m-lock.ts` → `executeOpenAction(sender)`. Dort:
  - wie heute: `OPEN_COMMAND` (spawn), `OPEN_URL` (fetch);
  - **wenn** `OPEN_STREAMS_ENABLED`: zusätzlich Aufruf eines kleinen Moduls/Skripts, das eine Nachricht (z. B. „OPEN“ oder ein kurzer Token) in den konfigurierten Streams-Kanal schreibt. Kein Umbau der bestehenden Logik.
- **Gerät (Heltec/ESP32):** Nur Streams-Client (WASM/Rust), abonnier den Kanal; bei Nachricht → Relais + OLED. Kein Rebased-RPC nötig.

So bleibt dein Code der Kern; Streams ist reiner Transport für die letzte Meile. Sobald ein Rebased-kompatibler oder IOTA-1.x-Streams-Client für Node verfügbar ist, kann die konkrete Implementierung (Publish-Funktion) in dieses Gerüst eingehängt werden.

**LoRa-Bridge (eigenes Projekt):** Unter `lora-bridge/` liegt eine HTTP-Bridge, die Morgendrot mit LoRa-Mesh (Heltec/Meshtastic) verbindet. `STREAMS_BRIDGE_URL=http://localhost:9342` zeigt auf die Bridge. Simulation ohne Hardware möglich. Siehe `lora-bridge/README.md`.

---

## 6. Kurz: Was du behältst vs. was Streams übernimmt

| Behalten (Rebased + dein Code) | Streams (oder Streams-ähnlich) |
|-------------------------------|----------------------------------|
| Handshake, ECDH, Shared Secret | – |
| Vault, Purge, AccessKey, Tickets | – |
| Listener, Replay, AUTHORIZED_SENDERS | – |
| Entscheidung „OPEN GRANTED“ | – |
| **OPEN_COMMAND / OPEN_URL** (weiter nutzbar) | **Transport „OPEN“ zum Gerät** (feeless, schnell) |
| – | Optional: Sensor-Streaming, Heartbeats, Backup-Kanal |

Damit bleiben Stärken (Berechtigung, Purge, Kontrolle) erhalten; Latenz, Kosten und Metadaten an der letzten Meile können mit Streams verbessert werden, sobald der passende Transport-Stack gewählt ist.

---

## 7. Szenario-Check: „Smart-Garage mit Auto-Zugang“ (Hybrid)

Prüfung: Ist das beschriebene Szenario (Auto mit gültigem Key, Status über Streams, kritischer Befehl „open“ nur über Rebased) mit dem aktuellen Code abbildbar?

### Was das Szenario verlangt

| Anforderung | Im Code? | Wo / Hinweis |
|-------------|----------|--------------|
| ECDH-Handshake on-chain, Shared Secret | Ja | Handshake (Mailbox/Events), `deriveSharedSecret` in crypto-layer; wallet-bridge + m2m-lock. |
| AccessKey-NFT (purgebar, TTL) | Ja | Move: AccessKey, create_key, purge_key, enable_emergency_purge_key; TS: hasValidAccessKey. |
| Purge & Notfall-Kill-Switch für Schlüssel | Ja | Move + /emergency-purge-key, /purge-key. |
| Replay-Schutz & AUTHORIZED_SENDERS | Ja | replay-state.ts, acceptAndUpdate; config AUTHORIZED_SENDERS; Lock prüft vor OPEN. |
| Kritischer Befehl „open“ nur über Rebased | Ja | Lock führt OPEN nur aus, wenn Nachricht von Rebased (EncryptedMessage/PlaintextMessage) kommt und AccessKey + Replay + ggf. Whitelist OK sind. Kein „open“ aus Streams. |
| Nach OPEN GRANTED etwas an Gerät/Auto senden (Status) | Teilweise | `publishOpenViaStreams(sender)` wird genau nach OPEN GRANTED aufgerufen; aktuell Stub. Nutzung: hier **Status** (z. B. `OPEN GRANTED`, `Tür offen`) auf Streams-Kanal senden – dann empfängt Auto/Heltec feeless und schnell. Befehl „open“ bleibt Rebased; Streams nur Status. |
| Schloss erstellt einmalig Streams-Kanal | Nein | Nicht im Code. Kanal-Erstellung (Anchor o. ä.) müsste einmalig außerhalb oder in einem Setup-Skript passieren; STREAMS_ANCHOR_ID kommt dann in .env. |
| Auto abonniert Kanal, sendet Status („bin da, Batterie 20 %“) | Nein | Lock liest nur Rebased-Events. Empfang von Streams-Nachrichten (vom Auto) wäre neuer Listener/Poll auf Streams-Kanal; optional ergänzbar. |
| Zahlungs-Trigger (z. B. 0.001 IOTA → Ladevorgang) | Vorbereitet | Config: MAX_SEND_AMOUNT_IOTA; keine Logik „bei eingehender Zahlung → Aktion auslösen“ im Code. Könnte in Listener oder eigenem Modul ergänzt werden. |

### Fazit Szenario

- **Rebased-Teil (alles Kritische):** Vollständig im Code – Handshake, AccessKey, Purge, Replay, Whitelist, „open“ nur nach Rebased-Validierung, OPEN_COMMAND/OPEN_URL.
- **Streams für Status („OPEN GRANTED“, „Tür offen“, „80 %“):** Einbaustelle ist da (`publishOpenViaStreams` nach OPEN GRANTED). Payload sollte **Status** sein (z. B. `OPEN GRANTED` oder JSON), nicht der Befehl „open“. Stub-Kommentar im Code erlaubt beides (Token/Status); für Smart-Garage: hier nur Status senden.
- **Nicht im Code (optional ergänzbar):** (1) Einmalige Kanal-Erstellung (Script oder extern), (2) Lock empfängt Streams („bin da, Batterie 20 %“) und reagiert z. B. mit AccessKey-Prüfung + Antwort auf Streams, (3) Zahlungs-Trigger-Logik.

Damit ist das Szenario **mit dem aktuellen Stand möglich**, sobald (a) Streams-Client für Publish (Status) eingebunden ist und (b) STREAMS_ANCHOR_ID (und ggf. Kanal-Erstellung) gesetzt sind. Der kritische Pfad (open nur über Rebased, Berechtigung on-chain) ist abgedeckt; Streams bleibt optional für Status und letzte Meile.

---

## 8. Die drei offenen Punkte: Sinn, Machbarkeit, Implementierung

### 8.1 Schloss erstellt einmalig Streams-Kanal

| Frage | Antwort |
|-------|--------|
| **Macht es Sinn?** | Ja. Ein Kanal pro Schloss (oder pro Schlüsselpaar) ist üblich; einmalig anlegen, dann STREAMS_ANCHOR_ID in .env. |
| **Geht es?** | Nur mit einem lauffähigen Streams-Stack. Das IOTA-Streams-Repo ist archiviert (Apr 2024), v2.0 war nicht Stardust-kompatibel. Auf IOTA 1.x oder einem kompatiblen Layer geht Kanal-Erstellung mit der Streams-Bibliothek. Auf Rebased gibt es derzeit keine eingebaute „Streams“-Schicht – also entweder 1.x nutzen oder auf ein künftiges Rebased-Streaming-Angebot warten. |
| **Implementieren?** | Im Projekt: **Doku + optionales Script**. Ein Skript (z. B. `scripts/create-streams-channel.ts`) kann (a) Anleitung/Platzhalter sein („mit Streams 1.x: … aufrufen, STREAMS_ANCHOR_ID in .env eintragen“) oder (b) falls du eine konkrete Streams-API nutzt, den Aufruf dazu enthalten. Echten Streams-Client ins Kern-Projekt zu ziehen ist wegen Archivierung/Abhängigkeit nur sinnvoll, wenn du einen festen, wartbaren Client nutzt. |

---

### 8.2 Auto sendet Status per Streams; Lock empfängt Streams

| Frage | Antwort |
|-------|--------|
| **Macht es Sinn?** | Ja. Status („bin da“, „Batterie 20 %“, „OPEN GRANTED“) feeless und schnell über Streams entlastet Rebased und verbessert Metadaten-Schutz. |
| **Geht es?** | Ja, sobald ein Streams-Client (Publisher + Subscriber) verfügbar ist. Lock würde einen zweiten „Listener“ haben (Streams-Kanal abonnieren); bei Nachricht optional Sender prüfen (z. B. AccessKey) und antworten (z. B. über `publishOpenViaStreams`). |
| **Implementieren?** | **Config + Stub.** Optionen wie `STREAMS_LISTEN_ENABLED`, weiterhin `STREAMS_ANCHOR_ID` (als Subscriber). Eine Stub-Funktion (z. B. `listenStreamsStatus(callback)`) wird optional im Lock aufgerufen; im Stub: „Bei echter Streams-Nachricht → callback(Payload); Implementierung mit Streams-Client ergänzen.“ So ist die Einbaustelle da, die konkrete Implementierung hängt am gewählten Streams-Client. |

---

### 8.3 Zahlungs-Trigger (z. B. 0.001 IOTA → Ladevorgang starten)

| Frage | Antwort |
|-------|--------|
| **Macht es Sinn?** | Ja. Typisches Muster für Ladesäule/Garage: Zahlung an Adresse → Aktion (Ladevorgang, Schranke). |
| **Geht es?** | Ja, mit Rebased. Die SDK-Methoden `getBalance`, `getCoins`, `queryTransactionBlocks` erlauben, Kontostand oder Transaktionen zu prüfen. Entweder: Balance-Poll (Vorher/Nachher) oder Abfrage von Transaktionen, die die Lock-Adresse betreffen – sobald ein ausreichender Betrag eingegangen ist, Trigger auslösen. |
| **Implementieren?** | **Ja – im Projekt umgesetzt.** Config: `PAYMENT_TRIGGER_ENABLED`, `PAYMENT_TRIGGER_MIN_IOTA` (z. B. `0.001`), `PAYMENT_TRIGGER_POLL_MS`, `PAYMENT_TRIGGER_STATE_FILE`. Chain-Layer: `queryIncomingPayments(client, address)` nutzt `queryTransactionBlocks` mit Filter `ToAddress` und `showBalanceChanges`; Rückgabe `{ digest, amountMist }`. Lock: optionaler Polling-Loop; bei Betrag ≥ Mindestbetrag wird dieselbe Aktion wie bei OPEN ausgeführt (`OPEN_COMMAND`/`OPEN_URL`), Sender-Kontext `payment:<digest>`. Replay-Schutz: bereits verarbeitete TX-Digests werden in `PAYMENT_TRIGGER_STATE_FILE` persistiert. **Hinweis:** Die State-Datei wächst mit jeder verarbeiteten Zahlung (eine Zeile pro Digest); bei sehr langer Laufzeit ggf. rotieren/leeren (dann würden alte Digests beim Neustart nicht als „bereits verarbeitet“ gelten – nur relevant, wenn dieselbe TX aus Sicht des Nodes erneut erscheinen könnte). |
