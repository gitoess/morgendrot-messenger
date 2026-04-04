# Protokolle & Kanäle: normale TX, Streams, Audit – wann was sinnvoll ist

**Zweck:** Entscheidungshilfe für **Morgendrot** – was auf die **Rebased-Kette (TX/Events/Mailbox)**, was auf **Streams (Bridge)**, was **lokal/LoRa**, was **Audit-Datei**; plus **kritische Einordnung** von DID, „Digital Twin“ und Gas Station.

**Basis:** `docs/STREAMS-INTEGRATION.md` (detailliert), `docs/KACHELN-VERBINDUNGEN-UND-TWIN-ROLLEN.md` (Asset-/Monitor-Twin), `src/gas-station.ts`, `src/audit-log.ts`.

---

## 1. Kurz: wer macht was?

| Bedarf | Sinnvoller Kanal | Warum |
|--------|------------------|--------|
| **Handshake, Keys, AccessKey, Tickets, Purge, Vault-Logik** | **Rebased (Move / Mailbox / Events)** | Autoritative, prüfbare On-Chain-Logik; Streams **ersetzt** das nicht. |
| **Verschlüsselter Chat, strukturierte Mailbox-Nachrichten** | **Rebased** (bestehender Pfad) | Nachweis, Rebate/Purge, bestehende Clients. |
| **Hohe Frequenz, geringe Latenz, „Puls“ (Heartbeat, Sensor-Telemetrie, Status an Basis)** | **Streams** (über `STREAMS_BRIDGE_URL` + Anchor) | Feeless am Kanal; weniger TX-Last; **nur mit Uplink** zur Bridge. |
| **Einsatzprotokoll / Compliance / Export** | **Lokal `audit-log` + optional Hash/Streams** (`AUDIT_STREAMS_ENABLED`) | Vollständige Spur kann teuer/unpraktisch komplett on-chain sein; Datei + gezielte Verankerung. |
| **Wald / kein Internet** | **LoRa / Mesh**, später **Delayed Upload → IOTA** | Streams **nicht** verfügbar ohne Bridge; siehe `docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`. |
| **„Protokolle“ im Sinne von Sitzungs-/Chat-Protokollen** | **Export (ZIP/JSON)** + ggf. **Mailbox** | Streams sind **kein** Archiv-Ersatz; höchstens **Live-Spiegel** oder **zusätzlicher** Echtzeitkanal. |

**Regel:** Nicht **alles** auf Streams „rausgeben“ – sonst verliert ihr **Mailbox-Purge**, **explizite Chain-Beweise** und eine klare **Single Source of Truth** für Rechte.

---

## 2. Soll man Protokolle/Audit **auch** auf Streams geben?

| Variante | Nutzen | Risiko / Aufwand |
|----------|--------|-------------------|
| **Nur Live-Status** (Heartbeat, „Sensor ok“, Kurzalarm) auf Streams | Hoch für Operationszentrale | Gering; passt zu `/heartbeat` und Monitor. |
| **Vollständiges Einsatzprotokoll nur Streams** | Scheinbar günstig | **Nein:** kein gleichwertiger Purge-/Rebate-Pfad wie Mailbox; Bridge-Ausfall = Lücke. |
| **Hybrid (empfohlen)** | **Wahrheit** = Kette + lokale Exporte; **Streams** = **Echtzeit-Spiegel** für wenige Felder (z. B. letzter Heartbeat, Alarmbit) | Muss dokumentiert sein, was „offiziell“ ist (meist Chain + signierte Exporte). |
| **Audit-Hash gelegentlich** in Streams oder Mailbox-Kleinst-TX | Nachweis „Stand X existierte“ | Optional; bereits in Richtung `audit-log` / Specs gedacht. |

**Fazit:** Streams für **Betrieb/Live**, Rebased (+ Export) für **rechtlich/technisch tragfähige** Protokolle.

---

