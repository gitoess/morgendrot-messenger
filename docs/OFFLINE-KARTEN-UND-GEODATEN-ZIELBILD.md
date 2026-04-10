# Offline-Karten & Geodaten: Zielbild (Wanderer vs. Einsatzkräfte)

**Status:** **Architektur- und Produkt-Einordnung** — **keine** Implementierungspflicht. Karten/Geodaten sind **optional** zum Messenger-Kern (Chat, Vault, IOTA, LoRa).  
**Verknüpft:** **`docs/PWA-MANUAL-CHECKS.md`**, **`docs/PWA-HANDBUCH-OFFLINE.md`**, **`docs/OFFLINE-FAEHIGKEIT.md`**, **`docs/ATAK-COT-INTEGRATION-ZIELBILD.md`**, **`docs/ROADMAP-FAHRPLAN.md`** § **H.9**, **§ H.11**.

---

## 1. Kritische Prüfung eurer Begriffe

### 1.1 „Statische Karte“

| Begriff | Einordnung |
|---------|------------|
| **Ein festes Bild (PNG) pro Zoomstufe** | **Zoom/Ebenen** schwer; **viel Speicher** pro Abdeckung — für **große** Gebiete unpraktisch. |
| **Vektor-Tiles (z. B. MapLibre + OSM-Vektor)** | **Skalierbar**, oft **weniger Volumen** als vergleichbare **Raster-HD** — aber **nicht** pauschal „100×“; hängt von **Stil, Region, Detailgrad** ab. |
| **Raster-Tiles (XYZ)** | Üblich für **Luftbild**; **Datenvolumen** steigt stark mit **Zoom und Fläche**. |

**Verbesserung:** Nicht nur „statisch vs. Vektor“ — sauber trennen: **Vektor-Basiskarte**, **optional Raster-Overlays** (Höhe, Luftbild), **Live-Layer** (Punkte/Linien, ggf. CoT-ähnlich).

### 1.2 PWA-Cache vs. „wird nie gelöscht“

**Fehler in der Naiv-Fassung:** Browser **dürfen** Service-Worker-Cache und **Storage** unter **Speicherdruck** **verdrängen** oder den Nutzer zum Freigeben auffordern — es gibt **keine** Garantie „**niemals gelöscht**“, nur weil etwas „installiert“ ist.

**Besser:**

- **Stufe 1 (Basis):** bewusst **klein** halten (Vektor + begrenzte Region) — dann ist **Wiederherstellung** nach Eviction **akzeptabel** (erneuter Download bei WLAN).
- **Stufe 2 (Einsatzpaket):** **Persistent Storage** (`navigator.storage.persist()` nach **User-Gesture**/Policy) **anfordern** — **erhöht** Überlebenswahrscheinlichkeit, **garantiert** sie auf allen Geräten **nicht**. Große Downloads (**z. B. 800 MB**) brauchen **Zustimmung**, **Quota-Check**, **Resume** und klare **UI** („Speicher fast voll“).
- **Native App** (später): **eigener** Speicherbereich oft **vorhersehbarer** — dann erst **stärkere** „Fest eingemottet“-Story **vertretbar**.

### 1.3 „Militärische Rasterkarten“

**Kritik:** Viele **militärische/geodätische** Produkte sind **lizenziert** oder **nicht** für **Weitergabe** in einer **öffentlichen App** geeignet. **Technisch** möglich ≠ **rechtlich** erlaubt. Immer **Quelle, Lizenz, Einsatzland** klären.

### 1.4 Live-Layer über LoRa (CoT/JSON)

**Richtung:** **Kleine** semantische Updates (Position, Symbol, kurzer Status) **können** über **enge** Funkpfade — **wenn** **kompakt** codiert und **Airtime** eingehalten ist.

**Korrektur:** **Rohes** **CoT-XML** ist für **240-B-Mesh** in der Regel **unpassend** — es braucht **Mapping** auf **kurze** Binary/JSON-Profile (siehe **`docs/ATAK-COT-INTEGRATION-ZIELBILD.md`**, Phase-B-Realität).

### 1.5 WGS84 / Maßstab / GPS

**Richtig:** **Einheitliches Bezugssystem** (typ. **WGS84** für GPS und die meisten Web-Karten) vermeidet **systematische** Versätze.

**Ergänzung:** **Höhenmodell**, **Magnetische Deklination**, **schlechtes GPS** (Tal, Höhle) sind **Betriebs**-Themen — Karte allein **ersetzt** keine **Sensor-/Kalibrierungs**-Disziplin.

---

## 2. Verbessertes **3-Stufen-Modell** (rollenbewusst)

| Stufe | Zielgruppe | Inhalt (Beispiel) | Speicher / Technik | Erwartung **ohne** Netz |
|-------|------------|-------------------|---------------------|-------------------------|
| **1 — Basis** | **Wanderer**, allgemein | **Vektor-Basiskarte** begrenzte Region (OSM-konform, **Lizenz beachten**) | SW-Cache + ggf. **Cache Storage API**; **klein** halten | **Orientierung grob**; nach Eviction **erneut laden** |
| **2 — Einsatzpaket** | **Einsatzkräfte** (nach **Boss/Provisioning**) | Zusätzlich **höhere Detailtiefe**: lokale Raster-Overlays, **Hoheitskarten** nur mit **Recht** | **Gezielter** Download, **persist** anfragen, **Fortschritt/Abbruch** | **Deutlich** robuster; **kein** „unverlierbar“-Versprechen ohne **Native** |
| **3 — Live-Layer** | Team / ATAK-Pfad (später) | **Punkte/Linien/Polygone**, Status — **minimal** encodiert | **Online** oder **LoRa** je nach Profil | **Nur** was durch **Transport** passt |

**Wanderer:** Stufe 1 als **Service** („besser als nichts“), **kein** Pflicht-Einsatzpaket.  
**Einsatzkraft:** Stufe 2 als **operative** Option **nach** klarer **Policy** (Datenschutz, Auftragsdaten, Löschfristen).

---

## 3. Was sonst noch wichtig wäre

| Thema | Warum |
|--------|--------|
| **Recht & Lizenz** | OSM **ODbL**, kommerzielle Kachelanbieter, **Hoheitskarten** — **vor** Feature verschriftlichen. |
| **Privacy** | **Einsatzkarten** können **sensible** Operationsmuster zeigen — **TTL**, **Purge**, **Zugriff nur mit Rolle**. |
| **IOTA / Server** | Große Tiles **nicht** on-chain; höchstens **Manifest/Hash** (Hybrid-Diskussion, **`docs/ROADMAP-SICHERHEIT-VERTRAUEN-UND-SCHLANKHEIT.md`**) — **Blob** auf Server oder **Sneakernet**. |
| **ATAK** | Brücken **CoT/TAK** → **`docs/ATAK-COT-INTEGRATION-ZIELBILD.md`**, Fahrplan **§ H.9** — **nach** stabilem **Phase-B**-Kern. |
| **PWA-Realität** | **`docs/PWA-MANUAL-CHECKS.md`** — Offline ist **teilweise**, nicht magisch. |

---

## 4. Fazit

- **Differenzierung Wanderer vs. Einsatzkraft** ist **sachlich** und **empfehlenswert**.  
- **Technisch** präzisieren: **Vektor-Tiles** + **optional Raster** + **kleine Live-Layer**; **keine** falschen Garantien zu **PWA-Persistenz** und **LoRa-Bandbreite**.  
- **Umsetzung** ist **eigenes** Epik — **nicht** vor **Mesh/IOTA-MVP** blockieren, außer es gibt **harten** Kundenbedarf.

---

*Stand: 2026-03-28*
