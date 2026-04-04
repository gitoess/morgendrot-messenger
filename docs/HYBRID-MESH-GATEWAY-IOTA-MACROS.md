# Hybrid-Mesh-Gateway & IOTA-Macros – Einordnung und Review

**Status:** Konzeptreview (keine Implementierungspflicht aus diesem Dokument).  
**Zweck:** Kritische Bewertung des Vorschlags „IOTA = globales Kontroll-/Audit-Log, Basis-Station spiegelt signierte Makros ins LoRa-Netz, Endgerät führt lokal aus“ – **Abgleich** mit bestehender Morgendrot-Architektur.

---

## 1. Kurzfassung des Vorschlags

| Baustein | Idee |
|----------|------|
| **Globaler Bus** | IOTA-Tangle als **unveränderliches** Kontroll-/Audit-Log. |
| **Administrator** | Sendet **signiertes JSON-Macro** an eine definierte Adresse / Objekt. |
| **Gateway-Relay** | Basis-Station (z. B. CM4) **überwacht** Chain/Events, **validiert Signatur**, **übersetzt** in LoRa/Meshtastic-Nutzlast. |
| **Edge-Execution** | Zielgerät (Handy + Web Bluetooth) **empfängt Funkpaket** und **führt Macro lokal aus** (Alarm, Status, Config). |
| **Sicherheit** | Auditierbarkeit im Tangle; **Replay-Schutz** über Nonces/Timestamps im IOTA-Payload; **kein** blindes Re-Funken alter Pakete ohne Policy. |

---

## 2. Macht das Sinn? – Einschätzung

**Ja, strategisch** – unter der Bedingung, dass ihr die **Vertrauensgrenzen** klar zieht (wer darf welche Macros auslösen, was darf das Handy lokal ausführen). Das passt zu eurem Bild: **IOTA = Einsatz-/Kernpfad**, **LoRa = Offline-/Notfall-Fallback** (`PROJECT-FOCUS-AND-PRIORITIES.md`).

**Vorteile gegenüber „nur Meshtastic“:**

- **Nachweisbarkeit:** Befehle können **vor** dem Funkweg **on-chain** oder in einem **verankerten Log** dokumentiert werden (vergleichbar Audit-/Compliance-Anforderungen).  
- **Steuerung ohne Endgerät-Internet:** Endgeräte brauchen **kein** Uplink zum Zeitpunkt des Befehls; das **Gateway** bringt die Signatur/Policy in den Funkraum.  
- **Zentrale Policy:** Eine Stelle (Basis) kann **Filter/Validierung** vor dem Funken übernehmen.

**Risiken / Kosten:**

- **Edge-Execution:** Jede **automatische lokale Aktion** (Alarm, Config) ist ein **Sicherheits- und Support-Risiko** (fehlerhafte Payloads, Social Engineering über kompromittierte Gateways). Braucht **Whitelist**, **Versionsfeld**, **maximale Macro-Typen**, ggf. **Nutzerbestätigung** für kritische Aktionen.  
- **Größe:** **IOTA-Payload** und **LoRa-MTU** (bei euch Mesh v2 typisch **kleine** Wire-Pakete, siehe `MESH_V2_MAX_BYTES` / `LORA-IOTA-DELAYED-UPLOAD-SPEC.md`) **konkurrieren** – ein „volles JSON“ passt oft **nicht** 1:1 in einen Funkframe → **Pflicht** zu einem **kompakten Binär-Macro** + optionale **mehrteilige** Übertragung (wie bei euren MORG_*-Wires / Fragmentierung).  
- **Replay:** On-Chain-Nonces sind **nicht** automatisch dieselben wie **Mesh-Nonce**; ihr braucht eine **Macro-ID** oder **Counter**, der **sowohl** in der Chain-Nachricht **als auch** im Funkpaket **verbindlich** ist und am Edge **einmalig** verarbeitet wird.

---

## 3. Was im Repo schon „in die Richtung“ zeigt (nicht dasselbe Produkt)