## 3. Einordnung: IOTA DID & Streams (Vorschlag vs. Morgendrot heute)

| Aussage | Realität im Projekt |
|---------|---------------------|
| „Jedes Heltec hat eine DID im Tangle“ | **Noch nicht:** Identität ist **Wallet-Adresse (0x…)** + Keys im Vault; **DID-Standard** (did:iota:…) wäre **eigenes** Projekt (Dokumente, Resolver, Rotation). |
| „Jede Streams-Nachricht signiert – 100 % sicher vor Scherzbolden“ | **Teilweise:** Was über die **Bridge** läuft, hängt von **Bridge-/Adapter-Implementierung** und **Kanalbindung** ab; **LoRa** ist ein **anderes** Vertrauensmodell (Mesh-Identität ≠ IOTA-Adresse ohne zusätzliche Kryptobindung). **100 %** nur mit klar spezifiziertem **Bindungsschema** (z. B. Gerät sendet nur **nach** erfolgreichem Handshake/Macro-Whitelist). |
| „Rebased + Move: Streams als native Objekte, < 500 ms“ | **Vorsicht:** **Latenz** hängt von RPC, Bridge und Last ab; **< 500 ms** ist **kein** Garant aus dem Konzept allein – messen im Deployment. |
| „Access Control über DID-Dokumente, Rettungskräfte temporär“ | **Vision**; in Morgendrot heute: **AccessKey / Whitelist / Rollen** über **Move + .env**. DID-basierte Delegation wäre **Evolution**, nicht Flip-a-switch. |

---

## 4. „Digital Twin“ (TWIN) – was noch Sinn macht

| Konzept | Passt zu Morgendrot? |
|---------|------------------------|
| **Zustandsspiegel** (letzte Pos, Akku, „offline seit“) | **Ja, als Produktidee:** nahe an **Monitor/Heartbeat** + optional **Server-seitiger Cache** an der Basis (nicht zwingend on-chain jede Sekunde). |
| **„Twin lebt weiter, Wanderer offline“** | **Nur** als **logischer** Stand in der **Basis-UI/DB** – nicht als magischer separater Chain-Vertrag, solange nicht implementiert. |
| **„Twin löst Smart Contracts nach 60 min ohne Heartbeat“** | **Hoher Aufwand:** braucht **vertrauenswürdigen** Ausführer (Boss-Node), klare **Policy**, **kein** alleiniges LoRa-Signal als Trigger ohne Missbrauchsschutz. **Gas** und **Autorisierung** explizit modellieren. |
| **Audit aller Sensoren am Twin** | Sinnvoll als **Zielbild:** in der Praxis eher **Audit-Log** + gezielte **IOTA-Anker**; vollständige Sensorhistorie on-chain ist meist **unrealistisch**. |

Verknüpfung: **`docs/KACHELN-VERBINDUNGEN-UND-TWIN-ROLLEN.md`** (Asset-Twin, `streams_anchor_id`) beschreibt bereits eine **pragmatische** Twin-Idee – nicht die volle Marketing-Definition.

---

## 5. Gas Station – strategisch sinnvoll?

| Aussage | Im Code |
|---------|---------|
| Basis sponsert Gebühren für Worker | **`runGasStationCheck`** in `src/gas-station.ts`, Konfiguration in `docs/INDUSTRY-FEATURES.md` / `CONFIG-REFERENCE.md`. |
| „Endnutzer komplett feeless“ | **Nur** für konfigurierte **Worker-Adressen** und **wenn** Boss Wallet entsperrt und Policies passen – **kein** universelles „alle TX kostenlos“ ohne Budget/Risiko. |

**Empfehlung:** Gas Station für **fest definierte** Geräte/Rollen **ja**; als **alleinige** Identitäts-/Twin-Strategie **nein** – sie löst **Kosten**, nicht **Vertrauen** oder **Datenhoheit**.

---

## 6. Praktische Empfehlung für die Roadmap

