# ATAK / Cursor-on-Target (CoT) — Zielbild & Backlog

**Status:** **Dokumentiert, nicht implementiert.** Zwei Zielpfade parallel vorgesehen: **CoT über UDP (klassisch)** und **Anbindung über einen TAK Server**.

**Kontext:** Morgendrot liefert Einsatzdaten (Position, Status, optional Bilder/Metadaten). **ATAK** (Android Team Awareness Kit) zeigt **Lage** auf der Karte, wenn die Daten als **CoT-Events** (XML) oder über einen **TAK-kompatiblen Server** ankommen.

**Offline-Basiskarten / Tile-Strategie (Wanderer vs. Einsatz):** **`docs/OFFLINE-KARTEN-UND-GEODATEN-ZIELBILD.md`** — ergänzt dieses Zielbild um **Kartenstufen**, **PWA-Speicher-Realität** und **LoRa-taugliche** Layer.

---

## 1. Warum zwei Wege?

| Pfad | Rolle | Typisch |
|------|--------|---------|
| **CoT / UDP** (Multicast oder Unicast) | Direktes „Aufsprühen“ ins **taktische LAN**; ATAK-Clients im selben Netz empfangen ohne zentralen Server. | UDP → z. B. bekannte Multicast-Gruppe oder Broadcast an bekannte IP. |
| **TAK Server** (z. B. OpenTAKServer, FreeTAKServer, kommerzielle Varianten) | **Verteilung, SSL, Nutzer/Gruppen, Persistenz**, Anbindung an weitere Systeme. | Morgendrot-Gateway **schiebt** CoT per **TCP/TLS** oder API in den Server → Server **verteilt** an ATAK-Clients. |

**Beides** abzudecken ist sinnvoll: **Feld / abgeschottetes Netz** oft UDP; **organisatorisch / mehrere Teams** oft TAK Server.

---

## 2. Architektur-Skizze (ohne Code-Pflicht)

1. **Quelle:** Morgendrot-Node (Streams, API, Heartbeat, später LoRa-Gateway) — je nach Feature **bereinigte** Lage-/Status-Objekte (kein Roh-Chat als Pflicht).
2. **Mapper („CoT-Adapter“):** eigener **kleiner Dienst** oder Modul: wandelt interne Events in **CoT-XML** um (`event` mit `point`, `uid`, `type`, `time`, `stale`, ggf. `remarks`).
3. **Ausgang:**
   - **UDP:** sendet CoT an konfigurierte **Multicast/Unicast**-Ziele.
   - **TAK Server:** nutzt dessen **Ingest-API** / Protokoll (produktabhängig dokumentieren, wenn implementiert).

**Bilder:** nicht als riesiges XML inline planen; üblich: **kurzer Link** oder **Data Package** / Server-seitige Ressource — sonst Funk und ATAK-Performance leiden.

---

## 3. Sicherheit & Produkthinweise

- CoT in Standard-Setups ist oft **nicht** gleichbedeutend mit **Messenger-E2EE** — **taktische Sichtbarkeit** bewusst trennen von **vertraulichem Chat**.
- **Identität:** stabile **`uid`** / Callsign-Zuordnung zu Morgendrot-Geräten/Personen definieren (nicht 1:1 IOTA-Adresse ohne Mapping).
- **Recht/Einsatz:** je nach Kunde **Datenminimierung** und **Freigaben** dokumentieren.

---

## 4. Abgrenzung zum Kernprodukt

- **Kein Blocker** für Phase A/B (Messenger-Stabilität, LoRa-MVP laut **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**).
- **Umsetzung:** nach **`docs/ROADMAP-FAHRPLAN.md`** **§ H.9** — wenn Kapazität und **konkreter Einsatzbedarf** da sind.
- **Schichtmodell & Roadmap P0–P3:** **§ 6** (Ergänzung 2026-06) — **Ideenspec**, keine Implementierungszusage.

---

## 5. Verwandte Dokumente