| Bereich | Vorhanden | Bezug zum Hybrid-Konzept |
|---------|-----------|---------------------------|
| **IOTA Messaging / Mailbox / Events** | Move + `chain-access`, Fetch/Mailbox | „Macro“ könnte als **spezielles Klartext- oder verschlüsseltes Payload** an eine **Adresse** modelliert werden (analog zu bestehenden Nachrichtenpfaden). |
| **Listener / Lock / OPEN** | `m2m-lock`, Replay (`replay-state`), `AUTHORIZED_SENDERS` | Muster: **empfangen → validieren → ausführen**; Macros am **Handy** bräuchten **ähnliche** Policy, nicht blind `eval`. |
| **Audit-Log** | `audit-log.ts`, optional Streams-Hash | **Audit-Trail** unabhängig vom reinen Meshtastic-Kanal. |
| **Mesh v2 / API** | `/mesh-build-v2`, `meshBuildV2Wires` im Frontend | **Binär/Base64-Wires** für LoRa; ein Gateway könnte **nach** Validierung **dieselbe** Build-Pipeline nutzen (heute: **Node-API**, nicht im Browser allein). |
| **Letzte Meile / Bridge** | `STREAMS_BRIDGE_URL`, `lora-bridge/`, `STREAMS-INTEGRATION.md` | Idee „**HTTP-Bridge** zwischen Internet und Funk“ ist **verwandt**; euer Vorschlag ist **semantisch höher** (signierte **Befehle** statt nur Transport). |
| **Verzögert LoRa → IOTA** | `LORA-IOTA-DELAYED-UPLOAD-SPEC.md` | **Richtung umgekehrt** zu „IOTA → LoRa“, aber **gemeinsame** Bausteine: Queues, Custody, `canonical_msg_ref`. |
| **Rollen Boss / Kommandant / Basis** | `ARCHITECTURE-ROLES-AND-HUB.md` | **Organisatorisch** passt eine **Basis-Station** als Gateway gut zur bestehenden Rollenlogik. |

**Fazit:** Die **Bausteine** (Kette, Signatur, Bridge, Mesh-Build, Audit) sind **teilweise** da; eine **geschlossene „IOTA Macro → validiertes LoRa-Paket → sichere Edge-Ausführung“**-Pipeline ist **nicht** als fertiges Feature implementiert – das wäre ein **eigenes Epic** (Spec → Gateway-Dienst → UI-Policy).

---

## 4. Technische Vorschläge aus dem Konzept – Bewertung

| Anforderung | Bewertung |
|-------------|-----------|
| **Ultrakompaktes Binärformat** (IOTA + LoRa) | **Zwingend** sinnvoll; **Version + Typ + nonce + ggf. Hash** in wenigen Bytes; Rest fragmentieren wie bei euren Wire-Limits. |
| **Gateway-Logik in Node-API (`src/`)** | **Plausibel:** Listener/Filter auf **definierte Events oder Objekte**, dann **Aufruf** der bestehenden **Mesh-Build**-Logik oder dedizierte **Sender-Queue** zur Bridge. Parallel **Health/Monitoring** und **Ablehnungslog**. |
| **Signiertes JSON** | **JSON on-chain** ist für **Menschen lesbar** gut; **für Funk** immer **abbilden** auf **Binär-Macro** (oder Hash + Referenz). |

---

## 5. Empfohlene nächste Schritte (ohne Scope-Explosion)

1. **Spec einfrieren:** Macro-Schema (Version, Typ, nonce, Signatur-Referenz, max. Länge), **Threat-Model** (wer signiert, wer funk, wer darf ausführen).  
2. **Prototyp nur Gateway:** Ein Prozess **liest** erlaubte IOTA-Events, **validiert**, **ruft** `/mesh-build-v2` oder interne Wire-Erzeugung auf, **sendet** an konfigurierte Bridge (z. B. `lora-bridge` oder MQTT gemäß Meshtastic-First).  
3. **UI/Handy:** Zunächst **nur Anzeige + manuelle Bestätigung** für kritische Macros; später automatisiert mit harter Whitelist.

Damit bleibt das Konzept **mit dem Projekt kompatibel** und **an** `PROJECT-FOCUS-AND-PRIORITIES.md` **anschlussfähig** (nach stabiler Basis / Phase B).

---

## 6. Drei Steuerungsebenen (IOTA-Makro + Web-App + Heltec)

**Modell:** Aus dem Internet kommt **kein** direkter Zugriff auf den Heltec im Wald. Stattdessen: **signierter Marschbefehl** (IOTA) → Basis/Gateway → **Funk** → **Handy (Web-App)** → **Web Bluetooth** → **Heltec**. Die App ist das **lokale „Gehirn“**, das Befehle **interpretiert** und **nur erlaubte** Aktionen ausführt.

| Ebene | Was ein Makro steuern kann | Technische Realität / Kritik |
|-------|----------------------------|------------------------------|
| **1 – Heltec / LoRa** | TX-Power, Kanal/Frequenz oder Hop-Slot, Modem-Preset (z. B. Long-Fast ↔ Very-Long-Slow) | **Kurze Befehlscodes** passen zur MTU; Umsetzung über **Meshtastic-/Firmware-APIs**, nicht durch freies JSON im Funkframe. Sendeleistung und Frequenzen: **regional** und **einsatzpolitisch** abzusichern. |
| **2 – Web-App (PWA)** | Feature-Freischaltung (Notfall-UI), Remote-Wipe/Lock **lokaler** Einsatzdaten, Konfiguration (API-URL, Node-Endpunkte) | **Sinnvoll**, sobald **PWA-Basis** (Manifest, SW) steht (`ROADMAP-FAHRPLAN` Punkt 5). Wipe/Lock: **hochriskant** – Policy, optional Nutzer-Bestätigung, Audit. |
| **3 – „OTA“ / Firmware** | **Kein** Firmware-Blob über LoRa; Makro = **Anstoß** (Version/URL/Hash): Handy holt bei **kurzem Internet** die Datei und flasht per **Web-Bluetooth DFU** | **Größte technische Hürde**; phasenweise: Machbarkeit Meshtastic + Browser-DFU klären. **Plugin-/Modul-Steuerung** nur, wenn die Firmware **stabile** Schnittstellen bietet (**Meshtastic-First**). |

