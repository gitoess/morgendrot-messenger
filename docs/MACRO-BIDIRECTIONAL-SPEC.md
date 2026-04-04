# Macro-Engine: Bidirektionale Logik (Wald ↔ Netz) – Spezifikations-Backlog

**Status:** Entwurf zur **sicheren Umsetzung**; **keine** Implementierungspflicht vor Abschluss von **Phase A** und **Kern Phase B** (`docs/PROJECT-FOCUS-AND-PRIORITIES.md`).  
**Zweck:** Die vorgeschlagenen **Opcode-Bereiche** (0x40–0xB0) und Features **strukturieren**, **Risiken** benennen und **Reihenfolge** festhalten – damit nichts „still“ im Code landet ohne Audit-/Privacy-Review.

**Grundlage:** Downstream (Netz → Wald) siehe `docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`. Upstream (Wald → … → IOTA) schließt an **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** und **`audit-log.ts`** an.

---

## 1. Architektur-Bild

| Richtung | Pfad (Zielbild) | Rolle von IOTA / Basis |
|----------|-----------------|-------------------------|
| **Upstream** | Sensor/UI im Feld → Funk → Gateway/Handy → Queue → **IOTA** (Mailbox o. ä.) + optional **Audit** | **Nachweis** und **Einsatzleitung** sehen Ereignisse, wenn Uplink da ist. |
| **Downstream** | IOTA signiert → Gateway → Funk → **Macro-Interpreter** → BT → Heltec/App | Bereits im Hybrid-Dokument; **Befehle** kurz, **whitelist**. |

**Wichtig:** „Bidirektional“ heißt **nicht**, dass jede Antwort (z. B. **Wetterrohdaten**) im **vollen Umfang** über **LoRa** zurückgeht. Typisch: **Anfrage** klein über Funk, **Antwort** groß am **Basis-Node** (Internet) oder **nur Zusammenfassung** zurück über Funk.

---

## 2. Opcode-Registry (Vorschlag – vor Implementierung **abgleichen**)

Die Hex-IDs sind **Vorschläge**. **Zentrale Registry im Code:** `src/shared/opcodes.ts` (`MacroOpcode`, Emergency-Versionsbyte, `MorgTextWireMarker`). Vor dem ersten Code: **Kollisionen** mit **Meshtastic-Port/App-Payloads** weiter prüfen; Emergency v2 nutzt Byte `0x02` (nicht Makro-0x40); MORG_* und `[[MF1:` sind **Textmarker**, keine Ein-Byte-Opcodes.

| ID (Vorschlag) | Name | Richtung | Kurzbeschreibung |
|----------------|------|----------|------------------|
| **0x40** | Event-Trigger / Notfall | ↑ Wald→Netz | Sensor- oder Logik-Ereignis → strukturierter Eintrag in Audit/Chain (z. B. Sturz-Hinweis). |
| **0x50** | Presence-Log | ↑ | Signierter **Standort-Nachweis** (Checkpoint) – **privacy-kritisch**. |
| **0x60** | Data-Query | ↑ (Anfrage) / ↓ (Antwort anteilig) | Komprimierte **Abfrage** (z. B. Wetter-Intent); Antwort siehe §4. |
| **0x70** | Beacon-Mode | ↓ | Nahbereich: akustisch/visuell „Radar“ für Team. |
| **0x80** | Infrastruktur-Control | ↓ | Externe LoRa-Hardware (Schloss, Relais) – **Anknüpfung** an bestehende Lock/M2M-Patterns. |
| **0x90** | Power-Commander | ↓ | Ultra-Battery-Profile remote – **Meshtastic/Firmware** muss Profile kennen. |
| **0xA0** | Breadcrumb-Echo | ↑ | Delta-Koordinaten für **langsame** Pfadspur im Tangle. |
| **0xB0** | Mesh-Topology-Discovery | ↑ lokal + ggf. Report | RSSI/Nachbarn zur **Standortwahl** – **UI** „Mesh-Map“ optional. |

---

## 3. Technische Anforderungen – zerlegt in umsetzbare Pakete

### 3.1 Binär-Nutzlasten (pro ID)

- **Pflicht für jedes Opcode:** `version` (4 Bit) + `macro_id` (8 Bit) + `nonce`/`seq` (Replay) + **maximale Länge** pro Typ; optionale **correlation_id** (`uint16`) für **Request/Response** (besonders **0x60**).
- **0x40 Sturz / Sensor:** Rohdaten **nicht** blind in IOTA; **vorher** lokal: Entprellung, **Fehlalarm-Timeout**, optional Nutzer-Abbruch. Payload: `flags` (1 Byte) + `accel_peak` o. ä. kompakt – **kein** kontinuierlicher Stream.
- **0x50 Presence:** Nur mit **expliziter Einsatz-Policy**; Inhalt: z. B. fixe **Geohash** oder **gerundete** Koordinaten + Zeit + Geräte-ID-Hash; **Signatur** über das, was wirklich gezeigt werden soll.
- **0x60 Query:** `query_type` (8 Bit) + `params` kompakt; **Antwort**: große Daten **nicht** in einem LoRa-Frame – stattdessen **Basis** holt Wetter o. ä. und sendet **nur Kurzinfo** zurück oder **speichert** für nächsten Uplink (siehe §4).
- **0x70 Beacon:** Dauer/Lautstärke in **erlaubten** Stufen (Whitelist).
- **0x80:** Mapping auf **bekannte** Aktor-Befehle; **kein** generisches „öffne alles“.
- **0x90:** Profil-IDs aus **abgesprochener** Tabelle (Firmware).
- **0xA0 Delta:** **Delta-Encoding** (eigenes Unterkapitel): z. B. erste Position **absolute** (int32/int32 oder Geohash), Folge **Δlat/Δlon** in **int16** mit bekanntem Skalenfaktor; **Zeitstempel** relativ **uint16** Minuten seit Start – **genaue Layout** vor Implementierung einfrieren.
- **0xB0:** RSSI/Node-IDs laut Meshtastic-API; **Visualisierung** ist **optional** und **nach** zuverlässiger Datenquelle.

