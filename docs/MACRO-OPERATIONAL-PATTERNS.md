# Makros: Betriebsmuster (Hop, QoS, ACK, Autonomie, Akku) – kritisch geschärft

**Status:** Richtlinie zur **Einordnung** eurer Vorschläge; ergänzt `docs/MACRO-BIDIRECTIONAL-SPEC.md` und `src/shared/opcodes.ts` (**`MacroPriorityClass`**).  
**Nicht:** Meshtastic oder BOS 1:1 nachbauen – **Meshtastic-First** (`docs/PROJECT-FOCUS-AND-PRIORITIES.md`).

---

## 1. Kanal-, Hop- und Modem-Logik (von Meshtastic lernen)

**Sinnvoll:** TTL/Hop-Limit und bekannte **Modem-Presets** zu nutzen – aber **zwei Ebenen** trennen:

| Ebene | Wer entscheidet? | Empfehlung |
|-------|------------------|------------|
| **Meshtastic-Firmware** | Routing, Standard-TTL, Store-and-Forward | **Nicht** duplizieren: Paket-Hop-Zähler existiert dort bereits. |
| **Morgendrot-Custody / Makro-Header** | „Wie oft darf **dieses** Ereignis noch **funktechnisch** weitergegeben werden?“ / Metadaten für Audit | Optional **zusätzliches** `ttl` oder `mesh_hops_remaining` im **eigenen** Binär-Wrapper – **nur** wenn ihr wirklich eine **zweite** Policy braucht (z. B. Einsatz-Ghosting verhindern **zusätzlich** zur Firmware). |

**Verbesserung:** Statt „Hop ins Binär nachbauen“ zuerst prüfen: reicht **Meshtastic-TTL** + eure **Queue/Airtime**-Politik (`LORA-IOTA-DELAYED-UPLOAD-SPEC`)? Zusatz-Byte nur, wenn ein **konkreter** Audit-Pfad es verlangt.

**Notfall → weitreichendes Profil:** sinnvoll als **Makro** (langsames, robustes Preset) – **rechtliche** Sendeparameter und **Duty-Cycle** weiter beachten.

---

## 2. Priorisierung (QoS) – BOS-artig, **ohne** Opcodes umzunummerieren

Die Idee **Kategorien + Sendereihenfolge** ist gut. **Kritik:** Opcodes **nicht** in neue Bereiche **0x40–0x4F / 0x50–0x8F** **verschieben**, solange `MacroOpcode` und Specs bereits **0x40, 0x50, …, 0xB0** nutzen – sonst **Breaking Change**.

**Bessere Abbildung:** **`MacroPriorityClass`** (Flash / Operational / Routine / Background) als **eigenes** Konzept; jedem **`MacroOpcode`** eine **Prioritätsklasse** zuordnen (siehe `macroPriorityClass()` in `src/shared/opcodes.ts`). Die Sendeschicht sortiert und **unterbricht** nach **Klasse**, nicht nach Hex-Bereich.

**Vorschlag für Zuordnung (anpassbar):**

| Klasse | Typische Opcodes | Logik (kurz) |
|--------|------------------|--------------|
| **Flash** | `EventTrigger` (0x40) | Notfall zuerst; ggf. mehrfach senden, wenn Policy erlaubt. |
| **Operational** | `PresenceLog`, `InfrastructureControl`, `PowerCommander` | Lage, Schloss/Relais, Stromspar – kurze Verzögerung ok. |
| **Routine** | `BeaconMode` | Team-Radar / Nahortung ohne Notfallcharakter. |
| **Background** | `DataQuery`, `BreadcrumbEcho`, `MeshTopologyDiscovery` | nur bei „leisem“ Kanal / niedriger Last. |

**Kritik an „alles andere unterbrechen“:** Strenges **Preemption** auf **einem** Funkkanal kann **Fairness** und **Mesh-Stabilität** stören – besser: **Warteschlange** + **Retry** für Flash, **Drop** oder **Defer** für Background bei Konflikt, nicht blind alle Chat-Pakete „hart“ killen (Meshtastic hat eigene Fairness).

---

## 3. ACK-Strategie und IOTA-„Beweiskette“

**Sinnvoll:** Makro = **erledigt** erst mit **LoRa-ACK** (oder gleichwertiger Rückmeldung).

**Grenzen:**

