# „Heim-Heltec“ als transparenter LoRa→Internet-Gateway — kritische Einordnung

**Zweck:** Das **Zielbild** (Höhle sendet per LoRa; zu Hause empfängt ein **einfacher Heltec** ohne Raspberry Pi und **ohne Morgendrot-App**; Daten sollen **automatisch bei IOTA ankommen**) gegen **IOTA Rebased**, **Morgendrot-Architektur** und **Ist-Code** prüfen — **was stimmt**, wo **Marketing die Technik verbiegt**, und **welche Mindestausrüstung** real nötig ist.

**Verwandt:** **`lora-bridge/README.md`**, **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/PROTOCOL-CHANNELS-TX-VS-STREAMS.md`**, **`docs/OFFLINE-FAEHIGKEIT.md`**, Roadmap **`docs/ROADMAP-FAHRPLAN.md` § H.3i**.

---

## 1. Was an der Story **richtig** ist

| Aussage | Einordnung |
|--------|------------|
| **„Nackter Heltec hat kein Betriebssystem“** | **Richtig** im Sinne von: kein Linux-Server, keine „App“ wie auf dem CM4. Es läuft **Firmware** (z. B. Meshtastic oder Eure **eigene** Firmware). |
| **„Ohne Internet weiß er nichts von der Blockchain“** | **Richtig** — der Chip führt **kein** vollwertiges Wallet-Protokoll aus wie ein Morgendrot-Node; Verständnis der Kette kommt von **Software**, die Ihr bereitstellt. |
| **„Relais zwischen Funk und Internet“** | **Richtig als Rolle** — ein Knoten am **Rand** des Mesh nimmt LoRa/Mesh an und stellt **IP-Erreichbarkeit** her (WLAN/Ethernet). |
| **„Nutzer muss nichts drücken“** | **Plausibel** für **automatisierte Weiterleitung**, sobald Firmware + Ziel-URL + Strom/WLAN stehen — **kein** manueller Klick nötig. |
| **„Zweites Gerät für großes Bild“** | **Plausibel** — kleines OLED am Heltec reicht nicht für komplexe UI; **Smartphone/Browser** ist der übliche Viewer. |

---

## 2. Wo die Story **gefährlich vereinfacht** (Pflichtkorrektur)

### 2.1 „HTTP-POST an https://shimmer.network / IOTA-Node → fertig“

**Falsch so pauschal:** Eine **öffentliche IOTA-Rebased-JSON-RPC**-Schnittstelle ist **kein** Endpunkt, an den man **beliebige** LoRa-Rohdaten schickt und die landen „im Tangle“.

- **On-Chain** gehen nur **gültige Transaktionen** (PTB), in der Regel **signiert**; der Node **submittet** Bytes, die dem Protokoll entsprechen.
- **„Nur weiterleiten wie ein Router“** trifft auf **IP-Pakete** zu — **nicht** darauf, dass beliebige Payloads ohne **kryptografische** und **protokollkonforme** Aufbereitung eine **Mailbox-/Message-TX** werden.

**Verbesserung der Formulierung:** Der Heltec (oder besser: ein **kleiner Dienst im Heimnetz**) leitet an einen **von Euch definierten** Endpunkt — typischerweise **`lora-bridge` / Morgendrot-API** (`STREAMS_BRIDGE_URL`, ggf. **`MORGENDROT_GATEWAY_URL`**) — und **dort** entscheidet die **Morgendrot-Logik** (Queue, Signatur, Sponsor, Streams vs. Mailbox), **nicht** „die Node-URL im Browser“.

### 2.2 „Braucht der Heimnutzer kein Wallet?“

**Teils richtig, teils irreführend:**

- **Reines Funk-Relais** ohne eigene **IOTA-Adresse** ist möglich, wenn es **nur transportiert** (Bytes an Euren Server).
- **Settlement auf der Chain** braucht aber **irgendwo** eine **signierte** Aktion oder eine **bereits vorbereitete** TX — oft: **Gerät in der Höhle / CM4** hat geplant; **Boss/Sponsor** zahlt Gas; oder ein **Heim-Rechner** läuft mit Morgendrot — **nicht** „magischer POST an shimmer“.

**Präziser:** Der Heimnutzer **muss kein Wallet bedienen** — aber **irgendein** System mit **Schlüssel / Sponsor / vorbereitetem Batch** muss die **Chain-Semantik** erfüllen, sonst gibt es **keinen** sichtbaren Eintrag in der Mailbox.

### 2.3 „Morgendrot-Explorer“ zeigt das Bild aus dem Tangle

**Zu kurz gedacht:**

- **Standard-Explorer** zeigen **Objekte/Events** — **kein** automatisches „Bild entschlüsselt“ für E2E-Inhalte.
- **Klartext oder entschlüsselte Anzeige** braucht **Eure Web-App** mit **Vault/Keys** oder **öffentliche** Kanäle — siehe **`docs/MESSENGER-CHAT-INBOX-ARCHITEKTUR.md`**.

**Verbesserung:** „Website“ = **Morgendrot-Web/PWA** mit Backend — nicht nur eine generische Chain-URL.

---

## 3. Was im Repo **schon** existiert (Ist)

| Baustein | Rolle |
|----------|--------|
| **`lora-bridge/`** | HTTP ↔ LoRa; **Emergency-Umschlag**, optional **`MORGENDROT_GATEWAY_URL`** → `POST /api/tiny-message` — **kein** direkter „Shimmer-POST“. |
| **Morgendrot-Node (`src/`)** | Wallet, **`signAndExecute`**, Mailbox — **Quelle der Wahrheit** für echte Chain-Schritte. |
| **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** | **Delayed Upload**, Queue, **canonical_msg_ref** — genauer als „Heltec postet zur Node“. |

---

## 4. Empfohlene **Marketing-taugliche** Präzision (ein Absatz)

> Der Heltec zu Hause ist ein **Rand-Gateway**: Er bringt **Funk** ins **Heim-WLAN**. Die eigentliche **IOTA-Anbindung** (signierte Transaktionen, Mailbox, ggf. Streams) erledigt ein **Morgendrot-kompatibler Dienst** — Bridge oder Node im Netzwerk — nicht ein anonymer HTTP-Post an eine öffentliche Node-URL. Der Bewohner **signiert nichts**, wenn Ihr **Relay + Sponsoring/Queue** so plant; technisch ist das **kein** „dummer Rohr-POST zur Chain“, sondern ein **definiertes Gateway-Protokoll**.

---

## 5. Offene Produktentscheidungen (nicht im nackten Heltec „kostenlos“)

- **Firmware:** Meshtastic-Ökosystem vs. **minimaler** Custom-Firmware-Tunnel (Header **`MORG`** o. ä. nur mit **Spec** in **`meshtastic/` / Macro-Docs**).
- **Sicherheit:** WLAN-Gerät im Heim = **Angriffsfläche**; **API-Key**, TLS, kein offenes Relay ins Internet ohne Absicherung.
- **DSGVO / Nachrichteninhalt:** Relay sieht **Metadaten** oder Rohpayload je nach Format — in der **Privacy-Doku** festhalten.

---

*Stand: Abgleich mit `lora-bridge/README.md`, `LORA-IOTA-DELAYED-UPLOAD-SPEC.md`, `PROTOCOL-CHANNELS-TX-VS-STREAMS.md`.*