### 3.2 `src/api-server.ts` – Request-Response / Info

- **Rolle** des API-Servers bleibt: **dünn**, delegiert an `wallet-bridge` / Chain (`api-server.ts` Kopfzeile).  
- **Vorschlag:** Neue Endpoints **nicht** „alles offen“, sondern z. B. **`/api/macro-info/query`** nur mit **Allowlist** (Wetter-URL, Timeout), **Auth** (Device-Key / Session), **Rate-Limit**. Wetter/Info = **Basis** mit Internet, **nicht** das Handy ruft beliebig URLs aus dem Funk-Makro auf.
- **Kopplung an 0x60:** Makro trägt nur **intent_id**; der **Node** führt die **HTTP-Abfrage** aus und **schreibt** Ergebnis in Queue/Audit; Rückkanal LoRa nur **kurz**.

### 3.3 UI – Sensor-Trigger (Accelerometer)

- **DeviceMotion** / `Accelerometer` nur nach **Permission**; **iOS/Safari**-Einschränkungen beachten (oft nur nach User-Gesture).  
- **Kein** Dauerfeuer in IOTA: nur **Ereignis** nach interner Logik (0x40).

### 3.4 Delta-Encoding (0xA0)

- Algorithmus **deterministisch** dokumentieren (Skalenfaktor, Overflow: neue absolute Referenz).  
- Optional: bekannte **komprimierte Polyline**-Variante evaluieren (Konsistenz mit Karten-Tools).

### 3.5 Mesh-Map (RSSI)

- **Datenquelle zuerst klären:** Meshtastic-Node-Info, ggf. nur **eigener** Knoten + Nachbarn. **UI** als **Phase 2** nach stabiler BT-Abfrage.

---

## 4. Wetter / Info: „Bidirektional“ realistisch gestalten

| Variante | Beschreibung |
|----------|--------------|
| **A (empfohlen)** | 0x60 löst am **Basis-Node** mit Internet eine **Allowlist-Abfrage** aus; Ergebnis landet in **Audit** oder Mailbox; Feld sieht **Kurztext** per nächstem Funk/Streams. |
| **B** | Rückantwort nur **Metadaten** über LoRa (z. B. „Regen wahrscheinlich: ja“), keine Roh-GRIB. |

So bleibt die **MTU** eingehalten und **SSRF** vermieden.

---

## 5. Eigene Ergänzungen (Empfehlungen)

1. **`correlation_id` (uint16)** für alle request/response-fähigen Makros – verhindert Zuordnungschaos bei Funkverlust.  
2. **`upstream_custody_id`** an **`canonical_msg_ref`** aus `LORA-IOTA-DELAYED-UPLOAD-SPEC.md` anbinden – **Nachweis** „dieses Ereignis kam aus dem Wald“.  
3. **Rate-Limits** pro Gerät für 0x40/0x50/0xA0 – Schutz vor Tangle-Spam und Batterie-Leerzug.  
4. **Dual-Consent:** 0x50/0x40 bei Personenbezug **nur** mit konfigurierbarem **Einsatzmodus** + Dokumentation in `docs/DISCUSSION-OPEN.md` oder Datenschutz-Notiz.  
5. **0x80** mit **M2M-Lock**-Philosophie: **autorisierte Absender** + **kein** Shell.

---

## 6. Reihenfolge: Fahrplan zuerst oder dies?

**Empfehlung:** **Weiter mit dem bestehenden Fahrplan** (Phase A → B: Stabilität, Mesh v2, Delayed Upload). Dieses Dokument ist **Backlog** für **nach** der ersten **Macro-Interpreter-** und **Gateway-Basis** (`docs/ROADMAP-FAHRPLAN.md` C.1/E, `docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`).

**Innerhalb dieses Backlogs sinnvolle Reihenfolge:**

1. **Opcode-Registry** + **Payload-Layouts** einfrieren (Review).  
2. **Upstream-Pfad** an **Delayed Upload + Audit** andocken (0x40/0x50/0xA0 minimal).  
3. **0x60** nur mit **Variante A** (§4) und **api-server**-Allowlist.  
4. **Downstream** 0x70/0x80/0x90 wie im Hybrid-Dokument (Whitelist).  
5. **0xB0** + UI **Mesh-Map** zuletzt (Datenquelle + UX).

---

## Verwandte Dokumente

- `docs/MACRO-OPERATIONAL-PATTERNS.md` – QoS, Hop/TTL, ACK, Autonomie, Akku, Heartbeat/Streams  
- `docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`  
- `docs/ROADMAP-FAHRPLAN.md`  
- `docs/PROJECT-FOCUS-AND-PRIORITIES.md`  
- `docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`  
- `src/emergency-binary-wire.ts` (bestehendes Binärformat – **nicht** überschreiben ohne Absprache)