- **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** — wo Node/API sitzt.  
- **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`** — was operativ „draußen“ ankommt.  
- **`docs/MACRO-OPERATIONAL-PATTERNS.md`**, **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** — Phasen A/B/C.
- **`docs/MODULAR-KERN-ADAPTER-INTEROP.md`** — ATAK/CoT als **Adapter am Rand**, nicht Kern-Pflicht.
- **`docs/POSITIONING.md`** — Morgendrot **ersetzt** ATAK nicht.
- **`docs/OFFLINE-KARTEN-UND-GEODATEN-ZIELBILD.md`** — Live-Layer vs. LoRa-Payload-Grenzen.

---

## 6. Ergänzung: Schichtmodell und realistische Integrations-Roadmap (2026-06)

**Status:** **Ideenspec / Backlog** — präzisiert § 1–4; **keine** API- oder Lieferzusage. Umsetzung nur bei **Kundenauftrag** oder **abgeschlossenem Phase-B-Kern** (siehe **`docs/ROADMAP-FAHRPLAN.md`** § H.9).

### 6.1 Zielbild

**Morgendrot und ATAK sind komplementär**, nicht konkurrierend:

| System | Rolle |
|--------|--------|
| **ATAK** | Taktisches **Lagebild**, GeoChat, Marker, Mission Packages, C2-Ökosystem |
| **Morgendrot** | **Vertrauenswürdige** Einsatzkommunikation (E2EE, Mailbox, Team-Kanäle), Morg-Pkg, Einsatzberichte, Forensik, Handoff |

Typischer Einsatz: **zwei Apps** — ATAK auf der Karte, Morgendrot für sichere Kommunikation und dokumentierte Workflows. Der **CoT-Adapter** ist ein **separater Rand-Adapter** (Node/Gateway), **nicht** Teil des Messenger-Cores (`docs/MODULAR-KERN-ADAPTER-INTEROP.md`).

**Architektur-Hinweis:** Das offizielle **Meshtastic-ATAK-Plugin** nutzt die Meshtastic-**Android-App** (`IMeshService`). Morgendrot ist **PWA/APK + direktes BLE** zu Meshtastic. Mesh-Interop heißt **Koexistenz auf dem Funk**, nicht „Plugin im Messenger nachbauen“.

### 6.2 Schichtmodell

```
┌─────────────────────────────────────────────────────────┐
│  ATAK-Clients  ←  TAK Server / CoT-UDP  ←  CoT-Adapter  │
└─────────────────────────────────────────────────────────┘
                              ↑
                    (nur freigegebene Events)
                              ↑
┌─────────────────────────────────────────────────────────┐
│  Morgendrot Node / Boss-Gateway  ·  optional LoRa-GW   │
└─────────────────────────────────────────────────────────┘
         ↑                                    ↑
   Messenger (E2EE)              Meshtastic-Mesh (MORG_* + Standard)