- **Latenz:** Wald ↔ Basis kann **Minuten** dauern; „erst dann IOTA schreiben“ ist **korrekt für Nachweis**, aber **nicht** für Echtzeit-UX.
- **Teilerfolg:** Gateway hat gefunkt, Gerät hat **nicht** bestätigt → Zustände **pending / failed / acked** modellieren, nicht nur ein Bit.
- **IOTA:** „Erfolgreich ausgeführt“ im Tangle nur, wenn **Policy** das so definiert (sonst: nur **„Befehl ausgestellt“** on-chain, ACK separat im Audit).

**Verbesserung:** Kleines **ACK-Frame** (Opcode + `correlation_id` + Hash) in Spec festhalten; **kein** voller Klartext in ACK nötig.

---

## 4. „Chaos-Regel“ / lokale Relay-Hierarchie

**Intuition gut** (wer hilft dem Netz am meisten?). **Kritik:**

- Meshtastic hat bereits **Router / Client**-Rollen; **eigenes** „stärkster Akku = Haupt-Relay“ kollidiert leicht mit **Firmware-Routing** und kann **Schleifen** oder **instabile** Rollenwechsel erzeugen.
- **Höchster Punkt** ohne gutes Karten-/Höhenmodell: heuristisch riskant.

**Verbesserung:** Zuerst **Meshtastic-Standard** (Router-Modus, vernünftige Stationenplatzierung). Nur **zusätzlich** ein **optionaler** Hint (Makro „Router aus“ / „Client only“) – wie in eurer älteren Macro-Doku – statt vollautomatischer **Wahl des Haupt-Relays** durch die App.

---

## 5. Akku-Stufen (20 % / 10 % / 5 %)

**Sinnvoll** als **Richtlinie** für **lange** Einsätze.

**Einschränkungen:**

- **PWA/Browser:** **Battery Status API** ist eingeschränkt/entfernt auf vielen Mobilgeräten – Schwellen **pro Gerät** kalibrieren oder **nur Heltec/Basis** zuverlässig.
- **Display aus ab 10 %:** beim **Handy** oft der **einzige** UI-Weg; „nur noch LED am Heltec“ setzt **Hardware** und **Firmware** voraus.
- **GPS aus ab 20 %:** Abwägung Sicherheit vs. Laufzeit – dokumentieren (Einsatzmodus „nur noch Notfall-Pos“).

---

## 6. Opcode-Bereiche neu schneiden? (0x40–0x4F vs 0x50–0x8F …)

**Nicht empfohlen** ohne Migrationsplan: eure **festen** Slots **0x40, 0x50, …, 0xB0** sind bereits Spec + `MacroOpcode`. **QoS über Prioritätsklasse**, nicht über Hex-**Umnummerierung**.

**Unter-Adressen:** Innerhalb eines Opcodes (z. B. 0x40–0x4F für **Subcommands** von EventTrigger) bleiben **reserviert** – siehe Kommentar in `opcodes.ts`.

---

## 7. Heartbeat-Kachel / Streams und der Messenger

**Ist-Zustand:** Heartbeat ist **implementiert** (`/heartbeat`, `monitoring.ts`, optional **Streams**-Publish). In der **Boss-/Lite-UI** gibt es **Monitor-/Action-Center**-Ansätze; Heartbeat braucht **S-Bit** (`ROLE_ID`) und **Bridge** (`STREAMS_BRIDGE_URL`).

**Macht Streams für den Messenger Sinn?**

- **Ja, eingeschränkt:** Wenn ein **Internetweg** zur Basis existiert, sind Streams ein **leichtgewichtiger Kanal** für „noch am Leben“ / Status – **parallel** zu IOTA-Mailbox, nicht Ersatz für **Chat**.
- **Nein als alleinige Lösung im Wald:** Ohne Uplink **kein** Streams; dann **LoRa/Mesh**, **Delayed Upload**, **Mailbox** – wie in eurer Architektur-Doku.

**Heartbeat im Messenger-Chat sinnvoll?**  
**Optional und getrennt** vom Chat: als **kleine Statuszeile** oder **Einstellungskachel** („Puls an Basis“, wenn Bridge konfiguriert) – **nicht** jedes Heartbeat als Chat-Nachricht, um **Spam** und **Kosten** zu vermeiden. Für **reinen Funk** eher **seltene** LoRa-„I’m ok“-Makros (eigener Opcode/Policy), nicht den klassischen Streams-Heartbeat.

---

## Verwandte Dateien

- `src/shared/opcodes.ts` – `MacroPriorityClass`, `macroPriorityClass`  
- `docs/MACRO-BIDIRECTIONAL-SPEC.md`  
- `docs/STREAMS-INTEGRATION.md`  
- `docs/PROJECT-FOCUS-AND-PRIORITIES.md` (Meshtastic-First)