**Nachweis vs. Funk:** Über IOTA ist oft klar, **dass** die Basis einen Befehl **ausgestellt** hat. Ob der Heltec im Feld **empfangen** hat, sieht man erst bei **Funk-ACK** oder **Rückmeldung** (Delayed Upload, separater Pfad).

---

## 7. Erweiterte Szenarien (Bewertung)

| Szenario | Idee | Sinnhaftigkeit / Grenzen |
|----------|------|---------------------------|
| **Geofence & Alert** | Makro mit Zentrum+Radius; Handy (GPS) löst Alarm oder LoRa-Ping bei Betreten/Verlassen | **Taktisch stark**; **reine PWA** hat auf Mobilgeräten oft **kein zuverlässiges Hintergrund-Geofencing** – Erwartung an „immer aktiv“ **dämpfen** oder native Begleit-App erwägen. |
| **Silent Ping / Totmann** | Makro fordert Bestätigung; ohne Antwort in X Minuten: letzte GPS-Pos mit hoher TX-Power per LoRa | **Sehr sensibel** (Ethik, Fehlalarme, medizinische Notfälle); **Einwilligung** und klare **lokale** Timer-/UX-Regeln. |
| **Mesh-Relay-Optimierung** | Makro z. B. Router/Relay aus → Energie für eigenen Notfall-Funk | **Sinnvoll**, wenn **Router-Modus** zuverlässig schaltbar; wieder **kurze IDs**. |
| **Credential-Rotation** | `ROTATE_KEY` signiert über IOTA; Gruppe wechselt AES/Mesh-Key | **Passt strategisch**; im **Mesh** braucht es **Gruppen-Key-Logik** und **Reihenfolge** (wer wann gültig ist) – **eigenes Design**, nicht nur ein Makro-Byte. |
| **Remote-Display (OLED)** | Kurztext auf Heltec-Display ohne Handy-Display | **Passt zur kleinen Nutzlast**; braucht **Display-API** in Firmware/Protokoll. |

---

## 8. Macro-Interpreter-Engine (Pflichtbaustein)

**Aufgabe:** Ein **binärer Makro-Typ** (ID + Version + nonce + ggf. wenige Parameter) wird **nach** Verifikation (Signatur/Policy **vor** dem Funk, Replay-Schutz am Gerät) in eine **Whitelist** von **lokalen** Handlungen übersetzt:

- Aufruf **Meshtastic-/Bluetooth-APIs** (Heltec),
- Änderung **App-State** (Flags, Konfiguration),
- **Kein** `eval` beliebigen Strings, **keine** beliebigen URLs ohne Allowlist.

**Versionierung:** Jede Makro-ID ist an eine **Schema-Version** gebunden; unbekannte IDs werden **verworfen** und geloggt.

**Reihenfolge im Projekt:** Interpreter und konkrete Makros **nach** Gateway-MVP und **nach** Phase-B-Kernpfad – siehe **`docs/ROADMAP-FAHRPLAN.md`** (C.1, E) und **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** (Phase C / Macro-Zeile).

---

## 9. Bidirektional (Wald ↔ Netz) – Erweiterung

Upstream-Events (0x40–0x60), Downstream-Erweiterungen (0x70–0xB0), Request-Response, Delta-Encoding und **api-server**-Allowlists sind als **Spezifikations-Backlog** ausgelagert: **`docs/MACRO-BIDIRECTIONAL-SPEC.md`**. Umsetzung **nach** Phase-B-Kern und **nach** Interpreter-/Gateway-Grundlage; nicht parallel zur **Phase A**-Stabilisierung priorisieren.

---

## Verwandte Dokumente

- `docs/PROJECT-FOCUS-AND-PRIORITIES.md`  
- `docs/ROADMAP-FAHRPLAN.md` (C.1 Priorität, E Macro-Backlog)  
- `docs/MACRO-BIDIRECTIONAL-SPEC.md` (Opcodes 0x40–0xB0, Wald↔Netz)  
- `docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`  
- `docs/STREAMS-INTEGRATION.md`  
- `lora-bridge/README.md`  
- `docs/MESHTASTIC-BUILDING-BLOCKS.md`