```

| Schicht | Inhalt | Wo | Aufwand |
|---------|--------|-----|---------|
| **1 — CoT-Adapter (Outbound SA)** | Interne Events → CoT-XML → **ein** Ausgang (TAK Server **oder** UDP, nicht beides im MVP) | Node/API-Modul, **nicht** in `useChatViewCore` | Mittel |
| **2 — Mesh-Koexistenz** | Standard-Meshtastic-ATAK-Traffic und Morgendrot-**`MORG_*`/`PRIVATE_APP`** parallel auf derselben Zelle; ggf. **Gateway-Radio** (Heltec, MQTT-Bridge) | Funk-Infrastruktur + Doku | Niedrig (Doku) – Mittel (Gateway) |
| **3 — Morgendrot-ATAK-Plugin (optional)** | Data Packages (Morg-Pkg, Einsatzbericht), Workflow-CoTs, Deep-Link in Morgendrot-APK | Eigenes Java/Kotlin-Modul (ATAK SDK) | Hoch |

**Schicht 1** deckt § 2 (Mapper/Gateway) konkret ab. **Schicht 2** ersetzt **nicht** das Meshtastic-ATAK-Plugin im Handy, sondern verhindert Funk-Silos zwischen ATAK-Teams und Morgendrot-Teams.

### 6.3 Priorisierte Roadmap (nur bei Bedarf)

| Stufe | Zeitraum (Richtwert) | Inhalt | Nutzen | Nicht tun |
|-------|----------------------|--------|--------|-----------|
| **P0** | 2–4 Wochen nach Go | CoT-Adapter-Spec finalisieren; **ein** Ziel (OpenTAKServer *oder* UDP); Test-Setup ATAK-CIV + Gateway; **Datenklassifizierung** (Tabelle § 6.4) | Pilotfähig für SAR/BOS | Kein Code im Messenger-Core |
| **P1** | +2–4 Wochen | Mesh-Koexistenz dokumentieren + Feldtest gemischte Ausrüstung | Interop ohne Fork | Kein ATAK-Protobuf-Stack in der PWA |
| **P2** | bei Kundenbedarf | Schlankes Morgendrot-ATAK-Plugin (Packages + Status-CoTs) | Profi-Differenzierung | Kein vollständiges Meshtastic-Plugin-Nachbau |
| **P3** | langfristig | Selektive Rückkanäle (Marker → Einsatz-Notiz), **immer** getrennt vom E2EE-Chat | Operative Brücke | Kein GeoChat ↔ Thread-Merge |

**Entscheidung vor P0-Code:** Wer betreibt den TAK Server? Welche Events sind **taktisch freigegeben**? Reicht **Outbound-only**?

### 6.4 Explizite Nicht-Ziele

- **Kein** GeoChat ↔ E2EE-Thread-Merging ohne **Klassifizierung und Freigaberegeln** (taktisch ≠ vertraulich).
- **Kein** vollständiges Nachbauen des **Meshtastic-ATAK-Plugins** im Messenger.
- **Keine** rohen **CoT-XML-Payloads über LoRa** — nur kurze Profile oder Gateway (vgl. **`docs/OFFLINE-KARTEN-UND-GEODATEN-ZIELBILD.md`** § 1.4).
- **Kein ATAK-Ersatz** — vgl. **`docs/POSITIONING.md`**.

### 6.5 Datenklassifizierung (Entwurf — vor Implementierung festlegen)

| Event-Typ | Taktisch freigebbar? | CoT-Hinweis |
|-----------|----------------------|-------------|
| SOS / `MORG_EMERGENCY_V1` | Ja (Alarm, minimiert) | Kurzer Alarm-CoT, **kein** Volltext |
| Heartbeat / Gerätestatus | Ja (aggregiert) | PLI-ähnlich, stale/time pflegen |
| Team-Position (falls vorhanden) | Ja, mit Opt-in | uid ≠ IOTA-Adresse 1:1 |
| Verschlüsselter Chat / Mailbox | **Nein** | Bleibt in Morgendrot |
| Handshake / Morg-Pkg-Rohdaten | **Nein** | Ggf. P2: Data Package, nicht GeoChat |
| Einsatz-Manifest / Forensik | **Nein** (Standard) | Optional P2: signierter Export als Package |

### 6.6 Nächste konkrete Schritte (P0 — nur Doku & Lab)

1. **CoT-Adapter-Spec** (Event-Schema → CoT-Typen, uid-Mapping, ein UDP- *oder* TAK-Pfad).
2. **Lab-Setup:** ATAK-CIV + OpenTAKServer (oder UDP-Multicast) + Morgendrot-Node als Dummy-Quelle.
3. **Datenklassifizierung** mit Stakeholder absegnen (Tabelle § 6.4).
4. **Go/No-Go:** Erst danach Implementierungsticket — sonst bei **§ H.9** in Doku-Only belassen.

---

*Stand: 2026-06-16 — Zielbild § 1–5 unverändert gültig; § 6 Ergänzung Schichtmodell (Ideenspec, keine API-Garantie).*
