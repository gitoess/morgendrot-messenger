# ATAK / Cursor-on-Target (CoT) — Zielbild & Backlog

**Status:** **Dokumentiert, nicht implementiert.** Zwei Zielpfade parallel vorgesehen: **CoT über UDP (klassisch)** und **Anbindung über einen TAK Server**.

**Kontext:** Morgendrot liefert Einsatzdaten (Position, Status, optional Bilder/Metadaten). **ATAK** (Android Team Awareness Kit) zeigt **Lage** auf der Karte, wenn die Daten als **CoT-Events** (XML) oder über einen **TAK-kompatiblen Server** ankommen.

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
- **Umsetzung:** nach **`docs/ROADMAP-FAHRPLAN.md`** **§ H.9** — wenn Kapazität und konkreter Einsatzbedarf da sind.

---

## 5. Verwandte Dokumente

- **`docs/BACKEND-VS-DIREKT-IOTA-ERKLAERUNG.md`** — wo Node/API sitzt.  
- **`docs/NOTFALL-REICHWEITE-BRUECKEN-UND-BACKLOG.md`** — was operativ „draußen“ ankommt.  
- **`docs/MACRO-OPERATIONAL-PATTERNS.md`**, **`docs/PROJECT-FOCUS-AND-PRIORITIES.md`** — Phasen A/B/C.

---

*Stand: 2026-03-28 — Zielbild zur späteren Anbindung; keine API-Garantien bis zur Implementierung.*
