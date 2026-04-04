# Ausrichtung, Prioritäten und Reihenfolge (Morgendrot Messenger)

**Zweck:** Ein gemeinsames Bild für Mensch und KI – **gegen Feature-Creep** und **falsche Parallelität**.  
**Stand:** lebendes Dokument; bei Abweichung im Code lieber **dieses Dokument** oder den Code anpassen.

---

## 1. Gesamtausrichtung (unverändert gültig)

| Pfad | Rolle |
|------|--------|
| **IOTA Rebased** | **Primärpfad**, wenn Infrastruktur da ist: persistente Ablage und Messaging (Mailbox/Events). **Nicht** „Alltags-Chat“, sondern **Einsatz-/Kernpfad** im Krisen-Setup. |
| **LoRa (Heltec / Meshtastic)** | **Starker Notfall- und Offline-Fallback**, wenn kein zuverlässiger Internetweg da ist. |

**Meshtastic:** **Baukasten** – möglichst **Standard-Firmware und -Ökosystem** (Routing, Store-and-Forward, MQTT, Module); **kein** großes eigenes Funkprotokoll / Fork, **wenn** es sich vermeiden lässt (**`docs/MESHTASTIC-BUILDING-BLOCKS.md`**).

**Gerät:** **Eine** Basis (Heltec + Meshtastic + Morgendrot-Anbindung); **keine** getrennten Gerätetypen in der Software – nur **Ausbaustufen** (z. B. mit/ohne Host/Display, Relais „abgespeckt“).

**Strom:** **Brownout-Schutz** und **sauberes Power-Management** sind **kritisch** (Hardware + Software) – mit Hardware-Specs und Host-Politik abstimmen.

**Einsatzorte** (Drohne, Ballon, Wand, …) = **dieselbe Software**, andere Montage – siehe **`docs/DRONE-RELAY-STRATEGY.md`**.

**Internet / Basis-Gateway:** Der **CM4 hat keinen SIM-Slot**; an der **Basis-Station** (fest, z. B. Höhleneingang/Lager) kann ein **LTE/4G HAT + SIM + Antenne** den **Uplink** liefern; **WiFi** als Backup. **SIM nur an der Basis** – **Vortrupp/Relais ohne SIM**, nur LoRa (und ggf. `.morg-pkg`). Detail und Rollen (Basis vs. Heltec-Vortrupp): **`hardware/README.md`** („Internet an der Basis“).

**Meshtastic-First (für alle weiteren Vorschläge):** Möglichst **Standard-Meshtastic** (Firmware + Client/Ökosystem); **nur gezielte, minimale Erweiterungen** (z. B. eigene PortNum, Airtime-/Prioritäts-Hooks, Custody-Metadaten). **Kein** großes eigenes Chunk-Protokoll und **kein** Routing-Neuaufbau, **wenn** es sich vermeiden lässt. Übersicht **1:1 vs. Eigenlogik:** **`docs/MESHTASTIC-BUILDING-BLOCKS.md`**. **Gilt auch für Refactorings** (UI, Skripte, API): keine parallelen Funk- oder Chunk-Pfade einführen, wenn Meshtastic/Module/MQTT dieselbe Rolle tragen können.

Verknüpfte Doku: **`docs/MESHTASTIC-BUILDING-BLOCKS.md`**, **`docs/LORA-IOTA-DELAYED-UPLOAD-SPEC.md`**, **`docs/PROTOCOL-ANCHOR-VERIFY-SPEC.md`**, **`hardware/README.md`**. **Macro-/Gateway-Epic** (Steuerung über IOTA + lokale Ausführung am Gerät): **`docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`**, **`docs/MACRO-BIDIRECTIONAL-SPEC.md`** (Wald↔Netz, Opcodes 0x40–0xB0), **`docs/ROADMAP-FAHRPLAN.md`** (C.1, E) – **erst nach Phase B**, siehe Phase-C-Tabelle.

### Frequenz-Strategie (868 / 433 / BOS)

| Stufe | Hardware-Aufwand | Rechtlicher Status | Taktischer Nutzen |
|--------|------------------|--------------------|-------------------|
| **868 MHz** | Null (Standard) | ISM (u. a. 1 % Duty Cycle je nach Region/Regeln) | Schneller Start, gute globale Verfügbarkeit und Community-Support |
| **433 MHz** | Gering (Modultausch + passende Antenne) | ISM (bessere Penetration, teilweise günstigeres Duty-Cycle-Regime je Region) | Stabilerer Link in feuchtem Fels, Höhlen und verwinkelten Umgebungen – **primärer mittelfristiger Optimierungsweg** |
| **BOS (380–400 MHz)** | Hoch (Spezialmodul, angepasste Filter) | **Sondergenehmigung erforderlich** | Maximale Priorität und Airtime (kein normales ISM-Duty-Cycle-Limit) – **nur** für behördliche Einsätze |

**Für alle weiteren Vorschläge und Planungen:** **868 MHz** = Standard für Tests und Entwicklung; **433 MHz** = mittelfristiges Ziel für Einsatzrealität (Höhlen, Berge, feuchtes Gelände); **BOS** = langfristig, nur mit klarer behördlicher und Hardware-Roadmap. Detail und Tabellen-Spiegel: **`hardware/README.md`** (Abschnitt „Frequenz-Strategie“).

---

## 2. Reihenfolge der Arbeit (verbindlich)

### Phase A – jetzt: Code-Qualität & Stabilität