1. **Streams:** weiter für **Heartbeat, optionale Sensor-/Status-Spiegel**, **nicht** als Ersatz für Mailbox/Purge/Export.  
2. **Protokolle „offiziell“:** **Export + Chain**, Streams höchstens als **Live-Ergänzung**.  
3. **DID / voll Twin / automatische Alarm-SCs:** **Spec & Phasen** (`docs/PROJECT-FOCUS-AND-PRIORITIES.md`), nicht parallel zum **Mesh-MVP** überladen.  
4. **Gas Station:** dort nutzen, wo ihr **Worker** ohne manuelles Nachfüllen betreiben wollt – Budget und Boss-Sicherheit im Blick.

---

## 7. Festgeschriebene Kanal-Policy (Projektentscheidung)

Diese Regeln gelten für **Morgendrot**, solange nicht ausdrücklich anders dokumentiert. Sie sind **organisatorisch**; technische Flags bleiben in `.env` / Code wie bisher.

### Streams (`STREAMS_BRIDGE_URL` + `STREAMS_ANCHOR_ID`)

| Erlaubt | Nicht erlaubt als „alleinige“ Quelle |
|---------|--------------------------------------|
| Heartbeat / **Puls** („Gerät lebt“, Zeitstempel, `transport: internet`) | Vollständiger **Chat-Inhalt** oder Ersatz für **Mailbox** |
| Kurze **Live-Spiegel**: Statusbits, Alarm-Hinweis, Sensor-**Kurz**wert (Betrieb) | **Purge-relevante** oder **vertraglich** kritische Inhalte nur hier |
| Optional: **Duplikat** eines bereits sicher anderswo existierenden Signals | **Beweis** gegenüber Behörden/Versicherung **nur** aus Streams |

**Soll:** Operationszentrale sieht **schnell** „noch online“ / „Alarmbit“, ohne jede Sekunde die Chain zu pollen.

### Rebased (Mailbox / Events / Move)

| Muss hier landen |
|------------------|
| **Handshake** und alles, was **ECDH / Keys** braucht |
| **Verschlüsselter Chat**, **Pinnwand-Klartext** (wenn aktiviert), **MORG\_*-Wires** im bestehenden Pfad |
| **Purge-relevante** Aktionen (`/purge-msg`, Rebate, **Notfall-Purge** Vault, AccessKey/Ticket-Purge) |
| Alles, was **Explorer-/Chain-Nachweis** oder **Move-Logik** erfordert |

**Ist die maßgebliche Schicht** für „was ist auf der Chain (oder Mailbox-Objekt) gespeichert und purgebar“.

### Audit (`audit-log`, Export ZIP/JSON)

| Rolle |
|-------|
| **Offizielles** Einsatz-/Compliance-Protokoll für **Nachsorge, Review, Export** |
| Streams dürfen **höchstens** denselben Sachverhalt **spiegeln** (z. B. Alarm), nicht die **einzige** Spur |

### LoRa / Mesh

| Rolle |
|-------|
| **Offline-Transport**; **kein** Streams-Ersatz |
| Inhalte mit **IOTA-Bezug** später per **Delayed Upload** in die Mailbox/Kette – siehe `LORA-IOTA-DELAYED-UPLOAD-SPEC.md` |

### Kurzformel

- **Live & leicht** → **Streams** (mit Uplink).  
- **Rechte, Purge, Beweis, Chat** → **Rebased**.  
- **Protokoll für Auswertung** → **Audit + Export** (+ Chain wo nötig).  
- **Wald** → **LoRa**; **Basis** verbindet zu **Streams** und **IOTA**.

---

## Verwandte Dokumente

- `docs/STREAMS-INTEGRATION.md`  
- `docs/MACRO-OPERATIONAL-PATTERNS.md`  
- `docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`  
- `docs/INDUSTRY-FEATURES.md` (Gas Station, Audit)  
- `docs/KACHELN-VERBINDUNGEN-UND-TWIN-ROLLEN.md`
