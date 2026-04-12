# Notfall: Reichweite, Brücken zur Hilfe, Backlog (Entscheid 2026-03)

**Zweck:** Operative Erwartungshaltung und Produktentscheidungen festhalten — **getrennt** von **`docs/NOTFALL-PURGE-MESSENGER.md`** (technischer Purge/Cache) und **`docs/NOTFALL-DATENSPEICHER.md`** (Testament o. Ä.).  
**Technik LoRa ↔ IOTA:** **`docs/LORA-IOTA-NOTFALL-GATEWAY-REALITAET.md`** (**Fahrplan § H.3m**) — keine volle TX über Funk; Gateway/Delayed Upload.

---

## 1. Wen erreicht man mit Morgendrot / IOTA / LoRa?

| Pfad | Typische Gegenstelle |
|------|----------------------|
| **IOTA / Vault / euer Protokoll** | Nur **Teilnehmer eures definierten Ökosystems** (gleiche Konfiguration, Schlüssel, autorisierte Kontakte, Gateways). |
| **Offizielle Rettungskette (112, BOS/TETRA)** | **Nicht** automatisch. Leitstellen nutzen andere Systeme; ein IOTA- oder Morgendrot-Event ist für sie **kein** standardisierter Notruf. |
| **Fremde LoRa-/Meshtastic-Geräte** | **Nur**, wenn das Paket in **deren** erwartetes Format und **Kanal/Key** passt. Standard-Hardware „hört mit“, verarbeitet aber **kein** beliebiges proprietäres Frame. |

**Kurz:** Morgendrot ist eine **Nabelschnur zum eigenen Team und zu konfigurierten Brücken** — **kein** Ersatz für den behördlichen Notruf.

---

## 2. Brücke zur professionellen Hilfe

- **Bewährt:** Person an der Basis (mit Internet) **wertet** Lage aus und **ruft 112** oder koordiniert mit einer Organisation, die ihr bewusst eingebunden habt.
- **Automatisierung (SMS, Webhooks, E-Mail an private Notfalllisten):** grundsätzlich **sinnvoll** für **von euch konfigurierte** Empfänger — mit **Logging**, **Rate-Limits**, **Verzögerung/Abbruch** und **zweiter Bestätigung** am sendenden Gerät (False-Alarm-Risiko).
- **Direkte, unbestätigte Anbindung an 112 / Leitstellen** über Drittanbieter-APIs: **nicht** als stillschweigende Produktannahme planen; **rechtlich und organisatorisch** separat klären (oft ungeeignet oder unerwünscht).

---

## 3. Aktuelle Produktentscheidung (Meshtastic / „HILFE“-Reichweite)

Nach Abwägung **Reichweite (maximal viele Relays)** vs. **Kontrolle, Sicherheit, Aufwand** gilt **für die laufende Roadmap**:

- **Weiter wie bisher:** Morgendrot-Notfalltransport über definierte Pfade (**Emergency Envelope / Binary v2**, Bridge, siehe **`lora-bridge/README.md`**, **`heltec/README.md`**), **Meshtastic-First** und **nah am Standard** wie in **`docs/MESHTASTIC-BUILDING-BLOCKS.md`**.
- **Bewusst nicht** vorgezogen: zusätzlicher Pfad **Klartext-SOS** als „globaler“ **Standard-Meshtastic-Chat** auf öffentlichen Kanälen (z. B. LongFast), nur um fremde Relays zu maximieren — wegen **uneinheitlicher Kanalnutzung**, **Spoofing**, **Datenschutz** und **irreführender Erwartung** („Feuerwehr sieht mit“).

Diese Ideen bleiben als **Backlog** dokumentiert (siehe § 5), **ohne** aktuelle Implementationspflicht.

---

## 4. Plugin vs. Firmware (Kurzreferenz)

| | Firmware (enger Stack) | „Plugin“ / Modul am Meshtastic-Ökosystem |
|--|------------------------|------------------------------------------|
| **Kontrolle / Priorität SOS** | Hoch (Radio-Policy, eigene Pakete). | Begrenzt; kein zuverlässiges „Vordrängeln“ aller TX. |
| **Akzeptanz bei Dritten** | Gering (kompletter Wechsel). | Höher (gewohnte App/Firmware bleibt Basis). |

Für **hart priorisierten** SOS ist **Firmware- oder tiefe Firmware-Integration** plausibler; **Plugin** eher für **Breite**, nicht für dieselbe Garantieklasse.

---

## 5. Backlog (optional später, mit eigener Spec)

- **Opt-in „öffentlicher SOS“:** fester Kanal/Region, **Klartext** nur nach **expliziter Zustimmung** in der UI (Warnung: lesbar/spoofbar).
- **Dual-Use-Heltec:** dieselbe Hardware sendet **optional** zusätzlich Meshtastic-natives Chat — **hoher** Integrations- und Testaufwand (Airtime, Kollisionen, zwei Schichten); nur wenn **messbar** Bedarf (dünnes Mesh zu eigenen Gateways).

---

## 6. Verwandte Dokumente

- **`docs/OFFLINE-FAEHIGKEIT.md`** — Meshtastic vs. Morgendrot-Schichten, Kanal/PSK.
- **`docs/MESHTASTIC-BUILDING-BLOCKS.md`** — Leitlinie + § 6 Entscheidungsprotokoll.
- **`docs/LORA-MESH-DEFERRED-SETTLEMENT-KRITIK.md`**, **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`** — Gateway / Delayed Upload.
- **`docs/ROADMAP-FAHRPLAN.md`** § **G** (Purge), § **I** (Relay-/Notfall-Narrativ).
- **`docs/UI-ROLLEN-WORKSPACES.md`** — Lite-Messenger UI (`UI_VARIANT=messenger`) und **Boss-Ausnahme** (Volldashboard).

---

*Stand: 2026-03-28 — Abstimmung: aktuelle Linie beibehalten; Backlog für spätere Priorisierung.*