- **`chat-view.tsx`** (und nahe liegende Chat-Teile) **schrittweise** zerlegen; Zielbild: **deutlich unter ~1000 Zeilen** für die View, Logik in **Hooks** / **Hilfsmodulen** (z. B. **`use-chat-view-send-flow.ts`**, **`use-chat-view-attachments.ts`**, **`use-chat-view-inbox.ts`** (Mailbox-Fetch + Mesh-Merge), **`chat-view-attachment-bar.tsx`**, **`chat-view-send-panel.tsx`**, **`chat-view-setup-panel.tsx`**, **`chat-view-chat-header.tsx`**, **`chat-view-transport-card.tsx`**, **`chat-view-inbox-list.tsx`**, **`chat-view-inbox-toolbar.tsx`**, **`chat-view-inbox-panel.tsx`**). In **`chat-view-inbox-list.tsx`** ist kurz dokumentiert, welche Inbox-Teile **Meshtastic-nah** (Anzeige bereits zusammengeführter Nachrichten) vs. **Morgendrot** (MORG_*-Darstellung, Exporte) sind. **Prüfer-Übersicht** Messenger-Fähigkeiten: **`docs/MESSENGER-CAPABILITIES-OVERVIEW.md`**.
- **Kein** großflächiges Löschen in **`exports/Morgendrot-Messenger-*`** – Quelle bleibt **`src/`** (siehe **`docs/MESSENGER-BUNDLE-SOURCE-OF-TRUTH.md`**).
- Änderungen in **kleinen, reviewbaren** Schritten mit **`tsc`/Tests** nach jedem Schritt.

### Phase B – danach: Kern LoRa + IOTA (MVP)

- **Zuverlässiges** Senden/Empfangen über den bestehenden Pfad (Mesh v2, Web-BT).
- **Delayed LoRa → IOTA Upload (MVP):** lokale Queue, Upload bei Internet, **Gateway-Custody** (Morgendrot-Device-Key) + **Hop-Metadaten** wie in Spec – **ohne** volle Relais-Kette pro Hop.

### Phase C – später (bewusst zurückgestellt)

| Thema | Hinweis |
|-------|---------|
| **Volle Chain-of-Custody (pro Hop)** | **Optional** – nur wenn Gateway-MVP nicht reicht; **`meshtastic/PHASE-2-FIRMWARE-SPEC.md`** als Referenz, **Meshtastic-First** beachten. |
| **Airtime-Budget-UI** | Wichtig für Einsatz, aber **nach** stabiler Basis – **`LORA-IOTA-DELAYED-UPLOAD-SPEC.md` §9.7**. |
| **Protokoll & Nachweis** (manuell) | Spec fertig; **Implementierung** nicht vor **Phase B** priorisieren, wenn Ressourcen knapp. |
| **Dual-Band 433+868** | Primär **Basis/Relais**-Hardware; Software nur **bandbewusst**, kein Sprint-Thema. Einordnung 868 vs. 433 vs. BOS: **Frequenz-Strategie** oben und **`hardware/README.md`**. |
| **Gehäuse / IP68 / Kamera** | Hardware; parallel zur Software planen, aber **nicht** die Code-Roadmap sprengen. |
| **IOTA-Makros → LoRa → Handy/Heltec** (Gateway, **Macro-Interpreter** auf dem Phone, optionale OTA-**Anstöße**) | **Nach** stabiler **Phase B** (Kern LoRa + IOTA MVP) – nicht parallel dazu als zweites Großprojekt. Detaillierte Ideen, Szenarien und Kritik: **`docs/HYBRID-MESH-GATEWAY-IOTA-MACROS.md`**; Priorisierung im **Fahrplan** **`docs/ROADMAP-FAHRPLAN.md`** (Abschnitt **E**). **Meshtastic-First:** Befehle möglichst als **kurze IDs** abbilden, vorhandene Firmware-/Client-APIs nutzen, kein eigenes vollständiges Funk-Steuerprotokoll neben Meshtastic. |
| **„Zentralserver“ / globales blindes Relay / DID-Register / Anonymitäts-Stufen** | **Nicht** als fertiges Produkt vor **Phase B** verkaufen; kritische Einordnung und Reihenfolge: **`docs/ROADMAP-FAHRPLAN.md` § I**. Umsetzung nur **phasenweise** (B = Delayed Upload; C = Gateway/Makros; DID/Twin separat laut **`PROTOCOL-CHANNELS-TX-VS-STREAMS.md`**). |

---

## 3. Warnsignal Feature-Creep

Gleichzeitig offen zu halten: **IOTA-Verankerung**, **Delayed Upload + Custody**, **Airtime**, **Drohnen**, **Dual-Band**, **Gehäuse** – **überfordert** Lieferfähigkeit und Tests.  

**Regel:** Neue Ideen **in die Spec schreiben** ist ok; **implementieren** nur gemäß **Phase A → B → C** oben.

---

## 4. Kurz-IST (nur zur Orientierung)

- **`chat-view.tsx`:** nur noch Verdrahtung (Variante → **`use-chat-view-core`** → **`ChatViewMainContent`**); Größenordnung **&lt; ~50 Zeilen**.
- **Anhänge / Senden:** Logik in **`lib/chat-view-attachment-ingest.ts`**, **`use-chat-view-attachment-previews.ts`**, **`lib/chat-view-outgoing-payload.ts`**, **`lib/chat-view-send-utils.ts`**; **`use-chat-view-attachments.ts`** und **`use-chat-view-send-flow.ts`** bleiben dünne Hooks/Fassaden.
- **Bundle:** `npm run bundle:messenger` spiegelt **`src/`** – nicht manuell im Export pflegen.

---

*Dieses Dokument präzisiert die Nutzer-Entscheidung: **Code-Qualität und Kern-LoRa/IOTA-MVP vor breiter Feature-Fläche**.*
